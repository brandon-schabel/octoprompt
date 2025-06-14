/**
 * IndexBuilder utility for creating index definitions with a fluent API
 * 
 * Recent changes:
 * 1. Created initial IndexBuilder with fluent API for defining indexes
 * 2. Added support for different index types (hash, btree, inverted)
 * 3. Implemented sparse index support and compound indexes
 * 4. Added consistent index name generation
 * 5. Ensured type safety and compatibility with IndexedStorage
 */

import type { IndexDefinition } from './indexed-storage'

export type IndexType = 'hash' | 'btree' | 'inverted'

export interface IndexBuilderOptions {
  /** Whether to include null/undefined values in the index */
  sparse?: boolean
  /** Whether this index should enforce uniqueness */
  unique?: boolean
  /** Custom prefix for index names */
  namePrefix?: string
}

export class IndexBuilder {
  private indexes: IndexDefinition[] = []
  private options: IndexBuilderOptions

  constructor(options: IndexBuilderOptions = {}) {
    this.options = options
  }

  /**
   * Set the prefix for all index names
   * This is useful for namespacing indexes per entity type
   */
  setPrefix(prefix: string): this {
    this.options.namePrefix = prefix
    return this
  }

  /**
   * Add a hash index for exact key lookups
   * Best for equality queries on single fields
   */
  addHashIndex(field: string, options: Partial<IndexBuilderOptions> = {}): this {
    return this.addIndex('hash', [field], options)
  }

  /**
   * Add a B-tree index for range queries and sorting
   * Best for range queries, sorting, and numeric comparisons
   */
  addBTreeIndex(field: string, options: Partial<IndexBuilderOptions> = {}): this {
    return this.addIndex('btree', [field], options)
  }

  /**
   * Add an inverted index for text search
   * Best for full-text search capabilities
   */
  addTextIndex(field: string, options: Partial<IndexBuilderOptions> = {}): this {
    return this.addIndex('inverted', [field], options)
  }

  /**
   * Add a date index (uses B-tree for range queries)
   * Convenience method for date/timestamp fields
   */
  addDateIndex(field: string, options: Partial<IndexBuilderOptions> = {}): this {
    return this.addIndex('btree', [field], options)
  }

  /**
   * Add a sparse index that only indexes documents with non-null values
   * Useful for optional fields
   */
  addSparseIndex(field: string, type: IndexType = 'hash', options: Partial<IndexBuilderOptions> = {}): this {
    return this.addIndex(type, [field], { ...options, sparse: true })
  }

  /**
   * Add a compound index across multiple fields
   * Creates a single index that covers multiple fields for complex queries
   */
  addCompoundIndex(fields: string[], type: IndexType = 'hash', options: Partial<IndexBuilderOptions> = {}): this {
    if (fields.length === 0) {
      throw new Error('Compound index must have at least one field')
    }
    return this.addIndex(type, fields, options)
  }

  /**
   * Add a unique index that enforces uniqueness constraints
   */
  addUniqueIndex(field: string, type: IndexType = 'hash', options: Partial<IndexBuilderOptions> = {}): this {
    return this.addIndex(type, [field], { ...options, unique: true })
  }

  /**
   * Add a multi-field unique constraint
   */
  addUniqueCompoundIndex(fields: string[], type: IndexType = 'hash', options: Partial<IndexBuilderOptions> = {}): this {
    if (fields.length === 0) {
      throw new Error('Unique compound index must have at least one field')
    }
    return this.addIndex(type, fields, { ...options, unique: true })
  }

  /**
   * Add a custom index with full control over configuration
   */
  addCustomIndex(
    name: string,
    type: IndexType,
    fields: string[],
    options: Partial<IndexBuilderOptions> = {}
  ): this {
    if (fields.length === 0) {
      throw new Error('Index must have at least one field')
    }

    const mergedOptions = { ...this.options, ...options }
    
    this.indexes.push({
      name,
      type,
      fields: [...fields], // Clone to prevent mutation
      sparse: mergedOptions.sparse
    })

    return this
  }

  /**
   * Remove an index by name
   */
  removeIndex(name: string): this {
    this.indexes = this.indexes.filter(index => index.name !== name)
    return this
  }

