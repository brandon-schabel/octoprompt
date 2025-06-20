import { z, type ZodTypeAny } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ApiError } from '@octoprompt/shared'

// --- Types ---
export interface StorageAdapter<T> {
  read(id: string | number): Promise<T | null>
  readAll(): Promise<Map<string | number, T>>
  write(id: string | number, data: T): Promise<void>
  delete(id: string | number): Promise<boolean>
  exists(id: string | number): Promise<boolean>
  clear(): Promise<void>
}

export interface IndexConfig {
  field: string
  type: 'hash' | 'btree'
}

export interface CacheConfig {
  maxSize: number
  ttl?: number // Time to live in milliseconds
}

export interface StorageV2Config<T> {
  adapter: StorageAdapter<T>
  schema: ZodTypeAny
  indexes?: IndexConfig[]
  cache?: CacheConfig
  migrations?: MigrationConfig[]
}

export interface MigrationConfig {
  version: number
  migrate: (data: any) => any
}

// --- LRU Cache Implementation ---
class LRUCache<T> {
  private cache: Map<string | number, { value: T; timestamp: number }> = new Map()
  private accessOrder: (string | number)[] = []
  
  constructor(private maxSize: number, private ttl?: number) {}

  get(key: string | number): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // Check TTL
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key)
      return null
    }
    
    // Update access order
    this.updateAccessOrder(key)
    return entry.value
  }

  set(key: string | number, value: T): void {
    // Remove if exists to update position
    if (this.cache.has(key)) {
      this.delete(key)
    }
    
    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize) {
      const lru = this.accessOrder[0]
      if (lru !== undefined) {
        this.delete(lru)
      }
    }
    
    this.cache.set(key, { value, timestamp: Date.now() })
    this.accessOrder.push(key)
  }

  delete(key: string | number): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      const index = this.accessOrder.indexOf(key)
      if (index > -1) {
        this.accessOrder.splice(index, 1)
      }
    }
    return deleted
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  private updateAccessOrder(key: string | number): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
      this.accessOrder.push(key)
    }
  }
}

// --- Index Implementations ---
interface Index<T> {
  add(id: string | number, item: T): void
  remove(id: string | number): void
  find(value: any): (string | number)[]
  findRange?(min: any, max: any): (string | number)[]
  clear(): void
}

class HashIndex<T> implements Index<T> {
  private index: Map<any, Set<string | number>> = new Map()
  
  constructor(private field: string) {}

  add(id: string | number, item: T): void {
    const value = this.getValue(item)
    if (value === undefined) return
    
    if (!this.index.has(value)) {
      this.index.set(value, new Set())
    }
    const ids = this.index.get(value)
    if (ids) {
      ids.add(id)
    }
  }

  remove(id: string | number): void {
    for (const [, ids] of this.index) {
      ids.delete(id)
    }
  }

  find(value: any): (string | number)[] {
    const ids = this.index.get(value)
    return ids ? Array.from(ids) : []
  }

  clear(): void {
    this.index.clear()
  }

  private getValue(item: T): any {
    const parts = this.field.split('.')
    let value: any = item
    for (const part of parts) {
      value = value?.[part]
    }
    return value
  }
}

// Simple B-tree index for range queries (simplified implementation)
class BTreeIndex<T> implements Index<T> {
  private entries: Array<{ value: any; ids: Set<string | number> }> = []
  
  constructor(private field: string) {}

  add(id: string | number, item: T): void {
    const value = this.getValue(item)
    if (value === undefined) return
    
    const index = this.findInsertIndex(value)
    if (index < this.entries.length && this.entries[index]?.value === value) {
      this.entries[index].ids.add(id)
    } else {
      this.entries.splice(index, 0, { value, ids: new Set([id]) })
    }
  }

  remove(id: string | number): void {
    for (const entry of this.entries) {
      entry.ids.delete(id)
    }
    // Remove empty entries
    this.entries = this.entries.filter(e => e.ids.size > 0)
  }

  find(value: any): (string | number)[] {
    const index = this.findInsertIndex(value)
    const entry = this.entries[index]
    if (entry && entry.value === value) {
      return Array.from(entry.ids)
    }
    return []
  }

  findRange(min: any, max: any): (string | number)[] {
    const minIndex = this.findInsertIndex(min)
    const maxIndex = this.findInsertIndex(max)
    
    const results: (string | number)[] = []
    for (let i = minIndex; i < this.entries.length && i <= maxIndex; i++) {
      const entry = this.entries[i]
      if (entry && entry.value >= min && entry.value <= max) {
        results.push(...Array.from(entry.ids))
      }
    }
    return results
  }

  clear(): void {
    this.entries = []
  }

  private getValue(item: T): any {
    const parts = this.field.split('.')
    let value: any = item
    for (const part of parts) {
      value = value?.[part]
    }
    return value
  }

  private findInsertIndex(value: any): number {
    let low = 0
    let high = this.entries.length
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      const midEntry = this.entries[mid]
      if (midEntry && midEntry.value < value) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    
    return low
  }
}

