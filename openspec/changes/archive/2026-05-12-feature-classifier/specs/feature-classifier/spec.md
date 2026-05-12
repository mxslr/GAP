## ADDED Requirements

### Requirement: classifyFeatures groups routes into semantic FeatureGroups via Gemini
The module `lib/analyzer/feature-classifier.ts` SHALL export a function `classifyFeatures(routes: AnalyzedRoute[]): Promise<{ features: FeatureGroup[], routesWithFeatureId: AnalyzedRoute[] }>`. When called with 3 or more routes, it SHALL call Gemini via `lib/gemini.ts` `generateJSON` with a prompt listing each route's index, method, and path. Gemini SHALL be instructed to cluster routes into named semantic features (Title Case) with a one-sentence description and assign every route to exactly one feature using `routeIndices`. The function SHALL generate a UUID for each returned feature, assign the correct `featureId` to every route in `routesWithFeatureId`, and return both arrays.

#### Scenario: 10 routes covering auth, users, and posts produce 3 features
- **WHEN** `classifyFeatures` is called with 10 `AnalyzedRoute` objects whose paths are `/api/auth/*`, `/api/users/*`, and `/api/posts/*`
- **THEN** the returned `features` array contains exactly 3 `FeatureGroup` objects with names like "Authentication", "User Management", and "Posts"
- **THEN** every route in `routesWithFeatureId` has a `featureId` matching one of the returned features

#### Scenario: Every route is assigned to exactly one feature
- **WHEN** `classifyFeatures` returns
- **THEN** each route in `routesWithFeatureId` has a non-null `featureId`
- **THEN** the union of all `feature.routeIds` arrays equals the set of all route IDs with no duplicates

#### Scenario: Each feature has a UUID id
- **WHEN** `classifyFeatures` returns successfully
- **THEN** every `FeatureGroup` in `features` has an `id` field that is a valid UUID v4 string

#### Scenario: System and health routes are grouped under "System" or "Health"
- **WHEN** the input includes routes with paths `/health`, `/version`, or `/api/status`
- **THEN** those routes are grouped into a feature named "System" or "Health" in the result

### Requirement: Edge case — 0 to 2 routes returns a single "API" feature without calling Gemini
When `classifyFeatures` receives 0, 1, or 2 routes, it SHALL skip the Gemini call entirely and return a single `FeatureGroup` named "API" with description "General API endpoints" containing all input routes.

#### Scenario: 2 routes produce exactly 1 feature
- **WHEN** `classifyFeatures` is called with exactly 2 `AnalyzedRoute` objects
- **THEN** `features` contains exactly 1 `FeatureGroup` with `name: 'API'`
- **THEN** both routes appear in `routesWithFeatureId` with `featureId` set to that group's id
- **THEN** no Gemini API call is made

#### Scenario: Empty input returns one empty-routes "API" feature
- **WHEN** `classifyFeatures` is called with an empty array
- **THEN** `features` contains exactly 1 `FeatureGroup` named "API" with empty `routeIds`
- **THEN** `routesWithFeatureId` is an empty array

### Requirement: Heuristic fallback when Gemini call fails
If the Gemini call throws any error, `classifyFeatures` SHALL catch it and fall back to grouping routes by their first meaningful path segment (the first non-empty segment after any `/api` prefix, or the first segment otherwise). Each distinct segment SHALL become a `FeatureGroup` with a Title-Case name derived from the segment. Routes with no usable segment SHALL be placed in a "General" feature. No error SHALL be thrown — the function SHALL always resolve.

#### Scenario: Gemini failure falls back to path-segment grouping
- **WHEN** `generateJSON` throws an error
- **THEN** `classifyFeatures` does not throw
- **THEN** routes with path `/api/auth/login` and `/api/auth/register` are in the same feature
- **THEN** routes with path `/api/users` are in a separate feature from auth routes

#### Scenario: Fallback groups /api/auth/* as "Auth" feature
- **WHEN** the heuristic fallback is active and a route path is `/api/auth/login`
- **THEN** it is assigned to a feature whose name is "Auth"

#### Scenario: Fallback assigns unrecognised paths to "General"
- **WHEN** the heuristic fallback is active and a route has path `/`
- **THEN** it is assigned to a feature named "General"

### Requirement: Out-of-bounds or duplicate Gemini routeIndices are handled safely
If Gemini returns a `routeIndex` that is outside the range `[0, routes.length - 1]`, the index SHALL be silently ignored. If a route index appears in more than one feature's `routeIndices`, the first assignment SHALL win and subsequent occurrences SHALL be ignored. Any routes not assigned by Gemini SHALL be collected into a fallback "General" feature appended to the result.

#### Scenario: Out-of-bounds index is ignored
- **WHEN** Gemini returns a `routeIndex` of 99 for an input array of length 5
- **THEN** no route is assigned for that index and no error is thrown

#### Scenario: Duplicate index uses first assignment
- **WHEN** Gemini places route index 2 in both "Authentication" and "User Management"
- **THEN** route 2 is assigned to "Authentication" and not to "User Management"

#### Scenario: Unassigned routes go to "General"
- **WHEN** Gemini's response omits route index 3 from all feature `routeIndices`
- **THEN** route 3 is placed in a "General" feature that is appended to the result
