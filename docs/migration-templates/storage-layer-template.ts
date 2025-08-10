// Template for updating storage layer after migration
import { z } from 'zod'
import { EntitySchema, type Entity } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { type DatabaseManager } from './database-manager'

// Constants
const ENTITY_TABLE = 'entities' // Replace with actual table name

// Type for storage format
export type EntitiesStorage = Record<string, Entity>

/**
 * Storage layer template for column-based entities
 * Replace:
 * - Entity/ENTITY with your actual entity name
 * - Update SQL queries with actual column names
 * - Add specific query methods as needed
 */
class EntityStorage {
  private db: DatabaseManager

  constructor(db: DatabaseManager) {
    this.db = db
  }

  /**
   * Helper to safely parse JSON fields
   */
  private safeJsonParse<T>(json: string | null | undefined, fallback: T, context?: string): T {
    if (!json) return fallback

    try {
      return JSON.parse(json)
    } catch (error) {
      console.warn(`Failed to parse JSON${context ? ` for ${context}` : ''}: ${json}`, error)
      return fallback
    }
  }

  /**
   * Read all entities for a parent (e.g., project)
   */
  async readEntities(parentId: number): Promise<EntitiesStorage> {
    try {
      const database = this.db.getDatabase()

      // Direct SQL query with column names
      const query = database.prepare(`
        SELECT 
          id, parent_id, name, description, status,
          tags, metadata, created_at, updated_at
        FROM ${ENTITY_TABLE}
        WHERE parent_id = ?
        ORDER BY created_at DESC
      `)

      const rows = query.all(parentId) as any[]

      // Convert rows to storage format
      const entitiesStorage: EntitiesStorage = {}
      for (const row of rows) {
        const entity: Entity = {
          id: row.id,
          parentId: row.parent_id,
          name: row.name,
          description: row.description,
          status: row.status,
          // Parse JSON fields
          tags: this.safeJsonParse(row.tags, [], 'entity.tags'),
          metadata: this.safeJsonParse(row.metadata, {}, 'entity.metadata'),
          created: row.created_at,
          updated: row.updated_at
        }

        // Validate against schema
        const validationResult = EntitySchema.safeParse(entity)
        if (!validationResult.success) {
          console.error(`Validation failed for entity ${entity.id}:`, validationResult.error)
          continue
        }

        entitiesStorage[String(entity.id)] = validationResult.data
      }

      return entitiesStorage
    } catch (error) {
      console.error(`Failed to read entities for parent ${parentId}:`, error)
      throw new ApiError(500, 'Failed to read entities', 'DATABASE_READ_ERROR')
    }
  }

