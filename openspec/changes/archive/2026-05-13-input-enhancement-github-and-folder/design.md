## Context

GAP currently accepts input only as pasted text in a textarea. Developers who want to analyze real repositories must manually copy-paste file contents — a high-friction workflow that limits adoption. The input layer is entirely separate from the analysis pipeline (parsers, gap analyzer, feature classifier), which already accepts plain code strings. Adding GitHub URL fetching and local folder reading only requires a normalization step that converts the new input methods into the same code strings the pipeline already consumes.

The app has three analysis modes (monorepo, separate, backend-only) and we are adding three input methods (GitHub URL, folder drop, paste) — producing a 3×3 matrix. All nine combinations must work.

## Goals / Non-Goals

**Goals:**
- Add `fetchGithubRepo` (server-side) to pull file trees and contents from public GitHub repos
- Add `readDroppedFolder` / `readSelectedFolder` (client-side) for local folder input
- Add `InputMethodTabs`, `GitHubInput`, `FolderDropZone` UI components
- Integrate all three input methods into `/analyze` and `/docs-generator` pages
- Extend `POST /api/analyze` to accept GitHub URLs and normalize them to code strings server-side
- Audit and fix text readability (fg.tertiary → fg.secondary for readable content)
- No changes to parsers, gap analyzer, feature classifier, snippet generator, or DB schema

**Non-Goals:**
- Private GitHub repos (no OAuth flow)
- GitHub App token / PAT support (out of scope for hackathon)
- Uploading individual files (only full folders)
- Caching fetched GitHub content between requests
- Diff/incremental analysis on re-fetch

## Decisions

### Decision 1: GitHub fetching happens server-side, folder reading happens client-side

GitHub fetching is placed in `lib/repo/github-fetcher.ts` and called from `app/api/analyze/route.ts` on the server. This avoids CORS issues with the GitHub API (GitHub sets `Access-Control-Allow-Origin: *` for the Contents API, but rate-limiting by IP is safer when the server is the caller), keeps secrets (if we ever add a PAT) off the client, and simplifies the client to just send a URL string.

Folder reading must be client-side because `File` and `DataTransfer` APIs are browser-only. The folder is read in the browser, its contents are concatenated into a code string, and then the existing API call is made with `inputMethod: 'folder'` and the code string in the body — identical to the paste flow from the API's perspective.

**Alternative considered**: Client-side GitHub fetch via proxy API. Rejected because it adds an extra round-trip and the server-side approach already works cleanly.

### Decision 2: API route normalizes all inputs to code strings before pipeline

`POST /api/analyze` gains a new `inputMethod` field. When `inputMethod === 'github'`, the route calls `fetchGithubRepo` and concatenates all fetched file contents into a single code string (with file path headers for context), then proceeds identically to paste mode. When `inputMethod === 'folder'` or `'paste'`, the existing code string fields are used directly.

This keeps the analysis pipeline unchanged — parsers still receive plain strings.

**Alternative considered**: Pass `FileEntry[]` through the pipeline. Rejected because it would require touching all parsers and the monorepo detector.

### Decision 3: File concatenation format for GitHub and folder inputs

Fetched files are concatenated as:
```
// === FILE: src/routes/auth.ts ===
<file content>

// === FILE: src/routes/users.ts ===
<file content>
```

This gives the Gemini-based parsers file path context for better route attribution. Existing regex parsers are unaffected (they look for route patterns, not file separators).

### Decision 4: FolderDropZone is a pure client component — folder content sent as code string

The folder reader runs entirely in the browser. After reading, the content is stored in React state as a string (same as the paste textarea). When the user clicks "Analyze", the string is sent in the request body exactly like paste mode. This means no new API changes are needed for folder input beyond adding `inputMethod: 'folder'` (which is informational — the backend treats it identically to `'paste'`).

### Decision 5: InputMethodTabs state lives in the analyze page component

`InputMethodTabs` is a controlled component receiving `activeMethod` and `onMethodChange` props. The page holds the state. This avoids prop-drilling issues and keeps the tabs reusable for both `/analyze` and `/docs-generator`.

## Risks / Trade-offs

- **GitHub rate limit (60 req/hr unauthenticated)** → Mitigation: cap at 100 files, batch fetches at max 10 concurrent, return a clear user-facing error on 403
- **Large repos exceed payload limits** → Mitigation: 200-file cap for folder, 100-file cap for GitHub; skip files >500KB; Next.js default body limit is 4MB — concatenated content of 100×500KB would exceed this, so effective file limit is ~8KB avg per file at 100 files. In practice, route-relevant files are small (< 50KB each). If we hit limits we can raise `api.bodyParser.sizeLimit` in next.config.js.
- **Binary files in folder drop** → Mitigation: attempt text decode; skip if result contains null bytes or throws
- **Monorepo detector receives concatenated multi-file string** → No risk — detector already handles multi-file pasted content; file path headers in the concatenation improve its accuracy
- **Folder reading blocks main thread on large repos** → Mitigation: 200-file cap; async `readAsText` per file; no synchronous operations

## Migration Plan

No database or API contract changes — fully additive. Existing clients sending `{ mode, backendCode }` continue to work unchanged. New `inputMethod` field defaults to `'paste'` if absent.

Deploy order: any — no coordination needed between frontend and backend changes.

## Open Questions

- Should we show a per-file progress indicator during GitHub fetch? (Currently planned: single spinner + "fetching repository..." step message)
- Should the GitHub URL input attempt a HEAD request to validate the URL before the user clicks Analyze? (Currently: validate format on blur, fetch only on submit)
