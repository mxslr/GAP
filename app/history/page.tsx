import Link from 'next/link'
import { prisma } from '../../lib/db'
import { HistoryCard } from '../../components/HistoryCard'

type FilterValue = 'all' | 'gap' | 'docs'

interface PageProps {
  searchParams: { filter?: string }
}

const FILTER_TABS: { label: string; value: FilterValue }[] = [
  { label: 'all', value: 'all' },
  { label: 'gap analysis', value: 'gap' },
  { label: 'api docs', value: 'docs' },
]

async function getAnalyses(filter: FilterValue) {
  const modeFilter =
    filter === 'gap'
      ? { mode: { in: ['monorepo', 'separate'] } }
      : filter === 'docs'
      ? { mode: 'backend-only' }
      : {}

  return prisma.analysis.findMany({
    where: modeFilter,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      mode: true,
      totalRoutes: true,
      connectedCount: true,
      orphanCount: true,
      ghostCount: true,
      createdAt: true,
    },
  })
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const rawFilter = searchParams.filter
  const filter: FilterValue =
    rawFilter === 'gap' || rawFilter === 'docs' ? rawFilter : 'all'

  let analyses: Awaited<ReturnType<typeof getAnalyses>> = []
  let dbError = false
  try {
    analyses = await getAnalyses(filter)
  } catch {
    dbError = true
  }

  return (
    <main className="min-h-screen bg-bg-primary pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="animate-fade-in" style={{ animationDelay: '0ms', animationFillMode: 'both' }}>
          <h1
            className="font-display text-3xl font-bold text-fg-primary uppercase"
            style={{ letterSpacing: '-0.02em' }}
          >
            History
          </h1>
          <p
            className="font-mono text-sm text-fg-secondary mt-1"
            style={{ letterSpacing: '0.08em' }}
          >
            past analyses and generated documentation.
          </p>
        </div>

        {/* Filter tabs */}
        <div
          className="flex gap-px bg-border-default animate-fade-in"
          style={{ animationDelay: '60ms', animationFillMode: 'both' }}
        >
          {FILTER_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value === 'all' ? '/history' : `/history?filter=${tab.value}`}
              className="font-mono text-xs px-4 py-2 transition-colors duration-200"
              style={{
                borderRadius: 0,
                letterSpacing: '0.08em',
                background: filter === tab.value ? '#FFFFFF' : '#0A0A0A',
                color: filter === tab.value ? '#000000' : '#A0A0A0',
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Content */}
        <div
          className="flex flex-col gap-px animate-fade-in"
          style={{ animationDelay: '120ms', animationFillMode: 'both' }}
        >
          {dbError ? (
            <div className="border border-border-default p-8 text-center">
              <p
                className="font-mono text-sm text-fg-tertiary lowercase"
                style={{ letterSpacing: '0.08em' }}
              >
                database unavailable — history cannot be loaded
              </p>
            </div>
          ) : analyses.length === 0 ? (
            <div className="border border-border-default p-12 text-center flex flex-col gap-4">
              <p
                className="font-mono text-sm text-fg-tertiary lowercase"
                style={{ letterSpacing: '0.08em' }}
              >
                no history yet.
              </p>
              <div className="flex justify-center gap-4">
                <Link
                  href="/analyze"
                  className="font-mono text-xs border border-border-default text-fg-secondary px-4 py-2 hover:border-border-hover hover:text-fg-primary transition-all duration-200"
                  style={{ borderRadius: 0, letterSpacing: '0.08em' }}
                >
                  analyze a codebase →
                </Link>
                <Link
                  href="/docs-generator"
                  className="font-mono text-xs border border-border-default text-fg-secondary px-4 py-2 hover:border-border-hover hover:text-fg-primary transition-all duration-200"
                  style={{ borderRadius: 0, letterSpacing: '0.08em' }}
                >
                  generate api docs →
                </Link>
              </div>
            </div>
          ) : (
            analyses.map((a) => (
              <HistoryCard
                key={a.id}
                id={a.id}
                mode={a.mode}
                totalRoutes={a.totalRoutes}
                connectedCount={a.connectedCount}
                orphanCount={a.orphanCount}
                ghostCount={a.ghostCount}
                createdAt={a.createdAt.toISOString()}
              />
            ))
          )}
        </div>

        {analyses.length > 0 && (
          <p
            className="font-mono text-xs text-fg-tertiary lowercase animate-fade-in"
            style={{ animationDelay: '180ms', animationFillMode: 'both', letterSpacing: '0.05em' }}
          >
            showing {analyses.length}{' '}
            {filter === 'all' ? 'analyses' : filter === 'gap' ? 'gap analyses' : 'doc generations'}
          </p>
        )}
      </div>
    </main>
  )
}
