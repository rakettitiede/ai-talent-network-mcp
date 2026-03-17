# Custom GPT Integration

This guide covers integrating the MCP Talent Network server with OpenAI's Custom GPT feature.

## Overview

The server provides OAuth authentication and REST API endpoints that enable Custom GPT to:
- Search for candidates based on role or project requirements
- Retrieve anonymized candidate profiles (skills, availability, description — no personal data)
- Analyze fit by comparing skills, experience, and availability

## Setup

### 1. Deploy the Server

Ensure the server is deployed to Cloud Run with OAuth configured. See [GCP Deployment](../deployment/gcp.md).

Required environment variables for OAuth:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Configure Custom GPT Actions

In the Custom GPT configuration:

1. **Authentication Type**: OAuth
2. **Client ID**: `any-value` (e.g., "talent-network-custom-gpt")
3. **Client Secret**: `any-value` (e.g., "not-used")
4. **Authorization URL**: `https://your-cloud-run-url/oauth/authorize`
5. **Token URL**: `https://your-cloud-run-url/oauth/token`
6. **Scope**: `openid email profile`

### 3. Import OpenAPI Schema

Use the server's OpenAPI specification:
```
https://your-cloud-run-url/openapi.json
```

### 4. Set Custom GPT Instructions

Copy the instructions from the [GPT Instructions](#gpt-instructions) section below into your Custom GPT's instructions field.

## How OAuth Works

1. Custom GPT redirects users to `/oauth/authorize`
2. Server proxies authentication to Google OAuth
3. Users authenticate with their Google account
4. Server returns Google tokens to Custom GPT
5. Custom GPT uses Bearer tokens for API requests

### Known Limitations

- OAuth temporary codes are stored in-memory (5-minute TTL)
- On Cloud Run with multiple instances, `/oauth/callback` and `/oauth/token` must hit the same instance
- Works reliably for low-traffic Custom GPT usage
- For high-scale scenarios, consider external storage (Redis/Firestore)

## API Endpoints

### Search Endpoint

```http
GET /api/v1/search?q={query}
Authorization: Bearer {google-access-token}
```

**Parameters:**
- `q` (required): Search query (e.g., "Frontend developer with React experience")

**Response:**
```json
{
  "results": [
    {
      "id": "candidate:uuid",
      "title": "Available now — matching skills with proficiency: React (4/5), TypeScript (3/5)",
      "url": "https://www.rakettiidee.com"
    },
    {
      "id": "project:uuid",
      "title": "Available after 2026-06-30 — history project matches at 85%: Built real-time dashboard...",
      "url": "https://www.rakettiidee.com"
    }
  ]
}
```

### Fetch Endpoint

```http
GET /api/v1/fetch?id={id}
Authorization: Bearer {google-access-token}
```

**Parameters:**
- `id` (required): ID from search results (e.g., "candidate:uuid" or "project:uuid")

**Response (candidate):**
```json
{
  "id": "candidate:uuid",
  "title": "Candidate found",
  "text": {
    "description": "Experienced frontend developer specializing in React and modern web technologies.",
    "skills": [
      { "name": "React", "proficiency": 4 },
      { "name": "TypeScript", "proficiency": 3 }
    ],
    "availability": "Available now"
  },
  "url": "https://www.rakettiidee.com",
  "metadata": {
    "type": "candidate",
    "skillsCount": 8
  }
}
```

**Response (project):**
```json
{
  "id": "project:uuid",
  "title": "Candidate found by project",
  "text": {
    "description": "Built real-time monitoring dashboard using React and GraphQL.",
    "skills": [
      { "name": "React", "proficiency": 4 }
    ],
    "availability": "Available after 2026-06-30"
  },
  "url": "https://www.rakettiidee.com",
  "metadata": {
    "type": "project",
    "project": "Banking Portal Modernization",
    "skillsCount": 8
  }
}
```

---

## GPT Instructions

Use these instructions in your Custom GPT configuration:

### Purpose

You are an agent that helps partner companies search into a talent pool where, due to DPA (Data Processing Agreement) and the EU AI Act, no personal data is available or returned. The MCP server returns anonymized candidate profiles — skills with proficiency levels, experience descriptions, project history, and availability status — just enough to assess whether there is a potential candidate to fulfill an open position.

### Core Capabilities

- Search talent pool based on role or project requirements
- Retrieve and interpret anonymized candidate profiles (via /fetch)
- Analyze fit by comparing skills (with proficiency levels) and experience
- Provide ranked recommendations with clear justifications
- Display availability information as additional context

### Data Interpretation Rules

When processing candidate data from the /fetch tool:

**Profile Information:**
- `text.description`: Anonymized professional description
- `text.skills`: List of skills and technologies with proficiency from 1 to 5 points
- `text.availability`: Current availability status

**Project History (when type is "project"):**
- `metadata.project`: Project name — use to identify relevant industry and domain experience
- `text.description`: Project description — assess relevance to the role

**Availability Information:**
- `text.availability`: Current availability status, which can be:
  - "Available now" — Candidate has no current client assignments
  - "Available after [date]" — Candidate is busy until specified date
  - "Currently unavailable" — Candidate has ongoing assignments with no defined end date

**Important Notes:**
- No personal data (names, emails, IDs) is returned — this is by design for DPA/AI Act compliance
- `metadata`: Use only for quick summaries (e.g., total skill counts)
- All results link to the Rakettitiede website for follow-up contact

### Analysis Protocol

1. Use the complete role description in searches
2. Select top candidates with the most skill and experience overlap
3. Fetch full data for the top 5 candidates
4. Compare skills, proficiency levels, and project descriptions for relevance
5. **Provide reasoned recommendations ranked by suitability (skills and experience match)**

### Availability Handling

**Critical: Availability is informational context only — do NOT use it for ranking or filtering candidates.**

- Always display availability information for each candidate
- Mention it naturally as part of the candidate summary
- If timing is explicitly mentioned in the user's query, you may highlight alignment or misalignment
- Never exclude candidates based on availability alone
- Never re-rank candidates based on availability

### Output Format

**Top 5 candidates** — detailed profiles with analysis:
- **Availability status** (displayed naturally in the summary)
- Key skills matching the role with proficiency levels
- Relevant experience (summarized from description and projects)
- Short rationale explaining fit based on skills and experience

**Next 5 candidates** — summary list:
- Skills overview and availability

**Overall recommendation:**
- Ranked by suitability (skills + experience)
- Clear reasoning for top choices
- Note: For follow-up or to request contact with any candidate, reach out to Rakettitiede

### Style & Tone

- **Tone:** Professional, confident, and data-driven
- **Format:** Clear headings and short paragraphs or bullet points
- **Focus:** Explain reasoning (why the candidate is a good fit)
- **Availability:** Include it naturally without overemphasizing
- **Conciseness:** Avoid repetition — keep responses structured and scannable
- **Privacy:** Never attempt to identify candidates or infer personal information

---

## Troubleshooting

### OAuth Authentication Fails

1. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
2. Check that the redirect URI matches your Custom GPT callback URL
3. Ensure Google OAuth consent screen is configured

### API Returns 401 Unauthorized

- Bearer token may have expired — re-authenticate
- Check Google OAuth token is valid

### Search Returns No Results

- Try broader search terms
- Verify database is populated (run refresh endpoint)
- Check server logs for errors

### Custom GPT Can't Connect

1. Verify server is deployed and accessible
2. Check OpenAPI schema is available at `/openapi.json`
3. Ensure Cloud Run allows unauthenticated access

## Related Documentation

- [GCP Deployment](../deployment/gcp.md) - Deploy with OAuth
- [Database Setup](../deployment/database.md) - Initialize and refresh data
- [ADR-0003: OAuth Proxy](../architecture/adr/0003-oauth-proxy-google.md) - Architecture decision
