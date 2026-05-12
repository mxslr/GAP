## ADDED Requirements

### Requirement: Read dropped folder recursively
`readDroppedFolder` SHALL accept a `DataTransferItemList` and recursively traverse all entries using the `FileSystemDirectoryEntry` API. It SHALL collect all files into a flat list, applying the same exclusion rules as the GitHub fetcher (skip `node_modules`, `.next`, `dist`, `build`, `__pycache__`, `vendor`, `*.test.*`, `*.spec.*`). The result SHALL be capped at 200 files.

#### Scenario: Nested folder traversed recursively
- **WHEN** user drops a folder containing `src/routes/auth.ts` inside `src/routes/`
- **THEN** the file SHALL appear in the result with path `src/routes/auth.ts` relative to the dropped root

#### Scenario: Excluded directories skipped
- **WHEN** dropped folder contains a `node_modules/` subdirectory
- **THEN** no files from `node_modules/` SHALL appear in the result

#### Scenario: Result capped at 200 files
- **WHEN** more than 200 non-excluded source files are found
- **THEN** only the first 200 SHALL be included and `skippedFiles` SHALL reflect the remainder

### Requirement: Read selected folder via file picker
`readSelectedFolder` SHALL accept a `FileList` (from `<input type="file" webkitdirectory />`) and process it using the same filtering and capping rules as `readDroppedFolder`. Each `File` object's `webkitRelativePath` SHALL be used as the `path` field.

#### Scenario: File picker result processed correctly
- **WHEN** user selects a folder via file picker with 30 source files
- **THEN** all 30 files SHALL be in the result with correct relative paths

### Requirement: Skip binary and oversized files
Both folder-reading functions SHALL skip files that are larger than 500KB. They SHALL also attempt to read each file as UTF-8 text and skip any file where the decoded content contains null bytes (indicating a binary file).

#### Scenario: Files larger than 500KB skipped
- **WHEN** folder contains a file of 600KB
- **THEN** the file SHALL not appear in the result and `skippedFiles` count SHALL increment

#### Scenario: Binary files skipped
- **WHEN** folder contains a `.wasm` or image file that decodes with null bytes
- **THEN** the file SHALL be excluded from the result

### Requirement: Return RepoContent from folder reading
Both functions SHALL return a `RepoContent` object with `files`, `totalFiles`, and `skippedFiles`. `repoUrl` and `branch` fields SHALL be `undefined` for local folder input.

#### Scenario: RepoContent shape correct for folder input
- **WHEN** folder read completes
- **THEN** returned object SHALL have `files: FileEntry[]`, `totalFiles: number`, `skippedFiles: number`, and `repoUrl` SHALL be `undefined`
