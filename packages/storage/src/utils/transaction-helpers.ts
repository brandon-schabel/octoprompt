import { Database } from 'bun:sqlite'
import { ApiError } from '@promptliano/shared'

/**
 * Execute a database operation within a transaction
 * Automatically handles rollback on error
 */
export function withTransaction<T>(
  database: Database,
  operation: (db: Database) => T
): T {
  try {
    return database.transaction(() => operation(database))()
  } catch (error: any) {
    console.error('Transaction failed:', error)
    throw new ApiError(500, 'Transaction failed', 'TRANSACTION_ERROR', error)
  }
}

/**
 * Replace all entities in a table within a transaction
 * Common pattern: DELETE all + INSERT new records
 */
export function replaceEntities<T>(
  database: Database,
  tableName: string,
  entities: T[],
  getInsertColumns: () => string[],
  getInsertValues: (entity: T) => any[],
  whereClause?: string,
  whereParams?: any[]
): void {
  withTransaction(database, (db) => {
    // Delete existing entities
    if (whereClause) {
      const deleteQuery = db.prepare(`DELETE FROM ${tableName} WHERE ${whereClause}`)
      deleteQuery.run(...(whereParams || []))
    } else {
      db.exec(`DELETE FROM ${tableName}`)
    }

    // Insert new entities if any
    if (entities.length > 0) {
      const columns = getInsertColumns()
      const columnNames = columns.join(', ')
      const placeholders = columns.map(() => '?').join(', ')
      
      const insertQuery = db.prepare(`
        INSERT INTO ${tableName} (${columnNames})
        VALUES (${placeholders})
      `)

      for (const entity of entities) {
        const values = getInsertValues(entity)
        insertQuery.run(...values)
      }
    }
  })
}

/**
 * Batch insert entities with transaction
 */
export function batchInsert<T>(
  database: Database,
  tableName: string,
  entities: T[],
  getInsertColumns: () => string[],
  getInsertValues: (entity: T) => any[]
): number {
  if (entities.length === 0) return 0

  return withTransaction(database, (db) => {
    const columns = getInsertColumns()
    const columnNames = columns.join(', ')
    const placeholders = columns.map(() => '?').join(', ')
    
    const insertQuery = db.prepare(`
      INSERT INTO ${tableName} (${columnNames})
      VALUES (${placeholders})
    `)

    let inserted = 0
    for (const entity of entities) {
      const values = getInsertValues(entity)
      const result = insertQuery.run(...values)
      inserted += (result as any).changes || 0
    }

    return inserted
  })
}

/**
 * Batch update entities with transaction
 */
export function batchUpdate<T extends { id: number }>(
  database: Database,
  tableName: string,
  updates: Array<{ id: number; data: Partial<T> }>,
  getUpdateColumns: () => string[],
  getUpdateValues: (data: Partial<T>) => any[]
): number {
  if (updates.length === 0) return 0

  return withTransaction(database, (db) => {
    const columns = getUpdateColumns()
    const setClause = columns.map(col => `${col} = ?`).join(', ')
    
    const updateQuery = db.prepare(`
      UPDATE ${tableName}
      SET ${setClause}
      WHERE id = ?
    `)

    let updated = 0
    for (const { id, data } of updates) {
      const values = getUpdateValues(data)
      const result = updateQuery.run(...values, id)
      updated += (result as any).changes || 0
    }

    return updated
  })
}

/**
 * Batch delete entities with transaction
 */
export function batchDelete(
  database: Database,
  tableName: string,
  ids: number[]
): number {
  if (ids.length === 0) return 0

  return withTransaction(database, (db) => {
    const placeholders = ids.map(() => '?').join(', ')
    const deleteQuery = db.prepare(`
      DELETE FROM ${tableName}
      WHERE id IN (${placeholders})
    `)

    const result = deleteQuery.run(...ids)
    return (result as any).changes || 0
  })
}

/**
 * Upsert (INSERT or UPDATE) entities based on unique constraint
 */
export function upsertEntities<T>(
  database: Database,
  tableName: string,
  entities: T[],
  getInsertColumns: () => string[],
  getInsertValues: (entity: T) => any[],
  conflictColumns: string[],
  updateColumns: string[]
): number {
  if (entities.length === 0) return 0

  return withTransaction(database, (db) => {
    const insertColumns = getInsertColumns()
    const columnNames = insertColumns.join(', ')
    const placeholders = insertColumns.map(() => '?').join(', ')
    
    const onConflict = conflictColumns.join(', ')
    const doUpdate = updateColumns
      .map(col => `${col} = excluded.${col}`)
      .join(', ')
    
    const upsertQuery = db.prepare(`
      INSERT INTO ${tableName} (${columnNames})
      VALUES (${placeholders})
      ON CONFLICT(${onConflict}) DO UPDATE SET ${doUpdate}
    `)

    let affected = 0
    for (const entity of entities) {
      const values = getInsertValues(entity)
      const result = upsertQuery.run(...values)
      affected += (result as any).changes || 0
    }

    return affected
  })
}

/**
 * Execute multiple operations in a single transaction
 */
export function multiTransaction(
  database: Database,
  operations: Array<(db: Database) => void>
): void {
  withTransaction(database, (db) => {
    for (const operation of operations) {
      operation(db)
    }
  })
}