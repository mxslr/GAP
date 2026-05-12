import crypto from 'crypto'
import { SchemaType } from '@google/generative-ai'
import { generateJSON } from '../gemini'
import { prisma } from '../db'
import type { AnalyzedRoute } from '../types'

export interface SnippetResult {
  fetchSnippet: string
  tsTypes: string
  description: string
}

interface GeminiSnippetEntry {
  routeKey: string
  description: string
  fetchSnippet: string
  tsTypes: string
}

interface GeminiSnippetResponse {
  results: GeminiSnippetEntry[]
}

const BATCH_SIZE = 50

// Task 1.1 — cache key
export function cacheKey(method: string, path: string): string {
  return crypto.createHash('sha1').update(`${method.toUpperCase()}:${path}`).digest('hex')
}

// Task 2.1 — cache read
async function getCached(key: string): Promise<SnippetResult | null> {
  const row = await prisma.snippetCache.findUnique({ where: { key } })
  if (!row) return null
  return { fetchSnippet: row.fetchSnippet, tsTypes: row.tsTypes, description: row.description ?? '' }
}

// Task 2.2 — cache write
async function setCached(key: string, data: SnippetResult): Promise<void> {
  await prisma.snippetCache.upsert({
    where: { key },
    update: { fetchSnippet: data.fetchSnippet, tsTypes: data.tsTypes, description: data.description },
    create: { key, fetchSnippet: data.fetchSnippet, tsTypes: data.tsTypes, description: data.description },
  })
}

// Task 3.1 — build batch prompt
export function buildBatchPrompt(routes: AnalyzedRoute[]): string {
  const routeList = routes
    .map((r) => `- ${r.method} ${r.path}`)
    .join('\n')

  return `You are an API documentation assistant. For each API route below, generate:
1. A one-sentence description of what the route does.
2. A TypeScript fetch snippet using axios (primary) AND native fetch (fallback) in one code block separated by the comment "// --- native fetch ---". Use async/await. Include a try/catch block. For POST/PUT/PATCH routes, include a realistic request body example. For routes with path parameters like :id, use a variable (e.g., const userId = 1).
3. TypeScript interfaces (use "interface", NOT "type alias") for request body and response. Use PascalCase naming: {Verb}{Resource}Request for request body, {Verb}{Resource}Response for response. For GET routes without a path-param ID, type the response as an array. For GET routes with :id, type as a single object.

Routes:
${routeList}

Return a JSON object with this exact structure:
{
  "results": [
    {
      "routeKey": "METHOD:/path",
      "description": "One sentence describing the route.",
      "fetchSnippet": "// axios\\nconst result = await axios.get(...)\\n\\n// --- native fetch ---\\nconst res = await fetch(...)",
      "tsTypes": "interface GetUserResponse { id: number; name: string; }"
    }
  ]
}

The routeKey must match exactly: METHOD (uppercase) followed by colon and path, e.g. "GET:/api/users/:id".
AI-generated types — verify against your actual schema.`
}

// Task 3.2 — parse Gemini response
export function parseGeminiResponse(raw: GeminiSnippetResponse): Map<string, SnippetResult> {
  if (!raw || !Array.isArray(raw.results)) {
    throw new Error('Gemini response is missing "results" array')
  }

  const map = new Map<string, SnippetResult>()
  for (const entry of raw.results) {
    if (!entry.routeKey) continue
    map.set(entry.routeKey, {
      fetchSnippet: entry.fetchSnippet ?? '',
      tsTypes: entry.tsTypes ?? '',
      description: entry.description ?? '',
    })
  }
  return map
}

// Task 4.1 — batch generator
export async function generateSnippetsBatch(
  routes: AnalyzedRoute[]
): Promise<Map<string, SnippetResult>> {
  const result = new Map<string, SnippetResult>()

  // Build cache key → route key mapping
  const routeKey = (r: AnalyzedRoute) => `${r.method.toUpperCase()}:${r.path}`

  // Check cache for all routes
  const misses: AnalyzedRoute[] = []
  await Promise.all(
    routes.map(async (r) => {
      const key = cacheKey(r.method, r.path)
      const cached = await getCached(key)
      if (cached) {
        result.set(routeKey(r), cached)
      } else {
        misses.push(r)
      }
    })
  )

  if (misses.length === 0) return result

  // Chunk misses into batches of BATCH_SIZE
  const chunks: AnalyzedRoute[][] = []
  for (let i = 0; i < misses.length; i += BATCH_SIZE) {
    chunks.push(misses.slice(i, i + BATCH_SIZE))
  }

  const geminiSchema = {
    type: SchemaType.OBJECT,
    properties: {
      results: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            routeKey: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            fetchSnippet: { type: SchemaType.STRING },
            tsTypes: { type: SchemaType.STRING },
          },
          required: ['routeKey', 'description', 'fetchSnippet', 'tsTypes'],
        },
      },
    },
    required: ['results'],
  }

  for (const chunk of chunks) {
    const prompt = buildBatchPrompt(chunk)
    let raw: GeminiSnippetResponse
    try {
      raw = await generateJSON<GeminiSnippetResponse>(prompt, geminiSchema)
    } catch (err) {
      const paths = chunk.map((r) => `${r.method} ${r.path}`).join(', ')
      throw new Error(`Gemini failed for routes [${paths}]: ${err instanceof Error ? err.message : String(err)}`)
    }

    const parsed = parseGeminiResponse(raw)

    for (const r of chunk) {
      const rk = routeKey(r)
      const snippet = parsed.get(rk)
      if (!snippet) continue

      result.set(rk, snippet)
      await setCached(cacheKey(r.method, r.path), snippet)
    }
  }

  return result
}

// Task 4.2 — single-route wrapper
export async function generateSnippets(route: AnalyzedRoute): Promise<SnippetResult> {
  const batch = await generateSnippetsBatch([route])
  const rk = `${route.method.toUpperCase()}:${route.path}`
  const result = batch.get(rk)
  if (!result) {
    throw new Error(`generateSnippets: no result returned for ${rk}`)
  }
  return result
}
