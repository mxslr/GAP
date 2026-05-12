## Context

The gap analyzer (`lib/analyzer/gap.ts`) produces `AnalyzedRoute[]` objects that carry method, path, and status but no usage code. Developers seeing an orphan or ghost route need ready-to-use fetch code and TypeScript types to act on the finding. Gemini (`lib/gemini.ts`) is already wired up as the project's single AI client. The `SnippetCache` Prisma model exists in the schema precisely to avoid re-querying Gemini for the same route.

## Goals / Non-Goals

**Goals:**
- Expose `generateSnippets(route)` for single-route generation
- Expose `generateSnippetsBatch(routes)` that sends all routes in a single Gemini call to minimize quota usage
- Check `SnippetCache` before every Gemini call; populate it after
- Return structured `{ fetchSnippet, tsTypes, description }` per route
- Write tests covering single, batch, cache-hit, and Gemini-error paths

**Non-Goals:**
- Generating snippets in languages other than TypeScript/JavaScript
- Storing snippets in the `Route` model (that belongs to persistence proposal #11)
- Rate limiting or request queuing beyond the 2-retry backoff already in `lib/gemini.ts`
- Frontend UI to display snippets (belongs to proposal #9)

## Decisions

### 1. Batch over per-route calls

**Decision:** `generateSnippetsBatch` sends all routes in one prompt, returning a JSON array.

**Why:** Gemini free tier is 1,500 req/day. A typical analysis of 40 routes would exhaust ~3% of daily quota per run if called one-by-one. A single batch call costs 1 request regardless of route count.

**Alternative considered:** Parallel per-route calls with `Promise.all` — rejected because it multiplies quota usage by route count and risks 429s under concurrent analysis runs.

### 2. Cache key = SHA-1 of `"{method}:{path}"`

**Decision:** Use Node's `crypto.createHash('sha1')` on the normalized key string.

**Why:** SHA-1 produces a fixed 40-char hex string suitable as a primary key. The method+path pair is the stable identity of a route regardless of which analysis produced it.

**Alternative considered:** Raw `method:path` as key — rejected because paths like `/users/:id/posts/:postId` can be long and contain characters that complicate DB indexing.

### 3. Gemini response schema with `results` array

**Decision:** Prompt Gemini to return `{ results: [{ routeKey, description, fetchSnippet, tsTypes }] }` with `responseMimeType: 'application/json'`.

**Why:** Structured output mode prevents Gemini from wrapping JSON in markdown fences or adding prose, which would require fragile regex stripping. The `routeKey` field (`"METHOD:path"`) lets us map results back to routes without relying on array ordering.

**Alternative considered:** Separate prompt per route — rejected (see Decision 1). Relying on array index order — rejected because Gemini may reorder or skip items under token pressure.

### 4. Single-route `generateSnippets` delegates to `generateSnippetsBatch`

**Decision:** `generateSnippets(route)` calls `generateSnippetsBatch([route])` and unwraps the first result.

**Why:** Keeps cache logic and prompt construction in one place. Zero code duplication.

### 5. Snippet format: axios primary + native fetch fallback

**Decision:** Each `fetchSnippet` contains both axios and native fetch in one code block, separated by a `// --- native fetch ---` comment.

**Why:** Teams that don't use axios can still copy the fallback without editing. This matches the requirement in the proposal and keeps the snippet self-contained.

## Risks / Trade-offs

- **Gemini timeout on large batches** → Mitigation: if route count > 50, split into chunks of 50 and run sequentially (still far fewer calls than per-route).
- **Cache staleness** → Snippets are tied to method+path, not to handler logic. If a handler's request body changes, the cache will serve stale types. Mitigation: document that `SnippetCache` should be cleared when the schema changes; add a `createdAt` field for TTL-based eviction in the future.
- **Gemini hallucinated types** → The prompt specifies interfaces over type aliases and PascalCase naming, but Gemini may still produce inaccurate shapes for unknown APIs. Mitigation: mark snippets as "AI-generated — verify against your actual schema" in the template string.

## Open Questions

- Should `generateSnippetsBatch` skip routes that already have a cache hit and only call Gemini for the misses? (Recommended yes — reduces batch size further; implemented in the module.)
- What chunking threshold to use for large route sets? Using 50 as default; can be made configurable via env var later.
