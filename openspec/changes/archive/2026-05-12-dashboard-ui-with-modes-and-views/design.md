## Context

All core library modules (parsers, gap analyzer, feature classifier, snippet generator, monorepo detector) are complete. The `/analyze` page is the primary user-facing interface that stitches these modules together. This change wires up the full pipeline through a single `POST /api/analyze` endpoint and builds the result UI — mode selector, loading states, metric cards, flat/feature view with route cards.

The design system (dark/monochrome, no border-radius, Geist/Space Grotesk fonts, defined color tokens) is established in `tailwind.config.ts` and must be strictly followed.

## Goals / Non-Goals

**Goals:**
- `/analyze` page with two-mode input UI (Monorepo, Separate)
- `POST /api/analyze` endpoint that orchestrates the complete analysis pipeline
- Results UI: mode badge, metric cards, view toggle, filter bar, flat + feature accordion views
- Collapsible route cards with copy-to-clipboard code blocks
- Sequential loading messages that match pipeline stages

**Non-Goals:**
- Persistence to database (that is proposal #11)
- Mode 3 (Backend-Only/Docs) — that is `/docs-generator` (proposal #10)
- GitHub URL fetching — textarea paste only for this iteration
- History page or detail page (`/analyze/[id]`) — proposal #11

## Decisions

### 1. Client Component for the entire analyze page
The `/analyze` page requires `useState`, `useReducer`, event handlers, and clipboard API — all browser-only. The entire page.tsx is a `'use client'` component.

**Alternative considered**: Server component wrapper with client islands. Rejected — the page is entirely interactive with no static content worth server-rendering.

### 2. Single `POST /api/analyze` orchestrator
All pipeline steps (monorepo detection → BE parser → FE parser → gap analysis → feature classifier → snippet gen) run server-side inside one Next.js API route. The client sends raw code strings and gets back a full `GapAnalysisResult`.

**Alternative considered**: Multiple sequential client-side API calls to separate endpoints per step. Rejected — adds network round trips, exposes intermediate state that isn't useful to the client, and complicates loading-step sequencing.

### 3. Loading steps communicated via response streaming or step index
Since `POST /api/analyze` is a single call, the loading step messages on the client are *simulated* with a timer that advances through steps at fixed intervals rather than actual server events. The steps align approximately with real pipeline timing but are cosmetic.

**Alternative considered**: Server-Sent Events to push real step progress. Not worth the complexity for a hackathon demo — simulated steps are visually equivalent.

### 4. State management: useReducer in page.tsx
The analyze page has complex state: `{ mode, inputs, status, result, viewMode, filters }`. A single `useReducer` with typed actions keeps this manageable without Redux.

### 5. Feature accordion uses CSS max-height transition
`FeatureGroup` and `RouteCard` expand/collapse via `max-height: 0 → max-height: 1000px` transition (300ms ease). This avoids JS-measured heights while still giving smooth animation for typical content lengths.

### 6. Method color scheme: thin colored border, transparent background
HTTP method badges use a thin colored left-border or outline — no filled backgrounds. Colors:
- GET: `#4ADE80` (green)  
- POST: `#60A5FA` (blue)  
- PUT: `#FBBF24` (amber)  
- PATCH: `#A78BFA` (purple)  
- DELETE: `#F87171` (red)

These are one-off inline values for semantic color coding — consistent with the "color only for status indicators" rule.

## Risks / Trade-offs

- **Long analysis time** → The full pipeline (especially Gemini snippet generation for many routes) can take 15–30 seconds. The simulated loading steps keep the UI responsive, but the button must be disabled during analysis to prevent double-submission.
- **Gemini rate limits** → `generateSnippetsBatch` already implements retry with backoff. The API route wraps the pipeline in try/catch and returns a 500 with a clear error message if Gemini fails.
- **Large code pastes** → No server-side size limit is enforced in this proposal. For the hackathon demo, inputs are controlled inputs with reasonable textarea sizes.
- **No input validation beyond empty check** → Malformed code will not crash parsers (they return empty arrays gracefully) but may produce zero routes. The UI should handle the empty-result state.
