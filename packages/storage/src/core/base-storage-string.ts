import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { normalizeToUnixMs } from '@octoprompt/shared/src/utils/parse-timestamp'

// Simple in-memory cache with TTL support
interface CacheEntry<T> {
  data: T
  timestamp: number
  hits: number
}

export interface StorageOptions {
  basePath?: string
  cacheEnabled?: boolean
  cacheTTL?: number // milliseconds
  maxCacheSize?: number // max number of entries
  lockTimeout?: number // milliseconds for lock timeout
}

export interface BaseEntityString {
  id: string
  created: number
  updated: number
}

/**
 * Abstract base class for storage implementations with string IDs
 * Provides common functionality like caching, locking, and validation
 */
export abstract class BaseStorageString<TEntity extends BaseEntityString, TStorage extends Record<string, TEntity>> {
  protected basePath: string
  protected cache: Map<string, CacheEntry<any>> = new Map()
  protected locks: Map<string, Promise<void>> = new Map()
  protected options: Required<StorageOptions>

  constructor(
    protected storageSchema: ZodTypeAny,
    protected entitySchema: ZodTypeAny,
    protected dataDir: string,
    options: StorageOptions = {}
  ) {
    this.basePath = options.basePath || process.cwd()
    this.options = {
      basePath: this.basePath,
      cacheEnabled: options.cacheEnabled ?? true,
      cacheTTL: options.cacheTTL ?? 5 * 60 * 1000, // 5 minutes default
      maxCacheSize: options.maxCacheSize ?? 100,
      lockTimeout: options.lockTimeout ?? 30 * 1000 // 30 seconds default
    }
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract getIndexPath(): string
  protected abstract getEntityPath(id: string): string | null

  // --- Core Read/Write Functions with Caching ---

  protected async readValidatedJson<T extends ZodTypeAny>(
    filePath: string,
    schema: T,
    defaultValue: z.infer<T>
  ): Promise<z.infer<T>> {
    // Check cache first
    if (this.options.cacheEnabled) {
      const cached = this.getFromCache<z.infer<T>>(filePath)
      if (cached !== null) {
        return cached
      }
    }

    try {
      await this.ensureDirExists(path.dirname(filePath))
      const fileContent = await fs.readFile(filePath, 'utf-8')

      if (fileContent.trim() === '') {
        console.warn(`File is empty or contains only whitespace: ${filePath}. Returning default value.`)
        return defaultValue
      }

      const jsonData = JSON.parse(fileContent)
      const validationResult = await schema.safeParseAsync(jsonData)
      
      if (!validationResult.success) {
        console.error(`Zod validation failed reading ${filePath}:`, validationResult.error.errors)
        console.warn(`Returning default value due to validation failure for ${filePath}.`)
        return defaultValue
      }

      // Add to cache
      if (this.options.cacheEnabled) {
        this.addToCache(filePath, validationResult.data)
      }

      return validationResult.data
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return defaultValue
      }
      if (error instanceof SyntaxError) {
        console.error(`JSON Parse error in ${filePath}:`, error.message)
        console.warn(`Returning default value due to JSON parsing error for ${filePath}.`)
        return defaultValue
      }
      console.error(`Error reading or parsing JSON from ${filePath}:`, error)
      throw new Error(`Failed to read/parse JSON file at ${filePath}. Reason: ${error.message}`)
    }
  }

  protected async writeValidatedJson<T extends ZodTypeAny>(
    filePath: string,
    data: unknown,
    schema: T
  ): Promise<z.infer<T>> {
    // Acquire lock for this file
    await this.acquireLock(filePath)

    try {
      const validationResult = await schema.safeParseAsync(data)
      if (!validationResult.success) {
        console.error(`Zod validation failed before writing to ${filePath}:`, validationResult.error.errors)
        throw new ZodError(validationResult.error.errors)
      }
      const validatedData = validationResult.data

      await this.ensureDirExists(path.dirname(filePath))
      
      // Write to temp file first for atomicity
      const tempPath = `${filePath}.tmp`
      const jsonString = JSON.stringify(validatedData, null, 2)
      await fs.writeFile(tempPath, jsonString, 'utf-8')
      
      // Atomic rename
      await fs.rename(tempPath, filePath)

      // Invalidate cache
      if (this.options.cacheEnabled) {
        this.invalidateCache(filePath)
      }

      return validatedData
    } catch (error: any) {
      console.error(`Error writing JSON to ${filePath}:`, error)
      if (error instanceof ZodError) {
        throw error
      }
      throw new Error(`Failed to write JSON file at ${filePath}. Reason: ${error.message}`)
    } finally {
      this.releaseLock(filePath)
    }
  }

