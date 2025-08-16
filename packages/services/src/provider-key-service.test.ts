import { describe, test, expect, beforeEach, mock } from 'bun:test'

import type { ProviderKeysStorage } from '@promptliano/storage' // ADDED
import { ApiError } from '@promptliano/shared'
import { normalizeToUnixMs } from '@promptliano/shared'
import { createProviderKeyService } from './provider-key-service'

// In-memory store for our mock
let mockProviderKeysDb: ProviderKeysStorage = {}

// Mock the crypto functions to return plain text for testing
mock.module('@promptliano/shared/src/utils/crypto', () => ({
  encryptKey: async (plaintext: string) => ({
    encrypted: plaintext, // Store plain text for testing
    iv: 'mock-iv',
    tag: 'mock-tag',
    salt: 'mock-salt'
  }),
  decryptKey: async (data: any) => data.encrypted || data.key,
  generateEncryptionKey: () => 'mock-encryption-key',
  isEncrypted: (value: any) => {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof value.encrypted === 'string' &&
      typeof value.iv === 'string' &&
      typeof value.tag === 'string' &&
      typeof value.salt === 'string'
    )
  }
}))

// Mock the providerKeyStorage utility
// Ensure the path to the module is correct based on your project structure.
// If provider-key-storage.ts is in '@promptliano/storage/', this path should be correct.
mock.module('@promptliano/storage', () => ({
  providerKeyStorage: {
    readProviderKeys: async () => JSON.parse(JSON.stringify(mockProviderKeysDb)),
    writeProviderKeys: async (data: ProviderKeysStorage) => {
      mockProviderKeysDb = JSON.parse(JSON.stringify(data))
      return mockProviderKeysDb
    },
    // Ensure the mocked generateId matches the one in the actual module or is sufficient for tests
    generateId: () => normalizeToUnixMs(new Date())
  },
  encryptionKeyStorage: {
    getKey: () => 'mock-encryption-key',
    hasKey: () => true,
    clearCache: () => {}
  }
}))

let svc: ReturnType<typeof createProviderKeyService>

