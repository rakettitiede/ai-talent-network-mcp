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

`SA` is the default Compute Engine service account — automatically created by GCP when Cloud Run is first used in the project. Cloud Run instances run as this account by default.

## Prerequisites

- Workload Identity Pool: `github-pool` (shared across all Rakettitiede services — pool and provider already exist)

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

The workflow authenticates to GCP via Workload Identity Federation — no service account keys needed. Add this repo to the provider's attribute condition and grant the required IAM permissions.

> The attribute condition update is additive — existing repositories remain in the condition and their deploys are unaffected.

### Update attribute condition

```bash
# Get current condition first
gcloud iam workload-identity-pools providers describe github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --format="value(attributeCondition)"

# Add this repo to the condition (replace the full condition string)
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --attribute-condition="assertion.repository == 'rakettitiede/mcp-agileday' || assertion.repository == 'rakettitiede/ai-talent-search-pyry' || assertion.repository == 'rakettitiede/ai-talent-network-mcp'"
```

### Grant IAM permissions

```bash
# 1. Artifact Registry push permission
gcloud artifacts repositories add-iam-policy-binding $SERVICE \
  --location=$REGION \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/artifactregistry.writer"

# 2. Cloud Run admin permission
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/run.admin"

# 3. Service account user permission
gcloud iam service-accounts add-iam-policy-binding $SA \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/iam.serviceAccountUser"
```

## Secret Management

One secret is managed via GCP Secret Manager:

| Secret name | Description |
|---|---|
| `google-client-secret` | Google OAuth client secret (for Custom GPT / OAuth proxy) |

> **Note:** No API key secret is needed for embeddings — Vertex AI uses Application Default Credentials provided automatically by Cloud Run.

### Create secret

```bash
gcloud services enable secretmanager.googleapis.com

echo -n "your-google-client-secret" | gcloud secrets create google-client-secret --data-file=-
```

### Grant Cloud Run access to secrets

```bash
gcloud secrets add-iam-policy-binding google-client-secret \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor"
```

## GCS Bucket

The production database (`talent-network.sqlite`) is stored in GCS. See [Database Setup](./database.md) for full details.

Quick setup:

```bash
# Create bucket
gcloud storage buckets create gs://ai-talent-network-db \
  --location=$REGION \
  --default-storage-class=STANDARD

# Grant Cloud Run service account access
gcloud storage buckets add-iam-policy-binding gs://ai-talent-network-db \
  --member="serviceAccount:$SA" \
  --role="roles/storage.objectAdmin"
```

## GitHub Repository Setup

### Secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Description |
|---|---|
| `SLACK_BOT_TOKEN` | Slack bot token for deploy notifications |

### Variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `GCS_BUCKET` | `ai-talent-network-db` (or your bucket name) |
| `AGILEDAY_BASE_URL` | Agileday API base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for Custom GPT) |

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

The API key is auto-generated during deploy. Find it in the GitHub release notes or the Slack notification.

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

Expected response:

```json
{
  "ok": true,
  "service": "mcp-talent-network",
  "version": "X.Y.Z"
}
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
→ Vertex AI uses ADC — no extra credentials needed on Cloud Run. Check that the service account has `roles/aiplatform.user` if Vertex AI calls fail:
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/aiplatform.user"
```

**Database not found on startup**
→ GCS bucket permission issue, or first deploy before refresh has been called. Check logs and run refresh endpoint.

```bash
gcloud run services logs read $SERVICE --region $REGION --limit 50
```

## Related Documentation

- [Local Development](./local.md)
- [Database Setup](./database.md)
- [Custom GPT Integration](../integrations/custom-gpt.md)
