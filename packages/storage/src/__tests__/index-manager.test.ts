import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { IndexManager } from '../core/index-manager'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

describe('IndexManager', () => {
  let tempDir: string
  let indexManager: IndexManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'index-test-'))
    indexManager = new IndexManager(tempDir, 'test_data')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('Index Creation', () => {
    test('should create basic index', async () => {
      await indexManager.createIndex({
        name: 'test_index',
        type: 'hash',
        fields: ['name']
      })

      const indexes = await indexManager.listIndexes()
      expect(indexes).toHaveLength(1)
      expect(indexes[0].name).toBe('test_index')
    })

    test('should prevent duplicate indexes', async () => {
      await indexManager.createIndex({
        name: 'duplicate_test',
        type: 'hash',
        fields: ['id']
      })

      const promise = indexManager.createIndex({
        name: 'duplicate_test',
        type: 'hash',
        fields: ['id']
      })

      await expect(promise).rejects.toThrow('already exists')
    })

    test('should create composite index', async () => {
      await indexManager.createIndex({
        name: 'composite_index',
        type: 'hash',
        fields: ['category', 'status']
      })

      const indexes = await indexManager.listIndexes()
      expect(indexes[0].fields).toEqual(['category', 'status'])
    })

    test('should create unique index', async () => {
      await indexManager.createIndex({
        name: 'unique_email',
        type: 'hash',
        fields: ['email'],
        unique: true
      })

      const stats = await indexManager.getIndexStats('unique_email')
      expect(stats?.config.unique).toBe(true)
    })
  })

  describe('Index Operations', () => {
    beforeEach(async () => {
      await indexManager.createIndex({
        name: 'user_by_email',
        type: 'hash',
        fields: ['email']
      })
    })

    test('should add entries to index', async () => {
      const user = { id: 1, email: 'test@example.com', name: 'Test User' }
      await indexManager.addToIndex('user_by_email', user.id, user)

      const results = await indexManager.query('user_by_email', 'test@example.com')
      expect(results).toEqual([1])
    })

    test('should handle multiple entries with same key', async () => {
      const user1 = { id: 1, email: 'shared@example.com' }
      const user2 = { id: 2, email: 'shared@example.com' }

      await indexManager.addToIndex('user_by_email', user1.id, user1)
      await indexManager.addToIndex('user_by_email', user2.id, user2)

      const results = await indexManager.query('user_by_email', 'shared@example.com')
      expect(results).toContain(1)
      expect(results).toContain(2)
    })

    test('should enforce unique constraint', async () => {
      await indexManager.createIndex({
        name: 'unique_username',
        type: 'hash',
        fields: ['username'],
        unique: true
      })

      const user1 = { id: 1, username: 'john' }
      const user2 = { id: 2, username: 'john' }

      await indexManager.addToIndex('unique_username', user1.id, user1)
      
      const promise = indexManager.addToIndex('unique_username', user2.id, user2)
      await expect(promise).rejects.toThrow('Unique constraint violation')
    })

    test('should remove entries from index', async () => {
      const user = { id: 1, email: 'remove@example.com' }
      await indexManager.addToIndex('user_by_email', user.id, user)

      await indexManager.removeFromIndex('user_by_email', user.id)

      const results = await indexManager.query('user_by_email', 'remove@example.com')
      expect(results).toEqual([])
    })

    test('should handle null values in sparse index', async () => {
      await indexManager.createIndex({
        name: 'sparse_field',
        type: 'hash',
        fields: ['optional'],
        sparse: true
      })

      const doc1 = { id: 1, name: 'Has Value', optional: 'value' }
      const doc2 = { id: 2, name: 'No Value', optional: null }

      await indexManager.addToIndex('sparse_field', doc1.id, doc1)
      await indexManager.addToIndex('sparse_field', doc2.id, doc2)

      const results = await indexManager.query('sparse_field', null)
      expect(results).toEqual([]) // Sparse index doesn't index null values
    })

    test('should handle null values in non-sparse index', async () => {
      await indexManager.createIndex({
        name: 'non_sparse_field',
        type: 'hash',
        fields: ['optional'],
        sparse: false
      })

      const doc1 = { id: 1, optional: 'value' }
      const doc2 = { id: 2, optional: null }
      const doc3 = { id: 3 } // Missing field

      await indexManager.addToIndex('non_sparse_field', doc1.id, doc1)
      await indexManager.addToIndex('non_sparse_field', doc2.id, doc2)
      await indexManager.addToIndex('non_sparse_field', doc3.id, doc3)

      const results = await indexManager.query('non_sparse_field', null)
      expect(results).toContain(2)
      expect(results).toContain(3)
    })
  })

  describe('Nested Fields', () => {
    test('should index nested fields', async () => {
      await indexManager.createIndex({
        name: 'user_by_city',
        type: 'hash',
        fields: ['address.city']
      })

      const user = {
        id: 1,
        name: 'John',
        address: {
          city: 'New York',
          country: 'USA'
        }
      }

      await indexManager.addToIndex('user_by_city', user.id, user)
      const results = await indexManager.query('user_by_city', 'New York')
      expect(results).toEqual([1])
    })

    test('should handle missing nested fields', async () => {
      await indexManager.createIndex({
        name: 'nested_optional',
        type: 'hash',
        fields: ['deeply.nested.field']
      })

      const doc1 = { id: 1, deeply: { nested: { field: 'value' } } }
      const doc2 = { id: 2, deeply: { nested: {} } }
      const doc3 = { id: 3, deeply: {} }
      const doc4 = { id: 4 }

      await indexManager.addToIndex('nested_optional', doc1.id, doc1)
      await indexManager.addToIndex('nested_optional', doc2.id, doc2)
      await indexManager.addToIndex('nested_optional', doc3.id, doc3)
      await indexManager.addToIndex('nested_optional', doc4.id, doc4)

      const withValue = await indexManager.query('nested_optional', 'value')
      expect(withValue).toEqual([1])

      const withNull = await indexManager.query('nested_optional', null)
      expect(withNull).toContain(2)
      expect(withNull).toContain(3)
      expect(withNull).toContain(4)
    })
  })

  describe('Array Fields', () => {
    test('should index array fields', async () => {
      await indexManager.createIndex({
        name: 'by_tags',
        type: 'hash',
        fields: ['tags']
      })

      const doc1 = { id: 1, tags: ['javascript', 'typescript'] }
      const doc2 = { id: 2, tags: ['python', 'javascript'] }
      const doc3 = { id: 3, tags: ['ruby'] }

      await indexManager.addToIndex('by_tags', doc1.id, doc1)
      await indexManager.addToIndex('by_tags', doc2.id, doc2)
      await indexManager.addToIndex('by_tags', doc3.id, doc3)

      const jsResults = await indexManager.query('by_tags', 'javascript')
      expect(jsResults).toContain(1)
      expect(jsResults).toContain(2)

      const rubyResults = await indexManager.query('by_tags', 'ruby')
      expect(rubyResults).toEqual([3])
    })
  })

  describe('Composite Indexes', () => {
    test('should create composite key', async () => {
      await indexManager.createIndex({
        name: 'category_status',
        type: 'hash',
        fields: ['category', 'status']
      })

      const doc = { id: 1, category: 'electronics', status: 'active' }
      await indexManager.addToIndex('category_status', doc.id, doc)

      // Composite key is created
      const results = await indexManager.query('category_status', 'electronics:active')
      expect(results).toEqual([1])
    })
  })

  describe('Range Queries', () => {
    beforeEach(async () => {
      await indexManager.createIndex({
        name: 'by_price',
        type: 'btree',
        fields: ['price']
      })

      const products = [
        { id: 1, price: 10 },
        { id: 2, price: 20 },
        { id: 3, price: 30 },
        { id: 4, price: 40 },
        { id: 5, price: 50 }
      ]

      for (const product of products) {
        await indexManager.addToIndex('by_price', product.id, product)
      }
    })

    test('should query range inclusive', async () => {
      const results = await indexManager.queryRange('by_price', 20, 40, true)
      expect(results).toContain(2)
      expect(results).toContain(3)
      expect(results).toContain(4)
      expect(results).toHaveLength(3)
    })

    test('should query range exclusive', async () => {
      const results = await indexManager.queryRange('by_price', 20, 40, false)
      expect(results).toContain(3)
      expect(results).toHaveLength(1)
    })

    test('should handle string ranges', async () => {
      await indexManager.createIndex({
        name: 'by_name',
        type: 'btree',
        fields: ['name']
      })

      const items = [
        { id: 1, name: 'apple' },
        { id: 2, name: 'banana' },
        { id: 3, name: 'cherry' },
        { id: 4, name: 'date' }
      ]

      for (const item of items) {
        await indexManager.addToIndex('by_name', item.id, item)
      }

      const results = await indexManager.queryRange('by_name', 'banana', 'cherry', true)
      expect(results).toContain(2)
      expect(results).toContain(3)
      expect(results).toHaveLength(2)
    })
  })

  describe('Bulk Operations', () => {
    test('should rebuild index', async () => {
      await indexManager.createIndex({
        name: 'rebuild_test',
        type: 'hash',
        fields: ['type']
      })

      const entities = [
        { id: 1, type: 'A' },
        { id: 2, type: 'B' },
        { id: 3, type: 'A' },
        { id: 4, type: 'C' }
      ]

      await indexManager.rebuildIndex('rebuild_test', entities)

      const typeA = await indexManager.query('rebuild_test', 'A')
      expect(typeA).toContain(1)
      expect(typeA).toContain(3)
      expect(typeA).toHaveLength(2)
    })
  })

  describe('Index Management', () => {
    test('should drop index', async () => {
      await indexManager.createIndex({
        name: 'to_drop',
        type: 'hash',
        fields: ['field']
      })

      await indexManager.dropIndex('to_drop')

      const indexes = await indexManager.listIndexes()
      expect(indexes).toHaveLength(0)
    })

    test('should list all indexes', async () => {
      await indexManager.createIndex({ name: 'idx1', type: 'hash', fields: ['f1'] })
      await indexManager.createIndex({ name: 'idx2', type: 'btree', fields: ['f2'] })
      await indexManager.createIndex({ name: 'idx3', type: 'hash', fields: ['f3'], unique: true })

      const indexes = await indexManager.listIndexes()
      expect(indexes).toHaveLength(3)
      expect(indexes.map(i => i.name).sort()).toEqual(['idx1', 'idx2', 'idx3'])
    })

    test('should get index statistics', async () => {
      await indexManager.createIndex({
        name: 'stats_test',
        type: 'hash',
        fields: ['category']
      })

      const items = [
        { id: 1, category: 'A' },
        { id: 2, category: 'B' },
        { id: 3, category: 'A' },
        { id: 4, category: 'C' }
      ]

      for (const item of items) {
        await indexManager.addToIndex('stats_test', item.id, item)
      }

      const stats = await indexManager.getIndexStats('stats_test')
      expect(stats).not.toBeNull()
      expect(stats?.stats.uniqueKeys).toBe(3) // A, B, C
      expect(stats?.stats.totalEntries).toBe(4)
      expect(stats?.stats.avgEntriesPerKey).toBeCloseTo(4/3)
    })
  })

  describe('Error Handling', () => {
    test('should handle missing index gracefully', async () => {
      const results = await indexManager.query('non_existent', 'key')
      expect(results).toEqual([])
    })

    test('should throw on adding to non-existent index', async () => {
      const promise = indexManager.addToIndex('missing', 1, { id: 1 })
      await expect(promise).rejects.toThrow('not found')
    })

    test('should handle removal from non-existent index', async () => {
      // Should not throw
      await indexManager.removeFromIndex('missing', 1)
    })
  })
})