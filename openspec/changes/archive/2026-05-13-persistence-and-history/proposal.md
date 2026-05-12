## Why

Analysis results and generated docs currently exist only in memory — once the user navigates away from `/analyze` or `/docs-generator`, all output is lost. We need persistent storage so users can revisit past work, share results, and compare analyses over time.

## What Changes

- `/api/analyze` now saves every completed analysis (routes, features, mode, summary counts) to PostgreSQL via Prisma before returning the response
- `/api/docs` now saves every completed docs generation (routes, ApiDoc markdown + OpenAPI JSON) to PostgreSQL via Prisma before returning the response
- New `GET /api/analyses` endpoint — paginated list of all past analyses (gap analysis + docs generation), latest first
- New `GET /api/analyses/:id` endpoint — full detail of a single analysis including routes and features
- New `/history` page — filterable list of all past analyses with summary cards
- New `/analyze/[id]` page — read-only replay of a persisted gap analysis result
- New `/docs-generator/[id]` page — read-only replay of a persisted docs generation result
- `HistoryCard.tsx` component added
- `Navbar.tsx` updated to include a "history" link

## Capabilities

### New Capabilities
- `analysis-persistence`: Save analysis results (routes, features, summary) and docs generation results to the database on every completed run; expose list and detail REST endpoints
- `history-page`: Browsable `/history` page with filter tabs and `HistoryCard` components linking to detail pages
- `analysis-detail-page`: `/analyze/[id]` server component that fetches and re-renders a persisted gap analysis result
- `docs-detail-page`: `/docs-generator/[id]` server component that fetches and re-renders a persisted docs generation result

### Modified Capabilities
- `analyze-api-route`: Add DB persistence step at the end of every successful analysis run
- `api-doc-generator`: Add DB persistence step at the end of every successful docs generation run

## Impact

- **Prisma models used**: `Analysis`, `Route`, `Feature`, `ApiDoc` (all already defined in `prisma/schema.prisma`)
- **New files**: `app/api/analyses/route.ts`, `app/api/analyses/[id]/route.ts`, `app/history/page.tsx`, `app/analyze/[id]/page.tsx`, `app/docs-generator/[id]/page.tsx`, `components/HistoryCard.tsx`
- **Updated files**: `app/api/analyze/route.ts`, `app/api/docs/route.ts`, `components/Navbar.tsx`
- **Dependencies**: No new npm packages — uses existing Prisma client (`lib/db.ts`)
- **Breaking**: None — existing API responses are unchanged; persistence is additive
