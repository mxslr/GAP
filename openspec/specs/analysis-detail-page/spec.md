## ADDED Requirements

### Requirement: /analyze/[id] detail page
The system SHALL provide a Server Component at `app/analyze/[id]/page.tsx` that fetches an analysis by ID from the database and re-renders the full gap analysis result UI. It SHALL include a "new analysis" button linking back to `/analyze`.

#### Scenario: Valid analysis ID renders result
- **WHEN** user navigates to `/analyze/:id` with a valid gap analysis ID
- **THEN** the page SHALL render the same result UI as `/analyze` after analysis completes: metric cards, filter bar, route list with feature grouping, and expand/copy functionality

#### Scenario: Not found renders 404-style message
- **WHEN** user navigates to `/analyze/:id` with an ID that does not exist in the database
- **THEN** the page SHALL render an error message with a link back to `/analyze`

#### Scenario: New analysis button is present
- **WHEN** the `/analyze/:id` page is rendered
- **THEN** a "new analysis" button SHALL be visible at the top of the page and SHALL link to `/analyze`

#### Scenario: Backend-only analysis rejected
- **WHEN** user navigates to `/analyze/:id` with an ID that belongs to a `backend-only` analysis
- **THEN** the page SHALL redirect or show a message directing the user to `/docs-generator/:id`
