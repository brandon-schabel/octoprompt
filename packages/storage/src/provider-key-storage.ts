// Provider key storage layer using BaseStorage pattern
import { z } from 'zod'
import { ProviderKeySchema, type ProviderKey } from '@promptliano/schemas'
import { BaseStorage } from './base-storage'
import { 
  createEntityConverter,
  createStandardMappings,
  getInsertColumnsFromMappings,
  getInsertValuesFromEntity,
  type FieldMapping
} from './utils/storage-helpers'
import { SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'
import { createEntityErrorFactory } from '@promptliano/shared/src/error/entity-errors'
import { withTransaction } from './utils/transaction-helpers'

// Create ProviderKeyErrors factory
const ProviderKeyErrors = createEntityErrorFactory('ProviderKey')

// Storage schemas for validation
export const ProviderKeysStorageSchema = z.record(z.string(), ProviderKeySchema)
export type ProviderKeysStorage = z.infer<typeof ProviderKeysStorageSchema>

/**
 * Provider key storage implementation using BaseStorage
 * Reduced from 456 lines to ~200 lines
 */
class ProviderKeyStorage extends BaseStorage<ProviderKey, ProviderKeysStorage> {
  protected readonly tableName = 'provider_keys'
  protected readonly entitySchema = ProviderKeySchema as any
  protected readonly storageSchema = ProviderKeysStorageSchema as any

  private readonly fieldMappings = createStandardMappings<ProviderKey>({
    name: 'name',
    provider: 'provider',
    key: 'key',
    encrypted: { dbColumn: 'encrypted', converter: (v) => SqliteConverters.toBoolean(v) },
    iv: 'iv',
    tag: 'tag',
    salt: 'salt',
    baseUrl: { dbColumn: 'base_url', converter: (v) => v || undefined },
    customHeaders: { 
      dbColumn: 'custom_headers', 
      converter: (v) => v ? JSON.parse(v as string) : undefined 
    },
    isDefault: { dbColumn: 'is_default', converter: (v) => SqliteConverters.toBoolean(v) },
    isActive: { dbColumn: 'is_active', converter: (v) => SqliteConverters.toBoolean(v) },
    environment: { dbColumn: 'environment', converter: (v) => v || 'production' },
    description: { dbColumn: 'description', converter: (v) => v || undefined },
    expiresAt: { dbColumn: 'expires_at', converter: (v) => v || undefined },
    lastUsed: { dbColumn: 'last_used', converter: (v) => v || undefined }
  })

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  protected rowToEntity(row: any): ProviderKey {
    return this.converter(row)
  }

  protected getSelectColumns(): string[] {
    return [
      'id', 'name', 'provider', 'key', 'encrypted', 'iv', 'tag', 'salt',
      'base_url', 'custom_headers', 'is_default', 'is_active', 
      'environment', 'description', 'expires_at', 'last_used',
      'created_at', 'updated_at'
    ]
  }

  protected getInsertColumns(): string[] {
    // Exclude project_id since provider keys are global
    const columns = getInsertColumnsFromMappings(this.fieldMappings, ['project_id'])
    // Add encryption fields manually since they're handled specially
    return [...columns, 'encrypted', 'iv', 'tag', 'salt']
  }

  protected getInsertValues(entity: ProviderKey): any[] {
    const values = getInsertValuesFromEntity(entity, this.fieldMappings)
    // Handle custom headers serialization
    const customHeadersIndex = this.getInsertColumns().indexOf('custom_headers')
    if (customHeadersIndex !== -1 && entity.customHeaders) {
      values[customHeadersIndex] = JSON.stringify(entity.customHeaders)
    }
    return values
  }

  // === Custom Methods ===

  async readProviderKeys(): Promise<ProviderKeysStorage> {
    return this.readAll()
  }

  async writeProviderKeys(keys: ProviderKeysStorage): Promise<ProviderKeysStorage> {
    return this.writeAll(keys)
  }

  async getProviderKeyById(keyId: number): Promise<ProviderKey | null> {
    return this.getById(keyId)
  }

  async upsertProviderKey(key: ProviderKey): Promise<ProviderKey> {
    const db = this.getDb()
    const database = db.getDatabase()

    return withTransaction(database, async () => {
      const existing = await this.getById(key.id)
      if (existing) {
        // Update existing key
        const updated = await this.update(key.id, key)
        if (!updated) {
          throw ProviderKeyErrors.notFound(key.id)
        }
        return updated
      } else {
        // Insert new key
        return await this.add(key)
      }
    })
  }

  async deleteProviderKey(keyId: number): Promise<boolean> {
    return this.delete(keyId)
  }

  async getKeysByProvider(provider: string): Promise<ProviderKey[]> {
    const db = this.getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT ${this.getSelectColumns().join(', ')}
      FROM ${this.tableName}
      WHERE provider = ?
      ORDER BY is_default DESC, created_at DESC
    `)

    const rows = query.all(provider) as any[]
    return rows.map(row => this.rowToEntity(row))
  }

  async getActiveKeys(): Promise<ProviderKey[]> {
    const db = this.getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT ${this.getSelectColumns().join(', ')}
      FROM ${this.tableName}
      WHERE is_active = 1
      ORDER BY provider, is_default DESC, created_at DESC
    `)

    const rows = query.all() as any[]
    return rows.map(row => this.rowToEntity(row))
  }

  async getKeysByDateRange(startTime: number, endTime: number): Promise<ProviderKey[]> {
    const db = this.getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT ${this.getSelectColumns().join(', ')}
      FROM ${this.tableName}
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `)

    const rows = query.all(startTime, endTime) as any[]
    return rows.map(row => this.rowToEntity(row))
  }

  async countKeysByProvider(provider: string): Promise<number> {
    return this.count('provider = ?', [provider])
  }

  async getDefaultKeyForProvider(provider: string): Promise<ProviderKey | null> {
    const db = this.getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT ${this.getSelectColumns().join(', ')}
      FROM ${this.tableName}
      WHERE provider = ? AND is_default = 1 AND is_active = 1
      LIMIT 1
    `)

    const row = query.get(provider) as any
    return row ? this.rowToEntity(row) : null
  }

  async setDefaultKey(keyId: number): Promise<void> {
    const key = await this.getById(keyId)
    if (!key) {
      throw ProviderKeyErrors.notFound(keyId)
    }

    const db = this.getDb()
    const database = db.getDatabase()

    withTransaction(database, () => {
      // Clear existing default for this provider
      database.prepare(`
        UPDATE ${this.tableName}
        SET is_default = 0
        WHERE provider = ? AND id != ?
      `).run(key.provider, keyId)

      // Set new default
      database.prepare(`
        UPDATE ${this.tableName}
        SET is_default = 1
        WHERE id = ?
      `).run(keyId)
    })
  }

  async updateLastUsed(keyId: number): Promise<void> {
    const db = this.getDb()
    const database = db.getDatabase()

    database.prepare(`
      UPDATE ${this.tableName}
      SET last_used = ?
      WHERE id = ?
    `).run(Date.now(), keyId)
  }
}

