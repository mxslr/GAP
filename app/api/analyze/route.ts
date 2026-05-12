import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { parseBackendRoutes } from '../../../lib/parsers/backend'
import { parseFrontendCalls } from '../../../lib/parsers/frontend'
import { analyzeGap } from '../../../lib/analyzer/gap'
import { classifyFeatures } from '../../../lib/analyzer/feature-classifier'
import { generateSnippetsBatch } from '../../../lib/generators/snippets'
import { detectMonorepoLayout, parseTextTree } from '../../../lib/repo/monorepo-detector'
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

    if (inputMethod === 'github') {
      try {
        if (mode === 'monorepo' && body.repoGithubUrl) {
          const content = await fetchGithubRepo(body.repoGithubUrl)
          repoSource = filesToCode(content.files)
        } else if (mode === 'separate') {
          const [beContent, feContent] = await Promise.all([
            fetchGithubRepo(body.backendGithubUrl!),
            fetchGithubRepo(body.frontendGithubUrl!),
          ])
          backendCode = filesToCode(beContent.files)
          frontendCode = filesToCode(feContent.files)
        } else if (mode === 'backend-only') {
          const content = await fetchGithubRepo(body.backendGithubUrl!)
          backendCode = filesToCode(content.files)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'GitHub fetch failed'
        if (msg.includes('rate limit')) {
          return NextResponse.json({ error: msg, code: 'GITHUB_RATE_LIMIT' }, { status: 429 })
        }
        if (msg.includes('Private repo')) {
          return NextResponse.json({ error: msg, code: 'GITHUB_PRIVATE_REPO' }, { status: 400 })
        }
        return NextResponse.json({ error: msg, code: 'GITHUB_FETCH_ERROR' }, { status: 502 })
      }
    }

    let beCode = backendCode
    let feCode = frontendCode

    // Monorepo: detect layout and split content into BE/FE sections
    if (mode === 'monorepo' && repoSource) {
      const layout = await detectMonorepoLayout(repoSource)
      const entries = parseTextTree(repoSource)

      const beEntries = entries.filter((e) =>
        layout.backendPaths.some((bp) => {
          const normalizedPath = bp === '/' ? '' : bp.replace(/\/$/, '')
          return normalizedPath === '' || e.path.startsWith(normalizedPath)
        })
      )
      const feEntries = entries.filter((e) =>
        layout.frontendPaths.some((fp) => {
          const normalizedPath = fp === '/' ? '' : fp.replace(/\/$/, '')
          return normalizedPath === '' || e.path.startsWith(normalizedPath)
        })
      )

      beCode = beEntries.map((e) => e.content ?? '').join('\n')
      feCode = feEntries.map((e) => e.content ?? '').join('\n')

      if (!beCode.trim() && !feCode.trim()) {
        beCode = repoSource
        feCode = repoSource
      }
    }

    // Backend-only: parse routes only, skip gap analysis
    if (mode === 'backend-only') {
      const backendRoutes = await parseBackendRoutes(beCode)
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
      const snippetMap = await generateSnippetsBatch(routesWithFeatureId)
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
      parseBackendRoutes(beCode),
      parseFrontendCalls(feCode),
    ])

    const gapResult = analyzeGap(backendRoutes, frontendCalls)
    const { features, routesWithFeatureId } = await classifyFeatures(gapResult.routes)
    const snippetMap = await generateSnippetsBatch(routesWithFeatureId)
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
      connected: enrichedRoutes.filter((r) => r.status === 'connected').length,
      orphan: enrichedRoutes.filter((r) => r.status === 'orphan').length,
      ghost: enrichedRoutes.filter((r) => r.status === 'ghost').length,
    }

    const result: GapAnalysisResult = { mode, routes: enrichedRoutes, features, summary }

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
