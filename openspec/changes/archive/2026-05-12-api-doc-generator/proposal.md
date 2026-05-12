## Why

GAP supports a "Backend-Only" mode (Mode 3) where users provide only backend code. Currently there is no output for this mode — users need a way to generate complete, structured API documentation (Markdown + OpenAPI 3.0) from detected routes without any manual annotation.

## What Changes

- New `lib/generators/api-docs.ts` module that takes detected routes and feature groups, enriches each route via Gemini (descriptions, request/response examples, error codes), and returns both Markdown and OpenAPI 3.0 JSON.
- New `app/api/docs/route.ts` API endpoint (`POST /api/docs`) that accepts raw backend code, runs the backend parser, feature classifier, and API doc generator, and returns the full documentation.
- Test suite at `tests/api-doc-generator.test.ts` covering generation logic.
- The existing `snippet-and-type-generator` capability is used as a dependency — if a route is missing description/fetchSnippet/tsTypes, `generateSnippets` is called first.

## Capabilities

### New Capabilities
- `api-doc-generator`: Generates full Markdown + OpenAPI 3.0 documentation for a list of analyzed routes grouped by feature. Enriches each route with Gemini-powered descriptions, example bodies, realistic response JSON, and error codes. Exposes a `POST /api/docs` endpoint for Mode 3 consumption.

### Modified Capabilities

## Impact

- **New files**: `lib/generators/api-docs.ts`, `app/api/docs/route.ts`, `tests/api-doc-generator.test.ts`
- **Dependencies used**: `lib/gemini.ts`, `lib/generators/snippets.ts`, `lib/parsers/backend.ts`, `lib/analyzer/feature-classifier.ts`
- **Types used**: `AnalyzedRoute`, `FeatureGroup` from `lib/types.ts`
- **Database**: Persists `ApiDoc` and `SnippetCache` records via Prisma
- **No new npm dependencies** — uses existing `@google/generative-ai` and Prisma
