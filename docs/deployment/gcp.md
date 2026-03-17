# GCP Deployment

> **Shell Compatibility:** Commands use bash syntax (`${VAR}`). For fish shell, use `$VAR` without braces.

This guide covers deploying the MCP Talent Network server to Google Cloud Platform (Cloud Run).

## Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Docker or Podman installed (for manual deployment)
- GitHub repository access (for automated deployment)

## Workload Identity Federation Setup

GitHub Actions authenticates to GCP using Workload Identity Federation (no service account keys needed).

### First Repository in Project

If this is the first service deploying to this GCP project:
```bash
# 1. Create pool (one-time)
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

# 2. Create provider with your repository
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == 'rakettitiede/mcp-talent-network'"
```

### Adding Additional Repository

If pool already exists:
```bash
# Update attribute condition to include new repo
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --attribute-condition="assertion.repository == 'rakettitiede/mcp-talent-network' || assertion.repository == 'rakettitiede/raketti-bi'"
```

### Grant Required Permissions
```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# 1. Artifact Registry push permission
gcloud artifacts repositories add-iam-policy-binding mcp-talent-network \
  --location=europe-north1 \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/rakettitiede/mcp-talent-network" \
  --role="roles/artifactregistry.writer"

# 2. Cloud Run admin permission
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/rakettitiede/mcp-talent-network" \
  --role="roles/run.admin"

# 3. Service account user permission
gcloud iam service-accounts add-iam-policy-binding ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/rakettitiede/mcp-talent-network" \
  --role="roles/iam.serviceAccountUser"
```

Replace `PROJECT_ID` with your GCP project ID.

## Artifact Registry Repository

Create the Docker repository (one-time per service):
```bash
gcloud artifacts repositories create mcp-talent-network \
  --repository-format=docker \
  --location=europe-north1 \
  --description="Docker repository for mcp-talent-network"
```

## Secret Management

Only two secrets are managed via GCP Secret Manager:
- `openai-key` - OpenAI API key for embeddings
- `google-client-secret` - Google OAuth client secret (for Custom GPT)

### Prerequisites

Enable Secret Manager API:

```bash
gcloud services enable secretmanager.googleapis.com
```

### Create Secrets

```bash
# Create secrets in Secret Manager
echo -n "your-openai-key" | gcloud secrets create openai-key --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create google-client-secret --data-file=-
```

**OAuth Setup Note:** When creating the Google OAuth client for the first time, you can leave the "Authorized redirect URIs" empty. Deploy first, get your Cloud Run URL, then add `https://YOUR-CLOUD-RUN-URL/oauth/callback` to the OAuth client.

### Grant Cloud Run Access

Cloud Run services run under a service account that needs explicit IAM permissions to access secrets. Without these permissions, the service will start but fail at runtime when trying to read secret values—the environment variables will be `undefined` even though the secrets exist in Secret Manager.

**Grant the `secretmanager.secretAccessor` role to your Cloud Run service account:**

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

for SECRET in openai-key google-client-secret; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

Or grant access to each secret individually:

```bash
# Grant access to OpenAI API key secret
gcloud secrets add-iam-policy-binding openai-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project PROJECT_ID

# Grant access to Google OAuth client secret
gcloud secrets add-iam-policy-binding google-client-secret \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project PROJECT_ID
```

**Finding your service account:**

If you're unsure which service account your Cloud Run service uses:

```bash
gcloud run services describe mcp-talent-network \
  --region europe-north1 \
  --project PROJECT_ID \
  --format="value(spec.template.spec.serviceAccountName)"
```

If this returns empty, the service uses the default Compute Engine service account: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`.

> **Troubleshooting: "Missing credentials" or undefined secrets**
>
> If your service fails with errors like `OPENAI_KEY is undefined` or "Missing credentials" despite secrets being configured in the workflow, the most likely cause is missing IAM permissions. The secrets exist in Secret Manager, but Cloud Run doesn't have permission to read them. Run the IAM binding commands above to fix this.

### Rotating Secrets

Update secrets without redeploying:

```bash
# Add new secret version
echo -n "new-openai-key" | gcloud secrets versions add openai-key --data-file=-

# Cloud Run automatically uses :latest version
```

## Deployment Methods

### Automated Deployment (Recommended)

Deployment is automated via GitHub Actions. Use `npm version` to bump the version and create a tag:

```bash
# For bug fixes (1.0.0 → 1.0.1)
npm version patch -m "fix: your fix description"

# For new features (1.0.0 → 1.1.0)
npm version minor -m "feat: your feature"

