import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { parseBackendRoutes } from '../../../lib/parsers/backend'
import { classifyFeatures } from '../../../lib/analyzer/feature-classifier'
import { generateApiDocs } from '../../../lib/generators/api-docs'
import { fetchGithubRepo } from '../../../lib/repo/github-fetcher'
import { prisma } from '../../../lib/db'
import type { AnalyzedRoute, FileEntry } from '../../../lib/types'

export const maxDuration = 90

function filesToCode(files: FileEntry[]): string {
  return files.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const inputMethod: string = body?.inputMethod ?? 'paste'

    let backendCode: string

    if (inputMethod === 'github') {
      if (!body?.backendGithubUrl || typeof body.backendGithubUrl !== 'string') {
        return NextResponse.json({ error: 'backendGithubUrl is required for github input method' }, { status: 400 })
      }
      try {
        const content = await fetchGithubRepo(body.backendGithubUrl as string)
        backendCode = filesToCode(content.files)
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
    } else {
      if (!body?.backendCode || typeof body.backendCode !== 'string' || body.backendCode.trim() === '') {
        return NextResponse.json({ error: 'backendCode is required' }, { status: 400 })
      }
      backendCode = body.backendCode as string
    }

    const backendRoutes = await parseBackendRoutes(backendCode)

    const analyzedRoutes: AnalyzedRoute[] = backendRoutes.map((r) => ({
      id: randomUUID(),
      method: r.method,
      path: r.path,
      status: 'documented' as const,
      detectedIn: 'backend' as const,
    }))

    const { features, routesWithFeatureId } = await classifyFeatures(analyzedRoutes)
    const { markdown, openapi } = await generateApiDocs(routesWithFeatureId, features)

    // Attempt DB persist — graceful degradation if DB is unavailable
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
          data: {
            id: feature.id,
            analysisId: id,
            name: feature.name,
            description: feature.description ?? null,
          },
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
      // DB unavailable — return result without persisting
    }

    return NextResponse.json({ analysisId, markdown, openapi })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
