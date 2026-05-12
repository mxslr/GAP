## Context

GAP currently returns analysis results directly in the HTTP response and discards them. The Prisma schema already defines all required models (`Analysis`, `Route`, `Feature`, `ApiDoc`, `SnippetCache`) and the `lib/db.ts` singleton is in place. What is missing is the write path (saving results) and the read path (list + detail endpoints + history/detail UI pages).

## Goals / Non-Goals

**Goals:**
- Persist every completed gap analysis and docs generation to PostgreSQL
- Expose `GET /api/analyses` (list) and `GET /api/analyses/:id` (detail) endpoints
- Add `/history`, `/analyze/[id]`, and `/docs-generator/[id]` pages
- Degrade gracefully — DB failures must never break the primary analysis flow

**Non-Goals:**
- User authentication / per-user filtering of history
- Editing or deleting past analyses via UI
- Real-time updates / WebSocket
- Pagination beyond a simple `limit` query param

## Decisions

### 1. Persistence is fire-and-forget after response (no blocking)
The DB write happens *before* returning the HTTP response, but is wrapped in a `try/catch` so that a DB failure never causes the endpoint to return 5xx. The response includes the `analysisId` from the DB record (or `null` on failure) so the client can optionally navigate to the detail page.

**Why**: Hackathon constraint — keeping the critical path reliable is more important than guaranteed persistence. If Prisma throws, the user still gets their result.

**Alternative considered**: Fire-and-forget `setImmediate` after sending response. Rejected because Next.js serverless functions may terminate before the promise resolves.

### 2. Save to DB inside existing API route handlers, not middleware
Persistence logic lives directly in `app/api/analyze/route.ts` and `app/api/docs/route.ts` using the Prisma client from `lib/db.ts`. No separate abstraction layer.

**Why**: Zero ceremony, fewer indirections. The save logic is 20–30 lines; it does not warrant its own module at hackathon scale.

### 3. Detail pages are Server Components fetching from the DB directly
`/analyze/[id]` and `/docs-generator/[id]` use Next.js Server Components that call Prisma directly (not through the REST API).

**Why**: No client-side fetch overhead, no extra API round-trip. Prisma is available server-side.

**Alternative considered**: Fetching from `GET /api/analyses/:id`. Would work but adds latency and serialization overhead.

### 4. History page is a Server Component with no client-side filter
The "All / Gap Analysis / API Docs" filter is implemented as query params (`?filter=gap|docs|all`) so the page can be a Server Component with no `useState`.

**Why**: Avoids `'use client'` for a simple filtering use case. The URL also becomes shareable/bookmarkable.

### 5. Relative timestamps via Intl.RelativeTimeFormat (no library)
`HistoryCard` computes relative timestamps (`"5 minutes ago"`) using native `Intl.RelativeTimeFormat`. No `date-fns` or `dayjs`.

**Why**: Satisfies CLAUDE.md rule of no additional dependencies.

## Risks / Trade-offs

- **No migration needed** — all models are already in `prisma/schema.prisma`. Risk: schema out-of-sync if a previous migration failed. Mitigation: run `prisma db push` on deploy.
- **Large code inputs stored as plain text** — `backendSource` / `frontendSource` are unbounded strings. Risk: row bloat for large repos. Mitigation: acceptable for hackathon scope; PostgreSQL handles large text.
- **N+1 on history list** — `GET /api/analyses` returns list with counts only (no routes), so no N+1.
- **analysisId: null edge case** — if DB is down, the client receives `analysisId: null`. Clicking into `/analyze/null` would 404. Mitigation: only show "view saved" link in UI when `analysisId` is a valid UUID.

## Migration Plan

1. Ensure `DATABASE_URL` is set in `.env`
2. Run `npx prisma db push` (schema already covers all models)
3. Deploy updated API routes and new pages
4. No data migration needed — history starts empty

## Open Questions

- Should we truncate `backendSource` / `frontendSource` before saving to avoid very large rows? (Decision deferred — use full text for now)
