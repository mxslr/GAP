## 1. Project Initialization

- [x] 1.1 Run `npx create-next-app@14` with TypeScript, Tailwind, App Router, no src dir, no import alias
- [x] 1.2 Install additional dependencies: `@prisma/client prisma @google/generative-ai @tabler/icons-react`
- [x] 1.3 Update `next.config.js` to set `output: 'standalone'`
- [x] 1.4 Configure `tsconfig.json` with `strict: true` and path aliases (`@/*` → `./*`)
- [x] 1.5 Create `.env.example` with `DATABASE_URL` and `GEMINI_API_KEY` template (include URL-encoding note for special chars)
- [x] 1.6 Add `.env` to `.gitignore`

## 2. Design System & Tailwind

- [x] 2.1 Replace `tailwind.config.ts` colors with full custom palette: `bg.primary`, `bg.secondary`, `bg.tertiary`, `fg.primary`, `fg.secondary`, `fg.tertiary`, `border.default`, `border.hover`, `status.connected`, `status.ghost`, `status.orphan`
- [x] 2.2 Add `fontFamily` tokens to Tailwind config: `display` (Space Grotesk), `body` (Geist), `mono` (Geist Mono)
- [x] 2.3 Rewrite `app/globals.css`: import fonts from Google Fonts, set CSS variables, body defaults (bg-black, text-white, font-body), smooth scroll, reset margin/padding
- [x] 2.4 Add `postcss.config.js` if not already created by Next scaffold

## 3. Prisma Schema & Database Client

- [x] 3.1 Run `npx prisma init` to create `prisma/schema.prisma` with PostgreSQL provider
- [x] 3.2 Write all 5 models in `prisma/schema.prisma`: `Analysis`, `Route`, `Feature`, `ApiDoc`, `SnippetCache` (per CLAUDE.md schema spec)
- [x] 3.3 Add all required indexes: `Route@@index([analysisId])`, `Route@@index([status])`, `Route@@index([featureId])`, `Feature@@index([analysisId])`
- [x] 3.4 Create `lib/db.ts` with PrismaClient singleton pattern (use global cache to survive Next.js hot-reload)

## 4. Shared Types

- [x] 4.1 Create `lib/types.ts` with all exported types: `HttpMethod`, `RouteStatus`, `AnalysisMode`, `BackendFramework`, `FrontendPattern`
- [x] 4.2 Add interfaces: `BackendRoute`, `FrontendCall`, `FeatureGroup`, `AnalyzedRoute`, `GapAnalysisResult`, `MonorepoLayout`

## 5. Gemini Client

- [x] 5.1 Create `lib/gemini.ts` with `GoogleGenerativeAI` instance initialized from `process.env.GEMINI_API_KEY`
- [x] 5.2 Export `getModel(modelName?: string)` defaulting to `'gemini-2.0-flash'`
- [x] 5.3 Implement `generateJSON<T>(prompt: string, schema: object): Promise<T>` using `responseMimeType: 'application/json'` and `responseSchema`
- [x] 5.4 Wrap all Gemini calls in exponential backoff retry: detect HTTP 429, retry after 1s then 2s, max 2 retries, propagate non-429 errors immediately

## 6. Base Components

- [x] 6.1 Create `components/Logo.tsx`: wordmark `GAP` in display font with `letter-spacing: -0.04em`, square dot `.`, 1px baseline underline, optional `showTagline` prop rendering tagline in mono lowercase gray
- [x] 6.2 Create `components/Navbar.tsx`: fixed top, transparent default, hover → `rgba(0,0,0,0.6)` + `backdrop-blur-md` + bottom border, Logo left + nav links right, `transition-all duration-200`
- [x] 6.3 Create `components/Button.tsx`: variants `primary` (white bg, black text) and `secondary` (transparent, white border), no `rounded-*`, `transition-all duration-200`, accepts `href` or `onClick`
- [x] 6.4 Create `components/Box.tsx`: `border border-border-default bg-bg-secondary hover:border-border-hover transition-colors duration-200`, no `rounded-*`
- [x] 6.5 Create `components/Spinner.tsx`: rotating square via `animate-spin`, white, no `rounded-*` (use `rounded-none` or no rounding class)

## 7. App Layout

- [x] 7.1 Update `app/layout.tsx`: import Navbar, apply global font classes, metadata (`title: 'GAP — API Intelligence Platform'`)
- [x] 7.2 Ensure layout wraps `{children}` with dark background (`bg-bg-primary min-h-screen text-fg-primary`)

## 8. Landing Page

- [x] 8.1 Create hero section in `app/page.tsx` with two-line headline in display font, sub-headline in mono, and two Button CTAs (`/analyze`, `/docs-generator`)
- [x] 8.2 Add four-pillar section: 2×2 grid of Box components with index numbers `01`–`04`, display font titles, and body descriptions
- [x] 8.3 Add "How It Works" section: three steps with vertical separator lines between them (border-r on first two columns)
- [x] 8.4 Create `DemoStrip` section (can be inline or `components/DemoStrip.tsx`): `'use client'` component, three rotating `<pre>` examples (route detection, feature classification, TS type), fade-in transition, 3-second `setInterval`
- [x] 8.5 Add footer: Logo with tagline, tech stack labels in mono gray, hackathon credit line
- [x] 8.6 Add staggered fade-in animation to each top-level section (CSS `animation-delay` offsets: 0ms, 100ms, 200ms, 300ms, 400ms)

## 9. Health Endpoint

- [x] 9.1 Create `app/api/health/route.ts` exporting `GET` handler that returns `NextResponse.json({ status: 'ok' })` with status 200, no DB dependency

## 10. Folder Scaffolding (Empty Placeholders)

- [x] 10.1 Create empty placeholder files for future modules: `lib/parsers/.gitkeep`, `lib/analyzer/.gitkeep`, `lib/generators/.gitkeep`, `lib/repo/.gitkeep`
- [x] 10.2 Create empty page stubs: `app/analyze/page.tsx` (placeholder `<main>`), `app/docs-generator/page.tsx` (placeholder `<main>`), `app/history/page.tsx` (placeholder `<main>`)
- [x] 10.3 Create empty API route stubs: `app/api/analyze/route.ts`, `app/api/docs/route.ts`, `app/api/analyses/route.ts` (each returns 501 Not Implemented for now)

## 11. Verification

- [x] 11.1 Run `npm run dev` — verify landing page loads with correct fonts, colors, and layout
- [x] 11.2 Confirm `/api/health` returns `{"status":"ok"}` in browser or via curl
- [x] 11.3 Check no `rounded-*` classes exist in any component (search codebase)
- [x] 11.4 Verify navbar is transparent on load and gains backdrop-blur on hover
- [x] 11.5 Verify DemoStrip cycles through all 3 examples with fade animation
- [ ] 11.6 Run `npx prisma db push` (after setting DATABASE_URL) and confirm no errors
- [x] 11.7 Run `npx tsc --noEmit` — confirm zero TypeScript errors
