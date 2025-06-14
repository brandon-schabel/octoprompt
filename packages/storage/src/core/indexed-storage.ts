import { BaseStorage, type StorageOptions, type BaseEntity } from './base-storage'
import { IndexManager, type IndexConfig } from './index-manager'
import type { ZodTypeAny } from 'zod'

export interface IndexDefinition {
  name: string
  type: 'hash' | 'btree' | 'inverted'
  fields: string[]
  sparse?: boolean
}

/**
 * Abstract storage class with built-in index management
 * Reduces boilerplate for index initialization, updating, and removal
 */
export abstract class IndexedStorage<
  TEntity extends BaseEntity,
  TStorage extends Record<string | number, TEntity>
> extends BaseStorage<TEntity, TStorage> {
  protected indexManager: IndexManager
  protected indexDefinitions: IndexDefinition[] = []

  constructor(
    storageSchema: ZodTypeAny,
    entitySchema: ZodTypeAny,
    dataDir: string,
    options: StorageOptions = {}
  ) {
    super(storageSchema, entitySchema, dataDir, options)
    this.indexManager = new IndexManager(this.basePath, this.dataDir)
  }

  /**
   * Initialize indexes based on definitions
   * Should be called in constructor after setting indexDefinitions
   */
  protected async initializeIndexes(): Promise<void> {
    for (const indexDef of this.indexDefinitions) {
      try {
        await this.indexManager.createIndex(indexDef)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexDef.name}:`, error)
        }
      }
    }
  }

  /**
   * Update all indexes for an entity
   */
  protected async updateIndexes(entity: TEntity): Promise<void> {
    for (const indexDef of this.indexDefinitions) {
      // Check if entity has all required fields for this index
      const hasAllFields = indexDef.fields.every(field => {
        const value = (entity as any)[field]
        return value !== undefined && value !== null
      })

      if (hasAllFields || !indexDef.sparse) {
        await this.indexManager.addToIndex(indexDef.name, entity.id, entity)
      }
    }
  }

  /**
   * Remove entity from all indexes
   */
  protected async removeFromIndexes(entityId: number): Promise<void> {
    for (const indexDef of this.indexDefinitions) {
      await this.indexManager.removeFromIndex(indexDef.name, entityId)
    }
  }

  /**
   * Rebuild all indexes
   */
  public async rebuildIndexes(): Promise<void> {
    const entities = await this.list()
    
    for (const indexDef of this.indexDefinitions) {
      await this.indexManager.rebuildIndex(indexDef.name, entities)
    }
  }

  /**
   * Get index statistics
   */
  public async getIndexStats() {
    const stats = []
    
    for (const indexDef of this.indexDefinitions) {
      const indexStats = await this.indexManager.getIndexStats(indexDef.name)
      if (indexStats) stats.push(indexStats)
    }
    
    return stats
  }

  // Override CRUD methods to handle indexes automatically

  public async create(data: Omit<TEntity, 'id' | 'created' | 'updated'>): Promise<TEntity> {
    const entity = await super.create(data)
    await this.updateIndexes(entity)
    return entity
  }

  public async update(id: number, data: Partial<Omit<TEntity, 'id' | 'created' | 'updated'>>): Promise<TEntity | null> {
    // Remove from indexes before update
    await this.removeFromIndexes(id)
    
    const updated = await super.update(id, data)
    if (!updated) return null
    
    // Re-add to indexes
    await this.updateIndexes(updated)
    
    return updated
  }

  public async delete(id: number): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      await this.removeFromIndexes(id)
    }
    return result
  }

  // Common query patterns

  /**
   * Query by index and return entities
   */
  protected async queryByIndex(
    indexName: string,
    query: any,
    sorter?: (a: TEntity, b: TEntity) => number
  ): Promise<TEntity[]> {
    const ids = await this.indexManager.query(indexName, query)
    const entities: TEntity[] = []
    
    for (const id of ids) {
      const entity = await this.getById(id)
      if (entity) entities.push(entity)
    }
    
    return sorter ? entities.sort(sorter) : entities
  }

  /**
   * Search by text index
   */
  protected async searchByIndex(
    indexName: string,
    query: string,
    sorter?: (a: TEntity, b: TEntity) => number
  ): Promise<TEntity[]> {
    const ids = await this.indexManager.searchText(indexName, query)
    const entities: TEntity[] = []
    
    for (const id of ids) {
      const entity = await this.getById(id)
      if (entity) entities.push(entity)
    }
    
    return sorter ? entities.sort(sorter) : entities
  }

  /**
   * Query by date range
   */
  protected async queryByDateRange(
    indexName: string,
    start: Date,
    end: Date,
    sorter?: (a: TEntity, b: TEntity) => number
  ): Promise<TEntity[]> {
    const ids = await this.indexManager.queryRange(
      indexName,
      start.getTime(),
      end.getTime()
    )
    
    const entities: TEntity[] = []
    for (const id of ids) {
      const entity = await this.getById(id)
      if (entity) entities.push(entity)
    }
    
    return sorter ? entities.sort(sorter) : entities
  }

  /**
   * Get recent entities
   */
  public async getRecent(limit: number = 20, sortField: keyof TEntity = 'updated' as keyof TEntity): Promise<TEntity[]> {
    const entities = await this.list()
    return entities
      .sort((a, b) => (b[sortField] as any) - (a[sortField] as any))
      .slice(0, limit)
  }
}