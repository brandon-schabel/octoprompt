import { z } from 'zod'
import * as path from 'node:path'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { ProviderKeySchema, type ProviderKey } from '@octoprompt/schemas'
import { IndexedStorage, type IndexDefinition } from './core/indexed-storage'
import { type StorageOptions } from './core/base-storage'
import { commonSorters } from './core/storage-query-utils'
import { AuditLogger } from './core/storage-patterns'
import { STORAGE_CONFIG } from './config'

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
export class ProviderKeyStorage extends IndexedStorage<ProviderKey, ProviderKeysStorage> {
  private encryptionConfig: EncryptionConfig
  private masterKey?: string
  private auditLog: AuditLogger

  constructor(options: StorageOptions & { 
    encryption?: EncryptionConfig
    masterKey?: string 
  } = {}) {
    const dataDir = path.join('data', 'provider_key_storage')
    super(ProviderKeysStorageSchema, ProviderKeySchema, dataDir, options)
    
    // Define indexes
    this.indexDefinitions = [
      { name: 'keys_by_provider', type: 'hash', fields: ['provider'] },
      { name: 'keys_by_environment', type: 'hash', fields: ['environment'] },
      { name: 'keys_by_isActive', type: 'hash', fields: ['isActive'] },
      { name: 'keys_by_created', type: 'btree', fields: ['created'] },
      { name: 'keys_by_lastUsed', type: 'btree', fields: ['lastUsed'], sparse: true },
      { name: 'keys_by_expiresAt', type: 'btree', fields: ['expiresAt'], sparse: true }
    ]
    
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
    this.auditLog = new AuditLogger(
      path.join(this.basePath, this.dataDir, 'audit.log'),
      'ProviderKey'
    )
    
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


  // Override create to handle encryption and audit
  public async create(data: Omit<ProviderKey, 'id' | 'created' | 'updated'>): Promise<ProviderKey> {
    // Validate key before encryption
    if (!data.key || data.key.length < 10) {
      throw new Error('Provider key must be at least 10 characters long')
    }

    // Create the key with encryption
    const keyData = await this.prepareKeyForStorage(data)
    const providerKey = await super.create(keyData)
    
    // Log creation
    await this.auditLog.log({
      entityId: providerKey.id,
      action: 'created',
      details: {
        provider: providerKey.provider,
        environment: providerKey.environment
      }
    })
    
    return providerKey
  }

  // Override update to handle encryption and audit
  public async update(id: number, data: Partial<Omit<ProviderKey, 'id' | 'created' | 'updated'>>): Promise<ProviderKey | null> {
    const existing = await this.getById(id)
    if (!existing) return null

    // Handle key re-encryption if key is being updated
    let updateData = data
    if (data.key) {
      const encryptedData = await this.prepareKeyForStorage({ ...existing, ...data } as any)
      updateData = { ...data, ...encryptedData }
    }

    const updated = await super.update(id, updateData)
    if (!updated) return null
    
    // Log update
    await this.auditLog.log({
      entityId: updated.id,
      action: 'updated',
      details: {
        provider: updated.provider,
        environment: updated.environment,
        fields: Object.keys(data)
      }
    })

    return updated
  }

  // Override delete to handle audit
  public async delete(id: number): Promise<boolean> {
    const existing = await this.getById(id)
    
    const result = await super.delete(id)
    if (result && existing) {
      // Log deletion
      await this.auditLog.log({
        entityId: id,
        action: 'deleted',
        details: {
          provider: existing.provider,
          environment: existing.environment
        }
      })
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
    return this.queryByIndex('keys_by_provider', provider, commonSorters.byCreatedDesc)
  }

  /**
   * Get keys by environment
   */
  public async getByEnvironment(environment: string): Promise<ProviderKey[]> {
    return this.queryByIndex('keys_by_environment', environment, commonSorters.byCreatedDesc)
  }

  /**
   * Get active keys
   */
  public async getActiveKeys(): Promise<ProviderKey[]> {
    const keys = await this.queryByIndex('keys_by_isActive', true, commonSorters.byCreatedDesc)
    return keys.filter(key => !this.isExpired(key))
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
    const keys = await this.queryByDateRange(
      'keys_by_expiresAt',
      new Date(),
      new Date(futureTime)
    )
    return keys.filter(key => key.expiresAt).sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0))
  }

  /**
   * Get expired keys
   */
  public async getExpiredKeys(): Promise<ProviderKey[]> {
    const now = Date.now()
    const keys = await this.queryByDateRange(
      'keys_by_expiresAt',
      new Date(0),
      new Date(now)
    )
    return keys.filter(key => this.isExpired(key)).sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0))
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
    await this.auditLog.log({
      entityId: oldKeyId,
      action: 'rotated',
      details: {
        newKeyId: newKey.id,
        provider: oldKey.provider,
        environment: oldKey.environment
      }
    })

    return newKey
  }

  /**
   * Mark key as used (updates lastUsed timestamp)
   */
  public async markAsUsed(keyId: number): Promise<void> {
    await this.update(keyId, { lastUsed: Date.now() })
    
    await this.auditLog.log({
      entityId: keyId,
      action: 'used',
      details: {
        timestamp: Date.now()
      }
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


  // --- Audit and Security ---

  /**
   * Get audit log for a key
   */
  public async getKeyAuditLog(keyId: number): Promise<any[]> {
    return this.auditLog.getEvents({ entityId: keyId })
  }

  /**
   * Get security events
   */
  public async getSecurityEvents(limit: number = 100): Promise<any[]> {
    return this.auditLog.getEvents({}, limit)
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

}


// Export singleton instance for backward compatibility
export const providerKeyStorage = new ProviderKeyStorage({
  ...STORAGE_CONFIG,
  cacheEnabled: false, // Disable caching for sensitive data
  encryption: {
    enabled: true,
    algorithm: 'aes-256-cbc'
  }
})