## ADDED Requirements

### Requirement: Deployment manifest runs one replica in the correct namespace
`k8s/deployment.yaml` SHALL define a `apps/v1` Deployment named `gap-api` in namespace `muyung-anak-telyu` with `replicas: 1`. The container MUST reference the Docker Hub image (placeholder `USERNAME/gap:v1`), expose `containerPort: 3000`, and inject `NODE_ENV=production` plus `DATABASE_URL`, `GROQ_API_KEY`, and `GEMINI_API_KEY` from `secretKeyRef` targeting the `gap-secrets` Secret. Resource requests MUST be `256Mi`/`200m` and limits `512Mi`/`500m`. `securityContext.allowPrivilegeEscalation` MUST be `false`.

#### Scenario: Deployment references all required secrets
- **WHEN** `kubectl apply -f k8s/deployment.yaml` is run against the cluster
- **THEN** the Deployment is created and environment variables `DATABASE_URL`, `GROQ_API_KEY`, and `GEMINI_API_KEY` are sourced from the `gap-secrets` Secret

#### Scenario: Health probes are configured
- **WHEN** the pod starts
- **THEN** the readinessProbe (`/api/health`, port 3000, delay 10s, period 5s) prevents traffic until the app is ready, and the livenessProbe (delay 30s, period 10s) restarts unhealthy pods

### Requirement: Service exposes the app on port 80 within the cluster
`k8s/service.yaml` SHALL define a `v1` Service named `gap-api-service` in namespace `muyung-anak-telyu` with type `ClusterIP`, selecting pods labeled `app: gap-api`, and mapping port 80 to targetPort 3000.

#### Scenario: Service routes traffic to the pod
- **WHEN** `kubectl apply -f k8s/service.yaml` is run
- **THEN** in-cluster HTTP requests to `gap-api-service:80` reach the Next.js app on port 3000

### Requirement: Ingress routes external HTTPS traffic with TLS
`k8s/ingress.yaml` SHALL define a `networking.k8s.io/v1` Ingress named `gap-ingress` in namespace `muyung-anak-telyu` using `ingressClassName: nginx`, with annotations `cert-manager.io/cluster-issuer: letsencrypt-prod` and `nginx.ingress.kubernetes.io/ssl-redirect: "true"`. The TLS stanza MUST reference host `muyung-anak-telyu.hackathon.sev-2.com` and secret `gap-tls`. The path rule MUST forward all traffic (`/`, pathType `Prefix`) to `gap-api-service:80`.

#### Scenario: HTTPS traffic reaches the app
- **WHEN** `kubectl apply -f k8s/ingress.yaml` is run and cert-manager issues the certificate
- **THEN** `curl https://muyung-anak-telyu.hackathon.sev-2.com/api/health` returns HTTP 200

#### Scenario: HTTP is redirected to HTTPS
- **WHEN** a request is made over HTTP to the public hostname
- **THEN** nginx redirects to HTTPS automatically
