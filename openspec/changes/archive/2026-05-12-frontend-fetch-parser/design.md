## Context

GAP performs gap analysis by comparing backend routes against frontend API calls. The backend parser (`lib/parsers/backend.ts`) is already spec'd and implemented. This change adds the symmetric frontend parser.

Frontend codebases use several different HTTP-call patterns. A single file may mix patterns (e.g., some axios calls and some native fetch). The parser must handle all four recognized patterns and degrade gracefully when code uses non-standard wrappers.

Existing infrastructure available:
- `lib/gemini.ts` — `generateJSON<T>()` with retry and JSON-mode support
- `lib/types.ts` — `FrontendCall`, `HttpMethod`, `FrontendPattern` already defined

## Goals / Non-Goals

**Goals:**
- Extract all HTTP calls from a string of frontend source code
- Support axios (direct + instance), native fetch, custom api clients, React Query inline fetchers
- Normalize template literal URLs to colon-param notation and flag as `isDynamic`
- Infer HTTP method from call-site syntax (not just explicit config objects)
- Fall back to Gemini when regex yields no results but fetch-like signals exist
- Deduplicate identical (method, path) pairs
- Attach `filePath` to every result when provided

**Non-Goals:**
- Parsing TypeScript type imports or non-HTTP logic
- Following variable references across files (single-file analysis only)
- Detecting dynamically constructed URLs beyond template literals (e.g., string concatenation)
- Analyzing the shape of request/response bodies (that belongs to the snippet generator)

## Decisions

### Decision 1: Regex-first, Gemini-fallback architecture
**Chosen**: Same two-phase strategy as `backend.ts` — regex for known patterns, Gemini only when regex yields 0 results and heuristic signals suggest HTTP calls exist.

**Alternatives considered**:
- Gemini-only: too slow and costly; regex handles 95%+ of real-world cases.
- AST-based (e.g., Babel parser): more accurate for edge cases but adds a heavy dependency and violates the "no extra deps" rule from CLAUDE.md.

**Rationale**: Regex is fast, zero-cost, and sufficient for the target patterns. Gemini fallback covers the long tail without adding dependencies.

### Decision 2: Pattern detection order
**Chosen**: Run all four regex sets independently and merge results, rather than trying to detect which pattern the file uses first.

**Rationale**: A file can mix patterns (axios import alongside a raw fetch call). Independent passes then dedup avoids missing calls.

### Decision 3: Template literal normalization
**Chosen**: Replace `` `\${...}` `` interpolations with `:paramN` (where N is sequential index within the path) and set `isDynamic: true`.

**Rationale**: Downstream gap analysis uses path matching; colon-param notation is already the canonical form used by the backend parser. Using `:paramN` rather than `:id` avoids guessing the variable name, which can vary.

### Decision 4: Custom api-client detection heuristic
**Chosen**: Match any identifier that ends in `Client`, `Api`, `Service`, `client`, `api`, `service`, or is exactly `api`/`http`, followed by `.get(`, `.post(`, etc.

**Rationale**: Teams name API wrappers inconsistently. A broad pattern catches the common cases; false positives are rare in practice since these are followed by method names that match HTTP verbs.

### Decision 5: React Query detection scope
**Chosen**: Match `useQuery` and `useMutation` hooks and extract the URL from the inline fetcher callback (first string/template-literal argument to fetch/axios within the callback body, up to 300 chars look-ahead).

**Rationale**: React Query hooks don't themselves make HTTP calls — they wrap a fetcher function. Extracting the inner fetch/axios call is sufficient; the pattern label on the `FrontendCall` is set to `react-query` to indicate origin.

## Risks / Trade-offs

- **Regex brittleness on minified code** → Mitigation: Gemini fallback triggers if regex yields 0 on code with fetch signals; minified code is unlikely in a paste-based tool.
- **False positives from api-client heuristic** → Mitigation: Only match when followed by an HTTP verb method name (`.get(`, `.post(`, etc.) with a string or template literal as first argument.
- **Template literal with complex expressions** (e.g., `` `/api/${obj.user.id}/posts` ``) → Mitigation: Replace any `\${...}` block (non-greedy, stops at `}`) with `:paramN` regardless of complexity; set `isDynamic: true`.
- **Gemini fallback cost** → Mitigation: Only invoked when regex finds 0 results AND code contains at least one of the strings: `fetch(`, `axios`, `.get(`, `.post(`, `useQuery`, `useMutation`.

## Migration Plan

No migration needed — this is a new module with no existing consumers. The `app/api/analyze/route.ts` endpoint (not yet built) will import `parseFrontendCalls` once both are implemented.

## Open Questions

- None — requirements are fully specified by the user.
