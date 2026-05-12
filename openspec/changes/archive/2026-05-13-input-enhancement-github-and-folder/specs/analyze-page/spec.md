## MODIFIED Requirements

### Requirement: Mode Selector
The `/analyze` page SHALL render a `ModeSelector` component at the top with **three** tabs: **Monorepo**, **Separate Repos**, and **Backend-Only**. The selected tab SHALL be highlighted (white background, black text active state). Switching tabs SHALL update the input section below without a page navigation.

#### Scenario: Default mode on page load
- **WHEN** the user navigates to `/analyze`
- **THEN** the "Monorepo" tab SHALL be selected by default

#### Scenario: Switch to Separate mode
- **WHEN** the user clicks the "Separate Repos" tab
- **THEN** the input section SHALL change to the two-input layout for Separate mode

#### Scenario: Switch to Backend-Only mode
- **WHEN** the user clicks the "Backend-Only" tab
- **THEN** the input section SHALL change to a single-input layout with a "backend code" label and no frontend input

### Requirement: Input method tabs per mode
Below the `ModeSelector`, an `InputMethodTabs` component SHALL appear with three tabs: `"github url"`, `"drop folder"`, and `"paste code"`. The active method tab SHALL persist across mode changes. In **Monorepo** mode, all three methods render a single input slot. In **Separate Repos** mode, all three methods render two input slots side-by-side (backend / frontend). In **Backend-Only** mode, all three methods render a single input slot labeled `"backend code"`.

#### Scenario: GitHub method in Monorepo mode
- **WHEN** mode is Monorepo and input method is "github url"
- **THEN** one `GitHubInput` component SHALL be visible with no label (or generic "repository" label)

#### Scenario: GitHub method in Separate mode
- **WHEN** mode is Separate and input method is "github url"
- **THEN** two `GitHubInput` components SHALL be visible side-by-side labeled `"backend"` and `"frontend"`

#### Scenario: Folder method in Separate mode
- **WHEN** mode is Separate and input method is "drop folder"
- **THEN** two `FolderDropZone` components SHALL be visible side-by-side labeled `"backend"` and `"frontend"`

#### Scenario: Paste method renders existing textareas
- **WHEN** input method is "paste code"
- **THEN** the existing textarea layout for the current mode SHALL be visible, unchanged from prior behavior

### Requirement: Monorepo input form
In Monorepo mode with paste method, the input section SHALL show a single large textarea with placeholder text and helper text `"ai will detect which folders are backend and frontend"`.

#### Scenario: Monorepo textarea visible in paste mode
- **WHEN** mode is Monorepo and method is "paste code"
- **THEN** one textarea SHALL be visible

#### Scenario: Empty submit blocked
- **WHEN** the user clicks "analyze api gaps" with an empty input (any method)
- **THEN** the form SHALL not submit

### Requirement: Separate Repos input form
In Separate mode with paste method, the input section SHALL show two textareas side-by-side labeled `"backend code"` and `"frontend code"`.

#### Scenario: Separate textareas visible in paste mode
- **WHEN** mode is Separate and method is "paste code"
- **THEN** two textareas in a 2-column grid SHALL be visible

#### Scenario: Separate mode requires both inputs
- **WHEN** user clicks "analyze api gaps" with only one input filled
- **THEN** the form SHALL not submit

### Requirement: Loading state with step messages
After the analyze button is clicked, the page SHALL show a loading section with a rotating square Spinner and sequential step messages. For GitHub method, the first step SHALL be `"fetching repository..."`. For folder method, the first step SHALL be `"reading folder..."`. Subsequent steps remain:
1. `"detecting layout..."` (Monorepo only, ~2s)
2. `"parsing backend routes..."` (~3s)
3. `"parsing frontend calls..."` (~3s)
4. `"matching gaps..."` (~2s)
5. `"classifying features..."` (~3s)
6. `"generating snippets..."` (until response)

#### Scenario: GitHub-specific loading step shown
- **WHEN** input method is "github url" and form is submitted
- **THEN** the first loading step message SHALL be `"fetching repository..."`

#### Scenario: Folder-specific loading step shown
- **WHEN** input method is "drop folder" and form is submitted
- **THEN** the first loading step message SHALL be `"reading folder..."`

#### Scenario: Loading state appears on submit
- **WHEN** the user submits the form
- **THEN** the input section SHALL be hidden, the Spinner and current step message SHALL be visible

#### Scenario: Step messages advance
- **WHEN** the loading state is active
- **THEN** the step message text SHALL change sequentially, each fading in with the step change

### Requirement: Results section — mode badge
After analysis completes, a mode badge SHALL appear above the results. It SHALL read `"MONOREPO MODE"`, `"SEPARATE MODE"`, or `"BACKEND-ONLY MODE"` in uppercase mono font with a thin white border.

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
A `FilterBar` component SHALL appear below the metric cards when flat view is active. It SHALL support filtering by status and by HTTP method. Filter bar SHALL be hidden in feature view.

#### Scenario: Filter by status
- **WHEN** the user clicks the "orphan" filter
- **THEN** only routes with `status === 'orphan'` SHALL be shown in the flat list

#### Scenario: Filter bar hidden in feature view
- **WHEN** feature view is active
- **THEN** the filter bar SHALL not be rendered

### Requirement: Flat view route cards
In flat view, routes SHALL be listed as collapsible `RouteCard` components. The header SHALL always be visible and the body SHALL expand on click.

#### Scenario: Route card expand
- **WHEN** the user clicks a route card header
- **THEN** the body SHALL expand showing description, fetch snippet, and TypeScript types

### Requirement: Feature view groups
In feature view, routes SHALL be grouped under `FeatureGroup` accordion components.

#### Scenario: Feature group expand
- **WHEN** the user clicks a feature group header
- **THEN** the group body SHALL expand showing its route cards

### Requirement: Empty state handling
If the analysis returns zero routes, the results section SHALL show `"no routes detected — check your input and try again"` in mono lowercase gray.

#### Scenario: Zero routes
- **WHEN** the API returns a result with zero routes
- **THEN** an empty-state message SHALL be displayed

### Requirement: Error state handling
If the API returns an error, an error message SHALL be displayed in `status.orphan` (red) color. The input form SHALL remain visible so the user can retry.

#### Scenario: API error
- **WHEN** the `POST /api/analyze` call fails
- **THEN** an error message SHALL appear and the loading state SHALL be cleared
