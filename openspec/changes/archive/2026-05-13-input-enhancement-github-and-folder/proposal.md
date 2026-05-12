## Why

The app currently only accepts pasted code, which is a friction point for developers who want to analyze real repositories. Adding GitHub URL fetching and local folder drop/upload removes this barrier and makes GAP usable on actual codebases in seconds — not just toy examples pasted into a textarea.

## What Changes

- Add `lib/repo/github-fetcher.ts` — server-side utility to fetch file trees and contents from public GitHub repos via the GitHub Contents API
- Add `lib/repo/folder-reader.ts` — client-side utility to read local folders via drag-and-drop or file picker (`webkitdirectory`)
- Add `RepoContent` and `FileEntry` types to `lib/types.ts`
- Add `components/InputMethodTabs.tsx` — tab switcher between GitHub URL / Drop Folder / Paste Code
- Add `components/GitHubInput.tsx` — GitHub URL input with validation and repo preview badge
- Add `components/FolderDropZone.tsx` — drag-and-drop / click-to-browse folder input with file count feedback
- Update `app/analyze/page.tsx` — replace current input section with `InputMethodTabs`; conditionally render per mode × method combination
- Update `app/api/analyze/route.ts` — accept `inputMethod` field; normalize github/folder inputs to code strings before pipeline
- Update `app/docs-generator/page.tsx` — same `InputMethodTabs` treatment for backend-only input
- Global text readability audit — upgrade all readable content from `fg.tertiary` (#5C5C5C) to minimum `fg.secondary` (#A0A0A0)
- Add `tests/github-fetcher.test.ts` and `tests/folder-reader.test.ts`

## Capabilities

### New Capabilities

- `github-fetcher`: Fetch file tree and relevant file contents from a public GitHub repo URL (supports `/tree/branch/subfolder` variants); handles rate limits, private repos, and invalid URLs gracefully
- `folder-reader`: Client-side recursive folder reading via drag-and-drop or `<input webkitdirectory>`; filters out non-source files, limits to 200 files, skips binaries and files >500KB
- `input-method-tabs`: UI tab component that switches between three input methods (GitHub URL, Drop Folder, Paste Code); works across all three analysis modes (monorepo, separate, backend-only)

### Modified Capabilities

- `analyze-page`: Input section now supports three input methods instead of paste-only; rendering matrix is mode × method (9 combinations); existing paste path and analysis pipeline unchanged
- `analyze-api-route`: Accepts new `inputMethod` field and optional `backendGithubUrl`/`frontendGithubUrl`/`repoGithubUrl`; normalizes all inputs to code strings before passing to existing pipeline
- `docs-generator-page`: Input section gains same `InputMethodTabs` treatment for backend-only single input

## Impact

- New dependency: `@tabler/icons-react` is already used in existing components — no new package needed
- GitHub Contents API: no auth needed for public repos; rate limit is 60 req/hr unauthenticated — fetcher caps at 100 files with max 10 concurrent fetches to stay well within limit
- No changes to parsers, analyzer, generators, Gemini client, DB schema, or Prisma
- `lib/types.ts` gains two new interfaces (`RepoContent`, `FileEntry`) — additive, no breaking changes
- `app/api/analyze/route.ts` gains new optional fields — fully backward-compatible with existing paste-only clients
