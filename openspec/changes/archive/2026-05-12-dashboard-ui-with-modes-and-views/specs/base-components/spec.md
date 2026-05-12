## ADDED Requirements

### Requirement: ModeSelector component
The `ModeSelector` component SHALL render two tab buttons: `"Monorepo"` and `"Separate Repos"`. The active tab SHALL have white background and black text. Inactive tabs SHALL have transparent background with a thin `border-default` border. No border-radius. All transitions SHALL animate at 0.2s ease.

#### Scenario: Active tab styling
- **WHEN** "Monorepo" tab is active
- **THEN** the "Monorepo" button SHALL have white background and black text, while "Separate Repos" SHALL have transparent background with gray border

#### Scenario: Tab switch callback
- **WHEN** the user clicks an inactive tab
- **THEN** the `onModeChange` callback SHALL be called with the new mode value

### Requirement: ViewToggle component
The `ViewToggle` component SHALL render two toggle buttons: `"flat view"` and `"feature view"` in mono lowercase. The active view SHALL have white background and black text. No border-radius.

#### Scenario: Active view button
- **WHEN** flat view is selected
- **THEN** the flat view button SHALL have white background and black text

#### Scenario: Toggle callback
- **WHEN** the user clicks "feature view"
- **THEN** the `onViewChange` callback SHALL fire with `'feature'`

### Requirement: MetricCard component
The `MetricCard` component SHALL accept `label`, `value`, and `color` props. It SHALL render the value in large display font and the label in mono lowercase. The left border SHALL use the provided color (1px accent). No border-radius. Background is `bg-secondary`.

#### Scenario: MetricCard renders value
- **WHEN** `<MetricCard label="connected" value={12} color="status-connected" />` is rendered
- **THEN** it SHALL display `"12"` in large font and `"connected"` in mono lowercase below

### Requirement: FilterBar component
The `FilterBar` component SHALL render two groups of filter buttons: status filters (`all`, `connected`, `orphan`, `ghost`) and method filters (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`). Active filters SHALL have white background and black text; inactive SHALL have thin `border-default` gray border. All text in mono lowercase.

#### Scenario: Active filter state
- **WHEN** the "orphan" status filter is active
- **THEN** the orphan button SHALL have white background with black text

#### Scenario: Filter change callback
- **WHEN** the user clicks a method filter
- **THEN** the `onFilterChange` callback SHALL be called with the updated filter state

### Requirement: RouteCard component
The `RouteCard` component SHALL render a collapsible card. The header SHALL always show: a METHOD badge (thin colored border matching HTTP method), the route path in mono font, a status pill (thin colored border), and a chevron icon. The body SHALL collapse by default and expand with a 300ms max-height CSS transition on header click.

#### Scenario: Collapsed by default
- **WHEN** `<RouteCard>` is rendered without `defaultOpen` prop
- **THEN** the body SHALL be hidden and only the header visible

#### Scenario: Expand on click
- **WHEN** the user clicks the route card header
- **THEN** the body SHALL expand showing description, fetch snippet code block, and TypeScript types code block

#### Scenario: Method badge colors
- **WHEN** a RouteCard with `method="DELETE"` is rendered
- **THEN** the method badge SHALL show a thin red border and `"DELETE"` text in red, with transparent background

### Requirement: FeatureGroup component
The `FeatureGroup` component SHALL render an accordion with a header showing feature name and route count, and a body containing `RouteCard` components. The chevron SHALL rotate 90° when the group is open. Expand/collapse SHALL use a 300ms max-height transition. No border-radius.

#### Scenario: Feature group collapsed by default
- **WHEN** `<FeatureGroup>` is rendered
- **THEN** route cards inside SHALL be hidden and only the header visible

#### Scenario: Chevron rotation on open
- **WHEN** the group is expanded
- **THEN** the chevron icon SHALL be rotated 90° via a CSS transform transition

### Requirement: CodeBlock component with copy
The `CodeBlock` component SHALL render a code string inside a `<pre>` block with `bg-tertiary` background and a `"copy"` button in the top-right corner. After clicking copy, the button text SHALL change to `"copied"` for 2 seconds then revert. No border-radius.

#### Scenario: Copy button copies to clipboard
- **WHEN** the user clicks the copy button
- **THEN** `navigator.clipboard.writeText` SHALL be called with the code content

#### Scenario: Copy button feedback
- **WHEN** copy is triggered
- **THEN** button text changes to `"copied"` and reverts to `"copy"` after 2 seconds
