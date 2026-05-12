### Requirement: Parse Express.js routes
The system SHALL extract HTTP route definitions from Express.js source code, supporting `app.METHOD()` and `router.METHOD()` patterns for GET, POST, PUT, DELETE, and PATCH.

#### Scenario: Simple app.get route
- **WHEN** code contains `app.get('/users', handler)`
- **THEN** parser returns a `BackendRoute` with `method: 'GET'`, `path: '/users'`, `framework: 'express'`

#### Scenario: Router with dynamic param
- **WHEN** code contains `router.get('/users/:id', handler)`
- **THEN** parser returns `path: '/users/:id'` preserving the dynamic segment

#### Scenario: POST with inline handler
- **WHEN** code contains `app.post('/auth/login', async (req, res) => { ... })`
- **THEN** parser returns `method: 'POST'`, `path: '/auth/login'`, `framework: 'express'`

#### Scenario: Multiple routes in one file
- **WHEN** code contains 3 different route definitions
- **THEN** parser returns an array of 3 `BackendRoute` objects

#### Scenario: Nested router with prefix
- **WHEN** code contains `router.delete('/posts/:id/comments/:commentId', handler)`
- **THEN** parser returns the full path including both dynamic segments

#### Scenario: Duplicate route is deduplicated
- **WHEN** code defines `app.get('/ping', h1)` and `app.get('/ping', h2)` in the same file
- **THEN** parser returns exactly one `BackendRoute` for `GET /ping`

---

### Requirement: Parse FastAPI routes
The system SHALL extract HTTP route definitions from FastAPI Python source code, supporting `@app.METHOD()` and `@router.METHOD()` decorator patterns.

#### Scenario: Simple @app.get decorator
- **WHEN** code contains `@app.get("/items")`
- **THEN** parser returns `method: 'GET'`, `path: '/items'`, `framework: 'fastapi'`

#### Scenario: Path parameter with braces
- **WHEN** code contains `@router.get("/items/{item_id}")`
- **THEN** parser returns `path: '/items/:item_id'` (normalized to colon syntax)

#### Scenario: POST with request body annotation
- **WHEN** code contains `@app.post("/users", response_model=UserOut)`
- **THEN** parser returns `method: 'POST'`, `path: '/users'`, `framework: 'fastapi'`

#### Scenario: APIRouter with multiple routes
- **WHEN** code contains both `@router.get("/")` and `@router.delete("/{id}")`
- **THEN** parser returns 2 `BackendRoute` objects

#### Scenario: Decorator on async function
- **WHEN** code contains `@app.put("/profile")\nasync def update_profile`
- **THEN** parser captures `handler: 'update_profile'`

#### Scenario: Function name extracted as handler
- **WHEN** code contains `@app.get("/health")\ndef health_check():`
- **THEN** parser returns `handler: 'health_check'`

---

### Requirement: Parse Laravel routes
The system SHALL extract HTTP route definitions from Laravel PHP source code, supporting `Route::METHOD()` static call patterns.

#### Scenario: Route::get with string path
- **WHEN** code contains `Route::get('/dashboard', [DashboardController::class, 'index']);`
- **THEN** parser returns `method: 'GET'`, `path: '/dashboard'`, `framework: 'laravel'`

#### Scenario: Route::post with closure
- **WHEN** code contains `Route::post('/login', function() { ... });`
- **THEN** parser returns `method: 'POST'`, `path: '/login'`, `framework: 'laravel'`

#### Scenario: Dynamic path segment
- **WHEN** code contains `Route::get('/users/{id}', [UserController::class, 'show']);`
- **THEN** parser returns `path: '/users/:id'` (normalized to colon syntax)

#### Scenario: Route::delete
- **WHEN** code contains `Route::delete('/posts/{post}', [PostController::class, 'destroy']);`
- **THEN** parser returns `method: 'DELETE'`, `path: '/posts/:post'`

#### Scenario: Multiple routes in routes/api.php
- **WHEN** code contains 4 Route:: definitions
- **THEN** parser returns 4 `BackendRoute` objects

---

### Requirement: Auto-detect framework
The system SHALL infer the backend framework from code content when `options.framework` is not provided.

#### Scenario: Detect Express from import
- **WHEN** code contains `require('express')` and no other framework signals
- **THEN** parser uses Express regex patterns and returns `framework: 'express'`

#### Scenario: Detect FastAPI from decorator
- **WHEN** code contains `@app.get` or `from fastapi import`
- **THEN** parser uses FastAPI regex patterns and returns `framework: 'fastapi'`

#### Scenario: Detect Laravel from Route facade
- **WHEN** code contains `Route::get` or `use Illuminate\`
- **THEN** parser uses Laravel regex patterns and returns `framework: 'laravel'`

#### Scenario: Unknown framework falls back to Gemini
- **WHEN** framework cannot be detected by heuristics AND regex yields 0 routes
- **THEN** parser invokes Gemini fallback and sets `framework: 'unknown'` on returned routes

---

### Requirement: Normalize output
The system SHALL normalize all returned `BackendRoute` objects to a consistent format regardless of source framework.

#### Scenario: Method is uppercase
- **WHEN** a route is parsed from any framework
- **THEN** `method` is always uppercase (e.g., `'GET'`, `'POST'`)

#### Scenario: Path has leading slash
- **WHEN** a route definition omits the leading slash (e.g., `'users'`)
- **THEN** parser ensures the returned `path` starts with `/`

#### Scenario: FastAPI brace params become colon params
- **WHEN** FastAPI path contains `{param_name}`
- **THEN** returned `path` uses `:param_name` notation

#### Scenario: Laravel brace params become colon params
- **WHEN** Laravel path contains `{param}`
- **THEN** returned `path` uses `:param` notation

---

### Requirement: Attach filePath for monorepo tracing
The system SHALL include `filePath` on every returned route when `options.filePath` is provided.

#### Scenario: filePath propagated to all routes
- **WHEN** `parseBackendRoutes(code, { filePath: 'server/routes/api.js' })` is called
- **THEN** every returned `BackendRoute` has `filePath: 'server/routes/api.js'`

#### Scenario: filePath absent when not provided
- **WHEN** `parseBackendRoutes(code)` is called without options
- **THEN** returned routes have `filePath: undefined`

---

### Requirement: Gemini fallback for ambiguous code
The system SHALL invoke Gemini when regex-based parsing yields 0 routes from code that contains route-like signals.

#### Scenario: Custom helper function triggers fallback
- **WHEN** code uses a non-standard routing helper (e.g., `registerRoute('GET', '/foo', handler)`)
- **THEN** parser detects 0 regex matches, identifies route-like signals, and calls Gemini

#### Scenario: Gemini result mapped to BackendRoute
- **WHEN** Gemini returns `[{ method: "GET", path: "/foo" }]`
- **THEN** parser returns a valid `BackendRoute` with `framework` set from detection step

#### Scenario: No fallback when regex finds routes
- **WHEN** regex successfully extracts ≥1 route
- **THEN** Gemini is NOT invoked (zero LLM cost)
