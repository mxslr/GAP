## Why

Routes detected by the gap analyzer currently have no usage examples or type definitions, making it hard for developers to consume them. This module adds AI-generated fetch snippets and TypeScript types per route so developers get copy-paste-ready code instantly, while a cache layer prevents burning Gemini's free-tier quota on repeated lookups.

## What Changes

- New module `lib/generators/snippets.ts` exposing `generateSnippets` (single route) and `generateSnippetsBatch` (all routes in one Gemini call)
- Cache layer using the existing `SnippetCache` Prisma model — key is SHA-1 hash of `"{method}:{path}"`, checked before every Gemini call and populated after
- Gemini called via `lib/gemini.ts` exclusively — no direct SDK instantiation in feature code
- Each result contains: `fetchSnippet` (axios primary + native fetch fallback), `tsTypes` (PascalCase interfaces), `description` (one sentence)
- Test file `tests/snippet-generator.test.ts` covering single-route, batch, and cache-hit scenarios

## Capabilities

### New Capabilities

- `snippet-and-type-generator`: Generates fetch code snippets and TypeScript interface definitions for API routes using Gemini, with a database-backed cache to avoid redundant API calls

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **New file:** `lib/generators/snippets.ts`
- **New file:** `tests/snippet-generator.test.ts`
- **Reads:** `lib/gemini.ts` (existing helper), `lib/types.ts` (`AnalyzedRoute`), Prisma `SnippetCache` model
- **Writes:** `SnippetCache` table rows on cache miss
- **Quota:** batch strategy + aggressive caching keeps Gemini calls well under 1,500/day free limit
