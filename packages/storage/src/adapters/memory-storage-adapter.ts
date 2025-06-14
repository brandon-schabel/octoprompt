import fs from 'node:fs/promises'
import path from 'node:path'
import {
  BaseStorageAdapter,
  type StorageConfig,
  type ListOptions,
  type TransactionOperation,
  type TransactionContext,
  StorageError,
  StorageErrorCode
} from '../core/storage-adapter'

interface MemoryCacheEntry {
  data: any
  timestamp: number
  accessed: number
  hits: number
}

interface TransactionState {
  reads: Map<string, any>
  writes: Map<string, any>
  deletes: Set<string>
  aborted: boolean
}

/**
 * In-memory storage adapter for testing and development
 * Optionally persists to disk for durability
 */
export class MemoryStorageAdapter extends BaseStorageAdapter {
  private storage = new Map<string, MemoryCacheEntry>()
  private locks = new Map<string, Promise<void>>()
  private transactions = new Map<string, TransactionState>()
  private persistPath?: string
  private persistTimer?: NodeJS.Timeout
  private isConnected = false

  constructor(config: StorageConfig & { persistPath?: string } = {}) {
    super(config)
    this.persistPath = config.persistPath
  }

  async connect(): Promise<void> {
    if (this.isConnected) return

    // Load from disk if persist path is configured
    if (this.persistPath) {
      await this.loadFromDisk()

      // Start periodic persistence
      if (this.config.persistInterval > 0) {
        this.persistTimer = setInterval(() => this.persistToDisk().catch(console.error), this.config.persistInterval)
      }
    }

    this.isConnected = true
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return

    // Clear persist timer
    if (this.persistTimer) {
      clearInterval(this.persistTimer)
      this.persistTimer = undefined
    }

    // Final persist to disk
    if (this.persistPath) {
      await this.persistToDisk()
    }

    this.isConnected = false
  }

  async read<T>(key: string): Promise<T | null> {
    const namespacedKey = this.getNamespacedKey(key)
    const entry = this.storage.get(namespacedKey)

    if (!entry) {
      return null
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.storage.delete(namespacedKey)
      return null
    }

    // Update access stats
    entry.accessed = Date.now()
    entry.hits++

    return entry.data as T
  }

