## Context

GAP's analysis pipeline starts with parsing backend source code into structured route data. Currently no parser exists. The `lib/types.ts` already defines `BackendRoute`, `HttpMethod`, and `BackendFramework` — this design must produce exactly those types. `lib/gemini.ts` provides the Gemini client for fallback. The parser must work in isolation (no DB, no network) so it can be called from API routes, tests, and future CLI tooling.

Three frameworks are in scope: Express.js (Node/TypeScript), FastAPI (Python), Laravel (PHP). Each has distinct syntax patterns but all map to the same `{method, path}` tuple.

## Goals / Non-Goals

**Goals:**
- Export `parseBackendRoutes(code, options?)` as the single public API
- Auto-detect framework from code when not supplied
- Extract routes via regex for well-known patterns (zero LLM cost)
- Fall back to Gemini for ambiguous code (decorator chaining, dynamic routing, custom helpers)
- Normalize output: uppercase method, leading `/` on path, deduplicated
- Attach `filePath` from options to every route for monorepo traceability
- Provide ≥5 test cases per framework including edge cases

**Non-Goals:**
- Parsing middleware logic or extracting request/response schemas (that's `lib/generators/snippets.ts`)
- Resolving relative imports or multi-file route composition
- Supporting frameworks beyond Express, FastAPI, Laravel in this iteration
- Caching parsed results (snippet cache is for generated content, not parsed routes)

## Decisions

### D1 — Regex-first, Gemini-fallback

**Decision**: Attempt regex extraction first; invoke Gemini only if regex yields 0 results on code that looks like it contains routes.

**Rationale**: Regex is deterministic, instant, and free. Most real-world Express/FastAPI/Laravel code follows well-known patterns. Gemini costs quota and latency. Fallback is a safety net, not the primary path.

**Alternative considered**: Always send to Gemini — rejected because it burns free-tier quota on simple files and adds 2–4s latency per file.

**Threshold for fallback**: If regex finds 0 routes AND the code contains route-like signals (HTTP method words, path strings starting with `/`, decorator syntax), invoke Gemini. If regex finds ≥1 route, skip Gemini entirely.

---

### D2 — Framework auto-detection order

**Decision**: Detect in this priority order:
1. Explicit `options.framework` → skip detection
2. FastAPI signals: `from fastapi import`, `@app.get`, `@router.`
3. Laravel signals: `Route::get`, `Route::post`, `use Illuminate\`
4. Express signals: `require('express')`, `app.get(`, `router.get(`
5. If none match → try all three regex sets, return union

**Rationale**: FastAPI and Laravel have more unique syntax markers than Express (which can look like generic JS). Trying all on unknown input ensures maximum recall.

---

### D3 — Regex patterns per framework

**Express**: Match `(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"\`]([^'"\`]+)['"\`]`
Also match `router\.route\(['"\`]([^'"\`]+)['"\`]\)\.(get|post|put|delete|patch)`

**FastAPI**: Match `@(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]`
Also match decorator chaining like `@router.get("/path", ...)` across multiple lines.

**Laravel**: Match `Route::(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]`
Also match `Route::apiResource\('([^']+)',` and expand to standard REST routes.

---

### D4 — Gemini prompt and response schema

When falling back:
```
Prompt: "Extract all HTTP route definitions from this code. Return ONLY a JSON array."
responseSchema: { type: ARRAY, items: { method: STRING, path: STRING } }
responseMimeType: 'application/json'
```

Map returned objects to `BackendRoute` with `framework` from the detection step and `rawSnippet` set to the matched line(s). Use max 2 retries with exponential backoff (as per CLAUDE.md Gemini guidelines).

---

### D5 — Handler extraction (best-effort)

For Express: capture the second argument to the route call (function name or arrow) as `handler`.
For FastAPI: capture the function name defined immediately after the decorator.
For Laravel: capture the second argument (controller string or closure name).

Handler is optional — missing it is not an error.

---

### D6 — Deduplication key

Deduplicate on `method.toUpperCase() + ':' + normalizedPath`. Last-seen wins (preserves handler info from later duplicate). This handles files that re-define routes in conditional blocks.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Regex misses template literals or multiline route strings | Gemini fallback catches these; add test cases for template literals |
| FastAPI path parameters use `{param}` not `:param` | Normalize FastAPI `{param}` → `:param` in output for consistency with Express/Laravel |
| Laravel `Route::resource` expands to 7 routes — complex to enumerate | Detect `resource`/`apiResource` and expand using known REST convention; document limitation if partial |
| Gemini quota exhaustion during heavy analysis | Fallback only triggers on 0-result files; most files will be handled by regex |
| Handler extraction regex is fragile for complex closures | Mark handler as `undefined` gracefully; never throw on handler extraction failure |
