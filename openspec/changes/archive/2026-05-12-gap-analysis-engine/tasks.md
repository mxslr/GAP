## 1. Core Gap Analyzer Module

- [x] 1.1 Create `lib/analyzer/gap.ts` with imports for `BackendRoute`, `FrontendCall`, `GapAnalysisResult`, `AnalyzedRoute` from `lib/types.ts`
- [x] 1.2 Implement `normalizePath(path: string): string` — lowercase, strip trailing slash, replace `:word` / `{word}` / `${...}` with `__PARAM__`
- [x] 1.3 Implement `normalizeMethod(method: string): string` — uppercase trim
- [x] 1.4 Implement `makeMatchKey(method: string, path: string): string` — `"${normalizeMethod}:${normalizePath}"`
- [x] 1.5 Implement `analyzeGap(backendRoutes: BackendRoute[], frontendCalls: FrontendCall[]): GapAnalysisResult` — build FE key set, iterate BE routes to classify connected/orphan, then iterate unmatched FE calls to produce ghost routes
- [x] 1.6 Implement `buildDocumentedRoutes(backendRoutes: BackendRoute[]): AnalyzedRoute[]` — map each route to `status: 'documented'`, `detectedIn: 'backend'`
- [x] 1.7 Ensure `GapAnalysisResult.features` is always returned as `[]`
- [x] 1.8 Ensure `GapAnalysisResult.mode` is set to `'separate'` as default (callers may override)

## 2. Tests

- [x] 2.1 Create `tests/gap-analyzer.test.ts` with test runner imports (Jest or Vitest, matching existing test setup)
- [x] 2.2 Write test: simple exact-match → 1 connected route, summary `{total:1, connected:1, orphan:0, ghost:0}`
- [x] 2.3 Write test: dynamic param match (`:id` BE vs `123` FE) → connected
- [x] 2.4 Write test: dynamic param match (`:id` BE vs `${userId}` FE) → connected
- [x] 2.5 Write test: FastAPI param match (`{item_id}` BE vs `99` FE) → connected
- [x] 2.6 Write test: trailing slash tolerance (`/api/users/` == `/api/users`) → connected
- [x] 2.7 Write test: case insensitive path (`/API/Users` == `/api/users`) → connected
- [x] 2.8 Write test: method mismatch → GET BE is orphan, POST FE is ghost
- [x] 2.9 Write test: empty backend → all FE calls become ghost, summary has `ghost: N`
- [x] 2.10 Write test: empty frontend → all BE routes become orphan, summary has `orphan: N`
- [x] 2.11 Write test: mixed scenario (2 connected, 1 orphan, 1 ghost) → correct summary counts
- [x] 2.12 Write test: `buildDocumentedRoutes` maps all routes to `documented` status
- [x] 2.13 Write test: `buildDocumentedRoutes` with empty input returns `[]`
- [x] 2.14 Write test: `features` is always `[]` in `analyzeGap` result

## 3. Verification

- [x] 3.1 Run `npx tsc --noEmit` — confirm no TypeScript errors
- [x] 3.2 Run tests — confirm all test cases pass
