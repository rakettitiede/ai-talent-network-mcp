# ai-talent-network-mcp

An MCP (Model Context Protocol) server providing privacy-first consultant talent search. Designed as a pilot node for a federated talent network across partner IT companies.

**Core principle:** No personal information is stored or returned. Consultants are represented as anonymous profiles — skills, project history, and availability only.

## Features

- **Anonymous by design** — No names, emails, or PII of any kind in the database
- **Semantic search** — OpenAI embeddings for intelligent candidate matching
- **Skill search** — Exact and fuzzy skill matching with proficiency scores
- **MCP + REST** — Supports both MCP protocol (Claude, Custom GPT) and REST API
- **Custom GPT ready** — OAuth proxy for ChatGPT Actions integration
- **Cloud native** — Runs on Google Cloud Run, database on GCS

## Quick Start

```bash
npm install
export API_KEY=$(openssl rand -hex 32)
export OPENAI_KEY="sk-..."
npm run dev
```

API docs at `http://localhost:8080/api-docs`.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/search` | GET | Search anonymous consultant profiles |
| `/api/v1/fetch` | GET | Get full anonymous profile by ID |
| `/sse` | GET | MCP SSE transport |
| `/api-docs` | GET | Swagger documentation |

Authentication: `X-API-Key` header or `?api_key=` query param, or OAuth Bearer token.

## Documentation

- [Local Development](docs/deployment/local.md)
- [GCP Deployment](docs/deployment/gcp.md)
- [Database Setup](docs/deployment/database.md)
- [Custom GPT Integration](docs/integrations/custom-gpt.md)
- [Architecture Decisions](docs/architecture/adr/)

## Development

```bash
npm test        # Run tests
npm run dev     # Dev server with auto-reload
npm run check-node  # Verify Node version
```

Requires **Node.js v24.12.0**.

## Deployment

```bash
npm version patch -m "fix: description"
git push && git push --tags
```

## License

MIT
