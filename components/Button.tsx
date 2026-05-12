import Link from 'next/link'

interface ButtonProps {
  variant?: 'primary' | 'secondary'
  href?: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const variantClasses = {
  primary:
    'bg-fg-primary text-bg-primary hover:bg-fg-secondary border border-fg-primary hover:border-fg-secondary',
  secondary:
    'bg-transparent text-fg-primary border border-border-default hover:border-border-hover',
}

const baseClasses =
  'inline-flex items-center justify-center px-6 py-3 font-mono text-sm lowercase tracking-wide transition-all duration-200 cursor-pointer'

export function Button({
  variant = 'primary',
  href,
  onClick,
  children,
  className = '',
  disabled = false,
  type = 'button',
}: ButtonProps) {
  const classes = `${baseClasses} ${variantClasses[variant]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`

  if (href) {
    return (
      <Link href={href} className={classes} style={{ letterSpacing: '0.05em' }}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      style={{ letterSpacing: '0.05em' }}
    >
      {children}
    </button>
  )
}
