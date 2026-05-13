## ADDED Requirements

### Requirement: README provides complete step-by-step deployment instructions
`k8s/README.md` SHALL include: prerequisites (Docker login, kubeconfig setup, API keys), step-by-step commands for building and pushing the Docker image, creating the `gap-secrets` K8s Secret with all three keys, applying all three manifests in order, verifying pod readiness, and testing the health endpoint. The README MUST document the URL-encoding requirement for special characters in `DATABASE_URL` (`(→%28`, `)→%29`, `&→%26`, `>→%3E`).

#### Scenario: Teammate can deploy without prior K8s knowledge
- **WHEN** a teammate reads `k8s/README.md` and follows the steps sequentially
- **THEN** the application is running and accessible at the public URL without needing additional guidance

#### Scenario: DATABASE_URL encoding is documented
- **WHEN** a teammate sets up the `gap-secrets` Secret
- **THEN** the README clearly shows the URL-encoding map so the connection string is valid

### Requirement: README includes a troubleshooting runbook
`k8s/README.md` SHALL include a Troubleshooting section covering: how to view pod logs, how to describe a pod, how to update a secret and restart the deployment, how to rollback, and how to check ingress TLS status.

#### Scenario: Pod in CrashLoopBackOff
- **WHEN** a pod fails to start
- **THEN** the README provides the exact `kubectl logs` command to diagnose the error

### Requirement: README includes a pre-demo production checklist
`k8s/README.md` SHALL include a checklist section with items covering: successful Docker build, successful image push, Secret created, pods running, health check returning 200, database connected (log grep), API keys present in secret, and end-to-end feature tests (GitHub URL upload, paste, folder drop, snippets, feature classification, load time).

#### Scenario: Demo readiness verification
- **WHEN** the team runs through the checklist before the judge demo
- **THEN** all items can be verified with the provided commands and the team has confidence the demo will succeed
