import fs from 'node:fs/promises'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { 
  BaseStorageAdapter, 
  type StorageConfig, 
  type ListOptions, 
  type TransactionOperation,
  type TransactionContext,
  StorageError,
  StorageErrorCode
} from '../core/storage-adapter'
import { LockManager } from '../core/locks'

interface FileStorageConfig extends StorageConfig {
  dataPath: string
  atomicWrites?: boolean
  compression?: boolean
  backup?: {
    enabled: boolean
    path: string
    retention: number // days
  }
}

interface TransactionState {
  reads: Map<string, any>
  writes: Map<string, any>
  deletes: Set<string>
  aborted: boolean
  tempFiles: string[]
}

/**
 * File-based storage adapter with improved concurrency and reliability
 */
export class FileStorageAdapter extends BaseStorageAdapter {
  private dataPath: string
  private lockManager: LockManager
  private cache = new Map<string, { data: any; timestamp: number; hits: number }>()
  private transactions = new Map<string, TransactionState>()
  private isConnected = false
  
  constructor(config: FileStorageConfig) {
    super(config)
    this.dataPath = path.resolve(config.dataPath)
    this.lockManager = new LockManager(config.lockTimeout)
  }
  
  async connect(): Promise<void> {
    if (this.isConnected) return
    
    // Ensure data directory exists
    await this.ensureDirectoryExists(this.dataPath)
    
    // Clean up any leftover temp files
    await this.cleanupTempFiles()
    
    this.isConnected = true
  }
  
  async disconnect(): Promise<void> {
    if (!this.isConnected) return
    
    // Clean up locks and temp files
    this.lockManager.cleanup()
    await this.cleanupTempFiles()
    
    this.isConnected = false
  }
  
