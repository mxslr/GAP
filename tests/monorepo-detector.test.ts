import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectMonorepoLayout,
  detectAppsWrapper,
  parseTextTree,
} from '../lib/repo/monorepo-detector'
import type { FileTreeEntry } from '../lib/types'

// Mock lib/gemini.ts so tests never hit the network
vi.mock('../lib/gemini', () => ({
  generateJSON: vi.fn(),
}))

import { generateJSON } from '../lib/gemini'
const mockGenerateJSON = vi.mocked(generateJSON)

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Scenario 1: Express + React (separate folders) ────────────────────────

describe('Express + React monorepo (separate server/ and client/)', () => {
  const entries: FileTreeEntry[] = [
    { path: 'server', type: 'dir' },
    { path: 'server/index.js', type: 'file' },
    { path: 'server/routes', type: 'dir' },
    { path: 'client', type: 'dir' },
    { path: 'client/src', type: 'dir' },
    { path: 'client/package.json', type: 'file', content: JSON.stringify({ dependencies: { react: '^18.0.0' } }) },
    { path: 'README.md', type: 'file' },
  ]

  it('detects server/ as backend and client/ as frontend', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.backendPaths).toContain('server/')
    expect(result.frontendPaths).toContain('client/')
  })

  it('returns high confidence because of indicator file (package.json with react)', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.confidence).toBe('high')
  })

  it('does not call Gemini when heuristics are clear', async () => {
    await detectMonorepoLayout(entries)
    expect(mockGenerateJSON).not.toHaveBeenCalled()
  })
})

// ── Scenario 2: Next.js full-stack (single folder) ───────────────────────

describe('Next.js full-stack monolith', () => {
  const entries: FileTreeEntry[] = [
    { path: 'package.json', type: 'file', content: JSON.stringify({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }) },
    { path: 'app', type: 'dir' },
    { path: 'app/page.tsx', type: 'file' },
    { path: 'app/api', type: 'dir' },
    { path: 'app/api/users/route.ts', type: 'file' },
    { path: 'public', type: 'dir' },
  ]

  it('returns / for both backendPaths and frontendPaths', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.backendPaths).toContain('/')
    expect(result.frontendPaths).toContain('/')
  })

  it('returns high confidence for Next.js full-stack', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.confidence).toBe('high')
  })

  it('does not call Gemini for Next.js detection', async () => {
    await detectMonorepoLayout(entries)
    expect(mockGenerateJSON).not.toHaveBeenCalled()
  })
})

// ── Scenario 3: NestJS + Vue (separate backend/ and frontend/) ───────────

describe('NestJS + Vue (backend/ and frontend/ with indicator files)', () => {
  const entries: FileTreeEntry[] = [
    { path: 'backend', type: 'dir' },
    { path: 'backend/package.json', type: 'file', content: JSON.stringify({ dependencies: { '@nestjs/core': '^10.0.0' } }) },
    { path: 'backend/src', type: 'dir' },
    { path: 'frontend', type: 'dir' },
    { path: 'frontend/package.json', type: 'file', content: JSON.stringify({ dependencies: { vue: '^3.0.0' } }) },
    { path: 'frontend/src', type: 'dir' },
    { path: 'docker-compose.yml', type: 'file' },
  ]

  it('detects backend/ as backend', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.backendPaths).toContain('backend/')
  })

  it('detects frontend/ as frontend', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.frontendPaths).toContain('frontend/')
  })

  it('returns high confidence from package.json indicator files', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.confidence).toBe('high')
  })
})

// ── Scenario 4: FastAPI + React (Nx layout) ──────────────────────────────

describe('FastAPI + React in Nx layout (apps/ wrapper)', () => {
  const entries: FileTreeEntry[] = [
    { path: 'apps', type: 'dir' },
    { path: 'apps/api', type: 'dir' },
    { path: 'apps/api/requirements.txt', type: 'file' },
    { path: 'apps/api/main.py', type: 'file' },
    { path: 'apps/web', type: 'dir' },
    { path: 'apps/web/package.json', type: 'file', content: JSON.stringify({ dependencies: { react: '^18.0.0' } }) },
    { path: 'apps/web/src', type: 'dir' },
    { path: 'nx.json', type: 'file' },
    { path: 'package.json', type: 'file', content: JSON.stringify({ devDependencies: { nx: '^17.0.0' } }) },
  ]

  it('unwraps the apps/ wrapper and classifies children', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.backendPaths.some((p) => p.includes('api'))).toBe(true)
    expect(result.frontendPaths.some((p) => p.includes('web'))).toBe(true)
  })

  it('does not include apps/ itself in the paths', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.backendPaths).not.toContain('apps/')
    expect(result.frontendPaths).not.toContain('apps/')
  })
})

