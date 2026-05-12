'use client'

import { useState } from 'react'
import { Spinner } from './Spinner'

interface GitHubInputProps {
  value: string
  onChange: (url: string) => void
  label?: string
  disabled?: boolean
}

function parseRepoPreview(url: string): string | null {
  const match = url.trim().match(/^https?:\/\/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?(\/.*)?$/)
  if (!match) return null
  return `${match[1]}/${match[2]}`
}

function isValidGithubUrl(url: string): boolean {
  return /^https?:\/\/github\.com\/[^/]+\/[^/\s]+/.test(url.trim())
}

export function GitHubInput({ value, onChange, label, disabled }: GitHubInputProps) {
  const [touched, setTouched] = useState(false)

  const showError = touched && value.trim().length > 0 && !isValidGithubUrl(value)
  const preview = isValidGithubUrl(value) ? parseRepoPreview(value) : null

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span
          className="font-mono text-xs text-fg-secondary lowercase"
          style={{ letterSpacing: '0.08em' }}
        >
          {label}
        </span>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="https://github.com/owner/repo"
          disabled={disabled}
          className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm px-4 py-3 focus:border-border-hover focus:outline-none transition-colors duration-200 placeholder:text-fg-tertiary disabled:opacity-40"
          style={{ borderRadius: 0 }}
        />
        {disabled && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size={14} />
          </div>
        )}
      </div>
      {showError && (
        <p
          className="font-mono text-xs lowercase"
          style={{ color: '#F87171', letterSpacing: '0.05em' }}
        >
          invalid github url — expected https://github.com/owner/repo
        </p>
      )}
      {preview && !showError && (
        <p
          className="font-mono text-xs text-fg-secondary lowercase"
          style={{ letterSpacing: '0.05em' }}
        >
          {preview}
        </p>
      )}
      {!preview && !showError && (
        <p
          className="font-mono text-xs text-fg-secondary lowercase"
          style={{ letterSpacing: '0.05em' }}
        >
          supports public repos · monorepo or separate repos
        </p>
      )}
    </div>
  )
}
