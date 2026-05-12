### Requirement: Generate fetch snippet and TypeScript types for a single route
The system SHALL provide a `generateSnippets(route: AnalyzedRoute)` function that returns `{ fetchSnippet: string, tsTypes: string, description: string }` for the given route, using the Gemini API via `lib/gemini.ts`.

#### Scenario: Cache hit — returns without calling Gemini
- **WHEN** `generateSnippets` is called with a route whose `"{method}:{path}"` SHA-1 hash exists in `SnippetCache`
- **THEN** the function returns the cached `fetchSnippet`, `tsTypes`, and `description` without making any Gemini API call

#### Scenario: Cache miss — calls Gemini and populates cache
- **WHEN** `generateSnippets` is called with a route that has no cache entry
- **THEN** the function calls Gemini, stores the result in `SnippetCache`, and returns the generated `fetchSnippet`, `tsTypes`, and `description`

#### Scenario: Gemini error — throws descriptive error
- **WHEN** Gemini returns an error or malformed JSON
- **THEN** the function throws an error with a message identifying the failing route

---

### Requirement: Generate snippets for multiple routes in a single Gemini call
The system SHALL provide a `generateSnippetsBatch(routes: AnalyzedRoute[])` function that returns `Map<string, { fetchSnippet: string, tsTypes: string, description: string }>` keyed by `"{method}:{path}"`, sending only cache-missing routes to Gemini in one batch call.

#### Scenario: All routes cached — no Gemini call made
- **WHEN** all routes passed to `generateSnippetsBatch` have existing cache entries
- **THEN** the function returns results from cache without calling Gemini

#### Scenario: Partial cache miss — only uncached routes sent to Gemini
- **WHEN** some routes have cache entries and some do not
- **THEN** only the uncached routes are included in the Gemini prompt; cached routes are merged into the result map directly

#### Scenario: Batch exceeds 50 routes — automatically chunked
- **WHEN** `generateSnippetsBatch` receives more than 50 uncached routes
- **THEN** the function splits them into chunks of ≤ 50 and calls Gemini sequentially, merging all results

#### Scenario: Full batch — all results returned and cached
- **WHEN** `generateSnippetsBatch` completes with uncached routes
- **THEN** all Gemini results are stored in `SnippetCache` and the full map (cached + newly generated) is returned

---

### Requirement: Fetch snippet format
Each generated `fetchSnippet` SHALL contain both an axios example (primary) and a native fetch example (fallback) in a single TypeScript code block separated by a `// --- native fetch ---` comment. The snippet SHALL use `async/await`, include a `try/catch` block, and demonstrate realistic request bodies for `POST`/`PUT`/`PATCH` routes and realistic URL parameters for routes with path params.

#### Scenario: POST route snippet includes request body
- **WHEN** a snippet is generated for a `POST /api/users` route
- **THEN** the axios example includes a `data` argument with a plausible request body object, and the fetch example includes a `body: JSON.stringify(...)` with the same object

#### Scenario: GET route with path param includes param in URL
- **WHEN** a snippet is generated for a `GET /api/users/:id` route
- **THEN** both the axios and fetch examples reference `userId` (or equivalent) as a variable in the URL string

---

### Requirement: TypeScript types format
Each generated `tsTypes` SHALL use `interface` declarations (not `type` aliases) with PascalCase names. Naming SHALL follow the convention `{Verb}{Resource}Request` for request bodies and `{Verb}{Resource}Response` for responses. Collection responses (routes without an ID path segment on `GET`) SHALL type the response as an array of the resource interface.

#### Scenario: Single-resource GET produces singular response type
- **WHEN** types are generated for `GET /api/users/:id`
- **THEN** `tsTypes` contains an interface named `GetUserResponse` (singular) with resource fields

#### Scenario: Collection GET produces array response type
- **WHEN** types are generated for `GET /api/users`
- **THEN** `tsTypes` contains `GetUsersResponse` typed as an array (e.g., `type GetUsersResponse = User[]` or equivalent interface wrapping an array field)

#### Scenario: POST route produces request and response interfaces
- **WHEN** types are generated for `POST /api/posts`
- **THEN** `tsTypes` contains both `CreatePostRequest` and `CreatePostResponse` interfaces

---

### Requirement: Cache key derivation
The cache key for any route SHALL be the lowercase hex SHA-1 digest of the string `"{METHOD}:{path}"` (e.g., `"GET:/api/users/:id"`), computed using Node's `crypto` module.

#### Scenario: Identical routes produce identical cache keys
- **WHEN** two `AnalyzedRoute` objects have the same `method` and `path`
- **THEN** their computed cache keys are identical, ensuring a single cache entry is shared
