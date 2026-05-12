## ADDED Requirements

### Requirement: Docs generator page renders hero and input section
The system SHALL render a `/docs-generator` page with a small hero section (title + subtitle) and a single large textarea labelled "backend code" with helper text "supports express, fastapi, laravel" and a "generate documentation" submit button.

#### Scenario: Page renders with input section visible
- **WHEN** user navigates to `/docs-generator`
- **THEN** the page shows the hero title "API Documentation Generator", the subtitle "paste your backend code. get full documentation. zero annotation.", a textarea, and a generate button

#### Scenario: Empty textarea disables or prevents submission
- **WHEN** the textarea is empty and user clicks "generate documentation"
- **THEN** the page does not call the API and shows a validation hint

### Requirement: Loading state shows step messages while awaiting generation
The system SHALL display a square spinner and cycling step messages ("parsing routes...", "classifying features...", "enriching with examples...", "building documentation...") while the API request is in flight. Step messages SHALL advance on a time-based interval (approximately every 5 seconds).

#### Scenario: Loading state appears after form submission
- **WHEN** user submits valid backend code
- **THEN** the input section is replaced or overlaid by the spinner and first step message "parsing routes..."

#### Scenario: Step messages cycle during loading
- **WHEN** loading has been active for 5 seconds
- **THEN** the visible step message advances to the next message in the sequence

### Requirement: Result renders in two-column layout via ApiDocPanel
The system SHALL display the generation result using the `ApiDocPanel` component, which provides a sticky left TOC sidebar (30% width) and a scrollable right Markdown panel (70% width).

#### Scenario: Result panel appears after successful generation
- **WHEN** the API returns `{ markdown, openapi }` successfully
- **THEN** the loading state is removed and the ApiDocPanel is rendered with the returned Markdown

#### Scenario: Error state shown on API failure
- **WHEN** the API returns a non-2xx response
- **THEN** loading state is removed and an error message is shown; the input section is restored

### Requirement: Result persists to localStorage and is restored on reload
The system SHALL write the last successful result (`{ markdown, openapi, timestamp }`) to `localStorage` under key `gap:docs-generator:last-result` immediately after a successful API call. On page mount, the system SHALL read this key and, if present, pre-populate the ApiDocPanel with the cached result and show a banner indicating it was loaded from cache.

#### Scenario: Result survives page reload
- **WHEN** user generated docs and then performs a hard reload of `/docs-generator`
- **THEN** the ApiDocPanel is pre-populated with the previous result and a cache banner is visible

#### Scenario: User can dismiss cached result
- **WHEN** cached result is displayed with the cache banner
- **THEN** user can click a dismiss/clear action that removes the panel and shows the input form again; the localStorage key is cleared

### Requirement: Export bar provides copy and download actions
The system SHALL render an export bar (sticky top-right or bottom) with three actions: "copy markdown", "download .md", and "download openapi.json". The "download openapi.json" button SHALL be disabled when `openapi` is null or undefined.

#### Scenario: Copy markdown writes to clipboard
- **WHEN** user clicks "copy markdown"
- **THEN** the full Markdown string is written to the system clipboard and a brief confirmation feedback is shown

#### Scenario: Download .md triggers file download
- **WHEN** user clicks "download .md"
- **THEN** browser downloads a file named `api-docs.md` containing the Markdown string

#### Scenario: Download openapi.json triggers file download
- **WHEN** user clicks "download openapi.json" and openapi data is available
- **THEN** browser downloads a file named `openapi.json` containing the serialized OpenAPI object

#### Scenario: Download openapi.json button is disabled when openapi is absent
- **WHEN** the API response has no openapi field or it is null
- **THEN** the "download openapi.json" button is visually disabled and non-interactive
