'use client'

export type InputMethod = 'github' | 'folder' | 'paste'

interface InputMethodTabsProps {
  activeMethod: InputMethod
  onMethodChange: (method: InputMethod) => void
}

const TABS: { value: InputMethod; label: string }[] = [
  { value: 'github', label: 'github url' },
  { value: 'folder', label: 'drop folder' },
  { value: 'paste', label: 'paste code' },
]

export function InputMethodTabs({ activeMethod, onMethodChange }: InputMethodTabsProps) {
  return (
    <div className="flex" style={{ borderRadius: 0 }}>
      {TABS.map((tab, i) => {
        const active = tab.value === activeMethod
        const isFirst = i === 0
        const isLast = i === TABS.length - 1
        return (
          <button
            key={tab.value}
            onClick={() => onMethodChange(tab.value)}
            className={`
              px-4 py-1.5 font-mono text-xs lowercase transition-all duration-200 cursor-pointer
              ${isFirst ? 'border' : isLast ? 'border border-l-0' : 'border border-l-0'}
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
