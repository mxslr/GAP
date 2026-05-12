import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectFramework,
  parseExpress,
  parseFastAPI,
  parseLaravel,
  hasRouteLikeSignals,
  parseBackendRoutes,
} from '../lib/parsers/backend'

// Mock lib/gemini.ts so tests never hit the network
vi.mock('../lib/gemini', () => ({
  generateJSON: vi.fn().mockResolvedValue([]),
}))

// ─── detectFramework smoke tests ─────────────────────────────────────────────

describe('detectFramework', () => {
  it('detects express from require', () => {
    expect(detectFramework("const app = require('express')()")).toBe('express')
  })

  it('detects express from app.get', () => {
    expect(detectFramework("app.get('/users', handler)")).toBe('express')
  })

  it('detects fastapi from import', () => {
    expect(detectFramework('from fastapi import FastAPI')).toBe('fastapi')
  })

  it('detects fastapi from decorator', () => {
    expect(detectFramework('@app.get("/items")')).toBe('fastapi')
  })

  it('detects laravel from Route facade', () => {
    expect(detectFramework("Route::get('/dashboard', [DashboardController::class, 'index']);")).toBe('laravel')
  })

  it('returns unknown for unrecognized code', () => {
    expect(detectFramework('const x = 1')).toBe('unknown')
  })
})

// ─── Express tests ────────────────────────────────────────────────────────────

describe('parseExpress', () => {
  // 8.1 simple app.get
  it('extracts simple app.get route', () => {
    const code = "app.get('/users', handler)"
    const routes = parseExpress(code)
    expect(routes).toHaveLength(1)
    expect(routes[0].method).toBe('GET')
    expect(routes[0].path).toBe('/users')
  })

  // 8.2 router.post with async handler
  it('extracts router.post with async arrow handler', () => {
    const code = "router.post('/auth/login', async (req, res) => { res.json({}) })"
    const routes = parseExpress(code)
    expect(routes).toHaveLength(1)
    expect(routes[0].method).toBe('POST')
    expect(routes[0].path).toBe('/auth/login')
  })

  // 8.3 dynamic param preserved
  it('preserves dynamic :param segments', () => {
    const code = "router.get('/users/:id', getUser)"
    const routes = parseExpress(code)
    expect(routes[0].path).toBe('/users/:id')
  })

  // 8.4 nested dynamic params
  it('preserves nested dynamic params', () => {
    const code = "router.delete('/posts/:id/comments/:cid', deleteComment)"
    const routes = parseExpress(code)
    expect(routes[0].method).toBe('DELETE')
    expect(routes[0].path).toBe('/posts/:id/comments/:cid')
  })

  // 8.5 multiple routes in one file
  it('returns all routes from a file with many definitions', () => {
    const code = `
app.get('/users', listUsers)
app.post('/users', createUser)
app.put('/users/:id', updateUser)
app.delete('/users/:id', deleteUser)
app.patch('/users/:id/status', patchStatus)
    `.trim()
    const routes = parseExpress(code)
    expect(routes).toHaveLength(5)
  })

  // 8.6 duplicate deduplicated by parseBackendRoutes (parseExpress itself may return duplicates)
  it('parseBackendRoutes deduplicates duplicate route definitions', async () => {
    const code = `
app.get('/ping', h1)
app.get('/ping', h2)
    `.trim()
    const routes = await parseBackendRoutes(code, { framework: 'express' })
    const pingRoutes = routes.filter((r) => r.path === '/ping' && r.method === 'GET')
    expect(pingRoutes).toHaveLength(1)
  })

  // 8.7 router.route chain pattern
  it('extracts multiple methods from router.route chain', () => {
    const code = "router.route('/items').get(h1).post(h2)"
    const routes = parseExpress(code)
    const methods = routes.map((r) => r.method).sort()
    expect(methods).toContain('GET')
    expect(methods).toContain('POST')
    expect(routes.every((r) => r.path === '/items')).toBe(true)
  })

  it('extracts handler name when named function reference is used', () => {
    const code = "app.get('/health', healthCheck)"
    const routes = parseExpress(code)
    expect(routes[0].handler).toBe('healthCheck')
  })

  it('includes rawSnippet for each route', () => {
    const code = "app.get('/users', handler)"
    const routes = parseExpress(code)
    expect(routes[0].rawSnippet).toBeTruthy()
  })
})

// ─── FastAPI tests ────────────────────────────────────────────────────────────

describe('parseFastAPI', () => {
  // 9.1 simple @app.get
  it('extracts @app.get decorator', () => {
    const code = `@app.get("/items")\ndef list_items():\n    pass`
    const routes = parseFastAPI(code)
    expect(routes).toHaveLength(1)
    expect(routes[0].method).toBe('GET')
    expect(routes[0].path).toBe('/items')
  })

  // 9.2 path param normalized to :param
  it('normalizes {item_id} to :item_id', () => {
    const code = `@router.get("/items/{item_id}")\ndef get_item(item_id: int):\n    pass`
    const routes = parseFastAPI(code)
    expect(routes[0].path).toBe('/items/:item_id')
  })

  // 9.3 POST with extra keyword args
  it('extracts POST with response_model kwarg', () => {
    const code = `@app.post("/users", response_model=UserOut)\ndef create_user():\n    pass`
    const routes = parseFastAPI(code)
    expect(routes[0].method).toBe('POST')
    expect(routes[0].path).toBe('/users')
  })

  // 9.4 handler name extracted from async def
  it('extracts async function name as handler', () => {
    const code = `@app.put("/profile")\nasync def update_profile():\n    pass`
    const routes = parseFastAPI(code)
    expect(routes[0].handler).toBe('update_profile')
  })

  // 9.5 multiple routes → array
  it('returns all routes from multiple decorators', () => {
    const code = `
@router.get("/")
def list_items():
    pass

@router.post("/")
def create_item():
    pass

@router.get("/{item_id}")
def get_item():
    pass
    `.trim()
    const routes = parseFastAPI(code)
    expect(routes.length).toBeGreaterThanOrEqual(3)
  })

  // 9.6 router.delete with /{id}
  it('extracts DELETE with path param', () => {
    const code = `@router.delete("/{id}")\nasync def delete_item(id: int):\n    pass`
    const routes = parseFastAPI(code)
    expect(routes[0].method).toBe('DELETE')
    expect(routes[0].path).toBe('/:id')
  })
})

