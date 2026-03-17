# Contributing to MCP Talent Network

Thank you for your interest in contributing! This guide will help you get started.

> **AI Assistants:** Read [`.aicontext`](/.aicontext) for project context and workflow rules.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Set up Node.js v24.12.0 (use `nvm use`)
5. Run tests: `npm test`

See [Local Development](docs/deployment/local.md) for detailed setup instructions.

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `npm test`
4. Commit with conventional commit messages (see below)
5. Push and create a pull request

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new search filter
fix: correct embedding dimension
docs: update deployment guide
test: add OAuth endpoint tests
refactor: simplify ResultsMap logic
```

## Documentation Guidelines

### Documentation Structure

```
README.md                    # Landing page - overview and links only
CONTRIBUTING.md              # This file
docs/
├── architecture/
│   └── adr/                 # Architecture Decision Records
├── deployment/              # Deployment and setup guides
└── integrations/            # External system integrations
```

### Where to Add New Documentation

| Type | Location | Example |
|------|----------|---------|
| Deployment/setup guide | `docs/deployment/` | Database setup, local dev, Cloud Run |
| Integration guide | `docs/integrations/` | Custom GPT, external APIs |
| Architecture decision | `docs/architecture/adr/` | Design choices, trade-offs |

### Documentation Rules

1. **Keep README.md brief** - It's a landing page with links, not detailed documentation
2. **New docs go in `docs/`** - Not at root level (except README.md, CONTRIBUTING.md)
3. **Use relative links** - Link between docs using relative paths (e.g., `../deployment/local.md`)
4. **Update the index** - When adding ADRs, update `docs/architecture/adr/README.md`

### Creating an Architecture Decision Record (ADR)

For significant technical decisions, create an ADR:

1. Check the next available number in `docs/architecture/adr/`
2. Create `NNNN-short-title.md` using the template in `docs/architecture/adr/README.md`
3. Add entry to the ADR index table in `docs/architecture/adr/README.md`

Example ADR topics:
- New dependencies or frameworks
- Database schema changes
- API design decisions
- Testing strategy changes

## Code Style

- **Use ES modules** (`.mjs` extension) for all JavaScript files
- **Self-documenting code**: Function and variable names should clearly express intent
- **Small, focused functions**: Each function should do one thing well
- **Avoid comments**: Code should be clear without explanation
  - Exception: Non-obvious business logic or architectural decisions
  - Exception: Temporary workarounds (use `// FIXME:` or `// TODO:`)
  - For "why" decisions, use commit messages or ADRs instead
- **API documentation**: Public APIs documented via Swagger (see `src/swagger.mjs`)
- **No JSDoc required**: Types and behavior should be clear from usage and naming

**Example of good naming:**
```javascript
// ❌ Bad
function process(d) { /* needs comment to explain */ }

// ✅ Good
function fetchAvailableConsultants(startDate) { /* self-explanatory */ }
```

## Testing

This project uses **end-to-end (E2E) testing exclusively**. No unit tests are needed or used.

**Why E2E only:**
- Codebase is straightforward with minimal branching logic
- E2E tests verify actual behavior users/integrations experience
- Mock servers (AgileDay API, OpenAI API) allow full integration testing
- Better coverage with less maintenance than unit tests

**Test structure:**
```
test/
├── integration/              # E2E tests
├── agileday-api-mock/        # Mock AgileDay API
├── openai-api-mock/          # Mock OpenAI API
└── fixtures/                 # Test data
```

**Running tests:**
```bash
# Run all tests
npm test

# Run specific test file
node --test --test-global-setup=test/global-setup.mjs test/integration/do-search.test.mjs
```

**Note:** When running tests manually, include `--test-global-setup=test/global-setup.mjs` to start mock servers.

**Adding new tests:**
- Place in `test/integration/` with `.test.mjs` extension
- Import utilities from `test/config.mjs`
- Use existing mocks for external APIs
- Test complete user flows, not isolated functions
- See existing tests for patterns

**When to add tests:**
- New API endpoints
- New MCP tools
- OAuth flow changes
- Database query changes

**Adding embedding fixtures:**
- For new embeddings needed in tests, run the capture script:
  ```bash
  export OPENAI_KEY=<your-openai-key>
  node test/scripts/capture-refresh-embeddings.mjs
  node test/scripts/generate-fixture-index.mjs
  ```

## Pull Request Process

1. Ensure tests pass
2. Update documentation if needed
3. Add description of changes
4. Link related issues
5. Request review

## Questions?

- Create an issue for bugs or feature requests
- Contact: nicoandres@rakettitiede.com
