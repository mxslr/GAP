'use client'

type ViewMode = 'flat' | 'feature'

interface ViewToggleProps {
  value: ViewMode
  onChange: (view: ViewMode) => void
}

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: 'flat', label: 'flat view' },
  { value: 'feature', label: 'feature view' },
]

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex" style={{ borderRadius: 0 }}>
      {VIEWS.map((v, i) => {
        const active = v.value === value
        return (
          <button
            key={v.value}
            onClick={() => onChange(v.value)}
            className={`
              px-4 py-1.5 font-mono text-xs lowercase transition-all duration-200 cursor-pointer
              ${i === 0 ? 'border border-r-0' : 'border'}
              ${active
                ? 'bg-fg-primary text-bg-primary border-fg-primary'
                : 'bg-transparent text-fg-secondary border-border-default hover:border-border-hover hover:text-fg-primary'
              }
            `}
            style={{ borderRadius: 0, letterSpacing: '0.05em' }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
