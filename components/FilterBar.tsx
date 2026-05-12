'use client'

import type { RouteStatus, HttpMethod } from '../lib/types'

export interface FilterState {
  status: RouteStatus | 'all'
  method: HttpMethod | 'all'
}

interface FilterBarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

const STATUS_OPTIONS: Array<RouteStatus | 'all'> = ['all', 'connected', 'orphan', 'ghost']
const METHOD_OPTIONS: Array<HttpMethod | 'all'> = ['all', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH']

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1 font-mono text-xs lowercase transition-all duration-200 cursor-pointer border
        ${active
          ? 'bg-fg-primary text-bg-primary border-fg-primary'
          : 'bg-transparent text-fg-secondary border-border-default hover:border-border-hover hover:text-fg-primary'
        }
      `}
      style={{ borderRadius: 0, letterSpacing: '0.05em' }}
    >
      {label}
    </button>
  )
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-fg-tertiary lowercase" style={{ letterSpacing: '0.08em' }}>
          status
        </span>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((s) => (
            <FilterButton
              key={s}
              label={s}
              active={filters.status === s}
              onClick={() => onChange({ ...filters, status: s })}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-fg-tertiary lowercase" style={{ letterSpacing: '0.08em' }}>
          method
        </span>
        <div className="flex gap-1">
          {METHOD_OPTIONS.map((m) => (
            <FilterButton
              key={m}
              label={m}
              active={filters.method === m}
              onClick={() => onChange({ ...filters, method: m })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
