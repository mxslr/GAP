## Why

GAP needs to detect API calls made by frontend code — not just backend routes — so it can perform gap analysis (connected vs orphan vs ghost). Without a frontend parser, Mode 2 (Separate Repos) and Mode 1 (Monorepo) cannot identify which backend routes are actually consumed and which frontend calls have no corresponding backend endpoint.

## What Changes

- New module `lib/parsers/frontend.ts` that exports `parseFrontendCalls(code, options?)`
- Detects four fetch patterns: axios/axios-instance, native fetch, custom api clients, React Query (useQuery/useMutation with inline fetchers)
- Normalizes template literal paths (e.g. `/api/users/${id}` → `/api/users/:id`) and sets `isDynamic: true`
- Infers HTTP method from call name (`.get` → GET, `.post` → POST, fetch without options → GET)
- Falls back to Gemini when regex is inconclusive (e.g. function-wrapped fetchers)
- Deduplicates results; attaches `filePath` when provided in options
- New test file `tests/frontend-parser.test.ts` with ≥5 samples per pattern (≥20 cases total)

## Capabilities

### New Capabilities
- `frontend-fetch-parser`: Parse frontend source code to extract HTTP fetch calls (axios, fetch, api-client, react-query) and return structured `FrontendCall[]` with method, path, pattern, snippet, dynamic flag, and file path.

### Modified Capabilities

## Impact

- **New files**: `lib/parsers/frontend.ts`, `tests/frontend-parser.test.ts`
- **Dependencies**: `lib/gemini.ts` (existing, for Gemini fallback), `lib/types.ts` (existing, for `FrontendCall`, `HttpMethod`, `FrontendPattern`)
- **Consumers**: `app/api/analyze/route.ts` (Mode 1 + 2 analysis pipeline) — not built yet, will import `parseFrontendCalls`
- **No breaking changes** to existing modules
