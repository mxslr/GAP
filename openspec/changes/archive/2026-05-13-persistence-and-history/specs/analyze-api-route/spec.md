## ADDED Requirements

### Requirement: POST /api/analyze persists result to database
After a successful pipeline run, `POST /api/analyze` SHALL attempt to save the result to the database using Prisma. On success, the response body SHALL include an `analysisId` field containing the UUID of the created `Analysis` record. On DB failure, the response SHALL include `analysisId: null` and the pipeline result SHALL still be returned with status 200.

#### Scenario: Response includes analysisId on successful DB write
- **WHEN** `POST /api/analyze` completes and the database write succeeds
- **THEN** the response body SHALL include `analysisId` as a non-null UUID string alongside the existing `GapAnalysisResult` fields

#### Scenario: Response includes analysisId null on DB failure
- **WHEN** `POST /api/analyze` completes the pipeline successfully but the Prisma write throws
- **THEN** the response SHALL return status 200 with `analysisId: null` and the full `GapAnalysisResult` body
