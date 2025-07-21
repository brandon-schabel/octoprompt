// Export SQLiteAdapter components from database-manager
export { DatabaseManager, getDb } from './database-manager'
export type { TableSchema } from './database-manager'

// Additional SQLite-specific exports
import { DatabaseManager } from './database-manager'
import type { Database } from 'bun:sqlite'

export class SQLiteAdapter {
  private dbManager: DatabaseManager

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
  }

  getDatabase(): Database {
    return this.dbManager.getDatabase()
  }

  async get<T>(tableName: string, id: string): Promise<T | null> {
    return this.dbManager.get<T>(tableName, id)
  }

  async getAll<T>(tableName: string): Promise<Map<string, T>> {
    return this.dbManager.getAll<T>(tableName)
  }

  async create<T>(tableName: string, id: string, data: T): Promise<void> {
    return this.dbManager.create<T>(tableName, id, data)
  }

  async update<T>(tableName: string, id: string, data: T): Promise<boolean> {
    return this.dbManager.update<T>(tableName, id, data)
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    return this.dbManager.delete(tableName, id)
  }

  async exists(tableName: string, id: string): Promise<boolean> {
    return this.dbManager.exists(tableName, id)
  }

  async clear(tableName: string): Promise<void> {
    return this.dbManager.clear(tableName)
  }

  generateUniqueId(tableName: string): number {
    return this.dbManager.generateUniqueId(tableName)
  }

  transaction<T>(fn: () => T): T {
    return this.dbManager.transaction(fn)
  }
}
