'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from './Logo'

export function Navbar() {
  const [hovered, setHovered] = useState(false)

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      style={{
        backgroundColor: hovered ? 'rgba(0,0,0,0.6)' : 'transparent',
        backdropFilter: hovered ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: hovered ? 'blur(12px)' : 'none',
        borderBottom: hovered ? '1px solid #2A2A2A' : '1px solid transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="transition-opacity duration-200 hover:opacity-80">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-8">
          <Link
            href="/analyze"
            className="font-mono text-sm text-fg-secondary lowercase tracking-wide hover:text-fg-primary transition-colors duration-200"
            style={{ letterSpacing: '0.08em' }}
          >
            analyze
          </Link>
          <Link
            href="/docs-generator"
            className="font-mono text-sm text-fg-secondary lowercase tracking-wide hover:text-fg-primary transition-colors duration-200"
            style={{ letterSpacing: '0.08em' }}
          >
            api docs
          </Link>
          <Link
            href="/history"
            className="font-mono text-sm text-fg-secondary lowercase tracking-wide hover:text-fg-primary transition-colors duration-200"
            style={{ letterSpacing: '0.08em' }}
          >
            history
          </Link>
        </div>
      </div>
    </nav>
  )
}
