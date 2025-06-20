import Database from 'bun:sqlite'
import type { StorageAdapter } from './storage-v2'
import path from 'node:path'
import fs from 'node:fs'

export interface SQLiteAdapterConfig {
  tableName: string
  db?: Database
  dbPath?: string
}

export class SQLiteAdapter<T> implements StorageAdapter<T> {
  private db: Database
  private tableName: string
  private readStmt: ReturnType<Database['prepare']>
  private readAllStmt: ReturnType<Database['prepare']>
  private writeStmt: ReturnType<Database['prepare']>
  private deleteStmt: ReturnType<Database['prepare']>
  private existsStmt: ReturnType<Database['prepare']>
  private clearStmt: ReturnType<Database['prepare']>
  private ownDb: boolean

  constructor(config: SQLiteAdapterConfig) {
    this.tableName = config.tableName
    this.ownDb = !config.db

    // Use provided database or create a new one
    if (config.db) {
      this.db = config.db
    } else {
      const dbPath = config.dbPath || path.join(process.cwd(), 'data', 'storage.db')
      this.ensureDirectory(dbPath)
      this.db = new Database(dbPath)
    }

    // Initialize the table
    this.initializeTable()

    // Prepare all statements for better performance
    this.readStmt = this.db.prepare(`
      SELECT data FROM ${this.tableName} WHERE id = ?
    `)

    this.readAllStmt = this.db.prepare(`
      SELECT id, data FROM ${this.tableName}
    `)

    this.writeStmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `)

    this.deleteStmt = this.db.prepare(`
      DELETE FROM ${this.tableName} WHERE id = ?
    `)

    this.existsStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM ${this.tableName} WHERE id = ?
    `)

    this.clearStmt = this.db.prepare(`
      DELETE FROM ${this.tableName}
    `)
  }

  private ensureDirectory(filePath: string): void {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private initializeTable(): void {
    // Create table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)

    // Create index on updated_at for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_updated_at
      ON ${this.tableName} (updated_at)
    `)
  }

  async read(id: string | number): Promise<T | null> {
    try {
      const row = this.readStmt.get(String(id)) as { data: string } | undefined
      if (!row) return null

      return this.parseJsonSafely(row.data)
    } catch (error) {
      console.error(`Error reading item ${id} from ${this.tableName}:`, error)
      return null
    }
  }

  async readAll(): Promise<Map<string | number, T>> {
    try {
      const rows = this.readAllStmt.all() as Array<{ id: string; data: string }>
      const map = new Map<string | number, T>()

      for (const row of rows) {
        const data = this.parseJsonSafely(row.data)
        if (data !== null) {
          // Convert numeric IDs back to numbers
          const numId = Number(row.id)
          const id = isNaN(numId) ? row.id : numId
          map.set(id, data)
        }
      }

      return map
    } catch (error) {
      console.error(`Error reading all items from ${this.tableName}:`, error)
      return new Map()
    }
  }

  async write(id: string | number, data: T): Promise<void> {
    const transaction = this.db.transaction(() => {
      try {
        const jsonData = JSON.stringify(data)
        const now = Date.now()
        this.writeStmt.run(String(id), jsonData, now)
      } catch (error) {
        throw new Error(`Failed to write item ${id}: ${error}`)
      }
    })

    try {
      transaction()
    } catch (error) {
      console.error(`Error writing item ${id} to ${this.tableName}:`, error)
      throw error
    }
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      const result = this.deleteStmt.run(String(id))
      // Check if any rows were affected
      return (result as any).changes > 0
    } catch (error) {
      console.error(`Error deleting item ${id} from ${this.tableName}:`, error)
      return false
    }
  }

  async exists(id: string | number): Promise<boolean> {
    try {
      const result = this.existsStmt.get(String(id)) as { count: number }
      return result.count > 0
    } catch (error) {
      console.error(`Error checking existence of item ${id} in ${this.tableName}:`, error)
      return false
    }
  }

  async clear(): Promise<void> {
    const transaction = this.db.transaction(() => {
      try {
        this.clearStmt.run()
      } catch (error) {
        throw new Error(`Failed to clear table ${this.tableName}: ${error}`)
      }
    })

    try {
      transaction()
    } catch (error) {
      console.error(`Error clearing table ${this.tableName}:`, error)
      throw error
    }
  }

  /**
   * Batch write multiple items in a single transaction
   */
  async writeBatch(items: Array<{ id: string | number; data: T }>): Promise<void> {
    const transaction = this.db.transaction(() => {
      const now = Date.now()
      for (const { id, data } of items) {
        try {
          const jsonData = JSON.stringify(data)
          this.writeStmt.run(String(id), jsonData, now)
        } catch (error) {
          throw new Error(`Failed to write item ${id} in batch: ${error}`)
        }
      }
    })

    try {
      transaction()
    } catch (error) {
      console.error(`Error in batch write to ${this.tableName}:`, error)
      throw error
    }
  }

  /**
   * Batch delete multiple items in a single transaction
   */
  async deleteBatch(ids: Array<string | number>): Promise<number> {
    let deletedCount = 0
    const transaction = this.db.transaction(() => {
      for (const id of ids) {
        try {
          const result = this.deleteStmt.run(String(id))
          if ((result as any).changes > 0) {
            deletedCount++
          }
        } catch (error) {
          throw new Error(`Failed to delete item ${id} in batch: ${error}`)
        }
      }
    })

    try {
      transaction()
      return deletedCount
    } catch (error) {
      console.error(`Error in batch delete from ${this.tableName}:`, error)
      throw error
    }
  }

  /**
   * Close the database connection if we own it
   */
  close(): void {
    if (this.ownDb && this.db) {
      this.db.close()
    }
  }

  /**
   * Parse JSON safely with error handling
   */
  private parseJsonSafely(jsonString: string): T | null {
    try {
      return JSON.parse(jsonString) as T
    } catch (error) {
      console.error(`Error parsing JSON data: ${error}`)
      return null
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    count: number
    totalSize: number
    avgSize: number
  }> {
    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as count,
          SUM(LENGTH(data)) as totalSize,
          AVG(LENGTH(data)) as avgSize
        FROM ${this.tableName}
      `).get() as any

      return {
        count: stats.count || 0,
        totalSize: stats.totalSize || 0,
        avgSize: stats.avgSize || 0,
      }
    } catch (error) {
      console.error(`Error getting stats for ${this.tableName}:`, error)
      return { count: 0, totalSize: 0, avgSize: 0 }
    }
  }

  /**
   * Vacuum the database to reclaim space
   */
  async vacuum(): Promise<void> {
    try {
      this.db.exec('VACUUM')
    } catch (error) {
      console.error('Error vacuuming database:', error)
    }
  }
}