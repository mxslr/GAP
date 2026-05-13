'use client'

import { useReducer, useState, useRef } from 'react'
import { ModeSelector } from '../../components/ModeSelector'
import { InputMethodTabs } from '../../components/InputMethodTabs'
import { GitHubInput } from '../../components/GitHubInput'
import { FolderDropZone } from '../../components/FolderDropZone'
import { ViewToggle } from '../../components/ViewToggle'
import { MetricCard } from '../../components/MetricCard'
import { FilterBar } from '../../components/FilterBar'
import { RouteCard } from '../../components/RouteCard'
import { FeatureGroup } from '../../components/FeatureGroup'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import type { SnippetData } from '../../components/RouteCard'
import type { AnalysisMode, RepoContent, AnalyzedRoute, FeatureGroup as FeatureGroupType } from '../../lib/types'
import type { FilterState } from '../../components/FilterBar'
import type { InputMethod } from '../../components/InputMethodTabs'

type ViewMode = 'flat' | 'feature'
type Phase = 'idle' | 'loading' | 'streaming' | 'complete' | 'error'

interface GapSummary { total: number; connected: number; orphan: number; ghost: number }

interface FolderState {
  content: RepoContent | null
  backendContent: RepoContent | null
  frontendContent: RepoContent | null
}

// ── Input state (reducer) ────────────────────────────────────────────────────

interface InputState {
  mode: AnalysisMode
  repoSource: string
  backendCode: string
  frontendCode: string
  backendGithubUrl: string
  frontendGithubUrl: string
  repoGithubUrl: string
  viewMode: ViewMode
  filters: FilterState
}

type InputAction =
  | { type: 'SET_MODE'; mode: AnalysisMode }
  | { type: 'SET_REPO_SOURCE'; value: string }
  | { type: 'SET_BACKEND_CODE'; value: string }
  | { type: 'SET_FRONTEND_CODE'; value: string }
  | { type: 'SET_BACKEND_GITHUB'; value: string }
  | { type: 'SET_FRONTEND_GITHUB'; value: string }
  | { type: 'SET_REPO_GITHUB'; value: string }
  | { type: 'SET_VIEW_MODE'; viewMode: ViewMode }
  | { type: 'SET_FILTERS'; filters: FilterState }

const INITIAL_FILTERS: FilterState = { status: 'all', method: 'all' }

const INITIAL_INPUT: InputState = {
  mode: 'monorepo',
  repoSource: '',
  backendCode: '',
  frontendCode: '',
  backendGithubUrl: '',
  frontendGithubUrl: '',
  repoGithubUrl: '',
  viewMode: 'flat',
  filters: INITIAL_FILTERS,
}

function inputReducer(state: InputState, action: InputAction): InputState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode }
    case 'SET_REPO_SOURCE':
      return { ...state, repoSource: action.value }
    case 'SET_BACKEND_CODE':
      return { ...state, backendCode: action.value }
    case 'SET_FRONTEND_CODE':
      return { ...state, frontendCode: action.value }
    case 'SET_BACKEND_GITHUB':
      return { ...state, backendGithubUrl: action.value }
    case 'SET_FRONTEND_GITHUB':
      return { ...state, frontendGithubUrl: action.value }
    case 'SET_REPO_GITHUB':
      return { ...state, repoGithubUrl: action.value }
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.viewMode }
    case 'SET_FILTERS':
      return { ...state, filters: action.filters }
    default:
      return state
  }
}

function repoContentToCode(content: RepoContent): string {
  return content.files.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n')
}

