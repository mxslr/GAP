## Context

GAP's Mode 1 analysis requires splitting a single repository into backend and frontend segments before running the respective parsers. Currently, there is no detection mechanism — the `lib/repo/` directory exists as a placeholder. The existing `lib/gemini.ts` exposes `generateJSON()` which is the standard way all LLM calls are made in this project. `MonorepoLayout` is already defined in `lib/types.ts`.

The detector must handle two input formats: a raw string (text tree from `tree` command or user paste) and a structured `FileTreeEntry[]`. Both must produce identical results.

## Goals / Non-Goals

**Goals:**
- Accept raw text or structured file tree input and normalize to a common internal format
- Run a heuristic pass first (no LLM, instant) using folder names and indicator files
- Fall back to Gemini classification only when heuristics are ambiguous
- Handle Nx/Turborepo `apps/` wrapper by recursing one level
- Support multi-app monorepos (return multiple paths per side)
- Support the edge case where BE and FE share a root (e.g., Next.js full-stack)
- Return empty arrays with `confidence: 'low'` for single-stack repos instead of throwing

**Non-Goals:**
- Fetching remote repos or parsing GitHub URLs (that belongs in `lib/repo/fetcher.ts`)
- Running the actual backend/frontend parsers (those are `lib/parsers/*`)
- Persisting results to the database (handled by the API route layer)
- Detecting frameworks beyond the heuristic indicators listed in the spec

## Decisions

### Decision 1: Two-pass architecture (heuristic → LLM)

**Choice:** Run folder-name and indicator-file heuristics first; call Gemini only when confidence stays at `'low'` after the heuristic pass.

**Rationale:** Most monorepos have standard folder names (`server/`, `client/`, etc.) or indicator files (`requirements.txt`, `package.json` with React). Running LLM for these wastes quota and adds latency. Gemini is reserved for ambiguous layouts.

**Alternative considered:** Always run Gemini — rejected because it burns the 1,500/day free-tier quota and adds 1–3 seconds of latency even when unnecessary.

### Decision 2: Normalize both input shapes to `FileTreeEntry[]` internally

**Choice:** Parse raw text input into `FileTreeEntry[]` before any detection logic runs. All detection operates on the structured format.

**Rationale:** A single detection function that works on one internal format is easier to test and maintain. The text parser is a thin transformation layer.

**Alternative considered:** Overloaded functions for each input type — rejected because it duplicates detection logic.

### Decision 3: Indicator files override folder-name heuristics

**Choice:** If a `package.json` inside a folder contains React/Vue/Next/Svelte, that folder is classified as frontend regardless of its name. Similarly, `requirements.txt` with FastAPI/Flask/Django → backend.

**Rationale:** Folder names are conventions but indicator files are facts. A folder named `app/` could go either way; a `package.json` with `"react"` in deps is unambiguous.

**Confidence escalation:**
- Folder name match only → `'medium'`
- Indicator file match → `'high'`
- Both sides have indicator files → `'high'`
- Neither side has clear signals → `'low'` → trigger LLM fallback

### Decision 4: Gemini prompt asks for per-folder classification

**Choice:** Send top-level folder names (and one level inside `apps/`) to Gemini with a schema requiring `{ folder, role: 'backend' | 'frontend' | 'shared' | 'other', reasoning }[]`.

**Rationale:** This is structured output via `generateJSON()`, matching the existing project convention. The schema enforces a typed response.

### Decision 5: `apps/` wrapper detection recurses exactly one level

**Choice:** If a top-level folder is named `apps/` or `packages/`, inspect its children and classify those instead.

**Rationale:** Nx and Turborepo always use `apps/` as the container. Going deeper than one level risks false positives in deeply nested repos.

## Risks / Trade-offs

- **Indicator file content requires the tree to include file contents** → For text tree input, file content is not available, so indicator-file matching falls back to filename presence only (e.g., presence of `requirements.txt` → likely FastAPI backend, but cannot confirm). This is acceptable; the LLM fallback catches ambiguous cases.

- **Next.js full-stack repos return `'/'` for both paths** → Downstream parsers must handle the case where `backendPaths` and `frontendPaths` overlap. This is a known constraint documented in the return type.

- **Gemini fallback adds latency (~1–3s)** → Only triggered when heuristics are insufficient. No mitigation needed beyond the two-retry logic already in `lib/gemini.ts`.

- **Text tree parser is brittle for non-standard formats** → Only `tree` command output and common paste formats are handled. Unknown formats degrade to heuristic-only with `confidence: 'low'`. Acceptable for hackathon scope.

## Migration Plan

No migration needed — this is a new module. It will be wired into the Mode 1 analysis flow in a future proposal (`gap-analysis-engine` or the API route layer).
