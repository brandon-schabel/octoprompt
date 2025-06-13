import fs from 'node:fs/promises'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { LockManager } from './locks'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  accessed: number
  hits: number
  size: number // Estimated size in bytes
}

export interface CacheLevel<T> {
  name: string
  get(key: string): Promise<CacheEntry<T> | null>
  set(key: string, entry: CacheEntry<T>): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  size(): Promise<number>
  stats(): Promise<CacheStats>
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  entries: number
  hitRate: number
  avgAccessTime: number
}

export interface MultiLevelCacheConfig {
  levels: CacheLevelConfig[]
  writeThrough?: boolean // Write to all levels on set
  writeBack?: boolean // Write to lower levels asynchronously
  promotionStrategy?: 'frequency' | 'recency' | 'mixed'
  compressionEnabled?: boolean
  encryptionKey?: string
}

export interface CacheLevelConfig {
  name: string
  type: 'memory' | 'disk' | 'redis'
  maxSize: number // Max entries or bytes
  ttl: number // Time to live in ms
  evictionStrategy: 'lru' | 'lfu' | 'fifo' | 'clock'
  config?: any // Level-specific config
}

/**
 * L1 Cache: In-memory LRU cache for fastest access
 */
export class MemoryCache<T> implements CacheLevel<T> {
  public name = 'memory'
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder: string[] = []
  private stats = {
    hits: 0,
    misses: 0,
    totalAccessTime: 0,
    accessCount: 0
  }
  
  constructor(
    private maxSize: number,
    private ttl: number,
    private evictionStrategy: 'lru' | 'lfu' | 'fifo' | 'clock' = 'lru'
  ) {}
  
  async get(key: string): Promise<CacheEntry<T> | null> {
    const start = Date.now()
    
    try {
      const entry = this.cache.get(key)
      
      if (!entry) {
        this.stats.misses++
        return null
      }
      
      // Check TTL
      if (Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(key)
        this.removeFromAccessOrder(key)
        this.stats.misses++
        return null
      }
      
      // Update access stats
      entry.accessed = Date.now()
      entry.hits++
      this.updateAccessOrder(key)
      this.stats.hits++
      
      return entry
    } finally {
      this.stats.totalAccessTime += Date.now() - start
      this.stats.accessCount++
    }
  }
  
  async set(key: string, entry: CacheEntry<T>): Promise<void> {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evict()
    }
    
    this.cache.set(key, { ...entry })
    this.updateAccessOrder(key)
  }
  
  async delete(key: string): Promise<void> {
    this.cache.delete(key)
    this.removeFromAccessOrder(key)
  }
  
  async clear(): Promise<void> {
    this.cache.clear()
    this.accessOrder = []
  }
  
  async size(): Promise<number> {
    return this.cache.size
  }
  
  async stats(): Promise<CacheStats> {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.estimateMemoryUsage(),
      entries: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgAccessTime: this.stats.accessCount > 0 ? this.stats.totalAccessTime / this.stats.accessCount : 0
    }
  }
  
  private evict(): void {
    let keyToEvict: string | null = null
    
    switch (this.evictionStrategy) {
      case 'lru':
        keyToEvict = this.accessOrder[0] || null
        break
      case 'lfu':
        keyToEvict = this.findLeastFrequentlyUsed()
        break
      case 'fifo':
        keyToEvict = this.accessOrder[0] || null
        break
      case 'clock':
        keyToEvict = this.clockEvict()
        break
    }
    
    if (keyToEvict) {
      this.cache.delete(keyToEvict)
      this.removeFromAccessOrder(keyToEvict)
    }
  }
  
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }
  
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index >= 0) {
      this.accessOrder.splice(index, 1)
    }
  }
  
  private findLeastFrequentlyUsed(): string | null {
    let leastUsedKey: string | null = null
    let leastHits = Infinity
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < leastHits) {
        leastHits = entry.hits
        leastUsedKey = key
      }
    }
    
    return leastUsedKey
  }
  
  private clockEvict(): string | null {
    // Simple clock algorithm implementation
    return this.accessOrder[0] || null
  }
  
  private estimateMemoryUsage(): number {
    let size = 0
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2 // UTF-16
      size += entry.size || this.estimateEntrySize(entry.data)
      size += 64 // Entry overhead
    }
    return size
  }
  
  private estimateEntrySize(data: T): number {
    try {
      return JSON.stringify(data).length * 2 // UTF-16
    } catch {
      return 1024 // Default estimate
    }
  }
}

