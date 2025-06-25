import { type StorageAdapter } from './storage-v2'
import { type DatabaseManager, getDb } from './database-manager'

/**
 * SQLite adapter for StorageV2 that uses the existing DatabaseManager
 * This provides compatibility with the existing database structure
 */
export class SQLiteDbManagerAdapter<T> implements StorageAdapter<T> {
  private db: DatabaseManager

  constructor(private tableName: string) {
    this.db = getDb()
  }

  async read(id: string | number): Promise<T | null> {
    return await this.db.get<T>(this.tableName, String(id))
  }

  async readAll(): Promise<Map<string | number, T>> {
    const stringMap = await this.db.getAll<T>(this.tableName)

    // Convert string keys to numbers where appropriate
    const resultMap = new Map<string | number, T>()
    for (const [key, value] of stringMap) {
      const numKey = Number(key)
      const actualKey = isNaN(numKey) ? key : numKey
      resultMap.set(actualKey, value)
    }

    return resultMap
  }

  async write(id: string | number, data: T): Promise<void> {
    const stringId = String(id)
    const exists = await this.db.exists(this.tableName, stringId)

    if (exists) {
      await this.db.update(this.tableName, stringId, data)
    } else {
      await this.db.create(this.tableName, stringId, data)
    }
  }

  async delete(id: string | number): Promise<boolean> {
    return await this.db.delete(this.tableName, String(id))
  }

  async exists(id: string | number): Promise<boolean> {
    return await this.db.exists(this.tableName, String(id))
  }

  async clear(): Promise<void> {
    await this.db.clear(this.tableName)
  }

  // Additional SQLite-specific methods

  async findByJsonField(jsonPath: string, value: any): Promise<T[]> {
    return await this.db.findByJsonField<T>(this.tableName, jsonPath, value)
  }

  async findByDateRange(startTime: number, endTime: number): Promise<T[]> {
    return await this.db.findByDateRange<T>(this.tableName, startTime, endTime)
  }

  async countByJsonField(jsonPath: string, value: any): Promise<number> {
    return await this.db.countByJsonField(this.tableName, jsonPath, value)
  }

  transaction<R>(fn: () => R): R {
    return this.db.transaction(fn)
  }
}
