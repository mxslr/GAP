## Why

GAP needs to extract HTTP routes from backend codebases before it can perform gap analysis or generate API docs. Without a backend parser, the core value proposition (detecting connected/orphan routes) cannot work. This is proposal #2 in the roadmap, directly enabling proposals #5 (gap-analysis-engine) and #8 (api-doc-generator).

## What Changes

- Add `lib/parsers/backend.ts` — new module exposing `parseBackendRoutes(code, options?)` that extracts HTTP routes from Express.js, FastAPI, and Laravel source code
- Add `tests/backend-parser.test.ts` — test suite with ≥5 samples per framework including edge cases
- Regex-first approach with Gemini fallback for ambiguous patterns
- Framework auto-detection when not specified in options
- Path normalization and deduplication baked in

## Capabilities

### New Capabilities
- `backend-route-parser`: Parses HTTP route definitions from Express.js (Node.js), FastAPI (Python), and Laravel (PHP) source code, returning structured `BackendRoute[]` with method, path, framework, handler name, raw snippet, and optional file path.

### Modified Capabilities
<!-- No existing spec-level requirements are changing. -->

## Impact

- **New file**: `lib/parsers/backend.ts`
- **New file**: `tests/backend-parser.test.ts`
- **Depends on**: `lib/types.ts` (existing — `BackendRoute`, `HttpMethod`, `BackendFramework`) and `lib/gemini.ts` (existing — Gemini client for fallback)
- **Used by**: `app/api/analyze/route.ts` (future), `lib/repo/monorepo-detector.ts` (future)
- **No breaking changes** to existing modules
