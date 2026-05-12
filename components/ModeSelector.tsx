'use client'

import type { AnalysisMode } from '../lib/types'

interface ModeSelectorProps {
  value: AnalysisMode
  onChange: (mode: AnalysisMode) => void
}

const TABS: { value: AnalysisMode; label: string }[] = [
  { value: 'monorepo', label: 'Monorepo' },
  { value: 'separate', label: 'Separate Repos' },
  { value: 'backend-only', label: 'Backend-Only' },
]

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="flex" style={{ borderRadius: 0 }}>
      {TABS.map((tab, i) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`
              px-5 py-2 font-mono text-sm lowercase transition-all duration-200 cursor-pointer
              ${i === 0 ? 'border border-r-0' : i === TABS.length - 1 ? 'border' : 'border border-r-0'}
              ${active
                ? 'bg-fg-primary text-bg-primary border-fg-primary'
                : 'bg-transparent text-fg-secondary border-border-default hover:border-border-hover hover:text-fg-primary'
              }
            `}
            style={{ borderRadius: 0, letterSpacing: '0.05em' }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
