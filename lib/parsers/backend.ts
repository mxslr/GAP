import { generateJSON } from '../ai-provider'
import { GROQ_MODELS } from '../groq'
import type { BackendRoute, BackendFramework, HttpMethod, FileEntry } from '../types'

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
    const methodMatches = Array.from(chainStr.matchAll(/\.(get|post|put|delete|patch)\s*\(([^)]*)\)/g))
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
  /Route::(get|post|put|delete|patch|options)\s*\(\s*(['"`])([^'"`]+)\2/gi

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

// ─── NestJS decorator parser ─────────────────────────────────────────────────

const NESTJS_CONTROLLER_PREFIX_RE = /@Controller\(\s*(?:['"`]([^'"`]*?)['"`])?\s*\)/

const NESTJS_HTTP_DECORATOR_RE =
  /@(Get|Post|Put|Delete|Patch)\s*\(\s*(?:['"`]([^'"`]*?)['"`])?\s*\)/gi

function buildNestPath(prefix: string, subpath: string): string {
  const clean = [prefix, subpath].filter(Boolean).join('/')
  return clean ? `/${clean}` : '/'
}

export function parseNestJs(code: string, filePath?: string): BackendRoute[] {
  const controllerMatch = NESTJS_CONTROLLER_PREFIX_RE.exec(code)
  if (!controllerMatch && !NESTJS_HTTP_DECORATOR_RE.test(code)) return []
  NESTJS_HTTP_DECORATOR_RE.lastIndex = 0

  const prefix = controllerMatch?.[1] ?? ''
  const routes: BackendRoute[] = []

  const re = new RegExp(NESTJS_HTTP_DECORATOR_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(code)) !== null) {
    const httpMethod = match[1]
    const subpath = match[2] ?? ''
    const lineStart = code.lastIndexOf('\n', match.index) + 1
    const lineEnd = code.indexOf('\n', match.index)
    const rawSnippet = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
    routes.push({
      method: normalizeMethod(httpMethod),
      path: buildNestPath(prefix, subpath),
      framework: 'unknown',
      rawSnippet: rawSnippet || match[0],
      filePath,
    })
  }

  return routes
}

function isNestJsCode(code: string, files?: FileEntry[]): boolean {
  if (files?.some((f) => /\.controller\.[tj]sx?$/.test(f.path))) return true
  return /@Controller\s*\(|from\s+['"]@nestjs/.test(code)
}

function extractNestGlobalPrefix(files: FileEntry[]): string {
  const mainFile = files.find((f) => /(?:^|\/)main\.[tj]sx?$/.test(f.path))
  if (!mainFile) return ''
  const match = mainFile.content.match(/setGlobalPrefix\s*\(\s*['"`]([^'"`]+)['"`]/)
  return match ? match[1].replace(/^\/+|\/+$/g, '') : ''
}

const FILE_SEPARATOR_RE = /\/\/ === FILE: ([^\n]+) ===/g

function parseNestJsFromCombinedCode(combinedCode: string, globalPrefix: string): BackendRoute[] {
  const allRoutes: BackendRoute[] = []

  // Split combined code into per-file blocks so each @Controller gets its own prefix
  const blocks: Array<{ path: string; content: string }> = []
  const separatorRe = new RegExp(FILE_SEPARATOR_RE.source, 'g')
  let lastIndex = 0
  let lastPath = ''
  let sepMatch: RegExpExecArray | null

  while ((sepMatch = separatorRe.exec(combinedCode)) !== null) {
    if (lastPath) {
      blocks.push({ path: lastPath, content: combinedCode.slice(lastIndex, sepMatch.index) })
    }
    lastPath = sepMatch[1].trim()
    lastIndex = sepMatch.index + sepMatch[0].length
  }
  if (lastPath) {
    blocks.push({ path: lastPath, content: combinedCode.slice(lastIndex) })
  }

  // Fallback: no file separators — parse whole thing as one block
  if (blocks.length === 0) {
    blocks.push({ path: '', content: combinedCode })
  }

  let controllerCount = 0
  for (const block of blocks) {
    const routes = parseNestJs(block.content, block.path)
    if (routes.length > 0) controllerCount++
    if (globalPrefix) {
      routes.forEach((r) => { r.path = `/${globalPrefix}${r.path}` })
    }
    allRoutes.push(...routes)
  }

  console.log(`[parser] NestJS controllers parsed: ${controllerCount}, routes: ${allRoutes.length}`)
  if (allRoutes.length > 0) {
    console.log(`[parser] sample routes:`, allRoutes.slice(0, 3).map((r) => `${r.method} ${r.path}`))
  }
  return allRoutes
}

// ─── Next.js file-based route parser ─────────────────────────────────────────

function extractNextJsPath(filePath: string): string {
  // Strip src/ prefix
  const p = filePath.replace(/^src\//, '')

  // App Router: app/api/<segments>/route.{ts,tsx,js,jsx}
  const appMatch = p.match(/^app\/(api\/.+?)\/route\.[tj]sx?$/)
  if (appMatch) {
    return '/' + appMatch[1].replace(/\[([^\]]+)\]/g, ':$1')
  }

  // Pages Router: pages/api/<segments>.{ts,js}
  const pagesMatch = p.match(/^pages\/(api\/.+?)\.[tj]sx?$/)
  if (pagesMatch) {
    return '/' + pagesMatch[1].replace(/\[([^\]]+)\]/g, ':$1')
  }

  return ''
}

const NEXT_APP_METHOD_RE = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g

export function extractNextJsRoutes(files: FileEntry[]): BackendRoute[] {
  const routes: BackendRoute[] = []

  for (const file of files) {
    const routePath = extractNextJsPath(file.path)
    if (!routePath) continue

    const isPagesRouter = file.path.replace(/^src\//, '').startsWith('pages/api/')

    if (isPagesRouter) {
      // Pages router handlers handle all methods — expose GET + POST as defaults
      routes.push(
        { method: 'GET', path: routePath, framework: 'unknown', rawSnippet: `// ${file.path}`, filePath: file.path },
        { method: 'POST', path: routePath, framework: 'unknown', rawSnippet: `// ${file.path}`, filePath: file.path },
      )
    } else {
      // App Router — detect each exported HTTP method function
      const re = new RegExp(NEXT_APP_METHOD_RE.source, 'g')
      let match: RegExpExecArray | null
      const foundMethods = new Set<string>()
      while ((match = re.exec(file.content)) !== null) {
        foundMethods.add(match[1].toUpperCase())
      }
      Array.from(foundMethods).forEach((method) => {
        routes.push({
          method: method as HttpMethod,
          path: routePath,
          framework: 'unknown',
          rawSnippet: `export async function ${method}(request: Request) { ... } // ${file.path}`,
          filePath: file.path,
        })
      })
    }
  }

  console.log(`[parser] Next.js routes detected: ${routes.length}`)
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

  const prompt = `Extract all HTTP route definitions from the following backend code. Return JSON with a "routes" array of objects with "method" and "path" fields. Include all routes you can find (GET, POST, PUT, DELETE, PATCH).\n\nCode:\n${code}`

  const raw = await generateJSON<GeminiRoute[] | Record<string, unknown>>(prompt, schema, GROQ_MODELS.quality)

  // Groq json_object mode always wraps in an object; Gemini may return a bare array
  const results: GeminiRoute[] = Array.isArray(raw)
    ? raw
    : (Object.values(raw as Record<string, unknown>).find(Array.isArray) as GeminiRoute[] | undefined) ?? []

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
  options?: { framework?: BackendFramework; filePath?: string; files?: FileEntry[] }
): Promise<BackendRoute[]> {
  // 1. Next.js file-based routing — path comes from file structure, not code
  if (options?.files && options.files.length > 0) {
    const nextRoutes = extractNextJsRoutes(options.files)
    if (nextRoutes.length > 0) {
      return deduplicateRoutes(nextRoutes)
    }
  }

  // 1.5. Laravel Route facade — check before NestJS to avoid false positives
  if (code.includes('Route::')) {
    const laravelPartials = parseLaravel(code)
    if (laravelPartials.length > 0) {
      console.log(`[parser] Laravel detected: ${laravelPartials.length} routes`)
      return deduplicateRoutes(
        laravelPartials.map((p) => ({ ...p, framework: 'laravel' as BackendFramework, filePath: options?.filePath }))
      )
    }
  }

  // 2. NestJS decorator-based routing
  if (isNestJsCode(code, options?.files)) {
    const globalPrefix = options?.files ? extractNestGlobalPrefix(options.files) : ''
    const nestRoutes = parseNestJsFromCombinedCode(code, globalPrefix)
    if (nestRoutes.length > 0) {
      return deduplicateRoutes(nestRoutes)
    }
  }

  // 3. Express / FastAPI / Laravel regex
  const framework = options?.framework ?? detectFramework(code)

  let partials: PartialRoute[] = []

  if (framework === 'unknown') {
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

  // 4. Gemini fallback: fewer than 2 regex results + route-like signals
  if (partials.length < 2 && hasRouteLikeSignals(code)) {
    const relevantLines = code
      .split('\n')
      .filter((line) =>
        /(?:get|post|put|delete|patch|route|Route|@app|@router|controller|handler|endpoint)/i.test(line)
      )
      .join('\n')
      .slice(0, 3000)
    return parseWithGemini(relevantLines || code.slice(0, 3000), framework)
  }

  const routes: BackendRoute[] = partials.map((p) => ({
    ...p,
    framework,
    filePath: options?.filePath,
  }))

  return deduplicateRoutes(routes)
}
