# OctoPrompt Storage System V2

This document describes the enhanced storage system that addresses the limitations of the original file-based JSON storage implementation.

## Overview

The new storage system provides:

1. **Abstraction Layer** - Consistent interface across all storage modules
2. **Caching** - In-memory LRU cache with configurable TTL
3. **Indexing** - Fast queries using hash and B-tree indexes
4. **Concurrency Control** - File locking to prevent race conditions
5. **Migration Support** - Versioned migrations for schema changes
6. **Performance Optimizations** - Atomic writes, streaming support (planned)

## Architecture

### Base Storage Class

The `BaseStorage` class provides common functionality for all storage implementations:

```typescript
import { BaseStorage } from '@octoprompt/storage'

class MyStorage extends BaseStorage<MyEntity, MyStorageType> {
  constructor(options?: StorageOptions) {
    super(storageSchema, entitySchema, 'my_data', options)
  }
  
  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'index.json')
  }
  
  protected getEntityPath(id: number): string | null {
    // Return path for entity-specific data, or null if not needed
    return null
  }
}
```

### Storage Options

```typescript
interface StorageOptions {
  basePath?: string        // Base directory (default: process.cwd())
  cacheEnabled?: boolean   // Enable caching (default: true)
  cacheTTL?: number       // Cache TTL in ms (default: 5 minutes)
  maxCacheSize?: number   // Max cache entries (default: 100)
  lockTimeout?: number    // Lock timeout in ms (default: 30 seconds)
}
```

### Index Manager

The `IndexManager` provides efficient querying capabilities:

```typescript
import { IndexManager } from '@octoprompt/storage'

const indexManager = new IndexManager(basePath, dataDir)

// Create indexes
await indexManager.createIndex({
  name: 'users_by_email',
  type: 'hash',
  fields: ['email'],
  unique: true
})

// Query index
const userIds = await indexManager.query('users_by_email', 'user@example.com')

// Range query
const recentUsers = await indexManager.queryRange(
  'users_by_created',
  startDate.getTime(),
  endDate.getTime()
)
```

### Migration Manager

The `MigrationManager` handles schema evolution:

```typescript
import { MigrationManager } from '@octoprompt/storage'

const migrationManager = new MigrationManager(basePath)

// Register migrations
migrationManager.register({
  version: '1.0.0',
  description: 'Add user indexes',
  async up() {
    // Migration logic
  },
  async down() {
    // Rollback logic
  }
})

// Run migrations
await migrationManager.migrate()

// Check status
await migrationManager.status()
```

## Usage Examples

### Project Storage V2

The enhanced project storage demonstrates the new features:

```typescript
import { ProjectStorageV2 } from '@octoprompt/storage'

const projectStorage = new ProjectStorageV2({
  cacheEnabled: true,
  cacheTTL: 10 * 60 * 1000 // 10 minutes
})

// Create project
const project = await projectStorage.create({
  name: 'My Project',
  path: '/path/to/project',
  description: 'Project description'
})

// Query by name (uses index)
const projects = await projectStorage.findByName('My Project')

// Query by date range (uses index)
const recentProjects = await projectStorage.listByDateRange(
  new Date('2024-01-01'),
  new Date()
)

// File management with versioning
const fileStorage = projectStorage.getFileStorage(project.id)

// Create file
const file = await fileStorage.create({
  name: 'index.ts',
  path: 'src/index.ts',
  content: 'console.log("Hello")',
  // ... other fields
})

// Create new version
const newVersion = await fileStorage.createVersion(
  file.id,
  'console.log("Hello, World!")'
)

// Get file history
const versions = await fileStorage.getVersions(file.id)
```

## Performance Comparison

### Query Performance

| Operation | Old Storage | New Storage (Cold) | New Storage (Cached) |
|-----------|-------------|-------------------|---------------------|
| Get by ID | O(n) | O(1) + disk read | O(1) memory |
| Find by field | O(n) | O(1) with index | O(1) with index |
| List all | O(n) | O(n) | O(1) if cached |
| Range query | O(n) | O(log n) with B-tree | O(log n) |

### Concurrency

| Scenario | Old Storage | New Storage |
|----------|-------------|-------------|
| Concurrent writes | Race conditions | Queued with locks |
| ID collisions | Basic increment | Locked generation |
| File corruption | Possible | Atomic writes |

## Migration Guide

### 1. Update Imports

```typescript
// Old
import { projectStorage } from '@octoprompt/storage'

// New
import { ProjectStorageV2 } from '@octoprompt/storage'
const projectStorage = new ProjectStorageV2()
```

### 2. Run Migrations

```typescript
import { MigrationManager, addIndexesMigration } from '@octoprompt/storage'

const migrationManager = new MigrationManager(process.cwd())
migrationManager.register(addIndexesMigration)
await migrationManager.migrate()
```

### 3. Update Service Layer

Services can continue using the same interface, but gain performance benefits:

```typescript
// No changes needed in most cases
const project = await projectStorage.getById(projectId)

// New query methods available
const projectsByPath = await projectStorage.findByPath('/specific/path')
```

## Testing

The new storage system includes comprehensive tests:

```bash
# Run storage tests
cd packages/storage
bun test

# Test files:
# - src/__tests__/base-storage.test.ts
# - src/__tests__/index-manager.test.ts
# - src/__tests__/migration-manager.test.ts
```

## Future Enhancements

1. **Streaming Support** - For large files
2. **Database Backend** - SQLite option for better performance
3. **Distributed Locking** - For multi-process scenarios
4. **Query Language** - More complex queries
5. **Compression** - Automatic compression for large data
6. **Encryption** - At-rest encryption support

## Best Practices

1. **Always use indexes** for frequently queried fields
2. **Enable caching** for read-heavy workloads
3. **Set appropriate cache TTL** based on data volatility
4. **Use migrations** for schema changes
5. **Monitor cache hit rates** in production
6. **Backup before migrations** using `migrationManager.backup()`

## Troubleshooting

### Cache Issues
- Clear cache: `storage.clearCache()`
- Check stats: `storage.getCacheStats()`
- Disable temporarily: `new Storage({ cacheEnabled: false })`

### Index Issues
- Rebuild indexes: `await storage.rebuildIndexes()`
- Check index stats: `await indexManager.getIndexStats('index_name')`
- List all indexes: `await indexManager.listIndexes()`

### Lock Timeouts
- Increase timeout: `new Storage({ lockTimeout: 60000 })`
- Check for stuck processes
- Manually clear locks (restart application)

### Migration Failures
- Check migration status: `await migrationManager.status()`
- Restore from backup: `await migrationManager.restore(backupPath)`
- Run specific version: `await migrationManager.migrate('1.0.0')`