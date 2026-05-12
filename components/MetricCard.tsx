interface MetricCardProps {
  label: string
  value: number
  accentColor: string
}

export function MetricCard({ label, value, accentColor }: MetricCardProps) {
  return (
    <div
      className="bg-bg-secondary border border-border-default p-6 flex flex-col gap-2"
      style={{ borderRadius: 0, borderLeft: `3px solid ${accentColor}` }}
    >
      <span
        className="font-display text-4xl font-bold text-fg-primary"
        style={{ letterSpacing: '-0.02em' }}
      >
        {value}
      </span>
      <span
        className="font-mono text-xs lowercase text-fg-secondary"
        style={{ letterSpacing: '0.1em' }}
      >
        {label}
      </span>
    </div>
  )
}
