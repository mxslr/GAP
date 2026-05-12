## ADDED Requirements

### Requirement: detectMonorepoLayout function
The module `lib/repo/monorepo-detector.ts` SHALL export an async function `detectMonorepoLayout(fileTree: string | FileTreeEntry[]): Promise<MonorepoLayout>` that identifies backend and frontend folder boundaries within a single repository.

#### Scenario: Structured input accepted
- **WHEN** caller passes a `FileTreeEntry[]` array
- **THEN** the function SHALL process it without error and return a `MonorepoLayout`

#### Scenario: Text input accepted
- **WHEN** caller passes a raw string (e.g., `tree` command output or user paste)
- **THEN** the function SHALL parse it into an internal `FileTreeEntry[]` and return a `MonorepoLayout`

### Requirement: Heuristic detection pass
The detector SHALL run a heuristic pass before any LLM call. Folders named `backend`, `server`, `api`, `service`, `services` SHALL be classified as backend candidates. Folders named `frontend`, `client`, `web`, `app`, `ui` SHALL be classified as frontend candidates.

#### Scenario: Standard Express + React layout
- **WHEN** top-level folders include `server/` and `client/`
- **THEN** `backendPaths` SHALL contain `'server/'`, `frontendPaths` SHALL contain `'client/'`, and `confidence` SHALL be `'high'`

#### Scenario: Backend-only folder name match
- **WHEN** only a folder named `api/` exists with no frontend-named folder
- **THEN** `backendPaths` SHALL contain `'api/'`, `frontendPaths` SHALL be `[]`, and `confidence` SHALL be `'low'`

### Requirement: Indicator file detection
The presence of specific indicator files in a folder SHALL upgrade heuristic confidence. `requirements.txt` or `pyproject.toml` → backend. `composer.json` → backend. `package.json` containing React, Vue, Next, Svelte, Nuxt dependencies → frontend. `package.json` containing Express, Koa, Fastify, NestJS dependencies → backend.

#### Scenario: package.json with React signals frontend
- **WHEN** a folder contains a `package.json` with `"react"` in its dependencies
- **THEN** that folder SHALL be added to `frontendPaths` and `confidence` SHALL be `'high'`

#### Scenario: requirements.txt signals backend
- **WHEN** a folder contains a `requirements.txt` file
- **THEN** that folder SHALL be added to `backendPaths`

#### Scenario: Indicator file overrides ambiguous folder name
- **WHEN** a folder named `app/` contains a `package.json` with React
- **THEN** it SHALL be classified as frontend, not ignored due to ambiguous folder name

### Requirement: Nx / Turborepo apps wrapper handling
When a top-level folder is named `apps/` or `packages/`, the detector SHALL recurse one level into its children and classify those subfolders instead of the wrapper.

#### Scenario: Nx layout with apps/backend and apps/frontend
- **WHEN** the tree contains `apps/backend/` and `apps/frontend/`
- **THEN** `backendPaths` SHALL contain `'apps/backend/'` and `frontendPaths` SHALL contain `'apps/frontend/'`

#### Scenario: Wrapper folder itself is not returned
- **WHEN** an `apps/` wrapper is present
- **THEN** `'apps/'` SHALL NOT appear in either `backendPaths` or `frontendPaths`

### Requirement: Gemini LLM fallback for ambiguous layouts
When heuristic confidence remains `'low'` after the heuristic pass, the detector SHALL call `generateJSON()` from `lib/gemini.ts` with a prompt listing the top-level folders and requesting per-folder classification as `'backend' | 'frontend' | 'shared' | 'other'`. The result SHALL populate `backendPaths`, `frontendPaths`, set `confidence` to `'medium'`, and include `reasoning` from the LLM response.

#### Scenario: LLM fallback triggered for ambiguous tree
- **WHEN** heuristics cannot determine backend vs frontend with confidence above 'low'
- **THEN** Gemini SHALL be called and the result SHALL set `confidence` to `'medium'` and populate `reasoning`

#### Scenario: LLM fallback not triggered when heuristics are clear
- **WHEN** heuristics yield `confidence: 'high'`
- **THEN** no Gemini call SHALL be made

### Requirement: Next.js full-stack overlap support
When the repository appears to be a single Next.js full-stack project (one folder combining both API routes and React pages), the detector SHALL return the root path `'/'` in both `backendPaths` and `frontendPaths`.

#### Scenario: Next.js monorepo detected
- **WHEN** the root `package.json` contains both `next` and no separate frontend/backend folders
- **THEN** both `backendPaths` and `frontendPaths` SHALL contain `'/'`

### Requirement: Graceful handling of single-stack repos
When only one side (backend or frontend) is detected, the detector SHALL return an empty array for the missing side and set `confidence` to `'low'` rather than throwing an error.

#### Scenario: Backend-only repository
- **WHEN** only backend indicators are found
- **THEN** `frontendPaths` SHALL be `[]` and `confidence` SHALL be `'low'`

### Requirement: Test coverage
The module SHALL have a corresponding test file `tests/monorepo-detector.test.ts` covering at least 6 distinct layout scenarios: Express + React separate folders, Next.js full-stack, NestJS + Vue, FastAPI + React (Nx layout), Laravel + Inertia, and an ambiguous case that exercises the LLM fallback path (with Gemini mocked).

#### Scenario: All 6 test layouts pass
- **WHEN** the test suite runs via `npm test` or `npx jest`
- **THEN** all 6 scenario tests SHALL pass without error
