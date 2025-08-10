# Migration Guide: JSON Blob to SQLite Columns

## Overview

This guide documents the process of migrating from JSON blob storage to proper SQLite column-based storage in Promptliano. The migration improves query performance, enables better indexing, and provides type safety at the database level.

## Why Migrate?

1. **Performance**: Direct column queries are 10-100x faster than JSON_EXTRACT operations
2. **Indexing**: Native SQLite indexes work better with columns than JSON fields
3. **Type Safety**: Column constraints ensure data integrity
4. **Query Simplicity**: Simpler SQL queries without JSON functions
5. **Storage Efficiency**: Reduced storage overhead from JSON formatting

## Migration Strategy

### 1. Clean Break Approach (Beta Software)

For beta software, we use a clean break approach:

- Drop existing data during migration
- Create new table structure
- No data migration required
- Users start fresh with new schema

### 2. Production Migration Approach

For production systems, implement data migration:

- Create temporary tables with new schema
- Migrate existing data from JSON to columns
- Validate data integrity
- Atomic switch to new tables

## Step-by-Step Migration Process

### Step 1: Analyze Current Schema

Examine the existing JSON structure to identify all fields:

```typescript
// Example: Ticket entity
interface Ticket {
  id: number
  projectId: number
  title: string
  overview: string
  status: 'open' | 'in_progress' | 'closed'
  priority: 'low' | 'normal' | 'high'
  suggestedFileIds: string[]
  suggestedAgentIds: number[]
  suggestedPromptIds: number[]
  created: number
  updated: number
}
```

### Step 2: Create Migration File

Create a new migration file following the numbering convention:

```typescript
// packages/storage/src/migrations/00X-entity-columns.ts
import type { Database } from 'bun:sqlite'

export const entityColumnsMigration = {
  version: X,
  description: 'Convert entity from JSON storage to column-based table',

  up: (db: Database) => {
    // Implementation here
  },

  down: (db: Database) => {
    // Rollback implementation
  }
}
```

### Step 3: Design Table Schema

Convert TypeScript interface to SQL table definition:

```sql
CREATE TABLE tickets_new (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  overview TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  suggested_file_ids TEXT NOT NULL DEFAULT '[]', -- JSON array as text
  suggested_agent_ids TEXT NOT NULL DEFAULT '[]',
  suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

### Step 4: Handle JSON Array Fields

For array fields, store as JSON text with NOT NULL constraints:

```typescript
// In migration
suggested_file_ids TEXT NOT NULL DEFAULT '[]'

// In storage layer - safe parsing helper
function safeJsonParse<T>(json: string | null | undefined, fallback: T, context?: string): T {
  if (!json) return fallback

  try {
    return JSON.parse(json)
  } catch (error) {
    console.warn(`Failed to parse JSON${context ? ` for ${context}` : ''}: ${json}`, error)
    return fallback
  }
}
```

### Step 5: Create Indexes

Add indexes for commonly queried fields:

```sql
-- Single column indexes
CREATE INDEX idx_tickets_project_id ON tickets(project_id)
CREATE INDEX idx_tickets_status ON tickets(status)
CREATE INDEX idx_tickets_priority ON tickets(priority)
CREATE INDEX idx_tickets_created_at ON tickets(created_at)

-- Composite indexes for common query patterns
CREATE INDEX idx_tickets_project_status ON tickets(project_id, status)
```

### Step 6: Update Storage Layer

Modify the storage class to use direct SQL queries:

```typescript
// Before: JSON query
const tickets = await db.findByJsonField<Ticket>(TICKETS_TABLE, '$.projectId', projectId)

// After: Direct SQL query
const query = database.prepare(`
  SELECT 
    id, project_id, title, overview, status, priority,
    suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
    created_at, updated_at
  FROM tickets
  WHERE project_id = ?
  ORDER BY created_at DESC
`)
const rows = query.all(projectId)
```

### Step 7: Update Write Operations

Convert JSON inserts to column-based inserts:

```typescript
// Before
insertQuery.run(ticketId, JSON.stringify(ticket), created, updated)