describe('provider-key-service (File Storage)', () => {
  beforeEach(async () => {
    mockProviderKeysDb = {} // Reset in-memory store before each test
    svc = createProviderKeyService()
  })

  test('createKey inserts new provider key', async () => {
    const input = { provider: 'openai', key: 'test-api-key', name: 'openai', isDefault: false }
    const pk = await svc.createKey(input)

    expect(pk.id).toBeDefined()
    expect(pk.provider).toBe(input.provider)
    expect(pk.key).toBe(input.key) // With our mock, it returns plain text
    expect(pk.encrypted).toBe(true)
    expect(pk.iv).toBe('mock-iv')
    expect(pk.tag).toBe('mock-tag')
    expect(pk.salt).toBe('mock-salt')
    expect(pk.created).toBeDefined()
    expect(pk.updated).toBeDefined()
    expect(pk.created).toEqual(pk.updated) // Initially, they should be the same

    // Verify it's in our mock DB
    expect(mockProviderKeysDb[pk.id]).toEqual(pk)
  })

  test('listKeysCensoredKeys returns all provider keys with masked keys, sorted by provider then by createdAt DESC', async () => {
    // Create keys with different lengths to test masking logic
    const pkC = await svc.createKey({
      provider: 'zeta_provider',
      key: 'sk-1234567890abcdef1234567890abcdef',
      name: 'zeta_provider',
      isDefault: false
    }) // Long key
    await new Promise((resolve) => setTimeout(resolve, 2))
    const pkA1 = await svc.createKey({
      provider: 'alpha_provider',
      key: 'short',
      name: 'alpha_provider',
      isDefault: false
    }) // Short key
    await new Promise((resolve) => setTimeout(resolve, 2))
    const pkB = await svc.createKey({
      provider: 'beta_provider',
      key: 'medium_length_key_123',
      name: 'beta_provider',
      isDefault: false
    }) // Medium key
    await new Promise((resolve) => setTimeout(resolve, 2))
    const pkA2 = await svc.createKey({
      provider: 'alpha_provider',
      key: 'gsk_1234567890abcdef1234567890abcdef1234',
      name: 'alpha_provider',
      isDefault: false
    }) // pkA2 is newer than pkA1

    const list = await svc.listKeysCensoredKeys()
    expect(list.length).toBe(4)

    // Expected order: alpha_provider (pkA2 then pkA1), beta_provider (pkB), zeta_provider (pkC)
    expect(list[0].id).toBe(pkA2.id) // alpha_provider, newest
    expect(list[0].provider).toBe('alpha_provider')
    expect(list[0].key).toBe('********') // All encrypted keys show as ********
    expect(list[1].id).toBe(pkA1.id) // alpha_provider, older
    expect(list[1].provider).toBe('alpha_provider')
    expect(list[1].key).toBe('********') // All encrypted keys show as ********
    expect(list[2].id).toBe(pkB.id) // beta_provider
    expect(list[2].provider).toBe('beta_provider')
    expect(list[2].key).toBe('********') // All encrypted keys show as ********
    expect(list[3].id).toBe(pkC.id) // zeta_provider
    expect(list[3].provider).toBe('zeta_provider')
    expect(list[3].key).toBe('********') // All encrypted keys show as ********
  })

  test('listKeysUncensored returns all provider keys with full keys, sorted by provider then by createdAt DESC', async () => {
    // Create the same keys as censored test for comparison
    const pkC = await svc.createKey({
      provider: 'zeta_provider',
      key: 'sk-1234567890abcdef1234567890abcdef',
      name: 'zeta_provider',
      isDefault: false
    })
    await new Promise((resolve) => setTimeout(resolve, 2))
    const pkA1 = await svc.createKey({
      provider: 'alpha_provider',
      key: 'short',
      name: 'alpha_provider',
      isDefault: false
    })
    await new Promise((resolve) => setTimeout(resolve, 2))
    const pkB = await svc.createKey({
      provider: 'beta_provider',
      key: 'medium_length_key_123',
      name: 'beta_provider',
      isDefault: false
    })
    await new Promise((resolve) => setTimeout(resolve, 2))
    const pkA2 = await svc.createKey({
      provider: 'alpha_provider',
      key: 'gsk_1234567890abcdef1234567890abcdef1234',
      name: 'alpha_provider',
      isDefault: false
    })

    const list = await svc.listKeysUncensored()
    expect(list.length).toBe(4)

    // Expected order: alpha_provider (pkA2 then pkA1), beta_provider (pkB), zeta_provider (pkC)
    expect(list[0].id).toBe(pkA2.id) // alpha_provider, newest
    expect(list[0].provider).toBe('alpha_provider')
    expect(list[0].key).toBe('gsk_1234567890abcdef1234567890abcdef1234') // Full key
    expect(list[1].id).toBe(pkA1.id) // alpha_provider, older
    expect(list[1].provider).toBe('alpha_provider')
    expect(list[1].key).toBe('short') // Full key
    expect(list[2].id).toBe(pkB.id) // beta_provider
    expect(list[2].provider).toBe('beta_provider')
    expect(list[2].key).toBe('medium_length_key_123') // Full key
    expect(list[3].id).toBe(pkC.id) // zeta_provider
    expect(list[3].provider).toBe('zeta_provider')
    expect(list[3].key).toBe('sk-1234567890abcdef1234567890abcdef') // Full key
  })

  test('censored vs uncensored keys have same structure but different key values', async () => {
    const testKey = 'sk-1234567890abcdef1234567890abcdef'
    await svc.createKey({ provider: 'openai', key: testKey, name: 'test-key', isDefault: false })

    const censoredList = await svc.listKeysCensoredKeys()
    const uncensoredList = await svc.listKeysUncensored()

    expect(censoredList.length).toBe(uncensoredList.length)
    expect(censoredList.length).toBe(1)

    const censored = censoredList[0]
    const uncensored = uncensoredList[0]

    // Same structure
    expect(censored.id).toBe(uncensored.id)
    expect(censored.provider).toBe(uncensored.provider)
    expect(censored.name).toBe(uncensored.name)
    expect(censored.isDefault).toBe(uncensored.isDefault)
    expect(censored.created).toBe(uncensored.created)
    expect(censored.updated).toBe(uncensored.updated)

    // Different key values
    expect(censored.key).toBe('********') // Encrypted keys show as ********
    expect(uncensored.key).toBe(testKey) // Full key
    expect(censored.key).not.toBe(uncensored.key)
  })

  test('key masking logic handles edge cases correctly', async () => {
    // Test various key lengths
    const veryShortKey = 'abc'
    const shortKey = 'abcdefgh' // Exactly 8 chars
    const mediumKey = 'abcdefghijk' // 11 chars
    const longKey = 'sk-1234567890abcdef1234567890abcdef' // 35 chars

    await svc.createKey({ provider: 'test1', key: veryShortKey, name: 'very-short', isDefault: false })
    await new Promise((resolve) => setTimeout(resolve, 2))
    await svc.createKey({ provider: 'test2', key: shortKey, name: 'short', isDefault: false })
    await new Promise((resolve) => setTimeout(resolve, 2))
    await svc.createKey({ provider: 'test3', key: mediumKey, name: 'medium', isDefault: false })
    await new Promise((resolve) => setTimeout(resolve, 2))
    await svc.createKey({ provider: 'test4', key: longKey, name: 'long', isDefault: false })

    const censoredList = await svc.listKeysCensoredKeys()
    expect(censoredList.length).toBe(4)

    // Find each key in the sorted list
    const veryShortResult = censoredList.find((k) => k.name === 'very-short')
    const shortResult = censoredList.find((k) => k.name === 'short')
    const mediumResult = censoredList.find((k) => k.name === 'medium')
    const longResult = censoredList.find((k) => k.name === 'long')

    // All encrypted keys show as ********
    expect(veryShortResult?.key).toBe('********')
    expect(shortResult?.key).toBe('********')
    expect(mediumResult?.key).toBe('********')
    expect(longResult?.key).toBe('********')
  })

  test('getKeyById returns key or null if not found', async () => {
    const created = await svc.createKey({
      provider: 'get_by_id_test',
      key: 'key123',
      name: 'get_by_id_test',
      isDefault: false
    })
    const found = await svc.getKeyById(created.id)
    expect(found).toBeDefined()
    expect(found?.id).toBe(created.id)
    expect(found?.key).toBe('key123')

    const missing = await svc.getKeyById(9999)
    expect(missing).toBeNull()
  })

  test('updateKey modifies existing row and updates timestamp', async () => {
    const created = await svc.createKey({
      provider: 'initial_provider',
      key: 'initial_key',
      name: 'initial_provider',
      isDefault: false
    })
    const originalUpdated = created.updated

    // Ensure a small delay for distinct timestamps
    await new Promise((resolve) => setTimeout(resolve, 5))

    const updates = { key: 'updated_key', provider: 'new_provider_name' }
    const updated = await svc.updateKey(created.id, updates)

    expect(updated).toBeDefined()
    expect(updated.id).toBe(created.id)
    expect(updated.key).toBe(updates.key)
    expect(updated.provider).toBe(updates.provider)
    expect(updated.created).toBe(created.created) // created should not change
    expect(updated.updated).not.toBe(originalUpdated)
    expect(new Date(updated.updated).getTime()).toBeGreaterThan(new Date(originalUpdated).getTime())

    // Verify it's updated in our mock DB
    expect(mockProviderKeysDb[created.id]).toEqual(updated)

    // Test partial update (only key)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const keyOnlyUpdate = await svc.updateKey(created.id, { key: 'final_key_value' })
    expect(keyOnlyUpdate.key).toBe('final_key_value')
    expect(keyOnlyUpdate.provider).toBe(updates.provider) // Provider should persist from previous update
    expect(new Date(keyOnlyUpdate.updated).getTime()).toBeGreaterThan(new Date(updated.updated).getTime())
  })

  test('updateKey throws ApiError if key not found', async () => {
    await expect(svc.updateKey(9999, { key: 'some_key' })).rejects.toThrow(
      new ApiError(404, `Provider Key with ID 9999 not found`, 'PROVIDER_KEY_NOT_FOUND')
    )
  })

  test('deleteKey removes row, returns boolean indicating success', async () => {
    const created = await svc.createKey({
      provider: 'to_delete_provider',
      key: 'to_delete_key',
      name: 'to_delete_provider',
      isDefault: false
    })
    expect(mockProviderKeysDb[created.id]).toBeDefined() // Ensure it's there before delete

    const result1 = await svc.deleteKey(created.id)
    expect(result1).toBe(true)
    expect(mockProviderKeysDb[created.id]).toBeUndefined() // Ensure it's gone

    const result2 = await svc.deleteKey(created.id) // Try deleting again
    expect(result2).toBe(false)

    const result3 = await svc.deleteKey(9999) // Try deleting non-existent
    expect(result3).toBe(false)
  })
})
