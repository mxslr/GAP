## 1. Scaffold Module

- [x] 1.1 Create `lib/parsers/frontend.ts` with the exported `parseFrontendCalls(code, options?)` function signature using types from `lib/types.ts`
- [x] 1.2 Import `FrontendCall`, `HttpMethod`, `FrontendPattern` from `lib/types.ts` and `generateJSON` from `lib/gemini.ts`

## 2. Regex Pattern Implementations

- [x] 2.1 Implement axios regex: match `axios.METHOD(url)` and named instance `anyIdentifier.METHOD(url)` for GET/POST/PUT/DELETE/PATCH
- [x] 2.2 Implement native fetch regex: match `fetch(url)` and `fetch(url, { method: 'METHOD' })`; default to GET when no method option is present
- [x] 2.3 Implement custom api-client regex: match identifiers ending in `Client|Api|Service|client|api|service|http|Http` followed by `.METHOD(url)`
- [x] 2.4 Implement React Query regex: match `useQuery(...)` and `useMutation(...)` then extract the inner fetch/axios call from within the callback (500-char look-ahead)

## 3. URL Normalization

- [x] 3.1 Implement `normalizePath(raw: string): { path: string; isDynamic: boolean }` that replaces each `${...}` interpolation with `:param0`, `:param1`, etc. and sets `isDynamic: true`
- [x] 3.2 Ensure static URLs pass through unchanged with `isDynamic: false`
- [x] 3.3 Ensure paths always start with `/` (add leading slash if missing)

## 4. Result Assembly

- [x] 4.1 Merge results from all four regex passes into a single `FrontendCall[]`
- [x] 4.2 Implement deduplication: filter to unique (method, path) pairs, keeping first occurrence
- [x] 4.3 Attach `filePath` from options to every `FrontendCall` when provided

## 5. Gemini Fallback

- [x] 5.1 Implement fetch-signal heuristic: check if code contains any of `fetch(`, `axios`, `.get(`, `.post(`, `useQuery`, `useMutation`
- [x] 5.2 When regex yields 0 results AND heuristic is positive, call `generateJSON` with a prompt that asks Gemini to extract all HTTP calls and return them as `FrontendCall[]`
- [x] 5.3 Map Gemini response to `FrontendCall[]` objects, applying normalization and filePath attachment

## 6. Tests

- [x] 6.1 Create `tests/frontend-parser.test.ts` with test setup (no test runner config needed if using existing setup)
- [x] 6.2 Write ≥5 test cases for axios pattern (static URLs, template literals, named instances, multiple methods, multiple calls in one file)
- [x] 6.3 Write ≥5 test cases for native fetch pattern (no options → GET, explicit POST/PUT/DELETE/PATCH, template literal, await form, PATCH with headers)
- [x] 6.4 Write ≥5 test cases for custom api-client pattern (apiClient, httpClient, userService, http, client with template literal, paymentApi)
- [x] 6.5 Write ≥5 test cases for React Query pattern (useQuery+fetch, useQuery+axios, useMutation+axios, template literal URL, DELETE inside useMutation, multiple hooks)
- [x] 6.6 Write test cases for: template literal normalization (single/multi interpolation, static unchanged), deduplication, filePath propagation
- [x] 6.7 Run tests and confirm all pass: `npx vitest run tests/frontend-parser.test.ts`
