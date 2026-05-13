## ADDED Requirements

### Requirement: Multi-stage Dockerfile produces minimal Next.js standalone image
The project SHALL include a `Dockerfile` at the repository root that builds the Next.js app using a three-stage build: `deps` (production node_modules), `builder` (full build with devDependencies + `prisma generate` + `next build`), and `runner` (final image with only standalone output, static assets, public dir, and prisma schema). The runner stage MUST use `node:20-alpine`, run as a non-root user (`nextjs`, uid 1001), set `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=3000`, and expose port 3000.

#### Scenario: Image builds successfully
- **WHEN** `docker build -t <tag> .` is run from the project root
- **THEN** the build completes without error and produces an image with a working `node server.js` entrypoint

#### Scenario: Prisma client is available at runtime
- **WHEN** the container starts
- **THEN** the Prisma-generated client for `linux-musl` (Alpine) is present inside the image and the app can query the database

#### Scenario: Container runs as non-root
- **WHEN** `docker inspect <container>` is checked
- **THEN** the process user is `nextjs` (uid 1001), not root

### Requirement: .dockerignore excludes dev and sensitive artifacts
The project SHALL include a `.dockerignore` at the repository root that excludes `node_modules`, `.next`, `.env*`, `.git`, `.gitignore`, `openspec/`, `tests/`, `**/*.test.ts`, `**/*.spec.ts`, `coverage/`, `dist/`, `build/`, `.turbo/`, and `.DS_Store` from the Docker build context.

#### Scenario: Build context is minimal
- **WHEN** `docker build` is run
- **THEN** none of the excluded paths are sent to the Docker daemon (build context size is reduced significantly vs. no `.dockerignore`)
