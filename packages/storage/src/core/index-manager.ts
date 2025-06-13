import fs from 'node:fs/promises'
import path from 'node:path'
import { z, type ZodTypeAny } from 'zod'

export type IndexType = 'btree' | 'hash' | 'inverted'

export interface IndexConfig {
  name: string
  type: IndexType
  fields: string[] // Field paths to index, supports nested paths like "user.email"
  unique?: boolean
  sparse?: boolean // Don't index documents missing the indexed field
}

export interface IndexEntry {
  key: string | number
  ids: (number | string)[] // Entity IDs that match this key
}

// Schema for index storage
const IndexStorageSchema = z.object({
  config: z.object({
    name: z.string(),
    type: z.enum(['btree', 'hash', 'inverted']),
    fields: z.array(z.string()),
    unique: z.boolean().optional(),
    sparse: z.boolean().optional()
  }),
  entries: z.record(z.union([z.string(), z.number()]), z.array(z.union([z.number(), z.string()]))),
  metadata: z.object({
    created: z.number(),
    updated: z.number(),
    count: z.number()
  })
})

type IndexStorage = z.infer<typeof IndexStorageSchema>

export class IndexManager {
  private indexes: Map<string, IndexStorage> = new Map()
  private indexPath: string

  constructor(private basePath: string, private dataDir: string) {
    this.indexPath = path.join(basePath, dataDir, 'indexes')
  }

  // --- Index Management ---

  async createIndex(config: IndexConfig): Promise<void> {
    const indexFilePath = this.getIndexFilePath(config.name)
    
    // Check if index already exists
    if (this.indexes.has(config.name) || await this.indexExists(config.name)) {
      throw new Error(`Index ${config.name} already exists`)
    }

    const now = Date.now()
    const indexData: IndexStorage = {
      config,
      entries: {},
      metadata: {
        created: now,
        updated: now,
        count: 0
      }
    }

    await this.ensureDirExists(this.indexPath)
    await this.writeIndex(config.name, indexData)
    this.indexes.set(config.name, indexData)
  }