/**
 * L2 Cache: Disk-based cache for larger storage
 */
export class DiskCache<T> implements CacheLevel<T> {
  public name = 'disk'
  private lockManager = new LockManager()
  private indexPath: string
  private index = new Map<string, { file: string; timestamp: number; accessed: number; hits: number; size: number }>()
  private stats = {
    hits: 0,
    misses: 0,
    totalAccessTime: 0,
    accessCount: 0
  }
  
  constructor(
    private cachePath: string,
    private maxSize: number, // Max files
    private ttl: number,
    private evictionStrategy: 'lru' | 'lfu' | 'fifo' = 'lru'
  ) {
    this.indexPath = path.join(cachePath, '.index.json')
  }
  
  async initialize(): Promise<void> {
    // Ensure cache directory exists
    await fs.mkdir(this.cachePath, { recursive: true })
    
    // Load index
    await this.loadIndex()
    
    // Clean expired entries
    await this.cleanExpired()
  }
  
  async get(key: string): Promise<CacheEntry<T> | null> {
    const start = Date.now()
    
    try {
      const indexEntry = this.index.get(key)
      
      if (!indexEntry) {
        this.stats.misses++
        return null
      }
      
      // Check TTL
      if (Date.now() - indexEntry.timestamp > this.ttl) {
        await this.delete(key)
        this.stats.misses++
        return null
      }
      
      // Read from disk
      const filePath = path.join(this.cachePath, indexEntry.file)
      
      return this.lockManager.withReadLock(filePath, async () => {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const data = JSON.parse(content) as T
          
          // Update access stats
          indexEntry.accessed = Date.now()
          indexEntry.hits++
          this.stats.hits++
          
          // Save index changes
          await this.saveIndex()
          
          return {
            data,
            timestamp: indexEntry.timestamp,
            accessed: indexEntry.accessed,
            hits: indexEntry.hits,
            size: indexEntry.size
          }
        } catch (error) {
          // File corruption or missing, remove from index
          await this.delete(key)
          this.stats.misses++
          return null
        }
      })
    } finally {
      this.stats.totalAccessTime += Date.now() - start
      this.stats.accessCount++
    }
  }
  
  async set(key: string, entry: CacheEntry<T>): Promise<void> {
    // Check if we need to evict
    if (this.index.size >= this.maxSize && !this.index.has(key)) {
      await this.evict()
    }
    
    const fileName = this.getFileName(key)
    const filePath = path.join(this.cachePath, fileName)
    
    await this.lockManager.withWriteLock(filePath, async () => {
      // Write data to file
      const content = JSON.stringify(entry.data, null, 2)
      await fs.writeFile(filePath, content, 'utf-8')
      
      // Update index
      this.index.set(key, {
        file: fileName,
        timestamp: entry.timestamp,
        accessed: entry.accessed,
        hits: entry.hits,
        size: content.length
      })
      
      await this.saveIndex()
    })
  }
  
  async delete(key: string): Promise<void> {
    const indexEntry = this.index.get(key)
    
    if (indexEntry) {
      const filePath = path.join(this.cachePath, indexEntry.file)
      
      try {
        await fs.unlink(filePath)
      } catch (error) {
        // File might already be deleted, ignore
      }
      
      this.index.delete(key)
      await this.saveIndex()
    }
  }
  
  async clear(): Promise<void> {
    // Delete all cache files
    const entries = Array.from(this.index.values())
    
    await Promise.all(
      entries.map(async (entry) => {
        try {
          await fs.unlink(path.join(this.cachePath, entry.file))
        } catch (error) {
          // Ignore errors
        }
      })
    )
    
    this.index.clear()
    await this.saveIndex()
  }
  
  async size(): Promise<number> {
    return this.index.size
  }
  
  async stats(): Promise<CacheStats> {
    const total = this.stats.hits + this.stats.misses
    const totalSize = Array.from(this.index.values()).reduce((sum, entry) => sum + entry.size, 0)
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: totalSize,
      entries: this.index.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgAccessTime: this.stats.accessCount > 0 ? this.stats.totalAccessTime / this.stats.accessCount : 0
    }
  }
  
  private async loadIndex(): Promise<void> {
    try {
      if (existsSync(this.indexPath)) {
        const content = await fs.readFile(this.indexPath, 'utf-8')
        const data = JSON.parse(content)
        this.index = new Map(Object.entries(data))
      }
    } catch (error) {
      console.warn(`Failed to load disk cache index: ${error}`)
      this.index.clear()
    }
  }
  
  private async saveIndex(): Promise<void> {
    try {
      const data = Object.fromEntries(this.index.entries())
      const content = JSON.stringify(data, null, 2)
      await fs.writeFile(this.indexPath, content, 'utf-8')
    } catch (error) {
      console.error(`Failed to save disk cache index: ${error}`)
    }
  }
  
  private async cleanExpired(): Promise<void> {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    for (const [key, entry] of this.index.entries()) {
      if (now - entry.timestamp > this.ttl) {
        expiredKeys.push(key)
      }
    }
    
    for (const key of expiredKeys) {
      await this.delete(key)
    }
  }
  
  private async evict(): Promise<void> {
    let keyToEvict: string | null = null
    
    switch (this.evictionStrategy) {
      case 'lru':
        keyToEvict = this.findLeastRecentlyUsed()
        break
      case 'lfu':
        keyToEvict = this.findLeastFrequentlyUsed()
        break
      case 'fifo':
        keyToEvict = this.findOldest()
        break
    }
    
    if (keyToEvict) {
      await this.delete(keyToEvict)
    }
  }
  
  private findLeastRecentlyUsed(): string | null {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    for (const [key, entry] of this.index.entries()) {
      if (entry.accessed < oldestTime) {
        oldestTime = entry.accessed
        oldestKey = key
      }
    }
    
    return oldestKey
  }
  
  private findLeastFrequentlyUsed(): string | null {
    let leastUsedKey: string | null = null
    let leastHits = Infinity
    
    for (const [key, entry] of this.index.entries()) {
      if (entry.hits < leastHits) {
        leastHits = entry.hits
        leastUsedKey = key
      }
    }
    
    return leastUsedKey
  }
  
  private findOldest(): string | null {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    for (const [key, entry] of this.index.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }
    
    return oldestKey
  }
  
  private getFileName(key: string): string {
    // Create safe filename from key
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_')
    const hash = this.simpleHash(key)
    return `${safeKey}_${hash}.json`
  }
  
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
}

