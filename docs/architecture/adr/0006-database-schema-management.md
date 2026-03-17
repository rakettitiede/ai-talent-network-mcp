# ADR 0006: Database Schema Management with SQL Migrations

## Status
Accepted

## Context

The MCP Talent Network server uses SQLite for caching AgileDay employee and project data. Initially, the schema was defined inline in JavaScript (now removed), following the same pattern established in mcp-agileday.

As the project matures and we consider adding features like:
- Full-text search (FTS5)
- Performance indexes
- Additional tables for analytics
- Schema optimization

We need a systematic approach to manage schema changes over time.

Additionally, we want consistency with our other projects (raketti-bi, mcp-agileday) which already use SQL migrations.

## Decision

We will use **SQL migration files** to manage database schema, following the same pattern as raketti-bi.

### Migration Approach

1. **Migration Files**: Store schema changes as numbered SQL files in `migrations/` directory
   - Format: `NNN-description.sql` (e.g., `001-initial-schema.sql`, `002-add-fts-index.sql`)
   - Executed in numerical order

2. **Migration Runner**: Simple script (`scripts/migrate.mjs`) that:
   - Reads all `.sql` files from `migrations/` directory
   - Loads sqlite-vec extension (required for virtual tables)
   - Executes them in order
   - Reports success/failure

3. **Schema Definition**: 
   - Schema lives in migration files only (no JavaScript schema definitions)

4. **Execution**:
   - Development: `npm run migrate` before starting server
   - Production: Migrations run inline during `updateDatabase()` call

### Migration File Structure
```
migrations/
├── 001-initial-schema.sql          # Initial tables, indexes, views
├── 002-add-fts-search.sql          # Future: full-text search
└── 003-add-analytics.sql           # Future: analytics tables
```

### Current Schema (001-initial-schema.sql)

The initial migration captures our current schema:
- `employees` table (id, name, description, segment)
- `employee_skills` table (employee_id, name, proficiency, motivation)
- `employee_certificates` table (employee_id, name, issued)
- `project_history` table (id, employee_id, company, title, description, role, skills, dates, visibleInCv)
- `openings` table (id, employee_id, dates, project_name, project_id)
- `vec_employees` virtual table (employee_id, embed) - for semantic search
- `vec_projects` virtual table (project_id, embed) - for semantic search
- `employee_availability` view - computed availability status
- Performance indexes on foreign keys and frequently queried columns

## Consequences

### Positive

- **Version Control**: Schema changes tracked explicitly in git
- **Transparency**: Schema visible in SQL files, not buried in JS
- **Consistency**: Same pattern as raketti-bi project
- **Evolution**: Easy to add new migrations as schema evolves
- **Rollback**: Can review schema history through migration files
- **Testing**: Can test migrations independently

### Negative

- **Extra Step**: Must run `npm run migrate` before first use (development only)
- **No Automatic Rollback**: Migrations are forward-only (acceptable for our use case)

### Neutral

- **No Migration Tracking**: We don't track which migrations have been applied (recreate-from-scratch approach means all migrations run every time during refresh)
- **Acceptable**: Since we recreate the database via `/refresh`, tracking applied migrations adds unnecessary complexity

## Implementation Notes

1. **First Migration**: Schema in `migrations/001-initial-schema.sql`
2. **Database Layer**: `src/database.mjs` runs migrations inline via `runMigrations(db)`
3. **Add Script**: `npm run migrate` command for manual migration runs
4. **sqlite-vec**: Migration runner loads the extension for virtual table support

## Related

- Inspired by raketti-bi ADR 0005, consistent with mcp-agileday
- Enables future ADRs for FTS search, analytics, optimization