  /**
   * Clear all indexes
   */
  clear(): this {
    this.indexes = []
    return this
  }

  /**
   * Build and return the final index definitions
   */
  build(): IndexDefinition[] {
    // Return a deep copy to prevent external mutation
    return this.indexes.map(index => ({
      name: index.name,
      type: index.type,
      fields: [...index.fields],
      sparse: index.sparse
    }))
  }

  /**
   * Get the current indexes without building (for inspection)
   */
  getIndexes(): Readonly<IndexDefinition[]> {
    return [...this.indexes]
  }

  /**
   * Get count of defined indexes
   */
  getCount(): number {
    return this.indexes.length
  }

  /**
   * Check if an index with the given name exists
   */
  hasIndex(name: string): boolean {
    return this.indexes.some(index => index.name === name)
  }

  /**
   * Create a new builder with the same options
   */
  clone(): IndexBuilder {
    const newBuilder = new IndexBuilder(this.options)
    newBuilder.indexes = this.indexes.map(index => ({ ...index, fields: [...index.fields] }))
    return newBuilder
  }

  // --- Private Methods ---

  private addIndex(type: IndexType, fields: string[], options: Partial<IndexBuilderOptions> = {}): this {
    if (fields.length === 0) {
      throw new Error('Index must have at least one field')
    }

    const mergedOptions = { ...this.options, ...options }
    const name = this.generateIndexName(type, fields, mergedOptions)
    
    // Check for duplicate index names
    if (this.hasIndex(name)) {
      throw new Error(`Index with name '${name}' already exists`)
    }

    this.indexes.push({
      name,
      type,
      fields: [...fields], // Clone to prevent mutation
      sparse: mergedOptions.sparse
    })

    return this
  }

  private generateIndexName(type: IndexType, fields: string[], options: IndexBuilderOptions): string {
    const prefix = options.namePrefix || 'idx'
    const typePrefix = this.getTypePrefix(type)
    const fieldsStr = fields.join('_').replace(/[^a-zA-Z0-9_]/g, '_')
    const sparseStr = options.sparse ? '_sparse' : ''
    const uniqueStr = options.unique ? '_unique' : ''
    
    return `${prefix}_${typePrefix}_${fieldsStr}${sparseStr}${uniqueStr}`
  }

  private getTypePrefix(type: IndexType): string {
    switch (type) {
      case 'hash':
        return 'hash'
      case 'btree':
        return 'btree'
      case 'inverted':
        return 'text'
      default:
        return 'idx'
    }
  }
}

// --- Convenience Functions ---

/**
 * Create a new IndexBuilder instance
 */
export function createIndexBuilder(options: IndexBuilderOptions = {}): IndexBuilder {
  return new IndexBuilder(options)
}

/**
 * Quick builder for common index patterns
 */
export const IndexBuilders = {
  /**
   * Standard indexes for entities with id, created, updated
   */
  standard(): IndexBuilder {
    return new IndexBuilder()
      .addHashIndex('id')
      .addDateIndex('created')
      .addDateIndex('updated')
  },

  /**
   * Indexes optimized for project-related entities
   */
  project(): IndexBuilder {
    return new IndexBuilder()
      .addHashIndex('id')
      .addHashIndex('projectId')
      .addDateIndex('created')
      .addDateIndex('updated')
  },

  /**
   * Indexes for searchable text content
   */
  searchable(textFields: string[] = ['name', 'title', 'content']): IndexBuilder {
    const builder = new IndexBuilder()
      .addHashIndex('id')
      .addDateIndex('created')
      .addDateIndex('updated')

    textFields.forEach(field => {
      builder.addTextIndex(field)
    })

    return builder
  },

  /**
   * Indexes for user-related entities
   */
  user(): IndexBuilder {
    return new IndexBuilder()
      .addHashIndex('id')
      .addUniqueIndex('email')
      .addHashIndex('username')
      .addDateIndex('created')
      .addDateIndex('updated')
      .addSparseIndex('deletedAt', 'btree')
  }
}

// --- Type Exports ---

export type { IndexDefinition, IndexBuilderOptions }