// --- File Adapter Implementation ---
export class FileAdapter<T> implements StorageAdapter<T> {
  private filePath: string
  private lockFile: string
  private schema: ZodTypeAny
  
  constructor(fileName: string, dataDir: string = 'data', schema?: ZodTypeAny) {
    this.filePath = path.resolve(process.cwd(), dataDir, `${fileName}.json`)
    this.lockFile = `${this.filePath}.lock`
    this.schema = schema || z.any()
  }

  async read(id: string | number): Promise<T | null> {
    const data = await this.readAll()
    return data.get(id) || null
  }

  async readAll(): Promise<Map<string | number, T>> {
    try {
      await this.ensureDir()
      const content = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(content)
      
      // Convert to Map
      const map = new Map<string | number, T>()
      for (const [key, value] of Object.entries(parsed)) {
        const numKey = Number(key)
        const actualKey = isNaN(numKey) ? key : numKey
        map.set(actualKey, value as T)
      }
      
      return map
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return new Map()
      }
      throw error
    }
  }

  async write(id: string | number, data: T): Promise<void> {
    const allData = await this.readAll()
    allData.set(id, data)
    await this.writeAll(allData)
  }

  async delete(id: string | number): Promise<boolean> {
    const allData = await this.readAll()
    const deleted = allData.delete(id)
    if (deleted) {
      await this.writeAll(allData)
    }
    return deleted
  }

  async exists(id: string | number): Promise<boolean> {
    const allData = await this.readAll()
    return allData.has(id)
  }

  async clear(): Promise<void> {
    await this.writeAll(new Map())
  }

  private async writeAll(data: Map<string | number, T>): Promise<void> {
    await this.ensureDir()
    
    // Convert Map to object for JSON serialization
    const obj: Record<string | number, T> = {}
    for (const [key, value] of data) {
      obj[key] = value
    }
    
    // Atomic write with temp file
    const tempPath = `${this.filePath}.tmp`
    try {
      await fs.writeFile(tempPath, JSON.stringify(obj, null, 2), 'utf-8')
      await fs.rename(tempPath, this.filePath)
    } catch (error) {
      // If rename fails, try direct write as fallback
      await fs.writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf-8')
    }
  }

  private async ensureDir(): Promise<void> {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })
  }
}

// --- Memory Adapter Implementation (for testing) ---
export class MemoryAdapter<T> implements StorageAdapter<T> {
  private data: Map<string | number, T> = new Map()

  async read(id: string | number): Promise<T | null> {
    return this.data.get(id) || null
  }

  async readAll(): Promise<Map<string | number, T>> {
    return new Map(this.data)
  }

  async write(id: string | number, data: T): Promise<void> {
    this.data.set(id, data)
  }

  async delete(id: string | number): Promise<boolean> {
    return this.data.delete(id)
  }

  async exists(id: string | number): Promise<boolean> {
    return this.data.has(id)
  }

  async clear(): Promise<void> {
    this.data.clear()
  }
}

// --- Main StorageV2 Class ---
export class StorageV2<T extends Record<string, any>> {
  private cache?: LRUCache<T>
  private indexes: Map<string, Index<T>> = new Map()
  private adapter: StorageAdapter<T>
  private schema: ZodTypeAny
  private migrations: MigrationConfig[]

  constructor(private config: StorageV2Config<T>) {
    this.adapter = config.adapter
    this.schema = config.schema
    this.migrations = config.migrations || []
    
    // Initialize cache if configured
    if (config.cache) {
      this.cache = new LRUCache(config.cache.maxSize, config.cache.ttl)
    }
    
    // Initialize indexes
    if (config.indexes) {
      for (const indexConfig of config.indexes) {
        const index = indexConfig.type === 'hash' 
          ? new HashIndex<T>(indexConfig.field)
          : new BTreeIndex<T>(indexConfig.field)
        this.indexes.set(indexConfig.field, index)
      }
    }
  }

  async get(id: string | number): Promise<T | null> {
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(id)
      if (cached) return cached
    }
    
    // Read from adapter
    const data = await this.adapter.read(id)
    if (!data) return null
    
    // Validate
    const validated = await this.validate(data)
    
    // Update cache
    if (this.cache && validated) {
      this.cache.set(id, validated)
    }
    
