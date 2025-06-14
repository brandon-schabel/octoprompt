import { z, type ZodTypeAny } from 'zod'

/**
 * Base interface for all storage adapters
 * Provides a common API for different storage backends
 */
export interface StorageAdapter {
  // Basic CRUD operations
  read<T>(key: string): Promise<T | null>
  write<T>(key: string, data: T): Promise<void>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>

  // Bulk operations
  readMany<T>(keys: string[]): Promise<Map<string, T>>
  writeMany<T>(entries: Map<string, T>): Promise<void>
  deleteMany(keys: string[]): Promise<void>

  // Query operations
  list(prefix?: string, options?: ListOptions): Promise<string[]>
  count(prefix?: string): Promise<number>

  // Transaction support
  transaction<T>(operations: TransactionOperation[]): Promise<T>

  // Lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>
  clear(): Promise<void>
}

export interface ListOptions {
  prefix?: string
  limit?: number
  offset?: number
  reverse?: boolean
}

export interface TransactionOperation {
  type: 'read' | 'write' | 'delete'
  key: string
  data?: any
}

export interface TransactionContext {
  read<T>(key: string): Promise<T | null>
  write<T>(key: string, data: T): Promise<void>
  delete(key: string): Promise<void>
  abort(): void
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  // General options
  namespace?: string // Prefix for all keys
  compression?: boolean // Enable compression
  encryption?: boolean // Enable encryption

  // Performance options
  batchSize?: number // Max items per batch operation
  connectionPoolSize?: number // For database adapters
  timeout?: number // Operation timeout in ms

  // Caching options
  cacheEnabled?: boolean
  cacheTTL?: number // Cache time-to-live in ms
  maxCacheSize?: number // Max cache entries
  cacheStrategy?: 'lru' | 'lfu' | 'fifo'

  // Concurrency options
  maxConcurrentReads?: number
  maxConcurrentWrites?: number
  lockTimeout?: number // Lock acquisition timeout

  // Persistence options
  persistInterval?: number // For memory adapter persistence
  backupEnabled?: boolean
  backupInterval?: number
  backupRetention?: number // Days to keep backups
}

/**
 * Base class for storage adapters with common functionality
 */
export abstract class BaseStorageAdapter implements StorageAdapter {
  protected config: Required<StorageConfig>
  protected namespace: string

  constructor(config: StorageConfig = {}) {
    this.config = {
      namespace: config.namespace || '',
      compression: config.compression ?? false,
      encryption: config.encryption ?? false,
      batchSize: config.batchSize ?? 100,
      connectionPoolSize: config.connectionPoolSize ?? 10,
      timeout: config.timeout ?? 30000,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? 5 * 60 * 1000, // 5 minutes
      maxCacheSize: config.maxCacheSize ?? 1000,
      cacheStrategy: config.cacheStrategy ?? 'lru',
      maxConcurrentReads: config.maxConcurrentReads ?? 100,
      maxConcurrentWrites: config.maxConcurrentWrites ?? 10,
      lockTimeout: config.lockTimeout ?? 30000,
      persistInterval: config.persistInterval ?? 60000, // 1 minute
      backupEnabled: config.backupEnabled ?? false,
      backupInterval: config.backupInterval ?? 24 * 60 * 60 * 1000, // 24 hours
      backupRetention: config.backupRetention ?? 7 // 7 days
    }
    this.namespace = this.config.namespace
  }

  // Helper method to add namespace to keys
  protected getNamespacedKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key
  }

  // Helper method to remove namespace from keys
  protected removeNamespace(key: string): string {
    if (!this.namespace) return key
    const prefix = `${this.namespace}:`
    return key.startsWith(prefix) ? key.slice(prefix.length) : key
  }

  // Default batch implementations (can be overridden for optimization)
  async readMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>()
    const batches = this.createBatches(keys, this.config.batchSize)

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (key) => {
          const value = await this.read<T>(key)
          if (value !== null) {
            results.set(key, value)
          }
        })
      )
    }

    return results
  }

  async writeMany<T>(entries: Map<string, T>): Promise<void> {
    const entriesArray = Array.from(entries.entries())
    const batches = this.createBatches(entriesArray, this.config.batchSize)

    for (const batch of batches) {
      await Promise.all(batch.map(([key, value]) => this.write(key, value)))
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    const batches = this.createBatches(keys, this.config.batchSize)

    for (const batch of batches) {
      await Promise.all(batch.map((key) => this.delete(key)))
    }
  }

  // Helper to create batches
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  // Abstract methods that must be implemented
  abstract read<T>(key: string): Promise<T | null>
  abstract write<T>(key: string, data: T): Promise<void>
  abstract delete(key: string): Promise<void>
  abstract exists(key: string): Promise<boolean>
  abstract list(prefix?: string, options?: ListOptions): Promise<string[]>
  abstract count(prefix?: string): Promise<number>
  abstract transaction<T>(operations: TransactionOperation[]): Promise<T>
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract clear(): Promise<void>
}

/**
 * Storage error types
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public code: StorageErrorCode,
    public cause?: Error
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

export enum StorageErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CORRUPTION = 'CORRUPTION',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Storage metrics for monitoring
 */
export interface StorageMetrics {
  reads: number
  writes: number
  deletes: number
  hits: number
  misses: number
  errors: number
  avgReadTime: number
  avgWriteTime: number
  cacheHitRate: number
  size: number
}

/**
 * Storage adapter factory
 */
export interface StorageAdapterFactory {
  create(type: StorageAdapterType, config: StorageConfig): StorageAdapter
}

export enum StorageAdapterType {
  MEMORY = 'memory',
  FILE = 'file',
  SQLITE = 'sqlite',
  REDIS = 'redis'
}
