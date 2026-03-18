# Local Development Setup

## Prerequisites

- **Node.js v24.12.0** — strictly enforced by all npm scripts
- Access to Rakettitiede's Agileday API (for database refresh)
- GCP Application Default Credentials (for Vertex AI embeddings)

## Installation

```bash
git clone git@github.com:rakettitiede/ai-talent-network-mcp.git
cd ai-talent-network-mcp
npm install
```

## Environment Variables

```bash
export API_KEY=$(openssl rand -hex 32)
export AGILEDAY_BASE_URL="https://your-agileday-instance.com"

# Optional — OAuth proxy for Custom GPT
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

> `GCP_PROJECT_ID` and `GCP_LOCATION` default to `ai-cv-match-471207` and `europe-north1` — no need to set them locally.

## Vertex AI (Embeddings)

Vertex AI uses Application Default Credentials — no API key needed:

```bash
gcloud auth application-default login
```

## Run the Server

```bash
npm run dev
```

## Initialize the Database

On first run the database is empty. Call the refresh endpoint to populate it:

```bash
curl -X POST http://localhost:8080/api/v1/refresh \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_AGILEDAY_HR_TOKEN"}'
```

This fetches data from Agileday, generates embeddings via Vertex AI, and writes `development-db.sqlite`.

## Run Tests

Tests use mock servers for both Agileday API and Vertex AI — no real credentials needed:

```bash
npm test
```

To capture new embedding fixtures (needed when adding new test queries):

```bash
gcloud auth application-default login
node test/scripts/capture-refresh-embeddings.mjs
node test/scripts/generate-fixture-index.mjs
```

## Verify the Database

```bash
sqlite3 development-db.sqlite

.tables
# employees  employee_skills  employee_certificates
# project_history  openings  vec_employees  vec_projects  employee_availability

SELECT COUNT(*) FROM employees;
SELECT COUNT(*) FROM vec_employees;
.quit
```

## Related Documentation

- [GCP Deployment](./gcp.md)
- [Database Setup](./database.md)
