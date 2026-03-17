# ADR-0004: Restructure Documentation Following Standard Practices

## Status
Accepted

## Context

Documentation was scattered across multiple root-level markdown files without clear organization:

- `README.md` - Contained everything: overview, installation, API docs, deployment, testing
- `CLAUDE.md` - AI assistant context mixed with user documentation
- `CHATGPT_INSTRUCTIONS.md` - Integration-specific guide at root level
- `docs/` - Only contained ADRs, no other documentation

**Problems identified:**
- Partners (Fraktio) struggled to find deployment information during initial setup
- No clear hierarchy for finding information
- README was overwhelming with too much detail
- AI assistant context (CLAUDE.md) served developers, not end users
- Integration guides (CHATGPT_INSTRUCTIONS.md) buried at root level
- New contributors couldn't quickly understand what documentation existed

**Partner feedback:**
> "Had to manually figure out database creation and GCS bucket upload, which wasn't straightforward."

## Decision

Adopt a standard documentation structure following open-source best practices:

### New Structure

```
README.md                           # Landing page with overview and links
docs/
├── architecture/
│   └── adr/                        # Architecture Decision Records
│       ├── README.md
│       ├── 0001-use-mock-openai-api-for-testing.md
│       ├── 0002-refresh-test-fixture-based-embeddings.md
│       ├── 0003-oauth-proxy-google.md
│       └── 0004-restructure-documentation.md
├── deployment/
│   ├── local.md                    # Local development setup
│   ├── gcp.md                      # GCP deployment guide (Cloud Run)
│   └── database.md                 # Database setup and GCS configuration
└── integrations/
    └── custom-gpt.md               # Custom GPT / ChatGPT integration
.aicontext                          # AI assistant context (moved from CLAUDE.md)
```

### File Migrations

| Original Location | New Location | Rationale |
|-------------------|--------------|-----------|
| `CLAUDE.md` | `.aicontext` | AI context separate from user docs |
| `CHATGPT_INSTRUCTIONS.md` | `docs/integrations/custom-gpt.md` | Integration docs in dedicated folder |
| (extracted from README) | `docs/deployment/local.md` | Development setup in deployment section |
| (extracted from README) | `docs/deployment/gcp.md` | Production deployment isolated |
| (new) | `docs/deployment/database.md` | Database setup partners needed |

### README Transformation

**Before:** ~650 lines covering everything
**After:** ~100 lines with:
- Project overview (what it does)
- Quick start (5-10 lines)
- Documentation links (where to find details)
- Environment variables table
- Basic commands

### Guiding Principles

1. **README = "What" not "How"** - Overview and navigation, not detailed instructions
2. **docs/ = Detailed guides** - Step-by-step instructions organized by topic
3. **AI context is not user docs** - `.aicontext` file for AI assistant context
4. **Integration guides together** - All third-party integrations in `docs/integrations/`
5. **Deployment guides together** - All deployment-related docs in `docs/deployment/`

## Consequences

### Positive

- **Clear information hierarchy** - Users know where to look
- **Easier partner onboarding** - Deployment docs are findable and comprehensive
- **Reduced cognitive load** - README focuses on navigation, not details
- **Standard structure** - Familiar to open-source contributors
- **Separation of concerns** - AI context vs user docs vs integration guides
- **Maintainable** - Each doc has a clear scope and purpose

### Negative

- **Link updates required** - Internal references need updating
- **One-time reorganization effort** - Moving and restructuring content
- **Potential broken bookmarks** - External links to old file locations break

### Neutral

- **ADR structure unchanged** - `docs/architecture/adr/` already followed best practices
- **No content loss** - All information preserved, just reorganized
- **Git history shows moves** - File moves tracked via `git mv`

## Implementation

1. Create folder structure: `docs/deployment/`, `docs/integrations/`
2. Extract deployment content from README → `docs/deployment/local.md`, `gcp.md`
3. Create `docs/deployment/database.md` with comprehensive setup guide
4. Move `CHATGPT_INSTRUCTIONS.md` → `docs/integrations/custom-gpt.md` (expanded)
5. Move `CLAUDE.md` → `.aicontext`
6. Rewrite README as landing page with documentation links
7. Update all internal doc links to use relative paths
8. Delete original root-level files

## References

- Partner feedback from Fraktio deployment experience
- [Documentation best practices](https://www.writethedocs.org/guide/writing/beginners-guide-to-docs/)
- Standard open-source project structure patterns
