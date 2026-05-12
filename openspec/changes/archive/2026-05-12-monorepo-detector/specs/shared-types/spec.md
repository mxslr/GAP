## ADDED Requirements

### Requirement: FileTreeEntry interface
The module SHALL export `interface FileTreeEntry` with fields: `path: string`, `type: 'file' | 'dir'`, and optional `content?: string`. This type is used as the structured input format for `detectMonorepoLayout()`.

#### Scenario: FileTreeEntry construction
- **WHEN** a caller constructs a structured tree for monorepo detection
- **THEN** TypeScript SHALL require `path` and `type` as minimum fields and accept optional `content`

#### Scenario: Import from shared module
- **WHEN** `lib/repo/monorepo-detector.ts` needs the structured tree type
- **THEN** it SHALL import `FileTreeEntry` from `lib/types.ts` rather than defining its own shape
