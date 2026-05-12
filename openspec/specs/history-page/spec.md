## ADDED Requirements

### Requirement: History page displays past analyses
The `/history` page SHALL be a Next.js Server Component that fetches all past analyses from the database and displays them as a filterable list. It SHALL support a `?filter=all|gap|docs` query parameter with a default of `all`.

#### Scenario: Page renders without filter
- **WHEN** user navigates to `/history`
- **THEN** all past analyses SHALL be displayed, newest first, with no filter applied

#### Scenario: Filter by gap analysis
- **WHEN** user navigates to `/history?filter=gap`
- **THEN** only analyses with `mode` of `monorepo` or `separate` SHALL be shown

#### Scenario: Filter by docs generation
- **WHEN** user navigates to `/history?filter=docs`
- **THEN** only analyses with `mode` of `backend-only` SHALL be shown

#### Scenario: Empty state
- **WHEN** no analyses exist in the database
- **THEN** the page SHALL display a message indicating no history is available and a CTA linking to `/analyze`

### Requirement: HistoryCard component
The system SHALL have a `HistoryCard` component at `components/HistoryCard.tsx` that renders a single analysis summary. It SHALL display: relative timestamp (`"5 minutes ago"`, computed via `Intl.RelativeTimeFormat`), mode badge, and either three metric badges (connected / orphan / ghost counts) for gap analyses or a single route-count badge for docs analyses. Clicking the card SHALL navigate to the appropriate detail page.

#### Scenario: Gap analysis card shows three metric badges
- **WHEN** a `HistoryCard` is rendered with a gap analysis record (mode `monorepo` or `separate`)
- **THEN** it SHALL show connected count in green, orphan count in red, and ghost count in amber

#### Scenario: Docs card shows route count badge
- **WHEN** a `HistoryCard` is rendered with a `backend-only` analysis record
- **THEN** it SHALL show only a single badge displaying the total route count

#### Scenario: Card links to correct detail page
- **WHEN** a gap analysis card is clicked
- **THEN** the user SHALL be navigated to `/analyze/:id`

#### Scenario: Docs card links to correct detail page
- **WHEN** a docs analysis card is clicked
- **THEN** the user SHALL be navigated to `/docs-generator/:id`

### Requirement: History link in Navbar
The `Navbar.tsx` component SHALL include a "history" navigation link pointing to `/history`.

#### Scenario: History link visible in navbar
- **WHEN** the Navbar is rendered on any page
- **THEN** a link labeled `history` (lowercase, mono font) SHALL be visible and functional
