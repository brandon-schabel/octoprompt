# Storage Package Architecture Guide

The `/packages/storage` directory provides a comprehensive database storage layer built on SQLite, featuring column-based schemas, migrations, transactions, and performance optimization patterns.

## Overview

This package implements a high-performance storage layer that has transitioned from JSON blob storage to proper SQLite column-based schemas for significant performance improvements (10-100x faster queries).

### Core Components

- **DatabaseManager**: Centralized SQLite database management
- **Storage Classes**: Entity-specific storage implementations
- **Migration System**: Structured schema evolution with JSON-to-column migrations
- **Transaction Support**: ACID-compliant database operations
- **Performance Optimization**: Indexing, prepared statements, and batching

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze implementation quality and suggest improvements
   - Ensure proper indexing, transaction handling, and query optimization

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on storage class patterns and migration strategies

3. **Package-Specific Agents**
   - Use `promptliano-sqlite-expert` for database changes and migrations
   - Use `zod-schema-architect` for validation schemas
   - Use `promptliano-service-architect` when storage impacts services

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about what was implemented/changed
- Use multiple agents concurrently for maximum efficiency
- Include performance benchmarks for database changes

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define data structure (source of truth)
2. **Storage layer** - Create tables with validation (this package)
3. **Services** - Implement business logic
4. **MCP tools** - Enable AI access
5. **API routes** - Create endpoints with OpenAPI
6. **API client** - Add to single api-client.ts file
7. **React hooks** - Setup with TanStack Query
8. **UI components** - Build with shadcn/ui
9. **Page integration** - Wire everything together
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles step 2: Creating storage tables with proper column-based schemas, migrations, and Zod validations.

See main `/CLAUDE.md` for complete flow documentation.

## Key Architecture Patterns

### 1. DatabaseManager Singleton

```typescript
import { getDb } from './database-manager'

class MyStorage {
  private getDb(): DatabaseManager {
    return getDb() // Always get fresh instance
  }
}
```

**Key Features:**

- Singleton pattern with lazy initialization
- Platform-appropriate database paths (macOS, Windows, Linux)
- Performance optimizations (WAL mode, memory-mapped I/O, 64MB cache)
- Automatic migration execution
- Unique ID generation with collision avoidance

### 2. BaseStorage Abstract Class Pattern ⭐ **NEW PATTERN**

All storage classes now extend the `BaseStorage` abstract class for consistency and reduced duplication:

```typescript
import { BaseStorage } from './base-storage'
import { EntitySchema, type Entity } from '@promptliano/schemas'

export class EntityStorage extends BaseStorage<Entity> {
  protected tableName = 'entities'
  protected schema = EntitySchema

  // BaseStorage provides these methods automatically:
  // - readAll(projectId): Promise<Record<string, Entity>>
  // - writeAll(projectId, entities): Promise<Record<string, Entity>>
  // - readById(id, projectId?): Promise<Entity | null>
  // - writeById(id, entity, projectId?): Promise<Entity>
  // - deleteById(id, projectId?): Promise<boolean>
  // - exists(id, projectId?): Promise<boolean>

  // Implement required abstract methods
  protected convertRowToEntity(row: any): Entity {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description || '',
      tags: this.safeJsonParse(row.tags, []),
      metadata: this.safeJsonParse(row.metadata, {}),
      created: row.created_at,
      updated: row.updated_at
    }
  }

  protected convertEntityToRow(entity: Entity): any {
    return {
      id: entity.id,
      project_id: entity.projectId,
      name: entity.name,
      description: entity.description,
      tags: JSON.stringify(entity.tags || []),
      metadata: JSON.stringify(entity.metadata || {}),
      created_at: entity.created,
      updated_at: entity.updated
    }
  }

  protected getSelectQuery(): string {
    return `
      SELECT id, project_id, name, description, tags, metadata, created_at, updated_at
      FROM entities
      WHERE project_id = ?
      ORDER BY created_at DESC
    `
  }

  protected getInsertQuery(): string {
    return `
      INSERT INTO entities (id, project_id, name, description, tags, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  }

  protected getUpdateQuery(): string {
    return `
      UPDATE entities 
      SET name = ?, description = ?, tags = ?, metadata = ?, updated_at = ?
      WHERE id = ? AND project_id = ?
    `
  }

  protected getDeleteQuery(): string {
    return 'DELETE FROM entities WHERE project_id = ?'
  }

  // Add entity-specific methods as needed
  async findByName(projectId: number, name: string): Promise<Entity | null> {
    const db = this.getDb().getDatabase()
    const query = db.prepare('SELECT * FROM entities WHERE project_id = ? AND name = ?')
    const row = query.get(projectId, name) as any
    return row ? this.convertRowToEntity(row) : null
  }
}

