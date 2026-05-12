## ADDED Requirements

### Requirement: Parse axios and axios-instance calls
The system SHALL extract HTTP calls made via `axios.METHOD(url, ...)` and via named axios instances (e.g., `api.get(url)`, `apiClient.post(url, data)`). Supported methods: GET, POST, PUT, DELETE, PATCH.

#### Scenario: axios.get with string URL
- **WHEN** code contains `axios.get('/api/users')`
- **THEN** parser returns a `FrontendCall` with `method: 'GET'`, `path: '/api/users'`, `pattern: 'axios'`

#### Scenario: axios.post with data argument
- **WHEN** code contains `axios.post('/api/users', { name })`
- **THEN** parser returns `method: 'POST'`, `path: '/api/users'`, `pattern: 'axios'`

#### Scenario: axios.put
- **WHEN** code contains `axios.put('/api/users/1', payload)`
- **THEN** parser returns `method: 'PUT'`, `path: '/api/users/1'`, `pattern: 'axios'`

#### Scenario: axios.delete
- **WHEN** code contains `axios.delete('/api/posts/5')`
- **THEN** parser returns `method: 'DELETE'`, `path: '/api/posts/5'`, `pattern: 'axios'`

#### Scenario: axios.patch
- **WHEN** code contains `axios.patch('/api/profile', updates)`
- **THEN** parser returns `method: 'PATCH'`, `path: '/api/profile'`, `pattern: 'axios'`

#### Scenario: Named axios instance
- **WHEN** code contains `api.get('/api/me')`
- **THEN** parser returns `method: 'GET'`, `path: '/api/me'`, `pattern: 'axios'`

#### Scenario: Template literal URL on axios instance
- **WHEN** code contains `` api.get(`/api/users/${userId}`) ``
- **THEN** parser returns `path: '/api/users/:param0'`, `isDynamic: true`

#### Scenario: Multiple axios calls in one file
- **WHEN** code contains 3 different axios calls
- **THEN** parser returns 3 `FrontendCall` objects

---

### Requirement: Parse native fetch calls
The system SHALL extract HTTP calls made via `fetch(url, options?)`. When no `method` option is present, the call SHALL be treated as GET.

#### Scenario: fetch with no options (GET)
- **WHEN** code contains `fetch('/api/users')`
- **THEN** parser returns `method: 'GET'`, `path: '/api/users'`, `pattern: 'fetch'`

#### Scenario: fetch with explicit POST method
- **WHEN** code contains `fetch('/api/users', { method: 'POST', body: JSON.stringify(data) })`
- **THEN** parser returns `method: 'POST'`, `path: '/api/users'`, `pattern: 'fetch'`

#### Scenario: fetch with explicit DELETE method
- **WHEN** code contains `fetch('/api/posts/3', { method: 'DELETE' })`
- **THEN** parser returns `method: 'DELETE'`, `path: '/api/posts/3'`, `pattern: 'fetch'`

#### Scenario: fetch with PUT method
- **WHEN** code contains `fetch('/api/users/1', { method: 'PUT', body: JSON.stringify(payload) })`
- **THEN** parser returns `method: 'PUT'`, `path: '/api/users/1'`, `pattern: 'fetch'`

#### Scenario: fetch with template literal URL
- **WHEN** code contains `` fetch(`/api/items/${itemId}`) ``
- **THEN** parser returns `path: '/api/items/:param0'`, `isDynamic: true`, `pattern: 'fetch'`

#### Scenario: fetch with await and variable assignment
- **WHEN** code contains `const res = await fetch('/api/health')`
- **THEN** parser returns `method: 'GET'`, `path: '/api/health'`, `pattern: 'fetch'`

#### Scenario: fetch with PATCH method in options
- **WHEN** code contains `fetch('/api/settings', { method: 'PATCH', headers: {...} })`
- **THEN** parser returns `method: 'PATCH'`, `path: '/api/settings'`, `pattern: 'fetch'`

---

### Requirement: Parse custom api-client calls
The system SHALL detect HTTP calls made via named wrapper objects whose identifier ends with `Client`, `Api`, `Service`, or is exactly `api`, `http`, `client`, `service`, followed by an HTTP verb method (`.get(`, `.post(`, `.put(`, `.delete(`, `.patch(`).

#### Scenario: apiClient.get
- **WHEN** code contains `apiClient.get('/api/products')`
- **THEN** parser returns `method: 'GET'`, `path: '/api/products'`, `pattern: 'api-client'`

#### Scenario: httpClient.post
- **WHEN** code contains `httpClient.post('/api/orders', orderData)`
- **THEN** parser returns `method: 'POST'`, `path: '/api/orders'`, `pattern: 'api-client'`

#### Scenario: userService.delete
- **WHEN** code contains `userService.delete('/api/users/7')`
- **THEN** parser returns `method: 'DELETE'`, `path: '/api/users/7'`, `pattern: 'api-client'`

#### Scenario: http.put
- **WHEN** code contains `http.put('/api/config', config)`
- **THEN** parser returns `method: 'PUT'`, `path: '/api/config'`, `pattern: 'api-client'`

