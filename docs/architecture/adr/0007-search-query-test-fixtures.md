# ADR-0007: Search Query Test Fixtures via TEST_SEARCH_QUERY

## Status
Accepted

## Context

The OpenAI mock server requires pre-captured embedding fixtures for every text that hits the `embed()` function. There are two categories of texts that need fixtures:

1. **Employee/project descriptions** — captured automatically by `capture-refresh-embeddings.mjs` which reads from Agileday fixture JSON files.
2. **Search query strings** (e.g. `react`, `java`, `kubernetes`) — used by integration tests to exercise the search endpoint.

Previously, search queries were defined independently in test files and had to be manually added to the capture script to generate fixtures. Adding a new search query to a test without also capturing its embedding fixture would cause the mock OpenAI server to return a 404, producing cryptic test failures.

## Decision

Use the existing `TEST_CONFIG.TEST_SEARCH_QUERY` object in `test/config.mjs` as the **single source of truth** for all search queries that need embedding fixtures.

- Every search query used in tests lives as a named property in `TEST_SEARCH_QUERY`.
- `test/scripts/capture-refresh-embeddings.mjs` imports `TEST_CONFIG`, extracts all truthy string values from `TEST_SEARCH_QUERY`, normalizes them (lowercase, collapse whitespace, trim — same as `do-search.mjs`), deduplicates, and captures embeddings for each.
- No additional file is needed — the test config already serves as the central place for test constants.

### Workflow for adding a new search query

1. Add a named entry to `TEST_SEARCH_QUERY` in `test/config.mjs`
2. Run `node test/scripts/capture-refresh-embeddings.mjs` with a real `OPENAI_KEY` to capture the fixture
3. Run `node test/scripts/generate-fixture-index.mjs` to regenerate the index
4. Use `TEST_CONFIG.TEST_SEARCH_QUERY.<name>` in test files
5. Run `npm test` to verify

## Consequences

### Positive
- Single source of truth — no separate file to keep in sync
- Capture script automatically picks up new queries from the config
- Familiar pattern — developers already look at `TEST_CONFIG` for test constants
- Pre-test fixture check (`scripts/check-search-fixtures.mjs`, wired into `npm test`) fails fast with a clear cowsay error and remediation steps if any fixture is missing — developers cannot accidentally forget to run the capture script

### Negative
- `TEST_SEARCH_QUERY` values like `notMatches: 'undefined Null'` get normalized by the capture script (lowercase), which is correct but implicit

### Neutral
- Employee/project description embeddings are still derived from Agileday fixture files (unchanged)
- The capture script remains idempotent (skips existing fixtures)
