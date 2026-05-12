'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MetricCard } from '../../../components/MetricCard'
import { FilterBar } from '../../../components/FilterBar'
import { RouteCard } from '../../../components/RouteCard'
import { FeatureGroup } from '../../../components/FeatureGroup'
import { ViewToggle } from '../../../components/ViewToggle'
import { Spinner } from '../../../components/Spinner'
import type { AnalyzedRoute, FeatureGroup as FeatureGroupType } from '../../../lib/types'
import type { FilterState } from '../../../components/FilterBar'

interface AnalysisDetail {
  id: string
  mode: string
  totalRoutes: number
  connectedCount: number
  orphanCount: number
  ghostCount: number
  routes: AnalyzedRoute[]
  features: FeatureGroupType[]
  createdAt: string
}

type ViewMode = 'flat' | 'feature'
const INITIAL_FILTERS: FilterState = { status: 'all', method: 'all' }

export default function AnalysisDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  useEffect(() => {
    if (!id) return
    fetch(`/api/analyses/${id}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return }
        const data = await res.json()
        // Redirect if this is a backend-only analysis
        if (data.mode === 'backend-only') {
          router.replace(`/docs-generator/${id}`)
          return
        }
        // Map DB route shape to AnalyzedRoute (featureId comes from DB, detectedIn may be missing)
        const routes: AnalyzedRoute[] = (data.routes ?? []).map((r: AnalyzedRoute & { featureId?: string }) => ({
          id: r.id,
          method: r.method,
          path: r.path,
          status: r.status,
          description: r.description,
          fetchSnippet: r.fetchSnippet,
          tsTypes: r.tsTypes,
          featureId: r.featureId,
          detectedIn: r.detectedIn ?? 'backend',
        }))
        // Map DB feature shape to FeatureGroup
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const features: FeatureGroupType[] = ((data.features ?? []) as any[]).map((f) => ({
          id: f.id as string,
          name: f.name as string,
          description: (f.description as string | undefined) ?? undefined,
          routeIds: routes.filter((r) => r.featureId === (f.id as string)).map((r) => r.id) as string[],
        } as FeatureGroupType))
        setAnalysis({ ...data, routes, features })
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-primary pt-24 flex items-center justify-center">
        <Spinner size={32} />
      </main>
    )
  }

  if (notFound || !analysis) {
    return (
      <main className="min-h-screen bg-bg-primary pt-24 px-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <p className="font-mono text-sm text-fg-tertiary lowercase" style={{ letterSpacing: '0.08em' }}>
            analysis not found.
          </p>
          <Link
            href="/analyze"
            className="font-mono text-xs border border-border-default text-fg-secondary px-4 py-2 self-start hover:border-border-hover hover:text-fg-primary transition-all duration-200"
            style={{ borderRadius: 0, letterSpacing: '0.08em' }}
          >
            ← new analysis
          </Link>
        </div>
      </main>
    )
  }

  const modeLabel = analysis.mode === 'monorepo' ? 'MONOREPO MODE' : 'SEPARATE MODE'

  const filteredRoutes = analysis.routes.filter((r) => {
    const statusMatch = filters.status === 'all' || r.status === filters.status
    const methodMatch = filters.method === 'all' || r.method === filters.method
    return statusMatch && methodMatch
  })

  return (
    <main className="min-h-screen bg-bg-primary pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        {/* Top bar */}
        <div
          className="flex items-center justify-between animate-fade-in"
          style={{ animationDelay: '0ms', animationFillMode: 'both' }}
        >
          <div>
            <h1
              className="font-display text-3xl font-bold text-fg-primary uppercase"
              style={{ letterSpacing: '-0.02em' }}
            >
              Analysis
            </h1>
            <p className="font-mono text-xs text-fg-tertiary mt-1" style={{ letterSpacing: '0.06em' }}>
              {new Date(analysis.createdAt).toLocaleString()}
            </p>
          </div>
          <Link
            href="/analyze"
            className="font-mono text-xs border border-border-default text-fg-secondary px-4 py-2 hover:border-border-hover hover:text-fg-primary transition-all duration-200"
            style={{ borderRadius: 0, letterSpacing: '0.08em' }}
          >
            + new analysis
          </Link>
        </div>

        {/* Mode badge + view toggle */}
        <div
          className="flex items-center justify-between animate-fade-in"
          style={{ animationDelay: '60ms', animationFillMode: 'both' }}
        >
          <span
            className="font-mono text-xs border border-border-default text-fg-secondary px-3 py-1 uppercase"
            style={{ borderRadius: 0, letterSpacing: '0.12em' }}
          >
            {modeLabel}
          </span>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {/* Metric cards */}
        <div
          className="grid grid-cols-3 gap-px bg-border-default animate-fade-in"
          style={{ animationDelay: '100ms', animationFillMode: 'both' }}
        >
          <MetricCard label="connected" value={analysis.connectedCount} accentColor="#4ADE80" />
          <MetricCard label="orphan" value={analysis.orphanCount} accentColor="#F87171" />
          <MetricCard label="ghost" value={analysis.totalRoutes - analysis.connectedCount - analysis.orphanCount} accentColor="#FBBF24" />
        </div>

        {/* Filter bar — flat view only */}
        {viewMode === 'flat' && (
          <div className="animate-fade-in" style={{ animationDelay: '140ms', animationFillMode: 'both' }}>
            <FilterBar filters={filters} onChange={setFilters} />
          </div>
        )}

        {/* Count line */}
        <p className="font-mono text-xs text-fg-tertiary lowercase" style={{ letterSpacing: '0.08em' }}>
          {viewMode === 'flat'
            ? `showing ${filteredRoutes.length} of ${analysis.routes.length} routes`
            : `${analysis.features.length} feature groups · ${analysis.routes.length} routes total`}
        </p>

        {/* Route list */}
        {analysis.routes.length === 0 ? (
          <div className="border border-border-default p-10 text-center">
            <p className="font-mono text-sm text-fg-tertiary lowercase" style={{ letterSpacing: '0.08em' }}>
              no routes in this analysis
            </p>
          </div>
        ) : viewMode === 'flat' ? (
          <div className="flex flex-col gap-px bg-border-default">
            {filteredRoutes.length === 0 ? (
              <div className="bg-bg-primary border border-border-default p-6 text-center">
                <p className="font-mono text-sm text-fg-tertiary lowercase" style={{ letterSpacing: '0.08em' }}>
                  no routes match the current filters
                </p>
              </div>
            ) : (
              filteredRoutes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {analysis.features.map((feature) => (
              <FeatureGroup
                key={feature.id}
                feature={feature}
                routes={analysis.routes}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
