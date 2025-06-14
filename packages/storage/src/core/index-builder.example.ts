/**
 * IndexBuilder usage examples
 * 
 * This file demonstrates various ways to use the IndexBuilder utility
 * for defining indexes in a type-safe and fluent manner.
 */

import { IndexBuilder, createIndexBuilder, IndexBuilders } from './index-builder'

// --- Basic Usage Examples ---

// Example 1: Simple hash index for fast lookups
const basicIndexes = new IndexBuilder()
  .addHashIndex('name')
  .addHashIndex('path')
  .addDateIndex('created')
  .addDateIndex('updated')
  .addSparseIndex('deletedAt')
  .build()

console.log('Basic indexes:', basicIndexes)

// Example 2: Complex project file indexes
const projectFileIndexes = new IndexBuilder()
  .addHashIndex('id')
  .addHashIndex('projectId')
  .addHashIndex('path')
  .addTextIndex('name')           // For file name search
  .addTextIndex('content')        // For full-text search
  .addDateIndex('created')
  .addDateIndex('updated')
  .addSparseIndex('deletedAt', 'btree')  // Sparse btree for date ranges
  .addCompoundIndex(['projectId', 'path'], 'hash') // Unique project+path
  .build()

// Example 3: User entity with unique constraints
const userIndexes = new IndexBuilder()
  .addHashIndex('id')
  .addUniqueIndex('email')        // Enforce unique emails
  .addHashIndex('username')
  .addTextIndex('fullName')       // Searchable name
  .addDateIndex('created')
  .addDateIndex('lastLogin')
  .addSparseIndex('deletedAt')    // Optional soft delete
  .build()

// Example 4: Chat message indexes for efficient queries
const chatMessageIndexes = new IndexBuilder()
  .addHashIndex('id')
  .addHashIndex('chatId')
  .addHashIndex('authorId')
  .addCompoundIndex(['chatId', 'created'], 'btree') // Chronological chat history
  .addTextIndex('content')        // Message search
  .addDateIndex('created')
  .addSparseIndex('editedAt')     // Track edits
  .build()

// --- Using Builder Options ---

// Example 5: Global sparse indexes
const sparseIndexes = new IndexBuilder({ sparse: true })
  .addHashIndex('optionalField1')  // Will be sparse
  .addHashIndex('optionalField2')  // Will be sparse
  .addHashIndex('requiredField', { sparse: false }) // Override to non-sparse
  .build()

// Example 6: Custom name prefix
const customPrefixIndexes = new IndexBuilder({ namePrefix: 'myapp' })
  .addHashIndex('userId')
  .addTextIndex('searchableText')
  .build()

// Example 7: Using createIndexBuilder helper
const helperBuiltIndexes = createIndexBuilder({ sparse: true })
  .addDateIndex('timestamp')
  .addHashIndex('category')
  .build()

// --- Convenience Builders ---

// Example 8: Standard entity indexes
const standardIndexes = IndexBuilders.standard().build()
// Creates: id (hash), created (btree), updated (btree)

// Example 9: Project-related entity indexes
const projectEntityIndexes = IndexBuilders.project().build()
// Creates: id (hash), projectId (hash), created (btree), updated (btree)

// Example 10: Searchable content entity
const searchableIndexes = IndexBuilders.searchable(['title', 'description']).build()
// Creates: standard indexes + text indexes for specified fields

// Example 11: User management indexes
const userManagementIndexes = IndexBuilders.user().build()
// Creates: id, unique email, username, created, updated, sparse deletedAt

// --- Advanced Usage ---

// Example 12: Custom index names and configurations
const advancedIndexes = new IndexBuilder()
  .addCustomIndex('user_email_lookup', 'hash', ['email'])
  .addCustomIndex('content_search', 'inverted', ['title', 'body'])
  .addCustomIndex('date_range_query', 'btree', ['startDate', 'endDate'])
  .build()

// Example 13: Compound unique constraints
const uniqueConstraintIndexes = new IndexBuilder()
  .addUniqueCompoundIndex(['userId', 'projectId'], 'hash') // Unique user-project pairs
  .addUniqueCompoundIndex(['email', 'tenantId'], 'hash')   // Tenant-scoped unique emails
  .build()

// Example 14: Builder chaining and modification
const dynamicBuilder = new IndexBuilder()
  .addHashIndex('id')
  .addHashIndex('status')

// Add conditional indexes based on requirements
if (process.env.FULL_TEXT_SEARCH === 'enabled') {
  dynamicBuilder.addTextIndex('searchableContent')
}

if (process.env.AUDIT_TRAIL === 'enabled') {
  dynamicBuilder
    .addDateIndex('createdAt')
    .addDateIndex('updatedAt')
    .addSparseIndex('deletedAt')
}

const conditionalIndexes = dynamicBuilder.build()

// Example 15: Builder inspection and management
const inspectableBuilder = new IndexBuilder()
  .addHashIndex('field1')
  .addHashIndex('field2')

console.log('Current index count:', inspectableBuilder.getCount())
console.log('Has field1 index:', inspectableBuilder.hasIndex('idx_hash_field1'))

// Remove an index if needed
inspectableBuilder.removeIndex('idx_hash_field2')

// Clone the builder for different variations
const clonedBuilder = inspectableBuilder.clone()
  .addTextIndex('additionalSearchField')

const originalIndexes = inspectableBuilder.build()  // Only field1
const extendedIndexes = clonedBuilder.build()       // field1 + text search

// --- Integration with IndexedStorage ---

import type { IndexDefinition } from './indexed-storage'

class MyEntityStorage {
  private indexDefinitions: IndexDefinition[]

  constructor() {
    // Define indexes using the builder
    this.indexDefinitions = new IndexBuilder()
      .addHashIndex('id')
      .addHashIndex('categoryId')
      .addTextIndex('name')
      .addDateIndex('created')
      .addSparseIndex('archivedAt')
      .build()
  }

  // Use indexes in storage implementation...
}

// Export examples for documentation
export {
  basicIndexes,
  projectFileIndexes,
  userIndexes,
  chatMessageIndexes,
  sparseIndexes,
  customPrefixIndexes,
  helperBuiltIndexes,
  standardIndexes,
  projectEntityIndexes,
  searchableIndexes,
  userManagementIndexes,
  advancedIndexes,
  uniqueConstraintIndexes,
  conditionalIndexes,
  MyEntityStorage
}