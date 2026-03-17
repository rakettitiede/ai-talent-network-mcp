# ADR-0005: AI Assistant Integration and Workflow Guardrails

## Status
Accepted

## Context

AI coding assistants (Cursor, Claude Code, GitHub Copilot) are increasingly used for development tasks. These tools need project context to be effective, but present several challenges:

**Context challenges:**
- Different tools use different conventions (`.cursorrules`, `.claude/`, `gemini.md`)
- No industry standard for AI assistant configuration
- Project-specific patterns and conventions aren't automatically known to AI tools

**Workflow risks:**
- AI tools sometimes perform git operations (commit, push, PR creation) without explicit user consent
- Accidental deployments could occur if AI executes deployment commands
- No guardrails to distinguish read-only from destructive operations

**Observed issues:**
- AI assistants committing changes without asking
- AI pushing to remote branches unexpectedly
- AI creating pull requests automatically
- Inconsistent behavior between different AI tools

## Decision

### 1. Create `.aicontext` file at repository root

A tool-agnostic file providing context for all AI assistants:

```
.aicontext                    # AI assistant context (root level, tracked in git)
```

**Why `.aicontext`:**
- Tool-agnostic name (not tied to specific vendor)
- Short and memorable
- Clear purpose from name
- Starts with `.` (convention for config files)
- Single file, not a directory

### 2. Establish explicit workflow guardrails

The `.aicontext` file header defines what AI assistants can and cannot do:

**NEVER do without permission:**
- `git commit` - Always ask before committing
- `git push` - Always ask before pushing
- Creating pull requests - Always ask first
- Merging branches - Always ask first
- `npm publish` - Always ask before publishing
- Deployment commands - Always ask before deploying

**CAN do without asking:**
- `git status`, `git diff`, `git log` (read-only git commands)
- Creating/modifying files
- Running tests
- Installing dependencies locally

### 3. Make it discoverable

- Note in `.aicontext` header explaining its purpose
- Reference in `CONTRIBUTING.md` for human contributors
- Document in ADR (this document) for architectural context

### Structure of `.aicontext`

```markdown
# AI Assistant Context

> Note: This file provides context for AI coding assistants...

## Critical Workflow Rules
[Guardrails section]

## Documentation Structure
[Project documentation layout]

## AI Assistant Guidelines for Documentation
[How to maintain docs]

## Project Overview
[Technical context]

## Common Commands
[Development, testing, deployment]

## Architecture
[Code structure and patterns]
```

## Consequences

### Positive

- **Consistent AI behavior** - Same rules across Cursor, Claude, Copilot, future tools
- **Prevents accidental git operations** - Explicit consent required for commits/pushes
- **Single source of truth** - All AI context in one discoverable file
- **Tool-agnostic** - Works with any AI assistant that reads project files
- **Explicit consent model** - Destructive operations require human approval
- **Documented patterns** - AI assistants learn project conventions

### Negative

- **Tool configuration required** - Some AI tools may need explicit setup to read `.aicontext`
- **No enforcement** - Rules are advisory; AI tools may not always follow them
- **Maintenance burden** - File must be kept updated as project evolves
- **Early adopter risk** - No industry standard; approach may need to change

### Neutral

- **No standard exists** - We're establishing our own convention
- **Evolution expected** - AI tooling is rapidly changing; may need updates
- **Human discipline required** - Developers must update `.aicontext` when patterns change

## Implementation

1. Created `.aicontext` at repository root
2. Added workflow guardrails as first section (high visibility)
3. Migrated content from `.claude/project-context.md`
4. Updated `CONTRIBUTING.md` to reference `.aicontext`
5. Ensured `.aicontext` is NOT in `.gitignore` (tracked in version control)

## Related

- [ADR-0004](0004-restructure-documentation.md) - Established human documentation structure
- This ADR addresses AI assistant integration as a separate concern

## References

- Cursor Rules documentation
- Claude Code project context conventions
- GitHub Copilot workspace context
