# GCP Deployment

This guide deploys the service as a Cloud Run instance. Set the variables below once — all commands use them throughout.

> **Shell compatibility:** All commands use plain `$VAR` syntax, compatible with bash, zsh, and fish.

## Variables

```bash
# bash/zsh
export PROJECT_ID=ai-cv-match-471207
export PROJECT_NUMBER=938427813842
export REGION=europe-north1
export SERVICE=mcp-talent-network
export REPO=rakettitiede/ai-talent-network-mcp
export SA=${PROJECT_NUMBER}-compute@developer.gserviceaccount.com
```

```fish
# fish
set PROJECT_ID ai-cv-match-471207
set PROJECT_NUMBER 938427813842
set REGION europe-north1
set SERVICE mcp-talent-network
set REPO rakettitiede/ai-talent-network-mcp
set SA $PROJECT_NUMBER-compute@developer.gserviceaccount.com
```

`SA` is the default Compute Engine service account — automatically created by GCP when Cloud Run is first used in the project. Cloud Run instances run as this account by default, so IAM permissions granted to it apply to the running service.

## Prerequisites

- Workload Identity Pool: `github-pool` (shared with ai-talent-search-mcp — pool and provider already exist)

Authenticate and set the project:

```bash
gcloud auth login
gcloud config set project $PROJECT_ID
```

Verify — expected output: your account email and the project ID:

```bash
gcloud auth list
gcloud config get-value project
```

## First Deploy

Run every command below in order. The sections below this one document each step in detail — this checklist is the shortcut.

```fish
# Set variables once
set PROJECT_ID ai-cv-match-471207
set PROJECT_NUMBER 938427813842
set REGION europe-north1
set SERVICE mcp-talent-network
set REPO rakettitiede/ai-talent-network-mcp
set SA $PROJECT_NUMBER-compute@developer.gserviceaccount.com
```

```fish
# 1. Authenticate
gcloud auth login
gcloud config set project $PROJECT_ID

# 2. Artifact Registry — create Docker repo
gcloud artifacts repositories create $SERVICE   --repository-format=docker   --location=$REGION   --description="Docker repository for $SERVICE"

# 3. Workload Identity — update attribute condition
gcloud iam workload-identity-pools providers update-oidc github-provider   --workload-identity-pool=github-pool   --location=global   --attribute-condition="assertion.repository == 'rakettitiede/mcp-agileday' || assertion.repository == 'rakettitiede/ai-talent-search-pyry' || assertion.repository == '$REPO'"

# 4. Workload Identity — grant IAM permissions
gcloud artifacts repositories add-iam-policy-binding $SERVICE   --location=$REGION   --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO"   --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID   --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO"   --role="roles/run.admin"

gcloud iam service-accounts add-iam-policy-binding $SA   --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO"   --role="roles/iam.serviceAccountUser"

# 5. Vertex AI — grant embedding access
gcloud projects add-iam-policy-binding $PROJECT_ID   --member="serviceAccount:$SA"   --role="roles/aiplatform.user"

# 6. Secret Manager — create secret and grant access
gcloud services enable secretmanager.googleapis.com
echo -n "your-google-client-secret" | gcloud secrets create google-client-secret --data-file=-
gcloud secrets add-iam-policy-binding google-client-secret   --member="serviceAccount:$SA"   --role="roles/secretmanager.secretAccessor"

# 7. GCS Bucket — create and grant access
gcloud storage buckets create gs://ai-talent-network-db   --location=$REGION   --default-storage-class=STANDARD
gcloud storage buckets add-iam-policy-binding gs://ai-talent-network-db   --member="serviceAccount:$SA"   --role="roles/storage.objectAdmin"

# 8. GitHub — set variables
gh variable set NODE_ENV --repo $REPO --body "production"
gh variable set GCS_BUCKET --repo $REPO --body "ai-talent-network-db"
gh variable set AGILEDAY_BASE_URL --repo $REPO --body "https://rakettitiede.agileday.io"
gh variable set GOOGLE_CLIENT_ID --repo $REPO --body "938427813842-64bm1hgthi2ol4cq2aatl7duiqf8e07s.apps.googleusercontent.com"

# 9. GitHub — set secret (interactive prompt)
gh secret set SLACK_BOT_TOKEN --repo $REPO

# 10. Seed the GCS bucket with a development database
# Run tests first to generate the fixture database, then upload it.
# The server needs a valid SQLite file on startup — without this it crashes on first deploy.
# The fixture data lets you verify search works before triggering a real data refresh.
npm test
gcloud storage cp development-db.sqlite gs://ai-talent-network-db/talent-network.sqlite

# 11. Tag and deploy
npm version minor -m "feat: initial release"
git push && git push --tags
```

After deploy completes, the API key arrives via Slack DM. Verify the service works with fixture data first:

```fish
set SERVICE_URL (gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')

# Smoke test with fixture data
curl "$SERVICE_URL/api/v1/search?q=react&api_key=YOUR_API_KEY"

# Once verified, initialize with real data (Marko's Agileday HR token required)
curl -X POST $SERVICE_URL/api/v1/refresh \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_AGILEDAY_HR_TOKEN"}'
```

> The AgileDay token requires HR Admin permissions — only Marko can generate it.

## Artifact Registry

Verify no existing repository first:

```bash
gcloud artifacts repositories list --location=$REGION
```

Create the Docker repository (one-time):

