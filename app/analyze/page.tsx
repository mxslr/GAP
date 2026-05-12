'use client'

import { useReducer, useEffect, useRef, useState } from 'react'
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
import type { GapAnalysisResult, AnalysisMode, RepoContent } from '../../lib/types'
import type { FilterState } from '../../components/FilterBar'
import type { InputMethod } from '../../components/InputMethodTabs'

type ViewMode = 'flat' | 'feature'
type PageStatus = 'idle' | 'loading' | 'done' | 'error'

interface FolderState {
  content: RepoContent | null
  backendContent: RepoContent | null
  frontendContent: RepoContent | null
}

interface PageState {
  mode: AnalysisMode
  repoSource: string
  backendCode: string
  frontendCode: string
  backendGithubUrl: string
  frontendGithubUrl: string
  repoGithubUrl: string
  status: PageStatus
  result: GapAnalysisResult | null
  viewMode: ViewMode
  filters: FilterState
  error: string | null
  loadingStep: number
}

type Action =
  | { type: 'SET_MODE'; mode: AnalysisMode }
  | { type: 'SET_REPO_SOURCE'; value: string }
  | { type: 'SET_BACKEND_CODE'; value: string }
  | { type: 'SET_FRONTEND_CODE'; value: string }
  | { type: 'SET_BACKEND_GITHUB'; value: string }
  | { type: 'SET_FRONTEND_GITHUB'; value: string }
  | { type: 'SET_REPO_GITHUB'; value: string }
  | { type: 'START_LOADING' }
  | { type: 'SET_LOADING_STEP'; step: number }
  | { type: 'SET_RESULT'; result: GapAnalysisResult }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_VIEW_MODE'; viewMode: ViewMode }
  | { type: 'SET_FILTERS'; filters: FilterState }

const INITIAL_FILTERS: FilterState = { status: 'all', method: 'all' }

const INITIAL_STATE: PageState = {
  mode: 'monorepo',
  repoSource: '',
  backendCode: '',
  frontendCode: '',
  backendGithubUrl: '',
  frontendGithubUrl: '',
  repoGithubUrl: '',
  status: 'idle',
  result: null,
  viewMode: 'flat',
  filters: INITIAL_FILTERS,
  error: null,
  loadingStep: 0,
}

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode, status: 'idle', result: null, error: null }
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
    case 'START_LOADING':
      return { ...state, status: 'loading', error: null, result: null, loadingStep: 0 }
    case 'SET_LOADING_STEP':
      return { ...state, loadingStep: action.step }
    case 'SET_RESULT':
      return { ...state, status: 'done', result: action.result, loadingStep: 0 }
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error, loadingStep: 0 }
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.viewMode }
    case 'SET_FILTERS':
      return { ...state, filters: action.filters }
    default:
      return state
  }
}

function repoContentToCode(content: RepoContent): string {
  return content.files
    .map((f) => `// === FILE: ${f.path} ===\n${f.content}`)
    .join('\n\n')
}

function getLoadingSteps(mode: AnalysisMode, inputMethod: InputMethod): string[] {
  const base = [
    'parsing backend routes...',
    'parsing frontend calls...',
    'matching gaps...',
    'classifying features...',
    'generating snippets...',
  ]
  const withLayout = mode === 'monorepo' ? ['detecting layout...', ...base] : base
  if (inputMethod === 'github') return ['fetching repository...', ...withLayout]
  if (inputMethod === 'folder') return ['reading folder...', ...withLayout]
  return withLayout
}

const STEP_DURATIONS = [2000, 3000, 3000, 2000, 3000]

