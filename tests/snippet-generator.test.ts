import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/gemini', () => ({
  generateJSON: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  prisma: {
    snippetCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import {
  generateSnippets,
  generateSnippetsBatch,
  cacheKey,
  buildBatchPrompt,
  parseGeminiResponse,
  type SnippetResult,
} from '../lib/generators/snippets'
import { generateJSON } from '../lib/gemini'
import { prisma } from '../lib/db'
import type { AnalyzedRoute } from '../lib/types'

const mockGenerateJSON = vi.mocked(generateJSON)
const mockFindUnique = vi.mocked(prisma.snippetCache.findUnique)
const mockUpsert = vi.mocked(prisma.snippetCache.upsert)

function route(id: string, method: string, path: string): AnalyzedRoute {
  return {
    id,
    method: method as AnalyzedRoute['method'],
    path,
    status: 'orphan',
    detectedIn: 'backend',
  }
}

function cachedRow(snippet: SnippetResult) {
  return {
    key: 'any',
    fetchSnippet: snippet.fetchSnippet,
    tsTypes: snippet.tsTypes,
    description: snippet.description,
    createdAt: new Date(),
  }
}

function geminiResponse(routes: AnalyzedRoute[], overrides: Partial<SnippetResult> = {}) {
  return {
    results: routes.map((r) => ({
      routeKey: `${r.method.toUpperCase()}:${r.path}`,
      description: overrides.description ?? `Does ${r.method} ${r.path}`,
      fetchSnippet:
        overrides.fetchSnippet ??
        `// axios\nconst res = await axios.get('${r.path}')\n\n// --- native fetch ---\nconst res2 = await fetch('${r.path}')`,
      tsTypes: overrides.tsTypes ?? `interface Response { id: number }`,
    })),
  }
}

describe('cacheKey', () => {
  it('produces the same key for the same method+path', () => {
    const k1 = cacheKey('GET', '/api/users/:id')
    const k2 = cacheKey('GET', '/api/users/:id')
    expect(k1).toBe(k2)
  })

  it('produces different keys for different methods', () => {
    expect(cacheKey('GET', '/api/users')).not.toBe(cacheKey('POST', '/api/users'))
  })

  it('is a 40-char hex string (SHA-1)', () => {
    expect(cacheKey('DELETE', '/api/posts/:id')).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('generateSnippets', () => {
  beforeEach(() => vi.clearAllMocks())

  // Task 6.1 — cache hit returns cached data without calling Gemini
  it('cache hit — returns cached data without calling Gemini', async () => {
    const r = route('r1', 'GET', '/api/users/:id')
    const cached: SnippetResult = {
      fetchSnippet: 'cached snippet',
      tsTypes: 'cached types',
      description: 'cached description',
    }
    mockFindUnique.mockResolvedValue(cachedRow(cached))

    const result = await generateSnippets(r)

    expect(result).toEqual(cached)
    expect(mockGenerateJSON).not.toHaveBeenCalled()
  })

  // Task 6.2 — cache miss calls Gemini, populates cache, returns result
  it('cache miss — calls Gemini, stores in cache, returns result', async () => {
    const r = route('r2', 'POST', '/api/users')
    mockFindUnique.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({} as never)
    mockGenerateJSON.mockResolvedValueOnce(geminiResponse([r]))

    const result = await generateSnippets(r)

    expect(mockGenerateJSON).toHaveBeenCalledOnce()
    expect(mockUpsert).toHaveBeenCalledOnce()
    expect(result.description).toBe(`Does POST /api/users`)
    expect(result.fetchSnippet).toContain('// --- native fetch ---')
  })

  // Task 6.6 — Gemini returns malformed JSON → throws descriptive error
  it('Gemini error — throws descriptive error identifying the route', async () => {
    const r = route('r3', 'DELETE', '/api/posts/:id')
    mockFindUnique.mockResolvedValue(null)
    mockGenerateJSON.mockRejectedValueOnce(new Error('500 Internal Server Error'))

    await expect(generateSnippets(r)).rejects.toThrow('DELETE /api/posts/:id')
  })
})

describe('generateSnippetsBatch', () => {
  beforeEach(() => vi.clearAllMocks())

  // Task 6.3 — partial cache: only uncached routes sent to Gemini
  it('partial cache — only uncached routes sent to Gemini', async () => {
    const r1 = route('r1', 'GET', '/api/users')
    const r2 = route('r2', 'POST', '/api/posts')
    const cached: SnippetResult = {
      fetchSnippet: 'cached',
      tsTypes: 'cached types',
      description: 'cached',
    }

    mockFindUnique
      .mockResolvedValueOnce(cachedRow(cached))  // r1 is cached
      .mockResolvedValueOnce(null)                // r2 is a miss

    mockUpsert.mockResolvedValue({} as never)
    mockGenerateJSON.mockResolvedValueOnce(geminiResponse([r2]))

    const result = await generateSnippetsBatch([r1, r2])

    expect(mockGenerateJSON).toHaveBeenCalledOnce()
    // Gemini prompt should only include r2
    const promptArg = mockGenerateJSON.mock.calls[0][0] as string
    expect(promptArg).toContain('POST /api/posts')
    expect(promptArg).not.toContain('GET /api/users')

    expect(result.get('GET:/api/users')).toEqual(cached)
    expect(result.get('POST:/api/posts')?.description).toBe('Does POST /api/posts')
  })

  it('all routes cached — no Gemini call', async () => {
    const r1 = route('r1', 'GET', '/api/users')
    const r2 = route('r2', 'GET', '/api/posts')
    const cached: SnippetResult = { fetchSnippet: 'c', tsTypes: 't', description: 'd' }

    mockFindUnique.mockResolvedValue(cachedRow(cached))

    const result = await generateSnippetsBatch([r1, r2])

    expect(mockGenerateJSON).not.toHaveBeenCalled()
    expect(result.size).toBe(2)
  })

  // Task 6.4 — batch > 50 routes chunks into multiple Gemini calls
  it('batch > 50 uncached routes — chunks into multiple Gemini calls', async () => {
    const routes = Array.from({ length: 55 }, (_, i) =>
      route(`r${i}`, 'GET', `/api/resource${i}`)
    )

    mockFindUnique.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({} as never)

    // First call: 50 routes
    mockGenerateJSON.mockResolvedValueOnce(geminiResponse(routes.slice(0, 50)))
    // Second call: 5 routes
    mockGenerateJSON.mockResolvedValueOnce(geminiResponse(routes.slice(50)))

    const result = await generateSnippetsBatch(routes)

    expect(mockGenerateJSON).toHaveBeenCalledTimes(2)
    expect(result.size).toBe(55)
  })

  // Task 6.5 — generateSnippets delegates to generateSnippetsBatch
  it('generateSnippets delegates to generateSnippetsBatch — returns single result', async () => {
    const r = route('r1', 'GET', '/api/users/:id')
    mockFindUnique.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({} as never)
    mockGenerateJSON.mockResolvedValueOnce(geminiResponse([r]))

    const result = await generateSnippets(r)

    // generateSnippets wraps generateSnippetsBatch — same Gemini call
    expect(mockGenerateJSON).toHaveBeenCalledOnce()
    expect(result).toHaveProperty('fetchSnippet')
    expect(result).toHaveProperty('tsTypes')
    expect(result).toHaveProperty('description')
  })

  it('all Gemini results are stored in cache', async () => {
    const routes = [route('r1', 'GET', '/api/a'), route('r2', 'POST', '/api/b')]
    mockFindUnique.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({} as never)
    mockGenerateJSON.mockResolvedValueOnce(geminiResponse(routes))

    await generateSnippetsBatch(routes)

    expect(mockUpsert).toHaveBeenCalledTimes(2)
  })
})

describe('buildBatchPrompt', () => {
  it('includes all route method+path pairs in the prompt', () => {
    const routes = [route('r1', 'GET', '/api/users'), route('r2', 'POST', '/api/posts')]
    const prompt = buildBatchPrompt(routes)
    expect(prompt).toContain('GET /api/users')
    expect(prompt).toContain('POST /api/posts')
  })

  // Task 6.7 — POST route snippet: prompt instructs body example
  it('prompt instructs body example for POST/PUT/PATCH routes', () => {
    const routes = [route('r1', 'POST', '/api/users')]
    const prompt = buildBatchPrompt(routes)
    expect(prompt.toLowerCase()).toContain('request body')
  })

  // Task 6.8 — GET with :id: prompt instructs variable usage
  it('prompt instructs variable usage for path params', () => {
    const routes = [route('r1', 'GET', '/api/users/:id')]
    const prompt = buildBatchPrompt(routes)
    expect(prompt.toLowerCase()).toContain('path param')
  })
})

describe('parseGeminiResponse', () => {
  it('maps results by routeKey', () => {
    const raw = {
      results: [
        {
          routeKey: 'GET:/api/users',
          description: 'Gets users',
          fetchSnippet: 'axios snippet',
          tsTypes: 'interface T {}',
        },
      ],
    }
    const map = parseGeminiResponse(raw)
    expect(map.get('GET:/api/users')).toEqual({
      fetchSnippet: 'axios snippet',
      tsTypes: 'interface T {}',
      description: 'Gets users',
    })
  })

  it('throws if results field is missing', () => {
    expect(() => parseGeminiResponse({ results: null as never })).toThrow('"results" array')
  })

  it('skips entries missing a routeKey', () => {
    const raw = {
      results: [
        { routeKey: '', description: 'x', fetchSnippet: 'x', tsTypes: 'x' },
        { routeKey: 'GET:/api/ok', description: 'ok', fetchSnippet: 'ok', tsTypes: 'ok' },
      ],
    }
    const map = parseGeminiResponse(raw)
    expect(map.size).toBe(1)
    expect(map.has('GET:/api/ok')).toBe(true)
  })
})
