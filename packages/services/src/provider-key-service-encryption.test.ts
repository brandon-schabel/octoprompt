import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import { createProviderKeyService } from './provider-key-service'
import { providerKeyStorage, encryptionKeyStorage } from '@promptliano/storage'
import type { ProviderKey } from '@promptliano/schemas'

describe('Provider Key Service Encryption', () => {
  let service: ReturnType<typeof createProviderKeyService>
  const originalEnv = process.env.PROMPTLIANO_ENCRYPTION_KEY

  beforeAll(() => {
    // Clear env and cache for tests
    delete process.env.PROMPTLIANO_ENCRYPTION_KEY
    encryptionKeyStorage.clearCache()
  })

  afterAll(() => {
    // Restore original env if it existed
    if (originalEnv) {
      process.env.PROMPTLIANO_ENCRYPTION_KEY = originalEnv
    }
  })

  beforeEach(async () => {
    // Clear all keys before each test
    await providerKeyStorage.writeProviderKeys({})
    service = createProviderKeyService()
  })

  test('createKey encrypts the API key', async () => {
    const keyData = {
      name: 'Test Key',
      provider: 'openai',
      key: 'sk-test-12345'
    }

    const created = await service.createKey(keyData)

    // Check that the key is marked as encrypted
    expect(created.encrypted).toBe(true)
    expect(created.iv).toBeDefined()
    expect(created.tag).toBeDefined()
    expect(created.salt).toBeDefined()

    // The stored key should not be the plain text
    expect(created.key).not.toBe(keyData.key)

    // Read directly from storage to verify it's encrypted there too
    const stored = await providerKeyStorage.getProviderKeyById(created.id)
    expect(stored?.key).not.toBe(keyData.key)
    expect(stored?.encrypted).toBe(true)
  })

  test('getKeyById decrypts the API key', async () => {
    const keyData = {
      name: 'Test Key',
      provider: 'openai',
      key: 'sk-test-12345'
    }

    const created = await service.createKey(keyData)
    const retrieved = await service.getKeyById(created.id)

    expect(retrieved).not.toBeNull()
    expect(retrieved?.key).toBe(keyData.key) // Should be decrypted
  })

  test('listKeysUncensored decrypts all keys', async () => {
    const keys = [
      { name: 'Key 1', provider: 'openai', key: 'sk-test-111' },
      { name: 'Key 2', provider: 'anthropic', key: 'sk-ant-222' },
      { name: 'Key 3', provider: 'openrouter', key: 'or-333' }
    ]

    // Create all keys
    for (const keyData of keys) {
      await service.createKey(keyData)
    }

    // List uncensored should decrypt all
    const listed = await service.listKeysUncensored()
    expect(listed).toHaveLength(3)

    for (let i = 0; i < keys.length; i++) {
      const listedKey = listed.find(k => k.name === keys[i].name)
      expect(listedKey?.key).toBe(keys[i].key)
    }
  })

  test('listKeysCensoredKeys masks the keys', async () => {
    const keyData = {
      name: 'Test Key',
      provider: 'openai',
      key: 'sk-test-12345678901234567890'
    }

    await service.createKey(keyData)
    const listed = await service.listKeysCensoredKeys()

    expect(listed).toHaveLength(1)
    // Encrypted keys show generic mask
    expect(listed[0].key).toBe('********')
    expect(listed[0].key).not.toBe(keyData.key)
  })

  test('updateKey re-encrypts when key is changed', async () => {
    const originalKey = 'sk-test-original'
    const updatedKey = 'sk-test-updated'

    const created = await service.createKey({
      name: 'Test Key',
      provider: 'openai',
      key: originalKey
    })

    // Update the key
    const updated = await service.updateKey(created.id, {
      key: updatedKey
    })

    // Should have new encryption parameters
    expect(updated.encrypted).toBe(true)
    expect(updated.iv).not.toBe(created.iv)
    expect(updated.salt).not.toBe(created.salt)

    // Retrieve and verify the new key
    const retrieved = await service.getKeyById(created.id)
    expect(retrieved?.key).toBe(updatedKey)
  })

  test('handles mixed encrypted and unencrypted keys gracefully', async () => {
    // Manually insert an unencrypted key (simulating legacy data)
    const unencryptedKey: ProviderKey = {
      id: 1234567890,
      name: 'Legacy Key',
      provider: 'openai',
      key: 'sk-plain-text-key',
      encrypted: false,
      isDefault: false,
      created: Date.now(),
      updated: Date.now()
    }

    await providerKeyStorage.upsertProviderKey(unencryptedKey)

    // Create an encrypted key
    await service.createKey({
      name: 'New Key',
      provider: 'anthropic',
      key: 'sk-encrypted-key'
    })

    // List should handle both
    const listed = await service.listKeysUncensored()
    expect(listed).toHaveLength(2)

    const legacy = listed.find(k => k.name === 'Legacy Key')
    const newKey = listed.find(k => k.name === 'New Key')

    expect(legacy?.key).toBe('sk-plain-text-key')
    expect(newKey?.key).toBe('sk-encrypted-key')
  })
})