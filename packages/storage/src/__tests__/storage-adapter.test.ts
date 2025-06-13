import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { MemoryStorageAdapter } from '../adapters/memory-storage-adapter'
import { FileStorageAdapter } from '../adapters/file-storage-adapter'
import type { StorageAdapter } from '../core/storage-adapter'

interface TestData {
  id: number
  name: string
  value: number
  nested: {
    field: string
  }
}

/**
 * Common test suite that runs against all storage adapters
 */
function createStorageAdapterTests(
  name: string,
  createAdapter: () => Promise<StorageAdapter>,
  cleanup?: () => Promise<void>
) {
  describe(`${name} Storage Adapter`, () => {
    let adapter: StorageAdapter
    
    beforeEach(async () => {
      adapter = await createAdapter()
      await adapter.connect()
    })
    
    afterEach(async () => {
      if (adapter) {
        await adapter.clear()
        await adapter.disconnect()
      }
      if (cleanup) {
        await cleanup()
      }
    })
    
    describe('Basic CRUD Operations', () => {
      test('should write and read data', async () => {
        const testData: TestData = {
          id: 1,
          name: 'test',
          value: 42,
          nested: { field: 'nested value' }
        }
        
        await adapter.write('test-key', testData)
        const result = await adapter.read<TestData>('test-key')
        
        expect(result).toEqual(testData)
      })
      
      test('should return null for non-existent keys', async () => {
        const result = await adapter.read('non-existent')
        expect(result).toBeNull()
      })
      
      test('should check if keys exist', async () => {
        await adapter.write('existing-key', { value: 'test' })
        
        expect(await adapter.exists('existing-key')).toBe(true)
        expect(await adapter.exists('non-existent')).toBe(false)
      })
      
      test('should delete data', async () => {
        await adapter.write('delete-me', { value: 'test' })
        expect(await adapter.exists('delete-me')).toBe(true)
        
        await adapter.delete('delete-me')
        expect(await adapter.exists('delete-me')).toBe(false)
        expect(await adapter.read('delete-me')).toBeNull()
      })
      
      test('should not error when deleting non-existent keys', async () => {
        // Should not throw
        await adapter.delete('non-existent')
      })
    })
    
    describe('Bulk Operations', () => {
      test('should read multiple keys', async () => {
        const data1 = { id: 1, value: 'one' }
        const data2 = { id: 2, value: 'two' }
        const data3 = { id: 3, value: 'three' }
        
        await adapter.write('key1', data1)
        await adapter.write('key2', data2)
        await adapter.write('key3', data3)
        
        const results = await adapter.readMany(['key1', 'key2', 'key3', 'missing'])
        
        expect(results.size).toBe(3)
        expect(results.get('key1')).toEqual(data1)
        expect(results.get('key2')).toEqual(data2)
        expect(results.get('key3')).toEqual(data3)
        expect(results.has('missing')).toBe(false)
      })
      
      test('should write multiple keys', async () => {
        const entries = new Map([
          ['bulk1', { value: 'first' }],
          ['bulk2', { value: 'second' }],
          ['bulk3', { value: 'third' }]
        ])
        
        await adapter.writeMany(entries)
        
        const results = await adapter.readMany(['bulk1', 'bulk2', 'bulk3'])
        expect(results.size).toBe(3)
        expect(results.get('bulk1')).toEqual({ value: 'first' })
        expect(results.get('bulk2')).toEqual({ value: 'second' })
        expect(results.get('bulk3')).toEqual({ value: 'third' })
      })
      
      test('should delete multiple keys', async () => {
        await adapter.write('del1', { value: 'one' })
        await adapter.write('del2', { value: 'two' })
        await adapter.write('del3', { value: 'three' })
        
        await adapter.deleteMany(['del1', 'del2'])
        
        expect(await adapter.exists('del1')).toBe(false)
        expect(await adapter.exists('del2')).toBe(false)
        expect(await adapter.exists('del3')).toBe(true)
      })
    })
    
    describe('Listing and Counting', () => {
      beforeEach(async () => {
        // Setup test data
        await adapter.write('users/1', { name: 'Alice' })
        await adapter.write('users/2', { name: 'Bob' })
        await adapter.write('users/admin/1', { name: 'Admin' })
        await adapter.write('posts/1', { title: 'Post 1' })
        await adapter.write('posts/2', { title: 'Post 2' })
        await adapter.write('settings/theme', { value: 'dark' })
      })
      
      test('should list all keys', async () => {
        const keys = await adapter.list()
        expect(keys).toContain('users/1')
        expect(keys).toContain('users/2')
        expect(keys).toContain('posts/1')
        expect(keys).toContain('settings/theme')
        expect(keys.length).toBeGreaterThanOrEqual(6)
      })
      
      test('should list keys with prefix', async () => {
        const userKeys = await adapter.list('users/')
        expect(userKeys).toContain('users/1')
        expect(userKeys).toContain('users/2')
        expect(userKeys).toContain('users/admin/1')
        expect(userKeys).not.toContain('posts/1')
      })
      
      test('should paginate results', async () => {
        const firstPage = await adapter.list(undefined, { limit: 2, offset: 0 })
        const secondPage = await adapter.list(undefined, { limit: 2, offset: 2 })
        
        expect(firstPage.length).toBe(2)
        expect(secondPage.length).toBe(2)
        
        // No overlap
        const combined = new Set([...firstPage, ...secondPage])
        expect(combined.size).toBe(4)
      })
      
      test('should count keys', async () => {
        const totalCount = await adapter.count()
        expect(totalCount).toBeGreaterThanOrEqual(6)
        
        const userCount = await adapter.count('users/')
        expect(userCount).toBe(3)
        
        const postCount = await adapter.count('posts/')
        expect(postCount).toBe(2)
      })
    })
    
    describe('Transactions', () => {
      test('should execute simple transaction', async () => {
        const result = await adapter.transaction([
          { type: 'write', key: 'tx-key', data: { value: 'test' } },
          { type: 'read', key: 'tx-key' }
        ])
        
        expect(result).toEqual({ value: 'test' })
        expect(await adapter.read('tx-key')).toEqual({ value: 'test' })
      })
      
      test('should handle transaction with multiple operations', async () => {
        // Setup initial data
        await adapter.write('existing', { value: 'original' })
        
        await adapter.transaction([
          { type: 'write', key: 'new-key', data: { value: 'new' } },
          { type: 'write', key: 'existing', data: { value: 'updated' } },
          { type: 'delete', key: 'to-delete' } // Non-existent key, should not error
        ])
        
        expect(await adapter.read('new-key')).toEqual({ value: 'new' })
        expect(await adapter.read('existing')).toEqual({ value: 'updated' })
      })
      
      test('should read within transaction', async () => {
        await adapter.write('read-me', { value: 'original' })
        
        const result = await adapter.transaction([
          { type: 'read', key: 'read-me' },
          { type: 'write', key: 'read-me', data: { value: 'modified' } },
          { type: 'read', key: 'read-me' }
        ])
        
        // Should return the modified value from within transaction
        expect(result).toEqual({ value: 'modified' })
        expect(await adapter.read('read-me')).toEqual({ value: 'modified' })
      })
    })
    
    describe('Error Handling', () => {
      test('should handle invalid JSON gracefully', async () => {
        // This test might not apply to all adapters, but should not crash
        try {
          await adapter.write('invalid', 'not-json' as any)
          const result = await adapter.read('invalid')
          expect(result).toBe('not-json')
        } catch (error) {
          // Some adapters might validate JSON, that's OK
          expect(error).toBeDefined()
        }
      })
      
      test('should handle large data', async () => {
        const largeData = {
          id: 1,
          content: 'x'.repeat(10000), // 10KB string
          array: Array(1000).fill(0).map((_, i) => ({ index: i }))
        }
        
        await adapter.write('large-data', largeData)
        const result = await adapter.read('large-data')
        
        expect(result).toEqual(largeData)
      })
    })
    
    describe('Clear Operation', () => {
      test('should clear all data', async () => {
        await adapter.write('key1', { value: 'one' })
        await adapter.write('key2', { value: 'two' })
        
        expect(await adapter.count()).toBeGreaterThanOrEqual(2)
        
        await adapter.clear()
        
        expect(await adapter.count()).toBe(0)
        expect(await adapter.read('key1')).toBeNull()
        expect(await adapter.read('key2')).toBeNull()
      })
    })
    
    describe('Concurrency', () => {
      test('should handle concurrent reads', async () => {
        await adapter.write('concurrent-read', { value: 'test' })
        
        const promises = Array(10).fill(0).map(() => 
          adapter.read('concurrent-read')
        )
        
        const results = await Promise.all(promises)
        
        for (const result of results) {
          expect(result).toEqual({ value: 'test' })
        }
      })
      
      test('should handle concurrent writes', async () => {
        const promises = Array(10).fill(0).map((_, i) => 
          adapter.write(`concurrent-${i}`, { value: i })
        )
        
        await Promise.all(promises)
        
        for (let i = 0; i < 10; i++) {
          const result = await adapter.read(`concurrent-${i}`)
          expect(result).toEqual({ value: i })
        }
      })
    })
  })
}

