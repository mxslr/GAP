import { randomUUID } from 'crypto'
import { parseBackendRoutes } from '../../../../lib/parsers/backend'
import { parseFrontendCalls } from '../../../../lib/parsers/frontend'
import { analyzeGap } from '../../../../lib/analyzer/gap'
import { classifyFeatures } from '../../../../lib/analyzer/feature-classifier'
import { generateSnippetsBatch } from '../../../../lib/generators/snippets'
import { detectMonorepoLayout, parseCodeToFileEntries } from '../../../../lib/repo/monorepo-detector'
import { fetchGithubRepo } from '../../../../lib/repo/github-fetcher'
import { prisma } from '../../../../lib/db'
import type { AnalyzedRoute, FileEntry } from '../../../../lib/types'

export const maxDuration = 120

type InputMethod = 'github' | 'folder' | 'paste'

interface AnalyzeRequest {
  mode: 'monorepo' | 'separate' | 'backend-only'
  inputMethod?: InputMethod
  backendCode?: string
  frontendCode?: string
  repoSource?: string
  backendGithubUrl?: string
  frontendGithubUrl?: string
  repoGithubUrl?: string
}

function filesToCode(files: FileEntry[]): string {
  return files.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')
}

export async function POST(request: Request) {
  const body = await request.json() as AnalyzeRequest
  const { mode, inputMethod = 'paste' } = body
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // controller already closed
        }
      }

      try {
        if (!mode || !['monorepo', 'separate', 'backend-only'].includes(mode)) {
          send('error', { message: 'invalid mode' })
          controller.close()
          return
        }

        // ── Repo fetching ────────────────────────────────────────────────
        let backendCode = body.backendCode ?? ''
        let frontendCode = body.frontendCode ?? ''
        let repoSource = body.repoSource ?? ''
        let fetchedBackendFiles: FileEntry[] | undefined
        let fetchedRepoFiles: FileEntry[] | undefined

        if (inputMethod === 'github') {
          send('status', { message: 'fetching repository...' })
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
            } else {
              const content = await fetchGithubRepo(body.backendGithubUrl!)
              backendCode = filesToCode(content.files)
              fetchedBackendFiles = content.files
            }
          } catch (err) {
            send('error', { message: err instanceof Error ? err.message : 'GitHub fetch failed' })
            controller.close()
            return
          }
        }

        let beCode = backendCode
        let feCode = frontendCode

        // ── Monorepo layout detection ────────────────────────────────────
        if (mode === 'monorepo') {
          send('status', { message: 'detecting layout...' })

          const sourceFiles: FileEntry[] = fetchedRepoFiles ?? parseCodeToFileEntries(repoSource)

          if (sourceFiles.length > 0) {
            const layout = await detectMonorepoLayout(sourceFiles)

            const matchesPaths = (filePath: string, paths: string[]) =>
              paths.some((p) => {
                const norm = p === '/' ? '' : p.replace(/\/$/, '')
                return norm === '' || filePath.startsWith(norm)
              })

            const hasRoot = (paths: string[]) => paths.some((p) => p === '/' || p === './')
            const useAll = hasRoot(layout.backendPaths) || hasRoot(layout.frontendPaths)
              || (layout.backendPaths.length === 0 && layout.frontendPaths.length === 0)

            const backendFiles = useAll ? sourceFiles : sourceFiles.filter((f) => matchesPaths(f.path, layout.backendPaths))
            const frontendFiles = useAll ? sourceFiles : sourceFiles.filter((f) => matchesPaths(f.path, layout.frontendPaths))

            const effectiveBackend = backendFiles.length > 0 ? backendFiles : sourceFiles
            const effectiveFrontend = frontendFiles.length > 0 ? frontendFiles : sourceFiles

            beCode = effectiveBackend.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')
            feCode = effectiveFrontend.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')

            fetchedBackendFiles = effectiveBackend
            fetchedRepoFiles = undefined
          } else if (repoSource) {
            beCode = repoSource
            feCode = repoSource
          }
        }

        // ── Parse routes ─────────────────────────────────────────────────
        send('status', { message: 'parsing routes...' })
        let initialRoutes: AnalyzedRoute[]
        let summary: { total: number; connected: number; orphan: number; ghost: number }

        if (mode === 'backend-only') {
          const backendRoutes = await parseBackendRoutes(beCode, { files: fetchedBackendFiles })
          initialRoutes = backendRoutes.map((r) => ({
            id: randomUUID(),
            method: r.method,
            path: r.path,
            status: 'documented' as const,
            detectedIn: 'backend' as const,
          }))
          summary = { total: initialRoutes.length, connected: 0, orphan: 0, ghost: 0 }
        } else {
          send('status', { message: 'parsing frontend calls...' })
          const [backendRoutes, frontendCalls] = await Promise.all([
            parseBackendRoutes(beCode, { files: fetchedBackendFiles ?? fetchedRepoFiles }),
            parseFrontendCalls(feCode),
          ])
          send('status', { message: 'analyzing gaps...' })
          const gapResult = analyzeGap(backendRoutes, frontendCalls)
          initialRoutes = gapResult.routes
          summary = {
            total: initialRoutes.length,
            connected: initialRoutes.filter((r) => r.status === 'connected').length,
            orphan: initialRoutes.filter((r) => r.status === 'orphan').length,
            ghost: initialRoutes.filter((r) => r.status === 'ghost').length,
          }
        }

        // ── Emit routes immediately — no snippet wait ────────────────────
        send('routes', { routes: initialRoutes, summary })

        // ── Generate snippets in batches of 5, emit per-route ────────────
        send('status', { message: 'generating snippets...' })
        const CHUNK = 5
        const allSnippets = new Map<string, { fetchSnippet: string; tsTypes: string; description: string }>()

        for (let i = 0; i < initialRoutes.length; i += CHUNK) {
          const chunk = initialRoutes.slice(i, i + CHUNK)
          const snippetMap = await generateSnippetsBatch(chunk)
          for (const route of chunk) {
            const key = `${route.method.toUpperCase()}:${route.path}`
            const snippet = snippetMap.get(key)
            if (snippet) {
              allSnippets.set(route.id, snippet)
              send('snippet', {
                routeId: route.id,
                fetchSnippet: snippet.fetchSnippet,
                tsTypes: snippet.tsTypes,
                description: snippet.description,
              })
            }
          }
        }

        // ── Classify features ────────────────────────────────────────────
        send('status', { message: 'classifying features...' })
        const routesWithSnippets: AnalyzedRoute[] = initialRoutes.map((r) => {
          const s = allSnippets.get(r.id)
          return s ? { ...r, fetchSnippet: s.fetchSnippet, tsTypes: s.tsTypes, description: s.description } : r
        })
        const { features, routesWithFeatureId } = await classifyFeatures(routesWithSnippets)
        send('features', { features, routesWithFeatureId })

        // ── Persist to DB ────────────────────────────────────────────────
        let analysisId: string | null = null
        try {
          const id = randomUUID()
          await prisma.analysis.create({
            data: {
              id,
              mode,
              backendSource: beCode.slice(0, 5000) || null,
              frontendSource: mode !== 'backend-only' ? feCode.slice(0, 5000) || null : null,
              repoSource: repoSource ? repoSource.slice(0, 5000) : null,
              totalRoutes: routesWithFeatureId.length,
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
          for (const route of routesWithFeatureId) {
            const s = allSnippets.get(route.id)
            await prisma.route.create({
              data: {
                id: route.id,
                analysisId: id,
                method: route.method,
                path: route.path,
                status: route.status,
                description: s?.description ?? route.description ?? null,
                fetchSnippet: s?.fetchSnippet ?? route.fetchSnippet ?? null,
                tsTypes: s?.tsTypes ?? route.tsTypes ?? null,
                featureId: route.featureId ?? null,
              },
            })
          }
          analysisId = id
        } catch {
          // DB unavailable — return result without persisting
        }

        send('done', { analysisId })

      } catch (error) {
        send('error', { message: error instanceof Error ? error.message : 'Analysis failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
