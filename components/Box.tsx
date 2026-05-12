interface BoxProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  as?: 'div' | 'section' | 'article' | 'li'
}

export function Box({ children, className = '', onClick, as: Tag = 'div' }: BoxProps) {
  return (
    <Tag
      className={`border border-border-default bg-bg-secondary hover:border-border-hover transition-colors duration-200 ${className}`}
      onClick={onClick}
      style={{ borderRadius: 0 }}
    >
      {children}
    </Tag>
  )
}