  async read<T>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key)
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<T>(key)
      if (cached !== null) {
        return cached
      }
    }
    
    return this.lockManager.withReadLock(filePath, async () => {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content) as T
        
        // Add to cache
        if (this.config.cacheEnabled) {
          this.addToCache(key, data)
        }
        
        return data
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return null
        }
        throw new StorageError(
          `Failed to read key ${key}: ${error.message}`,
          StorageErrorCode.UNKNOWN,
          error
        )
      }
    })
  }
  
  async write<T>(key: string, data: T): Promise<void> {
    const filePath = this.getFilePath(key)
    
    return this.lockManager.withWriteLock(filePath, async () => {
      try {
        // Ensure directory exists
        await this.ensureDirectoryExists(path.dirname(filePath))
        
        const content = JSON.stringify(data, null, 2)
        
        if (this.config.atomicWrites !== false) {
          // Atomic write using temp file
          const tempPath = `${filePath}.tmp.${Date.now()}`
          await fs.writeFile(tempPath, content, 'utf-8')
          await fs.rename(tempPath, filePath)
        } else {
          // Direct write
          await fs.writeFile(filePath, content, 'utf-8')
        }
        
        // Update cache
        if (this.config.cacheEnabled) {
          this.addToCache(key, data)
        }
      } catch (error: any) {
        throw new StorageError(
          `Failed to write key ${key}: ${error.message}`,
          StorageErrorCode.UNKNOWN,
          error
        )
      }
    })
  }
  
  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key)
    
    return this.lockManager.withWriteLock(filePath, async () => {
      try {
        await fs.unlink(filePath)
        
        // Remove from cache
        if (this.config.cacheEnabled) {
          this.removeFromCache(key)
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw new StorageError(
            `Failed to delete key ${key}: ${error.message}`,
            StorageErrorCode.UNKNOWN,
            error
          )
        }
      }
    })
  }
  
  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key)
    
    return this.lockManager.withReadLock(filePath, async () => {
      return existsSync(filePath)
    })
  }
  
  async list(prefix?: string, options: ListOptions = {}): Promise<string[]> {
    try {
      const files = await this.walkDirectory(this.dataPath, options)
      
      // Remove data path and .json extension, apply filters
      const keys = files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const relativePath = path.relative(this.dataPath, file)
          // Remove .json extension and convert back to key format
          const key = relativePath.slice(0, -5).replace(/\\/g, '/')
          return this.removeNamespace(key)
        })
        .filter(key => !prefix || key.startsWith(prefix))
      
      // Sort and paginate
      keys.sort()
      if (options.reverse) {
        keys.reverse()
      }
      
      const start = options.offset || 0
      const end = options.limit ? start + options.limit : undefined
      
      return keys.slice(start, end)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw new StorageError(
        `Failed to list keys: ${error.message}`,
        StorageErrorCode.UNKNOWN,
        error
      )
    }
  }
  
  async count(prefix?: string): Promise<number> {
    const keys = await this.list(prefix)
    return keys.length
  }
  
  async clear(): Promise<void> {
    const keys = await this.list()
    await this.deleteMany(keys)
  }
  
  // Transaction support
  async transaction<T>(operations: TransactionOperation[]): Promise<T> {
    const transactionId = `tx_${Date.now()}_${Math.random()}`
    const state: TransactionState = {
      reads: new Map(),
      writes: new Map(),
      deletes: new Set(),
      aborted: false,
      tempFiles: []
    }
    
    this.transactions.set(transactionId, state)
    
    try {
      const context: TransactionContext = {
        read: async <U>(key: string): Promise<U | null> => {
          if (state.aborted) throw new StorageError('Transaction aborted', StorageErrorCode.TRANSACTION_FAILED)
          
          // Check transaction state first
          if (state.writes.has(key)) {
            return state.writes.get(key) as U
          }
          if (state.deletes.has(key)) {
            return null
          }
          
          // Read from storage
          const value = await this.read<U>(key)
          state.reads.set(key, value)
          return value
        },
        
        write: async <U>(key: string, data: U): Promise<void> => {
          if (state.aborted) throw new StorageError('Transaction aborted', StorageErrorCode.TRANSACTION_FAILED)
          state.writes.set(key, data)
          state.deletes.delete(key)
        },
        
        delete: async (key: string): Promise<void> => {
          if (state.aborted) throw new StorageError('Transaction aborted', StorageErrorCode.TRANSACTION_FAILED)
          state.deletes.add(key)
          state.writes.delete(key)
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
      
      // Commit all changes atomically
      await this.commitTransaction(state)
      
      return result as T
    } catch (error) {
      // Rollback on error
      await this.rollbackTransaction(state)
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
  private getFilePath(key: string): string {
    const namespacedKey = this.getNamespacedKey(key)
    // Create nested directory structure instead of flattening
    // Only replace dangerous characters, but preserve path separators
    const safePath = namespacedKey.replace(/[\\:*?"<>|]/g, '_')
    return path.join(this.dataPath, `${safePath}.json`)
  }
  
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error
      }
    }
  }
  
  private async walkDirectory(dirPath: string, options: ListOptions): Promise<string[]> {
    const files: string[] = []
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath, options)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
    
    return files
  }
  
  private async commitTransaction(state: TransactionState): Promise<void> {
    // First write all new data to temp files
    const tempFiles: Array<{ temp: string; final: string }> = []
    
    try {
      // Prepare writes
      for (const [key, data] of state.writes) {
        const finalPath = this.getFilePath(key)
        const tempPath = `${finalPath}.tx.${Date.now()}`
        
        await this.ensureDirectoryExists(path.dirname(finalPath))
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
        
        tempFiles.push({ temp: tempPath, final: finalPath })
        state.tempFiles.push(tempPath)
      }
      
      // Atomically move temp files to final locations
      for (const { temp, final } of tempFiles) {
        await fs.rename(temp, final)
      }
      
      // Delete files
      for (const key of state.deletes) {
        const filePath = this.getFilePath(key)
        try {
          await fs.unlink(filePath)
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            throw error
          }
        }
      }
      
      // Update cache
      if (this.config.cacheEnabled) {
        for (const [key, data] of state.writes) {
          this.addToCache(key, data)
        }
        for (const key of state.deletes) {
          this.removeFromCache(key)
        }
      }
    } catch (error) {
      // Clean up temp files on error
      await this.cleanupTempFiles(state.tempFiles)
      throw error
    }
  }
  
  private async rollbackTransaction(state: TransactionState): Promise<void> {
    // Clean up any temp files created during transaction
    await this.cleanupTempFiles(state.tempFiles)
  }
  
  private async cleanupTempFiles(files?: string[]): Promise<void> {
    const filesToClean = files || await this.findTempFiles()
    
    for (const file of filesToClean) {
      try {
        await fs.unlink(file)
      } catch (error) {
        // Ignore errors - temp files might already be cleaned up
      }
    }
  }
  
  private async findTempFiles(): Promise<string[]> {
    const tempFiles: string[] = []
    
    try {
      const files = await this.walkDirectory(this.dataPath, {})
      
      for (const file of files) {
        if (file.includes('.tmp.') || file.includes('.tx.')) {
          tempFiles.push(file)
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return tempFiles
  }
  
  // Cache management
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.config.cacheTTL) {
      this.cache.delete(key)
      return null
    }
    
    entry.hits++
    return entry.data as T
  }
  
  private addToCache<T>(key: string, data: T): void {
    // Enforce cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLeastUsed()
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0
    })
  }
  
  private removeFromCache(key: string): void {
    this.cache.delete(key)
  }
  
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null
    let leastUsedEntry: { timestamp: number; hits: number } | null = null
    
    for (const [key, entry] of this.cache.entries()) {
      if (!leastUsedEntry || this.isLessUsed(entry, leastUsedEntry)) {
        leastUsedKey = key
        leastUsedEntry = entry
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey)
    }
  }
  
  private isLessUsed(a: { timestamp: number; hits: number }, b: { timestamp: number; hits: number }): boolean {
    switch (this.config.cacheStrategy) {
      case 'lru':
        return a.timestamp < b.timestamp
      case 'lfu':
        return a.hits < b.hits
      case 'fifo':
      default:
        return a.timestamp < b.timestamp
    }
  }
}