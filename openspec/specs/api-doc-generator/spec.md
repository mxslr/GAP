## ADDED Requirements

### Requirement: Generate API documentation from analyzed routes
The system SHALL provide a `generateApiDocs(routes: AnalyzedRoute[], features: FeatureGroup[])` function that returns a `{ markdown: string, openapi: object }` object containing complete API documentation.

#### Scenario: Basic generation with pre-enriched routes
- **WHEN** `generateApiDocs` is called with routes that already have `description`, `fetchSnippet`, and `tsTypes` populated
- **THEN** the function returns a `markdown` string containing a TOC, feature sections, and per-route subsections without making additional Gemini calls

#### Scenario: Auto-enrich routes missing snippet data
- **WHEN** `generateApiDocs` is called with routes that are missing `fetchSnippet` or `tsTypes`
- **THEN** the function calls `generateSnippets` for each incomplete route before building documentation

#### Scenario: Markdown structure includes all required sections
- **WHEN** `generateApiDocs` returns successfully
- **THEN** the `markdown` string SHALL contain:
  - A `# API Documentation` heading with generation timestamp
  - A `## Table of Contents` section listing all feature names
  - One `## {Feature Name}` section per feature group with feature description
  - Per-route subsections using `` ### `{METHOD} {path}` `` heading
  - Description paragraph, **Request:** TypeScript block (for POST/PUT/PATCH), **Response:** TypeScript block, **Example:** fetch snippet block, and a `---` separator

#### Scenario: OpenAPI 3.0 JSON output
- **WHEN** `generateApiDocs` returns successfully
- **THEN** the `openapi` object SHALL conform to OpenAPI 3.0 with:
  - `openapi: '3.0.0'`
  - `info: { title: 'GAP Generated API', version: '1.0.0' }`
  - `paths` object with each route's method, summary, description, requestBody (POST/PUT/PATCH), and responses
  - `components.schemas` populated from tsTypes for each route

### Requirement: Enrich routes with Gemini-generated documentation data
The system SHALL call Gemini to enrich each route with detailed prose description (2-3 sentences), example request body JSON (for POST/PUT/PATCH routes), example response JSON (realistic data), and possible error codes.

#### Scenario: Batch enrichment for multiple routes
- **WHEN** `generateApiDocs` is called with N routes requiring enrichment
- **THEN** the system SHALL batch routes in groups of up to 20 and call Gemini once per batch using `responseMimeType: 'application/json'`

#### Scenario: Graceful fallback on Gemini failure
- **WHEN** the Gemini enrichment call fails after 2 retries
- **THEN** the route SHALL use a plain description fallback (`{METHOD} {path} endpoint`) and empty request/response examples, without throwing

#### Scenario: SnippetCache prevents duplicate Gemini calls
- **WHEN** `generateApiDocs` is called and a route's `method:path` key exists in SnippetCache
- **THEN** cached data SHALL be used and Gemini SHALL NOT be called for that route

### Requirement: POST /api/docs endpoint for Mode 3
The system SHALL expose a `POST /api/docs` API endpoint that accepts `{ backendCode: string }` and runs the full backend-only pipeline. If the database is unavailable, the endpoint SHALL still return the generated result with `analysisId: null` rather than returning an error.

#### Scenario: Successful end-to-end doc generation
- **WHEN** `POST /api/docs` is called with valid backend code containing detectable routes
- **THEN** the response SHALL have status 200 and body `{ analysisId: string, markdown: string, openapi: object }`

#### Scenario: Backend code with no detectable routes
- **WHEN** `POST /api/docs` is called with code that yields zero routes after parsing
- **THEN** the response SHALL have status 200 with empty feature groups and a minimal Markdown doc stating no routes were found

#### Scenario: Missing backendCode in request body
- **WHEN** `POST /api/docs` is called without a `backendCode` field
- **THEN** the response SHALL have status 400 and body `{ error: 'backendCode is required' }`

#### Scenario: Analysis persisted to database
- **WHEN** `POST /api/docs` completes successfully and the database is reachable
- **THEN** an `Analysis` record with `mode: 'backend-only'` SHALL be saved, along with associated `Route`, `Feature`, and `ApiDoc` records

#### Scenario: Graceful degradation when database is unavailable
- **WHEN** `POST /api/docs` completes pipeline successfully but the Prisma write throws
- **THEN** the endpoint SHALL catch the error, log it, and return status 200 with `{ analysisId: null, markdown: string, openapi: object }` rather than returning a 500 error

### Requirement: Tests for api-doc-generator module
The system SHALL have a test suite at `tests/api-doc-generator.test.ts` covering the generation logic.

#### Scenario: Test Markdown structure
- **WHEN** `generateApiDocs` is called with mock routes and features
- **THEN** tests SHALL assert the Markdown contains expected TOC entries, feature headings, and route subsections

#### Scenario: Test OpenAPI output structure
- **WHEN** `generateApiDocs` is called with mock routes
- **THEN** tests SHALL assert the OpenAPI object has correct `info`, `paths` keys matching route method+path combinations, and `components.schemas`

#### Scenario: Test enrichment fallback
- **WHEN** Gemini call is mocked to throw
- **THEN** tests SHALL assert generation completes without throwing and produces valid (if minimal) documentation
