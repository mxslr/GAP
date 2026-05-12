## ADDED Requirements

### Requirement: Centralized Gemini SDK instance
The file `lib/gemini.ts` SHALL be the single place where the Gemini SDK is instantiated. Feature modules MUST NOT instantiate `GoogleGenerativeAI` directly. The module SHALL export a `getModel(modelName?: string)` helper that defaults to `gemini-2.0-flash`.

#### Scenario: Default model usage
- **WHEN** `getModel()` is called with no arguments
- **THEN** it SHALL return a Gemini model instance for `gemini-2.0-flash`

#### Scenario: Custom model usage
- **WHEN** `getModel('gemini-1.5-pro')` is called
- **THEN** it SHALL return a model instance for `gemini-1.5-pro`

### Requirement: JSON-mode generation helper
The module SHALL export a `generateJSON<T>(prompt: string, schema: object): Promise<T>` function that calls Gemini with `responseMimeType: 'application/json'` and the provided `responseSchema`. The parsed JSON result SHALL be returned as type `T`.

#### Scenario: Successful JSON generation
- **WHEN** `generateJSON` is called with a valid prompt and schema
- **THEN** it SHALL return a parsed JavaScript object matching the schema

#### Scenario: Invalid JSON response
- **WHEN** Gemini returns malformed JSON
- **THEN** `generateJSON` SHALL throw an error with a descriptive message

### Requirement: Exponential backoff retry on rate limit
All Gemini API calls within `lib/gemini.ts` SHALL retry on HTTP 429 (rate limit) errors with exponential backoff: first retry after 1 second, second retry after 2 seconds. After 2 retries, the error SHALL propagate. Non-rate-limit errors SHALL NOT be retried.

#### Scenario: Rate limit first retry
- **WHEN** a Gemini call receives a 429 error
- **THEN** it SHALL wait 1 second and retry the same call

#### Scenario: Rate limit second retry
- **WHEN** the first retry also receives a 429 error
- **THEN** it SHALL wait 2 seconds and retry once more

#### Scenario: Rate limit exhausted
- **WHEN** both retries receive 429 errors
- **THEN** the function SHALL throw the rate limit error without further retries

#### Scenario: Non-rate-limit error
- **WHEN** a Gemini call receives a non-429 error (e.g., invalid API key)
- **THEN** it SHALL throw the error immediately without retrying