// Test Memory Storage Adapter
createStorageAdapterTests(
  'Memory',
  async () => new MemoryStorageAdapter({
    cacheEnabled: true,
    cacheTTL: 60000,
    maxCacheSize: 100
  })
)

// Test File Storage Adapter
createStorageAdapterTests(
  'File',
  async () => {
    const testDir = path.join(tmpdir(), `storage-test-${Date.now()}`)
    return new FileStorageAdapter({
      dataPath: testDir,
      cacheEnabled: true,
      cacheTTL: 60000,
      maxCacheSize: 100,
      atomicWrites: true
    })
  },
  async () => {
    // Cleanup test directory
    const testDirs = await fs.readdir(tmpdir())
    for (const dir of testDirs) {
      if (dir.startsWith('storage-test-')) {
        try {
          await fs.rm(path.join(tmpdir(), dir), { recursive: true, force: true })
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }
)

// Additional Memory Storage specific tests
describe('Memory Storage Adapter Specific Tests', () => {
  let adapter: MemoryStorageAdapter
  
  beforeEach(() => {
    adapter = new MemoryStorageAdapter({
      cacheTTL: 100, // Short TTL for testing
      maxCacheSize: 3,
      cacheStrategy: 'lru'
    })
  })
  
  afterEach(async () => {
    if (adapter) {
      await adapter.disconnect()
    }
  })
  
  test('should expire entries after TTL', async () => {
    await adapter.connect()
    await adapter.write('expiring', { value: 'test' })
    
    expect(await adapter.read('expiring')).toEqual({ value: 'test' })
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150))
    
    expect(await adapter.read('expiring')).toBeNull()
  })
  
  test('should evict least recently used entries', async () => {
    await adapter.connect()
    
    // Fill cache to limit with small delays to ensure different timestamps
    await adapter.write('key1', { value: 1 })
    await new Promise(resolve => setTimeout(resolve, 5))
    await adapter.write('key2', { value: 2 })
    await new Promise(resolve => setTimeout(resolve, 5))
    await adapter.write('key3', { value: 3 })
    await new Promise(resolve => setTimeout(resolve, 5))
    
    // Access key1 to make it recently used
    await adapter.read('key1')
    await new Promise(resolve => setTimeout(resolve, 5))
    
    // Add another key, should evict key2 (least recently used)
    await adapter.write('key4', { value: 4 })
    
    expect(await adapter.read('key1')).toEqual({ value: 1 }) // Still exists (recently accessed)
    expect(await adapter.read('key4')).toEqual({ value: 4 }) // New entry
    expect(await adapter.read('key3')).toEqual({ value: 3 }) // Still exists
    expect(await adapter.read('key2')).toBeNull() // Evicted (oldest timestamp since key1 was accessed)
  })
  
  test('should provide stats', async () => {
    await adapter.connect()
    
    await adapter.write('key1', { value: 1 })
    await adapter.write('key2', { value: 2 })
    await adapter.read('key1')
    await adapter.read('key1') // Hit again
    
    const stats = adapter.getStats()
    
    expect(stats.totalEntries).toBe(2)
    expect(stats.validEntries).toBe(2)
    expect(stats.totalHits).toBeGreaterThan(0)
    expect(stats.memoryUsage).toBeGreaterThan(0)
  })
})