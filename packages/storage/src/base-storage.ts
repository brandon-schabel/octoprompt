import { z, ZodError } from 'zod'
import { Database } from 'bun:sqlite'
import { ApiError } from '@promptliano/shared'
import { DatabaseManager, getDb } from './database-manager'
import { SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'

/**
 * Base entity interface that all entities should extend
 */
export interface BaseEntity {
  id: number
  created: number
  updated: number
}

/**
 * Abstract base class for storage implementations
 * Provides common CRUD operations with validation and error handling
 * 
 * @template TEntity - The entity type (must match Zod schema)
 * @template TStorage - The storage map type (Record<string, TEntity>)
 */
export abstract class BaseStorage<TEntity extends BaseEntity, TStorage = Record<string, TEntity>> {
  /**
   * Table name in the database
   */
  protected abstract readonly tableName: string

  /**
   * Zod schema for validating entities
   */
  protected abstract readonly entitySchema: z.ZodSchema<TEntity>

  /**
   * Zod schema for validating storage collections
   */
  protected abstract readonly storageSchema: z.ZodSchema<TStorage>

  /**
   * Convert a database row to an entity
   */
  protected abstract rowToEntity(row: any): TEntity

  /**
   * Get column names for SELECT queries
   */
  protected abstract getSelectColumns(): string[]

  /**
   * Get column names for INSERT queries
   */
  protected abstract getInsertColumns(): string[]

  /**
   * Get values from entity for INSERT queries
   */
  protected abstract getInsertValues(entity: TEntity): any[]

  /**
   * Get database manager instance
   */
  protected getDb(): DatabaseManager {
    return getDb()
  }

  /**
   * Validate data against a schema
   */
  protected async validateData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): Promise<T> {
    const validationResult = await schema.safeParseAsync(data)
    if (!validationResult.success) {
      console.error(`Zod validation failed for ${context}:`, validationResult.error.errors)
      throw new ApiError(400, `Validation failed for ${context}`, 'VALIDATION_ERROR')
    }
    return validationResult.data
  }

  /**
   * Read all entities (optionally filtered by a condition)
   */
  async readAll(whereClause?: string, whereParams?: any[]): Promise<TStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const columns = this.getSelectColumns().join(', ')
      const where = whereClause ? `WHERE ${whereClause}` : ''
      
      const query = database.prepare(`
        SELECT ${columns}
        FROM ${this.tableName}
        ${where}
        ORDER BY created_at DESC
      `)

      const rows = whereParams ? query.all(...whereParams) : query.all()
      const storage = {} as any

      for (const row of rows as any[]) {
        const entity = this.rowToEntity(row)
        const validated = await this.validateData(entity, this.entitySchema, `${this.tableName} entity ${entity.id}`)
        storage[String(validated.id)] = validated
      }

      return storage as TStorage
    } catch (error: any) {
      console.error(`Error reading ${this.tableName} from database:`, error)
      throw new ApiError(500, `Failed to read ${this.tableName} from database`, 'DB_READ_ERROR', error)
    }
  }

  /**
   * Write all entities (replaces entire collection)
   */
  async writeAll(entities: TStorage, whereClause?: string, whereParams?: any[]): Promise<TStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate all entities first
      const validated = await this.validateData(entities, this.storageSchema, this.tableName)

      // Use transaction for atomic operation
      database.transaction(() => {
        // Delete existing entities
        if (whereClause) {
          const deleteQuery = database.prepare(`DELETE FROM ${this.tableName} WHERE ${whereClause}`)
          deleteQuery.run(...(whereParams || []))
        } else {
          database.exec(`DELETE FROM ${this.tableName}`)
        }

        // Insert new entities
        const columns = this.getInsertColumns().join(', ')
        const placeholders = this.getInsertColumns().map(() => '?').join(', ')
        
        const insertQuery = database.prepare(`
          INSERT INTO ${this.tableName} (${columns})
          VALUES (${placeholders})
        `)

        for (const entity of Object.values(validated as Record<string, TEntity>)) {
          const values = this.getInsertValues(entity)
          insertQuery.run(...values)
        }
      })()

      return validated
    } catch (error: any) {
      console.error(`Error writing ${this.tableName} to database:`, error)
      throw new ApiError(500, `Failed to write ${this.tableName}`, 'DB_WRITE_ERROR', error)
    }
  }

  /**
   * Get entity by ID
   */
  async getById(id: number): Promise<TEntity | null> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const columns = this.getSelectColumns().join(', ')
      const query = database.prepare(`
        SELECT ${columns}
        FROM ${this.tableName}
        WHERE id = ?
      `)

      const row = query.get(id) as any

      if (!row) {
        return null
      }

      const entity = this.rowToEntity(row)
      return await this.validateData(entity, this.entitySchema, `${this.tableName} ${id}`)
    } catch (error: any) {
      console.error(`Error reading ${this.tableName} ${id} from database:`, error)
      throw new ApiError(500, `Failed to read ${this.tableName} ${id}`, 'DB_READ_ERROR', error)
    }
  }

  /**
   * Get entity by ID or null (alias for getById)
   */
  async getByIdOrNull(id: number): Promise<TEntity | null> {
    return this.getById(id)
  }

  /**
   * Add a new entity
   */
  async add(entity: TEntity): Promise<TEntity> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate entity
      const validated = await this.validateData(entity, this.entitySchema, `new ${this.tableName}`)

      const columns = this.getInsertColumns().join(', ')
      const placeholders = this.getInsertColumns().map(() => '?').join(', ')
      
      const insertQuery = database.prepare(`
        INSERT INTO ${this.tableName} (${columns})
        VALUES (${placeholders})
      `)

      const values = this.getInsertValues(validated)
      insertQuery.run(...values)

      return validated
    } catch (error: any) {
      console.error(`Error adding ${this.tableName}:`, error)
      throw new ApiError(500, `Failed to add ${this.tableName}`, 'DB_ADD_ERROR', error)
    }
  }

  /**
   * Create a new entity (alias for add)
   */
  async create(entity: TEntity): Promise<TEntity> {
    return this.add(entity)
  }

  /**
   * Update an entity
   */
  async update(id: number, updates: Partial<TEntity>): Promise<TEntity> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Get existing entity
      const existing = await this.getById(id)
      if (!existing) {
        throw new ApiError(404, `${this.tableName} ${id} not found`, 'NOT_FOUND')
      }

      // Merge updates
      const updated = { ...existing, ...updates, id, updated: Date.now() } as any
      const validated = await this.validateData(updated, this.entitySchema, `update ${this.tableName} ${id}`)

      // Build UPDATE query dynamically
      const setClause = this.getInsertColumns()
        .filter(col => col !== 'id')
        .map(col => `${col} = ?`)
        .join(', ')

      const updateQuery = database.prepare(`
        UPDATE ${this.tableName}
        SET ${setClause}
        WHERE id = ?
      `)

      const values = this.getInsertValues(validated).filter((_, i) => this.getInsertColumns()[i] !== 'id')
      updateQuery.run(...values, id)

      return validated
    } catch (error: any) {
      if (error instanceof ApiError) throw error
      console.error(`Error updating ${this.tableName} ${id}:`, error)
      throw new ApiError(500, `Failed to update ${this.tableName} ${id}`, 'DB_UPDATE_ERROR', error)
    }
  }

  /**
   * Delete an entity
   */
  async delete(id: number): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const deleteQuery = database.prepare(`
        DELETE FROM ${this.tableName}
        WHERE id = ?
      `)

      const result = deleteQuery.run(id)
      return (result as any).changes > 0
    } catch (error: any) {
      console.error(`Error deleting ${this.tableName} ${id}:`, error)
      throw new ApiError(500, `Failed to delete ${this.tableName} ${id}`, 'DB_DELETE_ERROR', error)
    }
  }

  /**
   * Delete multiple entities by condition
   */
  async deleteWhere(whereClause: string, whereParams: any[]): Promise<number> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const deleteQuery = database.prepare(`
        DELETE FROM ${this.tableName}
        WHERE ${whereClause}
      `)

      const result = deleteQuery.run(...whereParams)
      return (result as any).changes
    } catch (error: any) {
      console.error(`Error deleting ${this.tableName} with condition:`, error)
      throw new ApiError(500, `Failed to delete ${this.tableName}`, 'DB_DELETE_ERROR', error)
    }
  }

  /**
   * Count entities matching a condition
   */
  async count(whereClause?: string, whereParams?: any[]): Promise<number> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const where = whereClause ? `WHERE ${whereClause}` : ''
      const query = database.prepare(`
        SELECT COUNT(*) as count
        FROM ${this.tableName}
        ${where}
      `)

      const result = whereParams ? query.get(...whereParams) : query.get()
      return (result as any).count || 0
    } catch (error: any) {
      console.error(`Error counting ${this.tableName}:`, error)
      throw new ApiError(500, `Failed to count ${this.tableName}`, 'DB_COUNT_ERROR', error)
    }
  }

  /**
   * Check if entity exists
   */
  async exists(id: number): Promise<boolean> {
    const count = await this.count('id = ?', [id])
    return count > 0
  }

  /**
   * Validate entity exists and return it
   */
  async validateExists(id: number): Promise<TEntity> {
    const entity = await this.getById(id)
    if (!entity) {
      throw new ApiError(404, `${this.tableName} ${id} not found`, 'NOT_FOUND')
    }
    return entity
  }

  /**
   * List all entities
   */
  async list(): Promise<TEntity[]> {
    const storage = await this.readAll()
    return Object.values(storage as Record<string, TEntity>)
  }

  /**
   * Execute a custom query
   */
  protected async executeQuery<T>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const query = database.prepare(sql)
      return (params ? query.all(...params) : query.all()) as T[]
    } catch (error: any) {
      console.error('Error executing custom query:', error)
      throw new ApiError(500, 'Query execution failed', 'DB_QUERY_ERROR', error)
    }
  }

  /**
   * Generate a unique ID
   */
  generateId(): number {
    return this.getDb().generateUniqueId(this.tableName)
  }
}