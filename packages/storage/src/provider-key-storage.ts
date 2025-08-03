import { z, ZodError } from 'zod'
import { ProviderKeySchema, type ProviderKey } from '@promptliano/schemas'
import { normalizeToUnixMs } from '@promptliano/shared/src/utils/parse-timestamp'
import { DatabaseManager, getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'

// Schema for the entire storage file: a record of ProviderKeys keyed by their ID
export const ProviderKeysStorageSchema = z.record(z.string(), ProviderKeySchema)
export type ProviderKeysStorage = z.infer<typeof ProviderKeysStorageSchema>

// --- Database Helper Functions ---

/**
 * Validates data against a schema and returns the validated data.
 */
async function validateData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): Promise<T> {
  const validationResult = await schema.safeParseAsync(data)
  if (!validationResult.success) {
    console.error(`Zod validation failed for ${context}:`, validationResult.error.errors)
    throw new ApiError(400, `Validation failed for ${context}`, 'VALIDATION_ERROR')
  }
  return validationResult.data
}

// --- Specific Data Accessors ---

export const providerKeyStorage = {
  /** Reads all provider keys from the database. */
  async readProviderKeys(): Promise<ProviderKeysStorage> {
    const db = getDb()
    const database = db.getDatabase()

    // Query provider keys directly from columns
    const query = database.prepare(`
      SELECT 
        id, name, provider, key, encrypted, iv, tag, salt,
        is_default, is_active, environment, description,
        expires_at, last_used, created_at, updated_at
      FROM provider_keys
      ORDER BY created_at DESC
    `)

    const rows = query.all() as any[]

    // Convert rows to ProviderKeysStorage
    const providerKeys: ProviderKeysStorage = {}
    for (const row of rows) {
      const key: ProviderKey = {
        id: row.id,
        name: row.name,
        provider: row.provider,
        key: row.key,
        encrypted: Boolean(row.encrypted),
        iv: row.iv,
        tag: row.tag,
        salt: row.salt,
        isDefault: Boolean(row.is_default),
        isActive: Boolean(row.is_active),
        environment: row.environment,
        description: row.description || undefined,
        expiresAt: row.expires_at || undefined,
        lastUsed: row.last_used || undefined,
        created: row.created_at,
        updated: row.updated_at
      }

      // Validate the result
      const validationResult = ProviderKeySchema.safeParse(key)
      if (!validationResult.success) {
        console.error(`Skipping invalid provider key ${row.id}:`, validationResult.error.errors)
        continue
      }

      providerKeys[String(validationResult.data.id)] = validationResult.data
    }

    return providerKeys
  },

  /** Writes all provider keys to the database (replaces entire collection). */
  async writeProviderKeys(keys: ProviderKeysStorage): Promise<ProviderKeysStorage> {
    const db = getDb()
    const database = db.getDatabase()

    // Validate input
    const validatedKeys = await validateData(keys, ProviderKeysStorageSchema, 'provider keys')

    // Use transaction to ensure atomicity
    database.transaction(() => {
      // Clear existing keys
      database.exec(`DELETE FROM provider_keys`)

      // Insert all keys
      const insertStmt = database.prepare(`
        INSERT INTO provider_keys (
          id, name, provider, key, encrypted, iv, tag, salt,
          is_default, is_active, environment, description,
          expires_at, last_used, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const [id, key] of Object.entries(validatedKeys)) {
        const now = Date.now()
        insertStmt.run(
          key.id,
          key.name,
          key.provider,
          key.key,
          key.encrypted ? 1 : 0,
          key.iv || null,
          key.tag || null,
          key.salt || null,
          key.isDefault ? 1 : 0,
          key.isActive ? 1 : 0,
          key.environment,
          key.description || null,
          key.expiresAt || null,
          key.lastUsed || null,
          key.created || now,
          key.updated || now
        )
      }
    })()

    return validatedKeys
  },

  /** Gets a specific provider key by ID. */
  async getProviderKeyById(keyId: number): Promise<ProviderKey | null> {
    const db = getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT 
        id, name, provider, key, encrypted, iv, tag, salt,
        is_default, is_active, environment, description,
        expires_at, last_used, created_at, updated_at
      FROM provider_keys
      WHERE id = ?
    `)

    const row = query.get(keyId) as any

    if (!row) {
      return null
    }

    const key: ProviderKey = {
      id: row.id,
      name: row.name,
      provider: row.provider,
      key: row.key,
      encrypted: Boolean(row.encrypted),
      iv: row.iv,
      tag: row.tag,
      salt: row.salt,
      isDefault: Boolean(row.is_default),
      isActive: Boolean(row.is_active),
      environment: row.environment,
      description: row.description || undefined,
      expiresAt: row.expires_at || undefined,
      lastUsed: row.last_used || undefined,
      created: row.created_at,
      updated: row.updated_at
    }

    // Validate before returning
    return await validateData(key, ProviderKeySchema, `provider key ${keyId}`)
  },

  /** Creates or updates a provider key. */
  async upsertProviderKey(key: ProviderKey): Promise<ProviderKey> {
    const db = getDb()
    const database = db.getDatabase()

    // Validate the key
    const validatedKey = await validateData(key, ProviderKeySchema, `provider key ${key.id}`)
    const now = Date.now()

    // Check if exists
    const existsQuery = database.prepare(`SELECT 1 FROM provider_keys WHERE id = ? LIMIT 1`)
    const existingRow = existsQuery.get(validatedKey.id)

    if (existingRow) {
      // Update
      const updateQuery = database.prepare(`
        UPDATE provider_keys
        SET name = ?, provider = ?, key = ?, encrypted = ?, iv = ?, tag = ?, salt = ?,
            is_default = ?, is_active = ?, environment = ?, description = ?,
            expires_at = ?, last_used = ?, updated_at = ?
        WHERE id = ?
      `)
      updateQuery.run(
        validatedKey.name,
        validatedKey.provider,
        validatedKey.key,
        validatedKey.encrypted ? 1 : 0,
        validatedKey.iv || null,
        validatedKey.tag || null,
        validatedKey.salt || null,
        validatedKey.isDefault ? 1 : 0,
        validatedKey.isActive ? 1 : 0,
        validatedKey.environment,
        validatedKey.description || null,
        validatedKey.expiresAt || null,
        validatedKey.lastUsed || null,
        now,
        validatedKey.id
      )
    } else {
      // Insert
      const insertQuery = database.prepare(`
        INSERT INTO provider_keys (
          id, name, provider, key, encrypted, iv, tag, salt,
          is_default, is_active, environment, description,
          expires_at, last_used, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      insertQuery.run(
        validatedKey.id,
        validatedKey.name,
        validatedKey.provider,
        validatedKey.key,
        validatedKey.encrypted ? 1 : 0,
        validatedKey.iv || null,
        validatedKey.tag || null,
        validatedKey.salt || null,
        validatedKey.isDefault ? 1 : 0,
        validatedKey.isActive ? 1 : 0,
        validatedKey.environment,
        validatedKey.description || null,
        validatedKey.expiresAt || null,
        validatedKey.lastUsed || null,
        validatedKey.created || now,
        now
      )
    }

    return validatedKey
  },

  /** Deletes a provider key. */
  async deleteProviderKey(keyId: number): Promise<boolean> {
    const db = getDb()
    const database = db.getDatabase()

    const deleteQuery = database.prepare(`DELETE FROM provider_keys WHERE id = ?`)
    const result = deleteQuery.run(keyId)

    return result.changes > 0
  },

  /** Gets all provider keys for a specific provider. */
  async getKeysByProvider(provider: string): Promise<ProviderKey[]> {
    const db = getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT 
        id, name, provider, key, encrypted, iv, tag, salt,
        is_default, is_active, environment, description,
        expires_at, last_used, created_at, updated_at
      FROM provider_keys
      WHERE provider = ?
      ORDER BY created_at DESC
    `)

    const rows = query.all(provider) as any[]

    const keys: ProviderKey[] = []
    for (const row of rows) {
      const key: ProviderKey = {
        id: row.id,
        name: row.name,
        provider: row.provider,
        key: row.key,
        encrypted: Boolean(row.encrypted),
        iv: row.iv,
        tag: row.tag,
        salt: row.salt,
        isDefault: Boolean(row.is_default),
        isActive: Boolean(row.is_active),
        environment: row.environment,
        description: row.description || undefined,
        expiresAt: row.expires_at || undefined,
        lastUsed: row.last_used || undefined,
        created: row.created_at,
        updated: row.updated_at
      }

      // Validate before adding
      try {
        const validatedKey = await validateData(key, ProviderKeySchema, `provider key ${row.id}`)
        keys.push(validatedKey)
      } catch (error) {
        console.error(`Skipping invalid provider key ${row.id}:`, error)
      }
    }

    return keys
  },

  /** Gets all active provider keys. */
  async getActiveKeys(): Promise<ProviderKey[]> {
    const db = getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT 
        id, name, provider, key, encrypted, iv, tag, salt,
        is_default, is_active, environment, description,
        expires_at, last_used, created_at, updated_at
      FROM provider_keys
      WHERE is_active = 1
      ORDER BY created_at DESC
    `)

    const rows = query.all() as any[]

    const keys: ProviderKey[] = []
    for (const row of rows) {
      const key: ProviderKey = {
        id: row.id,
        name: row.name,
        provider: row.provider,
        key: row.key,
        encrypted: Boolean(row.encrypted),
        iv: row.iv,
        tag: row.tag,
        salt: row.salt,
        isDefault: Boolean(row.is_default),
        isActive: Boolean(row.is_active),
        environment: row.environment,
        description: row.description || undefined,
        expiresAt: row.expires_at || undefined,
        lastUsed: row.last_used || undefined,
        created: row.created_at,
        updated: row.updated_at
      }

      // Validate before adding
      try {
        const validatedKey = await validateData(key, ProviderKeySchema, `provider key ${row.id}`)
        keys.push(validatedKey)
      } catch (error) {
        console.error(`Skipping invalid provider key ${row.id}:`, error)
      }
    }

    return keys
  },

  /** Gets provider keys created within a date range. */
  async getKeysByDateRange(startTime: number, endTime: number): Promise<ProviderKey[]> {
    const db = getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT 
        id, name, provider, key, encrypted, iv, tag, salt,
        is_default, is_active, environment, description,
        expires_at, last_used, created_at, updated_at
      FROM provider_keys
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `)

    const rows = query.all(startTime, endTime) as any[]

    const keys: ProviderKey[] = []
    for (const row of rows) {
      const key: ProviderKey = {
        id: row.id,
        name: row.name,
        provider: row.provider,
        key: row.key,
        encrypted: Boolean(row.encrypted),
        iv: row.iv,
        tag: row.tag,
        salt: row.salt,
        isDefault: Boolean(row.is_default),
        isActive: Boolean(row.is_active),
        environment: row.environment,
        description: row.description || undefined,
        expiresAt: row.expires_at || undefined,
        lastUsed: row.last_used || undefined,
        created: row.created_at,
        updated: row.updated_at
      }

      // Validate before adding
      try {
        const validatedKey = await validateData(key, ProviderKeySchema, `provider key ${row.id}`)
        keys.push(validatedKey)
      } catch (error) {
        console.error(`Skipping invalid provider key ${row.id}:`, error)
      }
    }

    return keys
  },

  /** Counts provider keys by provider. */
  async countKeysByProvider(provider: string): Promise<number> {
    const db = getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT COUNT(*) as count
      FROM provider_keys
      WHERE provider = ?
    `)

    const result = query.get(provider) as { count: number }
    return result.count
  },

  /** Generates a unique ID for provider keys. */
  generateId: (): number => {
    const db = getDb()
    return db.generateUniqueId('provider_keys')
  }
}
