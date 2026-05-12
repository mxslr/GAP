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
