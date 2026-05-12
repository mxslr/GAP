## MODIFIED Requirements

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
