# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the MCP Talent Network project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-use-mock-vertex-ai-for-testing.md) | Use Mock Vertex AI for Testing | Accepted | 2026-03 |
| [0002](0002-refresh-test-fixture-based-embeddings.md) | Refresh Test Fixture-Based Embeddings | Accepted | 2026-01 |
| [0003](0003-oauth-proxy-google.md) | OAuth Proxy with Google for Custom GPT Integration | Accepted | 2026-01 |
| [0004](0004-restructure-documentation.md) | Restructure Documentation Following Standard Practices | Accepted | 2026-01 |
| [0005](0005-ai-assistant-integration.md) | AI Assistant Integration and Workflow Guardrails | Accepted | 2026-01 |
| [0006](0006-database-schema-management.md) | Database Schema Management with SQL Migrations | Accepted | 2026-01 |
| [0007](0007-search-query-test-fixtures.md) | Search Query Test Fixtures via TEST_SEARCH_QUERY | Accepted | 2026-02 |
| [0008](0008-anonymous-database-design.md) | Anonymous Database Design | Accepted | 2026-03 |
| [0009](0009-vertex-ai-embeddings.md) | Vertex AI Embeddings (text-embedding-005, 768 dimensions) | Accepted | 2026-03 |

## ADR Template

When creating a new ADR, use the following template:

```markdown
# ADR-NNNN: Title

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
What is the issue that we're seeing that is motivating this decision or change?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?
```

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's article on ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