```bash
gcloud artifacts repositories create $SERVICE \
  --repository-format=docker \
  --location=$REGION \
  --description="Docker repository for $SERVICE"
```

## Workload Identity

The workflow authenticates to GCP via Workload Identity Federation — no service account keys needed. This step adds `$REPO` to the provider's attribute condition and grants the repository the IAM permissions it needs during deployment.

> The attribute condition update is additive — existing repositories (`rakettitiede/mcp-agileday` etc.) remain in the condition and their deploys are unaffected.

Update the provider attribute condition to include this repository:

```bash
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --attribute-condition="assertion.repository == 'rakettitiede/mcp-agileday' || assertion.repository == 'rakettitiede/ai-talent-search-pyry' || assertion.repository == '$REPO'"
```

Grant the required IAM permissions:

```bash
# Push images to Artifact Registry
gcloud artifacts repositories add-iam-policy-binding $SERVICE \
  --location=$REGION \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/artifactregistry.writer"

# Deploy to Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/run.admin"

# Act as the Cloud Run service account
gcloud iam service-accounts add-iam-policy-binding $SA \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/iam.serviceAccountUser"
```

## Vertex AI

Grant the Cloud Run service account access to Vertex AI (used for generating embeddings via `text-embedding-005`):

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/aiplatform.user"
```

## Secret Manager

The service requires one secret at runtime:

- `google-client-secret` — Google OAuth client secret (for Custom GPT / OAuth proxy)

### Create secret

```bash
gcloud services enable secretmanager.googleapis.com

echo -n "your-google-client-secret" | gcloud secrets create google-client-secret --data-file=-
```

> **OAuth Setup Note:** When creating the Google OAuth client for the first time, you can leave the "Authorized redirect URIs" empty. Deploy first, get your Cloud Run URL, then add `https://YOUR-CLOUD-RUN-URL/oauth/callback` to the OAuth client.

### Grant Cloud Run service account access

```bash
gcloud secrets add-iam-policy-binding google-client-secret \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor"
```

## GCS Bucket

The production database (`talent-network.sqlite`) is stored in GCS. See [Database Setup](./database.md) for full details.

```bash
gcloud storage buckets create gs://ai-talent-network-db \
  --location=$REGION \
  --default-storage-class=STANDARD

gcloud storage buckets add-iam-policy-binding gs://ai-talent-network-db \
  --member="serviceAccount:$SA" \
  --role="roles/storage.objectAdmin"
```

## GitHub Secrets

Set this in repository settings (Settings → Secrets and variables → Actions → Secrets):

| Secret | Description |
|---|---|
| `SLACK_BOT_TOKEN` | Slack bot token for deploy notifications |

## GitHub Variables

Set these in repository settings (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `GCS_BUCKET` | `ai-talent-network-db` |
| `AGILEDAY_BASE_URL` | Agileday API base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for Custom GPT) |
| `SERVER_URL` | Full base URL for the OpenAPI spec (e.g. `https://my-service.run.app/api/v1`) |
| `PARTNER` | Partner name used to prefix operationIds (e.g. `rakettitiede`, `fraktio`) |

> **2-step deploy:** `SERVER_URL` requires the Cloud Run URL, which is only known after the first deploy. On first deploy, omit it (the spec will use `localhost`). After deploy, set the variable and redeploy.

## Deployment

Triggered automatically by pushing a version tag:

```bash
npm version patch -m "fix: description"
git push && git push --tags
```

The workflow will:
1. Run all tests
2. Generate a new API key automatically
3. Build and push Docker image to Artifact Registry
4. Deploy to Cloud Run
5. Create a GitHub release
6. Send Slack notification

## First Deploy Checklist

After first deploy, the database is empty. Initialize it:

```bash
# Get your Cloud Run URL
gcloud run services describe $SERVICE --region $REGION --format='value(status.url)'

# Call the refresh endpoint to populate the database
curl -X POST https://<your-cloud-run-url>/api/v1/refresh \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_AGILEDAY_HR_TOKEN"}'
```

The API key is auto-generated during deploy — find it in the GitHub release notes or the Slack notification.

> The AgileDay token requires HR Admin permissions. It is passed as a request body parameter only — never stored as an environment variable.

## Monitoring

### View logs

```bash
gcloud run services logs read $SERVICE --region $REGION --limit 50
```

### Health check

```bash
curl https://<your-cloud-run-url>/
```

## Rollback

```bash
gcloud run revisions list --service $SERVICE --region $REGION

gcloud run services update-traffic $SERVICE \
  --region $REGION \
  --to-revisions REVISION_NAME=100
```

## Troubleshooting

**`The given credential is rejected by the attribute condition`**
→ Add `$REPO` to the Workload Identity attribute condition (see above)

**`Permission denied on artifactregistry`**
→ Run the Artifact Registry IAM binding (see above)

**`Permission 'run.services.get' denied`**
→ Run the Cloud Run admin IAM binding (see above)

**`Permission 'iam.serviceaccounts.actAs' denied`**
→ Run the service account user IAM binding (see above)

**Service starts but embeddings fail**
→ Check that the service account has `roles/aiplatform.user` (see Vertex AI section above)

**Database not found on startup**
→ GCS bucket permission issue, or first deploy before refresh has been called. Check logs and run the refresh endpoint.

## Related Documentation

- [Local Development](./local.md)
- [Database Setup](./database.md)
- [Custom GPT Integration](../integrations/custom-gpt.md)