export const entityStorage = new EntityStorage()
```

### 3. Storage Helper Utilities ⭐ **NEW UTILITIES**

The storage layer now includes comprehensive helper utilities:

```typescript
import { 
  validateData, 
  safeJsonParse, 
  generateEntityId, 
  formatSQLError,
  createStorageHelpers 
} from './utils/storage-helpers'

// Validation helper with detailed error messages
const validatedEntity = await validateData(rawData, EntitySchema, 'Entity creation')

// Safe JSON parsing with fallbacks
const tags = safeJsonParse(row.tags, [], 'entity.tags')

// Generate unique IDs with collision avoidance
const newId = generateEntityId()

// SQL error formatting for consistent error messages
try {
  query.run(values)
} catch (error) {
  throw formatSQLError(error, 'entity creation', { projectId, entityId })
}
```

### 4. Transaction Helper Utilities ⭐ **NEW PATTERN**

```typescript
import { withTransaction, executeBulkOperation } from './utils/transaction-helpers'

// Automatic transaction wrapping
await withTransaction(async (db) => {
  await entityStorage.create(entity1)
  await entityStorage.create(entity2)
  await relatedStorage.update(relatedId, data)
})

// Bulk operations with transaction safety
const results = await executeBulkOperation(
  entities,
  async (entity) => entityStorage.create(entity),
  { continueOnError: false, batchSize: 100 }
)
```

### 5. Legacy Storage Class Pattern

For reference, the old pattern (being migrated to BaseStorage):

```typescript
// packages/storage/src/entity-storage.ts
import { EntitySchema, type Entity } from '@promptliano/schemas'
// IMPORTANT: Always import types from schemas using z.infer
// Never manually define types - they are all derived from Zod schemas
import { getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'

class EntityStorage {
  private getDb(): DatabaseManager {
    return getDb()
  }

  async readEntities(projectId: number): Promise<Record<string, Entity>> {
    const db = this.getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT id, field1, field2, json_field, created_at, updated_at
      FROM entities
      WHERE project_id = ?
      ORDER BY created_at DESC
    `)

    const rows = query.all(projectId) as any[]
    const entities: Record<string, Entity> = {}

    for (const row of rows) {
      const entity: Entity = {
        id: row.id,
        field1: row.field1,
        field2: row.field2,
        jsonField: safeJsonParse(row.json_field, [], 'entity.jsonField'),
        created: row.created_at,
        updated: row.updated_at
      }

      const validated = await validateData(entity, EntitySchema, `entity ${entity.id}`)
      entities[String(validated.id)] = validated
    }

    return entities
  }

  async writeEntities(projectId: number, entities: Record<string, Entity>): Promise<Record<string, Entity>> {
    const db = this.getDb()
    const database = db.getDatabase()

    const validated = await validateData(entities, EntitiesStorageSchema, 'entities')

    database.transaction(() => {
      // Delete existing entities
      const deleteQuery = database.prepare(`DELETE FROM entities WHERE project_id = ?`)
      deleteQuery.run(projectId)

      // Insert new entities
      const insertQuery = database.prepare(`
        INSERT INTO entities (id, project_id, field1, field2, json_field, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const [id, entity] of Object.entries(validated)) {
        insertQuery.run(
          id,
          entity.projectId,
          entity.field1,
          entity.field2,
          JSON.stringify(entity.jsonField || []),
          entity.created,
          entity.updated
        )
      }
    })()

    return validated
  }
}

