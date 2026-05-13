## Context

GAP is a Next.js 14 app (App Router, standalone output) that uses Prisma + PostgreSQL and two AI providers: Groq (primary) and Gemini (fallback). All application features are complete. The organizer provides a Kubernetes cluster with namespace `muyung-anak-telyu`, nginx ingress, cert-manager, and a PostgreSQL instance. The team has `kubeconfig.yaml` at the project root. Deployment must be live before the judge demo.

## Goals / Non-Goals

**Goals:**
- Build a minimal, production-safe Docker image from the Next.js standalone output
- Define K8s Deployment, Service, and Ingress that wire up to organizer infrastructure
- Keep secrets out of YAML — reference `gap-secrets` K8s Secret for all credentials
- Provide an operational README teammates can follow without prior K8s experience

**Non-Goals:**
- Horizontal scaling / HPA (single replica is sufficient for the hackathon demo)
- CI/CD pipeline (manual `docker build && kubectl apply` is acceptable)
- Database migrations via initContainers (Prisma schema is already applied; schema push is a one-off manual step)
- Multi-environment config (prod only; no staging namespace)

## Decisions

### Multi-stage Docker build (3 stages)

**Decision:** Use `deps → builder → runner` pattern, not a single stage.

**Rationale:** The `builder` stage needs full `devDependencies` (TypeScript, Next.js build tooling). The final `runner` image copies only the `.next/standalone` output and static assets — resulting in an image ~3× smaller than a naive `npm install && npm run build` single stage. Alpine base keeps it lean.

**Alternative considered:** `node:20-slim` Debian base — rejected because Alpine produces smaller images and avoids glibc dependency issues with Prisma's binaries (Prisma generates the correct binary for Alpine via `prisma generate` in the builder stage).

### Non-root user in runner

**Decision:** Create `nodejs` group + `nextjs` user (uid 1001) and run as that user.

**Rationale:** Defense-in-depth. If the container is compromised, the attacker has no root access to the host. Required by most security scanners.

### ClusterIP Service (not NodePort or LoadBalancer)

**Decision:** Service type `ClusterIP` with nginx Ingress routing HTTP traffic.

**Rationale:** The organizer cluster already has nginx ingress + cert-manager. Using ClusterIP + Ingress is the standard pattern; it avoids allocating a cloud LoadBalancer and lets cert-manager issue TLS automatically via the Ingress TLS stanza.

### Single Secret `gap-secrets` with three keys

**Decision:** `DATABASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY` all in one Secret.

**Rationale:** Simpler to create and rotate as a unit. The app needs all three at boot; there's no reason to split them. The `kubectl create secret` command in the README makes this a one-liner.

### `readOnlyRootFilesystem: false`

**Decision:** Leave root filesystem writable.

**Rationale:** Next.js standalone writes to `.next/cache` at runtime for ISR page caching. Prisma also writes query engine binary artifacts. Enabling read-only FS would require emptyDir mounts for each — unnecessary complexity for a 24-hour hackathon.

### `imagePullPolicy: IfNotPresent`

**Decision:** Use `IfNotPresent` rather than `Always`.

**Rationale:** The team will push a versioned tag (`v1`). `IfNotPresent` avoids redundant pulls. If the image needs updating, a new tag (`v2`) is the correct approach — not relying on `latest` + `Always`.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Special chars in DB password break `DATABASE_URL` | README explicitly documents URL-encoding map: `(→%28 )→%29 &→%26 >→%3E`. Secret value must be pre-encoded. |
| Prisma binary mismatch (Alpine vs glibc) | `npx prisma generate` runs inside the Alpine builder — generates `linux-musl` binary automatically. |
| cert-manager TLS issuance delay (2-5 min) | README instructs to wait and check `kubectl describe ingress`. Demo should not start until TLS is green. |
| Pod OOMKilled under heavy AI response load | Memory limit set to 512Mi (generous for Next.js standalone). Groq streaming keeps memory constant. |
| Docker Hub rate limits | Image is small (~200MB); single push for hackathon is well within free-tier limits. |
| `kubeconfig.yaml` contains cluster credentials | Already at project root; gitignored implicitly. README warns not to commit it. |

## Migration Plan

1. `docker build -t <user>/gap:v1 .` — build image locally
2. `docker push <user>/gap:v1` — push to Docker Hub
3. Update `image:` field in `k8s/deployment.yaml` with actual username
4. `kubectl --kubeconfig=./kubeconfig.yaml create secret generic gap-secrets ...` — create secret
5. `kubectl apply -f k8s/deployment.yaml` → `k8s/service.yaml` → `k8s/ingress.yaml`
6. Watch pods: `kubectl get pods -n muyung-anak-telyu -w`
7. Verify: `curl https://muyung-anak-telyu.hackathon.sev-2.com/api/health`

**Rollback:** `kubectl rollout undo deployment/gap-api -n muyung-anak-telyu`

## Open Questions

_(none — all deployment decisions have been made based on organizer cluster constraints)_