// ── Page component ────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const [input, dispatch] = useReducer(inputReducer, INITIAL_INPUT)
  const [inputMethod, setInputMethod] = useState<InputMethod>('paste')
  const [folderState, setFolderState] = useState<FolderState>({
    content: null, backendContent: null, frontendContent: null,
  })

  // Streaming output state
  const [phase, setPhase] = useState<Phase>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [routes, setRoutes] = useState<AnalyzedRoute[]>([])
  const [snippets, setSnippets] = useState<Record<string, SnippetData>>({})
  const [features, setFeatures] = useState<FeatureGroupType[]>([])
  const [summary, setSummary] = useState<GapSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  function resetOutput() {
    setPhase('idle')
    setStatusMessage('')
    setRoutes([])
    setSnippets({})
    setFeatures([])
    setSummary(null)
    setError(null)
  }

  function canSubmit(): boolean {
    if (phase === 'loading' || phase === 'streaming') return false
    if (inputMethod === 'github') {
      if (input.mode === 'monorepo') return input.repoGithubUrl.trim().length > 0
      if (input.mode === 'separate') {
        return input.backendGithubUrl.trim().length > 0 && input.frontendGithubUrl.trim().length > 0
      }
      return input.backendGithubUrl.trim().length > 0
    }
    if (inputMethod === 'folder') {
      if (input.mode === 'monorepo') return folderState.content !== null
      if (input.mode === 'separate') {
        return folderState.backendContent !== null && folderState.frontendContent !== null
      }
      return folderState.backendContent !== null
    }
    if (input.mode === 'monorepo') return input.repoSource.trim().length > 0
    if (input.mode === 'separate') {
      return input.backendCode.trim().length > 0 && input.frontendCode.trim().length > 0
    }
    return input.backendCode.trim().length > 0
  }

  async function handleSubmit() {
    if (!canSubmit()) return

    // Abort any running stream
    if (readerRef.current) {
      try { readerRef.current.cancel() } catch { /* ignore */ }
      readerRef.current = null
    }

    resetOutput()
    setPhase('loading')
    setStatusMessage('starting analysis...')

    // Build request body
    let body: Record<string, unknown>
    if (inputMethod === 'github') {
      body = { mode: input.mode, inputMethod: 'github' }
      if (input.mode === 'monorepo') body.repoGithubUrl = input.repoGithubUrl
      else if (input.mode === 'separate') {
        body.backendGithubUrl = input.backendGithubUrl
        body.frontendGithubUrl = input.frontendGithubUrl
      } else {
        body.backendGithubUrl = input.backendGithubUrl
      }
    } else if (inputMethod === 'folder') {
      body = { mode: input.mode, inputMethod: 'folder' }
      if (input.mode === 'monorepo' && folderState.content) {
        body.repoSource = repoContentToCode(folderState.content)
      } else if (input.mode === 'separate') {
        body.backendCode = folderState.backendContent ? repoContentToCode(folderState.backendContent) : ''
        body.frontendCode = folderState.frontendContent ? repoContentToCode(folderState.frontendContent) : ''
      } else {
        body.backendCode = folderState.backendContent ? repoContentToCode(folderState.backendContent) : ''
      }
    } else {
      if (input.mode === 'monorepo') body = { mode: 'monorepo', repoSource: input.repoSource }
      else if (input.mode === 'separate') body = { mode: 'separate', backendCode: input.backendCode, frontendCode: input.frontendCode }
      else body = { mode: 'backend-only', backendCode: input.backendCode }
    }

    try {
      const response = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ error: 'analysis failed' }))
        setError((err as { error?: string }).error ?? 'analysis failed')
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
              break

            case 'routes':
              setRoutes((data.routes as AnalyzedRoute[]) ?? [])
              setSummary((data.summary as GapSummary) ?? null)
              setPhase('streaming')
              break

            case 'snippet':
              setSnippets((prev) => ({
                ...prev,
                [data.routeId as string]: {
                  fetchSnippet: data.fetchSnippet as string,
                  tsTypes: data.tsTypes as string,
                  description: data.description as string,
                },
              }))
              break

            case 'features':
              setFeatures((data.features as FeatureGroupType[]) ?? [])
              setRoutes((prev) =>
                prev.map((r) => {
                  const updated = (data.routesWithFeatureId as AnalyzedRoute[]).find((u) => u.id === r.id)
                  return updated ? { ...r, featureId: updated.featureId } : r
                })
              )
              break

            case 'done':
              setPhase('complete')
              break

            case 'error':
              setError((data.message as string) ?? 'analysis failed')
              setPhase('error')
              break
          }
        }
      }

      // If stream ends without 'done' event, mark complete anyway
      setPhase((p) => p === 'streaming' ? 'complete' : p)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error — check your connection')
      setPhase('error')
    } finally {
      readerRef.current = null
    }
  }

  const isActive = phase === 'streaming' || phase === 'complete'
  const isLoading = phase === 'loading'
  const showInput = phase === 'idle' || phase === 'error'

  const modeLabel =
    input.mode === 'monorepo' ? 'MONOREPO MODE'
    : input.mode === 'separate' ? 'SEPARATE MODE'
    : 'BACKEND-ONLY MODE'

  const snippetCount = Object.keys(snippets).length
  const totalRoutes = routes.length
  const isGenerating = phase !== 'complete' && snippetCount < totalRoutes

  const filteredRoutes = routes.filter((r) => {
    const statusMatch = input.filters.status === 'all' || r.status === input.filters.status
    const methodMatch = input.filters.method === 'all' || r.method === input.filters.method
    return statusMatch && methodMatch
  })

  return (
    <main className="min-h-screen bg-bg-primary pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-10">

        {/* Page header */}
        <div className="animate-fade-in" style={{ animationDelay: '0ms', animationFillMode: 'both' }}>
          <h1
            className="font-display text-3xl font-bold text-fg-primary uppercase"
            style={{ letterSpacing: '-0.02em' }}
          >
            Analyze
          </h1>
          <p
            className="font-mono text-sm text-fg-secondary mt-1"
            style={{ letterSpacing: '0.08em' }}
          >
            detect routes, bridge gaps, classify features.
          </p>
        </div>

        {/* Input section */}
        {showInput && (
          <div
            className="flex flex-col gap-4 animate-fade-in"
            style={{ animationDelay: '60ms', animationFillMode: 'both' }}
          >
            <ModeSelector
              value={input.mode}
              onChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
            />

            <InputMethodTabs activeMethod={inputMethod} onMethodChange={setInputMethod} />

            {/* GitHub inputs */}
            {inputMethod === 'github' && (
              <>
                {input.mode === 'monorepo' && (
                  <GitHubInput value={input.repoGithubUrl} onChange={(v) => dispatch({ type: 'SET_REPO_GITHUB', value: v })} />
                )}
                {input.mode === 'separate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <GitHubInput label="backend" value={input.backendGithubUrl} onChange={(v) => dispatch({ type: 'SET_BACKEND_GITHUB', value: v })} />
                    <GitHubInput label="frontend" value={input.frontendGithubUrl} onChange={(v) => dispatch({ type: 'SET_FRONTEND_GITHUB', value: v })} />
                  </div>
                )}
                {input.mode === 'backend-only' && (
                  <GitHubInput label="backend" value={input.backendGithubUrl} onChange={(v) => dispatch({ type: 'SET_BACKEND_GITHUB', value: v })} />
                )}
              </>
            )}

            {/* Folder inputs */}
            {inputMethod === 'folder' && (
              <>
                {input.mode === 'monorepo' && (
                  <FolderDropZone onFilesRead={(c) => setFolderState((s) => ({ ...s, content: c }))} fileCount={folderState.content?.totalFiles} skippedCount={folderState.content?.skippedFiles} />
                )}
                {input.mode === 'separate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FolderDropZone label="backend" onFilesRead={(c) => setFolderState((s) => ({ ...s, backendContent: c }))} fileCount={folderState.backendContent?.totalFiles} skippedCount={folderState.backendContent?.skippedFiles} />
                    <FolderDropZone label="frontend" onFilesRead={(c) => setFolderState((s) => ({ ...s, frontendContent: c }))} fileCount={folderState.frontendContent?.totalFiles} skippedCount={folderState.frontendContent?.skippedFiles} />
                  </div>
                )}
                {input.mode === 'backend-only' && (
                  <FolderDropZone label="backend" onFilesRead={(c) => setFolderState((s) => ({ ...s, backendContent: c }))} fileCount={folderState.backendContent?.totalFiles} skippedCount={folderState.backendContent?.skippedFiles} />
                )}
              </>
            )}

            {/* Paste inputs */}
            {inputMethod === 'paste' && (
              <>
                {input.mode === 'monorepo' && (
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
                      paste your full project (file tree or pasted folders)
                    </label>
                    <textarea
                      value={input.repoSource}
                      onChange={(e) => dispatch({ type: 'SET_REPO_SOURCE', value: e.target.value })}
                      placeholder={"server/app.js\nconst express = require('express')\napp.get('/users', ...)\n\nclient/src/App.jsx\nfetch('/api/users')..."}
                      rows={14}
                      className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm p-4 resize-y focus:border-border-hover focus:outline-none transition-colors duration-200 placeholder:text-fg-tertiary"
                      style={{ borderRadius: 0 }}
                    />
                    <p className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.05em' }}>
                      ai will detect which folders are backend and frontend
                    </p>
                  </div>
                )}
                {input.mode === 'separate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>backend code</label>
                      <textarea
                        value={input.backendCode}
                        onChange={(e) => dispatch({ type: 'SET_BACKEND_CODE', value: e.target.value })}
                        placeholder="Express routes, FastAPI endpoints, Laravel controllers..."
                        rows={14}
                        className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm p-4 resize-y focus:border-border-hover focus:outline-none transition-colors duration-200 placeholder:text-fg-tertiary"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>frontend code</label>
                      <textarea
                        value={input.frontendCode}
                        onChange={(e) => dispatch({ type: 'SET_FRONTEND_CODE', value: e.target.value })}
                        placeholder="React components, axios calls, fetch()..."
                        rows={14}
                        className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm p-4 resize-y focus:border-border-hover focus:outline-none transition-colors duration-200 placeholder:text-fg-tertiary"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                  </div>
                )}
                {input.mode === 'backend-only' && (
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>backend code</label>
                    <textarea
                      value={input.backendCode}
                      onChange={(e) => dispatch({ type: 'SET_BACKEND_CODE', value: e.target.value })}
                      placeholder="Express routes, FastAPI endpoints, Laravel controllers..."
                      rows={14}
                      className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm p-4 resize-y focus:border-border-hover focus:outline-none transition-colors duration-200 placeholder:text-fg-tertiary"
                      style={{ borderRadius: 0 }}
                    />
                    <p className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.05em' }}>
                      supports express, fastapi, laravel
                    </p>
                  </div>
                )}
              </>
            )}

            {phase === 'error' && error && (
              <p className="font-mono text-sm lowercase" style={{ color: '#F87171', letterSpacing: '0.05em' }}>
                {error}
              </p>
            )}

            <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit()} className="w-full">
              analyze api gaps →
            </Button>
          </div>
        )}

        {/* Full-screen loading — only while routes haven't arrived yet */}
        {isLoading && (
          <div
            className="flex flex-col items-center gap-6 py-20 animate-fade-in"
            style={{ animationDelay: '0ms', animationFillMode: 'both' }}
          >
            <Spinner size={32} />
            <p
              key={statusMessage}
              className="font-mono text-sm text-fg-secondary lowercase animate-fade-in"
              style={{ letterSpacing: '0.1em' }}
            >
              {statusMessage}
            </p>
          </div>
        )}

        {/* Results — appear as soon as routes arrive */}
        {isActive && (
          <div
            className="flex flex-col gap-6 animate-fade-in"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
          >
            {/* Mode badge + view toggle */}
            <div className="flex items-center justify-between">
              <span
                className="font-mono text-xs border border-border-default text-fg-secondary px-3 py-1 uppercase"
                style={{ borderRadius: 0, letterSpacing: '0.12em' }}
              >
                {modeLabel}
              </span>
              <ViewToggle
                value={input.viewMode}
                onChange={(viewMode) => dispatch({ type: 'SET_VIEW_MODE', viewMode })}
              />
            </div>

            {/* Snippet progress bar — visible while generating */}
            {isGenerating && (
              <div
                className="flex items-center gap-3 px-4 py-2 border border-border-default bg-bg-secondary"
                style={{ borderRadius: 0 }}
              >
                <Spinner size={14} />
                <span
                  className="font-mono text-xs text-fg-secondary lowercase"
                  style={{ letterSpacing: '0.08em' }}
                >
                  {statusMessage || 'generating snippets...'} {snippetCount}/{totalRoutes}
                </span>
              </div>
            )}

            {/* Metric cards */}
            {summary && (
              <div
                className="grid grid-cols-3 gap-px bg-border-default animate-fade-in"
                style={{ animationDelay: '150ms', animationFillMode: 'both' }}
              >
                <MetricCard label="connected" value={summary.connected} accentColor="#4ADE80" />
                <MetricCard label="orphan" value={summary.orphan} accentColor="#F87171" />
                <MetricCard label="ghost" value={summary.ghost} accentColor="#FBBF24" />
              </div>
            )}

            {/* Filter bar — flat view only */}
            {input.viewMode === 'flat' && (
              <div className="animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                <FilterBar
                  filters={input.filters}
                  onChange={(filters) => dispatch({ type: 'SET_FILTERS', filters })}
                />
              </div>
            )}

            {/* Count line */}
            <p className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
              {input.viewMode === 'flat'
                ? `showing ${filteredRoutes.length} of ${routes.length} routes`
                : `${features.length} feature groups · ${routes.length} routes total`}
            </p>

            {/* Content area */}
            {routes.length === 0 ? (
              <div className="border border-border-default p-10 text-center" style={{ borderRadius: 0 }}>
                <p className="font-mono text-sm text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
                  no routes detected — check your input and try again
                </p>
              </div>
            ) : input.viewMode === 'flat' ? (
              <div className="flex flex-col gap-px bg-border-default">
                {filteredRoutes.length === 0 ? (
                  <div className="bg-bg-primary border border-border-default p-6 text-center">
                    <p className="font-mono text-sm text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
                      no routes match the current filters
                    </p>
                  </div>
                ) : (
                  filteredRoutes.map((route) => (
                    <RouteCard
                      key={route.id}
                      route={route}
                      snippet={snippets[route.id]}
                      snippetLoading={phase !== 'complete' && !snippets[route.id]}
                    />
                  ))
                )}
              </div>
            ) : features.length === 0 ? (
              /* Feature view — waiting for classification */
              <div className="flex items-center gap-3 px-4 py-6 border border-border-default" style={{ borderRadius: 0 }}>
                <Spinner size={14} />
                <span className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
                  classifying features...
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {features.map((feature) => (
                  <FeatureGroup
                    key={feature.id}
                    feature={feature}
                    routes={routes}
                    snippets={snippets}
                    snippetLoading={phase !== 'complete'}
                  />
                ))}
              </div>
            )}

            {/* Re-analyze button */}
            <Button
              variant="secondary"
              onClick={resetOutput}
              className="self-start"
            >
              ← analyze another
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
