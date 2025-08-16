import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient, PromptlianoError } from '../index'
import type { PromptlianoClient } from '../index'

import { ProviderKeySchema, type ProviderKey } from '@promptliano/schemas' // Path kept as is from original (note: this was different from others)
import { TEST_API_URL } from './test-config'

const BASE_URL = TEST_API_URL

describe('Provider Key API Tests', () => {
  let client: PromptlianoClient
  let testKeys: ProviderKey[] = []

  beforeAll(() => {
    console.log('Starting Provider Key API Tests...')
    client = createPromptlianoClient({ baseUrl: BASE_URL })
  })

  afterAll(async () => {
    console.log('Cleaning up provider key test data...')
    for (const key of testKeys) {
      try {
        await client.keys.deleteKey(key.id)
      } catch (err) {
        if (err instanceof PromptlianoError && err.statusCode === 404) {
          // Already deleted
        } else {
          console.error(`Failed to delete provider key ${key.id}:`, err)
        }
      }
    }
  })

  test('POST /api/keys - Create provider keys', async () => {
    const testKeyData = [
      { name: 'Test OpenAI Key', provider: 'openai' as const, key: `sk-test-${Date.now()}abcdef`, isDefault: false },
      {
        name: 'Test Anthropic Key',
        provider: 'anthropic' as const,
        key: `sk-ant-test-${Date.now()}`,
        isDefault: false
      },
      { name: 'Test Groq Key', provider: 'groq' as const, key: `gsk_test_${Date.now()}`, isDefault: false }
    ]

    for (const data of testKeyData) {
      const result = await client.keys.createKey(data)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(ProviderKeySchema.omit({ key: true }).safeParse(result.data).success).toBe(true) // Key is returned in full on create/get by ID
      expect(result.data.name).toBe(data.name)
      expect(result.data.provider).toBe(data.provider)
      expect(result.data.key).toBe(data.key) // Full key is returned on create
      expect(result.data.isDefault).toBe(data.isDefault)
      expect(result.data.id).toBeTypeOf('number')
      expect(result.data.created).toBeNumber()
      expect(result.data.updated).toBeNumber()

      testKeys.push(result.data)
    }
  })

  test('GET /api/keys - List all provider keys (should mask secrets)', async () => {
    const result = await client.keys.listKeys()

    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)

    for (const testKey of testKeys) {
      const found = result.data.find((k: ProviderKey) => k.id === testKey.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.name).toBe(testKey.name)
        expect(found.provider).toBe(testKey.provider)
        // Key should be masked in list view
        // For encrypted keys, the service returns '********'
        // For legacy unencrypted keys, it returns a pattern like 'sk-t****bcdef'
        if (found.key === '********') {
          // This is an encrypted key, which is expected
          expect(found.key).toBe('********')
        } else if (testKey.key.length > 8) {
          // Legacy masking pattern for unencrypted keys
          expect(found.key).toMatch(/^.{4}\*+.{4}$/)
        } else {
          expect(found.key).toBe('********') // Short keys also get fully masked
        }
        expect(found.isDefault).toBe(testKey.isDefault)
      }
    }
  })

  test('GET /api/keys/{keyId} - Get individual keys (should include full secret)', async () => {
    for (const key of testKeys) {
      const result = await client.keys.getKey(key.id)

      expect(result.success).toBe(true)
      expect(result.data.id).toBe(key.id)
      expect(result.data.name).toBe(key.name)
      expect(result.data.provider).toBe(key.provider)
      expect(result.data.key).toBe(key.key) // Full key
      expect(result.data.isDefault).toBe(key.isDefault)
    }
  })

  test('PATCH /api/keys/{keyId} - Update provider keys', async () => {
    const updates = [
      { name: 'Updated OpenAI Key', isDefault: false },
      { key: `sk-ant-updated-${Date.now()}` },
      { name: 'Updated Groq Key Name', isDefault: true }
    ]

    for (let i = 0; i < testKeys.length; i++) {
      const currentKey = testKeys[i]
      if (!currentKey) continue
      const updateData = updates[i]
      if (!updateData) continue

      const result = await client.keys.updateKey(currentKey.id, updateData)

      expect(result.success).toBe(true)
      const updatedKey = result.data
      if (updateData.name) expect(updatedKey.name).toBe(updateData.name)
      else expect(updatedKey.name).toBe(currentKey.name)

      if ('key' in updateData && updateData.key) expect(updatedKey.key).toBe(updateData.key)
      else expect(updatedKey.key).toBe(currentKey.key) // Key remains same if not in update

      if (updateData.isDefault !== undefined) expect(updatedKey.isDefault).toBe(updateData.isDefault)
      else expect(updatedKey.isDefault).toBe(currentKey.isDefault)

      expect(updatedKey.updated).toBeGreaterThanOrEqual(currentKey.updated)
      testKeys[i] = updatedKey // Update local copy
    }
  })

  test('GET /api/keys - Verify updates after PATCH and default key logic', async () => {
    const result = await client.keys.listKeys()
    expect(result.success).toBe(true)

    const keysByProvider: Record<string, ProviderKey[]> = {}
    for (const key of result.data) {
      if (!keysByProvider[key.provider]) {
        keysByProvider[key.provider] = []
      }
      keysByProvider[key.provider]!.push(key)
    }

    for (const provider in keysByProvider) {
      const providerKeys = keysByProvider[provider]!
      const defaultKeys = providerKeys.filter((k) => k.isDefault)
      expect(defaultKeys.length).toBeLessThanOrEqual(1) // Max one default per provider
    }

    // Verify local testKeys match the current state for name and isDefault
    for (const testKey of testKeys) {
      const found = result.data.find((k: ProviderKey) => k.id === testKey.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.name).toBe(testKey.name)
        expect(found.isDefault).toBe(testKey.isDefault)
      }
    }
  })

  test('DELETE /api/keys/{keyId} - Delete all test provider keys and verify', async () => {
    const keysToDelete = [...testKeys]
    testKeys = []

    for (const key of keysToDelete) {
      const success = await client.keys.deleteKey(key.id)
      expect(success).toBe(true)

      // Verify 404
      try {
        await client.keys.getKey(key.id)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(PromptlianoError)
        if (error instanceof PromptlianoError) {
          expect(error.statusCode).toBe(404)
          // Check specific error code if client provides it and API guarantees it
          // expect(error.errorCode).toBe('PROVIDER_KEY_NOT_FOUND')
        }
      }
    }
  })
})
