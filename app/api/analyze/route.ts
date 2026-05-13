import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { parseBackendRoutes } from '../../../lib/parsers/backend'
import { parseFrontendCalls } from '../../../lib/parsers/frontend'
import { analyzeGap } from '../../../lib/analyzer/gap'
import { classifyFeatures } from '../../../lib/analyzer/feature-classifier'
import { generateSnippetsBatch } from '../../../lib/generators/snippets'
import { detectMonorepoLayout, parseCodeToFileEntries } from '../../../lib/repo/monorepo-detector'
import { fetchGithubRepo } from '../../../lib/repo/github-fetcher'
import { prisma } from '../../../lib/db'
import type { GapAnalysisResult, AnalyzedRoute, FileEntry } from '../../../lib/types'

type InputMethod = 'github' | 'folder' | 'paste'

interface AnalyzeRequest {
  mode: 'monorepo' | 'separate' | 'backend-only'
  inputMethod?: InputMethod
  // paste / folder
  backendCode?: string
  frontendCode?: string
  repoSource?: string
  // github
  backendGithubUrl?: string
  frontendGithubUrl?: string
  repoGithubUrl?: string
}

function filesToCode(files: FileEntry[]): string {
  return files.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as AnalyzeRequest
    const { mode, inputMethod = 'paste' } = body

    // Validate mode
    if (!mode || !['monorepo', 'separate', 'backend-only'].includes(mode)) {
      return NextResponse.json(
        { error: 'mode is required and must be monorepo, separate, or backend-only', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    // Validate github inputs
    if (inputMethod === 'github') {
      if (mode === 'monorepo' && !body.repoGithubUrl?.trim()) {
        return NextResponse.json(
          { error: 'repoGithubUrl is required for github input method', code: 'INVALID_INPUT' },
          { status: 400 }
        )
      }
      if (mode === 'separate') {
        if (!body.backendGithubUrl?.trim()) {
          return NextResponse.json(
            { error: 'backendGithubUrl is required for github input method', code: 'INVALID_INPUT' },
            { status: 400 }
          )
        }
        if (!body.frontendGithubUrl?.trim()) {
          return NextResponse.json(
            { error: 'frontendGithubUrl is required for github input method', code: 'INVALID_INPUT' },
            { status: 400 }
          )
        }
      }
      if (mode === 'backend-only' && !body.backendGithubUrl?.trim()) {
        return NextResponse.json(
          { error: 'backendGithubUrl is required for github input method', code: 'INVALID_INPUT' },
          { status: 400 }
        )
      }
    }

    // Validate paste/folder inputs
    if (inputMethod !== 'github') {
      if (mode === 'monorepo' && !body.repoSource?.trim()) {
        return NextResponse.json(
          { error: 'repoSource is required for monorepo mode', code: 'INVALID_INPUT' },
          { status: 400 }
        )
      }
      if (mode === 'separate') {
        if (!body.backendCode?.trim()) {
          return NextResponse.json(
            { error: 'backendCode is required for separate mode', code: 'INVALID_INPUT' },
            { status: 400 }
          )
        }
        if (!body.frontendCode?.trim()) {
          return NextResponse.json(
            { error: 'frontendCode is required for separate mode', code: 'INVALID_INPUT' },
            { status: 400 }
          )
        }
      }
      if (mode === 'backend-only' && !body.backendCode?.trim()) {
        return NextResponse.json(
          { error: 'backendCode is required for backend-only mode', code: 'INVALID_INPUT' },
          { status: 400 }
        )
      }
    }

    // Normalize github URLs to code strings
    let backendCode = body.backendCode ?? ''
    let frontendCode = body.frontendCode ?? ''
    let repoSource = body.repoSource ?? ''
    let fetchedBackendFiles: FileEntry[] | undefined
    let fetchedRepoFiles: FileEntry[] | undefined

    if (inputMethod === 'github') {
      try {
        if (mode === 'monorepo' && body.repoGithubUrl) {
          const content = await fetchGithubRepo(body.repoGithubUrl)
          repoSource = filesToCode(content.files)
          fetchedRepoFiles = content.files
        } else if (mode === 'separate') {
          const [beContent, feContent] = await Promise.all([
            fetchGithubRepo(body.backendGithubUrl!),
            fetchGithubRepo(body.frontendGithubUrl!),
          ])
          backendCode = filesToCode(beContent.files)
          frontendCode = filesToCode(feContent.files)
          fetchedBackendFiles = beContent.files
        } else if (mode === 'backend-only') {
          const content = await fetchGithubRepo(body.backendGithubUrl!)
          backendCode = filesToCode(content.files)
          fetchedBackendFiles = content.files
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'GitHub fetch failed'
        if (msg.includes('rate limit')) {
          return NextResponse.json({ error: msg, code: 'GITHUB_RATE_LIMIT' }, { status: 429 })
        }
        if (msg.includes('access denied')) {
          return NextResponse.json({ error: msg, code: 'GITHUB_AUTH_ERROR' }, { status: 429 })
        }
        if (msg.includes('not found') || msg.includes('No source files')) {
          return NextResponse.json({ error: msg, code: 'GITHUB_NOT_FOUND' }, { status: 400 })
        }
        return NextResponse.json({ error: msg, code: 'GITHUB_FETCH_ERROR' }, { status: 502 })
      }
    }

    let beCode = backendCode
    let feCode = frontendCode

    // Monorepo: detect layout and split into BE/FE
    if (mode === 'monorepo') {
      // Use already-fetched FileEntry[] or parse from combined code string
      const sourceFiles: FileEntry[] = fetchedRepoFiles ?? parseCodeToFileEntries(repoSource)

      if (sourceFiles.length > 0) {
        const layout = await detectMonorepoLayout(sourceFiles)

        const matchesPaths = (filePath: string, paths: string[]) =>
          paths.some((p) => {
            const norm = p === '/' ? '' : p.replace(/\/$/, '')
            return norm === '' || filePath.startsWith(norm)
          })

        // If backend/frontend paths are root or overlapping, send all to both parsers
        const hasRoot = (paths: string[]) => paths.some((p) => p === '/' || p === './')
        const useAll = hasRoot(layout.backendPaths) || hasRoot(layout.frontendPaths)
          || (layout.backendPaths.length === 0 && layout.frontendPaths.length === 0)

        const backendFiles = useAll ? sourceFiles : sourceFiles.filter((f) => matchesPaths(f.path, layout.backendPaths))
        const frontendFiles = useAll ? sourceFiles : sourceFiles.filter((f) => matchesPaths(f.path, layout.frontendPaths))

        const effectiveBackend = backendFiles.length > 0 ? backendFiles : sourceFiles
        const effectiveFrontend = frontendFiles.length > 0 ? frontendFiles : sourceFiles

        beCode = effectiveBackend.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')
        feCode = effectiveFrontend.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')

        // Give the parser the filtered file list for framework detection
        fetchedBackendFiles = effectiveBackend
        fetchedRepoFiles = undefined
      } else if (repoSource) {
        // Plain paste without file separators — treat as both BE and FE
        beCode = repoSource
        feCode = repoSource
      }
    }

    // Backend-only: parse routes only, skip gap analysis
    if (mode === 'backend-only') {
      const backendRoutes = await parseBackendRoutes(beCode, { files: fetchedBackendFiles })
      const { features, routesWithFeatureId } = await classifyFeatures(
        backendRoutes.map((r) => ({
          id: randomUUID(),
          method: r.method,
          path: r.path,
          status: 'documented' as const,
          description: undefined,
          fetchSnippet: undefined,
          tsTypes: undefined,
          featureId: undefined,
          detectedIn: 'backend' as const,
        }))
      )
      let snippetMap = new Map<string, { fetchSnippet: string; tsTypes: string; description: string }>()
      let snippetsAvailable = true
      try {
        snippetMap = await generateSnippetsBatch(routesWithFeatureId)
      } catch (err) {
        const isQuota =
          err instanceof Error &&
          (err.message.includes('429') || err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('rate limit'))
        if (isQuota) {
          snippetsAvailable = false
          console.warn('[analyze] Gemini quota reached — returning routes without snippets')
        } else {
          throw err
        }
      }
      const enrichedRoutes: AnalyzedRoute[] = routesWithFeatureId.map((r) => {
        const key = `${r.method.toUpperCase()}:${r.path}`
        const snippet = snippetMap.get(key)
        return {
          ...r,
          fetchSnippet: snippet?.fetchSnippet ?? r.fetchSnippet,
          tsTypes: snippet?.tsTypes ?? r.tsTypes,
          description: snippet?.description ?? r.description,
        }
      })

      const summary = {
        total: enrichedRoutes.length,
        connected: 0,
        orphan: 0,
        ghost: 0,
      }

      const result: GapAnalysisResult = { mode, routes: enrichedRoutes, features, summary }
      if (!snippetsAvailable) {
        Object.assign(result, { warning: 'AI quota reached — routes detected but snippets unavailable. Try again later.' })
      }

      let analysisId: string | null = null
      try {
        const id = randomUUID()
        await prisma.analysis.create({
          data: {
            id,
            mode,
            backendSource: beCode.slice(0, 5000) || null,
            frontendSource: null,
            repoSource: null,
            totalRoutes: enrichedRoutes.length,
            connectedCount: 0,
            orphanCount: 0,
            ghostCount: 0,
          },
        })
        for (const feature of features) {
          await prisma.feature.create({
            data: { id: feature.id, analysisId: id, name: feature.name, description: feature.description ?? null },
          })
        }
        for (const route of enrichedRoutes) {
          await prisma.route.create({
            data: {
              id: route.id,
              analysisId: id,
              method: route.method,
              path: route.path,
              status: route.status,
              description: route.description ?? null,
              fetchSnippet: route.fetchSnippet ?? null,
              tsTypes: route.tsTypes ?? null,
              featureId: route.featureId ?? null,
            },
          })
        }
        analysisId = id
      } catch {
        // DB unavailable — return result without persisting
      }

      return NextResponse.json({ analysisId, ...result }, { status: 200 })
    }

    // Separate / Monorepo: full gap analysis
    const [backendRoutes, frontendCalls] = await Promise.all([
      parseBackendRoutes(beCode, { files: fetchedBackendFiles ?? fetchedRepoFiles }),
      parseFrontendCalls(feCode),
    ])

    const gapResult = analyzeGap(backendRoutes, frontendCalls)
    const { features, routesWithFeatureId } = await classifyFeatures(gapResult.routes)
    let snippetMap2 = new Map<string, { fetchSnippet: string; tsTypes: string; description: string }>()
    let snippetsAvailable2 = true
    try {
      snippetMap2 = await generateSnippetsBatch(routesWithFeatureId)
    } catch (err) {
      const isQuota =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('rate limit'))
      if (isQuota) {
        snippetsAvailable2 = false
        console.warn('[analyze] Gemini quota reached — returning routes without snippets')
      } else {
        throw err
      }
    }
    const enrichedRoutes: AnalyzedRoute[] = routesWithFeatureId.map((r) => {
      const key = `${r.method.toUpperCase()}:${r.path}`
      const snippet = snippetMap2.get(key)
      return {
        ...r,
        fetchSnippet: snippet?.fetchSnippet ?? r.fetchSnippet,
        tsTypes: snippet?.tsTypes ?? r.tsTypes,
        description: snippet?.description ?? r.description,
      }
    })

    const summary = {
      total: enrichedRoutes.length,
      connected: enrichedRoutes.filter((r) => r.status === 'connected').length,
      orphan: enrichedRoutes.filter((r) => r.status === 'orphan').length,
      ghost: enrichedRoutes.filter((r) => r.status === 'ghost').length,
    }

    const result: GapAnalysisResult = { mode, routes: enrichedRoutes, features, summary }
    if (!snippetsAvailable2) {
      Object.assign(result, { warning: 'AI quota reached — routes detected but snippets unavailable. Try again later.' })
    }

    let analysisId: string | null = null
    try {
      const id = randomUUID()
      await prisma.analysis.create({
        data: {
          id,
          mode,
          backendSource: (backendCode ?? beCode).slice(0, 5000) || null,
          frontendSource: (frontendCode ?? feCode).slice(0, 5000) || null,
          repoSource: repoSource ? repoSource.slice(0, 5000) : null,
          totalRoutes: enrichedRoutes.length,
          connectedCount: summary.connected,
          orphanCount: summary.orphan,
          ghostCount: summary.ghost,
        },
      })
      for (const feature of features) {
        await prisma.feature.create({
          data: { id: feature.id, analysisId: id, name: feature.name, description: feature.description ?? null },
        })
      }
      for (const route of enrichedRoutes) {
        await prisma.route.create({
          data: {
            id: route.id,
            analysisId: id,
            method: route.method,
            path: route.path,
            status: route.status,
            description: route.description ?? null,
            fetchSnippet: route.fetchSnippet ?? null,
            tsTypes: route.tsTypes ?? null,
            featureId: route.featureId ?? null,
          },
        })
      }
      analysisId = id
    } catch {
      // DB unavailable — return result without persisting
    }

    return NextResponse.json({ analysisId, ...result }, { status: 200 })
  } catch (err) {
    console.error('[/api/analyze]', err)
    return NextResponse.json(
      { error: 'analysis failed', code: 'PIPELINE_ERROR' },
      { status: 500 }
    )
  }
}
