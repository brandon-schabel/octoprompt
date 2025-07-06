# Storage Migration Utilities

A comprehensive migration system for Promptliano's Storage V2 that provides version tracking, atomicity, and rollback capabilities.

## Features

- **Version tracking**: Migrations are tracked by version number with checksums
- **Function-based migrations**: Full TypeScript support with access to storage adapter
- **SQL support**: Can handle SQL string migrations (with appropriate adapter)
- **Transaction support**: Atomic execution with automatic rollback on failure
- **Migration history**: Persistent tracking of applied migrations
- **Logging**: Built-in progress logging with custom logger support
- **Helper functions**: Pre-built migration patterns for common operations

## Basic Usage

```typescript
import { runMigrations, createMigration } from '@promptliano/storage'
import { FileAdapter } from '@promptliano/storage'

// Define migrations
const migrations = [
  createMigration(1, 'Add status field to users', async (adapter) => {
    const all = await adapter.readAll()
    for (const [id, user] of all) {
      await adapter.write(id, { ...user, status: 'active' })
    }
  })
]

// Run migrations
const adapter = new FileAdapter('users')
await runMigrations({
  adapter,
  migrations,
  logger: console.log,
  useTransaction: true
})
```

## Migration Helpers

### Add Field Migration

```typescript
const migration = createAddFieldMigration(
  1,
  'Add role field',
  'role',
  'user' // default value
)
```

### Rename Field Migration

```typescript
const migration = createRenameFieldMigration(2, 'Rename username to name', 'username', 'name')
```

### Transform Migration

```typescript
const migration = createTransformMigration(3, 'Normalize emails', (record) => ({
  ...record,
  email: record.email.toLowerCase()
}))
```

### Filter Migration

```typescript
const migration = createFilterMigration(
  4,
  'Remove inactive users',
  (record) => record.lastLogin > Date.now() - 365 * 24 * 60 * 60 * 1000
)
```

## Migration with Rollback

```typescript
createMigration(
  5,
  'Add premium field',
  // Up migration
  async (adapter) => {
    const all = await adapter.readAll()
    for (const [id, user] of all) {
      await adapter.write(id, { ...user, premium: false })
    }
  },
  // Down migration (rollback)
  async (adapter) => {
    const all = await adapter.readAll()
    for (const [id, user] of all) {
      const { premium, ...rest } = user
      await adapter.write(id, rest)
    }
  }
)
```

## Checking Migration Status

```typescript
import { getMigrationStatus } from '@promptliano/storage'

const status = await getMigrationStatus(adapter, migrations)
console.log(`Applied: ${status.applied.length}`)
console.log(`Pending: ${status.pending.length}`)
```

## Integration with StorageV2

```typescript
import { StorageV2, runMigrations } from '@promptliano/storage'

// Run migrations first
await runMigrations({ adapter, migrations })

// Then create storage with latest schema
const storage = new StorageV2({
  adapter,
  schema: latestSchema,
  indexes: [...],
  cache: { maxSize: 100, ttl: 300000 }
})
```

## Migration Best Practices

1. **Version numbers**: Use sequential integers starting from 1
2. **Descriptions**: Write clear, concise descriptions
3. **Idempotency**: Migrations should be safe to run multiple times
4. **Testing**: Always test migrations on sample data first
5. **Backups**: Keep backups before running production migrations
6. **Transactions**: Use transactions when available for safety
7. **Validation**: Use `validateMigrations()` before running

## Migration History

Migration history is stored with `_migration_` prefix in the adapter:

```typescript
{
  version: 1,
  description: 'Add status field',
  appliedAt: 1703001234567,
  executionTime: 125,
  checksum: 'a1b2c3d4'
}
```

## Error Handling

Migrations throw errors with descriptive messages:

```typescript
try {
  await runMigrations({ adapter, migrations })
} catch (error) {
  console.error('Migration failed:', error.message)
  // Handle rollback or recovery
}
```
