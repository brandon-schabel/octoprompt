# SQLite Adapters for StorageV2

This package provides two SQLite adapters for use with StorageV2:

1. **SQLiteAdapter** - Direct SQLite implementation with prepared statements
2. **SQLiteDbManagerAdapter** - Uses the existing DatabaseManager for compatibility

## SQLiteAdapter

A high-performance SQLite adapter that uses prepared statements and transactions.

### Features

- Prepared statements for optimal performance
- Transaction support for batch operations
- Automatic table and index creation
- JSON data storage with proper error handling
- Support for both string and number IDs
- Built-in statistics and maintenance methods

### Usage

```typescript
import { SQLiteAdapter, StorageV2 } from '@octoprompt/storage'
import { z } from 'zod'

// Define your schema
const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  created: z.number(),
  updated: z.number(),
})

// Create adapter
const adapter = new SQLiteAdapter<User>({
  tableName: 'users',
  dbPath: 'data/app.db', // Optional, defaults to data/storage.db
})

// Use with StorageV2
const storage = new StorageV2<User>({
  adapter,
  schema: UserSchema,
  indexes: [
    { field: 'email', type: 'hash' },
    { field: 'created', type: 'btree' },
  ],
  cache: {
    maxSize: 100,
    ttl: 300000, // 5 minutes
  },
})
```

### Batch Operations

```typescript
// Batch write
await adapter.writeBatch([
  { id: 1, data: user1 },
  { id: 2, data: user2 },
  { id: 3, data: user3 },
])

// Batch delete
const deletedCount = await adapter.deleteBatch([1, 2, 3])
```

### Maintenance

```typescript
// Get statistics
const stats = await adapter.getStats()
console.log(`Total items: ${stats.count}`)
console.log(`Average size: ${stats.avgSize} bytes`)

// Vacuum database to reclaim space
await adapter.vacuum()

// Close connection when done
adapter.close()
```

## SQLiteDbManagerAdapter

An adapter that uses the existing DatabaseManager singleton for compatibility with the current database structure.

### Features

- Compatible with existing database schema
- Supports JSON field queries
- Date range queries
- Shared database connection via singleton
- Transaction support

### Usage

```typescript
import { SQLiteDbManagerAdapter, StorageV2 } from '@octoprompt/storage'

// Create adapter (uses existing database)
const adapter = new SQLiteDbManagerAdapter<User>('users')

// Use with StorageV2
const storage = new StorageV2<User>({
  adapter,
  schema: UserSchema,
  // ... other config
})

// Additional DatabaseManager features
const admins = await adapter.findByJsonField('$.role', 'admin')
const recent = await adapter.findByDateRange(yesterday, today)
```

## Choosing an Adapter

### Use SQLiteAdapter when:
- You want a standalone SQLite database
- You need optimal performance with prepared statements
- You want to manage the database lifecycle yourself
- You need batch operations

### Use SQLiteDbManagerAdapter when:
- You need compatibility with existing OctoPrompt database
- You want to share the database connection with other parts of the app
- You need JSON field queries
- You're migrating existing code to StorageV2

## Performance Considerations

1. **Prepared Statements**: SQLiteAdapter uses prepared statements which are faster for repeated operations
2. **Transactions**: Both adapters support transactions for atomic operations
3. **Indexing**: Create indexes on frequently queried fields
4. **Caching**: Use StorageV2's caching feature to reduce database reads

## Migration Guide

To migrate from the old storage system to StorageV2 with SQLite:

```typescript
// Old way
const storage = new ProjectStorage()
const project = await storage.get(id)

// New way with SQLiteDbManagerAdapter
const adapter = new SQLiteDbManagerAdapter<Project>('projects')
const storage = new StorageV2<Project>({
  adapter,
  schema: ProjectSchema,
})
const project = await storage.get(id)
```

## Database Schema

Both adapters use the same table structure:

```sql
CREATE TABLE tablename (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
)
```

The `data` column stores JSON-serialized objects.