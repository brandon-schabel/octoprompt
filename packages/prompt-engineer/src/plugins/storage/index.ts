/**
 * Storage Plugin Exports
 * Collection of storage adapters for different environments
 */

export * from './memory-storage'
export * from './file-storage'
export * from './indexed-db-storage'

import { Effect } from 'effect'
import type { StoragePlugin } from '../types'
import { createMemoryStorage } from './memory-storage'
import { createFileStorage } from './file-storage'
import { createIndexedDBStorage } from './indexed-db-storage'

/**
 * Auto-detect and create the best storage plugin for the environment
 */
export function createAutoStorage(preferredStorage?: 'memory' | 'file' | 'indexed-db'): StoragePlugin {
  // If preference is specified, try to use it
  if (preferredStorage) {
    switch (preferredStorage) {
      case 'memory':
        return createMemoryStorage()
      case 'file':
        if (typeof process !== 'undefined' && process.versions?.node) {
          return createFileStorage({
            directory: '.prompt-engineer-cache'
          })
        }
        break
      case 'indexed-db':
        if (typeof window !== 'undefined' && window.indexedDB) {
          return createIndexedDBStorage()
        }
        break
    }
  }
  
  // Auto-detect based on environment
  if (typeof window !== 'undefined' && window.indexedDB) {
    // Browser environment - use IndexedDB
    return createIndexedDBStorage()
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    // Node.js environment - use file storage
    return createFileStorage({
      directory: '.prompt-engineer-cache'
    })
  } else {
    // Fallback to memory storage
    return createMemoryStorage()
  }
}

/**
 * Create a tiered storage plugin that tries multiple storage backends
 */
export class TieredStoragePlugin implements StoragePlugin {
  readonly name = 'tiered-storage'
  readonly version = '1.0.0'
  readonly capabilities = ['fallback', 'tiered']
  
  private storages: StoragePlugin[]
  
  constructor(storages: StoragePlugin[]) {
    if (storages.length === 0) {
      throw new Error('At least one storage plugin is required')
    }
    this.storages = storages
  }
  
  initialize(): Effect.Effect<void, any> {
    return Effect.gen(function* (_) {
      // Try to initialize each storage, keep the ones that succeed
      const initialized: StoragePlugin[] = []
      
      for (const storage of this.storages) {
        const result = yield* _(
          storage.initialize().pipe(
            Effect.map(() => storage),
            Effect.catchAll(() => Effect.succeed(null))
          )
        )
        
        if (result) {
          initialized.push(result)
        }
      }
      
      if (initialized.length === 0) {
        return yield* _(Effect.fail(new Error('No storage plugins could be initialized')))
      }
      
      this.storages = initialized
    }.bind(this))
  }
  
  cleanup(): Effect.Effect<void, never> {
    return Effect.gen(function* (_) {
      for (const storage of this.storages) {
        if (storage.cleanup) {
          yield* _(storage.cleanup())
        }
      }
    }.bind(this))
  }
  
  get<T>(key: string): Effect.Effect<any, any> {
    return Effect.gen(function* (_) {
      for (const storage of this.storages) {
        const result = yield* _(
          storage.get<T>(key).pipe(
            Effect.catchAll(() => Effect.succeed(null))
          )
        )
        
        if (result !== null) {
          return result
        }
      }
      
      return null
    }.bind(this))
  }
  
  set<T>(key: string, value: T, ttl?: number): Effect.Effect<void, any> {
    return Effect.gen(function* (_) {
      // Write to all storages in parallel
      const results = yield* _(
        Effect.all(
          this.storages.map(storage => 
            storage.set(key, value, ttl).pipe(
              Effect.catchAll(() => Effect.succeed(undefined))
            )
          ),
          { concurrency: 'unbounded' }
        )
      )
    }.bind(this))
  }
  
  delete(key: string): Effect.Effect<void, any> {
    return Effect.gen(function* (_) {
      // Delete from all storages in parallel
      yield* _(
        Effect.all(
          this.storages.map(storage => 
            storage.delete(key).pipe(
              Effect.catchAll(() => Effect.succeed(undefined))
            )
          ),
          { concurrency: 'unbounded' }
        )
      )
    }.bind(this))
  }
  
  clear(): Effect.Effect<void, any> {
    return Effect.gen(function* (_) {
      // Clear all storages in parallel
      yield* _(
        Effect.all(
          this.storages.map(storage => 
            storage.clear().pipe(
              Effect.catchAll(() => Effect.succeed(undefined))
            )
          ),
          { concurrency: 'unbounded' }
        )
      )
    }.bind(this))
  }
  
  has(key: string): Effect.Effect<boolean, any> {
    return Effect.gen(function* (_) {
      for (const storage of this.storages) {
        const result = yield* _(
          storage.has(key).pipe(
            Effect.catchAll(() => Effect.succeed(false))
          )
        )
        
        if (result) {
          return true
        }
      }
      
      return false
    }.bind(this))
  }
  
  keys(): Effect.Effect<readonly string[], any> {
    return Effect.gen(function* (_) {
      const allKeys = new Set<string>()
      
      for (const storage of this.storages) {
        const keys = yield* _(
          storage.keys().pipe(
            Effect.catchAll(() => Effect.succeed([]))
          )
        )
        
        for (const key of keys) {
          allKeys.add(key)
        }
      }
      
      return Array.from(allKeys)
    }.bind(this))
  }
}

/**
 * Create a tiered storage with fallback
 */
export function createTieredStorage(...storages: StoragePlugin[]): TieredStoragePlugin {
  return new TieredStoragePlugin(storages)
}