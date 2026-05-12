## ADDED Requirements

### Requirement: Color token palette
The system SHALL define all colors exclusively through Tailwind design tokens. No raw hex values SHALL appear in component files. The palette MUST include: `bg-primary` (#000000), `bg-secondary` (#0A0A0A), `bg-tertiary` (#141414), `fg-primary` (#FFFFFF), `fg-secondary` (#A0A0A0), `fg-tertiary` (#5C5C5C), `border-default` (#2A2A2A), `border-hover` (#FFFFFF), `status-connected` (#4ADE80), `status-ghost` (#FBBF24), `status-orphan` (#F87171).

#### Scenario: Token usage in components
- **WHEN** a developer writes a Tailwind class for background color
- **THEN** the class SHALL use a token name (e.g., `bg-bg-primary`) not a raw color (e.g., `bg-[#000000]`)

### Requirement: Typography system
The system SHALL load three fonts: Space Grotesk (700, display headings/logo), Geist (400, 500, body text), and Geist Mono (code, labels, route paths). All three SHALL be loaded via `@import` in `globals.css` from Google Fonts.

#### Scenario: Font class assignment
- **WHEN** a component renders a route path or label
- **THEN** it SHALL use `font-mono` and the text SHALL be lowercase

#### Scenario: Display font usage
- **WHEN** a component renders a hero heading or logo wordmark
- **THEN** it SHALL use `font-display` (Space Grotesk, 700)

### Requirement: No border-radius constraint
The system SHALL NOT use any Tailwind `rounded-*` utility class or inline `border-radius` style anywhere in the codebase. All UI elements MUST use sharp square corners.

#### Scenario: Button rendering
- **WHEN** a Button component is rendered
- **THEN** it SHALL have no border-radius (corners are perfectly square)

### Requirement: Transition on all interactive elements
Every interactive element (buttons, links, inputs, cards with hover) SHALL have a CSS transition of minimum `0.2s ease` applied to hover-state properties (color, background, border).

#### Scenario: Button hover
- **WHEN** a user hovers over a Button
- **THEN** the color/border change SHALL animate over at least 0.2 seconds

### Requirement: Staggered page load animation
Top-level page sections SHALL appear with a staggered fade-in animation, each section offset by 50–100ms from the previous.

#### Scenario: Landing page load
- **WHEN** the landing page renders
- **THEN** each major section (hero, pillars, how-it-works, demo strip, footer) SHALL fade in with increasing delay offsets
