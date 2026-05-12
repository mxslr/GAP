## 1. Types and Shared Contracts

- [x] 1.1 Add `FileEntry` interface to `lib/types.ts` (`path: string`, `content: string`, `size: number`)
- [x] 1.2 Add `RepoContent` interface to `lib/types.ts` (`files: FileEntry[]`, `repoUrl?: string`, `branch?: string`, `totalFiles: number`, `skippedFiles: number`)

## 2. GitHub Fetcher (server-side)

- [x] 2.1 Create `lib/repo/github-fetcher.ts` with `parseGithubUrl(url)` helper that extracts owner, repo, branch, subfolder from all supported URL formats
- [x] 2.2 Implement `fetchFileTree(owner, repo, branch, subfolder?)` that calls GitHub Contents API with `?recursive=1` and filters to source files only (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.php`)
- [x] 2.3 Implement file exclusion logic: skip paths containing `node_modules`, `.next`, `dist`, `build`, `__pycache__`, `vendor`, and files matching `*.test.*` / `*.spec.*`; cap result at 100 files
- [x] 2.4 Implement parallel file content fetching with max 10 concurrent requests; decode base64 content
- [x] 2.5 Implement error handling for 403 (rate limit), 404 (private/missing), and network errors with user-friendly messages
- [x] 2.6 Export `fetchGithubRepo(url: string): Promise<RepoContent>` as the public API

## 3. Folder Reader (client-side)

- [x] 3.1 Create `lib/repo/folder-reader.ts` with `readDroppedFolder(items: DataTransferItemList): Promise<RepoContent>` using `FileSystemDirectoryEntry` API for recursive traversal
- [x] 3.2 Implement `readSelectedFolder(files: FileList): Promise<RepoContent>` using `webkitRelativePath` for paths
- [x] 3.3 Apply same exclusion rules as github-fetcher (node_modules, dist, etc.); cap at 200 files
- [x] 3.4 Skip binary files (detect null bytes after UTF-8 decode) and files larger than 500KB; increment `skippedFiles` counter for each
- [x] 3.5 Return `RepoContent` with `repoUrl: undefined`, `branch: undefined` for local folder input

## 4. UI Components

- [x] 4.1 Create `components/InputMethodTabs.tsx` with three tab buttons (`"github url"`, `"drop folder"`, `"paste code"`), controlled via `activeMethod` / `onMethodChange` props, no border-radius, 0.2s ease transitions, inactive tabs at `fg.secondary`
- [x] 4.2 Create `components/GitHubInput.tsx` with text input, blur-validation, inline error in `status.orphan` red, repo preview badge (`owner/repo`) shown on valid URL, loading state with Spinner
- [x] 4.3 Create `components/FolderDropZone.tsx` with dashed border (1px dashed `border.default`), `IconFolder` icon, drag-over state (white border + `bg.tertiary` background), hidden `<input type="file" webkitdirectory />`, file-count badge after selection — no border-radius anywhere

## 5. Analyze Page Update

- [x] 5.1 Add "Backend-Only" as a third tab to the existing `ModeSelector` in `app/analyze/page.tsx` (or update `components/ModeSelector.tsx` if mode selector is a separate component)
- [x] 5.2 Add `InputMethodTabs` below `ModeSelector` in `app/analyze/page.tsx`; store active method in component state
- [x] 5.3 Implement 3×3 input rendering matrix: for each of 9 mode×method combinations, render the correct input slot(s) with correct labels
- [x] 5.4 Add `"fetching repository..."` as first loading step when `inputMethod === 'github'`; add `"reading folder..."` as first step when `inputMethod === 'folder'`
- [x] 5.5 Wire `FolderDropZone` `onFilesRead` callback to store `RepoContent` in state and convert to code string (concatenated with `// === FILE: {path} ===\n{content}` format) before form submission
- [x] 5.6 Wire `GitHubInput` to pass the URL string in form submission payload under the correct field (`repoGithubUrl`, `backendGithubUrl`, or `frontendGithubUrl` depending on mode)
- [x] 5.7 Ensure existing paste textarea behavior and analyze button logic remain unchanged

## 6. API Route Update

- [x] 6.1 Update `app/api/analyze/route.ts` to accept `inputMethod: 'github' | 'folder' | 'paste'` (default `'paste'`) in the request body
- [x] 6.2 Add validation: if `inputMethod === 'github'`, check that required GitHub URL fields are present per mode; return 400 with `INVALID_INPUT` code if missing
- [x] 6.3 Implement GitHub normalization branch: call `fetchGithubRepo` for each provided URL; concatenate `FileEntry[]` into code string; map to `backendCode`/`frontendCode`/`repoSource` before pipeline
- [x] 6.4 Return 429 for `GITHUB_RATE_LIMIT` errors and 400 for `GITHUB_PRIVATE_REPO` errors from `fetchGithubRepo`
- [x] 6.5 Keep all existing pipeline execution, persistence, and response shape logic unchanged

## 7. Docs Generator Page Update

- [x] 7.1 Add `InputMethodTabs` to `app/docs-generator/page.tsx` above the existing textarea; store active method in state
- [x] 7.2 Conditionally render: `GitHubInput` (labeled "backend repository") for github method, `FolderDropZone` (labeled "backend folder") for folder method, existing textarea for paste method
- [x] 7.3 Add `"fetching repository..."` / `"reading folder..."` as first loading step for respective methods
- [x] 7.4 Wire folder and GitHub inputs to produce a code string passed to existing `POST /api/docs` call (folder: converted client-side; github URL: sent to API for server-side fetch)

## 8. Text Readability Audit

- [x] 8.1 Add utility classes to `app/globals.css`: `.text-readable { color: var(--fg-secondary); }`, `.text-primary { color: var(--fg-primary); }`, `.text-hint { color: var(--fg-tertiary); }`
- [x] 8.2 Audit `app/page.tsx` (landing): upgrade all readable secondary content (taglines, descriptions, sub-headlines, footer text) from `fg.tertiary` to minimum `fg.secondary`
- [x] 8.3 Audit `app/analyze/page.tsx`: upgrade step messages, label text, helper text, non-active tab labels, filter button labels from `fg.tertiary` to `fg.secondary`
- [x] 8.4 Audit `app/history/page.tsx`: upgrade timestamps, badge/pill text, description text to minimum `fg.secondary`
- [x] 8.5 Audit all route card components (`RouteCard`, `FeatureGroup`, `MetricCard`): upgrade description `<p>` tags and secondary labels to `fg.secondary`
- [x] 8.6 Audit `app/docs-generator/page.tsx` and `ApiDocPanel`: upgrade helper text, section labels, step messages to `fg.secondary`
- [x] 8.7 Verify `fg.tertiary` (#5C5C5C) is used ONLY for `placeholder` attributes, disabled elements, and decorative separators — nowhere else

## 9. Tests

- [x] 9.1 Create `tests/github-fetcher.test.ts`: test `parseGithubUrl` for 5 URL formats (plain repo, with branch, with branch+subfolder, trailing slash, invalid URL throws)
- [x] 9.2 Add tests to `tests/github-fetcher.test.ts`: test file exclusion logic (node_modules excluded, test files excluded, 100-file cap)
- [x] 9.3 Create `tests/folder-reader.test.ts`: test file filtering logic (mock FileList with excluded dirs, binary file detection, 200-file cap, skip >500KB)
