# IndexBuilder Utility

The IndexBuilder provides a fluent API for defining indexes for use with IndexedStorage, making it easy to create type-safe and consistent index definitions.

## Key Features

- **Fluent API**: Chain method calls for easy index definition
- **Type Safety**: Full TypeScript support with proper types
- **Multiple Index Types**: Support for hash, B-tree, and inverted indexes
- **Sparse Indexes**: Optional indexes for fields that may be null/undefined
- **Compound Indexes**: Multi-field indexes for complex queries
- **Unique Constraints**: Enforce uniqueness at the index level
- **Consistent Naming**: Automatic generation of consistent index names
- **Convenience Builders**: Pre-configured builders for common patterns

## Basic Usage

```typescript
import { IndexBuilder } from '@octoprompt/storage'

const indexes = new IndexBuilder()
  .addHashIndex('name')
  .addHashIndex('path')
  .addDateIndex('created')
  .addDateIndex('updated')
  .addSparseIndex('deletedAt')
  .build()
```

## Index Types

### Hash Index
Best for exact equality lookups:
```typescript
.addHashIndex('status')  // Quick status filtering
.addHashIndex('categoryId')  // Fast category lookups
```

### B-Tree Index  
Best for range queries and sorting:
```typescript
.addBTreeIndex('price')  // Price range queries
.addDateIndex('created')  // Date range and chronological sorting
```

### Text/Inverted Index
Best for full-text search:
```typescript
.addTextIndex('title')  // Search in titles
.addTextIndex('content')  // Full-text content search
```

## Advanced Features

### Sparse Indexes
Only index entities that have non-null values:
```typescript
.addSparseIndex('deletedAt', 'btree')  // Only index deleted items
.addSparseIndex('assignedTo')  // Only index assigned tasks
```

### Compound Indexes
Index multiple fields together:
```typescript
.addCompoundIndex(['projectId', 'status'])  // Fast project+status queries
.addUniqueCompoundIndex(['userId', 'email'])  // Unique user-email pairs
```

### Unique Constraints
Enforce field uniqueness:
```typescript
.addUniqueIndex('email')  // Unique email addresses
.addUniqueIndex('slug')  // Unique URL slugs
```

## Convenience Builders

Pre-configured builders for common patterns:

### Standard Entity Indexes
```typescript
IndexBuilders.standard()  // id, created, updated
```

### Project-Related Indexes  
```typescript
IndexBuilders.project()  // id, projectId, created, updated
```

### Searchable Content Indexes
```typescript
IndexBuilders.searchable(['title', 'content'])  // Standard + text indexes
```

### User Management Indexes
```typescript
IndexBuilders.user()  // id, unique email, username, created, updated, sparse deletedAt
```

## Integration with IndexedStorage

```typescript
import { IndexedStorage, IndexBuilder } from '@octoprompt/storage'

class TaskStorage extends IndexedStorage<Task, TaskStorageSchema> {
  constructor(dataDir: string) {
    super(TaskStorageSchema, TaskSchema, dataDir, options)

    // Define indexes using IndexBuilder
    this.indexDefinitions = new IndexBuilder()
      .addHashIndex('id')
      .addHashIndex('projectId')
      .addHashIndex('status')
      .addTextIndex('title')
      .addDateIndex('created')
      .addSparseIndex('deletedAt', 'btree')
      .addCompoundIndex(['projectId', 'status'])
      .build()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'tasks.json')
  }

  // Use the indexes for efficient queries
  async getTasksByProject(projectId: number): Promise<Task[]> {
    return this.queryByIndex('idx_hash_projectId', projectId)
  }

  async searchTasks(query: string): Promise<Task[]> {
    return this.searchByIndex('idx_text_title', query)
  }
}
```

## Builder Options

Global options can be set for all indexes:

```typescript
const builder = new IndexBuilder({
  sparse: true,           // Make all indexes sparse by default
  namePrefix: 'myapp',    // Custom prefix for index names
  unique: false           // Default uniqueness setting
})

// Override per index
builder
  .addHashIndex('field1')                    // Uses global sparse: true
  .addHashIndex('field2', { sparse: false }) // Override to non-sparse
```

## Builder Management

The IndexBuilder provides methods for inspecting and modifying the index list:

```typescript
const builder = new IndexBuilder()
  .addHashIndex('name')
  .addHashIndex('email')

// Check if index exists
if (builder.hasIndex('idx_hash_name')) {
  // Remove it
  builder.removeIndex('idx_hash_name')
}

// Get current count
console.log(`${builder.getCount()} indexes defined`)

// Clone for variations
const extendedBuilder = builder.clone()
  .addTextIndex('description')

// Clear all indexes
builder.clear()
```

## Error Handling

The IndexBuilder validates inputs and prevents common mistakes:

```typescript
// These will throw errors:
builder.addCompoundIndex([])  // Empty field list
builder.addHashIndex('name').addHashIndex('name')  // Duplicate names

// These are handled gracefully:
builder.addHashIndex('field', { sparse: undefined })  // Uses default
```

## Generated Index Names

Index names follow a consistent pattern:
- `{prefix}_{type}_{fields}_{modifiers}`
- Examples:
  - `idx_hash_name`
  - `idx_btree_created`  
  - `idx_text_content`
  - `idx_hash_deletedAt_sparse`
  - `idx_hash_email_unique`
  - `idx_hash_projectId_status` (compound)

## Files

- **`index-builder.ts`** - Main IndexBuilder class and utilities
- **`index-builder.test.ts`** - Comprehensive unit tests  
- **`index-builder-integration.test.ts`** - Integration tests with IndexedStorage
- **`index-builder.example.ts`** - Usage examples and patterns

## Related

- [`IndexedStorage`](./indexed-storage.ts) - Storage class that uses IndexBuilder definitions
- [`IndexManager`](./index-manager.ts) - Low-level index management
- [`BaseStorage`](./base-storage.ts) - Base storage functionality