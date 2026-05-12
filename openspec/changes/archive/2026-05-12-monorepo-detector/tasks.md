## 1. Type Definitions

- [x] 1.1 Add `FileTreeEntry` interface to `lib/types.ts` with fields `path: string`, `type: 'file' | 'dir'`, `content?: string`

## 2. Text Tree Parser

- [x] 2.1 Implement `parseTextTree(raw: string): FileTreeEntry[]` — convert `tree` command output or indented text into `FileTreeEntry[]`
- [x] 2.2 Handle both Unix (`├──`, `└──`) and plain-indented formats
- [x] 2.3 Infer `type` as `'dir'` for lines without file extensions and `'file'` otherwise

## 3. Heuristic Detection

- [x] 3.1 Implement `BACKEND_FOLDER_NAMES` and `FRONTEND_FOLDER_NAMES` constant sets
- [x] 3.2 Implement `BACKEND_INDICATOR_FILES` and `FRONTEND_INDICATOR_FILES` constant sets (e.g., `requirements.txt`, `composer.json`)
- [x] 3.3 Implement `classifyByFolderName(entries: FileTreeEntry[]): Partial<MonorepoLayout>` — match top-level dirs against name constants
- [x] 3.4 Implement `classifyByIndicatorFiles(entries: FileTreeEntry[]): Partial<MonorepoLayout>` — match presence of indicator files; parse `package.json` content if available to detect framework deps
- [x] 3.5 Implement `detectAppsWrapper(entries: FileTreeEntry[]): FileTreeEntry[]` — if `apps/` or `packages/` dir exists, return its children as the effective top-level entries
- [x] 3.6 Implement confidence scoring: indicator file match → `'high'`; folder name only → `'medium'`; no signal → `'low'`

## 4. LLM Fallback

- [x] 4.1 Implement `classifyWithGemini(topLevelFolders: string[]): Promise<Partial<MonorepoLayout>>` — call `generateJSON()` from `lib/gemini.ts` with a prompt listing folder names
- [x] 4.2 Define Gemini response schema: `{ folders: { name: string, role: 'backend' | 'frontend' | 'shared' | 'other', reasoning: string }[] }`
- [x] 4.3 Map Gemini response to `backendPaths` and `frontendPaths`; set `confidence: 'medium'`; aggregate reasoning strings

## 5. Main Detector Function

- [x] 5.1 Implement `detectMonorepoLayout(fileTree: string | FileTreeEntry[]): Promise<MonorepoLayout>` — normalize input, apply apps-wrapper detection, run heuristic pass
- [x] 5.2 If heuristic confidence is `'low'`, call LLM fallback
- [x] 5.3 Handle Next.js full-stack edge case: if root `package.json` contains `next` and no separate BE/FE folders found, return `'/'` for both paths
- [x] 5.4 Ensure single-stack repos return `[]` for the missing side with `confidence: 'low'`
- [x] 5.5 Export `detectMonorepoLayout` as named export from `lib/repo/monorepo-detector.ts`

## 6. Tests

- [x] 6.1 Set up `tests/monorepo-detector.test.ts` with Jest and mock for `lib/gemini.ts`
- [x] 6.2 Test case: Express + React (separate `server/` and `client/` folders) → expects `confidence: 'high'`
- [x] 6.3 Test case: Next.js full-stack (root `package.json` with `next`) → expects both paths `'/'`
- [x] 6.4 Test case: NestJS + Vue (`backend/` and `frontend/` folders with indicator files) → expects `confidence: 'high'`
- [x] 6.5 Test case: FastAPI + React in Nx layout (`apps/api/` and `apps/web/`) → expects Nx wrapper unwrapped
- [x] 6.6 Test case: Laravel + Inertia (`composer.json` at root with a `resources/js/` frontend) → expects backend root and frontend subpath
- [x] 6.7 Test case: Ambiguous layout (no standard names, no indicator files) → expects LLM fallback called, `confidence: 'medium'`
