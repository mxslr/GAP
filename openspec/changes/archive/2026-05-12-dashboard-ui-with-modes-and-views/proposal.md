## Why

GAP's core analysis engine (parsers, gap analyzer, feature classifier, snippet generator) is complete, but there is no user-facing interface to invoke or display results. The `/analyze` page needs to be built so judges and developers can actually use the platform end-to-end.

## What Changes

- New `/analyze` page with two-mode input UI: **Monorepo** (single textarea) and **Separate** (two side-by-side textareas)
- New `POST /api/analyze` route that orchestrates the full analysis pipeline (monorepo detection → parsing → gap analysis → feature classification → snippet generation)
- New components: `ModeSelector`, `ViewToggle`, `FeatureGroup`
- Updated components: `MetricCard`, `FilterBar`, `RouteCard`, `CodeBlock` — refined to final design spec
- Results section with mode badge, metric cards, flat/feature view toggle, filter bar, and collapsible route cards
- Loading state with sequential step messages matching the pipeline stages

## Capabilities

### New Capabilities

- `analyze-page`: Full `/analyze` page UI with mode selector, conditional input forms, loading state, and results display (flat view + feature view with accordion groups)
- `analyze-api-route`: `POST /api/analyze` orchestration endpoint that accepts mode + code inputs, runs the full pipeline, and returns `GapAnalysisResult`

### Modified Capabilities

- `base-components`: `MetricCard`, `FilterBar`, `RouteCard`, `CodeBlock` are being finalized with confirmed design tokens and interaction patterns (copy button, expand animation, filter active state)

## Impact

- **New files**: `app/analyze/page.tsx`, `app/api/analyze/route.ts`, `components/ModeSelector.tsx`, `components/ViewToggle.tsx`, `components/FeatureGroup.tsx`
- **Updated files**: `components/MetricCard.tsx`, `components/FilterBar.tsx`, `components/RouteCard.tsx`, `components/CodeBlock.tsx`
- **Dependencies**: All existing lib modules (`monorepo-detector`, `parsers`, `gap analyzer`, `feature-classifier`, `snippets generator`) are consumed here for the first time via the API route
- **No new npm packages** — uses existing `@google/generative-ai`, Prisma, Tailwind