  /**
   * Write entities (replace all for parent)
   */
  async writeEntities(parentId: number, entities: EntitiesStorage): Promise<void> {
    try {
      const database = this.db.getDatabase()

      // Validate all entities first
      const validatedEntities: EntitiesStorage = {}
      for (const [id, entity] of Object.entries(entities)) {
        const validationResult = EntitySchema.safeParse(entity)
        if (!validationResult.success) {
          throw new ApiError(
            400,
            `Invalid entity data for ${id}: ${validationResult.error.message}`,
            'VALIDATION_ERROR'
          )
        }
        validatedEntities[id] = validationResult.data
      }

      // Transaction for atomic write
      database.transaction(() => {
        // Delete existing entities
        const deleteQuery = database.prepare(`
          DELETE FROM ${ENTITY_TABLE}
          WHERE parent_id = ?
        `)
        deleteQuery.run(parentId)

        // Insert new entities
        const now = Date.now()
        const insertQuery = database.prepare(`
          INSERT INTO ${ENTITY_TABLE} (
            id, parent_id, name, description, status,
            tags, metadata, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        for (const [entityId, entity] of Object.entries(validatedEntities)) {
          // Verify parent ID matches
          if (entity.parentId !== parentId) {
            throw new ApiError(400, `Entity ${entityId} has mismatched parentId`, 'INVALID_PARENT_ID')
          }

          insertQuery.run(
            entityId,
            entity.parentId,
            entity.name,
            entity.description || '',
            entity.status,
            JSON.stringify(entity.tags || []),
            JSON.stringify(entity.metadata || {}),
            entity.created || now,
            entity.updated || now
          )
        }
      })()

      console.log(`Successfully wrote ${Object.keys(entities).length} entities for parent ${parentId}`)
    } catch (error) {
      console.error(`Failed to write entities:`, error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to write entities', 'DATABASE_WRITE_ERROR')
    }
  }

  /**
   * Get single entity by ID
   */
  async getEntityById(entityId: number): Promise<Entity | null> {
    try {
      const database = this.db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, parent_id, name, description, status,
          tags, metadata, created_at, updated_at
        FROM ${ENTITY_TABLE}
        WHERE id = ?
      `)

      const row = query.get(entityId) as any

      if (!row) {
        return null
      }

      const entity: Entity = {
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        description: row.description,
        status: row.status,
        tags: this.safeJsonParse(row.tags, [], 'entity.tags'),
        metadata: this.safeJsonParse(row.metadata, {}, 'entity.metadata'),
        created: row.created_at,
        updated: row.updated_at
      }

      // Validate
      const validationResult = EntitySchema.safeParse(entity)
      if (!validationResult.success) {
        console.error(`Validation failed for entity ${entityId}:`, validationResult.error)
        return null
      }

      return validationResult.data
    } catch (error) {
      console.error(`Failed to get entity ${entityId}:`, error)
      throw new ApiError(500, 'Failed to get entity', 'DATABASE_READ_ERROR')
    }
  }

  /**
   * Update single entity
   */
  async updateEntity(entityId: number, updates: Partial<Entity>): Promise<void> {
    try {
      const database = this.db.getDatabase()

      // Build dynamic update query
      const updateFields: string[] = []
      const values: any[] = []

      if (updates.name !== undefined) {
        updateFields.push('name = ?')
        values.push(updates.name)
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?')
        values.push(updates.description)
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?')
        values.push(updates.status)
      }
      if (updates.tags !== undefined) {
        updateFields.push('tags = ?')
        values.push(JSON.stringify(updates.tags))
      }
      if (updates.metadata !== undefined) {
        updateFields.push('metadata = ?')
        values.push(JSON.stringify(updates.metadata))
      }

      // Always update timestamp
      updateFields.push('updated_at = ?')
      values.push(Date.now())

      // Add entity ID for WHERE clause
      values.push(entityId)

      const query = database.prepare(`
        UPDATE ${ENTITY_TABLE}
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `)

      const result = query.run(...values)

      if (result.changes === 0) {
        throw new ApiError(404, `Entity ${entityId} not found`, 'NOT_FOUND')
      }

      console.log(`Updated entity ${entityId}`)
    } catch (error) {
      console.error(`Failed to update entity ${entityId}:`, error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to update entity', 'DATABASE_UPDATE_ERROR')
    }
  }

  /**
   * Delete entity
   */
  async deleteEntity(entityId: number): Promise<void> {
    try {
      const database = this.db.getDatabase()

      const query = database.prepare(`
        DELETE FROM ${ENTITY_TABLE}
        WHERE id = ?
      `)

      const result = query.run(entityId)

      if (result.changes === 0) {
        throw new ApiError(404, `Entity ${entityId} not found`, 'NOT_FOUND')
      }

      console.log(`Deleted entity ${entityId}`)
    } catch (error) {
      console.error(`Failed to delete entity ${entityId}:`, error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to delete entity', 'DATABASE_DELETE_ERROR')
    }
  }

  /**
   * Search entities
   */
  async searchEntities(criteria: {
    parentId?: number
    status?: string
    searchTerm?: string
    limit?: number
  }): Promise<Entity[]> {
    try {
      const database = this.db.getDatabase()

      // Build dynamic WHERE clause
      const conditions: string[] = []
      const params: any[] = []

      if (criteria.parentId !== undefined) {
        conditions.push('parent_id = ?')
        params.push(criteria.parentId)
      }
      if (criteria.status !== undefined) {
        conditions.push('status = ?')
        params.push(criteria.status)
      }
      if (criteria.searchTerm) {
        conditions.push('(name LIKE ? OR description LIKE ?)')
        params.push(`%${criteria.searchTerm}%`, `%${criteria.searchTerm}%`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const limitClause = criteria.limit ? `LIMIT ${criteria.limit}` : ''

      const query = database.prepare(`
        SELECT 
          id, parent_id, name, description, status,
          tags, metadata, created_at, updated_at
        FROM ${ENTITY_TABLE}
        ${whereClause}
        ORDER BY created_at DESC
        ${limitClause}
      `)

      const rows = query.all(...params) as any[]

      return rows.map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        description: row.description,
        status: row.status,
        tags: this.safeJsonParse(row.tags, [], 'entity.tags'),
        metadata: this.safeJsonParse(row.metadata, {}, 'entity.metadata'),
        created: row.created_at,
        updated: row.updated_at
      }))
    } catch (error) {
      console.error('Failed to search entities:', error)
      throw new ApiError(500, 'Failed to search entities', 'DATABASE_SEARCH_ERROR')
    }
  }
}

// Export singleton instance
export const entityStorage = new EntityStorage(DatabaseManager.getInstance())
