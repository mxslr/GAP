import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/gemini', () => ({
  generateJSON: vi.fn(),
}))

import { classifyFeatures } from '../lib/analyzer/feature-classifier'
import { generateJSON } from '../lib/gemini'
import type { AnalyzedRoute } from '../lib/types'

const mockGenerateJSON = vi.mocked(generateJSON)

function route(id: string, method: string, path: string): AnalyzedRoute {
  return {
    id,
    method: method as AnalyzedRoute['method'],
    path,
    status: 'orphan',
    detectedIn: 'backend',
  }
}

describe('classifyFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('10 routes across auth/users/posts → 3 features, all routes assigned with featureId', async () => {
    const routes = [
      route('r0', 'POST', '/api/auth/login'),
      route('r1', 'POST', '/api/auth/register'),
      route('r2', 'POST', '/api/auth/logout'),
      route('r3', 'GET', '/api/auth/me'),
      route('r4', 'GET', '/api/users'),
      route('r5', 'GET', '/api/users/:id'),
      route('r6', 'PATCH', '/api/users/:id'),
      route('r7', 'DELETE', '/api/users/:id'),
      route('r8', 'GET', '/api/posts'),
      route('r9', 'POST', '/api/posts'),
    ]

    mockGenerateJSON.mockResolvedValueOnce({
      features: [
        { name: 'Authentication', description: 'Auth endpoints', routeIndices: [0, 1, 2, 3] },
        { name: 'User Management', description: 'User endpoints', routeIndices: [4, 5, 6, 7] },
        { name: 'Posts', description: 'Post endpoints', routeIndices: [8, 9] },
      ],
    })

    const { features, routesWithFeatureId } = await classifyFeatures(routes)

    expect(features).toHaveLength(3)
    expect(features.map((f) => f.name)).toEqual(
      expect.arrayContaining(['Authentication', 'User Management', 'Posts'])
    )
    expect(routesWithFeatureId).toHaveLength(10)
    expect(routesWithFeatureId.every((r) => r.featureId !== undefined)).toBe(true)

    const allRouteIds = features.flatMap((f) => f.routeIds)
    expect(new Set(allRouteIds).size).toBe(10)
  })

  it('each feature has a valid UUID id', async () => {
    const routes = Array.from({ length: 4 }, (_, i) =>
      route(`r${i}`, 'GET', `/api/resource${i}`)
    )
    mockGenerateJSON.mockResolvedValueOnce({
      features: [
        { name: 'Resources', description: 'Resource endpoints', routeIndices: [0, 1, 2, 3] },
      ],
    })

    const { features } = await classifyFeatures(routes)

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    for (const f of features) {
      expect(f.id).toMatch(uuidRegex)
    }
  })

  it('2 routes → 1 feature named "API", no Gemini call made', async () => {
    const routes = [route('r0', 'GET', '/api/users'), route('r1', 'POST', '/api/users')]

    const { features, routesWithFeatureId } = await classifyFeatures(routes)

    expect(features).toHaveLength(1)
    expect(features[0].name).toBe('API')
    expect(routesWithFeatureId).toHaveLength(2)
    expect(routesWithFeatureId.every((r) => r.featureId === features[0].id)).toBe(true)
    expect(mockGenerateJSON).not.toHaveBeenCalled()
  })

  it('0 routes → 1 "API" feature with empty routeIds, no Gemini call', async () => {
    const { features, routesWithFeatureId } = await classifyFeatures([])

    expect(features).toHaveLength(1)
    expect(features[0].name).toBe('API')
    expect(features[0].routeIds).toHaveLength(0)
    expect(routesWithFeatureId).toHaveLength(0)
    expect(mockGenerateJSON).not.toHaveBeenCalled()
  })

  it('Gemini failure falls back to heuristic path-segment grouping without throwing', async () => {
    const routes = [
      route('r0', 'POST', '/api/auth/login'),
      route('r1', 'POST', '/api/auth/register'),
      route('r2', 'GET', '/api/users'),
      route('r3', 'GET', '/api/users/:id'),
      route('r4', 'PATCH', '/api/users/:id'),
    ]

    mockGenerateJSON.mockRejectedValueOnce(new Error('Gemini unavailable'))

    const { features, routesWithFeatureId } = await classifyFeatures(routes)

    const authFeature = features.find((f) => f.name === 'Auth')
    const usersFeature = features.find((f) => f.name === 'Users')

    expect(authFeature).toBeDefined()
    expect(usersFeature).toBeDefined()
    expect(authFeature!.routeIds).toContain('r0')
    expect(authFeature!.routeIds).toContain('r1')
    expect(usersFeature!.routeIds).toContain('r2')
    expect(routesWithFeatureId.every((r) => r.featureId !== undefined)).toBe(true)
  })

  it('heuristic fallback: /api/auth/* routes become "Auth" feature', async () => {
    const routes = [
      route('r0', 'POST', '/api/auth/login'),
      route('r1', 'GET', '/api/auth/me'),
      route('r2', 'POST', '/api/auth/logout'),
      route('r3', 'GET', '/api/users'),
      route('r4', 'POST', '/api/users'),
    ]

    mockGenerateJSON.mockRejectedValueOnce(new Error('rate limit'))

    const { features } = await classifyFeatures(routes)

    const authFeature = features.find((f) => f.name === 'Auth')
    expect(authFeature).toBeDefined()
    expect(authFeature!.routeIds).toEqual(expect.arrayContaining(['r0', 'r1', 'r2']))
  })

  it('heuristic fallback: route with path "/" goes to "General" feature', async () => {
    const routes = [
      route('r0', 'GET', '/api/users'),
      route('r1', 'GET', '/api/posts'),
      route('r2', 'GET', '/api/comments'),
      route('r3', 'GET', '/'),
    ]

    mockGenerateJSON.mockRejectedValueOnce(new Error('error'))

    const { features } = await classifyFeatures(routes)

    const general = features.find((f) => f.name === 'General')
    expect(general).toBeDefined()
    expect(general!.routeIds).toContain('r3')
  })

  it('out-of-bounds routeIndex is silently ignored, no error thrown', async () => {
    const routes = [
      route('r0', 'GET', '/api/a'),
      route('r1', 'GET', '/api/b'),
      route('r2', 'GET', '/api/c'),
      route('r3', 'GET', '/api/d'),
      route('r4', 'GET', '/api/e'),
    ]

    mockGenerateJSON.mockResolvedValueOnce({
      features: [
        { name: 'Feature A', description: 'A', routeIndices: [0, 1, 99] },
        { name: 'Feature B', description: 'B', routeIndices: [2, 3, 4] },
      ],
    })

    const { features } = await classifyFeatures(routes)

    const featureA = features.find((f) => f.name === 'Feature A')!
    expect(featureA.routeIds).toHaveLength(2)
    expect(featureA.routeIds).toContain('r0')
    expect(featureA.routeIds).toContain('r1')
  })

  it('duplicate routeIndex: first-assignment wins', async () => {
    const routes = [
      route('r0', 'GET', '/api/a'),
      route('r1', 'GET', '/api/b'),
      route('r2', 'GET', '/api/c'),
      route('r3', 'GET', '/api/d'),
      route('r4', 'GET', '/api/e'),
    ]

    mockGenerateJSON.mockResolvedValueOnce({
      features: [
        { name: 'First', description: 'A', routeIndices: [0, 1, 2] },
        { name: 'Second', description: 'B', routeIndices: [2, 3, 4] },
      ],
    })

    const { features } = await classifyFeatures(routes)

    const first = features.find((f) => f.name === 'First')!
    const second = features.find((f) => f.name === 'Second')!
    expect(first.routeIds).toContain('r2')
    expect(second.routeIds).not.toContain('r2')
  })

  it('unassigned routes from Gemini end up in "General" feature', async () => {
    const routes = [
      route('r0', 'GET', '/api/a'),
      route('r1', 'GET', '/api/b'),
      route('r2', 'GET', '/api/c'),
      route('r3', 'GET', '/api/d'),
      route('r4', 'GET', '/api/e'),
    ]

    mockGenerateJSON.mockResolvedValueOnce({
      features: [
        { name: 'Feature', description: 'A', routeIndices: [0, 1, 2] },
      ],
    })

    const { features, routesWithFeatureId } = await classifyFeatures(routes)

    const general = features.find((f) => f.name === 'General')
    expect(general).toBeDefined()
    expect(general!.routeIds).toContain('r3')
    expect(general!.routeIds).toContain('r4')
    expect(routesWithFeatureId.every((r) => r.featureId !== undefined)).toBe(true)
  })
})