/**
 * Multi-level cache that combines multiple cache levels
 */
export class MultiLevelCache<T> {
  private levels: CacheLevel<T>[] = []
  private stats = {
    totalRequests: 0,
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0
  }
  
  constructor(private config: MultiLevelCacheConfig) {}
  
  async initialize(): Promise<void> {
    // Initialize cache levels based on config
    for (const levelConfig of this.config.levels) {
      let level: CacheLevel<T>
      
      switch (levelConfig.type) {
        case 'memory':
          level = new MemoryCache<T>(
            levelConfig.maxSize,
            levelConfig.ttl,
            levelConfig.evictionStrategy as any
          )
          break
        case 'disk':
          const diskCache = new DiskCache<T>(
            levelConfig.config?.path || './cache',
            levelConfig.maxSize,
            levelConfig.ttl,
            levelConfig.evictionStrategy as any
          )
          await diskCache.initialize()
          level = diskCache
          break
        default:
          throw new Error(`Unsupported cache type: ${levelConfig.type}`)
      }
      
      this.levels.push(level)
    }
  }
  
  async get(key: string): Promise<T | null> {
    this.stats.totalRequests++
    
    // Try each level in order
    for (let i = 0; i < this.levels.length; i++) {
      const level = this.levels[i]
      const entry = await level.get(key)
      
      if (entry) {
        // Found in this level, update stats
        switch (i) {
          case 0: this.stats.l1Hits++; break
          case 1: this.stats.l2Hits++; break
          case 2: this.stats.l3Hits++; break
        }
        
        // Promote to higher levels if configured
        if (i > 0 && this.shouldPromote(entry)) {
          await this.promoteToHigherLevels(key, entry, i - 1)
        }
        
        return entry.data
      }
    }
    
    this.stats.misses++
    return null
  }
  
