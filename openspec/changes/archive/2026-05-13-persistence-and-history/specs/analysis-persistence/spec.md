## ADDED Requirements

### Requirement: Persist gap analysis result to database
After a successful gap analysis pipeline run, the system SHALL create an `Analysis` record with `mode`, `backendSource`, `frontendSource` (or `repoSource` for monorepo), `totalRoutes`, `connectedCount`, `orphanCount`, and `ghostCount`. It SHALL then create associated `Route` and `Feature` records. The operation SHALL be wrapped in a try/catch so that a database failure does not prevent the HTTP response from being returned.

#### Scenario: Successful persistence of gap analysis
- **WHEN** `POST /api/analyze` completes the pipeline successfully and the database is reachable
- **THEN** an `Analysis` record SHALL be created with correct mode and summary counts, and all `Route` and `Feature` records SHALL be associated with it

#### Scenario: DB failure during gap analysis persistence
- **WHEN** `POST /api/analyze` completes the pipeline successfully but the Prisma write throws
- **THEN** the endpoint SHALL catch the error, log it, and return status 200 with `{ analysisId: null, ...result }` rather than returning a 500 error

### Requirement: Persist docs generation result to database
After a successful docs generation pipeline run, the system SHALL create an `Analysis` record with `mode: 'backend-only'` and associated `Route`, `Feature`, and `ApiDoc` records. If the database is unavailable, the endpoint SHALL return the result with `analysisId: null`.

#### Scenario: Successful persistence of docs generation
- **WHEN** `POST /api/docs` completes successfully and the database is reachable
- **THEN** an `Analysis` record with `mode: 'backend-only'` SHALL be saved, along with associated `Route`, `Feature`, and `ApiDoc` records

#### Scenario: DB failure during docs persistence
- **WHEN** `POST /api/docs` completes the pipeline successfully but the Prisma write throws
- **THEN** the endpoint SHALL catch the error, log it, and return status 200 with `{ analysisId: null, markdown, openapi }` rather than a 500 error

### Requirement: GET /api/analyses list endpoint
The system SHALL expose `GET /api/analyses?limit=<n>` returning an array of analysis summaries ordered by `createdAt` descending. Each item SHALL include: `id`, `mode`, `totalRoutes`, `connectedCount`, `orphanCount`, `ghostCount`, `createdAt`. The default limit SHALL be 20; the maximum SHALL be 100.

#### Scenario: List returns latest analyses first
- **WHEN** `GET /api/analyses` is called with no query params
- **THEN** the response SHALL be status 200 with a JSON array ordered newest-first, up to 20 items

#### Scenario: Limit param respected
- **WHEN** `GET /api/analyses?limit=5` is called
- **THEN** the response SHALL contain at most 5 items

#### Scenario: Empty history
- **WHEN** no analyses have been saved yet
- **THEN** `GET /api/analyses` SHALL return status 200 with an empty array `[]`

### Requirement: GET /api/analyses/:id detail endpoint
The system SHALL expose `GET /api/analyses/:id` returning the full analysis record including its `routes` and `features` arrays. For analyses with an `ApiDoc`, the `apiDoc` field SHALL be included.

#### Scenario: Detail returns full routes and features
- **WHEN** `GET /api/analyses/:id` is called with a valid ID
- **THEN** the response SHALL include `routes` array and `features` array nested in the response body

#### Scenario: Not found
- **WHEN** `GET /api/analyses/:id` is called with an ID that does not exist
- **THEN** the response SHALL return status 404 with `{ error: 'Analysis not found' }`
