import {
  StorageAdapter,
  StorageAdapterFactory,
  StorageAdapterType,
  StorageConfig,
  StorageError,
  StorageErrorCode
} from './storage-adapter'
import { MemoryStorageAdapter } from '../adapters/memory-storage-adapter'
import { FileStorageAdapter } from '../adapters/file-storage-adapter'
import { MultiLevelCache, MultiLevelCacheConfig } from './multi-level-cache'

export interface CachedStorageAdapter extends StorageAdapter {
  getCache(): MultiLevelCache<any> | null
  invalidateCache(key?: string): Promise<void>
  warmupCache(keys: string[]): Promise<void>
}

/**
 * Factory for creating storage adapters with caching
 */
export class StorageAdapterFactoryImpl implements StorageAdapterFactory {
  private adapters = new Map<StorageAdapterType, (config: StorageConfig) => StorageAdapter>()
  private instances = new Map<string, StorageAdapter>()

  constructor() {
    this.registerDefaultAdapters()
  }

  create(type: StorageAdapterType, config: StorageConfig): StorageAdapter {
    const key = this.getInstanceKey(type, config)

    // Return existing instance if available
    if (this.instances.has(key)) {
      return this.instances.get(key)!
    }

    const factory = this.adapters.get(type)
    if (!factory) {
      throw new StorageError(`No adapter registered for type: ${type}`, StorageErrorCode.UNKNOWN)
    }

    const adapter = factory(config)
    this.instances.set(key, adapter)

    return adapter
  }

  createCached<T>(
    type: StorageAdapterType,
    config: StorageConfig,
    cacheConfig?: MultiLevelCacheConfig
  ): CachedStorageAdapter {
    const baseAdapter = this.create(type, config)

    if (!cacheConfig) {
      // Return adapter without caching
      return {
        ...baseAdapter,
        getCache: () => null,
        invalidateCache: async () => {},
        warmupCache: async () => {}
      }
    }

    return new CachedStorageAdapterImpl(baseAdapter, cacheConfig)
  }

  register(type: StorageAdapterType, factory: (config: StorageConfig) => StorageAdapter): void {
    this.adapters.set(type, factory)
  }

  private registerDefaultAdapters(): void {
    this.register(StorageAdapterType.MEMORY, (config) => new MemoryStorageAdapter(config))

    this.register(StorageAdapterType.FILE, (config) => {
      if (!config.dataPath) {
        throw new StorageError('dataPath is required for file storage adapter', StorageErrorCode.VALIDATION_ERROR)
      }
      return new FileStorageAdapter({ ...config, dataPath: config.dataPath })
    })
  }

  private getInstanceKey(type: StorageAdapterType, config: StorageConfig): string {
    const configHash = this.hashConfig(config)
    return `${type}-${configHash}`
  }

  private hashConfig(config: StorageConfig): string {
    // Simple hash of config for instance caching
    const str = JSON.stringify(config, Object.keys(config).sort())
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
}

/**
 * Cached storage adapter that wraps a base adapter with multi-level caching
 */
class CachedStorageAdapterImpl implements CachedStorageAdapter {
  private cache: MultiLevelCache<any>
  private initialized = false

  constructor(
    private baseAdapter: StorageAdapter,
    private cacheConfig: MultiLevelCacheConfig
  ) {
    this.cache = new MultiLevelCache(cacheConfig)
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.cache.initialize()
      this.initialized = true
    }
  }

  async read<T>(key: string): Promise<T | null> {
    await this.ensureInitialized()

    // Try cache first
    const cached = await this.cache.get(key)
    if (cached !== null) {
      return cached as T
    }

    // Cache miss, read from base adapter
    const value = await this.baseAdapter.read<T>(key)

    // Store in cache
    if (value !== null) {
      await this.cache.set(key, value)
    }

    return value
  }

  async write<T>(key: string, data: T): Promise<void> {
    await this.ensureInitialized()

    // Write to base adapter
    await this.baseAdapter.write(key, data)

    // Update cache
    await this.cache.set(key, data)
  }

  async delete(key: string): Promise<void> {
    await this.ensureInitialized()

    // Delete from base adapter
    await this.baseAdapter.delete(key)

    // Remove from cache
    await this.cache.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    await this.ensureInitialized()

    // Check cache first
    const cached = await this.cache.get(key)
    if (cached !== null) {
      return true
    }

    // Check base adapter
    return this.baseAdapter.exists(key)
  }

  async readMany<T>(keys: string[]): Promise<Map<string, T>> {
    await this.ensureInitialized()

    const results = new Map<string, T>()
    const cacheMisses: string[] = []

    // Check cache for each key
    for (const key of keys) {
      const cached = await this.cache.get(key)
      if (cached !== null) {
        results.set(key, cached as T)
      } else {
        cacheMisses.push(key)
      }
    }

    // Fetch cache misses from base adapter
    if (cacheMisses.length > 0) {
      const baseResults = await this.baseAdapter.readMany<T>(cacheMisses)

      // Update cache and results
      for (const [key, value] of baseResults) {
        results.set(key, value)
        await this.cache.set(key, value)
      }
    }

    return results
  }

