## Context

GAP is a greenfield Next.js 14 project targeting a 24-hour hackathon. The scaffold must establish the full technical foundation — framework, database, AI client, design system, and component library — so that subsequent proposals (parsers, analyzers, UI pages) can be implemented in isolation without revisiting infrastructure decisions. The deploy target is Kubernetes using a Docker standalone build. Judges will evaluate on a live public URL.

## Goals / Non-Goals

**Goals:**
- Establish a working Next.js 14 App Router project with TypeScript strict mode
- Define and encode the complete design token system in Tailwind so all future UI work is token-aware
- Create the minimum set of reusable components that every future page needs
- Implement the four-pillar landing page to the spec in CLAUDE.md
- Wire up Prisma schema (all 5 models) and Gemini client with retry logic
- Expose `/api/health` for K8s probes

**Non-Goals:**
- Implementing any business logic (parsers, analyzers, gap engine) — those are proposals #2–#8
- Database migrations or seed data — Prisma `db push` is sufficient for the hackathon
- Authentication or multi-tenancy
- CI/CD pipelines (separate proposal #12)

## Decisions

### Framework: Next.js 14 App Router
Chosen over Vite/React SPA because it provides API routes in the same repo, eliminating a separate Express server. The App Router enables React Server Components, reducing client bundle size for the heavy results pages. `output: 'standalone'` in `next.config.js` produces a self-contained Docker image without node_modules copying.

### AI: Google Gemini via `@google/generative-ai`
Gemini 2.0 Flash offers 1,500 free requests/day with no credit card requirement, critical for a hackathon environment. All SDK calls are centralized in `lib/gemini.ts` — feature modules never instantiate the SDK directly. This allows swapping models or adding caching without touching feature code.

**`generateJSON<T>` pattern:** Force JSON output using `responseMimeType: 'application/json'` + `responseSchema`. This is Gemini's structured output mode and is more reliable than asking the model to format as JSON in the prompt.

**Retry strategy:** Exponential backoff with max 2 retries (delays: 1s, 2s) on HTTP 429 (rate limit). Errors other than rate limits propagate immediately.

### Styling: Tailwind CSS with custom tokens
All colors, spacing, and typography defined as Tailwind design tokens in `tailwind.config.ts`. Feature code uses token names (`bg-bg-primary`, `text-fg-secondary`, `border-border-default`) — never raw hex values. This enforces the monochrome palette constraint automatically.

**Font loading:** Space Grotesk + Geist + Geist Mono loaded from Google Fonts via `@import` in `globals.css`. Next.js font optimization (`next/font/google`) was considered but rejected to keep the global CSS self-contained and avoid per-component font declarations.

### Component Architecture: Thin primitives, no external component library
Base components (Button, Box, Spinner, Logo, Navbar) are built from scratch with Tailwind. No MUI, Radix, or shadcn — the design system is too opinionated (no border-radius, monochrome-only) to adapt third-party components cleanly. Thin primitives are faster to implement and less likely to conflict with strict design rules.

### ORM: Prisma with `db push`
`prisma db push` (no migration files) is used for the hackathon to avoid migration management overhead. The schema is the single source of truth. The Prisma client is a singleton in `lib/db.ts` to avoid exhausting PostgreSQL connections in Next.js hot-reload.

### Design Rules Enforcement
The CLAUDE.md "HARD RULES" are enforced by convention (no `rounded-*` utilities) rather than by lint. The risk of accidental rounded corners is low given the small team and explicit rules. Adding a custom ESLint rule for `rounded-*` was considered and deferred — the hackathon timeline doesn't justify it.

## Risks / Trade-offs

- **Gemini rate limits** → Mitigated by exponential backoff and future `SnippetCache` usage (proposals #7+)
- **PostgreSQL special-character password** → URL-encode `(`, `)`, `&`, `>` in `DATABASE_URL`. Documented in `.env.example` with encoding table.
- **`db push` vs migrations** → Data loss risk on schema changes during dev. Acceptable for hackathon; team must coordinate schema changes.
- **Google Fonts dependency** → Demo requires internet. If network is unavailable, fonts fall back to system sans-serif. This is acceptable for a hackathon demo.
- **`output: standalone` build time** → First Docker build is slow (~3–5 min). Subsequent builds use layer cache. Plan: build image before the demo window.

## Migration Plan

1. Run `npm install` to install all dependencies
2. Copy `.env.example` to `.env` and populate `DATABASE_URL` and `GEMINI_API_KEY`
3. Run `npx prisma db push` to create tables
4. Run `npm run dev` for local dev, or `docker build` + `docker run` for container
5. Deploy to K8s via `kubectl apply -f k8s/` (proposal #12)

**Rollback:** Not applicable — this is the initial scaffold. If broken, delete and re-scaffold.

## Open Questions

- Font availability on hackathon network — if Google Fonts is blocked, we switch to system fonts in `globals.css` at demo time.
- Exact Kubernetes namespace and Secret name — assumed `muyung-anak-telyu` and `gap-secrets` per CLAUDE.md; confirm with organizers before proposal #12.
