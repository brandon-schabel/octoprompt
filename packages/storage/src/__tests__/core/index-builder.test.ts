/**
 * Tests for IndexBuilder utility
 * 
 * Recent changes:
 * 1. Created comprehensive tests for IndexBuilder fluent API
 * 2. Added tests for different index types and configurations
 * 3. Tested sparse, unique, and compound index creation
 * 4. Verified index name generation and duplicate prevention
 * 5. Added tests for convenience builders and edge cases
 */

import { describe, test, expect } from 'bun:test'
import { IndexBuilder, createIndexBuilder, IndexBuilders } from '../../core/index-builder'
import type { IndexDefinition } from '../../core/indexed-storage'

describe('IndexBuilder', () => {
  describe('Basic Index Creation', () => {
    test('should create hash index', () => {
      const indexes = new IndexBuilder()
        .addHashIndex('name')
        .build()

      expect(indexes).toHaveLength(1)
      expect(indexes[0]).toEqual({
        name: 'idx_hash_name',
        type: 'hash',
        fields: ['name'],
        sparse: undefined
      })
    })

    test('should create btree index', () => {
      const indexes = new IndexBuilder()
        .addBTreeIndex('created')
        .build()

      expect(indexes).toHaveLength(1)
      expect(indexes[0]).toEqual({
        name: 'idx_btree_created',
        type: 'btree',
        fields: ['created'],
        sparse: undefined
      })
    })

    test('should create text (inverted) index', () => {
      const indexes = new IndexBuilder()
        .addTextIndex('content')
        .build()

      expect(indexes).toHaveLength(1)
      expect(indexes[0]).toEqual({
        name: 'idx_text_content',
        type: 'inverted',
        fields: ['content'],
        sparse: undefined
      })
    })

    test('should create date index (btree)', () => {
      const indexes = new IndexBuilder()
        .addDateIndex('updated')
        .build()

      expect(indexes).toHaveLength(1)
      expect(indexes[0]).toEqual({
        name: 'idx_btree_updated',
        type: 'btree',
        fields: ['updated'],
        sparse: undefined
      })
    })
  })

  describe('Specialized Index Types', () => {
    test('should create sparse index', () => {
      const indexes = new IndexBuilder()
        .addSparseIndex('deletedAt')
        .build()

      expect(indexes).toHaveLength(1)
      expect(indexes[0]).toEqual({
        name: 'idx_hash_deletedAt_sparse',
        type: 'hash',
        fields: ['deletedAt'],
        sparse: true
      })
    })

    test('should create sparse index with custom type', () => {
      const indexes = new IndexBuilder()
        .addSparseIndex('lastLogin', 'btree')
        .build()

      expect(indexes[0]).toEqual({
        name: 'idx_btree_lastLogin_sparse',
        type: 'btree',
        fields: ['lastLogin'],
        sparse: true
      })
    })

    test('should create unique index', () => {
      const indexes = new IndexBuilder()
        .addUniqueIndex('email')
        .build()

      expect(indexes[0]).toEqual({
        name: 'idx_hash_email_unique',
        type: 'hash',
        fields: ['email'],
        sparse: undefined
      })
    })
  })

  describe('Compound Indexes', () => {
    test('should create compound index', () => {
      const indexes = new IndexBuilder()
        .addCompoundIndex(['projectId', 'status'])
        .build()

      expect(indexes[0]).toEqual({
        name: 'idx_hash_projectId_status',
        type: 'hash',
        fields: ['projectId', 'status'],
        sparse: undefined
      })
    })

    test('should create unique compound index', () => {
      const indexes = new IndexBuilder()
        .addUniqueCompoundIndex(['userId', 'projectId'])
        .build()

      expect(indexes[0]).toEqual({
        name: 'idx_hash_userId_projectId_unique',
        type: 'hash',
        fields: ['userId', 'projectId'],
        sparse: undefined
      })
    })

    test('should throw error for empty compound index', () => {
      expect(() => {
        new IndexBuilder().addCompoundIndex([])
      }).toThrow('Compound index must have at least one field')
    })
  })

  describe('Custom Indexes', () => {
    test('should create custom index', () => {
      const indexes = new IndexBuilder()
        .addCustomIndex('my_custom_index', 'btree', ['field1'], { sparse: true })
        .build()

      expect(indexes[0]).toEqual({
        name: 'my_custom_index',
        type: 'btree',
        fields: ['field1'],
        sparse: true
      })
    })

    test('should throw error for custom index with no fields', () => {
      expect(() => {
        new IndexBuilder().addCustomIndex('test', 'hash', [])
      }).toThrow('Index must have at least one field')
    })
  })

  describe('Multiple Indexes', () => {
    test('should create multiple indexes', () => {
      const indexes = new IndexBuilder()
        .addHashIndex('id')
        .addTextIndex('name')
        .addDateIndex('created')
        .addSparseIndex('deletedAt')
        .build()

      expect(indexes).toHaveLength(4)
      expect(indexes.map(i => i.name)).toEqual([
        'idx_hash_id',
        'idx_text_name',
        'idx_btree_created',
        'idx_hash_deletedAt_sparse'
      ])
    })

    test('should prevent duplicate index names', () => {
      expect(() => {
        new IndexBuilder()
          .addHashIndex('name')
          .addHashIndex('name') // Duplicate
      }).toThrow("Index with name 'idx_hash_name' already exists")
    })
  })

  describe('Index Management', () => {
    test('should remove index by name', () => {
      const builder = new IndexBuilder()
        .addHashIndex('name')
        .addHashIndex('email')
        .removeIndex('idx_hash_name')

      const indexes = builder.build()
      expect(indexes).toHaveLength(1)
      expect(indexes[0].name).toBe('idx_hash_email')
    })

    test('should clear all indexes', () => {
      const builder = new IndexBuilder()
        .addHashIndex('name')
        .addHashIndex('email')
        .clear()

      const indexes = builder.build()
      expect(indexes).toHaveLength(0)
    })

    test('should check if index exists', () => {
      const builder = new IndexBuilder()
        .addHashIndex('name')

      expect(builder.hasIndex('idx_hash_name')).toBe(true)
      expect(builder.hasIndex('idx_hash_email')).toBe(false)
    })

    test('should get current indexes without building', () => {
      const builder = new IndexBuilder()
        .addHashIndex('name')

      const indexes = builder.getIndexes()
      expect(indexes).toHaveLength(1)
      expect(indexes[0].name).toBe('idx_hash_name')
    })

    test('should get index count', () => {
      const builder = new IndexBuilder()
        .addHashIndex('name')
        .addHashIndex('email')

      expect(builder.getCount()).toBe(2)
    })
  })

  describe('Builder Options', () => {
    test('should apply global sparse option', () => {
      const indexes = new IndexBuilder({ sparse: true })
        .addHashIndex('name')
        .build()

      expect(indexes[0].sparse).toBe(true)
    })

    test('should override global options with local options', () => {
      const indexes = new IndexBuilder({ sparse: true })
        .addHashIndex('name', { sparse: false })
        .build()

      expect(indexes[0].sparse).toBe(false)
    })

    test('should use custom name prefix', () => {
      const indexes = new IndexBuilder({ namePrefix: 'custom' })
        .addHashIndex('name')
        .build()

      expect(indexes[0].name).toBe('custom_hash_name')
    })
  })

  describe('Clone and Immutability', () => {
    test('should clone builder', () => {
      const original = new IndexBuilder()
        .addHashIndex('name')

      const cloned = original.clone()
        .addHashIndex('email')

      expect(original.getCount()).toBe(1)
      expect(cloned.getCount()).toBe(2)
    })

    test('should return immutable copy from build()', () => {
      const builder = new IndexBuilder()
        .addHashIndex('name')

      const indexes1 = builder.build()
      const indexes2 = builder.build()

      // Modify first result
      indexes1[0].name = 'modified'

      // Second result should be unchanged
      expect(indexes2[0].name).toBe('idx_hash_name')
    })
  })

  describe('Field Path Sanitization', () => {
    test('should sanitize field paths in index names', () => {
      const indexes = new IndexBuilder()
        .addHashIndex('user.email')
        .addHashIndex('nested.deeply.field')
        .build()

      expect(indexes[0].name).toBe('idx_hash_user_email')
      expect(indexes[1].name).toBe('idx_hash_nested_deeply_field')
    })
  })
})

