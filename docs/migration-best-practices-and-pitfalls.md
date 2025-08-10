# Migration Best Practices and Common Pitfalls

## Best Practices

### 1. Planning and Analysis

#### Thoroughly Analyze Existing Data

```typescript
// Before migration, run analysis queries
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN JSON_EXTRACT(data, '$.field') IS NULL THEN 1 END) as nulls,
  COUNT(DISTINCT JSON_EXTRACT(data, '$.field')) as unique_values
FROM table_name
```

#### Document All Fields

- Create a comprehensive list of all JSON fields
- Note which fields are optional vs required
- Identify fields that are always arrays or objects
- Document any business logic constraints

### 2. Schema Design

#### Use Appropriate Data Types

```sql
-- Good: Use INTEGER for numeric IDs
id INTEGER PRIMARY KEY

-- Bad: Using TEXT for numeric IDs
id TEXT PRIMARY KEY -- Slower comparisons and joins
```

#### Handle JSON Arrays Properly

```sql
-- Good: NOT NULL with default empty array
tags TEXT NOT NULL DEFAULT '[]'

-- Bad: Nullable JSON arrays
tags TEXT DEFAULT NULL -- Causes parsing errors
```

#### Add Comprehensive Constraints

```sql
-- Good: Multiple levels of validation
status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'archived')),
priority INTEGER NOT NULL DEFAULT 1
  CHECK (priority BETWEEN 1 AND 5)

-- Bad: No constraints
status TEXT,
priority INTEGER
```

### 3. Migration Implementation

#### Use Transactions

```typescript
database.transaction(() => {
  // All migration operations here
  // Either all succeed or all fail
})()
```

#### Validate Data During Migration

```typescript
// Production migration with validation
INSERT INTO table_new
SELECT
  id,
  COALESCE(JSON_EXTRACT(data, '$.name'), 'Unknown'), -- Default for missing
  CASE
    WHEN JSON_EXTRACT(data, '$.status') IN ('active', 'inactive')
    THEN JSON_EXTRACT(data, '$.status')
    ELSE 'active' -- Default for invalid
  END
FROM table_old
WHERE JSON_EXTRACT(data, '$.name') IS NOT NULL -- Skip invalid records
```

#### Add Migration Version Tracking

```typescript
export const migration = {
  version: 8, // Increment for each migration
  description: 'Clear description of changes',
  breaking: true, // Flag breaking changes
  dataLoss: false // Flag if data will be lost
}
```

### 4. Storage Layer Updates

#### Create Reusable Helpers

```typescript
class BaseStorage {
  protected safeJsonParse<T>(json: string | null, fallback: T): T {
    if (!json) return fallback
    try {
      return JSON.parse(json)
    } catch {
      return fallback
    }
  }

  protected validateAndThrow<T>(data: unknown, schema: ZodSchema<T>): T {
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new ApiError(400, result.error.message)
    }
    return result.data
  }
}
```

#### Use Prepared Statements

```typescript
// Good: Prepared statement reuse
private insertStmt = this.db.prepare(`
  INSERT INTO table (col1, col2) VALUES (?, ?)
`)

// Bad: Building SQL strings
const sql = `INSERT INTO table VALUES ('${value1}', '${value2}')`
```

### 5. Index Strategy

#### Index Foreign Keys First

```sql
-- Always index foreign keys
CREATE INDEX idx_tasks_ticket_id ON tasks(ticket_id)
```

#### Create Composite Indexes for Common Queries

```sql
-- If you often query by project_id AND status
CREATE INDEX idx_tickets_project_status ON tickets(project_id, status)
```

#### Monitor Index Usage

```sql
-- SQLite: Check which indexes are being used
EXPLAIN QUERY PLAN
SELECT * FROM tickets WHERE project_id = ? AND status = ?
```

### 6. Testing Strategy

#### Test Migration Both Ways

```typescript
describe('Migration', () => {
  it('should migrate up successfully', async () => {
    await runMigration('up')
    // Verify new schema
  })

  it('should migrate down successfully', async () => {
    await runMigration('down')
    // Verify old schema restored
  })
})
```

#### Test Edge Cases

```typescript
it('should handle null JSON arrays', async () => {
  // Insert record with null array
  // Run migration
  // Verify converted to empty array
})

it('should handle malformed JSON', async () => {
  // Insert record with invalid JSON
  // Run migration
  // Verify appropriate handling
})
```

## Common Pitfalls and Solutions

### 1. Data Type Mismatches

