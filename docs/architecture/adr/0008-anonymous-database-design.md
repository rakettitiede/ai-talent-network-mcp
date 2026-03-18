# ADR-0008: Anonymous Database Design

## Status
Accepted

## Context

ai-talent-network-mcp is a federated talent search node intended to be queried by external partner companies. This raises a fundamental privacy question: how do we allow partners to search for consultants without exposing personal data?

The internal `mcp-agileday` database stores full Agileday profiles — names, email addresses, segments, project client names, and AgileDay URLs. Sharing any of this with external partners would constitute a personal data disclosure requiring GDPR data processing agreements and significant trust infrastructure between companies.

The core design question was: should we anonymize at the API response layer (store real data, redact on output) or anonymize at the storage layer (never store PII at all)?

## Decision

Anonymize at the storage layer. The database never contains personal information.

### What is stripped during import

From employee records:
- Name
- Email
- Segment (maps too directly to real individuals)
- AgileDay profile URL

From project history:
- Client names
- Project names
- Project IDs

### What is kept

- Anonymized profile description (skills and experience, no identifying details)
- Skill list with proficiency and motivation ratings
- Certificates
- Project history descriptions (technology and domain context only)
- Coarse availability: `Available now`, `Available after <date>`, or `Currently unavailable`

### Identity model: rotating UUIDs

Each consultant is assigned a new `crypto.randomUUID()` on every database refresh. IDs do not persist across refreshes.

This was chosen over stable pseudonyms (e.g. HMAC of the Agileday ID) because:
- A stable pseudonym allows partners to track the same individual across searches over time, which is still personal data under GDPR
- Rotating IDs break longitudinal tracking entirely — a partner cannot correlate results from two different refreshes
- The use case (find available consultants for a project) does not require stable identifiers; the partner contacts Rakettitiede with a description, not an ID

### Consequence for the fetch endpoint

Because IDs rotate on every refresh, the `/api/v1/fetch` endpoint is only meaningful within the same data generation cycle. This is acceptable — fetch is intended for drill-down within a single search session, not persistent bookmarking.

## Consequences

### Positive
- No PII ever stored or transmitted to partners
- Rotating IDs prevent longitudinal tracking of individuals
- Simplifies GDPR compliance — anonymized data falls outside the definition of personal data if re-identification is not reasonably possible
- Partners get a fully functional search experience without any identity exposure

### Negative
- Import pipeline must actively strip fields — any schema change in Agileday could accidentally re-introduce PII if the import is not reviewed
- Rotating IDs mean fetch results are only valid within the current data generation cycle
- Profile descriptions must be reviewed to ensure they don't inadvertently reveal identity through unique project details

### Neutral
- DPA with partner companies is still recommended as a precaution, even though stored data is anonymized
- The fetch endpoint remains in the API for within-session drill-down; it is not suitable for persistent references
