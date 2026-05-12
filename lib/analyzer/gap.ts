import { randomUUID } from 'crypto'
import type {
  BackendRoute,
  FrontendCall,
  GapAnalysisResult,
  AnalyzedRoute,
} from '../types'

/**
 * Converts a backend path (with :param, {param}) to a regex that matches
 * corresponding frontend paths (plain segments, ${expr} templates).
 */
function bePathToRegex(path: string): RegExp {
  let p = path.toLowerCase()
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  // Escape regex special chars except the param placeholders we handle below
  p = p.replace(/[.*+?^${}()|[\]\\]/g, (char) => {
    // Curly braces are part of FastAPI params — skip escaping them for now;
    // we'll handle them in the param replacement pass below.
    // Everything else gets escaped.
    if (char === '{' || char === '}') return char
    return `\\${char}`
  })
  // Replace ${...} template literals
  p = p.replace(/\\\$\{[^}]*\}/g, '[^/]+')
  // Replace {word} FastAPI style
  p = p.replace(/\{[^}]+\}/g, '[^/]+')
  // Replace :word Express style
  p = p.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '[^/]+')
  return new RegExp(`^${p}$`)
}

/**
 * Normalises a frontend path for matching against a BE regex:
 * - lowercase
 * - strip trailing slash
 * - replace ${...} template expressions with a literal word that won't
 *   contain slashes (so it satisfies [^/]+)
 */
function normalizeFePath(path: string): string {
  let p = path.toLowerCase()
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  // Collapse template literals into a placeholder
  p = p.replace(/\$\{[^}]*\}/g, '__expr__')
  return p
}

function normalizeMethod(method: string): string {
  return method.trim().toUpperCase()
}

interface BeEntry {
  route: BackendRoute
  regex: RegExp
  method: string
}

export function analyzeGap(
  backendRoutes: BackendRoute[],
  frontendCalls: FrontendCall[],
): GapAnalysisResult {
  const beEntries: BeEntry[] = backendRoutes.map((route) => ({
    route,
    regex: bePathToRegex(route.path),
    method: normalizeMethod(route.method),
  }))

  const matchedBeIndices = new Set<number>()
  const matchedFeIndices = new Set<number>()
  const routes: AnalyzedRoute[] = []

  // For each FE call, find the first unmatched BE route with same method and matching path
  const feNormalized = frontendCalls.map((call) => ({
    call,
    method: normalizeMethod(call.method),
    normPath: normalizeFePath(call.path),
  }))

  for (let fi = 0; fi < feNormalized.length; fi++) {
    const { method: feMethod, normPath } = feNormalized[fi]
    for (let bi = 0; bi < beEntries.length; bi++) {
      if (matchedBeIndices.has(bi)) continue
      const { method: beMethod, regex } = beEntries[bi]
      if (beMethod === feMethod && regex.test(normPath)) {
        matchedBeIndices.add(bi)
        matchedFeIndices.add(fi)
        break
      }
    }
  }

  // Connected routes (from BE side)
  for (let bi = 0; bi < beEntries.length; bi++) {
    const be = beEntries[bi].route
    if (matchedBeIndices.has(bi)) {
      routes.push({
        id: randomUUID(),
        method: be.method,
        path: be.path,
        status: 'connected',
        detectedIn: 'both',
      })
    } else {
      routes.push({
        id: randomUUID(),
        method: be.method,
        path: be.path,
        status: 'orphan',
        detectedIn: 'backend',
      })
    }
  }

  // Ghost routes — unmatched FE calls
  for (let fi = 0; fi < frontendCalls.length; fi++) {
    if (!matchedFeIndices.has(fi)) {
      const call = frontendCalls[fi]
      routes.push({
        id: randomUUID(),
        method: call.method,
        path: call.path,
        status: 'ghost',
        detectedIn: 'frontend',
      })
    }
  }

  const connected = routes.filter((r) => r.status === 'connected').length
  const orphan = routes.filter((r) => r.status === 'orphan').length
  const ghost = routes.filter((r) => r.status === 'ghost').length

  return {
    mode: 'separate',
    routes,
    features: [],
    summary: {
      total: routes.length,
      connected,
      orphan,
      ghost,
    },
  }
}

export function buildDocumentedRoutes(backendRoutes: BackendRoute[]): AnalyzedRoute[] {
  return backendRoutes.map((be) => ({
    id: randomUUID(),
    method: be.method,
    path: be.path,
    status: 'documented',
    detectedIn: 'backend',
  }))
}
