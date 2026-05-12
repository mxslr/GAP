import { randomUUID } from 'crypto'
import { generateJSON } from '../gemini'
import type { AnalyzedRoute, FeatureGroup } from '../types'

interface GeminiFeature {
  name: string
  description: string
  routeIndices: number[]
}

interface GeminiResponse {
  features: GeminiFeature[]
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          routeIndices: { type: 'array', items: { type: 'number' } },
        },
        required: ['name', 'description', 'routeIndices'],
      },
    },
  },
  required: ['features'],
}

function toTitleCase(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
}

function firstMeaningfulSegment(path: string): string {
  const stripped = path.toLowerCase().replace(/^\/api\//, '/')
  const parts = stripped.split('/').filter(Boolean)
  return parts[0] ?? ''
}

function heuristicClassify(routes: AnalyzedRoute[]): {
  features: FeatureGroup[]
  routesWithFeatureId: AnalyzedRoute[]
} {
  const groupMap = new Map<string, { feature: FeatureGroup; updatedRoutes: AnalyzedRoute[] }>()

  for (const route of routes) {
    const segment = firstMeaningfulSegment(route.path)
    const name = segment ? toTitleCase(segment) : 'General'

    if (!groupMap.has(name)) {
      groupMap.set(name, {
        feature: { id: randomUUID(), name, routeIds: [] },
        updatedRoutes: [],
      })
    }

    const group = groupMap.get(name)!
    group.feature.routeIds.push(route.id)
    group.updatedRoutes.push({ ...route, featureId: group.feature.id })
  }

  const features: FeatureGroup[] = []
  const routesWithFeatureId: AnalyzedRoute[] = []

  for (const { feature, updatedRoutes } of Array.from(groupMap.values())) {
    features.push(feature)
    routesWithFeatureId.push(...updatedRoutes)
  }

  return { features, routesWithFeatureId }
}

export async function classifyFeatures(routes: AnalyzedRoute[]): Promise<{
  features: FeatureGroup[]
  routesWithFeatureId: AnalyzedRoute[]
}> {
  if (routes.length <= 2) {
    const featureId = randomUUID()
    const feature: FeatureGroup = {
      id: featureId,
      name: 'API',
      description: 'General API endpoints',
      routeIds: routes.map((r) => r.id),
    }
    return {
      features: [feature],
      routesWithFeatureId: routes.map((r) => ({ ...r, featureId })),
    }
  }

  const routeList = routes.map((r, i) => `[${i}] ${r.method} ${r.path}`).join('\n')
  const prompt = `You are an API documentation assistant. Group the following API routes into semantic features.

Routes:
${routeList}

Instructions:
- Cluster routes by semantic purpose (e.g. Authentication, User Management, Payments)
- Use clear, professional feature names in Title Case
- Write a concise 1-sentence description per feature
- Every route MUST be assigned to EXACTLY ONE feature using its index number
- Generic routes (/health, /version, /status) belong in "System" or "Health"
- Respond with JSON only`

  try {
    const geminiResult = await generateJSON<GeminiResponse>(prompt, RESPONSE_SCHEMA)

    const assignedIndices = new Set<number>()
    const routeFeatureMap = new Map<number, string>()
    const features: FeatureGroup[] = []

    for (const gf of geminiResult.features) {
      const featureId = randomUUID()
      const validIndices = gf.routeIndices.filter(
        (idx) => Number.isInteger(idx) && idx >= 0 && idx < routes.length && !assignedIndices.has(idx)
      )
      for (const idx of validIndices) {
        assignedIndices.add(idx)
        routeFeatureMap.set(idx, featureId)
      }
      features.push({
        id: featureId,
        name: gf.name,
        description: gf.description,
        routeIds: validIndices.map((idx) => routes[idx].id),
      })
    }

    const unassigned = routes
      .map((_, i) => i)
      .filter((i) => !assignedIndices.has(i))

    if (unassigned.length > 0) {
      const generalId = randomUUID()
      features.push({
        id: generalId,
        name: 'General',
        description: 'General API endpoints',
        routeIds: unassigned.map((i) => routes[i].id),
      })
      for (const idx of unassigned) {
        routeFeatureMap.set(idx, generalId)
      }
    }

    const routesWithFeatureId = routes.map((r, i) => ({
      ...r,
      featureId: routeFeatureMap.get(i),
    }))

    return { features, routesWithFeatureId }
  } catch {
    return heuristicClassify(routes)
  }
}