// Export singleton instance
const providerKeyStorageInstance = new ProviderKeyStorage()

// Export the storage object for backward compatibility
export const providerKeyStorage = {
  readProviderKeys: () => providerKeyStorageInstance.readProviderKeys(),
  writeProviderKeys: (keys: ProviderKeysStorage) => providerKeyStorageInstance.writeProviderKeys(keys),
  getProviderKeyById: (keyId: number) => providerKeyStorageInstance.getProviderKeyById(keyId),
  upsertProviderKey: (key: ProviderKey) => providerKeyStorageInstance.upsertProviderKey(key),
  deleteProviderKey: (keyId: number) => providerKeyStorageInstance.deleteProviderKey(keyId),
  getKeysByProvider: (provider: string) => providerKeyStorageInstance.getKeysByProvider(provider),
  getActiveKeys: () => providerKeyStorageInstance.getActiveKeys(),
  getKeysByDateRange: (startTime: number, endTime: number) => 
    providerKeyStorageInstance.getKeysByDateRange(startTime, endTime),
  countKeysByProvider: (provider: string) => providerKeyStorageInstance.countKeysByProvider(provider),
  getDefaultKeyForProvider: (provider: string) => 
    providerKeyStorageInstance.getDefaultKeyForProvider(provider),
  setDefaultKey: (keyId: number) => providerKeyStorageInstance.setDefaultKey(keyId),
  updateLastUsed: (keyId: number) => providerKeyStorageInstance.updateLastUsed(keyId),
  generateId: () => providerKeyStorageInstance.generateId()
}