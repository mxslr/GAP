import { randomUUID } from 'crypto'
import { parseBackendRoutes } from '../../../../lib/parsers/backend'
import { classifyFeatures } from '../../../../lib/analyzer/feature-classifier'
import { generateApiDocs } from '../../../../lib/generators/api-docs'
import { fetchGithubRepo } from '../../../../lib/repo/github-fetcher'
import { prisma } from '../../../../lib/db'
import type { AnalyzedRoute, FileEntry } from '../../../../lib/types'

export const maxDuration = 120

function filesToCode(files: FileEntry[]): string {
  return files.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: 'Invalid request body' })}\n\n`,
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  const inputMethod: string = (body?.inputMethod as string) ?? 'paste'
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
        let backendCode: string
        let fetchedFiles: FileEntry[] | undefined

        if (inputMethod === 'github') {
          if (!body?.backendGithubUrl) {
            send('error', { message: 'backendGithubUrl is required' })
            controller.close()
            return
          }
          send('status', { message: 'fetching repository...' })
          try {
            const content = await fetchGithubRepo(body.backendGithubUrl as string)
            backendCode = filesToCode(content.files)
            fetchedFiles = content.files
          } catch (err) {
            send('error', { message: err instanceof Error ? err.message : 'GitHub fetch failed' })
            controller.close()
            return
          }
        } else {
          if (!(body.backendCode as string | undefined)?.trim()) {
            send('error', { message: 'backendCode is required' })
            controller.close()
            return
          }
          backendCode = body.backendCode as string
        }

        // ── Parse routes ─────────────────────────────────────────────────
        send('status', { message: 'parsing routes...' })
        const backendRoutes = await parseBackendRoutes(backendCode, { files: fetchedFiles })

        if (backendRoutes.length === 0) {
          send('error', { message: 'No routes detected. Try pasting code that contains route definitions (e.g. Route::get, app.get, @app.get).' })
          controller.close()
          return
        }

        const analyzedRoutes: AnalyzedRoute[] = backendRoutes.map((r) => ({
          id: randomUUID(),
          method: r.method,
          path: r.path,
          status: 'documented' as const,
          detectedIn: 'backend' as const,
        }))

        // ── Emit route count immediately ──────────────────────────────────
        send('routes', { routes: analyzedRoutes, total: analyzedRoutes.length })

        // ── Classify features ─────────────────────────────────────────────
        send('status', { message: 'classifying features...' })
        const { features, routesWithFeatureId } = await Promise.race([
          classifyFeatures(analyzedRoutes),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Feature classification timed out after 60s')), 60000)
          ),
        ])

        // ── Generate full docs ────────────────────────────────────────────
        send('status', { message: 'generating documentation...' })
        const { markdown, openapi } = await Promise.race([
          generateApiDocs(routesWithFeatureId, features),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Documentation generation timed out after 90s')), 90000)
          ),
        ])

        // ── Persist to DB ─────────────────────────────────────────────────
        let analysisId: string | null = null
        try {
          const id = randomUUID()
          await prisma.analysis.create({
            data: {
              id,
              mode: 'backend-only',
              backendSource: backendCode.slice(0, 2000),
              totalRoutes: routesWithFeatureId.length,
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
          for (const route of routesWithFeatureId) {
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
          await prisma.apiDoc.create({
            data: {
              id: randomUUID(),
              analysisId: id,
              markdownDoc: markdown,
              openapiJson: JSON.stringify(openapi),
            },
          })
          analysisId = id
        } catch {
          // DB unavailable
        }

        send('docs', { markdown, openapi, analysisId })
        send('done', { analysisId })

      } catch (error) {
        send('error', { message: error instanceof Error ? error.message : 'Generation failed' })
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
