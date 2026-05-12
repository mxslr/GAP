'use client'

import { useState, useEffect, useRef } from 'react'
import { ApiDocPanel } from '../../components/ApiDocPanel'

const STORAGE_KEY = 'gap:docs-generator:last-result'

const STEP_MESSAGES = [
  'parsing routes...',
  'classifying features...',
  'enriching with examples...',
  'building documentation...',
]

interface DocResult {
  markdown: string
  openapi: object | null
  analysisId: string | null
}

interface StoredResult extends DocResult {
  timestamp: string
}

export default function DocsGeneratorPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [result, setResult] = useState<DocResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [copyMarkdownLabel, setCopyMarkdownLabel] = useState('copy markdown')

  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored: StoredResult = JSON.parse(raw)
        setResult({ markdown: stored.markdown, openapi: stored.openapi, analysisId: stored.analysisId })
        setCachedAt(stored.timestamp)
        setFromCache(true)
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  function startStepCycle() {
    setStepIndex(0)
    stepTimer.current = setInterval(() => {
      setStepIndex((i) => (i + 1) % STEP_MESSAGES.length)
    }, 5000)
  }

  function stopStepCycle() {
    if (stepTimer.current) {
      clearInterval(stepTimer.current)
      stepTimer.current = null
    }
  }

  async function handleGenerate() {
    if (!code.trim()) return
    setError(null)
    setResult(null)
    setFromCache(false)
    setCachedAt(null)
    setLoading(true)
    startStepCycle()

    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backendCode: code }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Generation failed')
      }

      const doc: DocResult = {
        markdown: data.markdown,
        openapi: data.openapi ?? null,
        analysisId: data.analysisId ?? null,
      }

      setResult(doc)

      // Persist to localStorage
      try {
        const stored: StoredResult = { ...doc, timestamp: new Date().toISOString() }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      } catch {
        // QuotaExceededError — skip persistence silently
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      stopStepCycle()
      setLoading(false)
    }
  }

  function handleDismissCache() {
    setResult(null)
    setFromCache(false)
    setCachedAt(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopyMarkdown() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.markdown)
      setCopyMarkdownLabel('copied!')
      setTimeout(() => setCopyMarkdownLabel('copy markdown'), 1500)
    } catch {
      // clipboard not available
    }
  }

  function handleDownloadMd() {
    if (!result) return
    downloadBlob(result.markdown, 'api-docs.md', 'text/markdown')
  }

  function handleDownloadOpenApi() {
    if (!result?.openapi) return
    downloadBlob(JSON.stringify(result.openapi, null, 2), 'openapi.json', 'application/json')
  }

  const showResult = result !== null
  const showInput = !loading && !showResult

  return (
    <main className="min-h-screen bg-bg-primary">
      {/* Hero */}
      <section className="pt-28 pb-12 px-8 border-b border-border-default stagger-section animate-delay-100">
        <p className="font-mono text-xs text-fg-tertiary uppercase tracking-widest mb-4">
          mode 3 / backend-only
        </p>
        <h1
          className="font-display text-4xl font-bold text-fg-primary leading-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          API DOCUMENTATION GENERATOR
        </h1>
        <p
          className="font-mono text-sm text-fg-secondary mt-3"
          style={{ letterSpacing: '0.08em' }}
        >
          paste your backend code. get full documentation. zero annotation.
        </p>
      </section>

      {/* Input section */}
      {showInput && (
        <section className="px-8 py-10 stagger-section animate-delay-200">
          <div className="max-w-3xl">
            <label className="block font-mono text-xs text-fg-secondary uppercase tracking-widest mb-2">
              backend code
            </label>
            <p className="font-mono text-xs text-fg-tertiary mb-3" style={{ letterSpacing: '0.05em' }}>
              supports express, fastapi, laravel
            </p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={20}
              placeholder="// paste your backend routes here&#10;app.get('/api/users', getUsers)&#10;app.post('/api/auth/login', login)"
              className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm px-4 py-3 focus:outline-none focus:border-fg-primary transition-colors duration-200 resize-y placeholder-fg-tertiary"
              spellCheck={false}
            />
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleGenerate}
                disabled={!code.trim()}
                className="font-mono text-sm px-6 py-3 border border-fg-primary text-fg-primary bg-transparent hover:bg-fg-primary hover:text-bg-primary transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-primary"
              >
                generate documentation →
              </button>
              {!code.trim() && (
                <span className="font-mono text-xs text-fg-tertiary" style={{ letterSpacing: '0.05em' }}>
                  paste code to continue
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Error */}
      {error && !loading && (
        <section className="px-8 pb-6">
          <div className="max-w-3xl border border-status-orphan p-4">
            <p className="font-mono text-xs text-status-orphan" style={{ letterSpacing: '0.05em' }}>
              error: {error}
            </p>
            <button
              onClick={() => { setError(null) }}
              className="font-mono text-xs text-fg-tertiary mt-3 hover:text-fg-primary transition-colors duration-200 underline underline-offset-2"
            >
              try again
            </button>
          </div>
        </section>
      )}

      {/* Loading state */}
      {loading && (
        <section className="flex flex-col items-center justify-center py-32 stagger-section animate-delay-100">
          {/* Square spinner */}
          <div
            className="w-8 h-8 border border-fg-primary animate-spin mb-8"
            style={{ animationTimingFunction: 'linear' }}
          />
          <p
            className="font-mono text-sm text-fg-secondary"
            style={{ letterSpacing: '0.08em', minHeight: '1.5rem' }}
          >
            {STEP_MESSAGES[stepIndex]}
          </p>
          <div className="flex gap-1.5 mt-6">
            {STEP_MESSAGES.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 transition-colors duration-300 ${i === stepIndex ? 'bg-fg-primary' : 'bg-fg-tertiary'}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Cache banner */}
      {showResult && fromCache && cachedAt && (
        <div className="flex items-center justify-between px-8 py-3 border-b border-border-default bg-bg-secondary">
          <p className="font-mono text-xs text-fg-tertiary" style={{ letterSpacing: '0.05em' }}>
            loaded from cache — generated at {new Date(cachedAt).toLocaleString()}
          </p>
          <button
            onClick={handleDismissCache}
            className="font-mono text-xs text-fg-tertiary hover:text-fg-primary transition-colors duration-200 border border-border-default px-3 py-1 hover:border-fg-primary"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Export bar */}
      {showResult && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-8 py-3 border-b border-border-default bg-bg-primary backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setResult(null); setFromCache(false); setCachedAt(null) }}
              className="font-mono text-xs text-fg-tertiary hover:text-fg-primary transition-colors duration-200 border border-border-default px-3 py-1.5 hover:border-fg-primary"
            >
              ← new analysis
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="font-mono text-xs text-fg-secondary hover:text-fg-primary transition-all duration-200 border border-border-default px-3 py-1.5 hover:border-fg-primary"
            >
              {copyMarkdownLabel}
            </button>
            <button
              onClick={handleDownloadMd}
              className="font-mono text-xs text-fg-secondary hover:text-fg-primary transition-all duration-200 border border-border-default px-3 py-1.5 hover:border-fg-primary"
            >
              download .md
            </button>
            <button
              onClick={handleDownloadOpenApi}
              disabled={!result?.openapi}
              className="font-mono text-xs transition-all duration-200 border px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed border-border-default text-fg-secondary hover:border-fg-primary hover:text-fg-primary disabled:hover:border-border-default disabled:hover:text-fg-secondary"
              aria-disabled={!result?.openapi}
            >
              download openapi.json
            </button>
          </div>
        </div>
      )}

      {/* Result — two-column ApiDocPanel */}
      {showResult && result && (
        <div className="stagger-section animate-delay-100">
          <ApiDocPanel markdown={result.markdown} openapi={result.openapi} />
        </div>
      )}
    </main>
  )
}
