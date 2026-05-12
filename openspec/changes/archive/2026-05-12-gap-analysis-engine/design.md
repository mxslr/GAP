## Context

The parsers (backend-route-parser, frontend-fetch-parser) produce `BackendRoute[]` and `FrontendCall[]`. Both types are defined in `lib/types.ts`. The gap analysis engine is the bridge that compares these two lists and produces the `GapAnalysisResult` used by the API layer and UI.

Currently no matching logic exists. API routes return raw parser output with no classification.

Key constraint: path shapes differ between BE and FE. Backend uses Express-style params (`:id`), FastAPI uses `{id}`, and frontend uses template literals (`${id}`) or plain strings. Normalization must unify these before comparison.

## Goals / Non-Goals

**Goals:**
- Classify every route as `connected`, `orphan`, or `ghost`
- Handle dynamic path segments across all three syntaxes
- Be case-insensitive and trailing-slash-tolerant
- Provide a separate `buildDocumentedRoutes` path for Mode 3 (no frontend)
- Return empty `features: []` array (filled in by feature-classifier, next proposal)
- Be fully testable with no external dependencies

**Non-Goals:**
- Feature classification (delegated to `lib/analyzer/feature-classifier.ts`)
- Snippet generation or TS type generation (delegated to `lib/generators/snippets.ts`)
- Persistence — this module is pure transformation, no DB calls
- GitHub URL fetching or file system access

## Decisions

### Decision 1: Normalize paths to a canonical form before matching

**Choice:** Convert all path segments to a regex pattern, replacing dynamic segments (`:id`, `{id}`, `${variableName}`, or any `${}` expression) with a single wildcard token `__PARAM__`.

**Rationale:** Regex-per-route is the simplest approach that handles all three param syntaxes in one pass. Alternatives:
- Segment-by-segment comparison: more code, same result
- Levenshtein distance: false positives on similar but distinct paths like `/users` vs `/posts`

**Normalization steps:**
1. Lowercase the path
2. Strip trailing slash (unless path is `/`)
3. Replace `:word`, `{word}`, `${...}` with `__PARAM__`
4. The normalized form is used as the match key

### Decision 2: Method must match exactly (no wildcards)

GET `/api/users` does NOT match POST `/api/users`. This is deliberate — same path with different methods are distinct routes.

### Decision 3: Ghost routes come from unmatched FrontendCalls

For every `FrontendCall` that has no matching `BackendRoute`, create a synthetic `AnalyzedRoute` with `status: 'ghost'` and `detectedIn: 'frontend'`.

**Rationale:** The `GapAnalysisResult.routes` array must contain ALL routes (BE + FE unmatched) so the UI can render a complete list. Returning them separately would complicate UI logic.

### Decision 4: `buildDocumentedRoutes` is a simple map, not a full analysis

For Mode 3 (backend-only), there is no frontend to compare. Every route is `documented`. This function just maps `BackendRoute[]` → `AnalyzedRoute[]` with status `'documented'` and `detectedIn: 'backend'`. No matching, no summary ghosts/orphans.

### Decision 5: IDs generated with `crypto.randomUUID()`

`AnalyzedRoute.id` requires a UUID. Node.js `crypto.randomUUID()` is available without additional dependencies.

## Risks / Trade-offs

- **False positives on generic dynamic routes**: `/api/:resource/:id` (BE) will match `/api/users/settings` (FE) even if they're different. Mitigation: acceptable for hackathon scope — segment count is part of the key (only segments at same position are wildcarded).
- **Method case sensitivity**: Parsers may return methods in mixed case. Mitigation: normalize method to uppercase before comparison.
- **Empty input edge cases**: Both empty arrays → result has 0 routes, all zeroes in summary. Validated in tests.

## Migration Plan

No migration needed. This is a new module with no existing callers yet. The API route (`app/api/analyze/route.ts`) will import `analyzeGap` in a later proposal. No database schema changes required.

## Open Questions

None. All design decisions made based on the provided spec.