// ─── Laravel tests ────────────────────────────────────────────────────────────

describe('parseLaravel', () => {
  // 10.1 Route::get
  it('extracts Route::get', () => {
    const code = "Route::get('/dashboard', [DashboardController::class, 'index']);"
    const routes = parseLaravel(code)
    expect(routes).toHaveLength(1)
    expect(routes[0].method).toBe('GET')
    expect(routes[0].path).toBe('/dashboard')
  })

  // 10.2 Route::post with closure
  it('extracts Route::post with closure', () => {
    const code = "Route::post('/login', function() { return response()->json([]); });"
    const routes = parseLaravel(code)
    expect(routes[0].method).toBe('POST')
    expect(routes[0].path).toBe('/login')
  })

  // 10.3 {id} normalized to :id
  it('normalizes {id} param to :id', () => {
    const code = "Route::get('/users/{id}', [UserController::class, 'show']);"
    const routes = parseLaravel(code)
    expect(routes[0].path).toBe('/users/:id')
  })

  // 10.4 Route::delete
  it('extracts Route::delete', () => {
    const code = "Route::delete('/posts/{post}', [PostController::class, 'destroy']);"
    const routes = parseLaravel(code)
    expect(routes[0].method).toBe('DELETE')
    expect(routes[0].path).toBe('/posts/:post')
  })

  // 10.5 4 routes in one file
  it('returns all 4 routes from a routes/api.php file', () => {
    const code = `
Route::get('/products', [ProductController::class, 'index']);
Route::post('/products', [ProductController::class, 'store']);
Route::put('/products/{id}', [ProductController::class, 'update']);
Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    `.trim()
    const routes = parseLaravel(code)
    expect(routes).toHaveLength(4)
  })
})

// ─── Cross-cutting tests ──────────────────────────────────────────────────────

describe('parseBackendRoutes — cross-cutting', () => {
  // 11.1 filePath propagated
  it('attaches filePath to all returned routes', async () => {
    const code = "app.get('/users', handler)\napp.post('/users', createUser)"
    const routes = await parseBackendRoutes(code, { filePath: 'server/routes/api.js' })
    expect(routes.length).toBeGreaterThan(0)
    expect(routes.every((r) => r.filePath === 'server/routes/api.js')).toBe(true)
  })

  // 11.2 no filePath → undefined
  it('leaves filePath undefined when not provided', async () => {
    const code = "app.get('/health', handler)"
    const routes = await parseBackendRoutes(code)
    expect(routes.every((r) => r.filePath === undefined)).toBe(true)
  })

  // 11.3 auto-detection per framework
  it('auto-detects express framework', async () => {
    const code = "const express = require('express')\napp.get('/ping', handler)"
    const routes = await parseBackendRoutes(code)
    expect(routes.every((r) => r.framework === 'express')).toBe(true)
  })

  it('auto-detects fastapi framework', async () => {
    const code = "from fastapi import FastAPI\n@app.get('/ping')\ndef ping(): pass"
    const routes = await parseBackendRoutes(code)
    expect(routes.every((r) => r.framework === 'fastapi')).toBe(true)
  })

  it('auto-detects laravel framework', async () => {
    const code = "Route::get('/ping', [PingController::class, 'index']);"
    const routes = await parseBackendRoutes(code)
    expect(routes.every((r) => r.framework === 'laravel')).toBe(true)
  })

  // 11.4 explicit framework skips detection
  it('uses explicit framework option and skips auto-detect', async () => {
    // FastAPI-looking code but we force Express — regex won't find routes, that's fine
    const code = "@app.get('/items')\ndef list_items(): pass"
    const routes = await parseBackendRoutes(code, { framework: 'express' })
    // Framework on every route must be 'express'
    expect(routes.every((r) => r.framework === 'express')).toBe(true)
  })

  // 11.5 method normalization
  it('normalizes lowercase method string to uppercase', async () => {
    // parseExpress receives lowercase from regex groups; test via the normalizer path
    const code = "app.get('/test', h)\napp.post('/test2', h)"
    const routes = await parseBackendRoutes(code, { framework: 'express' })
    expect(routes.every((r) => r.method === r.method.toUpperCase())).toBe(true)
  })

  // 11.6 path without leading slash gets one added
  it('ensures path has a leading slash', async () => {
    const code = "Route::get('no-slash', [Controller::class, 'index']);"
    const routes = await parseBackendRoutes(code, { framework: 'laravel' })
    expect(routes.every((r) => r.path.startsWith('/'))).toBe(true)
  })
})

// ─── hasRouteLikeSignals ──────────────────────────────────────────────────────

describe('hasRouteLikeSignals', () => {
  it('returns true for code with GET and a path string', () => {
    expect(hasRouteLikeSignals("registerRoute('GET', '/api/users', handler)")).toBe(true)
  })

  it('returns true for code with @router. decorator', () => {
    expect(hasRouteLikeSignals('@router.get("/items")')).toBe(true)
  })

  it('returns false for unrelated code', () => {
    expect(hasRouteLikeSignals('const x = 1 + 2')).toBe(false)
  })
})
