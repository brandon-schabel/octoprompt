/**
 * Memory Storage Plugin
 * In-memory cache with TTL support and LRU eviction
 */

import { Effect, Ref, HashMap, Option, pipe } from 'effect'
import type { StoragePlugin, CacheEntry, StorageError } from '../types'
import { StorageError as StorageErrorClass } from '../types'

interface MemoryStorageConfig {
  maxSize?: number // Maximum number of entries
  defaultTTL?: number // Default TTL in milliseconds
  checkInterval?: number // Interval to check for expired entries
}

interface InternalCacheEntry<T> extends CacheEntry<T> {
  lastAccessed: number
  size: number
}

export class MemoryStoragePlugin implements StoragePlugin {
  readonly name = 'memory-storage'
  readonly version = '1.0.0'
  readonly capabilities = ['ttl', 'lru', 'fast-access']

  private cache: Ref.Ref<HashMap.HashMap<string, InternalCacheEntry<any>>>
  private config: MemoryStorageConfig
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: MemoryStorageConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 3600000, // 1 hour
      checkInterval: config.checkInterval || 60000 // 1 minute
    }
    
    this.cache = Ref.unsafeMake(HashMap.empty<string, InternalCacheEntry<any>>())
  }

  initialize(): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(function* (_) {
      // Start cleanup interval
      if (this.config.checkInterval && this.config.checkInterval > 0) {
        this.cleanupInterval = setInterval(() => {
          Effect.runSync(this.removeExpired())
        }, this.config.checkInterval)
      }
    }.bind(this))
  }

  cleanup(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
        this.cleanupInterval = null
      }
    })
  }

  get<T>(key: string): Effect.Effect<CacheEntry<T> | null, StorageErrorClass> {
    return Effect.gen(function* (_) {
      const cacheMap = yield* _(Ref.get(this.cache))
      const entry = HashMap.get(cacheMap, key)
      
      if (Option.isNone(entry)) {
        return null
      }
      
      const cacheEntry = entry.value as InternalCacheEntry<T>
      
      // Check if expired
      if (this.isExpired(cacheEntry)) {
        yield* _(this.delete(key))
        return null
      }
      
      // Update last accessed time
      const updatedEntry: InternalCacheEntry<T> = {
        ...cacheEntry,
        lastAccessed: Date.now()
      }
      
      yield* _(Ref.update(this.cache, (map) => 
        HashMap.set(map, key, updatedEntry)
      ))
      
      // Return without internal fields
      return {
        value: cacheEntry.value,
        timestamp: cacheEntry.timestamp,
        ttl: cacheEntry.ttl,
        metadata: cacheEntry.metadata
      }
    }.bind(this)).pipe(
      Effect.catchAll((error) => 
        Effect.fail(new StorageErrorClass({
          operation: 'read' as const,
          key,
          message: `Failed to get cache entry: ${error}`
        }))
      )
    )
  }

  set<T>(key: string, value: T, ttl?: number): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(function* (_) {
      const timestamp = Date.now()
      const effectiveTTL = ttl || this.config.defaultTTL
      
      const entry: InternalCacheEntry<T> = {
        value,
        timestamp,
        ttl: effectiveTTL,
        lastAccessed: timestamp,
        size: this.estimateSize(value)
      }
      
      // Check if we need to evict entries
      const cacheMap = yield* _(Ref.get(this.cache))
      const currentSize = HashMap.size(cacheMap)
      
      if (currentSize >= this.config.maxSize! && !HashMap.has(cacheMap, key)) {
        yield* _(this.evictLRU())
      }
      
      yield* _(Ref.update(this.cache, (map) => 
        HashMap.set(map, key, entry)
      ))
    }.bind(this)).pipe(
      Effect.catchAll((error) => 
        Effect.fail(new StorageErrorClass({
          operation: 'write' as const,
          key,
          message: `Failed to set cache entry: ${error}`
        }))
      )
    )
  }

  delete(key: string): Effect.Effect<void, StorageErrorClass> {
    return Ref.update(this.cache, (map) => 
      HashMap.remove(map, key)
    ).pipe(
      Effect.catchAll((error) => 
        Effect.fail(new StorageErrorClass({
          operation: 'delete' as const,
          key,
          message: `Failed to delete cache entry: ${error}`
        }))
      )
    )
  }

  clear(): Effect.Effect<void, StorageErrorClass> {
    return Ref.set(this.cache, HashMap.empty()).pipe(
      Effect.catchAll((error) => 
        Effect.fail(new StorageErrorClass({
          operation: 'clear' as const,
          message: `Failed to clear cache: ${error}`
        }))
      )
    )
  }

  has(key: string): Effect.Effect<boolean, StorageErrorClass> {
    return Effect.gen(function* (_) {
      const cacheMap = yield* _(Ref.get(this.cache))
      const entry = HashMap.get(cacheMap, key)
      
      if (Option.isNone(entry)) {
        return false
      }
      
      // Check if expired
      if (this.isExpired(entry.value)) {
        yield* _(this.delete(key))
        return false
      }
      
      return true
    }.bind(this)).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    )
  }

  keys(): Effect.Effect<readonly string[], StorageErrorClass> {
    return Effect.gen(function* (_) {
      const cacheMap = yield* _(Ref.get(this.cache))
      const allKeys = Array.from(HashMap.keys(cacheMap))
      
      // Filter out expired keys
      const validKeys: string[] = []
      for (const key of allKeys) {
        const hasKey = yield* _(this.has(key))
        if (hasKey) {
          validKeys.push(key)
        }
      }
      
      return validKeys
    }.bind(this)).pipe(
      Effect.catchAll((error) => 
        Effect.fail(new StorageErrorClass({
          operation: 'read' as const,
          message: `Failed to get keys: ${error}`
        }))
      )
    )
  }

  // Additional methods specific to memory storage

  /**
   * Get storage statistics
   */
  getStats(): Effect.Effect<{
    size: number
    maxSize: number
    hitRate: number
    evictions: number
  }, never> {
    return Effect.gen(function* (_) {
      const cacheMap = yield* _(Ref.get(this.cache))
      return {
        size: HashMap.size(cacheMap),
        maxSize: this.config.maxSize!,
        hitRate: 0, // Would need to track this
        evictions: 0 // Would need to track this
      }
    }.bind(this))
  }

  /**
   * Remove expired entries
   */
  private removeExpired(): Effect.Effect<void, never> {
    return Effect.gen(function* (_) {
      const cacheMap = yield* _(Ref.get(this.cache))
      const now = Date.now()
      
      const activeEntries = HashMap.filter(cacheMap, (entry) => {
        return !this.isExpired(entry, now)
      })
      
      yield* _(Ref.set(this.cache, activeEntries))
    }.bind(this))
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): Effect.Effect<void, never> {
    return Effect.gen(function* (_) {
      const cacheMap = yield* _(Ref.get(this.cache))
      
      // Find LRU entry
      let lruKey: string | null = null
      let lruTime = Date.now()
      
      for (const [key, entry] of HashMap.entries(cacheMap)) {
        if (entry.lastAccessed < lruTime) {
          lruTime = entry.lastAccessed
          lruKey = key
        }
      }
      
      if (lruKey) {
        yield* _(Ref.update(this.cache, (map) => 
          HashMap.remove(map, lruKey!)
        ))
      }
    }.bind(this))
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: InternalCacheEntry<any>, now?: number): boolean {
    if (!entry.ttl || entry.ttl <= 0) {
      return false
    }
    
    const currentTime = now || Date.now()
    return currentTime - entry.timestamp > entry.ttl
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2 // Rough estimate for UTF-16
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2
      } catch {
        return 1024 // Default size for non-serializable objects
      }
    }
    
    return 8 // Default for primitives
  }
}

/**
 * Create a memory storage plugin with configuration
 */
export function createMemoryStorage(config?: MemoryStorageConfig): MemoryStoragePlugin {
  return new MemoryStoragePlugin(config)
}

/**
 * Default memory storage instance
 */
export const defaultMemoryStorage = createMemoryStorage()