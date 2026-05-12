## ADDED Requirements

### Requirement: /docs-generator/[id] detail page
The system SHALL provide a Server Component at `app/docs-generator/[id]/page.tsx` that fetches a docs generation analysis by ID from the database and re-renders the full API docs result UI. It SHALL include a "new generation" button linking back to `/docs-generator`.

#### Scenario: Valid docs analysis ID renders result
- **WHEN** user navigates to `/docs-generator/:id` with a valid backend-only analysis ID
- **THEN** the page SHALL render the same docs viewer UI as `/docs-generator` after generation completes, including the Markdown-rendered documentation, feature navigation, and Markdown export button

#### Scenario: Not found renders error message
- **WHEN** user navigates to `/docs-generator/:id` with an ID that does not exist in the database
- **THEN** the page SHALL render an error message with a link back to `/docs-generator`

#### Scenario: New generation button is present
- **WHEN** the `/docs-generator/:id` page is rendered
- **THEN** a "new generation" button SHALL be visible at the top and SHALL link to `/docs-generator`

#### Scenario: Non-docs analysis rejected
- **WHEN** user navigates to `/docs-generator/:id` with an ID that belongs to a gap analysis (mode `monorepo` or `separate`)
- **THEN** the page SHALL redirect or show a message directing the user to `/analyze/:id`
