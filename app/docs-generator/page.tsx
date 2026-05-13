'use client'

import { useState, useEffect, useRef } from 'react'
import { ApiDocPanel } from '../../components/ApiDocPanel'
import { InputMethodTabs } from '../../components/InputMethodTabs'
import { GitHubInput } from '../../components/GitHubInput'
import { FolderDropZone } from '../../components/FolderDropZone'
import { Spinner } from '../../components/Spinner'
import type { InputMethod } from '../../components/InputMethodTabs'
import type { RepoContent, AnalyzedRoute } from '../../lib/types'

const STORAGE_KEY = 'gap:docs-generator:last-result'

function repoContentToCode(content: RepoContent): string {
  return content.files.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')
}

type Phase = 'idle' | 'loading' | 'streaming' | 'complete' | 'error'

interface DocResult {
  markdown: string
  openapi: object | null
  analysisId: string | null
}

interface StoredResult extends DocResult { timestamp: string }

export default function DocsGeneratorPage() {
  const [inputMethod, setInputMethod] = useState<InputMethod>('paste')
  const [code, setCode] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [folderContent, setFolderContent] = useState<RepoContent | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [routeCount, setRouteCount] = useState<number | null>(null)
  const [result, setResult] = useState<DocResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [copyMarkdownLabel, setCopyMarkdownLabel] = useState('copy markdown')

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored: StoredResult = JSON.parse(raw)
        setResult({ markdown: stored.markdown, openapi: stored.openapi, analysisId: stored.analysisId })
        setCachedAt(stored.timestamp)
        setFromCache(true)
        setPhase('complete')
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  function canGenerate(): boolean {
    if (phase === 'loading' || phase === 'streaming') return false
    if (inputMethod === 'github') return githubUrl.trim().length > 0
    if (inputMethod === 'folder') return folderContent !== null
    return code.trim().length > 0
  }

  async function handleGenerate() {
    if (!canGenerate()) return

    // Abort any running stream
    if (readerRef.current) {
      try { readerRef.current.cancel() } catch { /* ignore */ }
      readerRef.current = null
    }

    setError(null)
    setResult(null)
    setFromCache(false)
    setCachedAt(null)
    setRouteCount(null)
    setPhase('loading')
    setStatusMessage('starting...')

    let requestBody: Record<string, unknown>
    if (inputMethod === 'github') {
      requestBody = { inputMethod: 'github', backendGithubUrl: githubUrl }
    } else if (inputMethod === 'folder' && folderContent) {
      requestBody = { inputMethod: 'folder', backendCode: repoContentToCode(folderContent) }
    } else {
      requestBody = { backendCode: code }
    }

    try {
      const response = await fetch('/api/docs/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ error: 'generation failed' }))
        setError((err as { error?: string }).error ?? 'generation failed')
        setPhase('error')
        return
      }

      const reader = response.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const messages = buffer.split('\n\n')
        buffer = messages.pop() ?? ''

        for (const msg of messages) {
          const eventMatch = msg.match(/^event: (\w+)/m)
          const dataMatch = msg.match(/^data: (.+)/m)
          if (!eventMatch || !dataMatch) continue

          const event = eventMatch[1]
          let data: Record<string, unknown>
          try { data = JSON.parse(dataMatch[1]) } catch { continue }

          switch (event) {
            case 'status':
              setStatusMessage((data.message as string) ?? '')
              if (phase !== 'streaming') setPhase('loading')
              break

            case 'routes': {
              const count = (data.total as number) ?? (data.routes as AnalyzedRoute[])?.length ?? 0
              setRouteCount(count)
              setPhase('streaming')
              break
            }

            case 'docs': {
              const doc: DocResult = {
                markdown: data.markdown as string,
                openapi: (data.openapi as object | null) ?? null,
                analysisId: (data.analysisId as string | null) ?? null,
              }
              setResult(doc)
              try {
                const stored: StoredResult = { ...doc, timestamp: new Date().toISOString() }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
              } catch {
                // QuotaExceededError — skip silently
              }
              break
            }

            case 'done':
              setPhase('complete')
              break

            case 'error':
              setError((data.message as string) ?? 'generation failed')
              setPhase('error')
              break
          }
        }
      }

      setPhase((p) => p === 'streaming' ? 'complete' : p)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error')
      setPhase('error')
    } finally {
      readerRef.current = null
    }
  }

  function handleDismissCache() {
    setResult(null)
    setFromCache(false)
    setCachedAt(null)
    setPhase('idle')
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopyMarkdown() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.markdown)
      setCopyMarkdownLabel('copied!')
      setTimeout(() => setCopyMarkdownLabel('copy markdown'), 1500)
    } catch { /* clipboard unavailable */ }
  }

  const showInput = phase === 'idle' || phase === 'error'
  const showResult = result !== null && (phase === 'streaming' || phase === 'complete')
  const isGenerating = phase === 'loading' || phase === 'streaming'

  return (
    <main className="min-h-screen bg-bg-primary">
      {/* Hero */}
      <section className="pt-28 pb-12 px-8 border-b border-border-default stagger-section animate-delay-100">
        <p className="font-mono text-xs text-fg-secondary uppercase tracking-widest mb-4">
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
          <div className="max-w-3xl flex flex-col gap-4">
            <InputMethodTabs activeMethod={inputMethod} onMethodChange={setInputMethod} />

            {inputMethod === 'github' && (
              <GitHubInput label="backend repository" value={githubUrl} onChange={setGithubUrl} />
            )}
            {inputMethod === 'folder' && (
              <FolderDropZone
                label="backend folder"
                onFilesRead={setFolderContent}
                fileCount={folderContent?.totalFiles}
                skippedCount={folderContent?.skippedFiles}
              />
            )}
            {inputMethod === 'paste' && (
              <div className="flex flex-col gap-1.5">
                <label className="block font-mono text-xs text-fg-secondary uppercase tracking-widest">
                  backend code
                </label>
                <p className="font-mono text-xs text-fg-secondary" style={{ letterSpacing: '0.05em' }}>
                  supports express, fastapi, laravel
                </p>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={20}
                  placeholder="// paste your backend routes here&#10;app.get('/api/users', getUsers)&#10;app.post('/api/auth/login', login)"
                  className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm px-4 py-3 focus:outline-none focus:border-fg-primary transition-colors duration-200 resize-y placeholder-fg-tertiary"
                  spellCheck={false}
                  style={{ borderRadius: 0 }}
                />
              </div>
            )}

            {phase === 'error' && error && (
              <div className="border border-status-orphan p-4" style={{ borderRadius: 0 }}>
                <p className="font-mono text-xs text-status-orphan" style={{ letterSpacing: '0.05em' }}>
                  error: {error}
                </p>
                <button
                  onClick={() => { setError(null); setPhase('idle') }}
                  className="font-mono text-xs text-fg-secondary mt-3 hover:text-fg-primary transition-colors duration-200 underline underline-offset-2"
                >
                  try again
                </button>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate()}
                className="font-mono text-sm px-6 py-3 border border-fg-primary text-fg-primary bg-transparent hover:bg-fg-primary hover:text-bg-primary transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-primary"
                style={{ borderRadius: 0 }}
              >
                generate documentation →
              </button>
              {!canGenerate() && (
                <span className="font-mono text-xs text-fg-secondary" style={{ letterSpacing: '0.05em' }}>
                  {inputMethod === 'github' ? 'enter a github url to continue'
                    : inputMethod === 'folder' ? 'drop a folder to continue'
                    : 'paste code to continue'}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Loading state — full screen only before routes arrive */}
      {isGenerating && !showResult && (
        <section className="flex flex-col items-center justify-center py-32 stagger-section animate-delay-100">
          <div
            className="w-8 h-8 border border-fg-primary animate-spin mb-8"
            style={{ animationTimingFunction: 'linear', borderRadius: 0 }}
          />
          <p
            key={statusMessage}
            className="font-mono text-sm text-fg-secondary animate-fade-in"
            style={{ letterSpacing: '0.08em', minHeight: '1.5rem' }}
          >
            {statusMessage}
          </p>
          {routeCount !== null && (
            <p className="font-mono text-xs text-fg-tertiary mt-2" style={{ letterSpacing: '0.05em' }}>
              {routeCount} routes detected
            </p>
          )}
        </section>
      )}

      {/* Status bar while docs are being generated (after routes known) */}
      {isGenerating && routeCount !== null && !showResult && (
        <div className="flex items-center gap-3 px-8 py-3 border-b border-border-default bg-bg-secondary">
          <Spinner size={12} />
          <span className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
            {statusMessage} — {routeCount} routes detected
          </span>
        </div>
      )}

      {/* Cache banner */}
      {showResult && fromCache && cachedAt && (
        <div className="flex items-center justify-between px-8 py-3 border-b border-border-default bg-bg-secondary">
          <p className="font-mono text-xs text-fg-secondary" style={{ letterSpacing: '0.05em' }}>
            loaded from cache — generated at {new Date(cachedAt).toLocaleString()}
          </p>
          <button
            onClick={handleDismissCache}
            className="font-mono text-xs text-fg-secondary hover:text-fg-primary transition-colors duration-200 border border-border-default px-3 py-1 hover:border-fg-primary"
            style={{ borderRadius: 0 }}
          >
            dismiss
          </button>
        </div>
      )}

      {/* Export bar */}
      {showResult && (
        <div className="sticky top-[60px] z-40 flex items-center justify-between px-8 py-3 border-b border-border-default bg-bg-primary backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setResult(null); setFromCache(false); setCachedAt(null); setPhase('idle') }}
              className="font-mono text-xs text-fg-secondary hover:text-fg-primary transition-colors duration-200 border border-border-default px-3 py-1.5 hover:border-fg-primary"
              style={{ borderRadius: 0 }}
            >
              ← new analysis
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="font-mono text-xs text-fg-secondary hover:text-fg-primary transition-all duration-200 border border-border-default px-3 py-1.5 hover:border-fg-primary"
              style={{ borderRadius: 0 }}
            >
              {copyMarkdownLabel}
            </button>
            <button
              onClick={() => result && downloadBlob(result.markdown, 'api-docs.md', 'text/markdown')}
              className="font-mono text-xs text-fg-secondary hover:text-fg-primary transition-all duration-200 border border-border-default px-3 py-1.5 hover:border-fg-primary"
              style={{ borderRadius: 0 }}
            >
              download .md
            </button>
            <button
              onClick={() => result?.openapi && downloadBlob(JSON.stringify(result.openapi, null, 2), 'openapi.json', 'application/json')}
              disabled={!result?.openapi}
              className="font-mono text-xs transition-all duration-200 border px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed border-border-default text-fg-secondary hover:border-fg-primary hover:text-fg-primary disabled:hover:border-border-default disabled:hover:text-fg-secondary"
              style={{ borderRadius: 0 }}
            >
              download openapi.json
            </button>
          </div>
        </div>
      )}

      {/* Result panel */}
      {showResult && result && (
        <div className="stagger-section animate-delay-100">
          <ApiDocPanel markdown={result.markdown} openapi={result.openapi} />
        </div>
      )}
    </main>
  )
}
