## 1. Dependencies

- [x] 1.1 Install `react-markdown`, `rehype-highlight`, `highlight.js` via npm
- [x] 1.2 Import `highlight.js/styles/github-dark.css` in `app/globals.css` scoped under `.hljs-wrap`

## 2. API Route — POST /api/docs

- [x] 2.1 Check if `app/api/docs/route.ts` exists; create it if absent
- [x] 2.2 Implement POST handler: parse body, validate `backendCode` field (400 if missing)
- [x] 2.3 Wire pipeline: `parseBackendRoutes` → `classifyFeatures` → `buildDocumentedRoutes` → `generateApiDocs`
- [x] 2.4 Attempt Prisma persist (`Analysis`, `Route`, `Feature`, `ApiDoc`); catch DB errors and continue with `analysisId: null`
- [x] 2.5 Return `{ analysisId, markdown, openapi }` with status 200; return `{ error }` with 400/500 on validation/pipeline failure
- [x] 2.6 Set route handler timeout to 90 s to accommodate large codebases

## 3. ApiDocPanel Component

- [x] 3.1 Create `components/ApiDocPanel.tsx` with props `{ markdown: string, openapi: object | null }`
- [x] 3.2 Implement TOC extraction: regex over markdown headings (h2, h3), slugify each heading text
- [x] 3.3 Render left sidebar (30% width, sticky) with TOC anchor links
- [x] 3.4 Add search input above TOC list; filter TOC entries by case-insensitive substring match on input
- [x] 3.5 Render right panel (70% width) using `react-markdown` with `rehype-highlight` plugin
- [x] 3.6 Configure `react-markdown` `components` prop to add `id` attribute (slugified) to `h2` and `h3` elements
- [x] 3.7 Configure `react-markdown` `components` prop to render code blocks with an overlay copy button (top-right, shows transient "copied" label)
- [x] 3.8 Implement active TOC item highlighting on scroll using `IntersectionObserver`
- [x] 3.9 Apply design system styles: no border-radius, monochrome palette, `font-mono` for labels, transitions on interactive elements

## 4. Docs Generator Page

- [x] 4.1 Create `app/docs-generator/page.tsx` as a client component (`'use client'`)
- [x] 4.2 Implement hero section: title "API Documentation Generator", subtitle in mono font
- [x] 4.3 Implement input section: large textarea (label "backend code", helper text "supports express, fastapi, laravel"), "generate documentation" button; disable button when textarea is empty
- [x] 4.4 Implement loading state: square spinner + 4 step messages cycling every 5 s ("parsing routes...", "classifying features...", "enriching with examples...", "building documentation...")
- [x] 4.5 Wire form submission: `POST /api/docs` with `{ backendCode }`, handle loading/success/error states
- [x] 4.6 On success, render `ApiDocPanel` with returned `markdown` and `openapi`
- [x] 4.7 On API error, restore input section and show error message
- [x] 4.8 Implement localStorage persistence: write `{ markdown, openapi, timestamp }` to `gap:docs-generator:last-result` on success
- [x] 4.9 On page mount, read `gap:docs-generator:last-result` from localStorage; if present, show ApiDocPanel with a cache banner ("loaded from cache — generated at <timestamp>")
- [x] 4.10 Implement cache dismiss: clicking dismiss clears localStorage key and restores input form

## 5. Export Bar

- [x] 5.1 Add export bar component (sticky, top-right or bottom) visible only when result is loaded
- [x] 5.2 "copy markdown" button: writes `markdown` string to clipboard, shows transient "copied!" feedback
- [x] 5.3 "download .md" button: creates Blob URL from `markdown` and triggers download as `api-docs.md`
- [x] 5.4 "download openapi.json" button: serializes `openapi` to JSON, triggers download as `openapi.json`; disabled (visually + aria) when `openapi` is null/undefined

## 6. Design System Compliance

- [x] 6.1 Verify no `border-radius` classes are used anywhere in new components
- [x] 6.2 Verify all colors use design tokens (no hardcoded hex values)
- [x] 6.3 Verify every interactive element has a `transition` class (min 0.2s)
- [x] 6.4 Verify all mono-font text is lowercase
- [x] 6.5 Add staggered fade-in to page-level sections on load

## 7. Verification

- [x] 7.1 Test end-to-end with sample Express backend code — verify docs generate within 60 s
- [x] 7.2 Test localStorage persistence: generate, reload page, verify cached result restores
- [x] 7.3 Test all three export actions (copy, download .md, download openapi.json)
- [x] 7.4 Test empty textarea validation — confirm API is not called
- [x] 7.5 Test DB-unavailable path: mock Prisma throw, verify 200 response with `analysisId: null`
- [x] 7.6 Verify TOC search filters correctly and clearing restores all entries
- [x] 7.7 Verify code block copy buttons work inside rendered Markdown
