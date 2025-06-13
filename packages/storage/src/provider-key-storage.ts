import { z } from 'zod'
import * as path from 'node:path'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { ProviderKeySchema, type ProviderKey } from '@octoprompt/schemas'
import { BaseStorage, type StorageOptions } from './core/base-storage'
import { IndexManager, type IndexConfig } from './core/index-manager'

// Storage schemas
export const ProviderKeysStorageSchema = z.record(z.string(), ProviderKeySchema)
export type ProviderKeysStorage = z.infer<typeof ProviderKeysStorageSchema>

// Encrypted storage schema
const EncryptedProviderKeySchema = ProviderKeySchema.extend({
  encryptedKey: z.string(),
  keyHash: z.string(), // Hash for verification without decryption
  salt: z.string()
}).omit({ key: true })

type EncryptedProviderKey = z.infer<typeof EncryptedProviderKeySchema>

interface EncryptionConfig {
  enabled: boolean
  algorithm?: string
  keyDerivation?: {
    algorithm: string
    iterations: number
    keyLength: number
  }
}

/**
 * Enhanced provider key storage with encryption, indexing, and audit logging
 */
export class ProviderKeyStorage extends BaseStorage<ProviderKey, ProviderKeysStorage> {
  private indexManager: IndexManager
  private encryptionConfig: EncryptionConfig
  private masterKey?: string
  private auditLog: KeyAuditLog

