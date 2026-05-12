import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { parseBackendRoutes } from '../../../lib/parsers/backend'
import { parseFrontendCalls } from '../../../lib/parsers/frontend'
import { analyzeGap } from '../../../lib/analyzer/gap'
import { classifyFeatures } from '../../../lib/analyzer/feature-classifier'
import { generateSnippetsBatch } from '../../../lib/generators/snippets'
import { detectMonorepoLayout, parseTextTree } from '../../../lib/repo/monorepo-detector'
import { prisma } from '../../../lib/db'
import type { GapAnalysisResult, AnalyzedRoute } from '../../../lib/types'

interface AnalyzeRequest {
  mode: 'monorepo' | 'separate'
  backendCode?: string
  frontendCode?: string
  repoSource?: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as AnalyzeRequest
    const { mode, backendCode, frontendCode, repoSource } = body

    // Validate mode
    if (!mode || (mode !== 'monorepo' && mode !== 'separate')) {
      return NextResponse.json(
        { error: 'mode is required and must be monorepo or separate', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    // Validate mode-specific fields
    if (mode === 'monorepo' && !repoSource?.trim()) {
      return NextResponse.json(
        { error: 'repoSource is required for monorepo mode', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    if (mode === 'separate') {
      if (!backendCode?.trim()) {
        return NextResponse.json(
          { error: 'backendCode is required for separate mode', code: 'INVALID_INPUT' },
          { status: 400 }
        )
      }
      if (!frontendCode?.trim()) {
        return NextResponse.json(
          { error: 'frontendCode is required for separate mode', code: 'INVALID_INPUT' },
          { status: 400 }
        )
      }
    }

    let beCode = backendCode ?? ''
    let feCode = frontendCode ?? ''

    // Monorepo: detect layout and split content into BE/FE sections
    if (mode === 'monorepo' && repoSource) {
      const layout = await detectMonorepoLayout(repoSource)
      const entries = parseTextTree(repoSource)

      // Collect content from entries matching backend paths
      const beEntries = entries.filter((e) =>
        layout.backendPaths.some((bp) => {
          const normalizedPath = bp === '/' ? '' : bp.replace(/\/$/, '')
          return normalizedPath === '' || e.path.startsWith(normalizedPath)
        })
      )
      // Collect content from entries matching frontend paths
      const feEntries = entries.filter((e) =>
        layout.frontendPaths.some((fp) => {
          const normalizedPath = fp === '/' ? '' : fp.replace(/\/$/, '')
          return normalizedPath === '' || e.path.startsWith(normalizedPath)
        })
      )

      beCode = beEntries.map((e) => e.content ?? '').join('\n')
      feCode = feEntries.map((e) => e.content ?? '').join('\n')

      // Fallback: if split yields nothing, parse the whole source
      if (!beCode.trim() && !feCode.trim()) {
        beCode = repoSource
        feCode = repoSource
      }
    }

    // Parse routes and calls
    const [backendRoutes, frontendCalls] = await Promise.all([
      parseBackendRoutes(beCode),
      parseFrontendCalls(feCode),
    ])

    // Gap analysis
    const gapResult = analyzeGap(backendRoutes, frontendCalls)

    // Feature classification
    const { features, routesWithFeatureId } = await classifyFeatures(gapResult.routes)

    // Snippet generation — enrich routes
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

    const result: GapAnalysisResult = {
      mode,
      routes: enrichedRoutes,
      features,
      summary,
    }

    // Persist to DB — graceful degradation on failure
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
          data: {
            id: feature.id,
            analysisId: id,
            name: feature.name,
            description: feature.description ?? null,
          },
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
