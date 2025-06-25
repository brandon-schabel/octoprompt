import { expect, test, describe, beforeEach } from 'bun:test'
import { z } from 'zod'
import { StorageV2, MemoryAdapter, FileAdapter } from './storage-v2'
import fs from 'node:fs/promises'
import path from 'node:path'

// Test schema
const TestItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  created: z.number(),
  updated: z.number(),
  value: z.number()
})

type TestItem = z.infer<typeof TestItemSchema>

describe('StorageV2', () => {
  let storage: StorageV2<TestItem>

  beforeEach(() => {
    storage = new StorageV2<TestItem>({
      adapter: new MemoryAdapter<TestItem>(),
      schema: TestItemSchema,
      indexes: [
        { field: 'id', type: 'hash' },
        { field: 'category', type: 'hash' },
        { field: 'value', type: 'btree' }
      ],
      cache: {
        maxSize: 10,
        ttl: 5000
      }
    })
  })

  test('create item', async () => {
    const item = await storage.create({
      name: 'Test Item',
      category: 'test',
      value: 100
    })

    expect(item).toBeDefined()
    expect(item.id).toBeNumber()
    expect(item.name).toBe('Test Item')
    expect(item.category).toBe('test')
    expect(item.value).toBe(100)
    expect(item.created).toBeNumber()
    expect(item.updated).toBeNumber()
  })

  test('get item', async () => {
    const created = await storage.create({
      name: 'Test Item',
      category: 'test',
      value: 100
    })

    const retrieved = await storage.get(created.id)
    expect(retrieved).toEqual(created)
  })

  test('update item', async () => {
    const created = await storage.create({
      name: 'Test Item',
      category: 'test',
      value: 100
    })

    // Add small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10))

    const updated = await storage.update(created.id, {
      name: 'Updated Item',
      value: 200
    })

    expect(updated).toBeDefined()
    expect(updated?.name).toBe('Updated Item')
    expect(updated?.value).toBe(200)
    expect(updated?.category).toBe('test') // unchanged
    expect(updated?.updated).toBeGreaterThan(created.updated)
  })

  test('delete item', async () => {
    const created = await storage.create({
      name: 'Test Item',
      category: 'test',
      value: 100
    })

    const deleted = await storage.delete(created.id)
    expect(deleted).toBe(true)

    const retrieved = await storage.get(created.id)
    expect(retrieved).toBeNull()
  })

  test('findBy with hash index', async () => {
    await storage.create({ name: 'Item 1', category: 'cat1', value: 100 })
    await storage.create({ name: 'Item 2', category: 'cat2', value: 200 })
    await storage.create({ name: 'Item 3', category: 'cat1', value: 300 })

    const cat1Items = await storage.findBy('category', 'cat1')
    expect(cat1Items).toHaveLength(2)
    expect(cat1Items.every((item) => item.category === 'cat1')).toBe(true)
  })

  test('findByRange with btree index', async () => {
    await storage.create({ name: 'Item 1', category: 'test', value: 100 })
    await storage.create({ name: 'Item 2', category: 'test', value: 200 })
    await storage.create({ name: 'Item 3', category: 'test', value: 300 })
    await storage.create({ name: 'Item 4', category: 'test', value: 400 })

    const rangeItems = await storage.findByRange('value', 150, 350)
    expect(rangeItems).toHaveLength(2)
    expect(rangeItems.every((item) => item.value >= 150 && item.value <= 350)).toBe(true)
  })

  test('getAll', async () => {
    await storage.create({ name: 'Item 1', category: 'test', value: 100 })
    await storage.create({ name: 'Item 2', category: 'test', value: 200 })
    await storage.create({ name: 'Item 3', category: 'test', value: 300 })

    const allItems = await storage.getAll()
    expect(allItems).toHaveLength(3)
  })

  test('cache functionality', async () => {
    // Create item
    const created = await storage.create({
      name: 'Cached Item',
      category: 'test',
      value: 100
    })

    // First get - from storage
    const retrieved1 = await storage.get(created.id)
    expect(retrieved1).toEqual(created)

    // Second get - should be from cache
    const retrieved2 = await storage.get(created.id)
    expect(retrieved2).toEqual(created)
  })
})

describe('FileAdapter', () => {
  const testDir = path.join(process.cwd(), 'test-data')
  const testFile = 'test-storage'
  let adapter: FileAdapter<TestItem>

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {}

    adapter = new FileAdapter<TestItem>(testFile, testDir, TestItemSchema)
  })

  test('file persistence', async () => {
    const testItem: TestItem = {
      id: 1,
      name: 'Test',
      category: 'test',
      value: 100,
      created: Date.now(),
      updated: Date.now()
    }

    // Write item
    await adapter.write(1, testItem)

    // Read item
    const retrieved = await adapter.read(1)
    expect(retrieved).toEqual(testItem)

    // Verify file exists
    const filePath = path.join(testDir, `${testFile}.json`)
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(true)
  })
})