// ── Scenario 5: Laravel + Inertia ────────────────────────────────────────

describe('Laravel + Inertia (composer.json at root, resources/js as frontend)', () => {
  const entries: FileTreeEntry[] = [
    { path: 'composer.json', type: 'file' },
    { path: 'artisan', type: 'file' },
    { path: 'app', type: 'dir' },
    { path: 'app/Http', type: 'dir' },
    { path: 'routes', type: 'dir' },
    { path: 'routes/web.php', type: 'file' },
    { path: 'resources', type: 'dir' },
    { path: 'resources/js', type: 'dir' },
    { path: 'resources/js/app.js', type: 'file' },
    { path: 'public', type: 'dir' },
  ]

  it('detects root / as backend via composer.json indicator', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.backendPaths).toContain('/')
  })

  it('returns a result without calling Gemini', async () => {
    await detectMonorepoLayout(entries)
    expect(mockGenerateJSON).not.toHaveBeenCalled()
  })
})

// ── Scenario 6: Ambiguous layout → LLM fallback ──────────────────────────

describe('Ambiguous layout with no standard names or indicator files', () => {
  const entries: FileTreeEntry[] = [
    { path: 'nucleus', type: 'dir' },
    { path: 'nucleus/main.ts', type: 'file' },
    { path: 'canvas', type: 'dir' },
    { path: 'canvas/index.ts', type: 'file' },
    { path: 'bridge', type: 'dir' },
    { path: 'README.md', type: 'file' },
  ]

  beforeEach(() => {
    mockGenerateJSON.mockResolvedValue({
      folders: [
        { name: 'nucleus', role: 'backend', reasoning: 'Contains server-side business logic' },
        { name: 'canvas', role: 'frontend', reasoning: 'Appears to be a UI layer' },
        { name: 'bridge', role: 'shared', reasoning: 'Shared utilities' },
      ],
    })
  })

  it('calls Gemini as LLM fallback', async () => {
    await detectMonorepoLayout(entries)
    expect(mockGenerateJSON).toHaveBeenCalledOnce()
  })

  it('returns medium confidence from LLM result', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.confidence).toBe('medium')
  })

  it('correctly maps LLM backend and frontend classifications', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.backendPaths).toContain('nucleus/')
    expect(result.frontendPaths).toContain('canvas/')
  })

  it('includes reasoning string from LLM', async () => {
    const result = await detectMonorepoLayout(entries)
    expect(result.reasoning).toBeDefined()
    expect(result.reasoning?.length).toBeGreaterThan(0)
  })
})

// ── parseTextTree unit tests ──────────────────────────────────────────────

describe('parseTextTree', () => {
  it('parses Unix tree command output', () => {
    const raw = `├── server
│   └── index.js
└── client
    └── src`
    const entries = parseTextTree(raw)
    expect(entries.some((e) => e.path === 'server' && e.type === 'dir')).toBe(true)
    expect(entries.some((e) => e.path === 'index.js' && e.type === 'file')).toBe(true)
    expect(entries.some((e) => e.path === 'client' && e.type === 'dir')).toBe(true)
  })

  it('parses plain indented text', () => {
    const raw = `server\n  routes\n  index.js\nclient\n  src`
    const entries = parseTextTree(raw)
    expect(entries.some((e) => e.path === 'server')).toBe(true)
    expect(entries.some((e) => e.path === 'client')).toBe(true)
  })
})

// ── detectAppsWrapper unit tests ─────────────────────────────────────────

describe('detectAppsWrapper', () => {
  it('returns children of apps/ wrapper', () => {
    const entries: FileTreeEntry[] = [
      { path: 'apps', type: 'dir' },
      { path: 'apps/api', type: 'dir' },
      { path: 'apps/web', type: 'dir' },
    ]
    const result = detectAppsWrapper(entries)
    expect(result.some((e) => e.path === 'apps/api')).toBe(true)
    expect(result.some((e) => e.path === 'apps/web')).toBe(true)
  })

  it('returns original entries when no wrapper exists', () => {
    const entries: FileTreeEntry[] = [
      { path: 'server', type: 'dir' },
      { path: 'client', type: 'dir' },
    ]
    const result = detectAppsWrapper(entries)
    expect(result).toBe(entries)
  })
})
