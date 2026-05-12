## ADDED Requirements

### Requirement: InputMethodTabs renders three tab options
`InputMethodTabs` SHALL render three tab buttons labeled `"github url"`, `"drop folder"`, and `"paste code"` in Geist Mono lowercase. The active tab SHALL have a white background and black text. Inactive tabs SHALL have a thin gray border (`border.default`) and `fg.secondary` text. Tab switching SHALL be controlled via `activeMethod` and `onMethodChange` props. There SHALL be NO border-radius on any tab element.

#### Scenario: Active tab highlighted
- **WHEN** `activeMethod` is `"github"`
- **THEN** the "github url" tab SHALL have white background and black text; the other two SHALL have gray border styling

#### Scenario: Tab click triggers callback
- **WHEN** user clicks the "drop folder" tab
- **THEN** `onMethodChange("folder")` SHALL be called

#### Scenario: No border-radius on tabs
- **WHEN** component is rendered
- **THEN** no tab button SHALL have any border-radius applied

### Requirement: InputMethodTabs transitions between tabs smoothly
Switching between tabs SHALL trigger a 0.2s ease transition on the active indicator. The content area below the tabs is controlled by the parent, not the tab component itself.

#### Scenario: Transition applied on tab change
- **WHEN** user switches from one tab to another
- **THEN** the background and border changes SHALL animate over 0.2s ease

### Requirement: GitHubInput validates URL format on blur
`GitHubInput` SHALL render a text input with placeholder `"https://github.com/owner/repo"`. On blur, if the value is non-empty and does not match the GitHub URL pattern, an inline error message SHALL appear below the input in `status.orphan` color (#F87171) in Geist Mono. On valid URL, the error SHALL be cleared.

#### Scenario: Invalid URL shows error on blur
- **WHEN** user types `"notaurl"` and blurs the input
- **THEN** an error message SHALL appear in red mono font below the input

#### Scenario: Valid URL clears error
- **WHEN** user corrects input to `"https://github.com/owner/repo"` and blurs
- **THEN** no error message SHALL be visible

#### Scenario: Repo preview badge shown for valid URL
- **WHEN** URL is valid
- **THEN** a badge showing `owner/repo` SHALL appear below the input in `fg.secondary` color

### Requirement: FolderDropZone handles drag-and-drop and click-to-browse
`FolderDropZone` SHALL render a large box with a 1px dashed `border.default` border and NO border-radius. Center content SHALL include a folder icon (`IconFolder` from `@tabler/icons-react`), text `"drop folder here"` in display font, and subtext `"or click to browse"` in Geist Mono at `fg.secondary` (#A0A0A0). Clicking the zone SHALL trigger a hidden `<input type="file" webkitdirectory />`. On drag-over, the border SHALL change to 1px solid `border.hover` (white) and background to `bg.tertiary` (#141414). All transitions SHALL be 0.2s ease.

#### Scenario: Drag-over state applied
- **WHEN** user drags files over the drop zone
- **THEN** border becomes 1px solid white and background shifts to #141414 with 0.2s transition

#### Scenario: Click triggers file picker
- **WHEN** user clicks the drop zone
- **THEN** the hidden file input is triggered and folder selection dialog opens

#### Scenario: File count shown after selection
- **WHEN** user drops or selects a folder with 47 source files (node_modules excluded)
- **THEN** the zone SHALL show badge text `"47 files detected · node_modules excluded"` in `status.connected` green

#### Scenario: No border-radius anywhere on FolderDropZone
- **WHEN** component is rendered in any state
- **THEN** no element inside FolderDropZone SHALL have border-radius applied
