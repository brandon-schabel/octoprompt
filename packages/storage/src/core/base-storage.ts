import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { normalizeToUnixMs } from '@octoprompt/shared/src/utils/parse-timestamp'
import { globalFileWatcher } from './file-watcher'

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

export interface BaseEntity {
  id: number
  created: number
  updated: number
}

/**
 * Abstract base class for all storage implementations
 * Provides common functionality like caching, locking, and validation
 */
export abstract class BaseStorage<TEntity extends BaseEntity, TStorage extends Record<string | number, TEntity>> {
  protected basePath: string
  protected cache: Map<string, CacheEntry<any>> = new Map()
  protected locks: Map<string, Promise<void>> = new Map()
  protected options: Required<StorageOptions>
  private static idCounter = 0

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
    
    // Set up file watcher for cache invalidation
    this.setupFileWatcher()
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract getIndexPath(): string
  protected abstract getEntityPath(id: number): string | null

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
    return this.withLock(filePath, async () => {
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
    })
  }

  // --- Caching Functions ---

  protected getFromCache<T>(key: string): T | null {
    if (!this.options.cacheEnabled) return null

    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    const now = Date.now()
    if (now - entry.timestamp > this.options.cacheTTL) {
      this.cache.delete(key)
      return null
    }

    // Update hit count
    entry.hits++
    return entry.data as T
  }

  protected addToCache<T>(key: string, data: T): void {
    if (!this.options.cacheEnabled) return

    // Enforce max cache size using LRU eviction
    if (this.cache.size >= this.options.maxCacheSize) {
      // Find least recently used entry
      let lruKey: string | null = null
      let minHits = Infinity
      let oldestTime = Infinity

      for (const [k, entry] of this.cache.entries()) {
        if (entry.hits < minHits || (entry.hits === minHits && entry.timestamp < oldestTime)) {
          lruKey = k
          minHits = entry.hits
          oldestTime = entry.timestamp
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

  protected invalidateCache(key?: string): void {
    if (!this.options.cacheEnabled) return

    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  // --- Locking Functions ---

  protected async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // For now, disable locking to fix basic functionality
    // TODO: Implement proper locking mechanism
    return await operation()
  }

  // --- Helper Functions ---

  protected async ensureDirExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        console.error(`Error creating directory ${dirPath}:`, error)
        throw new Error(`Failed to ensure directory exists: ${dirPath}`)
      }
    }
  }

  public async generateId(): Promise<number> {
    const baseId = normalizeToUnixMs(new Date())
    // Add counter and randomness to reduce collisions in high-frequency scenarios
    BaseStorage.idCounter = (BaseStorage.idCounter + 1) % 10000
    const counterSuffix = BaseStorage.idCounter
    const randomSuffix = Math.floor(Math.random() * 10000)
    let id = baseId + counterSuffix + randomSuffix
    const maxAttempts = 1000 // Prevent infinite loops
    let attempts = 0

    // Simple collision avoidance - increment until unique
    // Subclasses should override this if they need more sophisticated ID generation
    while (attempts < maxAttempts) {
      if (!(await this.idExists(id))) {
        return id
      }
      id++
      attempts++
    }

    throw new Error(`Failed to generate unique ID after ${maxAttempts} attempts`)
  }

  // Check if ID exists in storage
  protected async idExists(id: number): Promise<boolean> {
    try {
      const all = await this.readAll()
      return id in all
    } catch (error) {
      return false
    }
  }

  // --- Public API ---

  public async readAll(): Promise<TStorage> {
    return this.readValidatedJson(this.getIndexPath(), this.storageSchema, {} as TStorage)
  }

  public async writeAll(data: TStorage): Promise<TStorage> {
    return this.writeValidatedJson(this.getIndexPath(), data, this.storageSchema)
  }

  public async getById(id: number): Promise<TEntity | null> {
    const all = await this.readAll()
    return (all[id] as TEntity) || null
  }

  public async create(data: Omit<TEntity, 'id' | 'created' | 'updated'>): Promise<TEntity> {
    const indexPath = this.getIndexPath()
    
    return this.withLock(indexPath, async () => {
      const id = await this.generateId()
      const now = Date.now()
      
      const entity = {
        ...data,
        id,
        created: now,
        updated: now
      } as TEntity

      const validated = await this.entitySchema.parseAsync(entity)
      
      const all = await this.readAll()
      all[id] = validated
      await this.writeAll(all)
      
      // Invalidate cache
      this.invalidateCache()
      
      return validated
    })
  }

  public async update(id: number, data: Partial<Omit<TEntity, 'id' | 'created' | 'updated'>>): Promise<TEntity | null> {
    const indexPath = this.getIndexPath()
    
    return this.withLock(indexPath, async () => {
      const existing = await this.getById(id)
      if (!existing) return null

      const updated = {
        ...existing,
        ...data,
        updated: Date.now()
      } as TEntity

      const validated = await this.entitySchema.parseAsync(updated)
      
      const all = await this.readAll()
      all[id] = validated
      await this.writeAll(all)
      
      // Invalidate cache
      this.invalidateCache()
      
      return validated
    })
  }

  public async delete(id: number): Promise<boolean> {
    const indexPath = this.getIndexPath()
    
    return this.withLock(indexPath, async () => {
      const all = await this.readAll()
      if (!all[id]) return false

      delete all[id]
      await this.writeAll(all)
      
      // Delete entity-specific data if path exists
      const entityPath = this.getEntityPath(id)
      if (entityPath && existsSync(entityPath)) {
        await fs.rm(entityPath, { recursive: true, force: true })
      }
      
      // Invalidate cache
      this.invalidateCache()
      
      return true
    })
  }

  public async list(): Promise<TEntity[]> {
    const all = await this.readAll()
    return Object.values(all)
  }

  public async deleteAll(): Promise<void> {
    await this.writeAll({} as TStorage)
    
    // Also clean up any entity-specific directories
    const indexPath = this.getIndexPath()
    const baseDir = path.dirname(indexPath)
    
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

  // Cache management methods
  public clearCache(): void {
    this.invalidateCache()
  }

  public getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      ttl: this.options.cacheTTL,
      enabled: this.options.cacheEnabled
    }
  }

  // --- File Watching for Cache Invalidation ---

  private setupFileWatcher(): void {
    if (!this.options.cacheEnabled) return

    // Watch the index file for changes
    const indexPath = this.getIndexPath()
    globalFileWatcher.on('change', (filePath) => {
      if (filePath === indexPath) {
        // Invalidate the entire cache when the index file changes
        this.invalidateCache()
      }
    })
    
    // Start watching the index file
    globalFileWatcher.watchFile(indexPath)
  }

  /**
   * Invalidate cache for a specific ID
   */
  public invalidateCacheForId(id: number): void {
    if (!this.options.cacheEnabled) return
    
    // Remove from cache any entries that might contain this ID
    const indexPath = this.getIndexPath()
    this.cache.delete(indexPath)
    
    // Also remove entity-specific cache if applicable
    const entityPath = this.getEntityPath(id)
    if (entityPath) {
      this.cache.delete(entityPath)
    }
  }
}