import type { ProjectFile } from '@promptliano/schemas'
import { createHash } from 'crypto'
import { createLogger } from '../utils/logger'

const logger = createLogger('SummarizationCache')

export interface CachedSummary {
  fileId: number
  fileHash: string
  summary: string
  timestamp: number
  modelVersion: string
  promptVersion: string
  tokenCount?: number
  truncated?: boolean
}

export interface CacheStats {
  totalEntries: number
  hitRate: number
  missRate: number
  averageAge: number
  totalSizeBytes: number
}

export interface CacheOptions {
  maxEntries?: number
  ttlMs?: number
  maxSizeBytes?: number
}

/**
 * In-memory cache for file summaries with TTL and size management
 */
export class SummarizationCache {
  private cache = new Map<string, CachedSummary>()
  private hits = 0
  private misses = 0
  private readonly options: Required<CacheOptions>
  
  // Version tracking for cache invalidation
  private readonly CURRENT_MODEL_VERSION = 'gpt-oss-20b-v1'
  private readonly CURRENT_PROMPT_VERSION = 'v2.0.0'

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries || 10000,
      ttlMs: options.ttlMs || 24 * 60 * 60 * 1000, // 24 hours default
      maxSizeBytes: options.maxSizeBytes || 100 * 1024 * 1024 // 100MB default
    }

    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 60 * 60 * 1000) // Run cleanup every hour
  }

  /**
   * Generate a hash for file content
   */
  private generateFileHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Generate cache key for a file
   */
  private getCacheKey(projectId: number, fileId: number): string {
    return `${projectId}-${fileId}`
  }

  /**
   * Check if a cached summary is valid
   */
  private isValidCache(cached: CachedSummary, fileHash: string): boolean {
    // Check if content has changed
    if (cached.fileHash !== fileHash) {
      logger.debug(`Cache invalid for file ${cached.fileId}: content hash mismatch`)
      return false
    }

    // Check if model version has changed
    if (cached.modelVersion !== this.CURRENT_MODEL_VERSION) {
      logger.debug(`Cache invalid for file ${cached.fileId}: model version mismatch`)
      return false
    }

    // Check if prompt version has changed
    if (cached.promptVersion !== this.CURRENT_PROMPT_VERSION) {
      logger.debug(`Cache invalid for file ${cached.fileId}: prompt version mismatch`)
      return false
    }

    // Check TTL
    const age = Date.now() - cached.timestamp
    if (age > this.options.ttlMs) {
      logger.debug(`Cache invalid for file ${cached.fileId}: TTL expired (age: ${age}ms)`)
      return false
    }

    return true
  }

  /**
   * Get a cached summary if valid
   */
  get(file: ProjectFile): CachedSummary | null {
    if (!file.content) {
      this.misses++
      return null
    }

    const cacheKey = this.getCacheKey(file.projectId, file.id)
    const cached = this.cache.get(cacheKey)

    if (!cached) {
      this.misses++
      logger.debug(`Cache miss for file ${file.id} in project ${file.projectId}`)
      return null
    }

    const fileHash = this.generateFileHash(file.content)
    if (!this.isValidCache(cached, fileHash)) {
      // Remove invalid cache entry
      this.cache.delete(cacheKey)
      this.misses++
      return null
    }

    this.hits++
    logger.debug(`Cache hit for file ${file.id} in project ${file.projectId}`)
    return cached
  }

  /**
   * Store a summary in cache
   */
  set(
    file: ProjectFile,
    summary: string,
    options: {
      tokenCount?: number
      truncated?: boolean
    } = {}
  ): void {
    if (!file.content) return

    // Check cache size limits
    if (this.cache.size >= this.options.maxEntries) {
      this.evictOldest()
    }

    const cacheKey = this.getCacheKey(file.projectId, file.id)
    const fileHash = this.generateFileHash(file.content)

    const cachedSummary: CachedSummary = {
      fileId: file.id,
      fileHash,
      summary,
      timestamp: Date.now(),
      modelVersion: this.CURRENT_MODEL_VERSION,
      promptVersion: this.CURRENT_PROMPT_VERSION,
      tokenCount: options.tokenCount,
      truncated: options.truncated
    }

    this.cache.set(cacheKey, cachedSummary)
    logger.debug(`Cached summary for file ${file.id} in project ${file.projectId}`)
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidate(projectId: number, fileId: number): boolean {
    const cacheKey = this.getCacheKey(projectId, fileId)
    const deleted = this.cache.delete(cacheKey)
    
    if (deleted) {
      logger.debug(`Invalidated cache for file ${fileId} in project ${projectId}`)
    }
    
    return deleted
  }

  /**
   * Invalidate all cache entries for a project
   */
  invalidateProject(projectId: number): number {
    let invalidated = 0
    
    for (const [key] of this.cache) {
      if (key.startsWith(`${projectId}-`)) {
        this.cache.delete(key)
        invalidated++
      }
    }
    
    if (invalidated > 0) {
      logger.info(`Invalidated ${invalidated} cache entries for project ${projectId}`)
    }
    
    return invalidated
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    logger.info(`Cleared cache (removed ${size} entries)`)
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache) {
      const age = now - entry.timestamp
      if (age > this.options.ttlMs) {
        this.cache.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      logger.info(`Cleanup removed ${removed} expired cache entries`)
    }

    return removed
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldest(count: number = 1): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, count)

    for (const [key] of entries) {
      this.cache.delete(key)
    }

    logger.debug(`Evicted ${entries.length} oldest cache entries`)
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values())
    const now = Date.now()
    
    const totalSizeBytes = entries.reduce((sum, entry) => 
      sum + Buffer.byteLength(entry.summary, 'utf8'), 0
    )
    
    const averageAge = entries.length > 0
      ? entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / entries.length
      : 0

    const totalRequests = this.hits + this.misses
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0
    const missRate = totalRequests > 0 ? this.misses / totalRequests : 0

    return {
      totalEntries: this.cache.size,
      hitRate,
      missRate,
      averageAge,
      totalSizeBytes
    }
  }

  /**
   * Warm cache with existing summaries
   */
  async warmCache(files: ProjectFile[]): Promise<number> {
    let warmed = 0

    for (const file of files) {
      if (file.content && file.summary && file.summaryLastUpdated) {
        const cacheKey = this.getCacheKey(file.projectId, file.id)
        const fileHash = this.generateFileHash(file.content)

        // Only warm cache if summary is recent
        const age = Date.now() - file.summaryLastUpdated
        if (age < this.options.ttlMs) {
          const cachedSummary: CachedSummary = {
            fileId: file.id,
            fileHash,
            summary: file.summary,
            timestamp: file.summaryLastUpdated,
            modelVersion: this.CURRENT_MODEL_VERSION,
            promptVersion: this.CURRENT_PROMPT_VERSION
          }

          this.cache.set(cacheKey, cachedSummary)
          warmed++
        }
      }
    }

    logger.info(`Warmed cache with ${warmed} existing summaries`)
    return warmed
  }

  /**
   * Generate incremental summary for file changes
   */
  async getIncrementalSummary(
    file: ProjectFile,
    previousSummary: string,
    changes: string[]
  ): Promise<string | null> {
    // Check if changes are significant enough to warrant re-summarization
    const significantChanges = changes.filter(change => {
      // Filter out trivial changes
      return !change.match(/^\s*\/\//) && // Comments
             !change.match(/^\s*$/) &&      // Empty lines
             change.length > 10              // Very short changes
    })

    if (significantChanges.length === 0) {
      logger.debug(`No significant changes for file ${file.id}, returning previous summary`)
      return previousSummary
    }

    // For now, return null to trigger full re-summarization
    // In a real implementation, this would use AI to update the summary incrementally
    return null
  }

  /**
   * Serialize cache for persistence
   */
  serialize(): string {
    const entries = Array.from(this.cache.entries())
    return JSON.stringify({
      version: 1,
      modelVersion: this.CURRENT_MODEL_VERSION,
      promptVersion: this.CURRENT_PROMPT_VERSION,
      entries,
      stats: {
        hits: this.hits,
        misses: this.misses
      }
    })
  }

  /**
   * Deserialize cache from persisted data with security validation
   */
  deserialize(data: string): boolean {
    try {
      // Validate input is a string
      if (typeof data !== 'string' || data.length === 0) {
        logger.warn('Invalid cache data: not a string or empty')
        return false
      }
      
      // Size check to prevent memory exhaustion
      const MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB limit
      if (data.length > MAX_CACHE_SIZE) {
        logger.warn(`Cache data too large: ${data.length} bytes exceeds ${MAX_CACHE_SIZE} limit`)
        return false
      }
      
      const parsed = JSON.parse(data)
      
      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        logger.warn('Invalid cache structure: not an object')
        return false
      }
      
      // Validate required fields
      if (!parsed.version || !parsed.modelVersion || !parsed.promptVersion || !Array.isArray(parsed.entries)) {
        logger.warn('Invalid cache structure: missing required fields')
        return false
      }
      
      // Check version compatibility
      if (parsed.modelVersion !== this.CURRENT_MODEL_VERSION ||
          parsed.promptVersion !== this.CURRENT_PROMPT_VERSION) {
        logger.warn('Cache version mismatch, skipping deserialization')
        return false
      }
      
      // Validate entries structure and sanitize
      const validEntries: Array<[string, CachedSummary]> = []
      for (const entry of parsed.entries) {
        if (!Array.isArray(entry) || entry.length !== 2) {
          continue // Skip invalid entry
        }
        
        const [key, value] = entry
        
        // Validate key
        if (typeof key !== 'string' || !key.match(/^\d+-\d+$/)) {
          continue // Skip entry with invalid key format
        }
        
        // Validate value structure
        if (!value || typeof value !== 'object' ||
            typeof value.fileId !== 'number' ||
            typeof value.fileHash !== 'string' ||
            typeof value.summary !== 'string' ||
            typeof value.timestamp !== 'number' ||
            typeof value.modelVersion !== 'string' ||
            typeof value.promptVersion !== 'string') {
          continue // Skip entry with invalid value structure
        }
        
        // Validate hash format (should be hex string)
        if (!value.fileHash.match(/^[a-f0-9]{64}$/)) {
          continue // Skip entry with invalid hash
        }
        
        // Validate timestamp is reasonable (not in future, not too old)
        const now = Date.now()
        if (value.timestamp > now || value.timestamp < now - 30 * 24 * 60 * 60 * 1000) {
          continue // Skip entry with unreasonable timestamp
        }
        
        validEntries.push([key, value as CachedSummary])
      }

      // Clear and restore valid entries
      this.cache.clear()
      for (const [key, value] of validEntries) {
        this.cache.set(key, value)
      }

      // Restore stats with validation
      if (parsed.stats && typeof parsed.stats === 'object') {
        this.hits = typeof parsed.stats.hits === 'number' && parsed.stats.hits >= 0 
          ? Math.floor(parsed.stats.hits) 
          : 0
        this.misses = typeof parsed.stats.misses === 'number' && parsed.stats.misses >= 0 
          ? Math.floor(parsed.stats.misses) 
          : 0
      } else {
        this.hits = 0
        this.misses = 0
      }

      logger.info(`Deserialized ${this.cache.size} valid cache entries (${parsed.entries.length - this.cache.size} invalid entries skipped)`)
      return true
    } catch (error) {
      logger.error('Failed to deserialize cache:', error)
      // Clear cache on error to prevent corruption
      this.cache.clear()
      this.hits = 0
      this.misses = 0
      return false
    }
  }
}

// Export singleton instance
export const summarizationCache = new SummarizationCache()