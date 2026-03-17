# Local Development Setup

This guide covers setting up the MCP Talent Network server for local development.

## Prerequisites

- **Node.js v24.12.0** (LTS) - strictly enforced
- Access to Rakettitiede's Agileday API
- OpenAI API key for embeddings

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd talent-network
npm install
```

### 2. Set Up Node.js Version

The project requires Node.js v24.12.0. All npm scripts automatically verify this version.

```bash
# Use nvm to switch to the correct version (recommended)
nvm use

# Or manually check your version
node --version  # Should be v24.12.0

# Manually verify version requirement
npm run check-node
```

If the version doesn't match, scripts will fail with a clear error message prompting you to run `nvm use`.

### 3. Configure Environment Variables

Set environment variables in your shell:

```bash
export API_KEY=$(openssl rand -hex 32)
export AGILEDAY_BASE_URL="https://your-agileday-instance.com"
export OPENAI_KEY="your-openai-api-key"

# Optional (for OAuth)
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**Production (GCP)** uses Secret Manager - see [GCP Deployment Guide](gcp.md#secret-management).

**Optional:** If you prefer `.env` files, you can create one (requires `dotenv` package or Node.js v20.6+):

```env
# Required
API_KEY=your-secure-api-key
AGILEDAY_BASE_URL=https://your-agileday-instance.com
OPENAI_KEY=your-openai-api-key

# Optional
PORT=8080
NODE_ENV=development

# OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

> **Note:** This project doesn't include `dotenv` by default. Environment variables are the recommended approach.

> For complete variable reference, see [Database Setup - Environment Variables](./database.md#environment-variables).

### 4. Initialize the Database

The database is created via the refresh endpoint. See [Database Setup](./database.md) for detailed instructions.

Quick start:

```bash
# Start the server
npm run dev

# In another terminal, initialize the database
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"token": "your-agileday-hr-token"}' \
  "http://localhost:8080/api/v1/refresh"
```

> **Note:** The AgileDay token is only needed when calling the `/refresh` endpoint. It's not part of normal server operation and is passed as a request body parameter, not an environment variable.

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server starts on `http://localhost:8080` by default.

## Available Endpoints

Once running, the server exposes:

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check |
| `GET /api-docs` | Swagger UI documentation |
| `GET /openapi.json` | OpenAPI specification |
| `GET /api/v1/search?q=...` | Search candidates/projects |
| `GET /api/v1/fetch?id=...` | Fetch candidate/project details |
| `POST /api/v1/refresh` | Refresh database from Agileday |
| `GET /sse` | MCP SSE transport |
| `POST /messages` | MCP message handler |

## Running Tests

```bash
npm test
```

For detailed testing guidelines, see [Testing in CONTRIBUTING.md](../../CONTRIBUTING.md#testing).

## Verify Installation

After setup, verify everything works:

```bash
# Check server health
curl http://localhost:8080/

# Run test suite
npm test
```

## Development Workflow

1. Start the dev server: `npm run dev`
2. Make code changes (server auto-reloads)
3. Run tests: `npm test`
4. Commit and push

### Database Changes

If you modify database schema (`migrations/*.sql`):

1. Delete local database: `rm development-db.sqlite`
2. Run migrations: `npm run migrate`
3. Restart server and run refresh endpoint if needed
4. Update tests if needed

## Troubleshooting

### Node Version Mismatch

```
Error: Node version v20.x.x does not match required version v24.12.0
```

**Solution**: Run `nvm use` or install Node.js v24.12.0.

### Database Not Found

```
⛲ DB not found skipping database check
```

**Solution**: Run the refresh endpoint to initialize the database.

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::8080
```

**Solution**: Kill the existing process or change `PORT` in your environment.

### OpenAI API Errors

```
Error: 401 Unauthorized
```

**Solution**: Verify your `OPENAI_KEY` has embeddings access. See [Database Setup](./database.md#troubleshooting) for details.

## Next Steps

- [Database Setup](./database.md) - Detailed database configuration
- [GCP Deployment](./gcp.md) - Deploy to production
- [Custom GPT Integration](../integrations/custom-gpt.md) - Set up ChatGPT integration
