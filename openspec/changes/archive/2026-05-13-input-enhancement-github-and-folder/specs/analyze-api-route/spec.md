## MODIFIED Requirements

### Requirement: POST /api/analyze input validation
The endpoint SHALL accept `POST` requests with a JSON body containing: `mode` (`'monorepo' | 'separate' | 'backend-only'`), `inputMethod` (`'github' | 'folder' | 'paste'`, defaulting to `'paste'` if absent), and input fields depending on method:
- For `inputMethod: 'paste'` or `'folder'`: `backendCode?`, `frontendCode?`, `repoSource?` (same as before)
- For `inputMethod: 'github'` with `mode: 'monorepo'`: `repoGithubUrl: string`
- For `inputMethod: 'github'` with `mode: 'separate'`: `backendGithubUrl: string`, `frontendGithubUrl: string`
- For `inputMethod: 'github'` with `mode: 'backend-only'`: `backendGithubUrl: string`

It SHALL return `400` if mode is missing or invalid, or if required input fields for the mode+method combination are missing or empty.

#### Scenario: Missing mode
- **WHEN** a POST request is sent without a `mode` field
- **THEN** the endpoint SHALL return `{ error: "mode is required", code: "INVALID_INPUT" }` with status 400

#### Scenario: GitHub method missing URL
- **WHEN** `inputMethod` is `'github'` and `mode` is `'monorepo'` but `repoGithubUrl` is missing
- **THEN** the endpoint SHALL return `{ error: "repoGithubUrl is required for github input method", code: "INVALID_INPUT" }` with status 400

#### Scenario: Separate mode missing frontend code (paste method)
- **WHEN** `mode` is `'separate'`, `inputMethod` is `'paste'`, and `frontendCode` is empty
- **THEN** the endpoint SHALL return `{ error: "frontendCode is required for separate mode", code: "INVALID_INPUT" }` with status 400

#### Scenario: Missing inputMethod defaults to paste
- **WHEN** a POST request omits `inputMethod`
- **THEN** the endpoint SHALL treat it as `inputMethod: 'paste'` and validate accordingly

### Requirement: GitHub input normalization
When `inputMethod === 'github'`, the endpoint SHALL call `fetchGithubRepo` from `lib/repo/github-fetcher.ts` for each provided URL and concatenate the resulting `FileEntry[]` contents into a single code string using the format `// === FILE: {path} ===\n{content}`. The resulting strings SHALL be used in place of `backendCode`, `frontendCode`, or `repoSource` before passing to the analysis pipeline.

#### Scenario: GitHub URL fetched and normalized to code string
- **WHEN** `inputMethod` is `'github'` and `backendGithubUrl` is provided
- **THEN** `fetchGithubRepo(backendGithubUrl)` SHALL be called and its result concatenated into the backend code string

#### Scenario: GitHub rate limit error surfaced to client
- **WHEN** `fetchGithubRepo` throws with rate-limit message
- **THEN** the endpoint SHALL return `{ error: "GitHub rate limit reached, please paste code directly", code: "GITHUB_RATE_LIMIT" }` with status 429

#### Scenario: GitHub private repo error surfaced to client
- **WHEN** `fetchGithubRepo` throws with private-repo message
- **THEN** the endpoint SHALL return `{ error: "Private repo — please paste code directly or drop folder", code: "GITHUB_PRIVATE_REPO" }` with status 400

### Requirement: Monorepo pipeline execution
When `mode === 'monorepo'`, the endpoint SHALL call `detectMonorepoLayout(repoSource)` to identify backend and frontend content sections, then pass each section to the respective parsers. This applies regardless of `inputMethod` (after normalization).

#### Scenario: Monorepo layout detection
- **WHEN** mode is `'monorepo'` and code source is provided (any input method)
- **THEN** `detectMonorepoLayout` SHALL be called and its result used to split the source

### Requirement: Full pipeline orchestration
The endpoint SHALL execute the pipeline in order: parse backend routes → parse frontend calls → analyze gap → classify features → generate snippets batch. The result SHALL conform to `GapAnalysisResult`.

#### Scenario: Pipeline completes successfully
- **WHEN** all pipeline steps succeed
- **THEN** the endpoint SHALL return status 200 with a valid `GapAnalysisResult` JSON body

#### Scenario: Pipeline step failure
- **WHEN** any pipeline step throws an unhandled error
- **THEN** the endpoint SHALL return `{ error: "analysis failed", code: "PIPELINE_ERROR" }` with status 500

### Requirement: POST /api/analyze response shape
On success, the endpoint SHALL return `200` with a body matching `GapAnalysisResult` plus `analysisId`.

#### Scenario: Response includes all summary counts
- **WHEN** analysis completes with routes of mixed statuses
- **THEN** `summary.connected + summary.orphan + summary.ghost` SHALL equal `summary.total`

### Requirement: POST /api/analyze persists result to database
After a successful pipeline run, `POST /api/analyze` SHALL attempt to save the result to the database. The response body SHALL include `analysisId` on success or `null` on DB failure.

#### Scenario: Response includes analysisId on successful DB write
- **WHEN** pipeline succeeds and DB write succeeds
- **THEN** response body SHALL include `analysisId` as a non-null UUID string

#### Scenario: Response includes analysisId null on DB failure
- **WHEN** pipeline succeeds but Prisma write throws
- **THEN** response SHALL return status 200 with `analysisId: null` and full result
