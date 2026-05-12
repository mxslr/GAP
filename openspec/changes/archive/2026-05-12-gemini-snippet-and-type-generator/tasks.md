## 1. Cache Key Utility

- [x] 1.1 In `lib/generators/snippets.ts`, implement `cacheKey(method: string, path: string): string` using `crypto.createHash('sha1')` on `"{METHOD}:{path}"` and returning the hex digest

## 2. Cache Layer

- [x] 2.1 Implement `getCached(key: string)` that queries `SnippetCache` via Prisma by primary key and returns `{ fetchSnippet, tsTypes, description }` or `null`
- [x] 2.2 Implement `setCached(key: string, data: { fetchSnippet, tsTypes, description })` that upserts a row into `SnippetCache`

## 3. Gemini Prompt & Parsing

- [x] 3.1 Write `buildBatchPrompt(routes: AnalyzedRoute[]): string` that formats all routes into a single Gemini prompt requesting the `{ results: [...] }` JSON structure described in the proposal
- [x] 3.2 Write `parseGeminiResponse(raw: string): Map<string, SnippetResult>` that parses the JSON array and maps each entry by `routeKey`; throws on malformed JSON or missing `results`

## 4. Core Generator Functions

- [x] 4.1 Implement `generateSnippetsBatch(routes: AnalyzedRoute[]): Promise<Map<string, SnippetResult>>`:
  - Check cache for each route; collect misses
  - If no misses, return cached map immediately
  - For misses > 50, chunk into groups of ≤ 50 and call Gemini sequentially
  - Call `callGemini` from `lib/gemini.ts` with `responseMimeType: 'application/json'`
  - Parse response, store each result in `SnippetCache`, merge with cached results
- [x] 4.2 Implement `generateSnippets(route: AnalyzedRoute): Promise<SnippetResult>` as a thin wrapper that calls `generateSnippetsBatch([route])` and returns the single result

## 5. Type Definitions

- [x] 5.1 Export `interface SnippetResult { fetchSnippet: string; tsTypes: string; description: string }` from `lib/generators/snippets.ts`

## 6. Tests

- [x] 6.1 In `tests/snippet-generator.test.ts`, write test: cache hit returns cached data without calling Gemini
- [x] 6.2 Write test: cache miss calls Gemini, populates cache, returns result
- [x] 6.3 Write test: `generateSnippetsBatch` with partial cache — only uncached routes sent to Gemini
- [x] 6.4 Write test: batch > 50 routes chunks into multiple Gemini calls
- [x] 6.5 Write test: `generateSnippets` delegates to `generateSnippetsBatch` correctly
- [x] 6.6 Write test: Gemini returns malformed JSON — function throws descriptive error
- [x] 6.7 Write test: POST route snippet contains `body`/`data` in both axios and fetch examples
- [x] 6.8 Write test: GET route with `:id` param snippet references param variable in URL
