## ADDED Requirements

### Requirement: Core type definitions in lib/types.ts
The file `lib/types.ts` SHALL export all shared types used across parsers, analyzers, generators, and API routes. TypeScript strict mode MUST be enforced. No `any` types are permitted; use `unknown` and narrow. All object shapes SHALL use `interface`, not `type`.

#### Scenario: Type import from parsers
- **WHEN** a parser module needs to return detected routes
- **THEN** it SHALL import `BackendRoute` or `FrontendCall` from `lib/types.ts` rather than defining its own shape

### Requirement: HttpMethod type
The module SHALL export `type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'`.

#### Scenario: Method assignment
- **WHEN** code assigns the string `'GET'` to an `HttpMethod` variable
- **THEN** TypeScript SHALL accept it without error

#### Scenario: Invalid method assignment
- **WHEN** code assigns the string `'OPTIONS'` to an `HttpMethod` variable
- **THEN** TypeScript SHALL emit a compile-time error

### Requirement: RouteStatus and AnalysisMode types
The module SHALL export `type RouteStatus = 'connected' | 'orphan' | 'ghost' | 'documented'` and `type AnalysisMode = 'monorepo' | 'separate' | 'backend-only'`.

#### Scenario: Status type exhaustiveness
- **WHEN** a switch statement is written on `RouteStatus`
- **THEN** TypeScript SHALL detect unhandled cases if any status value is missing

### Requirement: BackendRoute interface
The module SHALL export `interface BackendRoute` with fields: `method: HttpMethod`, `path: string`, `handler?: string`, `framework: BackendFramework`, `rawSnippet: string`, `filePath?: string`.

#### Scenario: BackendRoute construction
- **WHEN** a parser constructs a `BackendRoute` object
- **THEN** TypeScript SHALL require `method`, `path`, `framework`, and `rawSnippet` as minimum fields

### Requirement: FrontendCall interface
The module SHALL export `interface FrontendCall` with fields: `method: HttpMethod`, `path: string`, `pattern: FrontendPattern`, `rawSnippet: string`, `isDynamic?: boolean`, `filePath?: string`.

#### Scenario: Dynamic route flag
- **WHEN** a frontend call to `/users/${id}` is detected
- **THEN** `isDynamic` SHALL be set to `true` on the FrontendCall

### Requirement: GapAnalysisResult interface
The module SHALL export `interface GapAnalysisResult` containing: `mode: AnalysisMode`, `routes: AnalyzedRoute[]`, `features: FeatureGroup[]`, `summary: { total, connected, orphan, ghost }`, and optional `apiDoc: { markdown: string; openapi?: object }`.

#### Scenario: Result structure
- **WHEN** the gap analyzer returns a result
- **THEN** it SHALL conform to `GapAnalysisResult` with all required fields populated

### Requirement: FileTreeEntry interface
The module SHALL export `interface FileTreeEntry` with fields: `path: string`, `type: 'file' | 'dir'`, and optional `content?: string`. This type is used as the structured input format for `detectMonorepoLayout()`.

#### Scenario: FileTreeEntry construction
- **WHEN** a caller constructs a structured tree for monorepo detection
- **THEN** TypeScript SHALL require `path` and `type` as minimum fields and accept optional `content`

#### Scenario: Import from shared module
- **WHEN** `lib/repo/monorepo-detector.ts` needs the structured tree type
- **THEN** it SHALL import `FileTreeEntry` from `lib/types.ts` rather than defining its own shape

### Requirement: FeatureGroup interface
The module SHALL export `interface FeatureGroup` with fields: `id: string`, `name: string`, `description?: string`, and `routeIds: string[]`. This interface is the contract between the feature classifier and all consumers (UI, persistence layer, API responses).

#### Scenario: FeatureGroup construction
- **WHEN** `classifyFeatures` constructs a feature group
- **THEN** TypeScript SHALL require `id`, `name`, and `routeIds` as minimum fields and accept optional `description`

#### Scenario: Import from shared module
- **WHEN** `lib/analyzer/feature-classifier.ts` needs the feature group shape
- **THEN** it SHALL import `FeatureGroup` from `lib/types.ts` rather than defining its own shape

### Requirement: AnalyzedRoute includes optional featureId
The `AnalyzedRoute` interface SHALL include the field `featureId?: string`. After feature classification, each route's `featureId` SHALL reference the `id` of its assigned `FeatureGroup`.

#### Scenario: AnalyzedRoute featureId is undefined before classification
- **WHEN** `analyzeGap` returns an `AnalyzedRoute`
- **THEN** `featureId` MAY be `undefined` — its absence is valid before classification runs

#### Scenario: AnalyzedRoute featureId is set after classification
- **WHEN** `classifyFeatures` returns `routesWithFeatureId`
- **THEN** every route in that array has `featureId` set to the UUID of its assigned feature
