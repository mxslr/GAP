## ADDED Requirements

### Requirement: GET /api/health endpoint
The system SHALL expose a `GET /api/health` route in `app/api/health/route.ts` that returns HTTP 200 with JSON body `{"status": "ok"}`. This endpoint SHALL NOT require authentication and SHALL respond within 500ms. It is used by Kubernetes liveness and readiness probes.

#### Scenario: Healthy response
- **WHEN** a GET request is made to `/api/health`
- **THEN** the response SHALL have HTTP status 200 and body `{"status":"ok"}`

#### Scenario: Always available
- **WHEN** the application is running (regardless of database connectivity)
- **THEN** `/api/health` SHALL return 200 without blocking on DB checks

#### Scenario: No authentication required
- **WHEN** an unauthenticated request is made to `/api/health`
- **THEN** the response SHALL succeed (no 401/403)
