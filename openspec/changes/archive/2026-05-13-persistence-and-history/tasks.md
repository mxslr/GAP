## 1. API Endpoints — Persistence

- [x] 1.1 Update `app/api/analyze/route.ts` — after pipeline completes, save `Analysis` + `Route[]` + `Feature[]` to DB via Prisma inside a try/catch; include `analysisId` (or `null`) in the response body
- [x] 1.2 Update `app/api/docs/route.ts` — after pipeline completes, save `Analysis` + `Route[]` + `Feature[]` + `ApiDoc` to DB via Prisma inside a try/catch; include `analysisId` (or `null`) in the response body

## 2. API Endpoints — Read

- [x] 2.1 Create `app/api/analyses/route.ts` — `GET /api/analyses?limit=<n>` returns array of analysis summaries (id, mode, totalRoutes, counts, createdAt), ordered by `createdAt` desc, default limit 20
- [x] 2.2 Create `app/api/analyses/[id]/route.ts` — `GET /api/analyses/:id` returns full analysis with nested `routes` and `features`; returns 404 if not found

## 3. Components

- [x] 3.1 Create `components/HistoryCard.tsx` — renders analysis summary with relative timestamp (via `Intl.RelativeTimeFormat`), mode badge, and metric badges (gap: connected/orphan/ghost; docs: route count); links to correct detail page; follows design system (no border-radius, monochrome, transitions)
- [x] 3.2 Update `components/Navbar.tsx` — add `history` navigation link pointing to `/history`

## 4. History Page

- [x] 4.1 Create `app/history/page.tsx` — Server Component that reads `?filter=all|gap|docs` query param, fetches from DB directly via Prisma, renders list of `HistoryCard` components; includes empty state with CTA to `/analyze`

## 5. Detail Pages

- [x] 5.1 Create `app/analyze/[id]/page.tsx` — Server Component that fetches gap analysis by ID from DB; re-renders result UI (metric cards, filter bar, route list with feature groups); includes "new analysis" button linking to `/analyze`; handles not-found and wrong-mode cases
- [x] 5.2 Create `app/docs-generator/[id]/page.tsx` — Server Component that fetches docs analysis by ID from DB; re-renders docs viewer UI (Markdown doc, feature nav, export button); includes "new generation" button linking to `/docs-generator`; handles not-found and wrong-mode cases
