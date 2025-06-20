import { z, ZodError } from 'zod'
import { ProviderKeySchema, type ProviderKey } from '@octoprompt/schemas'
import { normalizeToUnixMs } from '@octoprompt/shared/src/utils/parse-timestamp'
import { DatabaseManager, getDb } from './database-manager'

// Schema for the entire storage file: a record of ProviderKeys keyed by their ID
export const ProviderKeysStorageSchema = z.record(z.string(), ProviderKeySchema)
export type ProviderKeysStorage = z.infer<typeof ProviderKeysStorageSchema>

// --- Specific Data Accessors ---

export const providerKeyStorage = {
  /** Reads all provider keys from the database. */
  async readProviderKeys(): Promise<ProviderKeysStorage> {
    const db = getDb()
    const keysMap = await db.getAll<ProviderKey>('provider_keys')
    
    // Convert Map to ProviderKeysStorage (Record)
    const providerKeys: ProviderKeysStorage = {}
    for (const [id, key] of keysMap) {
      providerKeys[String(id)] = key
    }
    
    // Validate the result
    const validationResult = ProviderKeysStorageSchema.safeParse(providerKeys)
    if (!validationResult.success) {
      console.error('Validation failed reading provider keys from database:', validationResult.error.errors)
      return {}
    }
    
    return validationResult.data
  },

  /** Writes all provider keys to the database (replaces entire collection). */
  async writeProviderKeys(keys: ProviderKeysStorage): Promise<ProviderKeysStorage> {
    const db = getDb()
    
    // Validate input
    const validationResult = ProviderKeysStorageSchema.safeParse(keys)
    if (!validationResult.success) {
      console.error('Validation failed before writing provider keys to database:', validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }
    
    const validatedKeys = validationResult.data
    
    // Use transaction to ensure atomicity
    db.transaction(() => {
      // Clear existing keys - synchronous in transaction
      db.getDatabase().exec(`DELETE FROM provider_keys`)
      
      // Insert all keys - synchronous in transaction
      const insertStmt = db.getDatabase().prepare(`
        INSERT INTO provider_keys (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      
      for (const [id, key] of Object.entries(validatedKeys)) {
        const now = Date.now()
        insertStmt.run(id, JSON.stringify(key), now, now)
      }
    })
    
    return validatedKeys
  },

  /** Gets a specific provider key by ID. */
  async getProviderKeyById(keyId: number): Promise<ProviderKey | null> {
    const db = getDb()
    return await db.get<ProviderKey>('provider_keys', String(keyId))
  },

  /** Creates or updates a provider key. */
  async upsertProviderKey(key: ProviderKey): Promise<ProviderKey> {
    const db = getDb()
    
    // Validate the key
    const validatedKey = ProviderKeySchema.parse(key)
    const id = String(validatedKey.id)
    
    // Use the database directly for better control
    const now = Date.now()
    const database = db.getDatabase()
    
    // Check if exists
    const existsQuery = database.prepare(`SELECT 1 FROM provider_keys WHERE id = ? LIMIT 1`)
    const existingRow = existsQuery.get(id)
    
    if (existingRow) {
      // Update
      const updateQuery = database.prepare(`
        UPDATE provider_keys
        SET data = ?, updated_at = ?
        WHERE id = ?
      `)
      updateQuery.run(JSON.stringify(validatedKey), now, id)
    } else {
      // Insert
      const insertQuery = database.prepare(`
        INSERT INTO provider_keys (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      insertQuery.run(id, JSON.stringify(validatedKey), now, now)
    }
    
    return validatedKey
  },

  /** Deletes a provider key. */
  async deleteProviderKey(keyId: number): Promise<boolean> {
    const db = getDb()
    return await db.delete('provider_keys', String(keyId))
  },

  /** Gets all provider keys for a specific provider. */
  async getKeysByProvider(provider: string): Promise<ProviderKey[]> {
    const db = getDb()
    
    // Find all keys for this provider
    return await db.findByJsonField<ProviderKey>(
      'provider_keys',
      '$.provider',
      provider
    )
  },

  /** Gets all active provider keys. */
  async getActiveKeys(): Promise<ProviderKey[]> {
    const db = getDb()
    
    // Find all active keys
    return await db.findByJsonField<ProviderKey>(
      'provider_keys',
      '$.isActive',
      true
    )
  },

  /** Gets provider keys created within a date range. */
  async getKeysByDateRange(startTime: number, endTime: number): Promise<ProviderKey[]> {
    const db = getDb()
    return await db.findByDateRange<ProviderKey>('provider_keys', startTime, endTime)
  },

  /** Counts provider keys by provider. */
  async countKeysByProvider(provider: string): Promise<number> {
    const db = getDb()
    return await db.countByJsonField('provider_keys', '$.provider', provider)
  },

  /** Generates a unique ID for provider keys. */
  generateId: (): number => {
    return normalizeToUnixMs(new Date())
  }
}