  // --- Caching Functions ---

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > this.options.cacheTTL) {
      this.cache.delete(key)
      return null
    }

    entry.hits++
    return entry.data as T
  }

  private addToCache<T>(key: string, data: T): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.options.maxCacheSize) {
      // Remove least recently used (oldest timestamp, lowest hits)
      let lruKey = ''
      let lruScore = Infinity
      
      for (const [k, entry] of this.cache.entries()) {
        const score = entry.timestamp + (entry.hits * 1000) // Weight by recency and hits
        if (score < lruScore) {
          lruScore = score
          lruKey = k
        }
      }
      
      if (lruKey) {
        this.cache.delete(lruKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0
    })
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key)
  }

  // --- Locking Functions ---

  private async acquireLock(key: string): Promise<void> {
    const existingLock = this.locks.get(key)
    if (existingLock) {
      await existingLock
    }

    let resolveLock: (() => void) | undefined
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve
    })

    this.locks.set(key, lockPromise)

    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.releaseLock(key)
      console.warn(`Lock timeout for key: ${key}`)
    }, this.options.lockTimeout)

    // Store the timeout and resolve function for cleanup
    ;(lockPromise as any)._cleanup = () => {
      clearTimeout(timeoutId)
      if (resolveLock) resolveLock()
    }
  }

  private releaseLock(key: string): void {
    const lock = this.locks.get(key)
    if (lock && (lock as any)._cleanup) {
      (lock as any)._cleanup()
    }
    this.locks.delete(key)
  }

  // --- Utility Functions ---

  protected async ensureDirExists(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  protected generateId(): string {
    // Generate a timestamp-based string ID
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substring(2)
    return `${timestamp}_${random}`
  }

  // --- Public API Methods ---

  /**
   * Read all entities from storage
   */
  public async readAll(): Promise<TStorage> {
    const indexPath = this.getIndexPath()
    return this.readValidatedJson(indexPath, this.storageSchema, {} as TStorage)
  }

  /**
   * Write all entities to storage
   */
  public async writeAll(data: TStorage): Promise<TStorage> {
    const indexPath = this.getIndexPath()
    return this.writeValidatedJson(indexPath, data, this.storageSchema)
  }

  /**
   * Get entity by ID
   */
  public async getById(id: string): Promise<TEntity | null> {
    const storage = await this.readAll()
    return storage[id] || null
  }

  /**
   * List all entities
   */
  public async list(): Promise<TEntity[]> {
    const storage = await this.readAll()
    return Object.values(storage).sort((a, b) => b.updated - a.updated)
  }

  /**
   * Create new entity
   */
  public async create(data: Omit<TEntity, 'id' | 'created' | 'updated'>): Promise<TEntity> {
    const storage = await this.readAll()
    
    const id = this.generateId()
    const now = normalizeToUnixMs(Date.now())
    
    const entity = {
      ...data,
      id,
      created: now,
      updated: now
    } as TEntity

    // Validate the entity
    const validationResult = await this.entitySchema.safeParseAsync(entity)
    if (!validationResult.success) {
      throw new ZodError(validationResult.error.errors)
    }

    storage[id] = validationResult.data
    await this.writeAll(storage)
    
    return validationResult.data
  }

  /**
   * Update entity
   */
  public async update(id: string, data: Partial<Omit<TEntity, 'id' | 'created' | 'updated'>>): Promise<TEntity | null> {
    const storage = await this.readAll()
    const existing = storage[id]
    
    if (!existing) {
      return null
    }

    const updated = {
      ...existing,
      ...data,
      updated: normalizeToUnixMs(Date.now())
    } as TEntity

    // Validate the updated entity
    const validationResult = await this.entitySchema.safeParseAsync(updated)
    if (!validationResult.success) {
      throw new ZodError(validationResult.error.errors)
    }

    storage[id] = validationResult.data
    await this.writeAll(storage)
    
    return validationResult.data
  }

  /**
   * Delete entity
   */
  public async delete(id: string): Promise<boolean> {
    const storage = await this.readAll()
    
    if (!storage[id]) {
      return false
    }

    delete storage[id]
    await this.writeAll(storage)
    
    return true
  }

  /**
   * Count entities
   */
  public async count(): Promise<number> {
    const storage = await this.readAll()
    return Object.keys(storage).length
  }

  /**
   * Check if entity exists
   */
  public async exists(id: string): Promise<boolean> {
    const entity = await this.getById(id)
    return entity !== null
  }

  /**
   * Delete all entities
   */
  public async deleteAll(): Promise<void> {
    await this.writeAll({} as TStorage)
    
    // Also clean up any entity-specific directories
    const indexPath = this.getIndexPath()
    
    try {
      // Get all entity directories and remove them
      const entities = await this.list()
      for (const entity of entities) {
        const entityPath = this.getEntityPath(entity.id)
        if (entityPath && existsSync(entityPath)) {
          await fs.rm(entityPath, { recursive: true, force: true })
        }
      }
    } catch (error) {
      console.warn('Failed to clean up entity directories:', error)
    }
  }

  // --- Cache Management ---

  /**
   * Clear all cache
   */
  public clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats
   */
  public getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0
    let totalAccesses = 0
    
    for (const entry of this.cache.values()) {
      totalHits += entry.hits
      totalAccesses += entry.hits + 1 // +1 for initial access
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0
    }
  }
}