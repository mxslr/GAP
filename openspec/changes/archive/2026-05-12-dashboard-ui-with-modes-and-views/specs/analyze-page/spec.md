## ADDED Requirements

### Requirement: Mode Selector
The `/analyze` page SHALL render a `ModeSelector` component at the top with two tabs: **Monorepo** and **Separate Repos**. The selected tab SHALL be highlighted (white background, black text active state). Switching tabs SHALL update the input section below without a page navigation.

#### Scenario: Default mode on page load
- **WHEN** the user navigates to `/analyze`
- **THEN** the "Monorepo" tab SHALL be selected by default

#### Scenario: Switch to Separate mode
- **WHEN** the user clicks the "Separate Repos" tab
- **THEN** the input section SHALL change to two side-by-side textareas and the Monorepo single textarea SHALL be hidden

### Requirement: Monorepo input form
In Monorepo mode, the input section SHALL show a single large textarea with placeholder text and a helper text `"ai will detect which folders are backend and frontend"`. The textarea label SHALL read `"paste your full project (file tree or pasted folders)"`.

#### Scenario: Monorepo textarea is visible
- **WHEN** "Monorepo" tab is active
- **THEN** one textarea SHALL be visible and the two-column separate layout SHALL be hidden

#### Scenario: Empty submit blocked
- **WHEN** the user clicks "analyze api gaps" with an empty textarea
- **THEN** the form SHALL not submit and the button SHALL remain in its default state

### Requirement: Separate Repos input form
In Separate mode, the input section SHALL show two textareas side-by-side labeled `"backend code"` and `"frontend code"` respectively.

#### Scenario: Separate textareas are visible
- **WHEN** "Separate Repos" tab is active
- **THEN** two textareas in a 2-column grid SHALL be visible

#### Scenario: Separate mode requires both inputs
- **WHEN** the user clicks "analyze api gaps" with only one textarea filled
- **THEN** the form SHALL not submit

### Requirement: Loading state with step messages
After the analyze button is clicked, the page SHALL show a loading section with a rotating square Spinner and sequential step messages. Steps SHALL advance automatically on a timer:
1. `"detecting layout..."` (Monorepo only, ~2s)
2. `"parsing backend routes..."` (~3s)
3. `"parsing frontend calls..."` (~3s)
4. `"matching gaps..."` (~2s)
5. `"classifying features..."` (~3s)
6. `"generating snippets..."` (until response)

#### Scenario: Loading state appears on submit
- **WHEN** the user submits the form
- **THEN** the input section SHALL be hidden, the Spinner and current step message SHALL be visible, and the analyze button SHALL be replaced by the loading section

#### Scenario: Step messages advance
- **WHEN** the loading state is active
- **THEN** the step message text SHALL change sequentially, each fading in with the step change

### Requirement: Results section — mode badge
After analysis completes, a mode badge SHALL appear above the results. It SHALL read `"MONOREPO MODE"` or `"SEPARATE MODE"` in uppercase mono font with a thin white border.

#### Scenario: Mode badge matches selection
- **WHEN** analysis results are displayed after a Monorepo submission
- **THEN** the badge SHALL read `"MONOREPO MODE"`

### Requirement: Results section — metric cards
Three `MetricCard` components SHALL display: **Connected**, **Orphan**, and **Ghost** with their respective counts in large display font. Cards use `status.connected`, `status.orphan`, and `status.ghost` colors for the left border accent only.

#### Scenario: Metric cards show correct counts
- **WHEN** analysis results are displayed
- **THEN** each card SHALL show the count from `result.summary.connected`, `result.summary.orphan`, and `result.summary.ghost`

### Requirement: View toggle (Flat / Feature)
A `ViewToggle` component SHALL appear at the top-right of the results area with two options: **flat view** and **feature view**. The active view SHALL have a white background/black text; inactive SHALL be outlined.

#### Scenario: Default to flat view
- **WHEN** results first appear
- **THEN** flat view SHALL be selected and route cards SHALL be listed

#### Scenario: Switch to feature view
- **WHEN** the user clicks "feature view"
- **THEN** the flat list SHALL be replaced by feature group accordions

### Requirement: Filter bar (flat view only)
A `FilterBar` component SHALL appear below the metric cards when flat view is active. It SHALL support filtering by status (`all`, `connected`, `orphan`, `ghost`) and by HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`). Active filter buttons SHALL have white background and black text; default state SHALL be thin gray border. Filter bar SHALL be hidden in feature view.

#### Scenario: Filter by status
- **WHEN** the user clicks the "orphan" filter
- **THEN** only routes with `status === 'orphan'` SHALL be shown in the flat list

#### Scenario: Filter by method
- **WHEN** the user clicks the "GET" method filter
- **THEN** only GET routes SHALL be shown, regardless of status filter

#### Scenario: Filter bar hidden in feature view
- **WHEN** feature view is active
- **THEN** the filter bar SHALL not be rendered

### Requirement: Flat view route cards
In flat view, routes SHALL be listed as collapsible `RouteCard` components. The header SHALL always be visible: `[METHOD badge] [path] [status pill] [chevron icon]`. The body SHALL be collapsed by default and expand on click with a 300ms max-height transition.

#### Scenario: Route card header visible
- **WHEN** results are displayed in flat view
- **THEN** each route SHALL show its method badge, path, and status pill

#### Scenario: Route card expand
- **WHEN** the user clicks a route card header
- **THEN** the body SHALL expand showing description, fetch snippet, and TypeScript types

#### Scenario: Copy button in code block
- **WHEN** the user clicks the copy button on a code block
- **THEN** the code SHALL be copied to clipboard and the button text SHALL change to `"copied"` for 2 seconds

### Requirement: Feature view groups
In feature view, routes SHALL be grouped under `FeatureGroup` accordion components. Each group header SHALL show the feature name and route count. The chevron SHALL rotate 90° when the group is open. Route cards inside SHALL be the same `RouteCard` component as in flat view.

#### Scenario: Feature group collapsed by default
- **WHEN** feature view first renders
- **THEN** all feature groups SHALL be collapsed

#### Scenario: Feature group expand
- **WHEN** the user clicks a feature group header
- **THEN** the group body SHALL expand with a 300ms transition showing its route cards

### Requirement: Empty state handling
If the analysis returns zero routes, the results section SHALL show a message: `"no routes detected — check your input and try again"` in mono lowercase gray.

#### Scenario: Zero routes
- **WHEN** the API returns a result with zero routes
- **THEN** the metric cards SHALL show all zeros and an empty-state message SHALL be displayed instead of a route list

### Requirement: Error state handling
If the API returns an error, an error message SHALL be displayed below the button/loading section in `status.orphan` (red) color. The input form SHALL remain visible so the user can retry.

#### Scenario: API error
- **WHEN** the `POST /api/analyze` call fails
- **THEN** an error message SHALL appear and the loading state SHALL be cleared
