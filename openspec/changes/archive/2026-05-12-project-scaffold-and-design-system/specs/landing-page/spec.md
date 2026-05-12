## ADDED Requirements

### Requirement: Hero section
The landing page SHALL render a full-viewport hero section with headline `KNOW EVERY ROUTE.` on the first line and `BRIDGE EVERY GAP.` on the second line in Space Grotesk display font (large, uppercase). Below the headline SHALL be a sub-headline in Geist Mono lowercase muted gray: `the api intelligence platform for full-stack teams.` Two CTA buttons SHALL be present: primary `analyze your codebase →` linking to `/analyze`, and secondary `generate api docs →` linking to `/docs-generator`.

#### Scenario: Hero headline render
- **WHEN** the landing page loads
- **THEN** the hero SHALL display the two-line headline in display font, uppercase

#### Scenario: CTA navigation
- **WHEN** the user clicks `analyze your codebase →`
- **THEN** the browser SHALL navigate to `/analyze`

#### Scenario: Secondary CTA navigation
- **WHEN** the user clicks `generate api docs →`
- **THEN** the browser SHALL navigate to `/docs-generator`

### Requirement: Four-pillar section
Below the hero, the page SHALL render four bordered boxes in a 2×2 grid (or 1×4 on desktop) with no border-radius. Each box SHALL contain: an index number in mono (`01`–`04`), a title in display font, and a one-line description. The four pillars SHALL be: `01 detect` / `02 connect` / `03 organize` / `04 document`.

#### Scenario: Four pillars render
- **WHEN** the landing page loads
- **THEN** four boxes SHALL be visible with index numbers 01–04 and their respective titles and descriptions

#### Scenario: Pillar box hover
- **WHEN** the user hovers over a pillar box
- **THEN** the box border SHALL transition from dark gray to white over 0.2s

### Requirement: How It Works section
The page SHALL render a three-step "How It Works" section with steps separated by vertical lines. Steps: `01 / paste or upload`, `02 / ai analyzes`, `03 / explore results`. Each step SHALL include a two-line description in muted body text.

#### Scenario: Steps render
- **WHEN** the landing page loads
- **THEN** three steps with vertical separator lines SHALL be visible in a horizontal layout

### Requirement: Demo Strip (animated terminal)
The page SHALL render a `<pre>` block styled as a terminal window that cycles through three example outputs every 3 seconds with a fade-in animation. Examples: (1) a route being detected, (2) a feature being classified, (3) a TypeScript type being generated. Text SHALL be in Geist Mono lowercase.

#### Scenario: Initial demo strip state
- **WHEN** the landing page loads
- **THEN** the first demo example SHALL be visible in the terminal block

#### Scenario: Demo strip rotation
- **WHEN** 3 seconds pass after the current example is shown
- **THEN** the next example SHALL fade in, replacing the previous one

#### Scenario: Demo strip loops
- **WHEN** the last example (index 2) is shown and 3 seconds pass
- **THEN** it SHALL cycle back to the first example

### Requirement: Footer
The page SHALL have a footer containing: the Logo component, the tagline, a list of tech stack indicators (subtle gray), and the text `Built for Engineering Productivity x AI Hackathon`. No emojis. Only Tabler icons or geometric SVGs if icons are used.

#### Scenario: Footer render
- **WHEN** the landing page loads
- **THEN** the footer SHALL display the logo, tagline, and hackathon credit text
