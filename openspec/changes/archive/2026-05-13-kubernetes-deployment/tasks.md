## 1. Docker Build Configuration

- [x] 1.1 Create `.dockerignore` at project root — exclude `node_modules`, `.next`, `.env*`, `.git`, `.gitignore`, `openspec/`, `tests/`, `**/*.test.ts`, `**/*.spec.ts`, `coverage/`, `dist/`, `build/`, `.turbo/`, `.DS_Store`
- [x] 1.2 Create `Dockerfile` at project root — stage 1 `deps`: `node:20-alpine`, `npm ci --only=production`
- [x] 1.3 Add stage 2 `builder` to `Dockerfile`: `node:20-alpine`, `npm ci`, copy all source, `npx prisma generate`, `npm run build`
- [x] 1.4 Add stage 3 `runner` to `Dockerfile`: `node:20-alpine`, create `nodejs` group + `nextjs` user (uid 1001), set `NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000`, copy standalone output + static + public + prisma, `USER nextjs`, `EXPOSE 3000`, `CMD ["node", "server.js"]`

## 2. Kubernetes Manifests

- [x] 2.1 Create `k8s/` directory
- [x] 2.2 Create `k8s/deployment.yaml` — `apps/v1` Deployment, name `gap-api`, namespace `muyung-anak-telyu`, `replicas: 1`, image `USERNAME/gap:v1` (placeholder), `containerPort: 3000`, env vars from `gap-secrets` (`DATABASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`) + `NODE_ENV=production` + `NEXT_PUBLIC_APP_URL`
- [x] 2.3 Add resource requests/limits to Deployment (`requests: 256Mi/200m`, `limits: 512Mi/500m`) and securityContext (`allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: false`)
- [x] 2.4 Add readinessProbe (`/api/health`, port 3000, delay 10s, period 5s, timeout 3s, failureThreshold 3) and livenessProbe (delay 30s, period 10s, timeout 3s, failureThreshold 3) to Deployment
- [x] 2.5 Add `terminationGracePeriodSeconds: 30` to Deployment pod spec
- [x] 2.6 Create `k8s/service.yaml` — `v1` Service, name `gap-api-service`, namespace `muyung-anak-telyu`, type `ClusterIP`, selector `app: gap-api`, port 80 → targetPort 3000
- [x] 2.7 Create `k8s/ingress.yaml` — `networking.k8s.io/v1` Ingress, name `gap-ingress`, namespace `muyung-anak-telyu`, annotations `cert-manager.io/cluster-issuer: letsencrypt-prod` + `nginx.ingress.kubernetes.io/ssl-redirect: "true"`, `ingressClassName: nginx`, TLS host + secret `gap-tls`, path `/` Prefix → `gap-api-service:80`

## 3. Deployment Guide

- [x] 3.1 Create `k8s/README.md` — Prerequisites section (Docker login, kubeconfig setup, API keys prep)
- [x] 3.2 Add Step 1–7 to README: build image, push image, create `gap-secrets` secret (with URL-encoding map for DB password), apply deployment.yaml, apply service.yaml, apply ingress.yaml, verify pods + test health endpoint
- [x] 3.3 Add Troubleshooting section to README: CrashLoopBackOff diagnosis, update secret + rollout restart, describe pod, logs follow, rollback via `rollout undo`, check ingress TLS status
- [x] 3.4 Add Production Checklist section to README: docker build, image push, secret created, pods running, health 200, DB connected, API keys set, end-to-end feature tests (GitHub URL, paste, folder drop, snippets, features, load time)
