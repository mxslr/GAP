interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 20, className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin border-2 border-fg-tertiary border-t-fg-primary ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 0,
      }}
      role="status"
      aria-label="loading"
    />
  )
}
