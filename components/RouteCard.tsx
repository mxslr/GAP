'use client'

import { useState } from 'react'
import { CodeBlock } from './CodeBlock'
import type { AnalyzedRoute, HttpMethod, RouteStatus } from '../lib/types'

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#4ADE80',
  POST: '#60A5FA',
  PUT: '#FBBF24',
  DELETE: '#F87171',
  PATCH: '#A78BFA',
}

const STATUS_COLORS: Record<RouteStatus, string> = {
  connected: '#4ADE80',
  orphan: '#F87171',
  ghost: '#FBBF24',
  documented: '#60A5FA',
}

export interface SnippetData {
  fetchSnippet: string
  tsTypes: string
  description: string
}

interface RouteCardProps {
  route: AnalyzedRoute
  snippet?: SnippetData
  snippetLoading?: boolean
  defaultOpen?: boolean
}

export function RouteCard({ route, snippet, snippetLoading = false, defaultOpen = false }: RouteCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const methodColor = METHOD_COLORS[route.method]
  const statusColor = STATUS_COLORS[route.status]

  const description = snippet?.description ?? route.description
  const fetchSnippet = snippet?.fetchSnippet ?? route.fetchSnippet
  const tsTypes = snippet?.tsTypes ?? route.tsTypes
  const hasContent = description || fetchSnippet || tsTypes

  return (
    <div
      className="border border-border-default bg-bg-secondary transition-colors duration-200 hover:border-border-hover"
      style={{ borderRadius: 0 }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
        style={{ borderRadius: 0 }}
      >
        {/* Method badge */}
        <span
          className="font-mono text-xs px-2 py-0.5 border shrink-0"
          style={{ borderRadius: 0, borderColor: methodColor, color: methodColor, letterSpacing: '0.05em' }}
        >
          {route.method}
        </span>

        {/* Path */}
        <span className="font-mono text-sm text-fg-primary flex-1 truncate" style={{ letterSpacing: '0.02em' }}>
          {route.path}
        </span>

        {/* Snippet loading indicator on header */}
        {snippetLoading && !snippet && (
          <span
            className="font-mono text-xs text-fg-tertiary shrink-0"
            style={{ letterSpacing: '0.05em' }}
          >
            generating...
          </span>
        )}

        {/* Status pill */}
        <span
          className="font-mono text-xs px-2 py-0.5 border shrink-0"
          style={{ borderRadius: 0, borderColor: statusColor, color: statusColor, letterSpacing: '0.05em' }}
        >
          {route.status}
        </span>

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="shrink-0 transition-transform duration-200 text-fg-tertiary"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {/* Body */}
      <div
        style={{
          maxHeight: open ? '1200px' : '0',
          overflow: 'hidden',
          transition: 'max-height 300ms ease',
        }}
      >
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border-default">
          {description && (
            <p className="font-body text-sm text-fg-secondary pt-3">{description}</p>
          )}

          {snippetLoading && !snippet ? (
            /* Skeleton while snippet is being generated */
            <div className="pt-3 flex flex-col gap-2">
              <span
                className="font-mono text-xs text-fg-tertiary lowercase"
                style={{ letterSpacing: '0.05em' }}
              >
                generating snippet...
              </span>
              <div className="skeleton-snippet" />
            </div>
          ) : (
            <>
              {fetchSnippet && (
                <CodeBlock code={fetchSnippet} label="fetch snippet" />
              )}
              {tsTypes && (
                <CodeBlock code={tsTypes} label="typescript types" />
              )}
              {!hasContent && (
                <p className="font-mono text-xs text-fg-secondary pt-3 lowercase" style={{ letterSpacing: '0.05em' }}>
                  no additional details
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
