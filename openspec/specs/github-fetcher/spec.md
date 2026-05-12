## ADDED Requirements

### Requirement: Parse GitHub URL into components
The `fetchGithubRepo` function SHALL accept a GitHub URL string and extract `owner`, `repo`, `branch` (defaulting to `main`), and optional `subfolder` from it. It SHALL support the following URL formats: `https://github.com/owner/repo`, `https://github.com/owner/repo/tree/branch`, and `https://github.com/owner/repo/tree/branch/subfolder`.

#### Scenario: Plain repo URL parsed correctly
- **WHEN** URL is `https://github.com/owner/repo`
- **THEN** owner is `"owner"`, repo is `"repo"`, branch is `"main"`, subfolder is `undefined`

#### Scenario: URL with branch parsed correctly
- **WHEN** URL is `https://github.com/owner/repo/tree/develop`
- **THEN** owner is `"owner"`, repo is `"repo"`, branch is `"develop"`, subfolder is `undefined`

#### Scenario: URL with branch and subfolder parsed correctly
- **WHEN** URL is `https://github.com/owner/repo/tree/main/backend/src`
- **THEN** owner is `"owner"`, repo is `"repo"`, branch is `"main"`, subfolder is `"backend/src"`

#### Scenario: Invalid URL returns error
- **WHEN** URL does not match GitHub URL pattern
- **THEN** function SHALL throw an error with message `"Invalid GitHub URL format"`

#### Scenario: URL with trailing slash parsed correctly
- **WHEN** URL is `https://github.com/owner/repo/`
- **THEN** trailing slash is ignored and owner/repo extracted correctly

### Requirement: Fetch file tree from GitHub Contents API
`fetchGithubRepo` SHALL call `GET https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1` to retrieve the full file tree. It SHALL filter the result to only include source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.php`) and SHALL exclude paths containing `node_modules`, `.next`, `dist`, `build`, `__pycache__`, `vendor`, and files matching `*.test.*` or `*.spec.*`. If a `subfolder` was extracted from the URL, only files within that subfolder path SHALL be included. Result SHALL be capped at 100 files.

#### Scenario: File tree filtered to source files only
- **WHEN** the GitHub tree contains a mix of source files and non-source files
- **THEN** only `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.php` files SHALL be in the result

#### Scenario: Excluded paths removed from result
- **WHEN** the tree contains paths like `node_modules/express/index.js` or `dist/bundle.js`
- **THEN** those files SHALL not appear in the returned file list

#### Scenario: Result capped at 100 files
- **WHEN** filtered tree contains more than 100 files
- **THEN** only the first 100 files SHALL be fetched

### Requirement: Fetch file contents in parallel
`fetchGithubRepo` SHALL fetch file contents for all selected files from the GitHub Contents API with a maximum concurrency of 10 simultaneous requests. Each file's content SHALL be decoded from base64. The returned `RepoContent` SHALL include a `files` array with `{ path, content, size }` for each file.

#### Scenario: Files fetched in parallel batches
- **WHEN** 25 files are to be fetched
- **THEN** they SHALL be fetched in batches of at most 10 concurrent requests

#### Scenario: File content decoded from base64
- **WHEN** GitHub Contents API returns a file with base64-encoded content
- **THEN** the stored `content` field SHALL be the decoded UTF-8 string

### Requirement: Handle GitHub API errors gracefully
`fetchGithubRepo` SHALL throw typed errors for common failure cases.

#### Scenario: Rate limit error (403)
- **WHEN** GitHub API returns 403
- **THEN** function SHALL throw with message `"GitHub rate limit reached, please paste code directly"`

#### Scenario: Private or missing repo (404)
- **WHEN** GitHub API returns 404
- **THEN** function SHALL throw with message `"Private repo — please paste code directly or drop folder"`

#### Scenario: Network error
- **WHEN** fetch call throws a network-level error
- **THEN** function SHALL re-throw with a user-readable message prefixed with `"GitHub fetch failed: "`
