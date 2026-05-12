## 1. Core Generator Module

- [x] 1.1 Create `lib/generators/api-docs.ts` with exported `generateApiDocs(routes: AnalyzedRoute[], features: FeatureGroup[]): Promise<{ markdown: string; openapi: object }>` function signature
- [x] 1.2 Implement snippet pre-fill step: for each route missing `fetchSnippet` or `tsTypes`, call `generateSnippets` from `lib/generators/snippets.ts`
- [x] 1.3 Implement Gemini batch enrichment: chunk routes into groups of 20, call Gemini once per batch with `responseMimeType: 'application/json'` requesting description, requestBodyExample (POST/PUT/PATCH only), responseExample, and errorCodes per route
- [x] 1.4 Add exponential backoff retry (max 2 retries) around Gemini enrichment calls; on final failure, use fallback values (`{METHOD} {path} endpoint`, empty examples)
- [x] 1.5 Implement Markdown builder: generate `# API Documentation` header with timestamp, `## Table of Contents` listing feature names, then per-feature sections with route subsections (description, Request block for POST/PUT/PATCH, Response block, Example fetch snippet, `---` separator)
- [x] 1.6 Implement OpenAPI 3.0 builder: construct `info`, `paths` (keyed by path, with method sub-object containing summary/description/requestBody/responses), and `components.schemas` from tsTypes strings using regex-based extractor with `{ type: 'object' }` fallback

## 2. API Endpoint

- [x] 2.1 Create `app/api/docs/route.ts` with `POST` handler accepting `{ backendCode: string }`
- [x] 2.2 Add input validation: return 400 `{ error: 'backendCode is required' }` if field is missing or empty
- [x] 2.3 Wire pipeline: call `parseBackendRoutes(backendCode)`, map to `AnalyzedRoute[]` with status `'documented'`, call `classifyFeatures(routes)`, then `generateApiDocs(routes, features)`
- [x] 2.4 Persist to database: create `Analysis` record (`mode: 'backend-only'`), associated `Route` records, `Feature` records, and `ApiDoc` record with `markdownDoc` and `openapiJson`
- [x] 2.5 Return `{ analysisId, markdown, openapi }` with status 200; wrap entire handler in try/catch returning 500 `{ error: string }` on failure

## 3. Tests

- [x] 3.1 Create `tests/api-doc-generator.test.ts` with mock `AnalyzedRoute[]` and `FeatureGroup[]` fixtures (at least 2 features, 5 routes including POST/GET/DELETE)
- [x] 3.2 Test Markdown output: assert presence of `# API Documentation`, TOC entries, feature headings (`## Authentication`), and route subsections (`` ### `POST /api/auth/login` ``)
- [x] 3.3 Test OpenAPI output: assert `openapi === '3.0.0'`, correct `paths` keys, presence of `requestBody` for POST routes, `responses` object, and `components.schemas`
- [x] 3.4 Test enrichment fallback: mock Gemini to throw, assert `generateApiDocs` resolves (does not throw) and returns valid Markdown with fallback descriptions
- [x] 3.5 Test empty routes: call `generateApiDocs` with empty arrays, assert Markdown contains a "no routes found" message and `openapi.paths` is an empty object
