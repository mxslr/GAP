## Why

GAP has parsers for backend routes and frontend fetch calls, but no module to compare them. Without gap analysis, we cannot identify dead backend routes (orphans), missing backend routes (ghosts), or confirm which routes are properly connected — the core value proposition of the platform.

## What Changes

- New module `lib/analyzer/gap.ts` with two exported functions:
  - `analyzeGap(backendRoutes, frontendCalls): GapAnalysisResult` — performs BE↔FE matching and returns classified routes with summary counts
  - `buildDocumentedRoutes(backendRoutes): AnalyzedRoute[]` — wraps backend-only routes as `documented` status for Mode 3
- Path normalization: trailing slash, case insensitivity, dynamic param segment matching (`:id` matches `123`, `abc`, `${id}`)
- `features` field in `GapAnalysisResult` returned as empty array (to be filled by feature-classifier in next proposal)
- New test file `tests/gap-analyzer.test.ts` covering all matching scenarios

## Capabilities

### New Capabilities

- `gap-analysis`: Core BE↔FE matching engine. Classifies routes as `connected`, `orphan`, or `ghost`. Supports exact match, dynamic param match, and trailing-slash-tolerant matching. Provides `buildDocumentedRoutes` for backend-only mode.

### Modified Capabilities

- `shared-types`: No requirement change — `GapAnalysisResult` and `AnalyzedRoute` already defined in `lib/types.ts`. No spec delta needed.

## Impact

- **New file**: `lib/analyzer/gap.ts`
- **New file**: `tests/gap-analyzer.test.ts`
- **Reads from**: `lib/types.ts` (BackendRoute, FrontendCall, GapAnalysisResult, AnalyzedRoute, FeatureGroup)
- **Used by**: future `app/api/analyze/route.ts` and `lib/generators/api-docs.ts`
- **No new dependencies** — pure TypeScript logic, no external packages