  async writeMany<T>(entries: Map<string, T>): Promise<void> {
    await this.ensureInitialized()

    // Write to base adapter
    await this.baseAdapter.writeMany(entries)

    // Update cache
    for (const [key, value] of entries) {
      await this.cache.set(key, value)
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.ensureInitialized()

    // Delete from base adapter
    await this.baseAdapter.deleteMany(keys)

    // Remove from cache
    for (const key of keys) {
      await this.cache.delete(key)
    }
  }

  async list(prefix?: string, options?: any): Promise<string[]> {
    // List operations typically bypass cache
    return this.baseAdapter.list(prefix, options)
  }

  async count(prefix?: string): Promise<number> {
    // Count operations typically bypass cache
    return this.baseAdapter.count(prefix)
  }

  async transaction<T>(operations: any[]): Promise<T> {
    await this.ensureInitialized()

    // Execute transaction on base adapter
    const result = await this.baseAdapter.transaction<T>(operations)

    // Invalidate cache for affected keys
    for (const op of operations) {
      if (op.type === 'write' || op.type === 'delete') {
        await this.cache.delete(op.key)
      }
    }

    return result
  }

  async connect(): Promise<void> {
    await this.baseAdapter.connect()
    await this.ensureInitialized()
  }

  async disconnect(): Promise<void> {
    await this.baseAdapter.disconnect()
  }

  async clear(): Promise<void> {
    await this.ensureInitialized()

    await this.baseAdapter.clear()
    await this.cache.clear()
  }

  // Cached adapter specific methods
  getCache(): MultiLevelCache<any> {
    return this.cache
  }

  async invalidateCache(key?: string): Promise<void> {
    await this.ensureInitialized()

    if (key) {
      await this.cache.delete(key)
    } else {
      await this.cache.clear()
    }
  }

  async warmupCache(keys: string[]): Promise<void> {
    await this.ensureInitialized()

    // Preload keys into cache
    const values = await this.baseAdapter.readMany(keys)
    for (const [key, value] of values) {
      await this.cache.set(key, value)
    }
  }
}

/**
 * Storage registry for managing multiple storage instances
 */
export class StorageRegistry {
  private storages = new Map<string, StorageAdapter>()
  private factory = new StorageAdapterFactoryImpl()

  register(name: string, adapter: StorageAdapter): void {
    this.storages.set(name, adapter)
  }

  get(name: string): StorageAdapter | null {
    return this.storages.get(name) || null
  }

  create(
    name: string,
    type: StorageAdapterType,
    config: StorageConfig,
    cacheConfig?: MultiLevelCacheConfig
  ): StorageAdapter {
    const adapter = cacheConfig
      ? this.factory.createCached(type, config, cacheConfig)
      : this.factory.create(type, config)

    this.register(name, adapter)
    return adapter
  }

  async connectAll(): Promise<void> {
    const promises = Array.from(this.storages.values()).map((adapter) => adapter.connect())
    await Promise.all(promises)
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.storages.values()).map((adapter) => adapter.disconnect())
    await Promise.all(promises)
  }

  getStats(): Promise<any[]> {
    return Promise.all(
      Array.from(this.storages.entries()).map(async ([name, adapter]) => {
        try {
          const cache = (adapter as CachedStorageAdapter).getCache?.()
          const stats = cache ? await cache.getStats() : null

          return {
            name,
            type: adapter.constructor.name,
            cache: stats
          }
        } catch (error) {
          return {
            name,
            type: adapter.constructor.name,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      })
    )
  }
}

// Global registry instance
export const globalStorageRegistry = new StorageRegistry()

// Helper functions for common storage patterns
export function createProjectStorage(projectId: number): StorageAdapter {
  return globalStorageRegistry.create(
    `project-${projectId}`,
    StorageAdapterType.FILE,
    {
      namespace: `project-${projectId}`,
      dataPath: `./data/projects/${projectId}`,
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 1000
    },
    {
      levels: [
        {
          name: 'memory',
          type: 'memory',
          maxSize: 100,
          ttl: 60 * 1000, // 1 minute
          evictionStrategy: 'lru'
        },
        {
          name: 'disk',
          type: 'disk',
          maxSize: 1000,
          ttl: 60 * 60 * 1000, // 1 hour
          evictionStrategy: 'lru',
          config: {
            path: `./cache/projects/${projectId}`
          }
        }
      ],
      writeThrough: false,
      writeBack: true,
      promotionStrategy: 'mixed'
    }
  )
}

export function createTestStorage(): StorageAdapter {
  return globalStorageRegistry.create('test', StorageAdapterType.MEMORY, {
    namespace: 'test',
    cacheEnabled: true,
    cacheTTL: 60 * 1000,
    maxCacheSize: 100
  })
}
