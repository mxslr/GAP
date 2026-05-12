import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { parseBackendRoutes } from '../../../lib/parsers/backend'
import { classifyFeatures } from '../../../lib/analyzer/feature-classifier'
import { generateApiDocs } from '../../../lib/generators/api-docs'
import { prisma } from '../../../lib/db'
import type { AnalyzedRoute } from '../../../lib/types'

// Task 2.1 — POST /api/docs
// Task 2.2 — input validation
// Task 2.3 — pipeline wiring
// Task 2.4 — DB persistence
// Task 2.5 — response + error handling

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body?.backendCode || typeof body.backendCode !== 'string' || body.backendCode.trim() === '') {
      return NextResponse.json({ error: 'backendCode is required' }, { status: 400 })
    }

    const backendCode: string = body.backendCode

    // Parse raw backend code into BackendRoute[]
    const backendRoutes = await parseBackendRoutes(backendCode)

    // Map BackendRoute[] → AnalyzedRoute[] with status 'documented'
    const analyzedRoutes: AnalyzedRoute[] = backendRoutes.map((r) => ({
      id: randomUUID(),
      method: r.method,
      path: r.path,
      status: 'documented' as const,
      detectedIn: 'backend' as const,
    }))

    // Classify routes into feature groups
    const { features, routesWithFeatureId } = await classifyFeatures(analyzedRoutes)

    // Generate documentation
    const { markdown, openapi } = await generateApiDocs(routesWithFeatureId, features)

    // Persist Analysis + Routes + Features + ApiDoc
    const analysis = await prisma.analysis.create({
      data: {
        id: randomUUID(),
        mode: 'backend-only',
        backendSource: backendCode.slice(0, 2000),
        totalRoutes: routesWithFeatureId.length,
        connectedCount: 0,
        orphanCount: 0,
        ghostCount: 0,
      },
    })

    // Persist features first (routes reference featureId)
    const featureIdMap = new Map<string, string>()
    for (const feature of features) {
      const created = await prisma.feature.create({
        data: {
          id: feature.id,
          analysisId: analysis.id,
          name: feature.name,
          description: feature.description ?? null,
        },
      })
      featureIdMap.set(feature.id, created.id)
    }

    // Persist routes
    for (const route of routesWithFeatureId) {
      await prisma.route.create({
        data: {
          id: route.id,
          analysisId: analysis.id,
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

    // Persist ApiDoc
    await prisma.apiDoc.create({
      data: {
        id: randomUUID(),
        analysisId: analysis.id,
        markdownDoc: markdown,
        openapiJson: JSON.stringify(openapi),
      },
    })

    return NextResponse.json({
      analysisId: analysis.id,
      markdown,
      openapi,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