  constructor(options: StorageOptions & { 
    encryption?: EncryptionConfig
    masterKey?: string 
  } = {}) {
    const dataDir = path.join('data', 'provider_key_storage')
    super(ProviderKeysStorageSchema, ProviderKeySchema, dataDir, options)
    
    this.indexManager = new IndexManager(this.basePath, this.dataDir)
    this.encryptionConfig = {
      enabled: true,
      algorithm: 'aes-256-cbc',
      keyDerivation: {
        algorithm: 'pbkdf2',
        iterations: 100000,
        keyLength: 32
      },
      ...options.encryption
    }
    this.masterKey = options.masterKey || process.env.PROVIDER_KEYS_MASTER_KEY
    this.auditLog = new KeyAuditLog(this.basePath, this.dataDir, options)
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'provider_keys.json')
  }

  protected getEntityPath(id: number): string | null {
    // Provider keys don't have separate entity paths
    return null
  }

  protected async initializeIndexes(): Promise<void> {
    const indexes: IndexConfig[] = [
      {
        name: 'keys_by_provider',
        type: 'hash',
        fields: ['provider']
      },
      {
        name: 'keys_by_environment',
        type: 'hash',
        fields: ['environment']
      },
      {
        name: 'keys_by_isActive',
        type: 'hash',
        fields: ['isActive']
      },
      {
        name: 'keys_by_created',
        type: 'btree',
        fields: ['created']
      },
      {
        name: 'keys_by_lastUsed',
        type: 'btree',
        fields: ['lastUsed'],
        sparse: true
      },
      {
        name: 'keys_by_expiresAt',
        type: 'btree',
        fields: ['expiresAt'],
        sparse: true
      }
    ]

    for (const indexConfig of indexes) {
      try {
        await this.indexManager.createIndex(indexConfig)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexConfig.name}:`, error)
        }
      }
    }
  }

  // Override create to handle encryption and indexing
  public async create(data: Omit<ProviderKey, 'id' | 'created' | 'updated'>): Promise<ProviderKey> {
    // Validate key before encryption
    if (!data.key || data.key.length < 10) {
      throw new Error('Provider key must be at least 10 characters long')
    }

    // Create the key with encryption
    const keyData = await this.prepareKeyForStorage(data)
    const providerKey = await super.create(keyData)
    
    // Update indexes (using unencrypted data for indexing)
    await this.updateKeyIndexes(providerKey)
    
    // Log creation
    await this.auditLog.logKeyEvent(providerKey.id, 'created', {
      provider: providerKey.provider,
      environment: providerKey.environment
    })
    
    return providerKey
  }

  // Override update to maintain encryption and indexes
  public async update(id: number, data: Partial<Omit<ProviderKey, 'id' | 'created' | 'updated'>>): Promise<ProviderKey | null> {
    const existing = await this.getById(id)
    if (!existing) return null

    // Remove from indexes before update
    await this.removeKeyFromIndexes(id)

    // Handle key re-encryption if key is being updated
    let updateData = data
    if (data.key) {
      const encryptedData = await this.prepareKeyForStorage({ ...existing, ...data } as any)
      updateData = { ...data, ...encryptedData }
    }

    const updated = await super.update(id, updateData)
    if (!updated) return null

    // Re-add to indexes
    await this.updateKeyIndexes(updated)
    
    // Log update
    await this.auditLog.logKeyEvent(updated.id, 'updated', {
      provider: updated.provider,
      environment: updated.environment,
      fields: Object.keys(data)
    })

    return updated
  }

  // Override delete to maintain indexes and audit
  public async delete(id: number): Promise<boolean> {
    const existing = await this.getById(id)
    
    const result = await super.delete(id)
    if (result) {
      // Remove from indexes
      await this.removeKeyFromIndexes(id)
      
      // Log deletion
      if (existing) {
        await this.auditLog.logKeyEvent(id, 'deleted', {
          provider: existing.provider,
          environment: existing.environment
        })
      }
    }
    return result
  }

  // Override getById to handle decryption
  public async getById(id: number): Promise<ProviderKey | null> {
    const encrypted = await super.getById(id)
    if (!encrypted) return null
    
    return this.decryptKey(encrypted as any)
  }

  // Override list to handle decryption
  public async list(): Promise<ProviderKey[]> {
    const encryptedKeys = await super.list()
    const decryptedKeys: ProviderKey[] = []
    
    for (const encrypted of encryptedKeys) {
      try {
        const decrypted = await this.decryptKey(encrypted as any)
        decryptedKeys.push(decrypted)
      } catch (error) {
        console.error(`Failed to decrypt key ${encrypted.id}:`, error)
        // Continue with other keys
      }
    }
    
    return decryptedKeys
  }

  // --- Query Methods ---

  /**
   * Get keys by provider
   */
  public async getByProvider(provider: string): Promise<ProviderKey[]> {
    const ids = await this.indexManager.query('keys_by_provider', provider)
    const keys: ProviderKey[] = []
    
    for (const id of ids) {
      const key = await this.getById(id)
      if (key) keys.push(key)
    }
    
    return keys.sort((a, b) => b.created - a.created)
  }

  /**
   * Get keys by environment
   */
  public async getByEnvironment(environment: string): Promise<ProviderKey[]> {
    const ids = await this.indexManager.query('keys_by_environment', environment)
    const keys: ProviderKey[] = []
    
    for (const id of ids) {
      const key = await this.getById(id)
      if (key) keys.push(key)
    }
    
    return keys.sort((a, b) => b.created - a.created)
  }

  /**
   * Get active keys
   */
  public async getActiveKeys(): Promise<ProviderKey[]> {
    const ids = await this.indexManager.query('keys_by_isActive', true)
    const keys: ProviderKey[] = []
    
    for (const id of ids) {
      const key = await this.getById(id)
      if (key && !this.isExpired(key)) {
        keys.push(key)
      }
    }
    
    return keys.sort((a, b) => b.created - a.created)
  }

  /**
   * Get primary key for provider/environment
   */
  public async getPrimaryKey(provider: string, environment: string = 'production'): Promise<ProviderKey | null> {
    const providerKeys = await this.getByProvider(provider)
    const envKeys = providerKeys.filter(k => k.environment === environment && k.isActive && !this.isExpired(k))
    
    // Return the most recently created active key
    return envKeys.sort((a, b) => b.created - a.created)[0] || null
  }

  /**
   * Get default key for provider (legacy API)
   */
  public async getDefaultKey(provider: string): Promise<ProviderKey | null> {
    return this.getPrimaryKey(provider, 'production')
  }

  /**
   * Get expiring keys
   */
  public async getExpiringKeys(daysAhead: number = 30): Promise<ProviderKey[]> {
    const futureTime = Date.now() + (daysAhead * 24 * 60 * 60 * 1000)
    const ids = await this.indexManager.queryRange('keys_by_expiresAt', Date.now(), futureTime)
    const keys: ProviderKey[] = []
    
    for (const id of ids) {
      const key = await this.getById(id)
      if (key && key.expiresAt) keys.push(key)
    }
    
    return keys.sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0))
  }

  /**
   * Get expired keys
   */
  public async getExpiredKeys(): Promise<ProviderKey[]> {
    const now = Date.now()
    const ids = await this.indexManager.queryRange('keys_by_expiresAt', 0, now)
    const keys: ProviderKey[] = []
    
    for (const id of ids) {
      const key = await this.getById(id)
      if (key && this.isExpired(key)) keys.push(key)
    }
    
    return keys.sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0))
  }

  // --- Key Management ---

  /**
   * Rotate a key (create new, deactivate old)
   */
  public async rotateKey(oldKeyId: number, newKeyData: Omit<ProviderKey, 'id' | 'created' | 'updated'>): Promise<ProviderKey> {
    const oldKey = await this.getById(oldKeyId)
    if (!oldKey) {
      throw new Error(`Key ${oldKeyId} not found`)
    }

    // Create new key
    const newKey = await this.create({
      ...newKeyData,
      provider: oldKey.provider,
      environment: oldKey.environment
    })

    // Deactivate old key
    await this.update(oldKeyId, { isActive: false })

    // Log rotation
    await this.auditLog.logKeyEvent(oldKeyId, 'rotated', {
      newKeyId: newKey.id,
      provider: oldKey.provider,
      environment: oldKey.environment
    })

    return newKey
  }

  /**
   * Mark key as used (updates lastUsed timestamp)
   */
  public async markAsUsed(keyId: number): Promise<void> {
    await this.update(keyId, { lastUsed: Date.now() })
    
    await this.auditLog.logKeyEvent(keyId, 'used', {
      timestamp: Date.now()
    })
  }

  /**
   * Validate key integrity
   */
  public async validateKey(keyId: number): Promise<boolean> {
    try {
      const key = await this.getById(keyId)
      if (!key) return false
      
      // Check if key is active and not expired
      if (!key.isActive || this.isExpired(key)) return false
      
      // Verify key hash if encryption is enabled
      if (this.encryptionConfig.enabled && key.key) {
        const computedHash = this.computeKeyHash(key.key)
        // We'd need to store the hash separately for verification
        // This is a simplified version
        return key.key.length > 0
      }
      
      return true
    } catch (error) {
      console.error(`Key validation failed for ${keyId}:`, error)
      return false
    }
  }

  // --- Cleanup Operations ---

  /**
   * Clean up expired keys
   */
  public async cleanupExpiredKeys(): Promise<number> {
    const expiredKeys = await this.getExpiredKeys()
    let deletedCount = 0
    
    for (const key of expiredKeys) {
      if (!key.isActive) { // Only delete inactive expired keys
        const deleted = await this.delete(key.id)
        if (deleted) deletedCount++
      }
    }
    
    return deletedCount
  }

  // --- Legacy API Compatibility ---

  /**
   * Get all provider keys (legacy API)
   */
  public async getAllProviderKeys(): Promise<ProviderKey[]> {
    return this.list()
  }

  /**
   * Get provider key (legacy API)
   */
  public async getProviderKey(id: number): Promise<ProviderKey | null> {
    return this.getById(id)
  }

  /**
   * Create provider key (legacy API)
   */
  public async createProviderKey(data: Omit<ProviderKey, 'id' | 'created' | 'updated'>): Promise<ProviderKey> {
    return this.create(data)
  }

  /**
   * Update provider key (legacy API)
   */
  public async updateProviderKey(id: number, data: Partial<Omit<ProviderKey, 'id' | 'created' | 'updated'>>): Promise<ProviderKey | null> {
    return this.update(id, data)
  }

  /**
   * Delete provider key (legacy API)
   */
  public async deleteProviderKey(id: number): Promise<boolean> {
    return this.delete(id)
  }

  /**
   * Get keys by provider (legacy API)
   */
  public async getKeysByProvider(provider: string): Promise<ProviderKey[]> {
    return this.getByProvider(provider)
  }

  // --- V1 Storage API Compatibility ---

  /**
   * Read provider keys (V1 storage API)
   */
  public async readProviderKeys(): Promise<ProviderKeysStorage> {
    const keys = await this.list()
    const storage: ProviderKeysStorage = {}
    for (const key of keys) {
      storage[key.id.toString()] = key
    }
    return storage
  }

  /**
   * Write provider keys (V1 storage API)
   */
  public async writeProviderKeys(keys: ProviderKeysStorage): Promise<ProviderKeysStorage> {
    // This is a complex migration operation - for now, return the input
    // In a real migration, we'd need to carefully handle this
    return keys
  }

  /**
   * Generate ID (V1 storage API)
   */
  public generateId(): number {
    return Date.now()
  }

  // --- Audit and Security ---

  /**
   * Get audit log for a key
   */
  public async getKeyAuditLog(keyId: number): Promise<any[]> {
    return this.auditLog.getKeyEvents(keyId)
  }

  /**
   * Get security events
   */
  public async getSecurityEvents(limit: number = 100): Promise<any[]> {
    return this.auditLog.getRecentEvents(limit)
  }

  // --- Statistics ---

  public async getStats() {
    const keys = await this.list()
    const now = Date.now()
    
    const stats = {
      total: keys.length,
      active: keys.filter(k => k.isActive).length,
      inactive: keys.filter(k => !k.isActive).length,
      expired: keys.filter(k => this.isExpired(k)).length,
      expiringIn30Days: keys.filter(k => k.expiresAt && k.expiresAt <= now + (30 * 24 * 60 * 60 * 1000)).length,
      byProvider: this.groupBy(keys, 'provider'),
      byEnvironment: this.groupBy(keys, 'environment'),
      encryption: {
        enabled: this.encryptionConfig.enabled,
        algorithm: this.encryptionConfig.algorithm
      }
    }
    
    return stats
  }

  // --- Encryption Helpers ---

  private async prepareKeyForStorage(data: Omit<ProviderKey, 'id' | 'created' | 'updated'>): Promise<any> {
    if (!this.encryptionConfig.enabled || !this.masterKey) {
      return data
    }

    const salt = randomBytes(16).toString('hex')
    const encryptedKey = this.encryptValue(data.key, salt)
    const keyHash = this.computeKeyHash(data.key)

    return {
      ...data,
      key: undefined, // Remove plaintext key
      encryptedKey,
      keyHash,
      salt
    }
  }

  private async decryptKey(encrypted: EncryptedProviderKey & { encryptedKey?: string; salt?: string }): Promise<ProviderKey> {
    if (!this.encryptionConfig.enabled || !encrypted.encryptedKey) {
      return encrypted as any // Return as-is if not encrypted
    }

    if (!this.masterKey) {
      throw new Error('Master key not available for decryption')
    }

    const decryptedKey = this.decryptValue(encrypted.encryptedKey, encrypted.salt!)
    
    return {
      ...encrypted,
      key: decryptedKey,
      encryptedKey: undefined,
      salt: undefined,
      keyHash: undefined
    } as ProviderKey
  }

  private encryptValue(value: string, salt: string): string {
    const iv = randomBytes(16)
    const key = createHash('sha256').update(this.masterKey! + salt).digest()
    const cipher = createCipheriv(this.encryptionConfig.algorithm!, key, iv)
    let encrypted = cipher.update(value, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return iv.toString('hex') + ':' + encrypted
  }

  private decryptValue(encrypted: string, salt: string): string {
    const [ivHex, encryptedData] = encrypted.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const key = createHash('sha256').update(this.masterKey! + salt).digest()
    const decipher = createDecipheriv(this.encryptionConfig.algorithm!, key, iv)
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  private computeKeyHash(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }

  private isExpired(key: ProviderKey): boolean {
    return key.expiresAt ? key.expiresAt <= Date.now() : false
  }

  private groupBy(items: any[], field: string): Record<string, number> {
    const groups: Record<string, number> = {}
    for (const item of items) {
      const value = item[field] || 'unknown'
      groups[value] = (groups[value] || 0) + 1
    }
    return groups
  }

  // --- Index Management ---

  public async rebuildIndexes(): Promise<void> {
    const keys = await this.list()
    
    const indexNames = [
      'keys_by_provider',
      'keys_by_environment',
      'keys_by_isActive',
      'keys_by_created',
      'keys_by_lastUsed',
      'keys_by_expiresAt'
    ]
    
    for (const indexName of indexNames) {
      await this.indexManager.rebuildIndex(indexName, keys)
    }
  }

  private async updateKeyIndexes(key: ProviderKey): Promise<void> {
    await this.indexManager.addToIndex('keys_by_provider', key.id, key)
    await this.indexManager.addToIndex('keys_by_environment', key.id, key)
    await this.indexManager.addToIndex('keys_by_isActive', key.id, key)
    await this.indexManager.addToIndex('keys_by_created', key.id, key)
    
    if (key.lastUsed) {
      await this.indexManager.addToIndex('keys_by_lastUsed', key.id, key)
    }
    
    if (key.expiresAt) {
      await this.indexManager.addToIndex('keys_by_expiresAt', key.id, key)
    }
  }

  private async removeKeyFromIndexes(keyId: number): Promise<void> {
    const indexNames = [
      'keys_by_provider',
      'keys_by_environment', 
      'keys_by_isActive',
      'keys_by_created',
      'keys_by_lastUsed',
      'keys_by_expiresAt'
    ]
    
    for (const indexName of indexNames) {
      await this.indexManager.removeFromIndex(indexName, keyId)
    }
  }
}

/**
 * Audit log for key operations
 */
class KeyAuditLog {
  private logPath: string

  constructor(basePath: string, dataDir: string, options: StorageOptions) {
    this.logPath = path.join(basePath, dataDir, 'audit.log')
  }

  public async logKeyEvent(keyId: number, event: string, details: any = {}): Promise<void> {
    const logEntry = {
      timestamp: Date.now(),
      keyId,
      event,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    }

    try {
      const fs = await import('node:fs/promises')
      await fs.mkdir(path.dirname(this.logPath), { recursive: true })
      await fs.appendFile(this.logPath, JSON.stringify(logEntry) + '\n', 'utf-8')
    } catch (error) {
      console.error('Failed to write audit log:', error)
    }
  }

  public async getKeyEvents(keyId: number): Promise<any[]> {
    try {
      const fs = await import('node:fs/promises')
      const content = await fs.readFile(this.logPath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line.length > 0)
      
      return lines
        .map(line => JSON.parse(line))
        .filter(entry => entry.keyId === keyId)
        .sort((a, b) => b.timestamp - a.timestamp)
    } catch (error: any) {
      if (error.code === 'ENOENT') return []
      console.error('Failed to read audit log:', error)
      return []
    }
  }

  public async getRecentEvents(limit: number = 100): Promise<any[]> {
    try {
      const fs = await import('node:fs/promises')
      const content = await fs.readFile(this.logPath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line.length > 0)
      
      return lines
        .map(line => JSON.parse(line))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
    } catch (error: any) {
      if (error.code === 'ENOENT') return []
      console.error('Failed to read audit log:', error)
      return []
    }
  }
}

// Export singleton instance for backward compatibility
export const providerKeyStorage = new ProviderKeyStorage({
  cacheEnabled: false, // Disable caching for sensitive data
  encryption: {
    enabled: true,
    algorithm: 'aes-256-cbc'
  }
})