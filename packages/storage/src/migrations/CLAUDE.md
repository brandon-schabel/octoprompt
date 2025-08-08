# Database Migrations Guide

This directory contains the migration system for Promptliano's database schema evolution. The system supports both traditional JSON-based migrations and modern column-based SQLite migrations with comprehensive performance optimizations.

## Overview

Promptliano uses a dual migration approach:

1. **Traditional Migrations** - For general schema changes, data transformations, and feature additions
2. **JSON-to-Column Migrations** - Specialized migrations for performance optimization by converting JSON blob storage to proper SQLite columns

## Migration System Architecture

### Core Components

- **Migration Runner** (`run-migrations.ts`) - Executes migrations in order with tracking
- **Migration Framework** (`index.ts`) - Provides utilities for creating and managing migrations
- **Individual Migrations** (`00X-*.ts`) - Specific schema changes and transformations
- **Test Suite** (`migrations.test.ts`) - Comprehensive testing for all migration utilities

### Migration Types

#### 1. Schema Migrations

Standard database schema changes like adding tables, columns, or indexes.

#### 2. JSON-to-Column Migrations (Performance Critical)

High-impact migrations that convert JSON blob storage to proper columns for 10-100x performance improvements.

**Key Examples:**

- `006-tickets-tasks-columns.ts` - Converts tickets and tasks from JSON to columns
- `007-tickets-tasks-not-null.ts` - Adds NOT NULL constraints for data integrity
- `008-projects-columns.ts` - Projects table column conversion
- `009-provider-keys-columns.ts` - Provider keys optimization

#### 3. Data Transformation Migrations

Migrations that transform existing data structure or format without changing storage approach.

## Creating New Migrations

### Basic Migration Structure

```typescript
import type { Database } from 'bun:sqlite'

export const yourMigrationName = {
  version: 999, // Next sequential number
  description: 'Brief description of what this migration does',

  up: (db: Database) => {
    console.log('[Migration] Starting your migration...')

    // Your migration logic here
    db.exec(`/* SQL statements */`)

    console.log('[Migration] Your migration completed successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting your migration...')

    // Rollback logic here
    db.exec(`/* Rollback SQL statements */`)

    console.log('[Migration] Rollback completed')
  }
}
```

### Naming Convention

Follow the pattern: `XXX-descriptive-name.ts`

- `XXX` = Zero-padded version number
- Use kebab-case for descriptive names
- Be specific about what the migration does

## JSON-to-Column Migration Patterns

### Why Convert JSON to Columns?

JSON blob storage has significant performance limitations:

- `JSON_EXTRACT` queries are 10-100x slower than direct column access
- Cannot create efficient indexes on JSON fields
- No native type safety or constraints
- Complex query syntax

### Standard JSON-to-Column Pattern

