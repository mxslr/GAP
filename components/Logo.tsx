interface LogoProps {
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-4xl',
}

export function Logo({ showTagline = false, size = 'md' }: LogoProps) {
  return (
    <div className="inline-flex flex-col">
      <div className="relative inline-block">
        <span
          className={`font-display font-bold text-fg-primary ${sizeMap[size]}`}
          style={{ letterSpacing: '-0.04em' }}
        >
          GAP
          <span
            className="inline-block w-[0.18em] h-[0.18em] bg-fg-primary align-middle ml-[0.04em] mb-[0.12em]"
            aria-hidden="true"
          />
        </span>
        <div className="h-px w-full bg-fg-primary mt-0.5" />
      </div>
      {showTagline && (
        <span
          className="font-mono text-fg-secondary text-xs lowercase mt-1"
          style={{ letterSpacing: '0.1em' }}
        >
          api intelligence platform
        </span>
      )}
    </div>
  )
}
