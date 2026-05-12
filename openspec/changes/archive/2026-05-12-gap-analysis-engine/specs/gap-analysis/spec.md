## ADDED Requirements

### Requirement: analyzeGap classifies routes by BE-FE match status
The system SHALL compare `BackendRoute[]` and `FrontendCall[]` and assign each route a status of `connected`, `orphan`, or `ghost`. Routes present in both BE and FE with matching method and normalized path SHALL be `connected`. Backend routes with no matching frontend call SHALL be `orphan`. Frontend calls with no matching backend route SHALL be `ghost`. All routes SHALL be returned in a single `AnalyzedRoute[]` array.

#### Scenario: Exact path match marks route as connected
- **WHEN** a `BackendRoute` with method `GET` and path `/api/users` exists and a `FrontendCall` with method `GET` and path `/api/users` exists
- **THEN** the result contains one `AnalyzedRoute` with `status: 'connected'` and `detectedIn: 'both'`

#### Scenario: Backend route with no frontend call is orphan
- **WHEN** a `BackendRoute` with method `DELETE` and path `/api/users/:id` exists and no `FrontendCall` matches that method and path
- **THEN** the result contains one `AnalyzedRoute` with `status: 'orphan'` and `detectedIn: 'backend'`

#### Scenario: Frontend call with no backend route is ghost
- **WHEN** a `FrontendCall` with method `POST` and path `/api/payments` exists and no `BackendRoute` matches that method and path
- **THEN** the result contains one `AnalyzedRoute` with `status: 'ghost'` and `detectedIn: 'frontend'`

#### Scenario: Empty backend returns all ghost routes
- **WHEN** `backendRoutes` is empty and `frontendCalls` contains one or more entries
- **THEN** all frontend calls appear in the result as `ghost` routes

#### Scenario: Empty frontend returns all orphan routes
- **WHEN** `frontendCalls` is empty and `backendRoutes` contains one or more entries
- **THEN** all backend routes appear in the result as `orphan` routes

### Requirement: Path matching is normalized before comparison
The system SHALL normalize paths before matching by: lowercasing, stripping trailing slashes (unless the path is `/`), and replacing dynamic segments (`:word`, `{word}`, `${...}`) with a wildcard token so that structurally equivalent paths match regardless of syntax.

#### Scenario: Trailing slash is ignored in matching
- **WHEN** a `BackendRoute` path is `/api/users/` and a `FrontendCall` path is `/api/users`
- **THEN** they are considered a match

#### Scenario: Path matching is case insensitive
- **WHEN** a `BackendRoute` path is `/API/Users` and a `FrontendCall` path is `/api/users`
- **THEN** they are considered a match

#### Scenario: Express-style dynamic param matches numeric FE path segment
- **WHEN** a `BackendRoute` path is `/users/:id` and a `FrontendCall` path is `/users/42`
- **THEN** they are considered a match and the route is `connected`

#### Scenario: Express-style dynamic param matches template literal FE path segment
- **WHEN** a `BackendRoute` path is `/users/:id` and a `FrontendCall` path is `/users/${userId}`
- **THEN** they are considered a match and the route is `connected`

#### Scenario: FastAPI-style dynamic param matches FE call
- **WHEN** a `BackendRoute` path is `/items/{item_id}` and a `FrontendCall` path is `/items/99`
- **THEN** they are considered a match and the route is `connected`

#### Scenario: Method must match for a route to be connected
- **WHEN** a `BackendRoute` has method `GET` and path `/api/users` and a `FrontendCall` has method `POST` and path `/api/users`
- **THEN** the backend route is `orphan` and the frontend call is `ghost` (not connected)

### Requirement: analyzeGap returns a summary with correct counts
The `GapAnalysisResult.summary` SHALL contain `total`, `connected`, `orphan`, and `ghost` counts that match the number of routes of each status in the `routes` array.

#### Scenario: Mixed scenario summary is accurate
- **WHEN** analysis results in 2 connected, 1 orphan, and 1 ghost route
- **THEN** `summary.total` is 4, `summary.connected` is 2, `summary.orphan` is 1, `summary.ghost` is 1

### Requirement: analyzeGap returns empty features array
The `GapAnalysisResult.features` field SHALL always be an empty array. Feature classification is handled by a separate module.

#### Scenario: Features array is always empty
- **WHEN** `analyzeGap` is called with any valid inputs
- **THEN** `result.features` is `[]`

### Requirement: buildDocumentedRoutes maps backend routes to documented status
The system SHALL provide a `buildDocumentedRoutes(backendRoutes: BackendRoute[]): AnalyzedRoute[]` function that maps every backend route to an `AnalyzedRoute` with `status: 'documented'` and `detectedIn: 'backend'`. No comparison or matching is performed.

#### Scenario: All routes get documented status
- **WHEN** `buildDocumentedRoutes` is called with an array of backend routes
- **THEN** every returned `AnalyzedRoute` has `status: 'documented'` and `detectedIn: 'backend'`

#### Scenario: Empty input returns empty array
- **WHEN** `buildDocumentedRoutes` is called with an empty array
- **THEN** an empty array is returned
