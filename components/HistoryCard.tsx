'use client'

import Link from 'next/link'

interface HistoryCardProps {
  id: string
  mode: string
  totalRoutes: number
  connectedCount: number
  orphanCount: number
  ghostCount: number
  createdAt: string
}

function relativeTime(isoDate: string): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diffMs = new Date(isoDate).getTime() - Date.now()
  const diffSecs = Math.round(diffMs / 1000)
  const diffMins = Math.round(diffSecs / 60)
  const diffHours = Math.round(diffMins / 60)
  const diffDays = Math.round(diffHours / 24)

  if (Math.abs(diffSecs) < 60) return rtf.format(diffSecs, 'second')
  if (Math.abs(diffMins) < 60) return rtf.format(diffMins, 'minute')
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  return rtf.format(diffDays, 'day')
}

function modeLabel(mode: string): string {
  if (mode === 'monorepo') return 'monorepo'
  if (mode === 'separate') return 'separate'
  return 'api docs'
}

function isGapMode(mode: string): boolean {
  return mode === 'monorepo' || mode === 'separate'
}

export function HistoryCard({
  id,
  mode,
  totalRoutes,
  connectedCount,
  orphanCount,
  ghostCount,
  createdAt,
}: HistoryCardProps) {
  const href = isGapMode(mode) ? `/analyze/${id}` : `/docs-generator/${id}`
  const gap = isGapMode(mode)

  return (
    <Link
      href={href}
      className="block bg-bg-secondary border border-border-default hover:border-border-hover transition-all duration-200 group"
      style={{ borderRadius: 0 }}
    >
      <div className="px-5 py-4 flex items-center justify-between gap-6">
        {/* Left: timestamp + mode */}
        <div className="flex items-center gap-4 min-w-0">
          <span
            className="font-mono text-xs text-fg-secondary whitespace-nowrap"
            style={{ letterSpacing: '0.05em' }}
          >
            {relativeTime(createdAt)}
          </span>
          <span
            className="font-mono text-xs border border-border-default text-fg-secondary px-2 py-0.5 uppercase group-hover:border-border-hover transition-colors duration-200 whitespace-nowrap"
            style={{ borderRadius: 0, letterSpacing: '0.1em' }}
          >
            {modeLabel(mode)}
          </span>
        </div>

        {/* Right: metric badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {gap ? (
            <>
              <span
                className="font-mono text-xs px-2 py-0.5 border"
                style={{ borderRadius: 0, borderColor: '#4ADE80', color: '#4ADE80', letterSpacing: '0.06em' }}
              >
                {connectedCount} connected
              </span>
              <span
                className="font-mono text-xs px-2 py-0.5 border"
                style={{ borderRadius: 0, borderColor: '#F87171', color: '#F87171', letterSpacing: '0.06em' }}
              >
                {orphanCount} orphan
              </span>
              <span
                className="font-mono text-xs px-2 py-0.5 border"
                style={{ borderRadius: 0, borderColor: '#FBBF24', color: '#FBBF24', letterSpacing: '0.06em' }}
              >
                {ghostCount} ghost
              </span>
            </>
          ) : (
            <span
              className="font-mono text-xs px-2 py-0.5 border border-border-default text-fg-secondary"
              style={{ borderRadius: 0, letterSpacing: '0.06em' }}
            >
              {totalRoutes} routes
            </span>
          )}
          <span
            className="font-mono text-xs text-fg-tertiary group-hover:text-fg-primary transition-colors duration-200 ml-2"
            style={{ letterSpacing: '0.05em' }}
          >
            →
          </span>
        </div>
      </div>
    </Link>
  )
}