  async set(key: string, data: T): Promise<void> {
    const now = Date.now()
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessed: now,
      hits: 0,
      size: this.estimateSize(data)
    }
    
    if (this.config.writeThrough) {
      // Write to all levels
      await Promise.all(
        this.levels.map(level => level.set(key, entry))
      )
    } else {
      // Write to first level only
      if (this.levels.length > 0) {
        await this.levels[0].set(key, entry)
        
        // Optionally write back to lower levels asynchronously
        if (this.config.writeBack && this.levels.length > 1) {
          setImmediate(async () => {
            for (let i = 1; i < this.levels.length; i++) {
              try {
                await this.levels[i].set(key, entry)
              } catch (error) {
                console.warn(`Failed to write back to level ${i}: ${error}`)
              }
            }
          })
        }
      }
    }
  }
  
  async delete(key: string): Promise<void> {
    // Delete from all levels
    await Promise.all(
      this.levels.map(level => level.delete(key))
    )
  }
  
  async clear(): Promise<void> {
    await Promise.all(
      this.levels.map(level => level.clear())
    )
  }
  
  async getStats(): Promise<{
    overall: any
    levels: CacheStats[]
  }> {
    const levelStats = await Promise.all(
      this.levels.map(level => level.stats())
    )
    
    const totalHits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits
    
    return {
      overall: {
        totalRequests: this.stats.totalRequests,
        totalHits,
        misses: this.stats.misses,
        hitRate: this.stats.totalRequests > 0 ? totalHits / this.stats.totalRequests : 0,
        l1HitRate: this.stats.totalRequests > 0 ? this.stats.l1Hits / this.stats.totalRequests : 0,
        l2HitRate: this.stats.totalRequests > 0 ? this.stats.l2Hits / this.stats.totalRequests : 0,
        l3HitRate: this.stats.totalRequests > 0 ? this.stats.l3Hits / this.stats.totalRequests : 0
      },
      levels: levelStats
    }
  }
  
  private shouldPromote(entry: CacheEntry<T>): boolean {
    switch (this.config.promotionStrategy) {
      case 'frequency':
        return entry.hits >= 2 // Promote after 2 hits
      case 'recency':
        return Date.now() - entry.accessed < 60000 // Promote if accessed in last minute
      case 'mixed':
      default:
        return entry.hits >= 1 && Date.now() - entry.accessed < 300000 // Hits + recent access
    }
  }
  
  private async promoteToHigherLevels(key: string, entry: CacheEntry<T>, targetLevel: number): Promise<void> {
    // Promote to all levels from targetLevel up to 0
    for (let i = targetLevel; i >= 0; i--) {
      try {
        await this.levels[i].set(key, entry)
      } catch (error) {
        console.warn(`Failed to promote to level ${i}: ${error}`)
      }
    }
  }
  
  private estimateSize(data: T): number {
    try {
      return JSON.stringify(data).length * 2 // UTF-16 estimation
    } catch {
      return 1024 // Default estimate
    }
  }
}