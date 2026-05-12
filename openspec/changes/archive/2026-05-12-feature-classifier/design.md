## Context

The gap analysis engine (`lib/analyzer/gap.ts`) already produces `AnalyzedRoute[]` with an empty `featureId`. The `GapAnalysisResult.features` array is always `[]` post-analysis. This module fills that gap: it consumes the flat route list and emits feature-annotated routes plus a `FeatureGroup[]` that the result layer can surface.

Gemini is already wired for JSON-mode via `lib/gemini.ts`, which provides exponential-backoff retry and centralised SDK access. `FeatureGroup` and `AnalyzedRoute.featureId` are already defined in `lib/types.ts`.

## Goals / Non-Goals

**Goals:**
- Accept `AnalyzedRoute[]`, return the same routes with `featureId` set plus a populated `FeatureGroup[]`
- Use Gemini (`generateJSON`) to semantically cluster routes by first-path-segment intent
- Gracefully degrade: heuristic fallback when Gemini is unavailable; single "API" feature for ≤ 2 routes
- Be testable in isolation (pure function, Gemini mockable at the module boundary)

**Non-Goals:**
- Persisting features to the database (handled in a later proposal)
- Generating fetch snippets or TS types (handled by `lib/generators/snippets.ts`)
- Classifying routes during gap analysis itself (caller responsibility to pipe output)

## Decisions

### D1 — Gemini prompt returns `routeIndices` (not route paths)

**Decision:** Ask Gemini to return `{ features: [{ name, description, routeIndices: number[] }] }` where each index maps into the input array.

**Why over returning paths:** Paths can be long, ambiguous, or duplicated across methods. Indices are compact, unambiguous, and avoid any re-matching logic. The classifier owns the array order, so indices are stable within one call.

**Alternative considered:** Return route IDs from Gemini. Rejected because UUIDs are noisy tokens; Gemini would waste context on them and hallucination risk is higher on arbitrary strings.

### D2 — Heuristic fallback groups by first non-empty path segment

**Decision:** On any Gemini error, extract the first non-empty segment after `/api/` (or root segment if no `/api/` prefix) and use that as the feature name (Title Case). Unrecognised paths fall into "General".

**Why:** This is deterministic, zero-latency, and handles the most common naming conventions without a network call. A judge demo should never fail silently.

**Alternative considered:** Return all routes in a single "API" feature on failure. Rejected because it loses useful grouping and makes the fallback indistinguishable from the ≤ 2-route edge case.

### D3 — UUID generation via `crypto.randomUUID()`

**Decision:** Use the built-in `crypto.randomUUID()` (Node 14.17+ / Next.js runtime). No external UUID library.

**Why:** Zero dependencies; sufficient for in-memory IDs before persistence.

### D4 — Edge case: ≤ 2 routes → single "API" feature, skip Gemini

**Decision:** If input has 0–2 routes, skip the Gemini call entirely and return a single feature named "API" with all routes assigned to it.

**Why:** Gemini classification of 1–2 routes adds latency with no useful signal. Keeping it deterministic also simplifies tests.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Gemini hallucinates an out-of-bounds `routeIndex` | Clamp/ignore indices outside `[0, routes.length - 1]`; assign unclaimed routes to a "General" feature |
| Route appears in multiple `routeIndices` arrays | First assignment wins; duplicates are ignored |
| Gemini returns fewer features than expected (all routes in one cluster) | Acceptable — return whatever Gemini gives; heuristic fallback only kicks in on thrown errors |
| `generateJSON` rate-limit retry adds latency on busy hours | Retry is already capped at 2 attempts in `lib/gemini.ts`; no additional handling needed here |

## Migration Plan

No migration needed. This is a new module with no DB writes. Existing `analyzeGap` output is unchanged — callers opt in by passing routes through `classifyFeatures` after gap analysis.
