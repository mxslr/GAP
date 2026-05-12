## 1. Foundation — types and module skeleton

- [x] 1.1 Verify `BackendRoute`, `HttpMethod`, `BackendFramework` types exist in `lib/types.ts` (no changes needed if present)
- [x] 1.2 Create `lib/parsers/backend.ts` with the exported function signature `parseBackendRoutes(code: string, options?: { framework?: BackendFramework, filePath?: string }): Promise<BackendRoute[]>`
- [x] 1.3 Add internal helpers: `normalizeMethod`, `normalizePath` (ensure uppercase method, leading `/`, convert `{param}` → `:param`)
- [x] 1.4 Add `deduplicateRoutes` helper keyed on `method + ':' + path`

## 2. Framework auto-detection

- [x] 2.1 Implement `detectFramework(code: string): BackendFramework` — checks FastAPI signals first, then Laravel, then Express, then `'unknown'`
- [x] 2.2 Add unit smoke test that `detectFramework` correctly identifies each of the 3 frameworks from minimal code snippets

## 3. Express.js regex parser

- [x] 3.1 Implement `parseExpress(code: string): Omit<BackendRoute, 'framework' | 'filePath'>[]` using regex for `(app|router).(get|post|put|delete|patch)(` patterns
- [x] 3.2 Support handler name extraction from second argument (named function or arrow function)
- [x] 3.3 Extract `rawSnippet` as the full matched line for each route

## 4. FastAPI regex parser

- [x] 4.1 Implement `parseFastAPI(code: string): Omit<BackendRoute, 'framework' | 'filePath'>[]` using regex for `@(app|router).(get|post|put|delete|patch)(` decorator patterns
- [x] 4.2 Extract function name on the line after the decorator as `handler`
- [x] 4.3 Normalize `{param}` → `:param` in all FastAPI paths

## 5. Laravel regex parser

- [x] 5.1 Implement `parseLaravel(code: string): Omit<BackendRoute, 'framework' | 'filePath'>[]` using regex for `Route::(get|post|put|delete|patch)(` static call patterns
- [x] 5.2 Handle `Route::apiResource` by expanding to standard REST routes (index, store, show, update, destroy)
- [x] 5.3 Normalize `{param}` → `:param` in all Laravel paths

## 6. Gemini fallback

- [x] 6.1 Implement `hasRouteLikeSignals(code: string): boolean` — checks for HTTP method words, path strings, decorator syntax
- [x] 6.2 Implement `parseWithGemini(code: string, framework: BackendFramework): Promise<BackendRoute[]>` using `lib/gemini.ts` with `responseSchema` forcing `{method, path}[]`
- [x] 6.3 Wire fallback into `parseBackendRoutes`: if regex yields 0 routes AND `hasRouteLikeSignals` is true → call Gemini

## 7. Final assembly in parseBackendRoutes

- [x] 7.1 Compose detection → framework-specific parser → normalize → dedupe → attach filePath
- [x] 7.2 For `framework: 'unknown'`, run all three parsers and union results
- [x] 7.3 Ensure no `console.log` statements remain; all errors are thrown or returned as empty array with graceful handling

## 8. Tests — Express.js

- [x] 8.1 Test: simple `app.get('/users', handler)` → 1 route, correct method/path
- [x] 8.2 Test: `router.post('/auth/login', async (req, res) => {})` → method POST, handler captured
- [x] 8.3 Test: dynamic param `router.get('/users/:id', ...)` → path preserved
- [x] 8.4 Test: nested dynamic `router.delete('/posts/:id/comments/:cid', ...)` → full path
- [x] 8.5 Test: multiple routes in one file → array length matches
- [x] 8.6 Test: duplicate route definition → deduped to one entry
- [x] 8.7 Test: `router.route('/items').get(h1).post(h2)` → 2 routes (chain pattern)

## 9. Tests — FastAPI

- [x] 9.1 Test: `@app.get("/items")` → GET /items, framework fastapi
- [x] 9.2 Test: `@router.get("/items/{item_id}")` → path normalized to `/items/:item_id`
- [x] 9.3 Test: `@app.post("/users", response_model=UserOut)` → POST /users
- [x] 9.4 Test: `@app.put("/profile")\nasync def update_profile` → handler: `update_profile`
- [x] 9.5 Test: multiple decorators → array with all routes
- [x] 9.6 Test: `@router.delete("/{id}")` → DELETE /:id

## 10. Tests — Laravel

- [x] 10.1 Test: `Route::get('/dashboard', [...])` → GET /dashboard, framework laravel
- [x] 10.2 Test: `Route::post('/login', function() {})` → POST /login
- [x] 10.3 Test: `Route::get('/users/{id}', [...])` → path `/users/:id`
- [x] 10.4 Test: `Route::delete('/posts/{post}', [...])` → DELETE /posts/:post
- [x] 10.5 Test: 4 Route:: definitions in one file → 4 routes

## 11. Tests — cross-cutting

- [x] 11.1 Test: `options.filePath` propagated to all returned routes
- [x] 11.2 Test: no `options.filePath` → `filePath` is undefined on routes
- [x] 11.3 Test: auto-detection picks correct framework from each framework's signals
- [x] 11.4 Test: `parseBackendRoutes` with explicit `framework` option skips detection
- [x] 11.5 Test: all methods lowercase in → uppercase out (normalization)
- [x] 11.6 Test: path without leading slash → slash added