# For breaking changes (1.0.0 → 2.0.0)
npm version major -m "feat!: breaking change"

# Push commit and tag to trigger deployment
git push && git push --tags
```

The workflow will:
1. Run all tests (quality assurance)
2. Generate a new API key automatically
3. Build and push Docker image
4. Deploy to Google Cloud Run
5. Create a GitHub release with release notes
6. Send Slack notification with new API key and deployment details

### Manual Deployment

For troubleshooting or when GitHub Actions is unavailable:

```bash
# 1. Generate a new API key
export API_KEY=$(openssl rand -hex 32)

# 2. Build the container image
podman build -f Containerfile -t gcr.io/ai-cv-match-471207/mcp-talent-network .

# 3. Push to Google Container Registry
podman push gcr.io/ai-cv-match-471207/mcp-talent-network

# 4. Deploy to Cloud Run
gcloud run deploy mcp-talent-network \
  --image gcr.io/ai-cv-match-471207/mcp-talent-network \
  --platform managed \
  --region europe-north1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,GCS_BUCKET=$GCS_BUCKET,AGILEDAY_BASE_URL=$AGILEDAY_BASE_URL,API_KEY=$API_KEY \
  --set-secrets OPENAI_KEY=openai-key:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest \
  --port 8080
```

## GitHub Actions Workflows

### Workflow Files

| Workflow | File | Trigger |
|----------|------|---------|
| Quality Assurance | `quality-assurance.yml` | Reusable, called by others |
| Test on PR | `run-tests.yml` | Pull requests |
| Deploy to Cloud Run | `google-cloudrun-docker.yml` | Tag pushes |
| Create Release | `release.yml` | After successful deployment |
| Slack Notification | `slack-deploy-notify.yml` | After release creation |

### Required GitHub Secrets

Configure these in your repository settings (Settings → Secrets and variables → Actions):

**Secrets:**
| Secret | Description |
|--------|-------------|
| `SLACK_WEBHOOK_URL` | Slack webhook for channel deployment notifications |
| `SLACK_BOT_TOKEN` | Slack bot token for private DM notifications (starts with `xoxb-`) |

**Note:** Both Slack secrets are required. `SLACK_WEBHOOK_URL` posts to a channel, while `SLACK_BOT_TOKEN` sends private DMs with API keys. Get the bot token from your Slack app's "OAuth & Permissions" page (Bot User OAuth Token). The bot needs `chat:write` and `users:read` scopes.

> **Note:** Sensitive API keys (`OPENAI_KEY`, `GOOGLE_CLIENT_SECRET`) are now stored in GCP Secret Manager. See [Secret Management](#secret-management) for setup instructions.

**Variables:**
| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Environment mode (e.g., "production") |
| `GCS_BUCKET` | Google Cloud Storage bucket name |
| `AGILEDAY_BASE_URL` | Base URL of your Agileday instance |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for Custom GPT) |

## Environment Variables

### Production Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | Yes | Authentication key (auto-generated in CI) |
| `AGILEDAY_BASE_URL` | Yes | Agileday API base URL |
| `OPENAI_KEY` | Yes | OpenAI API key for embeddings |
| `GCS_BUCKET` | Yes | GCS bucket for database storage |
| `NODE_ENV` | Yes | Set to "production" |
| `PORT` | No | Server port (default: 8080) |
| `GOOGLE_CLIENT_ID` | For OAuth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For OAuth | Google OAuth client secret |

> For complete variable reference and behavior details, see [Database Setup - Environment Variables](./database.md#environment-variables).

### Setting Environment Variables

Via `gcloud`:
```bash
gcloud run services update mcp-talent-network \
  --region europe-north1 \
  --set-env-vars KEY=value
```

Via GitHub Actions (recommended):
- Add secrets/variables in GitHub repository settings
- They're automatically passed during deployment

## GCS Bucket Setup

The production database is stored in Google Cloud Storage. See [Database Setup](./database.md#gcs-bucket-setup) for detailed instructions.

Quick setup:
```bash
# Create bucket
gcloud storage buckets create gs://your-mcp-database-bucket \
  --location=europe-north1 \
  --default-storage-class=STANDARD

# Grant Cloud Run service account access
gcloud storage buckets add-iam-policy-binding gs://your-mcp-database-bucket \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

## Admin-Only Operations

### Database Refresh Endpoint

The `/api/v1/refresh` endpoint rebuilds the database from AgileDay API. This is NOT part of automated deployment.