  async write<T>(key: string, data: T): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key)

    // Enforce cache size limit
    if (this.storage.size >= this.config.maxCacheSize && !this.storage.has(namespacedKey)) {
      this.evictLeastUsed()
    }

    const now = Date.now()
    this.storage.set(namespacedKey, {
      data,
      timestamp: now,
      accessed: now,
      hits: 0
    })
  }

  async delete(key: string): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key)
    this.storage.delete(namespacedKey)
  }

  async exists(key: string): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key)
    const entry = this.storage.get(namespacedKey)

    if (!entry) return false

    // Check TTL
    if (this.isExpired(entry)) {
      this.storage.delete(namespacedKey)
      return false
    }

    return true
  }

  async list(prefix?: string, options: ListOptions = {}): Promise<string[]> {
    const searchPrefix = prefix ? this.getNamespacedKey(prefix) : this.namespace
    const keys: string[] = []

    for (const [key, entry] of this.storage.entries()) {
      // Skip expired entries
      if (this.isExpired(entry)) {
        this.storage.delete(key)
        continue
      }

      if (!searchPrefix || key.startsWith(searchPrefix)) {
        keys.push(this.removeNamespace(key))
      }
    }

    // Sort keys
    keys.sort()
    if (options.reverse) {
      keys.reverse()
    }

    // Apply pagination
    const start = options.offset || 0
    const end = options.limit ? start + options.limit : undefined

    return keys.slice(start, end)
  }

  async count(prefix?: string): Promise<number> {
    const searchPrefix = prefix ? this.getNamespacedKey(prefix) : this.namespace
    let count = 0

    for (const [key, entry] of this.storage.entries()) {
      // Skip expired entries
      if (this.isExpired(entry)) {
        this.storage.delete(key)
        continue
      }

      if (!searchPrefix || key.startsWith(searchPrefix)) {
        count++
      }
    }

    return count
  }

  async clear(): Promise<void> {
    if (this.namespace) {
      // Clear only namespaced keys
      const keysToDelete = Array.from(this.storage.keys()).filter((key) => key.startsWith(this.namespace))

      for (const key of keysToDelete) {
        this.storage.delete(key)
      }
    } else {
      // Clear everything
      this.storage.clear()
    }
  }

  // Optimized bulk operations
  async readMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>()

    for (const key of keys) {
      const value = await this.read<T>(key)
      if (value !== null) {
        results.set(key, value)
      }
    }

    return results
  }

  async writeMany<T>(entries: Map<string, T>): Promise<void> {
    // Batch write for better performance
    const now = Date.now()

    for (const [key, data] of entries) {
      const namespacedKey = this.getNamespacedKey(key)

      // Enforce cache size limit
      if (this.storage.size >= this.config.maxCacheSize && !this.storage.has(namespacedKey)) {
        this.evictLeastUsed()
      }

      this.storage.set(namespacedKey, {
        data,
        timestamp: now,
        accessed: now,
        hits: 0
      })
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      const namespacedKey = this.getNamespacedKey(key)
      this.storage.delete(namespacedKey)
    }
  }

  // Transaction support
  async transaction<T>(operations: TransactionOperation[]): Promise<T> {
    const transactionId = `tx_${Date.now()}_${Math.random()}`
    const state: TransactionState = {
      reads: new Map(),
      writes: new Map(),
      deletes: new Set(),
      aborted: false
    }

    this.transactions.set(transactionId, state)

    try {
      const context: TransactionContext = {
        read: async <U>(key: string): Promise<U | null> => {
          if (state.aborted) throw new StorageError('Transaction aborted', StorageErrorCode.TRANSACTION_FAILED)

          // Check if key was written in this transaction
          if (state.writes.has(key)) {
            return state.writes.get(key) as U
          }

          // Check if key was deleted in this transaction
          if (state.deletes.has(key)) {
            return null
          }

          // Read from storage and cache in transaction
          const value = await this.read<U>(key)
          state.reads.set(key, value)
          return value
        },

        write: async <U>(key: string, data: U): Promise<void> => {
          if (state.aborted) throw new StorageError('Transaction aborted', StorageErrorCode.TRANSACTION_FAILED)
          state.writes.set(key, data)
          state.deletes.delete(key) // Remove from deletes if it was there
        },

        delete: async (key: string): Promise<void> => {
          if (state.aborted) throw new StorageError('Transaction aborted', StorageErrorCode.TRANSACTION_FAILED)
          state.deletes.add(key)
          state.writes.delete(key) // Remove from writes if it was there
        },

        abort: (): void => {
          state.aborted = true
        }
      }

      // Execute operations
      let result: any = null
      for (const op of operations) {
        switch (op.type) {
          case 'read':
            result = await context.read(op.key)
            break
          case 'write':
            await context.write(op.key, op.data)
            break
          case 'delete':
            await context.delete(op.key)
            break
        }
      }

      if (state.aborted) {
        throw new StorageError('Transaction was aborted', StorageErrorCode.TRANSACTION_FAILED)
      }

      // Commit changes
      for (const [key, data] of state.writes) {
        await this.write(key, data)
      }

      for (const key of state.deletes) {
        await this.delete(key)
      }

      return result as T
    } catch (error) {
      // Transaction failed, no changes applied
      throw new StorageError(
        `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.TRANSACTION_FAILED,
        error instanceof Error ? error : undefined
      )
    } finally {
      this.transactions.delete(transactionId)
    }
  }

  // Helper methods
  private isExpired(entry: MemoryCacheEntry): boolean {
    return Date.now() - entry.timestamp > this.config.cacheTTL
  }

  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null
    let leastUsedEntry: MemoryCacheEntry | null = null

    for (const [key, entry] of this.storage.entries()) {
      if (!leastUsedEntry || this.isLessUsed(entry, leastUsedEntry)) {
        leastUsedKey = key
        leastUsedEntry = entry
      }
    }

    if (leastUsedKey) {
      this.storage.delete(leastUsedKey)
    }
  }

  private isLessUsed(a: MemoryCacheEntry, b: MemoryCacheEntry): boolean {
    switch (this.config.cacheStrategy) {
      case 'lru':
        // Compare accessed time first, then use timestamp as tiebreaker
        if (a.accessed === b.accessed) {
          return a.timestamp < b.timestamp
        }
        return a.accessed < b.accessed
      case 'lfu':
        // Compare hits first, then use timestamp as tiebreaker
        if (a.hits === b.hits) {
          return a.timestamp < b.timestamp
        }
        return a.hits < b.hits
      case 'fifo':
      default:
        return a.timestamp < b.timestamp
    }
  }

  // Persistence methods
  private async loadFromDisk(): Promise<void> {
    if (!this.persistPath) return

    try {
      const data = await fs.readFile(this.persistPath, 'utf-8')
      const parsed = JSON.parse(data)

      // Restore storage from disk
      for (const [key, entry] of Object.entries(parsed)) {
        this.storage.set(key, entry as MemoryCacheEntry)
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to load memory storage from disk: ${error.message}`)
      }
    }
  }

  private async persistToDisk(): Promise<void> {
    if (!this.persistPath) return

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.persistPath), { recursive: true })

      // Convert storage to plain object
      const data = Object.fromEntries(this.storage.entries())

      // Write to temp file first for atomicity
      const tempPath = `${this.persistPath}.tmp`
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
      await fs.rename(tempPath, this.persistPath)
    } catch (error) {
      console.error(`Failed to persist memory storage to disk: ${error}`)
    }
  }

  // Debug and stats methods
  getStats() {
    const now = Date.now()
    let totalHits = 0
    let validEntries = 0
    let expiredEntries = 0

    for (const entry of this.storage.values()) {
      if (this.isExpired(entry)) {
        expiredEntries++
      } else {
        validEntries++
        totalHits += entry.hits
      }
    }

    return {
      totalEntries: this.storage.size,
      validEntries,
      expiredEntries,
      totalHits,
      avgHits: validEntries > 0 ? totalHits / validEntries : 0,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage in bytes
    let size = 0
    for (const [key, entry] of this.storage.entries()) {
      size += key.length * 2 // UTF-16 encoding
      size += JSON.stringify(entry.data).length * 2
      size += 64 // Entry metadata overhead
    }
    return size
  }
}
