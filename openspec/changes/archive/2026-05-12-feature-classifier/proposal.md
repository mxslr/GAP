## Why

Routes detected by the gap analysis engine are currently presented as a flat list, making it hard to navigate large codebases. Grouping routes into semantic feature clusters (e.g., "Authentication", "User Management", "Payments") gives developers immediate context and dramatically improves the usability of both the gap analysis view and the API doc generator.

## What Changes

- Add `lib/analyzer/feature-classifier.ts` — new module that takes `AnalyzedRoute[]` and returns routes augmented with `featureId` plus a `FeatureGroup[]` array
- All Gemini calls routed through `lib/gemini.ts` (no direct SDK use in the classifier)
- Heuristic fallback: if Gemini fails, group routes by first path segment
- Edge-case handling: 1–2 routes collapse into a single "API" feature
- New test file `tests/feature-classifier.test.ts` covering happy path, small input, and fallback

## Capabilities

### New Capabilities

- `feature-classifier`: Groups `AnalyzedRoute[]` into semantic `FeatureGroup[]` via Gemini with heuristic fallback; returns both the feature list and routes updated with `featureId`

### Modified Capabilities

- `shared-types`: `FeatureGroup` and `AnalyzedRoute` interfaces must be confirmed stable (no new fields required — existing `featureId?: string` on `AnalyzedRoute` is sufficient)

## Impact

- **New file:** `lib/analyzer/feature-classifier.ts`
- **New file:** `tests/feature-classifier.test.ts`
- **Reads:** `lib/gemini.ts` (existing client)
- **Reads:** `lib/types.ts` (`AnalyzedRoute`, `FeatureGroup`)
- **No DB writes** — classification is in-memory; persistence layer wires this up in a later proposal
- **No API route changes** in this proposal