```typescript
export const entityColumnsMigration = {
  version: X,
  description: 'Convert entity from JSON storage to column-based table',

  up: (db: Database) => {
    console.log('[Migration] Starting entity column migration...')

    // 1. Create new table with proper columns
    db.exec(`
      CREATE TABLE entity_new (
        id INTEGER PRIMARY KEY,
        column1 TEXT NOT NULL,
        column2 INTEGER DEFAULT 0,
        json_array_field TEXT NOT NULL DEFAULT '[]', -- JSON arrays as TEXT
        optional_field TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // 2. Drop old JSON table (clean break for beta)
    db.exec(`DROP TABLE IF EXISTS entity`)

    // 3. Rename new table
    db.exec(`ALTER TABLE entity_new RENAME TO entity`)

    // 4. Create comprehensive indexes
    db.exec(`CREATE INDEX idx_entity_column1 ON entity(column1)`)
    db.exec(`CREATE INDEX idx_entity_created_at ON entity(created_at)`)
    // Add indexes for all foreign keys and commonly queried fields

    console.log('[Migration] Entity converted to column-based storage')
  },

  down: (db: Database) => {
    // Rollback to original JSON structure
    console.log('[Migration] Reverting to JSON storage...')

    db.exec(`
      CREATE TABLE entity_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    db.exec(`DROP TABLE IF EXISTS entity`)
    db.exec(`ALTER TABLE entity_old RENAME TO entity`)

    // Recreate old JSON-based indexes
    db.exec(`CREATE INDEX idx_entity_created_at ON entity(created_at)`)
    db.exec(`CREATE INDEX idx_entity_field ON entity(JSON_EXTRACT(data, '$.field'))`)

    console.log('[Migration] Reverted to JSON storage')
  }
}
```

### JSON Array Field Handling

JSON arrays must be stored as TEXT with proper defaults and parsing:

```typescript
// In migration - always use NOT NULL with default
suggested_file_ids TEXT NOT NULL DEFAULT '[]'

// In storage layer - use safeJsonParse helper
function safeJsonParse<T>(json: string | null | undefined, fallback: T, context?: string): T {
  if (!json) return fallback

  try {
    return JSON.parse(json)
  } catch (error) {
    console.warn(`Failed to parse JSON${context ? ` for ${context}` : ''}: ${json}`, error)
    return fallback
  }
}

// Usage in storage queries
const tickets = rows.map(row => ({
  id: row.id,
  suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
  // ... other fields
}))
```

### Index Strategy for Performance

Always create indexes for:

1. **Foreign key columns** - Essential for JOINs
2. **Frequently queried columns** - WHERE clause fields
3. **Sort columns** - ORDER BY fields
4. **Composite indexes** - Common query patterns

```sql
-- Single column indexes
CREATE INDEX idx_tickets_project_id ON tickets(project_id)
CREATE INDEX idx_tickets_status ON tickets(status)
CREATE INDEX idx_tickets_created_at ON tickets(created_at)

-- Composite indexes for common query patterns
CREATE INDEX idx_tickets_project_status ON tickets(project_id, status)
CREATE INDEX idx_tickets_project_created ON tickets(project_id, created_at DESC)
```

## Transaction Patterns

### Basic Transaction Usage

```typescript
up: (db: Database) => {
  db.exec('BEGIN TRANSACTION')

  try {
    // All migration operations here
    db.exec('/* migration SQL */')
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
```

### Complex Multi-Step Migrations

For migrations with multiple dependent steps:

```typescript
up: (db: Database) => {
  console.log('[Migration] Starting complex migration...')

  db.exec('BEGIN TRANSACTION')

  try {
    // Step 1: Create new tables
    console.log('[Migration] Creating new tables...')
    db.exec('/* table creation SQL */')

    // Step 2: Migrate existing data (if needed)
    console.log('[Migration] Migrating data...')
    db.exec('/* data migration SQL */')

    // Step 3: Create indexes
    console.log('[Migration] Creating indexes...')
    db.exec('/* index creation SQL */')

    // Step 4: Clean up old structures
    console.log('[Migration] Cleaning up...')
    db.exec('/* cleanup SQL */')

    db.exec('COMMIT')
    console.log('[Migration] Complex migration completed')
  } catch (error) {
    console.error('[Migration] Error during migration:', error)
    db.exec('ROLLBACK')
    throw error
  }
}
```

## Migration Testing Strategy

### Unit Tests for Migrations

Test each migration thoroughly:

```typescript
describe('Entity Columns Migration', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
    // Set up initial state
  })

  test('converts JSON storage to columns', () => {
    // Run migration
    entityColumnsMigration.up(db)

    // Verify table structure
    const tableInfo = db.prepare("PRAGMA table_info('entity')").all()
    expect(tableInfo).toContainEqual(
      expect.objectContaining({
        name: 'column1',
        type: 'TEXT',
        notnull: 1
      })
    )
  })

  test('rollback restores original structure', () => {
    entityColumnsMigration.up(db)
    entityColumnsMigration.down(db)

    // Verify original structure restored
    const tableInfo = db.prepare("PRAGMA table_info('entity')").all()
    expect(tableInfo).toContainEqual(
      expect.objectContaining({
        name: 'data',
        type: 'JSON'
      })
    )
  })

  test('handles empty database gracefully', () => {
    expect(() => entityColumnsMigration.up(db)).not.toThrow()
  })
})
```

### Integration Tests

Test the full migration flow:

```typescript
test('runs multiple migrations in sequence', async () => {
  const migrations = [migration1, migration2, migration3]

  await runMigrations({
    adapter: testAdapter,
    migrations,
    logger: jest.fn()
  })

  // Verify final state
  const status = await getMigrationStatus(testAdapter, migrations)
  expect(status.pending).toHaveLength(0)
})
```

## Performance Considerations

### Clean Break vs Data Migration

**Clean Break Approach (Current - Beta Software):**

- Drops existing data during migration
- Faster and simpler implementation
- Acceptable for beta/development environments
- Used in migrations 006, 007, 008, etc.

**Production Data Migration Approach:**

```typescript
up: (db: Database) => {
  // 1. Create new table structure
  db.exec('CREATE TABLE entity_new (...)')

  // 2. Migrate data from old to new
  const rows = db.prepare('SELECT * FROM entity_old').all()
  for (const row of rows) {
    const data = JSON.parse(row.data)
    db.prepare(
      `
      INSERT INTO entity_new (id, field1, field2, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(row.id, data.field1, data.field2, row.created_at, row.updated_at)
  }

  // 3. Atomic switch
  db.exec('DROP TABLE entity_old')
  db.exec('ALTER TABLE entity_new RENAME TO entity')
}
```

### Index Creation Performance

Create indexes after data insertion for better performance:

```typescript
// Good: Create table, insert data, then create indexes
db.exec('CREATE TABLE ...')
// Insert data operations
db.exec('CREATE INDEX ...')

// Avoid: Creating indexes before bulk inserts (slower)
```

## Common Patterns and Templates

### Adding a Simple Column

```typescript
export const addColumnMigration = {
  version: X,
  description: 'Add new_column to existing_table',

  up: (db: Database) => {
    db.exec('ALTER TABLE existing_table ADD COLUMN new_column TEXT')
    db.exec('CREATE INDEX idx_existing_table_new_column ON existing_table(new_column)')
  },

  down: (db: Database) => {
    // SQLite doesn't support DROP COLUMN, so recreate table
    db.exec('CREATE TABLE existing_table_temp AS SELECT id, old_column FROM existing_table')
    db.exec('DROP TABLE existing_table')
    db.exec('ALTER TABLE existing_table_temp RENAME TO existing_table')
    // Recreate original indexes
  }
}
```

### Creating New Table with Relations

```typescript
export const newTableMigration = {
  version: X,
  description: 'Add new_table with foreign key relations',

  up: (db: Database) => {
    db.exec(`
      CREATE TABLE new_table (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE
      )
    `)

    // Create indexes
    db.exec('CREATE INDEX idx_new_table_parent_id ON new_table(parent_id)')
    db.exec('CREATE INDEX idx_new_table_created_at ON new_table(created_at)')
  },

  down: (db: Database) => {
    db.exec('DROP TABLE IF EXISTS new_table')
  }
}
```

## Troubleshooting Common Issues

### Issue: Migration Fails with Constraint Violations

**Solution:** Check for NULL values in NOT NULL fields

```sql
-- Before adding NOT NULL constraint, ensure no NULL values
UPDATE table_name SET column_name = 'default_value' WHERE column_name IS NULL;
```

### Issue: Index Creation Fails

**Solution:** Check for duplicate index names and table existence

```typescript
// Always use IF EXISTS/IF NOT EXISTS
db.exec('DROP INDEX IF EXISTS idx_name')
db.exec('CREATE INDEX IF NOT EXISTS idx_name ON table(column)')
```

### Issue: JSON Parsing Errors

**Solution:** Use safeJsonParse helper and validate data

```typescript
// Always provide fallback and context
const arrayField = safeJsonParse(row.json_field, [], 'entity.arrayField')
```

### Issue: Foreign Key Constraint Failures

**Solution:** Create tables in correct order and handle cascades

```typescript
// Create parent tables first
db.exec('CREATE TABLE parent (...)')
db.exec('CREATE TABLE child (..., FOREIGN KEY (parent_id) REFERENCES parent(id) ON DELETE CASCADE)')
```

## Migration Rollback Procedures

### Safe Rollback Guidelines

1. **Test rollbacks in development first**
2. **Backup production data before rollback**
3. **Verify data integrity after rollback**
4. **Document rollback procedures**

### Emergency Rollback Process

```bash
# 1. Stop application
# 2. Backup current database
cp production.db production.backup.db

# 3. Identify target migration version
# 4. Run rollback migrations manually if needed
```

### Rollback Testing

Always test rollback in CI/CD:

```typescript
test('migration rollback preserves data integrity', () => {
  // Apply migration
  migration.up(db)

  // Add test data
  insertTestData(db)

  // Rollback
  migration.down(db)

  // Verify data integrity maintained
  verifyDataIntegrity(db)
})
```

## Best Practices Checklist

### Before Creating Migration

- [ ] Review existing migrations for similar patterns
- [ ] Plan indexes for all foreign keys and query fields
- [ ] Design rollback strategy
- [ ] Consider performance impact
- [ ] Test with realistic data volumes

### Migration Implementation

- [ ] Use transactions for atomic operations
- [ ] Add comprehensive error handling
- [ ] Include progress logging
- [ ] Validate constraints and foreign keys
- [ ] Use NOT NULL DEFAULT '[]' for JSON arrays
- [ ] Create indexes after data operations

### Testing Requirements

- [ ] Unit tests for up/down operations
- [ ] Test with empty database
- [ ] Test with existing data
- [ ] Test rollback scenarios
- [ ] Performance benchmarks for large datasets

### Documentation

- [ ] Clear migration description
- [ ] Document breaking changes
- [ ] Update schema documentation
- [ ] Note performance improvements
- [ ] Record rollback procedures

## Migration Performance Benchmarks

Based on real Promptliano migrations:

### JSON vs Column Performance

- **Simple SELECT queries:** 10-50x faster with columns
- **Complex JOINs:** 50-100x faster with columns
- **Aggregate queries:** 100x+ faster with columns
- **Index-based lookups:** Near instant with proper indexes

### Index Impact

Adding proper indexes typically provides:

- **Foreign key JOINs:** 50-100x improvement
- **WHERE clause filtering:** 10-50x improvement
- **ORDER BY sorting:** 20-100x improvement

## References

- **Migration Guide:** `/docs/migration-guide-json-to-columns.md`
- **Entity Analysis:** `/docs/entities-migration-analysis.md`
- **Migration Templates:** `/docs/migration-templates/`
- **Best Practices:** `/docs/migration-best-practices-and-pitfalls.md`

## Adding New Migration

1. **Create migration file:** `XXX-descriptive-name.ts`
2. **Add to imports:** Update `run-migrations.ts` imports
3. **Add to migrations array:** Include in sequential order
4. **Write comprehensive tests:** Add to `migrations.test.ts`
5. **Update documentation:** Document breaking changes
6. **Test thoroughly:** Verify up/down operations work correctly

Remember: Every migration should have a corresponding rollback strategy and comprehensive tests. The migration system is the backbone of schema evolution - treat it with care and respect.