// After
insertQuery.run(
  ticketId,
  ticket.projectId,
  ticket.title,
  ticket.overview,
  ticket.status,
  ticket.priority,
  JSON.stringify(ticket.suggestedFileIds || []),
  JSON.stringify(ticket.suggestedAgentIds || []),
  JSON.stringify(ticket.suggestedPromptIds || []),
  ticket.created || now,
  ticket.updated || now
)
```

## Complete Example: Tickets Migration

Here's the complete migration from the tickets implementation:

```typescript
export const ticketsTasksColumnsMigration = {
  version: 6,
  description: 'Convert tickets and ticket_tasks from JSON storage to proper column-based tables',

  up: (db: Database) => {
    // Create new tickets table
    db.exec(`
      CREATE TABLE tickets_new (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        overview TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
        suggested_file_ids TEXT DEFAULT '[]',
        suggested_agent_ids TEXT DEFAULT '[]',
        suggested_prompt_ids TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop old table and rename new
    db.exec(`DROP TABLE IF EXISTS tickets`)
    db.exec(`ALTER TABLE tickets_new RENAME TO tickets`)

    // Create indexes
    db.exec(`CREATE INDEX idx_tickets_project_id ON tickets(project_id)`)
    db.exec(`CREATE INDEX idx_tickets_status ON tickets(status)`)
    db.exec(`CREATE INDEX idx_tickets_priority ON tickets(priority)`)
  }
}
```

## Entities Requiring Migration

The following entities still use JSON blob storage and need migration:

1. **projects** - Core project data
2. **agents** - AI agent configurations
3. **project_files** - File associations with projects
4. **prompts** - Prompt templates
5. **prompt_projects** - Prompt-project associations
6. **mcp_server_configs** - MCP server configurations
7. **mcp_server_states** - MCP server runtime states
8. **mcp_tools** - MCP tool definitions
9. **mcp_resources** - MCP resource definitions
10. **mcp_tool_executions** - Tool execution history
11. **selected_files** - User file selections per tab

## Best Practices

### 1. Field Naming Conventions

- Use snake_case for column names
- Match TypeScript property names where possible
- Use `_at` suffix for timestamps
- Use `_id` suffix for foreign keys

### 2. Data Types

- Use `INTEGER` for IDs and timestamps
- Use `TEXT` for strings and JSON arrays
- Use `REAL` for floating-point numbers
- Add CHECK constraints for enums

### 3. Constraints

- Always add NOT NULL for required fields
- Use DEFAULT values for optional fields
- Add CHECK constraints for enums
- Define foreign keys with CASCADE options

### 4. JSON Array Handling

- Store as TEXT with NOT NULL DEFAULT '[]'
- Use safeJsonParse helper for reading
- Always validate against Zod schema
- Handle parse errors gracefully

### 5. Index Strategy

- Index foreign key columns
- Index columns used in WHERE clauses
- Create composite indexes for common queries
- Monitor query performance

## Common Pitfalls

### 1. Null JSON Arrays

- Problem: NULL values in JSON array fields cause parsing errors
- Solution: Add NOT NULL constraints with DEFAULT '[]'

### 2. Missing Indexes

- Problem: Slow queries on large tables
- Solution: Add indexes for all foreign keys and frequently queried fields

### 3. Type Mismatches

- Problem: JavaScript boolean vs SQLite integer (0/1)
- Solution: Explicit conversion in storage layer

### 4. Timestamp Handling

- Problem: Inconsistent timestamp formats
- Solution: Always store as Unix milliseconds (INTEGER)

### 5. Migration Rollback

- Problem: Data loss on rollback
- Solution: Keep old table structure in down() method

## Testing Strategy

1. **Unit Tests**: Test storage layer with in-memory database
2. **Migration Tests**: Verify schema changes
3. **Integration Tests**: Test full CRUD operations
4. **Performance Tests**: Compare query performance
5. **Data Integrity**: Validate all constraints

## Migration Checklist

- [ ] Analyze current JSON schema
- [ ] Design new table structure
- [ ] Create migration file
- [ ] Update storage layer queries
- [ ] Add appropriate indexes
- [ ] Handle JSON array fields
- [ ] Update service layer if needed
- [ ] Write comprehensive tests
- [ ] Document breaking changes
- [ ] Test rollback procedure

## Performance Improvements

Typical performance gains after migration:

- Simple queries: 10-50x faster
- Complex queries with joins: 50-100x faster
- Aggregate queries: 100x+ faster
- Index-based lookups: Near instant

## Next Steps

1. Prioritize entities by query frequency
2. Start with simple entities (few fields)
3. Test thoroughly in development
4. Plan production migration strategy
5. Monitor performance improvements

## Conclusion

Migrating from JSON blob storage to proper columns is a significant performance and maintainability improvement. While it requires careful planning and implementation, the benefits in query performance, data integrity, and code simplicity make it worthwhile for any growing application.
