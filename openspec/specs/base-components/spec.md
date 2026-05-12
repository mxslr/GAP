## ADDED Requirements

### Requirement: Logo component
The Logo component SHALL render the wordmark `GAP` in Space Grotesk Bold uppercase with `letter-spacing: -0.04em`, followed by a solid white square dot (`.`). A 1px white horizontal line SHALL appear under the wordmark. An optional `tagline` prop SHALL render `api intelligence platform` below in Geist Mono lowercase gray.

#### Scenario: Default logo render
- **WHEN** `<Logo />` is rendered without props
- **THEN** it SHALL display "GAP." in display font with a baseline underline and no tagline

#### Scenario: Logo with tagline
- **WHEN** `<Logo showTagline />` is rendered
- **THEN** it SHALL display the tagline text in mono lowercase below the wordmark

### Requirement: Navbar component
The Navbar SHALL be fixed to the top of the viewport, transparent by default (showing only text). On hover of the navbar area, it SHALL fade in `rgba(0,0,0,0.6)` background with `backdrop-filter: blur(12px)` and a bottom border in `border-default` color. It SHALL contain the Logo on the left and navigation links on the right.

#### Scenario: Default navbar state
- **WHEN** a page loads and the user has not hovered the navbar
- **THEN** the navbar background SHALL be fully transparent

#### Scenario: Navbar hover state
- **WHEN** the user hovers the navbar area
- **THEN** the background SHALL transition to semi-transparent with backdrop blur and a bottom border SHALL appear

### Requirement: Button component
The Button component SHALL support two variants: `primary` (white background, black text) and `secondary` (transparent background, white border, white text). All variants MUST have sharp square corners (no border-radius). It SHALL accept `href` prop for link behavior and `onClick` for action behavior.

#### Scenario: Primary button render
- **WHEN** `<Button variant="primary">` is rendered
- **THEN** it SHALL show white background with black text and no rounded corners

#### Scenario: Secondary button render
- **WHEN** `<Button variant="secondary">` is rendered
- **THEN** it SHALL show transparent background with a 1px white border

#### Scenario: Button hover transition
- **WHEN** the user hovers any Button
- **THEN** background/border/color changes SHALL animate over 0.2s ease

### Requirement: Box component
The Box component SHALL render a bordered surface with a 1px `border-default` color border and `bg-secondary` background. On hover, the border SHALL transition to `border-hover` (white). It MUST have no border-radius.

#### Scenario: Box default state
- **WHEN** `<Box>` is rendered
- **THEN** it SHALL show a dark background with a dark gray 1px border

#### Scenario: Box hover state
- **WHEN** the user hovers over a Box
- **THEN** the border SHALL transition to white over 0.2s ease

### Requirement: Spinner component
The Spinner component SHALL render as a rotating square (not a circle), in white/monochrome only. It MUST NOT use `border-radius` or `rounded-*` classes.

#### Scenario: Spinner render
- **WHEN** `<Spinner />` is rendered
- **THEN** it SHALL display a rotating square animation in white color with sharp corners
