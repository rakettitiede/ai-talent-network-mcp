# ADR-0002: Refresh Test Fixture-Based Embeddings

## Status
Accepted

## Context

**Test Infrastructure Misalignment**:
- Other tests (search, fetch) already use mock OpenAI API with pre-captured fixtures ✅
- Refresh test was misaligned - it expected/required real OpenAI API ❌
- This created inconsistency: some tests use mock, refresh test uses real API

**Refresh Test Behavior**:
- Refresh test (`test/integration/do-refresh.test.mjs`) calls `/api/v1/refresh` endpoint
- Refresh endpoint calls `updateDatabase()` which:
  - Fetches data from Agileday API (already mocked) ✅
  - Generates embeddings via OpenAI API (was expecting real API, not mock) ❌
  - Populates SQLite database

**Database Population in Parallel Tests**:
- `npm test` runs tests in parallel
- Refresh test needs database to be populated before it runs
- Database population happens during refresh endpoint execution
- Need to separate: database setup (once) vs endpoint testing (many times)
- Database file (`development-db.sqlite`) was being overwritten on each test run and tracked in git

## Decision

**Align refresh test with other tests** to use mock OpenAI API exclusively:

1. **Standalone Capture Script**: Create `test/scripts/capture-refresh-embeddings.mjs` that reads Agileday fixtures and calls OpenAI API directly to generate fixtures (no server/test execution needed)
2. **Move Database Setup**: Database population happens in `global-setup.mjs` before all tests run (calls refresh endpoint with mock APIs)
3. **Simplify Refresh Test**: Refresh test only verifies endpoint behavior (400 errors, API key auth) - database integrity tested indirectly through other tests
4. **Fixture-Based Embeddings**: Use fixture-based embeddings for refresh operations (captured via standalone script)
5. **Database File Management**: Add `*.sqlite` to `.gitignore` and remove `development-db.sqlite` from git tracking

### Implementation Details

- Capture script processes Agileday fixtures directly (employee `externalDescription`, project `description`)
- Script is idempotent (skips existing fixtures)
- Database populated once in `global-setup.mjs` via refresh endpoint (e2e test)
- Mock OpenAI API serves refresh embeddings from fixtures
- Refresh test renamed to `do-refresh.test.mjs` to match naming pattern and be automatically included in `npm test`

## Consequences

### Positive
- Tests run faster and more reliably
- Tests work in parallel execution
- No external API dependencies for refresh test
- Consistent with other tests using fixture-based embeddings
- Database setup happens once, reducing test execution time
- Database files no longer tracked in git (generated artifacts)

### Negative
- Database setup happens once, can't test refresh endpoint's database population directly in refresh test
- Requires one-time capture of embeddings from real API
- Refresh functionality tested indirectly through other tests (do-fetch.test.mjs, do-search.test.mjs)

### Neutral
- Refresh functionality still tested indirectly through other tests
- Database population logic remains the same, just called from different location
- Capture script remains as utility for future use