export const entityStorage = new EntityStorage()
```

## Migration System

### JSON to Column Migration Pattern

The storage layer is transitioning from JSON blob storage to column-based schemas. Here's the established pattern:

```typescript
// packages/storage/src/migrations/00X-entity-columns.ts
export const entityColumnsMigration = {
  version: X,
  description: 'Convert entity from JSON storage to column-based table',

  up: (db: Database) => {
    console.log('[Migration] Starting entity column migration...')

    // Create new table with proper columns
    db.exec(`
      CREATE TABLE entities_new (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        json_array_field TEXT NOT NULL DEFAULT '[]', -- JSON array as TEXT
        enum_field TEXT DEFAULT 'default' CHECK (enum_field IN ('option1', 'option2')),
        nullable_field TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Drop old JSON table and rename
    db.exec(`DROP TABLE IF EXISTS entities`)
    db.exec(`ALTER TABLE entities_new RENAME TO entities`)

    // Create indexes
    db.exec(`CREATE INDEX idx_entities_project_id ON entities(project_id)`)
    db.exec(`CREATE INDEX idx_entities_created_at ON entities(created_at)`)
    db.exec(`CREATE INDEX idx_entities_project_name ON entities(project_id, name)`)

    console.log('[Migration] Entity table converted successfully')
  },

  down: (db: Database) => {
    // Revert to JSON storage (for rollback capability)
    db.exec(`
      CREATE TABLE entities_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    db.exec(`DROP TABLE IF EXISTS entities`)
    db.exec(`ALTER TABLE entities_old RENAME TO entities`)
  }
}
```

### Migration Best Practices

1. **Schema Design:**
   - Use `INTEGER` for IDs and timestamps
   - Use `TEXT` for strings and JSON arrays
   - Add `NOT NULL DEFAULT '[]'` for JSON array fields
   - Include CHECK constraints for enums
   - Define foreign keys with CASCADE options

2. **JSON Array Handling:**

   ```typescript
   // In migration
   json_field TEXT NOT NULL DEFAULT '[]'

   // In storage class
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

3. **Index Strategy:**

   ```sql
   -- Always index foreign keys
   CREATE INDEX idx_table_project_id ON table(project_id)

   -- Index timestamp fields for sorting
   CREATE INDEX idx_table_created_at ON table(created_at)
   CREATE INDEX idx_table_updated_at ON table(updated_at)

   -- Composite indexes for common query patterns
   CREATE INDEX idx_table_project_status ON table(project_id, status)
   ```

## Transaction Patterns

### 1. Simple Transaction

```typescript
async writeData(data: MyData[]): Promise<void> {
  const db = this.getDb()
  const database = db.getDatabase()

  database.transaction(() => {
    const insertQuery = database.prepare(`INSERT INTO table (...) VALUES (...)`)

    for (const item of data) {
      insertQuery.run(...values)
    }
  })() // Note the () at the end to execute
}
```

### 2. Complex Transaction with Validation

```typescript
async updateComplexData(updates: ComplexUpdate[]): Promise<void> {
  const db = this.getDb()
  const database = db.getDatabase()

  // Validate outside transaction for better error handling
  const validated = await Promise.all(
    updates.map(update => validateData(update, Schema, 'update'))
  )

  database.transaction(() => {
    for (const update of validated) {
      // Multiple related operations
      updateQuery1.run(...values1)
      updateQuery2.run(...values2)
      deleteQuery.run(update.id)
    }
  })()
}
```

## Query Optimization Patterns

### 1. Prepared Statements

```typescript
// Prepare once, use many times
const query = database.prepare(`
  SELECT * FROM table 
  WHERE field1 = ? AND field2 = ?
  ORDER BY created_at DESC
`)

// Use multiple times efficiently
const results1 = query.all(value1, value2)
const results2 = query.all(value3, value4)
```

### 2. Bulk Operations

```typescript
// Use transactions for bulk operations
const insertMany = database.transaction((items: Item[]) => {
  const insert = database.prepare(`INSERT INTO table (...) VALUES (...)`)
  for (const item of items) {
    insert.run(...values)
  }
})

// Execute the bulk operation
insertMany(largeDataArray)
```

### 3. Optimized Joins

```typescript
// Single query instead of N+1 queries
const query = database.prepare(`
  SELECT 
    t.id, t.name, t.status,
    tt.id as task_id, tt.content, tt.done
  FROM tickets t
  LEFT JOIN ticket_tasks tt ON t.id = tt.ticket_id
  WHERE t.project_id = ?
  ORDER BY t.id, tt.order_index
`)

// Process results efficiently
const ticketsMap = new Map()
for (const row of query.all(projectId)) {
  if (!ticketsMap.has(row.id)) {
    ticketsMap.set(row.id, {
      ticket: { id: row.id, name: row.name, status: row.status },
      tasks: []
    })
  }

  if (row.task_id) {
    ticketsMap.get(row.id).tasks.push({
      id: row.task_id,
      content: row.content,
      done: Boolean(row.done)
    })
  }
}
```

## Error Handling Patterns

### 1. Storage Layer Errors

```typescript
async readData(id: number): Promise<Data | null> {
  try {
    const db = this.getDb()
    const database = db.getDatabase()

    const query = database.prepare(`SELECT * FROM table WHERE id = ?`)
    const row = query.get(id) as any

    if (!row) return null

    const data = convertRowToData(row)
    return await validateData(data, DataSchema, `data ${id}`)
  } catch (error: any) {
    console.error(`Error reading data ${id}:`, error)
    throw new ApiError(500, `Failed to read data ${id}`, 'DB_READ_ERROR')
  }
}
```

### 2. Validation Errors

```typescript
async function validateData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): Promise<T> {
  const result = await schema.safeParseAsync(data)
  if (!result.success) {
    console.error(`Validation failed for ${context}:`, result.error.errors)
    throw new ApiError(400, `Validation failed for ${context}`, 'VALIDATION_ERROR')
  }
  return result.data
}
```

## Testing Patterns

### 1. Test Utilities

```typescript
// packages/storage/src/test-utils.ts
import { clearAllData, resetTestDatabase } from './test-utils'

describe('MyStorage', () => {
  beforeEach(async () => {
    await resetTestDatabase() // Clean state + run migrations
  })

  afterAll(async () => {
    await clearAllData() // Clean up
  })
})
```

### 2. Transaction Tests

```typescript
import { withTestTransaction } from './test-utils'

it('should handle transaction rollback', () => {
  withTestTransaction(() => {
    // All operations in this block are rolled back automatically
    const result = storage.create(testData)
    expect(result).toBeDefined()

    // This won't persist after the test
    return result
  })
})
```

### 3. Performance Tests

```typescript
it('should handle large datasets efficiently', async () => {
  const largeDataset = Array.from({ length: 1000 }, createTestItem)

  const startTime = performance.now()
  await storage.writeBulk(largeDataset)
  const writeTime = performance.now() - startTime

  expect(writeTime).toBeLessThan(1000) // < 1 second

  const readStart = performance.now()
  const results = await storage.readAll()
  const readTime = performance.now() - readStart

  expect(readTime).toBeLessThan(100) // < 100ms
  expect(results.length).toBe(1000)
})
```

## Performance Optimization

### 1. Database Configuration

The DatabaseManager includes optimized SQLite settings:

```typescript
// Automatic performance optimizations
db.exec('PRAGMA journal_mode = WAL') // Write-Ahead Logging
db.exec('PRAGMA synchronous = NORMAL') // Balanced durability
db.exec('PRAGMA cache_size = -64000') // 64MB cache
db.exec('PRAGMA temp_store = MEMORY') // In-memory temp tables
db.exec('PRAGMA mmap_size = 268435456') // 256MB memory-mapped I/O
```

### 2. Query Performance

```typescript
// Good: Index-friendly queries
const query = database.prepare(`
  SELECT * FROM tickets 
  WHERE project_id = ? AND status = ?
  ORDER BY created_at DESC
`)

// Bad: JSON_EXTRACT is slower
const badQuery = database.prepare(`
  SELECT * FROM tickets 
  WHERE JSON_EXTRACT(data, '$.projectId') = ?
`)
```

### 3. Benchmarking

Use the built-in benchmarking tools:

```bash
cd packages/storage
bun run src/benchmarks/sqlite-performance.ts
```

## Integration with Service Layer

### 1. Service Layer Usage

```typescript
// packages/services/src/entity-service.ts
import { entityStorage } from '@promptliano/storage'

export class EntityService extends BaseService {
  async getEntities(projectId: number): Promise<Entity[]> {
    const entities = await entityStorage.readEntities(projectId)
    return Object.values(entities)
  }

  async createEntity(projectId: number, data: CreateEntityData): Promise<Entity> {
    const entity: Entity = {
      id: entityStorage.generateId(),
      projectId,
      ...data,
      created: Date.now(),
      updated: Date.now()
    }

    await entityStorage.addEntity(entity)
    return entity
  }
}
```

### 2. API Integration

```typescript
// packages/server/src/routes/entity-routes.ts
import { entityService } from '@promptliano/services'

export const entityRoutes = new Hono()
  .get('/:projectId/entities', async (c) => {
    const projectId = Number(c.req.param('projectId'))
    const entities = await entityService.getEntities(projectId)
    return c.json(entities)
  })
  .post('/:projectId/entities', async (c) => {
    const projectId = Number(c.req.param('projectId'))
    const data = await c.req.json()
    const entity = await entityService.createEntity(projectId, data)
    return c.json(entity, 201)
  })
```

## Common Patterns Summary

### Storage Class Checklist

When creating a new storage class:

- [ ] Import required schemas and types
- [ ] Use `getDb()` for database access
- [ ] Implement `safeJsonParse` helper for JSON fields
- [ ] Use `validateData` for all input/output validation
- [ ] Wrap multi-statement operations in transactions
- [ ] Use prepared statements for repeated queries
- [ ] Add appropriate error handling with `ApiError`
- [ ] Include unique ID generation methods
- [ ] Add utility methods for common queries
- [ ] Export singleton instance

### Migration Checklist

When creating a new migration:

- [ ] Use sequential version numbers
- [ ] Include descriptive migration description
- [ ] Create new table with `_new` suffix
- [ ] Define proper column types and constraints
- [ ] Add NOT NULL DEFAULT '[]' for JSON arrays
- [ ] Include foreign key relationships
- [ ] Create appropriate indexes
- [ ] Drop old table and rename new one
- [ ] Implement rollback in `down()` method
- [ ] Add to migrations index file

This storage architecture provides a robust, performant, and maintainable foundation for all data persistence needs in Promptliano, with clear patterns for extension and optimization.
