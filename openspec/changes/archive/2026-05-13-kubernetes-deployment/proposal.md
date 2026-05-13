## Why

All application features are complete and production-ready. The final step is containerizing the Next.js app and deploying it to the organizer-provided Kubernetes cluster at `muyung-anak-telyu.hackathon.sev-2.com` so judges can test the live demo.

## What Changes

- **New**: Multi-stage `Dockerfile` that builds a minimal Next.js standalone image
- **New**: `.dockerignore` to exclude dev artifacts from the image
- **New**: `k8s/deployment.yaml` — Kubernetes Deployment for `gap-api` in namespace `muyung-anak-telyu`
- **New**: `k8s/service.yaml` — ClusterIP Service exposing port 80 → 3000
- **New**: `k8s/ingress.yaml` — nginx Ingress with TLS via cert-manager (letsencrypt-prod)
- **New**: `k8s/README.md` — step-by-step deployment guide including secret creation, image build/push, apply order, troubleshooting, and pre-demo checklist

No existing application code, specs, components, or schema files are modified.

## Capabilities

### New Capabilities

- `docker-build`: Multi-stage Dockerfile that produces a minimal, non-root Next.js standalone image with Prisma client baked in
- `kubernetes-manifests`: Deployment, Service, and Ingress YAML manifests configured for the organizer's cluster, referencing `gap-secrets` for `DATABASE_URL`, `GROQ_API_KEY`, and `GEMINI_API_KEY`
- `deployment-guide`: Operational README with commands for secret creation, image build/push, kubectl apply, verification, and troubleshooting runbook

### Modified Capabilities

_(none — no existing spec requirements are changing)_

## Impact

- **New files only**: `Dockerfile`, `.dockerignore`, `k8s/deployment.yaml`, `k8s/service.yaml`, `k8s/ingress.yaml`, `k8s/README.md`
- **Secrets required**: `gap-secrets` K8s secret with keys `DATABASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`
- **AI providers**: Groq (primary, `GROQ_API_KEY`) + Gemini (fallback, `GEMINI_API_KEY`) — both keys must be in the secret
- **Database**: PostgreSQL with URL-encoded special chars in password (`(` → `%28`, `)` → `%29`, `&` → `%26`, `>` → `%3E`)
- **Registry**: Docker Hub public image (user provides their own username)
- **Cluster**: Organizer-provided namespace `muyung-anak-telyu`, ingress class `nginx`, cert-manager `letsencrypt-prod`