#### Pitfall: Boolean Storage

```typescript
// JavaScript boolean !== SQLite integer
done: boolean // JS: true/false
done INTEGER CHECK (done IN (0, 1)) // SQLite: 0/1
```

#### Solution: Explicit Conversion

```typescript
// Writing
insertQuery.run(task.done ? 1 : 0)

// Reading
done: Boolean(row.done) // Converts 0/1 to false/true
```

### 2. Null Handling

#### Pitfall: Unexpected Nulls

```sql
-- This allows NULL which breaks JSON.parse()
suggested_files TEXT DEFAULT NULL
```

#### Solution: NOT NULL with Defaults

```sql
suggested_files TEXT NOT NULL DEFAULT '[]'
```

### 3. Transaction Boundaries

#### Pitfall: Partial Migrations

```typescript
// Bad: No transaction
db.exec('DROP TABLE old_table')
db.exec('CREATE TABLE new_table') // Fails here = data loss!
```

#### Solution: Atomic Operations

```typescript
database.transaction(() => {
  db.exec('CREATE TABLE new_table')
  // Migrate data
  db.exec('DROP TABLE old_table')
})()
```

### 4. Foreign Key Violations

#### Pitfall: Orphaned Records

```sql
-- Migration fails due to invalid foreign keys
FOREIGN KEY (project_id) REFERENCES projects(id)
```

#### Solution: Clean Data First

```sql
-- Only migrate records with valid references
INSERT INTO table_new
SELECT * FROM table_old
WHERE EXISTS (
  SELECT 1 FROM projects WHERE projects.id = table_old.project_id
)
```

### 5. Performance Issues

#### Pitfall: Missing Indexes After Migration

```typescript
// Forgot to recreate indexes = slow queries
db.exec('ALTER TABLE table_new RENAME TO table')
// Missing: CREATE INDEX statements
```

#### Solution: Index Checklist

```typescript
const requiredIndexes = ['idx_table_foreign_key', 'idx_table_status', 'idx_table_created_at']
// Verify all indexes created
```

### 6. Schema Evolution

#### Pitfall: No Forward Compatibility

```typescript
// Rigid schema that can't handle new fields
const data = JSON.parse(row.metadata) // Fails if new fields added
```

#### Solution: Flexible Metadata Fields

```typescript
metadata TEXT NOT NULL DEFAULT '{}' // Can store any JSON
settings TEXT NOT NULL DEFAULT '{}' // Extensible configuration
```

### 7. Migration Rollback

#### Pitfall: Irreversible Migrations

```typescript
up: (db) => {
  db.exec('DROP TABLE users') // Data permanently lost!
}
```

#### Solution: Always Implement Down()

```typescript
down: (db) => {
  // Restore original schema
  // Consider data recovery strategy
}
```

### 8. Query Compatibility

#### Pitfall: Breaking Existing Queries

```typescript
// Old: JSON_EXTRACT(data, '$.projectId')
// New: project_id
// Existing queries break!
```

#### Solution: Migration Notice

```typescript
// Document all query changes needed
const BREAKING_CHANGES = {
  'JSON_EXTRACT(data, "$.projectId")': 'project_id',
  'JSON_EXTRACT(data, "$.status")': 'status'
}
```

## Testing Checklist

- [ ] All required fields have NOT NULL constraints
- [ ] All JSON arrays have NOT NULL DEFAULT '[]'
- [ ] All foreign keys are indexed
- [ ] Common query patterns have composite indexes
- [ ] Boolean conversions work correctly
- [ ] Timestamps are consistently INTEGER
- [ ] Migration runs in a transaction
- [ ] Down migration restores original schema
- [ ] Edge cases handled (nulls, malformed data)
- [ ] Performance tested with realistic data volume

## Performance Optimization Tips

1. **Batch Operations**: Use transactions for bulk inserts
2. **Index Strategy**: Create indexes after data migration
3. **Vacuum Database**: Run VACUUM after major migrations
4. **Analyze Tables**: Run ANALYZE to update statistics
5. **Monitor Query Plans**: Use EXPLAIN QUERY PLAN

## Migration Safety Checklist

1. **Backup First**: Always backup before migration
2. **Test Environment**: Test on copy of production data
3. **Rollback Plan**: Ensure down() method works
4. **Monitoring**: Watch for errors during migration
5. **Gradual Rollout**: Consider feature flags
6. **Documentation**: Update all API docs
7. **Client Updates**: Ensure clients handle new schema
