## MODIFIED Requirements

### Requirement: Docs generator page renders hero and input section
The system SHALL render a `/docs-generator` page with a small hero section (title + subtitle) and an input section controlled by `InputMethodTabs`. The three input methods (GitHub URL, Drop Folder, Paste Code) SHALL all be available. In paste mode, the existing single textarea labeled `"backend code"` with helper text `"supports express, fastapi, laravel"` SHALL be shown. In GitHub mode, a single `GitHubInput` labeled `"backend repository"` SHALL be shown. In folder mode, a single `FolderDropZone` labeled `"backend folder"` SHALL be shown. A `"generate documentation"` submit button SHALL be present for all methods.

#### Scenario: Page renders with InputMethodTabs
- **WHEN** user navigates to `/docs-generator`
- **THEN** the `InputMethodTabs` SHALL be visible with three method options above the input area

#### Scenario: Paste mode shows existing textarea
- **WHEN** input method is "paste code"
- **THEN** the textarea labeled "backend code" SHALL be visible, unchanged from prior behavior

#### Scenario: GitHub mode shows GitHubInput
- **WHEN** input method is "github url"
- **THEN** a `GitHubInput` component SHALL be shown with label `"backend repository"`

#### Scenario: Folder mode shows FolderDropZone
- **WHEN** input method is "drop folder"
- **THEN** a `FolderDropZone` component SHALL be shown with label `"backend folder"`

#### Scenario: Empty input disables or prevents submission
- **WHEN** any input method has no content and user clicks "generate documentation"
- **THEN** the page does not call the API and shows a validation hint

### Requirement: Loading state shows step messages while awaiting generation
The system SHALL display a square spinner and cycling step messages while the API request is in flight. For GitHub method, an initial step `"fetching repository..."` SHALL appear first. For folder method, an initial step `"reading folder..."` SHALL appear first. Subsequent steps remain: `"parsing routes..."`, `"classifying features..."`, `"enriching with examples..."`, `"building documentation..."`.

#### Scenario: GitHub loading step shown for github method
- **WHEN** user submits with GitHub input method
- **THEN** first loading message SHALL be `"fetching repository..."`

#### Scenario: Loading state appears after form submission
- **WHEN** user submits valid input (any method)
- **THEN** input section is replaced by spinner and first step message

#### Scenario: Step messages cycle during loading
- **WHEN** loading has been active for 5 seconds
- **THEN** the visible step message advances to the next in sequence

### Requirement: Result renders in two-column layout via ApiDocPanel
The system SHALL display the generation result using the `ApiDocPanel` component with sticky left TOC sidebar and scrollable right Markdown panel.

#### Scenario: Result panel appears after successful generation
- **WHEN** the API returns `{ markdown, openapi }` successfully
- **THEN** loading state is removed and ApiDocPanel is rendered with the returned Markdown

#### Scenario: Error state shown on API failure
- **WHEN** the API returns a non-2xx response
- **THEN** loading state is removed and an error message is shown; input section is restored

### Requirement: Result persists to localStorage and is restored on reload
The system SHALL write the last successful result to `localStorage` under key `gap:docs-generator:last-result` and restore it on page mount with a cache banner.

#### Scenario: Result survives page reload
- **WHEN** user generated docs and then performs a hard reload of `/docs-generator`
- **THEN** the ApiDocPanel is pre-populated with the previous result and a cache banner is visible

#### Scenario: User can dismiss cached result
- **WHEN** cached result is displayed with the cache banner
- **THEN** user can click dismiss to clear the panel and localStorage key

### Requirement: Export bar provides copy and download actions
The system SHALL render an export bar with "copy markdown", "download .md", and "download openapi.json" actions.

#### Scenario: Copy markdown writes to clipboard
- **WHEN** user clicks "copy markdown"
- **THEN** the full Markdown string is written to clipboard

#### Scenario: Download .md triggers file download
- **WHEN** user clicks "download .md"
- **THEN** browser downloads `api-docs.md`

#### Scenario: Download openapi.json button disabled when absent
- **WHEN** openapi field is null
- **THEN** "download openapi.json" button is visually disabled and non-interactive
