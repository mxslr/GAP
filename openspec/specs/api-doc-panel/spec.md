## ADDED Requirements

### Requirement: ApiDocPanel renders two-column layout with sticky TOC
The `ApiDocPanel` component SHALL accept `markdown: string` and `openapi: object | null` props and render a two-column layout: a sticky left sidebar (30% width) containing the table of contents and a right main area (70% width) containing the rendered Markdown.

#### Scenario: Component renders with valid Markdown
- **WHEN** ApiDocPanel receives a non-empty markdown string
- **THEN** the left sidebar shows a TOC extracted from the Markdown headings and the right panel shows the rendered content

#### Scenario: Component renders empty state for empty markdown
- **WHEN** ApiDocPanel receives an empty string
- **THEN** a placeholder message is shown instead of the two-column layout

### Requirement: TOC is derived from Markdown headings with anchor links
The system SHALL extract all h2 and h3 headings from the Markdown string by regex and render them as anchor links in the TOC sidebar. Each heading SHALL be slugified (lowercase, spaces replaced with hyphens, special characters stripped) to generate its anchor id. TOC links SHALL use `href="#<slug>"` format.

#### Scenario: TOC reflects headings in document
- **WHEN** Markdown contains `## Authentication` and `### POST /api/auth/login`
- **THEN** TOC shows "Authentication" linking to `#authentication` and "POST /api/auth/login" linking to `#post-apiauth login` (slugified)

#### Scenario: Active TOC item highlights on scroll
- **WHEN** user scrolls the right panel and a section heading enters the viewport
- **THEN** the corresponding TOC item receives an active/highlighted visual state

### Requirement: TOC sidebar has a search input to filter visible routes
The system SHALL render a search input at the top of the TOC sidebar. As the user types, TOC entries SHALL be filtered to show only those whose text matches the query (case-insensitive substring match). The right panel content SHALL not be filtered — only the TOC list.

#### Scenario: Search narrows TOC list
- **WHEN** user types "auth" in the search input
- **THEN** only TOC entries containing "auth" (case-insensitive) remain visible

#### Scenario: Empty search shows all TOC entries
- **WHEN** search input is cleared
- **THEN** all TOC entries are visible again

### Requirement: Markdown is rendered with syntax-highlighted code blocks
The system SHALL render the Markdown string using `react-markdown` with `rehype-highlight`. Fenced code blocks SHALL receive syntax highlighting. Each code block SHALL have a copy button overlaid at the top-right corner.

#### Scenario: Code block has copy button
- **WHEN** rendered Markdown contains a fenced code block
- **THEN** a copy button is visible on the code block

#### Scenario: Copy button copies code content to clipboard
- **WHEN** user clicks the copy button on a code block
- **THEN** the code content is written to the system clipboard and a transient "copied" label appears

### Requirement: Heading elements receive id attributes for anchor navigation
The system SHALL configure the `react-markdown` `components` prop to render `h2` and `h3` elements with an `id` attribute equal to the slugified heading text, enabling direct-link and TOC anchor navigation.

#### Scenario: H2 heading has correct id
- **WHEN** Markdown contains `## User Management`
- **THEN** the rendered `<h2>` element has `id="user-management"`