    return validated
  }

  async getAll(): Promise<T[]> {
    const dataMap = await this.adapter.readAll()
    const results: T[] = []
    
    for (const [id, data] of dataMap) {
      const validated = await this.validate(data)
      if (validated) {
        results.push(validated)
        // Update cache
        if (this.cache) {
          this.cache.set(id, validated)
        }
      }
    }
    
    // Rebuild indexes
    await this.rebuildIndexes(dataMap)
    
    return results
  }

  async create(data: Omit<T, 'id' | 'created' | 'updated'>): Promise<T> {
    // Check if the schema expects a string ID by testing with a sample
    const sampleId = 12345
    const testData = { ...data, id: sampleId, created: 1, updated: 1 }
    const testResult = await this.schema.safeParse(testData)
    
    const expectsStringId = !testResult.success && 
      testResult.error.errors.some(e => e.path[0] === 'id' && e.code === 'invalid_type' && e.expected === 'string')
    
    const id = expectsStringId ? await this.generateStringId() : await this.generateId()
    const now = Date.now()
    
    const newData = {
      ...data,
      id,
      created: now,
      updated: now
    } as unknown as T
    
    // Validate
    const validated = await this.validate(newData)
    if (!validated) {
      throw new ApiError(400, 'Validation failed')
    }
    
    // Write to adapter
    await this.adapter.write(id, validated)
    
    // Update cache
    if (this.cache) {
      this.cache.set(id, validated)
    }
    
    // Update indexes
    this.updateIndexes(id, validated)
    
    return validated
  }

  async update(id: string | number, updates: Partial<Omit<T, 'id' | 'created'>>): Promise<T | null> {
    const existing = await this.get(id)
    if (!existing) return null
    
    const updated = {
      ...existing,
      ...updates,
      id,
      created: existing.created,
      updated: Date.now()
    } as unknown as T
    
    // Validate
    const validated = await this.validate(updated)
    if (!validated) {
      throw new ApiError(400, 'Validation failed')
    }
    
    // Write to adapter
    await this.adapter.write(id, validated)
    
    // Update cache
    if (this.cache) {
      this.cache.set(id, validated)
    }
    
    // Update indexes
    this.removeFromIndexes(id)
    this.updateIndexes(id, validated)
    
    return validated
  }

  async delete(id: string | number): Promise<boolean> {
    const deleted = await this.adapter.delete(id)
    
    if (deleted) {
      // Update cache
      if (this.cache) {
        this.cache.delete(id)
      }
      
      // Update indexes
      this.removeFromIndexes(id)
    }
    
    return deleted
  }

  async findBy(field: string, value: any): Promise<T[]> {
    const index = this.indexes.get(field)
    if (!index) {
      throw new ApiError(`No index exists for field: ${field}`, 400)
    }
    
    const ids = index.find(value)
    const results: T[] = []
    
    for (const id of ids) {
      const item = await this.get(id)
      if (item) {
        results.push(item)
      }
    }
    
    return results
  }

  async findByRange(field: string, min: any, max: any): Promise<T[]> {
    const index = this.indexes.get(field)
    if (!index || !('findRange' in index)) {
      throw new ApiError(`No B-tree index exists for field: ${field}`, 400)
    }
    
    const ids = (index as BTreeIndex<T>).findRange(min, max)
    const results: T[] = []
    
    for (const id of ids) {
      const item = await this.get(id)
      if (item) {
        results.push(item)
      }
    }
    
    return results
  }

  async clear(): Promise<void> {
    await this.adapter.clear()
    
    if (this.cache) {
      this.cache.clear()
    }
    
    for (const index of this.indexes.values()) {
      index.clear()
    }
  }

  private async generateId(): Promise<number> {
    let id = Date.now()
    let attempts = 0
    const maxAttempts = 1000
    
    // Handle collisions with a safety limit
    while (await this.adapter.exists(id)) {
      id++
      attempts++
      
      if (attempts >= maxAttempts) {
        // If we've tried too many times, use a random component
        id = Date.now() + Math.floor(Math.random() * 10000)
        break
      }
    }
    
    return id
  }

  private async generateStringId(): Promise<string> {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    let id = `${timestamp}_${random}`
    
    // Handle collisions
    let attempts = 0
    while (await this.adapter.exists(id)) {
      const newRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
      id = `${timestamp}_${newRandom}_${attempts}`
      attempts++
      
      if (attempts > 100) {
        // Use a more unique ID
        id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        break
      }
    }
    
    return id
  }

  private async validate(data: any): Promise<T | null> {
    try {
      // Apply migrations
      let migrated = data
      for (const migration of this.migrations) {
        migrated = migration.migrate(migrated)
      }
      
      // Validate with schema
      const result = await this.schema.safeParseAsync(migrated)
      if (!result.success) {
        console.error('StorageV2 validation failed:', result.error.errors)
        console.error('Data being validated:', migrated)
      }
      return result.success ? result.data : null
    } catch (error) {
      console.error('Validation error:', error)
      return null
    }
  }

  private updateIndexes(id: string | number, item: T): void {
    for (const index of this.indexes.values()) {
      index.add(id, item)
    }
  }

  private removeFromIndexes(id: string | number): void {
    for (const index of this.indexes.values()) {
      index.remove(id)
    }
  }

  private async rebuildIndexes(dataMap: Map<string | number, T>): Promise<void> {
    // Clear all indexes
    for (const index of this.indexes.values()) {
      index.clear()
    }
    
    // Rebuild
    for (const [id, item] of dataMap) {
      this.updateIndexes(id, item)
    }
  }
}