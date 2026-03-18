# ADR-0009: Vertex AI Embeddings (text-embedding-005, 768 dimensions)

## Status
Accepted

## Context

ai-talent-network-mcp requires an embedding model for semantic search across anonymized consultant profiles and project history. The embedding model choice affects:
- Vector dimension size (storage and search performance)
- Search quality
- Infrastructure coupling and authentication complexity
- Cost model

The reference implementation (`mcp-agileday`) originally used OpenAI `text-embedding-3-small` (1536 dimensions) and later migrated to Vertex AI `text-embedding-005` (768 dimensions). Since ai-talent-network-mcp is a new project built after that migration, the choice was made upfront rather than inherited.

## Decision

Use Vertex AI `text-embedding-005` at 768 dimensions from day one.

### Why Vertex AI over OpenAI

- The broader system (GCP, Cloud Run, Secret Manager, GCS) already runs on GCP infrastructure
- Vertex AI authentication uses Application Default Credentials — no additional API key to manage or rotate
- Cost is included in GCP project billing rather than a separate OpenAI subscription
- Consistent with `mcp-agileday` post-migration, making cross-project behaviour comparable

### Why 768 dimensions

- `text-embedding-005` supports output dimensionality reduction; 768 is a supported reduced dimension
- 768-dim vectors are half the size of the original 1536-dim OpenAI vectors, halving storage and speeding up vector search
- Quality difference at 768 vs 1536 is negligible for this use case (short skill/project descriptions, not long documents)
- `mcp-agileday` validated this dimension in production before this project was started

### Embedding model is a breaking change

Switching embedding models after data has been stored requires a full vector regeneration — stored vectors from one model are incompatible with queries from another. Choosing the right model upfront avoids a forced major version bump later.

## Consequences

### Positive
- No OpenAI API key dependency
- GCP-native auth (ADC) — simpler credential management in CI/CD and Cloud Run
- Smaller vectors — lower storage cost, faster similarity search
- Consistent with mcp-agileday, enabling apples-to-apples search quality comparison

### Negative
- Tighter GCP coupling — migrating away from GCP would require a new embedding model and full vector regeneration
- Fixture capture for tests requires `gcloud auth application-default login` (not just an env var)

### Neutral
- Any future change in embedding model requires a major version bump and full database regeneration
- sqlite-vec handles 768-dim vectors natively; no configuration change needed vs 1536