#### Scenario: client.patch with template literal
- **WHEN** code contains `` client.patch(`/api/users/${id}/role`, { role }) ``
- **THEN** parser returns `path: '/api/users/:param0/role'`, `isDynamic: true`, `pattern: 'api-client'`

#### Scenario: paymentApi.post
- **WHEN** code contains `paymentApi.post('/api/payments/charge', chargeData)`
- **THEN** parser returns `method: 'POST'`, `path: '/api/payments/charge'`, `pattern: 'api-client'`

---

### Requirement: Parse React Query hooks with inline fetchers
The system SHALL detect `useQuery` and `useMutation` hook invocations and extract the URL from any axios or fetch call found within the hook's callback argument (queryFn or mutationFn), looking ahead up to 500 characters.

#### Scenario: useQuery with inline fetch
- **WHEN** code contains `useQuery({ queryKey: ['users'], queryFn: () => fetch('/api/users').then(r => r.json()) })`
- **THEN** parser returns `method: 'GET'`, `path: '/api/users'`, `pattern: 'react-query'`

#### Scenario: useQuery with inline axios.get
- **WHEN** code contains `useQuery(['posts'], () => axios.get('/api/posts'))`
- **THEN** parser returns `method: 'GET'`, `path: '/api/posts'`, `pattern: 'react-query'`

#### Scenario: useMutation with axios.post
- **WHEN** code contains `useMutation((data) => axios.post('/api/comments', data))`
- **THEN** parser returns `method: 'POST'`, `path: '/api/comments'`, `pattern: 'react-query'`

#### Scenario: useQuery with template literal URL
- **WHEN** code contains `` useQuery([`user-${id}`], () => fetch(`/api/users/${id}`)) ``
- **THEN** parser returns `path: '/api/users/:param0'`, `isDynamic: true`, `pattern: 'react-query'`

#### Scenario: useMutation with DELETE fetch
- **WHEN** code contains `useMutation((id) => fetch('/api/posts/' + id, { method: 'DELETE' }))`
- **THEN** parser returns `method: 'DELETE'`, `pattern: 'react-query'`

#### Scenario: Multiple useQuery hooks in one component
- **WHEN** code contains 2 useQuery calls each with a distinct URL
- **THEN** parser returns 2 separate `FrontendCall` objects both with `pattern: 'react-query'`

---

### Requirement: Normalize template literal URLs to colon-param notation
The system SHALL replace all `${...}` interpolation expressions in URL strings with `:paramN` where N is the zero-based index of the interpolation within that URL, and SHALL set `isDynamic: true` on the resulting `FrontendCall`.

#### Scenario: Single interpolation
- **WHEN** URL is `` `/api/users/${id}` ``
- **THEN** normalized path is `/api/users/:param0` and `isDynamic` is `true`

#### Scenario: Multiple interpolations
- **WHEN** URL is `` `/api/users/${userId}/posts/${postId}` ``
- **THEN** normalized path is `/api/users/:param0/posts/:param1` and `isDynamic` is `true`

#### Scenario: Static URL remains unchanged
- **WHEN** URL is `'/api/users'` (no interpolation)
- **THEN** `isDynamic` is `false` (or absent) and path is unchanged

---

### Requirement: Deduplicate identical calls
The system SHALL return at most one `FrontendCall` per unique (method, path) combination. If the same call appears multiple times (e.g., in separate components), only one instance SHALL be returned.

#### Scenario: Duplicate axios calls
- **WHEN** code contains `axios.get('/api/users')` twice
- **THEN** parser returns exactly one `FrontendCall` for `GET /api/users`

#### Scenario: Same path different methods are not duplicates
- **WHEN** code contains `axios.get('/api/users')` and `axios.post('/api/users', data)`
- **THEN** parser returns 2 `FrontendCall` objects (one GET, one POST)

---

### Requirement: Attach filePath when provided
The system SHALL set `filePath` on every returned `FrontendCall` when `options.filePath` is provided to `parseFrontendCalls`.

#### Scenario: filePath propagated to all calls
- **WHEN** `parseFrontendCalls(code, { filePath: 'src/api/users.ts' })` is called
- **THEN** every returned `FrontendCall` has `filePath: 'src/api/users.ts'`

#### Scenario: filePath absent when not provided
- **WHEN** `parseFrontendCalls(code)` is called without options
- **THEN** returned calls have `filePath: undefined`

---

### Requirement: Gemini fallback for ambiguous frontend code
The system SHALL invoke Gemini when regex-based parsing yields 0 results but the code contains at least one of the strings: `fetch(`, `axios`, `.get(`, `.post(`, `useQuery`, `useMutation`.

#### Scenario: Function-wrapped fetch triggers fallback
- **WHEN** code defines `const getUsers = () => fetch('/api/users')` but standard patterns yield 0 matches
- **THEN** parser detects fetch signal, calls Gemini, and returns a valid `FrontendCall`

#### Scenario: No fallback when regex finds results
- **WHEN** regex extracts ≥1 call successfully
- **THEN** Gemini is NOT invoked

#### Scenario: No fallback when no fetch signals exist
- **WHEN** code has 0 regex matches AND contains no fetch-related signals
- **THEN** parser returns an empty array without calling Gemini