**Usage:**

```bash
# Get your Cloud Run URL
gcloud run services describe mcp-talent-network --region europe-north1 --format='value(status.url)'

# Call refresh endpoint
curl -X POST https://mcp-talent-network-[hash].run.app/api/v1/refresh \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token": "HR_ADMIN_AGILEDAY_TOKEN"}'
```

**Authorization:**
- Requires valid `API_KEY` (rotates with each deployment)
- Requires AgileDay token with HR Admin permissions (passed as body parameter)
- Token is NOT stored in environment variables - only passed when calling the endpoint

**When to refresh:**
- After first deployment (database initialization)
- New employees/recruits added to AgileDay
- Profile or skills updated
- After deployment if data is stale

## Monitoring

### View Logs

```bash
gcloud run services logs read mcp-talent-network --region europe-north1
```

### Health Check

```bash
curl https://your-cloud-run-url/
```

Expected response:
```json
{
  "ok": true,
  "service": "mcp-talent-network",
  "version": "X.Y.Z",
  "endpoints": {
    "sse": "/sse",
    "messages": "/messages",
    "rest-api": "/api/v1/",
    "rest-api-docs": "/api-docs",
    "openapi-json": "/openapi.json",
    "oauth": "/oauth"
  }
}
```

### View Service Details

```bash
gcloud run services describe mcp-talent-network --region europe-north1
```

## Rollback

To rollback to a previous revision:

```bash
# List revisions
gcloud run revisions list --service mcp-talent-network --region europe-north1

# Route traffic to specific revision
gcloud run services update-traffic mcp-talent-network \
  --region europe-north1 \
  --to-revisions REVISION_NAME=100
```

## Scaling

Cloud Run automatically scales based on traffic. To configure:

```bash
gcloud run services update mcp-talent-network \
  --region europe-north1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80
```

## Troubleshooting

### Permission Errors

**Error: `The given credential is rejected by the attribute condition`**
- **Cause:** Repository not in Workload Identity Pool
- **Fix:** Update attribute condition to include your repository (see Workload Identity section above)

**Error: `Permission denied on artifactregistry`**
- **Cause:** Missing Artifact Registry push permission
- **Fix:** Run the Artifact Registry IAM binding from Workload Identity section

**Error: `Permission 'run.services.get' denied`**
- **Cause:** Missing Cloud Run permission
- **Fix:** Run the Cloud Run admin IAM binding from Workload Identity section

**Error: `Permission 'iam.serviceaccounts.actAs' denied`**
- **Cause:** Missing service account user permission
- **Fix:** Run the service account IAM binding from Workload Identity section

### Test Failures

**Test expects different version:**
- **Error:** `Expected '0.1.0' but got '0.1.0-alpha.1'`
- **Fix:** Update test to read version dynamically from `package.json`

### Re-run Failed Jobs
```bash
# Re-run only failed jobs (faster)
gh run rerun <RUN_ID> --failed
```

### Deployment Fails

Check GitHub Actions logs for detailed error messages. Common issues:
- Missing secrets/variables
- GCP authentication issues
- Build failures

### Service Not Starting

Check Cloud Run logs:
```bash
gcloud run services logs read mcp-talent-network --region europe-north1 --limit 50
```

Common issues:
- Missing environment variables
- GCS bucket permissions
- Database not found (run refresh endpoint)

### OAuth Not Working

The OAuth proxy uses in-memory storage. For multiple Cloud Run instances, requests to `/oauth/callback` and `/oauth/token` must hit the same instance. This works for low-traffic Custom GPT usage.

For high-scale scenarios, consider:
- Using Cloud Run session affinity
- Implementing external storage (Redis/Firestore)

### Database Issues

See [Database Setup - Troubleshooting](./database.md#troubleshooting).

## Security Considerations

- API keys are auto-generated during CI deployment
- Sensitive credentials stored in GCP Secret Manager (rotation without redeploy, audit logs)
- Use Workload Identity Federation (no service account keys)
- OAuth tokens validated against Google's tokeninfo endpoint
- Consider enabling Cloud Run authentication for additional security

## Cost Optimization

- Cloud Run scales to zero when not in use
- Set appropriate `max-instances` limit
- Use `--cpu-throttling` for non-latency-sensitive workloads
- Monitor usage in Cloud Console

## Related Documentation

- [Local Development](./local.md) - Set up local environment
- [Database Setup](./database.md) - Database configuration and GCS
- [Custom GPT Integration](../integrations/custom-gpt.md) - ChatGPT setup
