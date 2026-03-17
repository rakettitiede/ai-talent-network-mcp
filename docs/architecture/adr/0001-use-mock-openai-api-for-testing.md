# ADR-0001: Use Mock OpenAI API for Testing

## Status
Accepted

## Context

The test suite required OpenAI API calls for generating embeddings during:
- Database refresh operations (embedding employee and project descriptions)
- Semantic search queries (embedding search terms)

This created several problems:
- Tests consumed production API quota and incurred costs
- Required valid `OPENAI_KEY` environment variable for all test runs
- Made tests slower due to network latency
- Tests could fail due to rate limits or API outages
- CI/CD pipelines required API secrets

## Decision

Implement a mock OpenAI API server with pre-captured embedding fixtures:

1. **Fixture Capture**: One-time capture of real OpenAI API responses during test execution, saved as JSON fixtures with hash-based naming
2. **Mock Server**: Fastify server (`test/openai-api-mock/`) that serves fixtures matching the OpenAI embeddings API format
3. **Configurable Base URL**: `OPENAI_BASE_URL` environment variable in `src/constants.mjs` allows switching between real and mock API
4. **Automatic Integration**: Mock server starts/stops automatically via `test/global-setup.mjs`

### Implementation Details

- Mock server runs on port 3001 (configurable via `OPENAI_MOCK_PORT`)
- Fixtures stored in `test/fixtures/openai-embeddings/`
- Hash function maps input text to fixture files
- Server start order: OpenAI mock (3001) → Agileday mock (3000) → MCP server (8080)

## Consequences

### Positive
- Faster test execution (no network calls)
- Deterministic test results (consistent fixture responses)
- No API costs for test runs
- Tests work offline
- CI/CD pipelines run without external API dependencies

### Negative
- Fixtures may become stale if embedding model changes
- New test scenarios require fixture capture (one-time process with real API)
- Additional infrastructure to maintain (mock server code)

### Neutral
- Fixtures are captured from real API responses, ensuring accuracy at time of capture
