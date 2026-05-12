## 1. Types Verification

- [x] 1.1 Confirm `FeatureGroup` interface exists in `lib/types.ts` with fields `id`, `name`, `description?`, `routeIds`
- [x] 1.2 Confirm `AnalyzedRoute` interface in `lib/types.ts` includes `featureId?: string`
- [x] 1.3 If either is missing, add the field to `lib/types.ts`

## 2. Core Classifier Implementation

- [x] 2.1 Create `lib/analyzer/feature-classifier.ts` with exported function `classifyFeatures(routes: AnalyzedRoute[]): Promise<{ features: FeatureGroup[], routesWithFeatureId: AnalyzedRoute[] }>`
- [x] 2.2 Implement the ≤ 2 routes edge case: skip Gemini, return single "API" feature with all routes assigned
- [x] 2.3 Build the Gemini prompt that lists each route as `[index] METHOD /path` and instructs Gemini to return `{ features: [{ name, description, routeIndices }] }`
- [x] 2.4 Call `generateJSON` from `lib/gemini.ts` with the prompt and response schema
- [x] 2.5 Process Gemini response: generate a UUID per feature via `crypto.randomUUID()`, assign `featureId` to each route by matching `routeIndices`
- [x] 2.6 Handle out-of-bounds indices (ignore silently) and duplicate indices (first assignment wins)
- [x] 2.7 Collect unassigned routes into a "General" feature appended to the result

## 3. Heuristic Fallback

- [x] 3.1 Implement `heuristicClassify(routes: AnalyzedRoute[])` private helper that groups by first path segment after `/api/` prefix (or root segment), Title-Casing the name
- [x] 3.2 Routes with no usable segment (e.g. `/`) go to "General"
- [x] 3.3 Wrap the Gemini call in try/catch and invoke `heuristicClassify` on any thrown error

## 4. Tests

- [x] 4.1 Create `tests/feature-classifier.test.ts`
- [x] 4.2 Write test: 10 routes across `/api/auth/*`, `/api/users/*`, `/api/posts/*` → expect 3 features, all routes assigned with featureId
- [x] 4.3 Write test: 2 routes → 1 feature named "API", no Gemini call made
- [x] 4.4 Write test: heuristic fallback — mock `generateJSON` to throw, assert routes grouped by path segment and function does not throw
- [x] 4.5 Write test: out-of-bounds `routeIndex` from Gemini is ignored without error
- [x] 4.6 Write test: duplicate `routeIndex` uses first-assignment rule
- [x] 4.7 Write test: unassigned routes end up in "General" feature
- [x] 4.8 Run `npx tsc --noEmit` and confirm no TypeScript errors
- [x] 4.9 Run the test suite and confirm all feature-classifier tests pass