describe('createIndexBuilder', () => {
  test('should create new IndexBuilder instance', () => {
    const builder = createIndexBuilder({ sparse: true })
    
    expect(builder).toBeInstanceOf(IndexBuilder)
    
    const indexes = builder.addHashIndex('test').build()
    expect(indexes[0].sparse).toBe(true)
  })
})

describe('IndexBuilders convenience methods', () => {
  test('should create standard indexes', () => {
    const indexes = IndexBuilders.standard().build()

    expect(indexes).toHaveLength(3)
    expect(indexes.map(i => i.name)).toEqual([
      'idx_hash_id',
      'idx_btree_created',
      'idx_btree_updated'
    ])
  })

  test('should create project indexes', () => {
    const indexes = IndexBuilders.project().build()

    expect(indexes).toHaveLength(4)
    expect(indexes.map(i => i.name)).toEqual([
      'idx_hash_id',
      'idx_hash_projectId',
      'idx_btree_created',
      'idx_btree_updated'
    ])
  })

  test('should create searchable indexes with default fields', () => {
    const indexes = IndexBuilders.searchable().build()

    expect(indexes).toHaveLength(6) // id, created, updated + name, title, content
    expect(indexes.filter(i => i.type === 'inverted')).toHaveLength(3)
  })

  test('should create searchable indexes with custom fields', () => {
    const indexes = IndexBuilders.searchable(['description', 'tags']).build()

    expect(indexes.filter(i => i.type === 'inverted')).toHaveLength(2)
    expect(indexes.some(i => i.fields.includes('description'))).toBe(true)
    expect(indexes.some(i => i.fields.includes('tags'))).toBe(true)
  })

  test('should create user indexes', () => {
    const indexes = IndexBuilders.user().build()

    expect(indexes).toHaveLength(6)
    expect(indexes.some(i => i.name.includes('unique') && i.fields.includes('email'))).toBe(true)
    expect(indexes.some(i => i.sparse === true && i.fields.includes('deletedAt'))).toBe(true)
  })
})