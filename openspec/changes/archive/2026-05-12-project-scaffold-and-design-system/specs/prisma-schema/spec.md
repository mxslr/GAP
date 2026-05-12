## ADDED Requirements

### Requirement: Analysis model
The `Analysis` model SHALL be the root record for every analysis run. It MUST include fields: `id` (UUID, primary key), `mode` (string: `monorepo` | `separate` | `backend-only`), `backendSource` (optional string), `frontendSource` (optional string), `repoSource` (optional string, for monorepo mode), `totalRoutes` (int), `connectedCount` (int, default 0), `orphanCount` (int, default 0), `ghostCount` (int, default 0), `createdAt` (datetime, default now). It SHALL have relations to `Route[]`, `Feature[]`, and optional `ApiDoc`.

#### Scenario: Analysis creation
- **WHEN** an analysis is created with mode `separate`
- **THEN** the record SHALL store backendSource, frontendSource, and default counts of 0

### Requirement: Route model
The `Route` model SHALL store individual API routes found during analysis. It MUST include: `id` (UUID), `analysisId` (foreign key to Analysis, cascade delete), `method` (string: GET/POST/PUT/DELETE/PATCH), `path` (string), `status` (string: `connected` | `orphan` | `ghost` | `documented`), `description` (optional), `fetchSnippet` (optional), `tsTypes` (optional), `featureId` (optional foreign key to Feature), `createdAt`. It SHALL have indexes on `analysisId`, `status`, and `featureId`.

#### Scenario: Route with feature assignment
- **WHEN** a route is assigned to a Feature
- **THEN** `featureId` SHALL reference the Feature record and the relation SHALL be navigable from both sides

#### Scenario: Route cascade delete
- **WHEN** the parent Analysis is deleted
- **THEN** all associated Routes SHALL be deleted automatically

### Requirement: Feature model
The `Feature` model SHALL group routes by semantic category. It MUST include: `id` (UUID), `analysisId` (foreign key, cascade delete), `name` (string, e.g., "Authentication"), `description` (optional), `routes` (relation to Route[]), `createdAt`. It SHALL have an index on `analysisId`.

#### Scenario: Feature with routes
- **WHEN** routes are assigned to a Feature
- **THEN** `feature.routes` SHALL return all assigned routes

### Requirement: ApiDoc model
The `ApiDoc` model SHALL store the generated API documentation for Mode 3 (backend-only) analyses. It MUST include: `id` (UUID), `analysisId` (unique foreign key, cascade delete), `markdownDoc` (text), `openapiJson` (optional text), `createdAt`. The relation to Analysis SHALL be one-to-one.

#### Scenario: ApiDoc one-to-one constraint
- **WHEN** an Analysis already has an ApiDoc
- **THEN** attempting to create a second ApiDoc for the same analysisId SHALL fail with a unique constraint error

### Requirement: SnippetCache model
The `SnippetCache` model SHALL cache Gemini-generated code snippets keyed by `"{method}:{path}"`. It MUST include: `key` (string, primary key), `fetchSnippet` (text), `tsTypes` (text), `description` (optional), `createdAt`. The `key` field acts as the cache key so the same route never triggers a second Gemini call.

#### Scenario: Cache hit
- **WHEN** a snippet is requested for a method+path combination that already exists in SnippetCache
- **THEN** the cached values SHALL be returned without calling Gemini
