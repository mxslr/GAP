## Why

GAP (API Intelligence Platform) needs a complete project foundation before any feature work can begin. The hackathon is 24 hours and judges need a live, end-to-end demo — so a solid scaffold with a polished landing page and working infrastructure is the critical first step.

## What Changes

- Initialize Next.js 14 App Router project with TypeScript strict mode
- Add Tailwind CSS with custom design token palette (monochrome + status colors)
- Configure Prisma ORM with 5-model PostgreSQL schema (Analysis, Route, Feature, ApiDoc, SnippetCache)
- Add Google Gemini SDK client (`lib/gemini.ts`) with JSON-mode helper and exponential backoff retry
- Create shared type definitions (`lib/types.ts`) as contract between all feature modules
- Build reusable component library: Logo, Navbar, Button, Box, Spinner
- Implement four-pillar landing page per spec (Hero + Four Pillars + How It Works + Demo Strip + Footer)
- Add `/api/health` endpoint for Kubernetes liveness/readiness probes
- Configure `next.config.js` with `output: 'standalone'` for Docker
- Add `.env.example` for local dev setup

## Capabilities

### New Capabilities

- `design-system`: Design tokens, global CSS, typography setup (Space Grotesk / Geist / Geist Mono), and strict visual rules (no border-radius, monochrome, transitions)
- `base-components`: Reusable UI primitives — Logo, Navbar, Button, Box, Spinner — that all future pages consume
- `landing-page`: Four-pillar landing page with hero, animated demo strip, and two CTAs linking to `/analyze` and `/docs-generator`
- `gemini-client`: Centralized Gemini SDK wrapper with JSON-mode, schema enforcement, and retry logic — all feature modules call this
- `prisma-schema`: Database schema defining Analysis, Route, Feature, ApiDoc, and SnippetCache models
- `shared-types`: TypeScript interfaces and enums shared across parsers, analyzers, and API routes
- `health-endpoint`: `/api/health` GET endpoint returning `{"status":"ok"}` for K8s probes

### Modified Capabilities

*(none — this is the initial scaffold)*

## Impact

- **Dependencies added**: `next`, `react`, `react-dom`, `typescript`, `@prisma/client`, `prisma`, `@google/generative-ai`, `tailwindcss`, `postcss`, `autoprefixer`, `@tabler/icons-react`
- **New files**: Entire project structure under `app/`, `components/`, `lib/`, `prisma/`
- **Config files**: `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `.env.example`
- **No breaking changes** — this is the initial setup
