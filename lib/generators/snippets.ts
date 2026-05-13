import crypto from 'crypto'
import { generateJSON } from '../ai-provider'
import { GROQ_MODELS } from '../groq'
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

const BATCH_SIZE = 5

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

// Task 3.0 — default snippet when AI is unavailable
function defaultSnippet(route: AnalyzedRoute): GeminiSnippetEntry {
  const safePath = route.path.replace(/[/:]/g, '_').replace(/^_+/, '')
  const resourceName = safePath.charAt(0).toUpperCase() + safePath.slice(1)
  const verb = route.method.charAt(0).toUpperCase() + route.method.slice(1).toLowerCase()
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase())
  const bodyArg = hasBody ? `, { method: '${route.method}', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }` : ''
  return {
    routeKey: `${route.method.toUpperCase()}:${route.path}`,
    description: `${verb} endpoint at ${route.path}`,
    fetchSnippet: `const res = await fetch('${route.path}'${bodyArg});\\nconst data = await res.json();`,
    tsTypes: `interface ${verb}${resourceName}Response { id: string; }`,
  }
}

// Task 3.1 — build batch prompt
export function buildBatchPrompt(routes: AnalyzedRoute[]): string {
  const routeList = routes.map((r) => `${r.method} ${r.path}`).join('\n')

  return `You are an API documentation generator. Analyze these routes and generate fetch snippets and TypeScript types.

CRITICAL JSON RULES:
- Return ONLY a valid JSON object, no markdown, no explanation
- All string values must use \\n for newlines (never actual newlines inside strings)
- Escape all double quotes inside strings as \\"
- Never use backticks inside JSON string values

Routes to document:
${routeList}

Return this exact JSON structure:
{
  "results": [
    {
      "routeKey": "METHOD:/path",
      "description": "One sentence description",
      "fetchSnippet": "const res = await fetch('/path', { method: 'METHOD' });\\nconst data = await res.json();",
      "tsTypes": "interface MethodPathResponse { id: string; name: string; }"
    }
  ]
}

Rules:
- routeKey must be METHOD:/path exactly (e.g. "GET:/api/users/:id")
- fetchSnippet: max 3 lines, use \\n as separator, no backticks
- tsTypes: max 1 interface with max 4 fields, no backticks`
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
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            routeKey: { type: 'string' },
            description: { type: 'string' },
            fetchSnippet: { type: 'string' },
            tsTypes: { type: 'string' },
          },
          required: ['routeKey', 'description', 'fetchSnippet', 'tsTypes'],
        },
      },
    },
    required: ['results'],
  }

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx]
    const prompt = buildBatchPrompt(chunk)
    let parsed: Map<string, SnippetResult>

    try {
      const raw = await generateJSON<GeminiSnippetResponse>(prompt, geminiSchema, GROQ_MODELS.fast)
      parsed = parseGeminiResponse(raw)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isQuota = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')
      console.warn(`[snippets] batch ${chunkIdx + 1}/${chunks.length} failed (${isQuota ? 'quota' : 'parse error'}), using defaults`)
      // Use default snippets for this batch instead of failing
      parsed = new Map(chunk.map((r) => {
        const entry = defaultSnippet(r)
        return [entry.routeKey, { fetchSnippet: entry.fetchSnippet, tsTypes: entry.tsTypes, description: entry.description }]
      }))
    }

    console.log(`[snippets] batch ${chunkIdx + 1}/${chunks.length} complete`)

    for (const r of chunk) {
      const rk = routeKey(r)
      const snippet = parsed.get(rk)
      if (!snippet) {
        // Route key not found — use default
        const entry = defaultSnippet(r)
        const def = { fetchSnippet: entry.fetchSnippet, tsTypes: entry.tsTypes, description: entry.description }
        result.set(rk, def)
        await setCached(cacheKey(r.method, r.path), def)
        continue
      }

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
