/**
 * IndexedDB Storage Plugin
 * Browser-compatible storage with async operations
 */

import { Effect, Option } from 'effect'
import type { StoragePlugin, CacheEntry, StorageError } from '../types'
import { StorageError as StorageErrorClass } from '../types'

interface IndexedDBConfig {
  dbName?: string
  storeName?: string
  version?: number
  indexes?: Array<{
    name: string
    keyPath: string
    unique?: boolean
  }>
}

export class IndexedDBStoragePlugin implements StoragePlugin {
  readonly name = 'indexed-db-storage'
  readonly version = '1.0.0'
  readonly capabilities = ['browser', 'async', 'indexed', 'full-text-search']

  private config: IndexedDBConfig
  private db: IDBDatabase | null = null

  constructor(config: IndexedDBConfig = {}) {
    this.config = {
      dbName: config.dbName || 'prompt-engineer-cache',
      storeName: config.storeName || 'prompts',
      version: config.version || 1,
      indexes: config.indexes || [
        { name: 'timestamp', keyPath: 'timestamp', unique: false },
        { name: 'ttl', keyPath: 'ttl', unique: false }
      ]
    }
  }

  initialize(): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        // Check if IndexedDB is available
        if (typeof window === 'undefined' || !window.indexedDB) {
          return yield* _(
            Effect.fail(
              new StorageErrorClass({
                operation: 'read' as const,
                message: 'IndexedDB is not available in this environment'
              })
            )
          )
        }

