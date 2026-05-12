## Why

GAP's Mode 1 (Monorepo) requires automatically identifying which folders in a single repo are backend vs. frontend. Without this, users in monorepo mode must manually label their folders, which defeats the "zero annotation" promise. This capability is the entry point for Mode 1 analysis.

## What Changes

- Add `lib/repo/monorepo-detector.ts` — a new module exposing `detectMonorepoLayout()`
- The function accepts either a raw text file tree (e.g., from `tree` command output) or a structured `FileTreeEntry[]`
- Detection runs in two passes: a fast heuristic pass, then a Gemini LLM fallback if confidence is ambiguous
- Returns a `MonorepoLayout` with `backendPaths`, `frontendPaths`, confidence level, and optional reasoning
- Add `tests/monorepo-detector.test.ts` with 6+ test scenarios covering common monorepo layouts

## Capabilities

### New Capabilities

- `monorepo-detector`: Detects backend and frontend folder boundaries within a single repository using heuristic rules and an AI fallback, returning structured `MonorepoLayout` output consumed by the Mode 1 analysis pipeline.

### Modified Capabilities

- `shared-types`: `FileTreeEntry` type needs to be added to `lib/types.ts` to support structured tree input alongside the existing `MonorepoLayout` type (already defined).

## Impact

- **New file**: `lib/repo/monorepo-detector.ts`
- **New file**: `tests/monorepo-detector.test.ts`
- **Modified**: `lib/types.ts` — adds `FileTreeEntry` interface
- **Depends on**: `lib/gemini.ts` (for LLM fallback via existing Gemini client)
- **Consumed by**: future `app/api/analyze/route.ts` (Mode 1 dispatch path)
- **No API route changes** in this proposal — detector is a library module only
