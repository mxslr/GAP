import { describe, it, expect } from 'vitest'
import { analyzeGap, buildDocumentedRoutes } from '../lib/analyzer/gap'
import type { BackendRoute, FrontendCall } from '../lib/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function be(method: string, path: string): BackendRoute {
  return { method: method as BackendRoute['method'], path, framework: 'express', rawSnippet: '' }
}

function fe(method: string, path: string): FrontendCall {
  return { method: method as FrontendCall['method'], path, pattern: 'fetch', rawSnippet: '' }
}

// ── analyzeGap ────────────────────────────────────────────────────────────────

describe('analyzeGap', () => {
  it('exact path match → 1 connected, summary correct', () => {
    const result = analyzeGap([be('GET', '/api/users')], [fe('GET', '/api/users')])
    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].status).toBe('connected')
    expect(result.routes[0].detectedIn).toBe('both')
    expect(result.summary).toEqual({ total: 1, connected: 1, orphan: 0, ghost: 0 })
  })

  it('dynamic param :id matches numeric FE segment', () => {
    const result = analyzeGap([be('GET', '/users/:id')], [fe('GET', '/users/42')])
    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].status).toBe('connected')
  })

  it('dynamic param :id matches template literal FE segment', () => {
    const result = analyzeGap([be('GET', '/users/:id')], [fe('GET', '/users/${userId}')])
    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].status).toBe('connected')
  })

  it('FastAPI-style {item_id} matches FE numeric segment', () => {
    const result = analyzeGap([be('GET', '/items/{item_id}')], [fe('GET', '/items/99')])
    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].status).toBe('connected')
  })

  it('trailing slash is ignored (/api/users/ == /api/users)', () => {
    const result = analyzeGap([be('GET', '/api/users/')], [fe('GET', '/api/users')])
    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].status).toBe('connected')
  })

  it('path matching is case insensitive', () => {
    const result = analyzeGap([be('GET', '/API/Users')], [fe('GET', '/api/users')])
    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].status).toBe('connected')
  })

  it('method mismatch → BE is orphan, FE is ghost', () => {
    const result = analyzeGap([be('GET', '/api/users')], [fe('POST', '/api/users')])
    expect(result.routes).toHaveLength(2)
    const orphan = result.routes.find((r) => r.status === 'orphan')
    const ghost = result.routes.find((r) => r.status === 'ghost')
    expect(orphan).toBeDefined()
    expect(orphan?.detectedIn).toBe('backend')
    expect(ghost).toBeDefined()
    expect(ghost?.detectedIn).toBe('frontend')
    expect(result.summary).toEqual({ total: 2, connected: 0, orphan: 1, ghost: 1 })
  })

  it('empty backend → all FE calls become ghost', () => {
    const result = analyzeGap([], [fe('GET', '/api/a'), fe('POST', '/api/b')])
    expect(result.routes).toHaveLength(2)
    expect(result.routes.every((r) => r.status === 'ghost')).toBe(true)
    expect(result.summary.ghost).toBe(2)
    expect(result.summary.orphan).toBe(0)
    expect(result.summary.connected).toBe(0)
  })

  it('empty frontend → all BE routes become orphan', () => {
    const result = analyzeGap([be('GET', '/api/a'), be('DELETE', '/api/b/:id')], [])
    expect(result.routes).toHaveLength(2)
    expect(result.routes.every((r) => r.status === 'orphan')).toBe(true)
    expect(result.summary.orphan).toBe(2)
    expect(result.summary.ghost).toBe(0)
    expect(result.summary.connected).toBe(0)
  })

  it('mixed scenario → correct summary counts', () => {
    const backendRoutes = [
      be('GET', '/api/users'),       // connected
      be('POST', '/api/posts'),      // connected
      be('DELETE', '/api/admin'),    // orphan
    ]
    const frontendCalls = [
      fe('GET', '/api/users'),       // connected
      fe('POST', '/api/posts'),      // connected
      fe('GET', '/api/missing'),     // ghost
    ]
    const result = analyzeGap(backendRoutes, frontendCalls)
    expect(result.summary).toEqual({ total: 4, connected: 2, orphan: 1, ghost: 1 })
  })

  it('features is always []', () => {
    const result = analyzeGap([be('GET', '/api/test')], [fe('GET', '/api/test')])
    expect(result.features).toEqual([])
  })

  it('mode is separate by default', () => {
    const result = analyzeGap([], [])
    expect(result.mode).toBe('separate')
  })

  it('both empty → empty routes and zero summary', () => {
    const result = analyzeGap([], [])
    expect(result.routes).toHaveLength(0)
    expect(result.summary).toEqual({ total: 0, connected: 0, orphan: 0, ghost: 0 })
  })
})

// ── buildDocumentedRoutes ────────────────────────────────────────────────────

describe('buildDocumentedRoutes', () => {
  it('maps all routes to documented status', () => {
    const routes = buildDocumentedRoutes([
      be('GET', '/api/users'),
      be('POST', '/api/posts'),
    ])
    expect(routes).toHaveLength(2)
    expect(routes.every((r) => r.status === 'documented')).toBe(true)
    expect(routes.every((r) => r.detectedIn === 'backend')).toBe(true)
  })

  it('each route has a unique id', () => {
    const routes = buildDocumentedRoutes([be('GET', '/a'), be('GET', '/b')])
    const ids = routes.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('preserves method and path', () => {
    const routes = buildDocumentedRoutes([be('PATCH', '/api/users/:id')])
    expect(routes[0].method).toBe('PATCH')
    expect(routes[0].path).toBe('/api/users/:id')
  })

  it('empty input returns empty array', () => {
    expect(buildDocumentedRoutes([])).toEqual([])
  })
})
