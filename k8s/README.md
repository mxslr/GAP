# Deployment Guide — GAP

Deploy the GAP app to the organizer Kubernetes cluster at `muyung-anak-telyu.hackathon.sev-2.com`.

---

## Prerequisites

- **Docker** installed and logged in to Docker Hub:
  ```bash
  docker login
  ```
- **kubectl** configured with the organizer's kubeconfig:
  ```bash
  export KUBECONFIG=./kubeconfig.yaml
  # or pass --kubeconfig=./kubeconfig.yaml to every kubectl command
  ```
- **API keys** ready:
  - `GROQ_API_KEY` — from console.groq.com
  - `GEMINI_API_KEY` — from aistudio.google.com
- **DATABASE_URL** ready — PostgreSQL connection string from organizer (see URL-encoding note below)

---

## URL-Encoding for DATABASE_URL

The organizer PostgreSQL password contains special characters. They **must** be URL-encoded in `DATABASE_URL`:

| Character | Encoded |
|-----------|---------|
| `(`       | `%28`   |
| `)`       | `%29`   |
| `&`       | `%26`   |
| `>`       | `%3E`   |

Example:
```
# Raw password: pass(word)&test>1
# Encoded in URL: pass%28word%29%26test%3E1
DATABASE_URL=postgresql://user:pass%28word%29%26test%3E1@host:5432/dbname
```

---

## Step 1 — Build and Push Docker Image

```bash
# Replace USERNAME with your Docker Hub username (e.g., muyung)
docker build -t USERNAME/gap:v1 .
docker push USERNAME/gap:v1
```

Then update the image in the deployment manifest:
```bash
# Edit k8s/deployment.yaml — change this line:
#   image: USERNAME/gap:v1
# to your actual image, e.g.:
#   image: muyung/gap:v1
```

---

## Step 2 — Create Kubernetes Secret

```bash
kubectl --kubeconfig=./kubeconfig.yaml create secret generic gap-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass%28word%29@host:5432/dbname' \
  --from-literal=GROQ_API_KEY='gsk_...' \
  --from-literal=GEMINI_API_KEY='AIzaSy...' \
  -n muyung-anak-telyu
```

> Wrap each value in single quotes to prevent shell expansion of special characters.

---

## Step 3 — Apply Deployment

```bash
kubectl --kubeconfig=./kubeconfig.yaml apply -f k8s/deployment.yaml
```

---

## Step 4 — Apply Service

```bash
kubectl --kubeconfig=./kubeconfig.yaml apply -f k8s/service.yaml
```

---

## Step 5 — Apply Ingress

```bash
kubectl --kubeconfig=./kubeconfig.yaml apply -f k8s/ingress.yaml
```

---

## Step 6 — Verify Deployment

```bash
kubectl --kubeconfig=./kubeconfig.yaml get pods -n muyung-anak-telyu -w
```

Wait for status to change from `ContainerCreating` → `Running`. This typically takes 30–60 seconds.

---

## Step 7 — Test the Endpoint

```bash
curl https://muyung-anak-telyu.hackathon.sev-2.com/api/health
```

Expected response: `{"status":"ok"}` with HTTP 200. If you see this, the deployment is live.

---

## Troubleshooting

### Pod not starting (CrashLoopBackOff / Error)

View logs to diagnose:
```bash
kubectl --kubeconfig=./kubeconfig.yaml logs -n muyung-anak-telyu -l app=gap-api --tail=100
```

Common causes:
- `DATABASE_URL` has unencoded special chars → re-create secret with correct URL-encoding
- `GROQ_API_KEY` or `GEMINI_API_KEY` missing or invalid → re-create secret
- Port conflict (unlikely in K8s) → check if containerPort 3000 is correct

### Update a secret and restart

```bash
# Delete old secret
kubectl --kubeconfig=./kubeconfig.yaml delete secret gap-secrets -n muyung-anak-telyu

# Re-create with correct values
kubectl --kubeconfig=./kubeconfig.yaml create secret generic gap-secrets \
  --from-literal=DATABASE_URL='...' \
  --from-literal=GROQ_API_KEY='...' \
  --from-literal=GEMINI_API_KEY='...' \
  -n muyung-anak-telyu

# Restart the deployment to pick up new secret values
kubectl --kubeconfig=./kubeconfig.yaml rollout restart deployment/gap-api -n muyung-anak-telyu
```

### Describe a pod (full event log)

```bash
kubectl --kubeconfig=./kubeconfig.yaml describe pod -n muyung-anak-telyu -l app=gap-api
```

### Follow logs in real-time

```bash
kubectl --kubeconfig=./kubeconfig.yaml logs -f -n muyung-anak-telyu -l app=gap-api
```

### Restart the deployment

```bash
kubectl --kubeconfig=./kubeconfig.yaml rollout restart deployment/gap-api -n muyung-anak-telyu
```

### Rollback to previous version

```bash
# View rollout history
kubectl --kubeconfig=./kubeconfig.yaml rollout history deployment/gap-api -n muyung-anak-telyu

# Rollback one version
kubectl --kubeconfig=./kubeconfig.yaml rollout undo deployment/gap-api -n muyung-anak-telyu
```

### Check ingress and TLS status

```bash
kubectl --kubeconfig=./kubeconfig.yaml get ingress -n muyung-anak-telyu
kubectl --kubeconfig=./kubeconfig.yaml describe ingress gap-ingress -n muyung-anak-telyu
```

If TLS is not ready, cert-manager may still be issuing the certificate. Wait 2–5 minutes and re-check. Look for `Certificate issued` in the describe output.

---

## Production Checklist Before Judge Demo

Run through this list before the demo. Every item should be green.

- [ ] `docker build -t USERNAME/gap:v1 .` completes without error
- [ ] `docker push USERNAME/gap:v1` succeeds
- [ ] `kubectl get secret gap-secrets -n muyung-anak-telyu` shows the secret exists
- [ ] `kubectl get pods -n muyung-anak-telyu` shows pod status `Running`
- [ ] `curl https://muyung-anak-telyu.hackathon.sev-2.com/api/health` returns HTTP 200
- [ ] DB connected: `kubectl logs -n muyung-anak-telyu -l app=gap-api | grep -i prisma` — no connection errors
- [ ] AI keys set: `kubectl get secret gap-secrets -n muyung-anak-telyu -o jsonpath='{.data}' | python3 -c "import sys,json,base64; d=json.load(sys.stdin); [print(k) for k in d]"` — shows all 3 keys
- [ ] Test: paste GitHub URL → routes detected successfully
- [ ] Test: paste code directly → routes detected successfully
- [ ] Test: drop/upload folder → routes detected successfully
- [ ] Test: fetch snippets generated without error
- [ ] Test: feature classification shows meaningful groups
- [ ] Load time < 30 seconds for a normal-sized repo
