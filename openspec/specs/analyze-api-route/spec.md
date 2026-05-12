## ADDED Requirements

### Requirement: POST /api/analyze input validation
The endpoint SHALL accept `POST` requests with a JSON body: `{ mode: 'monorepo' | 'separate', backendCode?: string, frontendCode?: string, repoSource?: string }`. It SHALL return `400` if mode is missing or invalid, if mode is `'monorepo'` and `repoSource` is empty, or if mode is `'separate'` and either `backendCode` or `frontendCode` is empty.

#### Scenario: Missing mode
- **WHEN** a POST request is sent without a `mode` field
- **THEN** the endpoint SHALL return `{ error: "mode is required", code: "INVALID_INPUT" }` with status 400

#### Scenario: Separate mode missing frontend code
- **WHEN** mode is `'separate'` and `frontendCode` is empty or missing
- **THEN** the endpoint SHALL return `{ error: "frontendCode is required for separate mode", code: "INVALID_INPUT" }` with status 400

### Requirement: Monorepo pipeline execution
When `mode === 'monorepo'`, the endpoint SHALL call `detectMonorepoLayout(repoSource)` to identify backend and frontend content sections, then pass each section to the respective parsers.

#### Scenario: Monorepo layout detection
- **WHEN** mode is `'monorepo'` and `repoSource` is provided
- **THEN** `detectMonorepoLayout` SHALL be called and its result used to split the source into backend and frontend segments before parsing

### Requirement: Full pipeline orchestration
The endpoint SHALL execute the pipeline in order: parse backend routes → parse frontend calls → analyze gap → classify features → generate snippets batch. The result SHALL conform to `GapAnalysisResult` from `lib/types.ts`.

#### Scenario: Pipeline completes successfully
- **WHEN** all pipeline steps succeed
- **THEN** the endpoint SHALL return status 200 with a valid `GapAnalysisResult` JSON body

#### Scenario: Pipeline step failure
- **WHEN** any pipeline step throws an unhandled error
- **THEN** the endpoint SHALL catch it and return `{ error: "analysis failed", code: "PIPELINE_ERROR" }` with status 500

### Requirement: POST /api/analyze response shape
On success, the endpoint SHALL return `200` with `Content-Type: application/json` and a body matching `GapAnalysisResult`: `{ mode, routes, features, summary: { total, connected, orphan, ghost } }`.

#### Scenario: Response includes all summary counts
- **WHEN** analysis completes with routes of mixed statuses
- **THEN** `summary.connected + summary.orphan + summary.ghost` SHALL equal `summary.total`
