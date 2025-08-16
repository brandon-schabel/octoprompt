import { ApiError } from '@promptliano/shared'
import { createCrudErrorHandlers, throwNotFound, safeAsync } from '../utils/error-handlers'
import type { BaseStorage, BaseEntity } from '@promptliano/storage'

/**
 * Base service class with common CRUD operations and error handling
 */
export abstract class BaseService<
  TEntity extends BaseEntity,
  TCreate = Omit<TEntity, 'id' | 'created' | 'updated'>,
  TUpdate = Partial<Omit<TEntity, 'id' | 'created' | 'updated'>>
> {
  protected abstract entityName: string
  protected abstract storage: BaseStorage<TEntity, any>
  protected errorHandlers: ReturnType<typeof createCrudErrorHandlers>

  constructor() {
    // Initialize error handlers - entityName will be set by derived class
    this.errorHandlers = createCrudErrorHandlers('base')
  }

  /**
   * Initialize error handlers with entity name - should be called by derived classes
   */
  protected initializeErrorHandlers() {
    this.errorHandlers = createCrudErrorHandlers(this.entityName)
  }

  /**
   * Create a new entity
   */
  async create(data: TCreate): Promise<TEntity> {
    // Transform TCreate to TEntity by adding auto-generated fields
    const now = Date.now()
    const entityData = {
      ...data,
      id: 0, // Will be set by storage layer
      created: now,
      updated: now
    } as unknown as TEntity

    return safeAsync(() => this.storage.create(entityData), {
      entityName: this.entityName,
      action: 'creating',
      details: { data }
    })
  }

  /**
   * Get entity by ID
   */
  async getById(id: number): Promise<TEntity> {
    const entity = await safeAsync(() => this.storage.getById(id), {
      entityName: this.entityName,
      action: 'retrieving',
      details: { id }
    })

    if (!entity) {
      throwNotFound(this.entityName, id)
    }

    return entity
  }

  /**
   * Get entity by ID or null
   */
  async getByIdOrNull(id: number): Promise<TEntity | null> {
    return safeAsync(() => this.storage.getById(id), {
      entityName: this.entityName,
      action: 'retrieving',
      details: { id }
    })
  }

  /**
   * List all entities
   */
  async list(): Promise<TEntity[]> {
    return safeAsync(() => this.storage.list(), {
      entityName: this.entityName,
      action: 'listing'
    })
  }

  /**
   * Update an entity
   */
  async update(id: number, data: TUpdate): Promise<TEntity> {
    // Transform TUpdate to Partial<TEntity> by ensuring it's compatible
    const updateData = {
      ...data,
      updated: Date.now()
    } as Partial<TEntity>

    const updated = await safeAsync(() => this.storage.update(id, updateData), {
      entityName: this.entityName,
      action: 'updating',
      details: { id, data }
    })

    if (!updated) {
      throwNotFound(this.entityName, id)
    }

    return updated
  }

  /**
   * Delete an entity
   */
  async delete(id: number): Promise<boolean> {
    const deleted = await safeAsync(() => this.storage.delete(id), {
      entityName: this.entityName,
      action: 'deleting',
      details: { id }
    })

    if (!deleted) {
      throwNotFound(this.entityName, id)
    }

    return true
  }

  /**
   * Check if entity exists
   */
  async exists(id: number): Promise<boolean> {
    const entity = await this.getByIdOrNull(id)
    return entity !== null
  }

  /**
   * Validate entity exists or throw
   */
  async validateExists(id: number): Promise<TEntity> {
    const entity = await this.getByIdOrNull(id)
    if (!entity) {
      throwNotFound(this.entityName, id)
    }
    return entity
  }

  /**
   * Count all entities
   */
  async count(): Promise<number> {
    const entities = await this.list()
    return entities.length
  }
}