        // Open database
        const db = yield* _(this.openDatabase())
        this.db = db
      }.bind(this)
    )
  }

  cleanup(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      if (this.db) {
        this.db.close()
        this.db = null
      }
    })
  }

  get<T>(key: string): Effect.Effect<CacheEntry<T> | null, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const db = yield* _(this.getDatabase())

        const result = yield* _(
          Effect.tryPromise({
            try: () =>
              new Promise<CacheEntry<T> | null>((resolve, reject) => {
                const transaction = db.transaction([this.config.storeName!], 'readonly')
                const store = transaction.objectStore(this.config.storeName!)
                const request = store.get(key)

                request.onsuccess = () => {
                  const entry = request.result as (CacheEntry<T> & { key: string }) | undefined

                  if (!entry) {
                    resolve(null)
                    return
                  }

                  // Check if expired
                  if (entry.ttl && entry.ttl > 0) {
                    const age = Date.now() - entry.timestamp
                    if (age > entry.ttl) {
                      // Delete expired entry asynchronously
                      this.delete(key)
                        .pipe(Effect.runPromise)
                        .catch(() => {})
                      resolve(null)
                      return
                    }
                  }

                  // Remove the key field before returning
                  const { key: _, ...cacheEntry } = entry
                  resolve(cacheEntry as CacheEntry<T>)
                }

                request.onerror = () => {
                  reject(new Error(`Failed to get entry: ${request.error}`))
                }
              }),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'read' as const,
                key,
                message: `Failed to get from IndexedDB: ${error}`
              })
          })
        )

        return result
      }.bind(this)
    )
  }

  set<T>(key: string, value: T, ttl?: number): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const db = yield* _(this.getDatabase())

        const entry = {
          key, // IndexedDB needs the key in the object
          value,
          timestamp: Date.now(),
          ttl,
          metadata: {}
        }

        yield* _(
          Effect.tryPromise({
            try: () =>
              new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([this.config.storeName!], 'readwrite')
                const store = transaction.objectStore(this.config.storeName!)
                const request = store.put(entry)

                request.onsuccess = () => resolve()
                request.onerror = () => {
                  reject(new Error(`Failed to set entry: ${request.error}`))
                }
              }),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'write' as const,
                key,
                message: `Failed to write to IndexedDB: ${error}`
              })
          })
        )
      }.bind(this)
    )
  }

  delete(key: string): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const db = yield* _(this.getDatabase())

        yield* _(
          Effect.tryPromise({
            try: () =>
              new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([this.config.storeName!], 'readwrite')
                const store = transaction.objectStore(this.config.storeName!)
                const request = store.delete(key)

                request.onsuccess = () => resolve()
                request.onerror = () => {
                  reject(new Error(`Failed to delete entry: ${request.error}`))
                }
              }),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'delete' as const,
                key,
                message: `Failed to delete from IndexedDB: ${error}`
              })
          })
        )
      }.bind(this)
    )
  }

  clear(): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const db = yield* _(this.getDatabase())

        yield* _(
          Effect.tryPromise({
            try: () =>
              new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([this.config.storeName!], 'readwrite')
                const store = transaction.objectStore(this.config.storeName!)
                const request = store.clear()

                request.onsuccess = () => resolve()
                request.onerror = () => {
                  reject(new Error(`Failed to clear store: ${request.error}`))
                }
              }),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'clear' as const,
                message: `Failed to clear IndexedDB: ${error}`
              })
          })
        )
      }.bind(this)
    )
  }

  has(key: string): Effect.Effect<boolean, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const db = yield* _(this.getDatabase())

        const exists = yield* _(
          Effect.tryPromise({
            try: () =>
              new Promise<boolean>((resolve, reject) => {
                const transaction = db.transaction([this.config.storeName!], 'readonly')
                const store = transaction.objectStore(this.config.storeName!)
                const request = store.count(key)

                request.onsuccess = () => {
                  resolve(request.result > 0)
                }

                request.onerror = () => {
                  reject(new Error(`Failed to check key: ${request.error}`))
                }
              }),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'read' as const,
                key,
                message: `Failed to check key in IndexedDB: ${error}`
              })
          })
        )

        // Check if expired
        if (exists) {
          const entry = yield* _(this.get(key))
          return entry !== null
        }

        return false
      }.bind(this)
    )
  }

  keys(): Effect.Effect<readonly string[], StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const db = yield* _(this.getDatabase())

        const allKeys = yield* _(
          Effect.tryPromise({
            try: () =>
              new Promise<string[]>((resolve, reject) => {
                const transaction = db.transaction([this.config.storeName!], 'readonly')
                const store = transaction.objectStore(this.config.storeName!)
                const request = store.getAllKeys()

                request.onsuccess = () => {
                  resolve(request.result as string[])
                }

                request.onerror = () => {
                  reject(new Error(`Failed to get keys: ${request.error}`))
                }
              }),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'read' as const,
                message: `Failed to get keys from IndexedDB: ${error}`
              })
          })
        )

        // Filter out expired keys
        const validKeys: string[] = []
        for (const key of allKeys) {
          const hasKey = yield* _(this.has(key))
          if (hasKey) {
            validKeys.push(key)
          }
        }

        return validKeys
      }.bind(this)
    )
  }

  // Additional IndexedDB-specific methods

  /**
   * Search entries by index
   */
  searchByIndex<T>(
    indexName: string,
    query: IDBKeyRange | any
  ): Effect.Effect<Array<CacheEntry<T>>, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const db = yield* _(this.getDatabase())

        const results = yield* _(
          Effect.tryPromise({
            try: () =>
              new Promise<Array<CacheEntry<T>>>((resolve, reject) => {
                const transaction = db.transaction([this.config.storeName!], 'readonly')
                const store = transaction.objectStore(this.config.storeName!)
                const index = store.index(indexName)
                const request = index.getAll(query)

                request.onsuccess = () => {
                  const entries = request.result as Array<CacheEntry<T> & { key: string }>

                  // Filter expired and remove key field
                  const validEntries = entries
                    .filter((entry) => {
                      if (entry.ttl && entry.ttl > 0) {
                        const age = Date.now() - entry.timestamp
                        return age <= entry.ttl
                      }
                      return true
                    })
                    .map(({ key, ...entry }) => entry as CacheEntry<T>)

                  resolve(validEntries)
                }

                request.onerror = () => {
                  reject(new Error(`Failed to search by index: ${request.error}`))
                }
              }),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'read' as const,
                message: `Failed to search IndexedDB: ${error}`
              })
          })
        )

        return results
      }.bind(this)
    )
  }

  /**
   * Get storage size estimate
   */
  getStorageEstimate(): Effect.Effect<
    {
      usage: number
      quota: number
    },
    StorageErrorClass
  > {
    return Effect.tryPromise({
      try: async () => {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate()
          return {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0
          }
        }
        return { usage: 0, quota: 0 }
      },
      catch: (error) =>
        new StorageErrorClass({
          operation: 'read' as const,
          message: `Failed to get storage estimate: ${error}`
        })
    })
  }

  // Private helper methods

  private openDatabase(): Effect.Effect<IDBDatabase, StorageErrorClass> {
    return Effect.tryPromise({
      try: () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(this.config.dbName!, this.config.version)

          request.onerror = () => {
            reject(new Error(`Failed to open database: ${request.error}`))
          }

          request.onsuccess = () => {
            resolve(request.result)
          }

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(this.config.storeName!)) {
              const store = db.createObjectStore(this.config.storeName!, {
                keyPath: 'key'
              })

              // Create indexes
              for (const index of this.config.indexes || []) {
                store.createIndex(index.name, index.keyPath, {
                  unique: index.unique || false
                })
              }
            }
          }
        }),
      catch: (error) =>
        new StorageErrorClass({
          operation: 'read' as const,
          message: `Failed to open IndexedDB: ${error}`
        })
    })
  }

  private getDatabase(): Effect.Effect<IDBDatabase, StorageErrorClass> {
    if (!this.db) {
      return Effect.fail(
        new StorageErrorClass({
          operation: 'read' as const,
          message: 'Database not initialized. Call initialize() first.'
        })
      )
    }
    return Effect.succeed(this.db)
  }
}

/**
 * Create an IndexedDB storage plugin
 */
export function createIndexedDBStorage(config?: IndexedDBConfig): IndexedDBStoragePlugin {
  return new IndexedDBStoragePlugin(config)
}

/**
 * Default IndexedDB storage instance
 */
export const defaultIndexedDBStorage = createIndexedDBStorage()
