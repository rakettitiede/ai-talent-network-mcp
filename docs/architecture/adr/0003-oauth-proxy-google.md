# ADR-0003: OAuth Proxy with Google for Custom GPT Integration

## Status
Accepted

## Context

The MCP Talent Network server needed OAuth support for Custom GPT integration. OpenAI's Custom GPT Actions require OAuth 2.0 authentication, which means the server must act as an OAuth provider from Custom GPT's perspective.

**Requirements:**
- Custom GPT must authenticate users before accessing the API
- Users authenticate via Google (existing company identity provider)
- Existing API key authentication must continue working for programmatic access

**Constraints:**
- Server runs on Cloud Run (stateless, auto-scaling)
- No persistent session storage desired
- Must be simple to implement and maintain

## Decision

Implement a minimal **OAuth proxy** that translates between Custom GPT's OAuth expectations and Google's OAuth flow:

### Architecture

```
Custom GPT → /oauth/authorize → Google OAuth → /oauth/callback → Custom GPT
                                                      │
                                            (temp code in memory)
                                                      │
Custom GPT ← Google tokens ← /oauth/token ←──────────┘
```

### Implementation

1. **Three proxy endpoints** (`src/oauth-router.mjs`):
   - `GET /oauth/authorize` - Redirects to Google OAuth with encoded state
   - `GET /oauth/callback` - Exchanges Google code for tokens, stores temporarily, redirects to Custom GPT
   - `POST /oauth/token` - Returns stored Google tokens to Custom GPT

2. **In-memory temporary storage**:
   - Store Google tokens for 5 minutes keyed by temporary code
   - One-time use (deleted after retrieval)
   - No persistent storage required

3. **Combined auth middleware** (`src/require-auth.mjs`):
   - First checks for Bearer token, validates with Google's tokeninfo endpoint
   - Falls back to API key authentication
   - Sets `req.user` with auth method indicator

### What We Explicitly Avoided

- **Custom JWT generation** - Google already provides tokens
- **Session management with cookies** - Unnecessary for this use case
- **PKCE flow** - Not required for server-to-server OAuth
- **User info endpoint** - Custom GPT doesn't need it
- **Token refresh logic** - Google handles token lifecycle

## Consequences

### Positive
- Simple implementation (~170 lines in oauth-router.mjs)
- No database changes required
- No new dependencies (uses built-in crypto, fetch)
- Stateless-friendly (only temp storage during OAuth dance)
- Backward compatible (API key auth unchanged)
- Google handles all identity management

### Negative
- Temporary codes stored in memory (lost on restart, but 5-min TTL mitigates this)
- Bearer token validation requires network call to Google on each request
- Requires Google OAuth credentials configuration in GCP Console

### Neutral
- OAuth endpoints don't require authentication (they ARE the authentication)
- Google access tokens used directly (no abstraction layer)
