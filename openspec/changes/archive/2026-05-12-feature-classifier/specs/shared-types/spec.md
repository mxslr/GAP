## ADDED Requirements

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
