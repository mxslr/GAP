## Why

The API Documentation Generator (Mode 3) backend logic is complete but has no frontend UI — users cannot interact with the docs pipeline from the browser. This page closes that gap, giving judges and users a self-service surface to paste backend code and receive browsable, exportable API documentation in under 60 seconds.

## What Changes

- Add `/docs-generator` page with hero, input textarea, loading state, and two-column result view
- Add `components/ApiDocPanel.tsx` — the main documentation viewer with sticky TOC sidebar and rendered Markdown main panel
- Add/wire `app/api/docs/route.ts` POST handler if not already present from proposal #8 (create it here if missing)
- Persist last result to `localStorage` so a page reload does not lose generated docs
- Add export actions: copy Markdown, download `.md`, download `openapi.json`
- Add syntax-highlighted code blocks with per-block copy buttons inside the Markdown renderer

## Capabilities

### New Capabilities

- `docs-generator-page`: Full `/docs-generator` page — input → loading states → two-column ApiDocPanel result with TOC sidebar, rendered Markdown, export bar, and localStorage persistence
- `api-doc-panel`: Reusable `ApiDocPanel` component — left sticky TOC with search, right rendered Markdown with anchors, syntax highlighting, and copy buttons per code block

### Modified Capabilities

- `api-doc-generator`: The existing spec covers the library function; this change adds the HTTP route (`POST /api/docs`) that the page calls, plus the response contract `{ analysisId, markdown, openapi }`

## Impact

- New files: `app/docs-generator/page.tsx`, `components/ApiDocPanel.tsx`
- New/updated file: `app/api/docs/route.ts`
- New dependency candidate: `react-markdown` + `rehype-highlight` or `prismjs` for syntax-highlighted Markdown rendering (confirm in design)
- No database schema changes — uses existing `ApiDoc` model and `Analysis` model from prisma schema
- No changes to existing parsers, classifier, or generator modules — page is a consumer only