  async dropIndex(name: string): Promise<void> {
    const indexFilePath = this.getIndexFilePath(name)
    
    try {
      await fs.unlink(indexFilePath)
      this.indexes.delete(name)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to drop index ${name}: ${error.message}`)
      }
    }
  }

  async loadIndex(name: string): Promise<IndexStorage | null> {
    // Check memory cache first
    const cached = this.indexes.get(name)
    if (cached) return cached

    const indexFilePath = this.getIndexFilePath(name)
    
    try {
      const content = await fs.readFile(indexFilePath, 'utf-8')
      const data = JSON.parse(content)
      const validated = IndexStorageSchema.parse(data)
      
      this.indexes.set(name, validated)
      return validated
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null
      }
      throw new Error(`Failed to load index ${name}: ${error.message}`)
    }
  }

  // --- Index Operations ---

  async addToIndex<T extends Record<string, any>>(
    indexName: string,
    entityId: number | string,
    entity: T
  ): Promise<void> {
    const index = await this.loadIndex(indexName)
    if (!index) {
      throw new Error(`Index ${indexName} not found`)
    }

    const keys = this.extractKeys(entity, index.config.fields)
    
    for (const key of keys) {
      if (key === null || key === undefined) {
        if (!index.config.sparse) {
          // For non-sparse indexes, use a special null key
          const nullKey = '__null__'
          if (!index.entries[nullKey]) {
            index.entries[nullKey] = []
          }
          if (!index.entries[nullKey].includes(entityId)) {
            index.entries[nullKey].push(entityId)
          }
        }
        continue
      }

      const keyStr = String(key)
      
      if (index.config.unique && index.entries[keyStr] && index.entries[keyStr].length > 0) {
        if (!index.entries[keyStr].includes(entityId)) {
          throw new Error(`Unique constraint violation for index ${indexName} on key ${keyStr}`)
        }
      }

      if (!index.entries[keyStr]) {
        index.entries[keyStr] = []
      }
      
      if (!index.entries[keyStr].includes(entityId)) {
        index.entries[keyStr].push(entityId)
        index.metadata.count++
      }
    }

    index.metadata.updated = Date.now()
    await this.writeIndex(indexName, index)
  }

  async removeFromIndex(indexName: string, entityId: number | string): Promise<void> {
    const index = await this.loadIndex(indexName)
    if (!index) return

    let removed = false
    for (const key in index.entries) {
      const ids = index.entries[key]
      const idx = ids.indexOf(entityId)
      if (idx !== -1) {
        ids.splice(idx, 1)
        removed = true
        
        // Clean up empty entries
        if (ids.length === 0) {
          delete index.entries[key]
        }
      }
    }

    if (removed) {
      index.metadata.count--
      index.metadata.updated = Date.now()
      await this.writeIndex(indexName, index)
    }
  }

  async query(indexName: string, key: string | number | null): Promise<(number | string)[]> {
    const index = await this.loadIndex(indexName)
    if (!index) return []

    const keyStr = key === null ? '__null__' : String(key)
    return index.entries[keyStr] || []
  }

  async queryRange(
    indexName: string,
    start: string | number,
    end: string | number,
    inclusive: boolean = true
  ): Promise<(number | string)[]> {
    const index = await this.loadIndex(indexName)
    if (!index) return []

    const results = new Set<number | string>()
    
    for (const [key, ids] of Object.entries(index.entries)) {
      const keyNum = Number(key)
      const startNum = Number(start)
      const endNum = Number(end)
      
      let inRange = false
      
      if (!isNaN(keyNum) && !isNaN(startNum) && !isNaN(endNum)) {
        // Numeric comparison
        inRange = inclusive
          ? keyNum >= startNum && keyNum <= endNum
          : keyNum > startNum && keyNum < endNum
      } else {
        // String comparison
        inRange = inclusive
          ? key >= String(start) && key <= String(end)
          : key > String(start) && key < String(end)
      }
      
      if (inRange) {
        ids.forEach(id => results.add(id))
      }
    }
    
    return Array.from(results)
  }

  async searchText(indexName: string, query: string): Promise<(number | string)[]> {
    const index = await this.loadIndex(indexName)
    if (!index) return []

    if (index.config.type !== 'inverted') {
      throw new Error(`Index ${indexName} is not an inverted index. Use query() instead.`)
    }

    const results = new Set<number | string>()
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0)
    
    for (const [key, ids] of Object.entries(index.entries)) {
      const keyLower = key.toLowerCase()
      
      // Check if any search term matches this key
      const hasMatch = searchTerms.some(term => 
        keyLower.includes(term) || term.includes(keyLower)
      )
      
      if (hasMatch) {
        ids.forEach(id => results.add(id))
      }
    }
    
    return Array.from(results)
  }

  // --- Bulk Operations ---

  async rebuildIndex<T extends Record<string, any>>(
    indexName: string,
    entities: Array<T & { id: number | string }>
  ): Promise<void> {
    const index = await this.loadIndex(indexName)
    if (!index) {
      throw new Error(`Index ${indexName} not found`)
    }

    // Clear existing entries
    index.entries = {}
    index.metadata.count = 0

    // Rebuild from entities
    for (const entity of entities) {
      await this.addToIndex(indexName, entity.id, entity)
    }
  }

  // --- Helper Methods ---

  private extractKeys(entity: any, fields: string[]): any[] {
    const keys: any[] = []
    
    for (const field of fields) {
      const value = this.getNestedValue(entity, field)
      
      if (Array.isArray(value)) {
        // For array fields, index each value
        keys.push(...value)
      } else {
        keys.push(value)
      }
    }
    
    // For composite indexes, combine field values
    if (fields.length > 1) {
      const compositeKey = fields
        .map(field => this.getNestedValue(entity, field))
        .filter(v => v !== null && v !== undefined)
        .join(':')
      
      if (compositeKey) {
        keys.push(compositeKey)
      }
    }
    
    return keys
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.')
    let current = obj
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return null
      }
      current = current[part]
    }
    
    return current
  }

  private getIndexFilePath(name: string): string {
    return path.join(this.indexPath, `${name}.index.json`)
  }

  private async indexExists(name: string): Promise<boolean> {
    try {
      await fs.access(this.getIndexFilePath(name))
      return true
    } catch {
      return false
    }
  }

  private async ensureDirExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw new Error(`Failed to create directory ${dirPath}: ${error.message}`)
      }
    }
  }

  private async writeIndex(name: string, data: IndexStorage): Promise<void> {
    const filePath = this.getIndexFilePath(name)
    const content = JSON.stringify(data, null, 2)
    await fs.writeFile(filePath, content, 'utf-8')
    this.indexes.set(name, data)
  }

  // --- Index Information ---

  async listIndexes(): Promise<IndexConfig[]> {
    await this.ensureDirExists(this.indexPath)
    
    const files = await fs.readdir(this.indexPath)
    const indexes: IndexConfig[] = []
    
    for (const file of files) {
      if (file.endsWith('.index.json')) {
        const name = file.replace('.index.json', '')
        const index = await this.loadIndex(name)
        if (index) {
          indexes.push(index.config)
        }
      }
    }
    
    return indexes
  }

  async getIndexStats(name: string): Promise<{ config: IndexConfig; stats: any } | null> {
    const index = await this.loadIndex(name)
    if (!index) return null

    const uniqueKeys = Object.keys(index.entries).length
    const totalEntries = index.metadata.count
    const avgEntriesPerKey = uniqueKeys > 0 ? totalEntries / uniqueKeys : 0

    return {
      config: index.config,
      stats: {
        uniqueKeys,
        totalEntries,
        avgEntriesPerKey,
        created: new Date(index.metadata.created),
        updated: new Date(index.metadata.updated)
      }
    }
  }
}