export default function AnalyzePage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const [inputMethod, setInputMethod] = useState<InputMethod>('paste')
  const [folderState, setFolderState] = useState<FolderState>({
    content: null,
    backendContent: null,
    frontendContent: null,
  })
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
    }
  }, [])

  function canSubmit(): boolean {
    if (state.status === 'loading') return false
    if (inputMethod === 'github') {
      if (state.mode === 'monorepo') return state.repoGithubUrl.trim().length > 0
      if (state.mode === 'separate') {
        return state.backendGithubUrl.trim().length > 0 && state.frontendGithubUrl.trim().length > 0
      }
      return state.backendGithubUrl.trim().length > 0
    }
    if (inputMethod === 'folder') {
      if (state.mode === 'monorepo') return folderState.content !== null
      if (state.mode === 'separate') {
        return folderState.backendContent !== null && folderState.frontendContent !== null
      }
      return folderState.backendContent !== null
    }
    // paste
    if (state.mode === 'monorepo') return state.repoSource.trim().length > 0
    if (state.mode === 'separate') {
      return state.backendCode.trim().length > 0 && state.frontendCode.trim().length > 0
    }
    return state.backendCode.trim().length > 0
  }

  function startStepProgression(steps: string[]) {
    let current = 0
    dispatch({ type: 'SET_LOADING_STEP', step: 0 })

    function advance() {
      current += 1
      if (current < steps.length) {
        dispatch({ type: 'SET_LOADING_STEP', step: current })
        const dur = STEP_DURATIONS[current] ?? 3000
        stepTimerRef.current = setTimeout(advance, dur)
      }
    }

    const firstDur = STEP_DURATIONS[0] ?? 2000
    stepTimerRef.current = setTimeout(advance, firstDur)
  }

  async function handleSubmit() {
    if (!canSubmit()) return
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
    dispatch({ type: 'START_LOADING' })

    const steps = getLoadingSteps(state.mode, inputMethod)
    startStepProgression(steps)

    try {
      let body: Record<string, unknown>

      if (inputMethod === 'github') {
        body = { mode: state.mode, inputMethod: 'github' }
        if (state.mode === 'monorepo') body.repoGithubUrl = state.repoGithubUrl
        else if (state.mode === 'separate') {
          body.backendGithubUrl = state.backendGithubUrl
          body.frontendGithubUrl = state.frontendGithubUrl
        } else {
          body.backendGithubUrl = state.backendGithubUrl
        }
      } else if (inputMethod === 'folder') {
        body = { mode: state.mode, inputMethod: 'folder' }
        if (state.mode === 'monorepo' && folderState.content) {
          body.repoSource = repoContentToCode(folderState.content)
        } else if (state.mode === 'separate') {
          body.backendCode = folderState.backendContent ? repoContentToCode(folderState.backendContent) : ''
          body.frontendCode = folderState.frontendContent ? repoContentToCode(folderState.frontendContent) : ''
        } else {
          body.backendCode = folderState.backendContent ? repoContentToCode(folderState.backendContent) : ''
        }
      } else {
        // paste — existing behavior
        if (state.mode === 'monorepo') {
          body = { mode: 'monorepo', repoSource: state.repoSource }
        } else if (state.mode === 'separate') {
          body = { mode: 'separate', backendCode: state.backendCode, frontendCode: state.frontendCode }
        } else {
          body = { mode: 'backend-only', backendCode: state.backendCode }
        }
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'unknown error' }))
        dispatch({ type: 'SET_ERROR', error: (errData as { error?: string }).error ?? 'analysis failed' })
        return
      }

      const result = await res.json() as GapAnalysisResult
      dispatch({ type: 'SET_RESULT', result })
    } catch {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
      dispatch({ type: 'SET_ERROR', error: 'network error — check your connection and try again' })
    }
  }

  const loadingSteps = getLoadingSteps(state.mode, inputMethod)
  const currentStep = loadingSteps[state.loadingStep] ?? loadingSteps[loadingSteps.length - 1]

  const filteredRoutes = (state.result?.routes ?? []).filter((r) => {
    const statusMatch = state.filters.status === 'all' || r.status === state.filters.status
    const methodMatch = state.filters.method === 'all' || r.method === state.filters.method
    return statusMatch && methodMatch
  })

  const modeLabel =
    state.mode === 'monorepo' ? 'MONOREPO MODE'
    : state.mode === 'separate' ? 'SEPARATE MODE'
    : 'BACKEND-ONLY MODE'

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

        {/* Input section — hidden during loading / done */}
        {state.status !== 'loading' && state.status !== 'done' && (
          <div
            className="flex flex-col gap-4 animate-fade-in"
            style={{ animationDelay: '60ms', animationFillMode: 'both' }}
          >
            <ModeSelector
              value={state.mode}
              onChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
            />

            <InputMethodTabs activeMethod={inputMethod} onMethodChange={setInputMethod} />

            {/* Input area — 3×3 matrix */}
            {inputMethod === 'github' && (
              <>
                {state.mode === 'monorepo' && (
                  <GitHubInput
                    value={state.repoGithubUrl}
                    onChange={(v) => dispatch({ type: 'SET_REPO_GITHUB', value: v })}
                  />
                )}
                {state.mode === 'separate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <GitHubInput
                      label="backend"
                      value={state.backendGithubUrl}
                      onChange={(v) => dispatch({ type: 'SET_BACKEND_GITHUB', value: v })}
                    />
                    <GitHubInput
                      label="frontend"
                      value={state.frontendGithubUrl}
                      onChange={(v) => dispatch({ type: 'SET_FRONTEND_GITHUB', value: v })}
                    />
                  </div>
                )}
                {state.mode === 'backend-only' && (
                  <GitHubInput
                    label="backend"
                    value={state.backendGithubUrl}
                    onChange={(v) => dispatch({ type: 'SET_BACKEND_GITHUB', value: v })}
                  />
                )}
              </>
            )}

            {inputMethod === 'folder' && (
              <>
                {state.mode === 'monorepo' && (
                  <FolderDropZone
                    onFilesRead={(c) => setFolderState((s) => ({ ...s, content: c }))}
                    fileCount={folderState.content?.totalFiles}
                    skippedCount={folderState.content?.skippedFiles}
                  />
                )}
                {state.mode === 'separate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FolderDropZone
                      label="backend"
                      onFilesRead={(c) => setFolderState((s) => ({ ...s, backendContent: c }))}
                      fileCount={folderState.backendContent?.totalFiles}
                      skippedCount={folderState.backendContent?.skippedFiles}
                    />
                    <FolderDropZone
                      label="frontend"
                      onFilesRead={(c) => setFolderState((s) => ({ ...s, frontendContent: c }))}
                      fileCount={folderState.frontendContent?.totalFiles}
                      skippedCount={folderState.frontendContent?.skippedFiles}
                    />
                  </div>
                )}
                {state.mode === 'backend-only' && (
                  <FolderDropZone
                    label="backend"
                    onFilesRead={(c) => setFolderState((s) => ({ ...s, backendContent: c }))}
                    fileCount={folderState.backendContent?.totalFiles}
                    skippedCount={folderState.backendContent?.skippedFiles}
                  />
                )}
              </>
            )}

            {inputMethod === 'paste' && (
              <>
                {state.mode === 'monorepo' && (
                  <div className="flex flex-col gap-2">
                    <label
                      className="font-mono text-xs text-fg-secondary lowercase"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      paste your full project (file tree or pasted folders)
                    </label>
                    <textarea
                      value={state.repoSource}
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
                {state.mode === 'separate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label
                        className="font-mono text-xs text-fg-secondary lowercase"
                        style={{ letterSpacing: '0.08em' }}
                      >
                        backend code
                      </label>
                      <textarea
                        value={state.backendCode}
                        onChange={(e) => dispatch({ type: 'SET_BACKEND_CODE', value: e.target.value })}
                        placeholder="Express routes, FastAPI endpoints, Laravel controllers..."
                        rows={14}
                        className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm p-4 resize-y focus:border-border-hover focus:outline-none transition-colors duration-200 placeholder:text-fg-tertiary"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label
                        className="font-mono text-xs text-fg-secondary lowercase"
                        style={{ letterSpacing: '0.08em' }}
                      >
                        frontend code
                      </label>
                      <textarea
                        value={state.frontendCode}
                        onChange={(e) => dispatch({ type: 'SET_FRONTEND_CODE', value: e.target.value })}
                        placeholder="React components, axios calls, fetch()..."
                        rows={14}
                        className="w-full bg-bg-secondary border border-border-default text-fg-primary font-mono text-sm p-4 resize-y focus:border-border-hover focus:outline-none transition-colors duration-200 placeholder:text-fg-tertiary"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                  </div>
                )}
                {state.mode === 'backend-only' && (
                  <div className="flex flex-col gap-2">
                    <label
                      className="font-mono text-xs text-fg-secondary lowercase"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      backend code
                    </label>
                    <textarea
                      value={state.backendCode}
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

            {state.status === 'error' && state.error && (
              <p
                className="font-mono text-sm lowercase"
                style={{ color: '#F87171', letterSpacing: '0.05em' }}
              >
                {state.error}
              </p>
            )}

            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit()}
              className="w-full"
            >
              analyze api gaps →
            </Button>
          </div>
        )}

        {/* Loading state */}
        {state.status === 'loading' && (
          <div
            className="flex flex-col items-center gap-6 py-20 animate-fade-in"
            style={{ animationDelay: '0ms', animationFillMode: 'both' }}
          >
            <Spinner size={32} />
            <p
              key={currentStep}
              className="font-mono text-sm text-fg-secondary lowercase animate-fade-in"
              style={{ letterSpacing: '0.1em' }}
            >
              {currentStep}
            </p>
            <div className="flex gap-1.5 mt-2">
              {loadingSteps.map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 transition-colors duration-300"
                  style={{
                    background: i <= state.loadingStep ? '#FFFFFF' : '#2A2A2A',
                    borderRadius: 0,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Results section */}
        {state.status === 'done' && state.result && (
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
                value={state.viewMode}
                onChange={(viewMode) => dispatch({ type: 'SET_VIEW_MODE', viewMode })}
              />
            </div>

            {/* Metric cards */}
            <div
              className="grid grid-cols-3 gap-px bg-border-default animate-fade-in"
              style={{ animationDelay: '150ms', animationFillMode: 'both' }}
            >
              <MetricCard label="connected" value={state.result.summary.connected} accentColor="#4ADE80" />
              <MetricCard label="orphan" value={state.result.summary.orphan} accentColor="#F87171" />
              <MetricCard label="ghost" value={state.result.summary.ghost} accentColor="#FBBF24" />
            </div>

            {/* Filter bar — flat view only */}
            {state.viewMode === 'flat' && (
              <div
                className="animate-fade-in"
                style={{ animationDelay: '200ms', animationFillMode: 'both' }}
              >
                <FilterBar
                  filters={state.filters}
                  onChange={(filters) => dispatch({ type: 'SET_FILTERS', filters })}
                />
              </div>
            )}

            {/* Count line */}
            <p className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
              {state.viewMode === 'flat'
                ? `showing ${filteredRoutes.length} of ${state.result.routes.length} routes`
                : `${state.result.features.length} feature groups · ${state.result.routes.length} routes total`}
            </p>

            {/* Content area */}
            {state.result.routes.length === 0 ? (
              <div
                className="border border-border-default p-10 text-center animate-fade-in"
                style={{ animationDelay: '250ms', animationFillMode: 'both', borderRadius: 0 }}
              >
                <p className="font-mono text-sm text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
                  no routes detected — check your input and try again
                </p>
              </div>
            ) : state.viewMode === 'flat' ? (
              <div
                className="flex flex-col gap-px bg-border-default animate-fade-in"
                style={{ animationDelay: '250ms', animationFillMode: 'both' }}
              >
                {filteredRoutes.length === 0 ? (
                  <div className="bg-bg-primary border border-border-default p-6 text-center">
                    <p className="font-mono text-sm text-fg-secondary lowercase" style={{ letterSpacing: '0.08em' }}>
                      no routes match the current filters
                    </p>
                  </div>
                ) : (
                  filteredRoutes.map((route) => (
                    <RouteCard key={route.id} route={route} />
                  ))
                )}
              </div>
            ) : (
              <div
                className="flex flex-col gap-2 animate-fade-in"
                style={{ animationDelay: '250ms', animationFillMode: 'both' }}
              >
                {state.result.features.map((feature) => (
                  <FeatureGroup
                    key={feature.id}
                    feature={feature}
                    routes={state.result!.routes}
                  />
                ))}
              </div>
            )}

            {/* Re-analyze button */}
            <Button
              variant="secondary"
              onClick={() => dispatch({ type: 'SET_MODE', mode: state.mode })}
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
