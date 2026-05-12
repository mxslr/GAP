## Context

GAP's Mode 3 (Backend-Only) currently runs the backend parser and feature classifier but produces no user-facing output. The existing `snippet-and-type-generator` (`lib/generators/snippets.ts`) already generates fetch snippets and TypeScript types per route via Gemini. The `api-doc-generator` module builds on top of that — it orchestrates snippet generation for any missing routes, then enriches each route with detailed prose and produces two output formats: Markdown (for rendering in the UI) and OpenAPI 3.0 JSON (for export/integration).

Existing modules used as building blocks:
- `lib/gemini.ts` — all Gemini calls go through here
- `lib/generators/snippets.ts` — `generateSnippets(route)` returns description, fetchSnippet, tsTypes
- `lib/parsers/backend.ts` — parses raw backend code into `BackendRoute[]`
- `lib/analyzer/feature-classifier.ts` — groups routes into `FeatureGroup[]`

## Goals / Non-Goals

**Goals:**
- `generateApiDocs(routes, features)` function that enriches routes and returns `{ markdown, openapi }`
- Per-route enrichment via Gemini: 2-3 sentence description, example request body (POST/PUT/PATCH), example response JSON, possible error codes
- Markdown structured by feature (TOC, feature sections, per-route subsections with typed code blocks)
- OpenAPI 3.0 JSON with `info`, `paths`, and `components.schemas` from tsTypes
- `POST /api/docs` endpoint accepting `{ backendCode: string }` — runs full pipeline and returns docs + analysisId
- SnippetCache integration: never call Gemini twice for the same method+path
- Tests in `tests/api-doc-generator.test.ts`

**Non-Goals:**
- UI rendering (handled in proposal #10 — docs-generator-page)
- GitHub URL fetching (proposal #11 scope)
- OpenAPI validation or linting
- Support for multiple backend frameworks simultaneously (parser handles that)

## Decisions

### 1. Batch Gemini enrichment, not per-route

**Decision:** Collect all routes needing enrichment, call Gemini once with the full batch using a JSON schema response, then map results back to routes.

**Why:** Individual Gemini calls per route would be slow (N round trips) and burn free-tier quota fast. A single structured call with `responseSchema` returns all enrichment in one shot. The existing `snippets.ts` uses per-route calls — for doc generation we need more data per route, so batching is worth the added complexity.

**Alternative considered:** Stream per-route calls in parallel (Promise.all). Rejected because it risks hitting Gemini's concurrent request limit and is harder to cache atomically.

### 2. Two-phase generation: snippets first, then enrichment

**Decision:** For each route, check if `fetchSnippet` and `tsTypes` are already populated. If not, call `generateSnippets` (which handles its own SnippetCache lookup). Then run a second Gemini call for the richer enrichment (description prose, example body, example response, error codes).

**Why:** `snippets.ts` already has cache-aware logic and returns lean data. The doc enrichment needs different prompting (prose, examples) so it's a separate concern. Separating them keeps `snippets.ts` reusable for the flat/feature views and avoids polluting SnippetCache with doc-specific data.

### 3. OpenAPI built from tsTypes string parsing (best-effort)

**Decision:** Convert tsTypes strings to OpenAPI schema objects using a regex-based extractor. Mark as `$ref` into `components.schemas`. Fall back to `{ type: 'object' }` for anything that can't be parsed.

**Why:** Full TypeScript-to-JSON-Schema conversion requires a TS compiler or heavy library. For a hackathon, best-effort regex extraction (interface name + properties) gives usable schemas without adding dependencies. Judges will see realistic-enough OpenAPI output.

### 4. Markdown format fixed, not configurable

**Decision:** Use a single, hardcoded Markdown template structure (TOC → feature sections → route subsections). No templating library.

**Why:** Only one output consumer (the docs-generator UI). Configurability adds complexity with no current benefit. Template is defined in code, easy to adjust.

## Risks / Trade-offs

- **Gemini batch timeout** → If a repo has 50+ routes the enrichment prompt may exceed Gemini's output token limit. Mitigation: chunk into batches of 20 routes, retry with exponential backoff on errors.
- **tsTypes → OpenAPI parsing fragility** → Regex may fail on complex generics or union types. Mitigation: always fall back to `{ type: 'object', description: 'See TypeScript type' }` so output is always valid OpenAPI.
- **SnippetCache miss on first run** → Mode 3 is the first time routes are analyzed, so cache is cold. All routes will hit Gemini. Acceptable for hackathon scale (< 30 routes in demo).
- **No streaming** → Large repos (100+ routes) will have a perceived 20-30s wait. Non-goal for hackathon; loading state in UI covers this.
