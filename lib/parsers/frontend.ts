import { generateJSON } from '../gemini'
import type { FrontendCall, HttpMethod, FrontendPattern } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeMethod(m: string): HttpMethod {
  return m.toUpperCase() as HttpMethod
}

function normalizePath(raw: string): { path: string; isDynamic: boolean } {
  let idx = 0
  let isDynamic = false
  const normalized = raw.replace(/\$\{[^}]*\}/g, () => {
    isDynamic = true
    return `:param${idx++}`
  })
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`
  return { path, isDynamic }
}

function rawSnippetAt(code: string, matchIndex: number): string {
  const lineStart = code.lastIndexOf('\n', matchIndex) + 1
  const lineEnd = code.indexOf('\n', matchIndex)
  return code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
}

function deduplicate(calls: FrontendCall[]): FrontendCall[] {
  const seen = new Map<string, FrontendCall>()
  for (const call of calls) {
    const key = `${call.method}:${call.path}`
    if (!seen.has(key)) seen.set(key, call)
  }
  return Array.from(seen.values())
}

// ─── React Query parser ───────────────────────────────────────────────────────
// Runs first so react-query pattern wins dedup over inner fetch/axios calls.

const HOOK_RE = /\b(useQuery|useMutation)\s*\(/gi

function parseReactQuery(code: string): FrontendCall[] {
  const calls: FrontendCall[] = []
  let match: RegExpExecArray | null
  HOOK_RE.lastIndex = 0

  while ((match = HOOK_RE.exec(code)) !== null) {
    const lookahead = code.slice(match.index, match.index + 600)

    // Try axios / axios-instance inside hook first
    const axiosInner = /\b(?:axios|api)\.(get|post|put|delete|patch)\s*\(\s*(?:(['"])([^'"]{1,200})\2|`([^`]{1,200})`)/.exec(lookahead)
    if (axiosInner) {
      const rawUrl = axiosInner[3] ?? axiosInner[4] ?? ''
      if (rawUrl) {
        const { path, isDynamic } = normalizePath(rawUrl)
        calls.push({
          method: normalizeMethod(axiosInner[1]),
          path,
          pattern: 'react-query',
          rawSnippet: rawSnippetAt(code, match.index),
          isDynamic: isDynamic || undefined,
        })
        continue
      }
    }

    // Try fetch inside hook
    const fetchInner = /\bfetch\s*\(\s*(?:(['"])([^'"]{1,200})\1|`([^`]{1,200})`)([^)]{0,300})/.exec(lookahead)
    if (fetchInner) {
      const rawUrl = fetchInner[2] ?? fetchInner[3] ?? ''
      if (rawUrl) {
        const { path, isDynamic } = normalizePath(rawUrl)
        const methodMatch = /method\s*:\s*['"](\w+)['"]/.exec(fetchInner[4] ?? '')
        const method: HttpMethod = methodMatch ? normalizeMethod(methodMatch[1]) : 'GET'
        calls.push({
          method,
          path,
          pattern: 'react-query',
          rawSnippet: rawSnippetAt(code, match.index),
          isDynamic: isDynamic || undefined,
        })
      }
    }
  }

  return calls
}

// ─── Axios parser ─────────────────────────────────────────────────────────────
// Matches axios.METHOD('url') and named axios instances: api.METHOD('url').
// Word boundary + exact names ensure apiClient.get does NOT match here.

const AXIOS_RE = /\b(axios|api)\.(get|post|put|delete|patch)\s*\(\s*(?:(['"])([^'"]{1,300})\3|`([^`]{1,300})`)/gi

function parseAxios(code: string): FrontendCall[] {
  const calls: FrontendCall[] = []
  let match: RegExpExecArray | null
  AXIOS_RE.lastIndex = 0
  while ((match = AXIOS_RE.exec(code)) !== null) {
    const rawUrl = match[4] ?? match[5] ?? ''
    if (!rawUrl) continue
    const { path, isDynamic } = normalizePath(rawUrl)
    calls.push({
      method: normalizeMethod(match[2]),
      path,
      pattern: 'axios',
      rawSnippet: rawSnippetAt(code, match.index),
      isDynamic: isDynamic || undefined,
    })
  }
  return calls
}

// ─── Fetch parser ─────────────────────────────────────────────────────────────
// Matches fetch(url) and fetch(url, { method: 'METHOD' }). Defaults to GET.

const FETCH_START_RE = /\bfetch\s*\(/gi

function parseFetch(code: string): FrontendCall[] {
  const calls: FrontendCall[] = []
  let match: RegExpExecArray | null
  FETCH_START_RE.lastIndex = 0
  while ((match = FETCH_START_RE.exec(code)) !== null) {
    const afterParen = code.slice(match.index + match[0].length, match.index + match[0].length + 600)
    const urlMatch = /^\s*(?:(['"])([^'"]{1,300})\1|`([^`]{1,300})`)/.exec(afterParen)
    if (!urlMatch) continue
    const rawUrl = urlMatch[2] ?? urlMatch[3] ?? ''
    if (!rawUrl) continue
    const { path, isDynamic } = normalizePath(rawUrl)
    const rest = afterParen.slice(urlMatch[0].length)
    const methodMatch = /method\s*:\s*['"](\w+)['"]/.exec(rest)
    const method: HttpMethod = methodMatch ? normalizeMethod(methodMatch[1]) : 'GET'
    calls.push({
      method,
      path,
      pattern: 'fetch',
      rawSnippet: rawSnippetAt(code, match.index),
      isDynamic: isDynamic || undefined,
    })
  }
  return calls
}

// ─── Api-client parser ────────────────────────────────────────────────────────
// Identifiers ending in Client|Service|Api (capital A)|Http, or exactly: http|client|service.
// Deliberately excludes `axios` and `api` (lowercase), which are handled by parseAxios.

const API_CLIENT_RE = /\b(\w*(?:Client|Service|Api|Http)|http|client|service)\.(get|post|put|delete|patch)\s*\(\s*(?:(['"])([^'"]{1,300})\3|`([^`]{1,300})`)/gi

function parseApiClient(code: string): FrontendCall[] {
  const calls: FrontendCall[] = []
  let match: RegExpExecArray | null
  API_CLIENT_RE.lastIndex = 0
  while ((match = API_CLIENT_RE.exec(code)) !== null) {
    const rawUrl = match[4] ?? match[5] ?? ''
    if (!rawUrl) continue
    const { path, isDynamic } = normalizePath(rawUrl)
    calls.push({
      method: normalizeMethod(match[2]),
      path,
      pattern: 'api-client',
      rawSnippet: rawSnippetAt(code, match.index),
      isDynamic: isDynamic || undefined,
    })
  }
  return calls
}

// ─── Gemini fallback ──────────────────────────────────────────────────────────

const FETCH_SIGNAL_RE = /\bfetch\s*\(|\baxios\b|\.(get|post|put|delete|patch)\s*\(|\buseQuery\b|\buseMutation\b/

export function hasFetchSignals(code: string): boolean {
  return FETCH_SIGNAL_RE.test(code)
}

interface GeminiCall {
  method: string
  path: string
  pattern: string
}

async function parseWithGemini(code: string): Promise<FrontendCall[]> {
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        method: { type: 'string' },
        path: { type: 'string' },
        pattern: { type: 'string' },
      },
      required: ['method', 'path', 'pattern'],
    },
  }

  const prompt = `Extract all HTTP API calls from the following frontend JavaScript/TypeScript code. Return a JSON array of objects with "method" (GET/POST/PUT/DELETE/PATCH), "path" (the URL path), and "pattern" (one of: axios, fetch, api-client, react-query). Include only actual HTTP API calls, not imports or type definitions.\n\nCode:\n${code}`

  const results = await generateJSON<GeminiCall[]>(prompt, schema)

  return results.map((r) => {
    const { path, isDynamic } = normalizePath(r.path)
    return {
      method: normalizeMethod(r.method),
      path,
      pattern: (r.pattern as FrontendPattern) || 'fetch',
      rawSnippet: `${r.method.toUpperCase()} ${r.path}`,
      isDynamic: isDynamic || undefined,
    }
  })
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function parseFrontendCalls(
  code: string,
  options?: { filePath?: string }
): Promise<FrontendCall[]> {
  // React-query runs first so its pattern wins dedup over inner fetch/axios matches
  const allCalls: FrontendCall[] = [
    ...parseReactQuery(code),
    ...parseAxios(code),
    ...parseFetch(code),
    ...parseApiClient(code),
  ]

  let result: FrontendCall[]

  if (allCalls.length === 0 && hasFetchSignals(code)) {
    result = await parseWithGemini(code)
  } else {
    result = deduplicate(allCalls)
  }

  if (options?.filePath) {
    result = result.map((call) => ({ ...call, filePath: options.filePath }))
  }

  return result
}
