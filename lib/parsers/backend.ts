import { generateJSON } from '../gemini'
import type { BackendRoute, BackendFramework, HttpMethod } from '../types'

// ─── Normalizers ────────────────────────────────────────────────────────────

function normalizeMethod(method: string): HttpMethod {
  return method.toUpperCase() as HttpMethod
}

function normalizePath(path: string): string {
  // Ensure leading slash
  const withSlash = path.startsWith('/') ? path : `/${path}`
  // Convert {param} → :param (FastAPI / Laravel style)
  return withSlash.replace(/\{([^}]+)\}/g, ':$1')
}

// ─── Deduplication ──────────────────────────────────────────────────────────

type PartialRoute = Omit<BackendRoute, 'framework' | 'filePath'>

function deduplicateRoutes(routes: BackendRoute[]): BackendRoute[] {
  const seen = new Map<string, BackendRoute>()
  for (const route of routes) {
    const key = `${route.method}:${route.path}`
    seen.set(key, route)
  }
  return Array.from(seen.values())
}

// ─── Framework detection ─────────────────────────────────────────────────────

export function detectFramework(code: string): BackendFramework {
  if (/from\s+fastapi\s+import|@(?:app|router)\.(?:get|post|put|delete|patch)\s*\(/.test(code)) {
    return 'fastapi'
  }
  if (/Route::(?:get|post|put|delete|patch)|use\s+Illuminate\\/.test(code)) {
    return 'laravel'
  }
  if (/require\s*\(\s*['"]express['"]|(?:app|router)\.(?:get|post|put|delete|patch)\s*\(/.test(code)) {
    return 'express'
  }
  return 'unknown'
}

// ─── Express parser ──────────────────────────────────────────────────────────

const EXPRESS_METHOD_RE =
  /\b(app|router)\.(get|post|put|delete|patch)\s*\(\s*(['"`])([^'"`]+)\3\s*,\s*([^)]*)/g

const EXPRESS_ROUTE_CHAIN_RE =
  /\b(app|router)\.route\s*\(\s*(['"`])([^'"`]+)\2\s*\)\s*(?:\.(get|post|put|delete|patch)\s*\([^)]*\))+/g

export function parseExpress(code: string): PartialRoute[] {
  const routes: PartialRoute[] = []
  const lines = code.split('\n')

  let match: RegExpExecArray | null

  // Standard: (app|router).METHOD('path', handler)
  EXPRESS_METHOD_RE.lastIndex = 0
  while ((match = EXPRESS_METHOD_RE.exec(code)) !== null) {
    const [fullMatch, , method, , path, handlerPart] = match
    const lineStart = code.lastIndexOf('\n', match.index) + 1
    const lineEnd = code.indexOf('\n', match.index)
    const rawSnippet = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()

    const handlerName = extractExpressHandler(handlerPart?.trim() ?? '')

    routes.push({
      method: normalizeMethod(method),
      path: normalizePath(path),
      handler: handlerName || undefined,
      rawSnippet: rawSnippet || fullMatch,
    })
  }

  // Chain: router.route('/path').get(h1).post(h2)
  EXPRESS_ROUTE_CHAIN_RE.lastIndex = 0
  while ((match = EXPRESS_ROUTE_CHAIN_RE.exec(code)) !== null) {
    const chainStr = match[0]
    const path = match[3]
    const methodMatches = chainStr.matchAll(/\.(get|post|put|delete|patch)\s*\(([^)]*)\)/g)
    for (const m of methodMatches) {
      const lineStart = code.lastIndexOf('\n', match.index) + 1
      const lineEnd = code.indexOf('\n', match.index)
      const rawSnippet = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
      const handlerName = extractExpressHandler(m[2]?.trim() ?? '')
      routes.push({
        method: normalizeMethod(m[1]),
        path: normalizePath(path),
        handler: handlerName || undefined,
        rawSnippet: rawSnippet || chainStr,
      })
    }
  }

  return routes
}

function extractExpressHandler(handlerPart: string): string {
  // Named function reference: handler or controllers.handler
  if (/^[a-zA-Z_$][\w$.]*$/.test(handlerPart)) return handlerPart
  // Arrow function: async (req, res) => { or (req, res) => {
  // Try to pull the variable name from assignment context — not reliable here; skip
  return ''
}

// ─── FastAPI parser ──────────────────────────────────────────────────────────

const FASTAPI_DECORATOR_RE =
  /@(app|router)\.(get|post|put|delete|patch)\s*\(\s*(['"])([^'"]+)\3[^)]*\)\s*\n(?:async\s+)?def\s+(\w+)/g

export function parseFastAPI(code: string): PartialRoute[] {
  const routes: PartialRoute[] = []
  let match: RegExpExecArray | null

  FASTAPI_DECORATOR_RE.lastIndex = 0
  while ((match = FASTAPI_DECORATOR_RE.exec(code)) !== null) {
    const [fullMatch, , method, , path, handlerName] = match
    const lineStart = code.lastIndexOf('\n', match.index) + 1
    const lineEnd = code.indexOf('\n', match.index)
    const rawSnippet = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()

    routes.push({
      method: normalizeMethod(method),
      path: normalizePath(path),
      handler: handlerName || undefined,
      rawSnippet: rawSnippet || fullMatch,
    })
  }

  // Fallback: decorator without def on next line (e.g. within class body)
  if (routes.length === 0) {
    const simpleRe =
      /@(app|router)\.(get|post|put|delete|patch)\s*\(\s*(['"])([^'"]+)\3[^)]*\)/g
    while ((match = simpleRe.exec(code)) !== null) {
      const [fullMatch, , method, , path] = match
      const lineStart = code.lastIndexOf('\n', match.index) + 1
      const lineEnd = code.indexOf('\n', match.index)
      const rawSnippet = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
      routes.push({
        method: normalizeMethod(method),
        path: normalizePath(path),
        rawSnippet: rawSnippet || fullMatch,
      })
    }
  }

  return routes
}

// ─── Laravel parser ──────────────────────────────────────────────────────────

const LARAVEL_METHOD_RE =
  /Route::(get|post|put|delete|patch)\s*\(\s*(['"])([^'"]+)\2/g

const LARAVEL_RESOURCE_RE =
  /Route::(?:apiResource|resource)\s*\(\s*(['"])([^'"]+)\1/g

const REST_RESOURCE_ROUTES: Array<{ method: HttpMethod; suffix: string }> = [
  { method: 'GET', suffix: '' },
  { method: 'POST', suffix: '' },
  { method: 'GET', suffix: '/:id' },
  { method: 'PUT', suffix: '/:id' },
  { method: 'PATCH', suffix: '/:id' },
  { method: 'DELETE', suffix: '/:id' },
]

export function parseLaravel(code: string): PartialRoute[] {
  const routes: PartialRoute[] = []
  let match: RegExpExecArray | null

  LARAVEL_METHOD_RE.lastIndex = 0
  while ((match = LARAVEL_METHOD_RE.exec(code)) !== null) {
    const [fullMatch, method, , path] = match
    const lineStart = code.lastIndexOf('\n', match.index) + 1
    const lineEnd = code.indexOf('\n', match.index)
    const rawSnippet = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()

    routes.push({
      method: normalizeMethod(method),
      path: normalizePath(path),
      rawSnippet: rawSnippet || fullMatch,
    })
  }

  // Expand apiResource / resource to standard REST routes
  LARAVEL_RESOURCE_RE.lastIndex = 0
  while ((match = LARAVEL_RESOURCE_RE.exec(code)) !== null) {
    const [fullMatch, , basePath] = match
    const lineStart = code.lastIndexOf('\n', match.index) + 1
    const lineEnd = code.indexOf('\n', match.index)
    const rawSnippet = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()

    for (const { method, suffix } of REST_RESOURCE_ROUTES) {
      routes.push({
        method,
        path: normalizePath(basePath + suffix),
        rawSnippet: rawSnippet || fullMatch,
      })
    }
  }

  return routes
}

// ─── Gemini fallback ─────────────────────────────────────────────────────────

const ROUTE_SIGNAL_RE =
  /(?:\bget\b|\bpost\b|\bput\b|\bdelete\b|\bpatch\b).*['"`]\/|@(?:app|router)\.|Route::/i

export function hasRouteLikeSignals(code: string): boolean {
  return ROUTE_SIGNAL_RE.test(code)
}

interface GeminiRoute {
  method: string
  path: string
}

export async function parseWithGemini(
  code: string,
  framework: BackendFramework
): Promise<BackendRoute[]> {
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        method: { type: 'string' },
        path: { type: 'string' },
      },
      required: ['method', 'path'],
    },
  }

  const prompt = `Extract all HTTP route definitions from the following backend code. Return ONLY a JSON array of objects with "method" and "path" fields. Include all routes you can find (GET, POST, PUT, DELETE, PATCH).\n\nCode:\n${code}`

  const results = await generateJSON<GeminiRoute[]>(prompt, schema)

  return results.map((r) => ({
    method: normalizeMethod(r.method),
    path: normalizePath(r.path),
    framework,
    rawSnippet: `${r.method.toUpperCase()} ${r.path}`,
  }))
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function parseBackendRoutes(
  code: string,
  options?: { framework?: BackendFramework; filePath?: string }
): Promise<BackendRoute[]> {
  const framework = options?.framework ?? detectFramework(code)

  let partials: PartialRoute[] = []

  if (framework === 'unknown') {
    // Try all parsers and union results
    partials = [
      ...parseExpress(code),
      ...parseFastAPI(code),
      ...parseLaravel(code),
    ]
  } else if (framework === 'express') {
    partials = parseExpress(code)
  } else if (framework === 'fastapi') {
    partials = parseFastAPI(code)
  } else if (framework === 'laravel') {
    partials = parseLaravel(code)
  }

  // Gemini fallback: 0 regex results + route-like signals
  if (partials.length === 0 && hasRouteLikeSignals(code)) {
    return parseWithGemini(code, framework)
  }

  const routes: BackendRoute[] = partials.map((p) => ({
    ...p,
    framework,
    filePath: options?.filePath,
  }))

  return deduplicateRoutes(routes)
}
