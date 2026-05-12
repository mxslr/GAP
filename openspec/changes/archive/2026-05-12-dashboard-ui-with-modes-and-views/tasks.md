## 1. Shared Components

- [x] 1.1 Create `components/ModeSelector.tsx` — two tabs (Monorepo / Separate Repos), active state white bg/black text, inactive outlined, 0.2s transition, no border-radius
- [x] 1.2 Create `components/ViewToggle.tsx` — two buttons (flat view / feature view), same active/inactive styling as ModeSelector
- [x] 1.3 Create/update `components/MetricCard.tsx` — label, value (large display font), left-border color accent, bg-secondary, no border-radius
- [x] 1.4 Create/update `components/FilterBar.tsx` — status filters (all/connected/orphan/ghost) + method filters (GET/POST/PUT/DELETE/PATCH), active = white bg, inactive = gray border, onFilterChange callback
- [x] 1.5 Create/update `components/CodeBlock.tsx` — `<pre>` with bg-tertiary, copy button top-right that shows "copied" for 2s then reverts, no border-radius
- [x] 1.6 Create/update `components/RouteCard.tsx` — collapsible card with METHOD badge (thin colored border per HTTP verb), path in mono, status pill (thin colored border), chevron; body expands with 300ms max-height transition; contains two CodeBlock instances (fetch snippet + TS types)
- [x] 1.7 Create `components/FeatureGroup.tsx` — accordion with feature name header + route count badge, chevron rotates 90° on open, body expands with 300ms max-height transition, contains RouteCard list

## 2. API Route

- [x] 2.1 Create `app/api/analyze/route.ts` — POST handler with try/catch, JSON response, proper HTTP status codes
- [x] 2.2 Add input validation: require `mode`, check mode-specific required fields (`repoSource` for monorepo; `backendCode` + `frontendCode` for separate), return 400 with `{ error, code }` on failure
- [x] 2.3 Implement Monorepo pipeline branch: call `detectMonorepoLayout(repoSource)` → split content → `parseBackendRoutes` + `parseFrontendCalls` on respective sections
- [x] 2.4 Implement Separate pipeline branch: call `parseBackendRoutes(backendCode)` + `parseFrontendCalls(frontendCode)` directly
- [x] 2.5 Call `analyzeGap(backendRoutes, frontendRoutes)` after parsing for both modes
- [x] 2.6 Call `classifyFeatures(analyzedRoutes)` on the gap analysis result
- [x] 2.7 Call `generateSnippetsBatch(routes)` to enrich routes with fetch snippets + TS types
- [x] 2.8 Assemble final `GapAnalysisResult` with `summary.total/connected/orphan/ghost` counts and return 200

## 3. Analyze Page

- [x] 3.1 Create `app/analyze/page.tsx` as a `'use client'` component with `useReducer` for state: `{ mode, inputs, status: 'idle'|'loading'|'done'|'error', result, viewMode, filters, error }`
- [x] 3.2 Render `ModeSelector` at top, wired to dispatch mode change action
- [x] 3.3 Render conditional input section: single textarea for Monorepo mode, two-column grid for Separate mode — all with no border-radius, bg-secondary, border-default styling
- [x] 3.4 Render "analyze api gaps" primary full-width Button; disable it during loading; validate inputs before calling API
- [x] 3.5 Implement loading state: hide input section, show Spinner + current step message; simulate step progression with a timer that advances through steps at fixed intervals; skip "detecting layout..." step for Separate mode
- [x] 3.6 Render results section: mode badge (uppercase mono, thin white border), three MetricCards in a 3-column grid
- [x] 3.7 Render ViewToggle at top-right of results area; conditionally show FilterBar only in flat view
- [x] 3.8 Implement flat view: filter `result.routes` by active status + method filters, render `RouteCard` list
- [x] 3.9 Implement feature view: render `FeatureGroup` list from `result.features`, each containing its routes as `RouteCard` components
- [x] 3.10 Implement empty state: if `result.routes.length === 0`, show empty-state message instead of route list
- [x] 3.11 Implement error state: on API failure, show red error message below input, clear loading state

## 4. Page Load Animation

- [x] 4.1 Add staggered fade-in animation to top-level sections in `app/analyze/page.tsx` using Tailwind animation classes with delay offsets (50–100ms per section)
