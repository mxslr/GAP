'use client'

import { useState } from 'react'

interface CodeBlockProps {
  code: string
  label?: string
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-bg-tertiary border border-border-default" style={{ borderRadius: 0 }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-default">
        {label && (
          <span className="font-mono text-xs text-fg-tertiary lowercase" style={{ letterSpacing: '0.08em' }}>
            {label}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="ml-auto font-mono text-xs lowercase text-fg-secondary hover:text-fg-primary transition-colors duration-200 cursor-pointer"
          style={{ letterSpacing: '0.05em' }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre
        className="p-4 text-xs font-mono text-fg-secondary overflow-x-auto"
        style={{ borderRadius: 0 }}
      >
        {code}
      </pre>
    </div>
  )
}
