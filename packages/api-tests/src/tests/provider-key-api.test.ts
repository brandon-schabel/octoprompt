// Recent changes:
// 1. Initial creation of comprehensive provider key API test suite
// 2. Tests all provider key endpoints with proper cleanup
// 3. Uses Bun's HTTP client for requests
// 4. Follows create-verify-update-verify-delete pattern
// 5. Ensures no test data persists after completion

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { z } from 'zod'
import { apiFetch } from '../api-fetch'
import type { Endpoint } from '../types/endpoint'
import {
    ProviderKeySchema,
    type ProviderKey,
    CreateProviderKeyBodySchema,
    UpdateProviderKeyBodySchema,
    ProviderKeyResponseSchema,
    ProviderKeyListResponseSchema
} from 'shared/src/schemas/provider-key.schemas'
import { OperationSuccessResponseSchema } from 'shared/src/schemas/common.schemas'

const BASE_URL = process.env.API_URL || 'http://localhost:3147'
const API_URL = `${BASE_URL}/api`

describe('Provider Key API Tests', () => {
    let testKeys: ProviderKey[] = []

    beforeAll(() => {
        console.log('Starting Provider Key API Tests...')
    })

    afterAll(async () => {
        console.log('Cleaning up provider key test data...')
        for (const key of testKeys) {
            try {
                await fetch(`${API_URL}/keys/${key.id}`, { method: 'DELETE' })
            } catch (err) {
                console.error(`Failed to delete provider key ${key.id}:`, err)
            }
        }
    })

    test('POST /api/keys - Create provider keys', async () => {
        const testData = [
            {
                name: 'Test OpenAI Key',
                provider: 'openai' as const,
                key: 'sk-test-1234567890abcdef',
                isDefault: true
            },
            {
                name: 'Test Anthropic Key',
                provider: 'anthropic' as const,
                key: 'sk-ant-test-1234567890',
                isDefault: false
            },
            {
                name: 'Test Groq Key',
                provider: 'groq' as const,
                key: 'gsk_test_1234567890',
                isDefault: false
            }
        ]

        const createKeyEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/keys`,
            options: { method: 'POST' }
        }

        for (const data of testData) {
            const result = await apiFetch(createKeyEndpoint, data, ProviderKeyResponseSchema)

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            expect(result.data.name).toBe(data.name)
            expect(result.data.provider).toBe(data.provider)
            expect(result.data.key).toBe(data.key)
            expect(result.data.isDefault).toBe(data.isDefault)
            expect(result.data.id).toBeTypeOf('number')
            expect(result.data.created).toBeNumber()
            expect(result.data.updated).toBeNumber()

            testKeys.push(result.data)
        }
    })

    test('GET /api/keys - List all provider keys (should mask secrets)', async () => {
        const listKeysEndpoint: Endpoint<never, any> = { url: `${API_URL}/keys` }
        const result = await apiFetch(listKeysEndpoint, undefined, ProviderKeyListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)

        for (const testKey of testKeys) {
            const found = result.data.find((k: ProviderKey) => k.id === testKey.id)
            expect(found).toBeDefined()
            if (found) {
                expect(found.name).toBe(testKey.name)
                expect(found.provider).toBe(testKey.provider)
                expect(found.key).toMatch(/^.{4}\*+.{4}$/)
                expect(found.isDefault).toBe(testKey.isDefault)
            }
        }
    })

    test('GET /api/keys/{keyId} - Get individual keys (should include full secret)', async () => {
        for (const key of testKeys) {
            const getKeyEndpoint: Endpoint<never, any> = { url: `${API_URL}/keys/${key.id}` }
            const result = await apiFetch(getKeyEndpoint, undefined, ProviderKeyResponseSchema)

            expect(result.success).toBe(true)
            expect(result.data.id).toBe(key.id)
            expect(result.data.name).toBe(key.name)
            expect(result.data.provider).toBe(key.provider)
            expect(result.data.key).toBe(key.key)
            expect(result.data.isDefault).toBe(key.isDefault)
        }
    })

    test('PATCH /api/keys/{keyId} - Update provider keys', async () => {
        const updates = [
            { name: 'Updated OpenAI Key', isDefault: false },
            { key: 'sk-ant-updated-test-key' },
            { name: 'Updated Groq Key Name', isDefault: true }
        ]

        for (let i = 0; i < testKeys.length; i++) {
            const key = testKeys[i]
            if (!key) continue
            const update = updates[i]
            if (!update) continue

            const updateKeyEndpoint: Endpoint<any, any> = {
                url: `${API_URL}/keys/${key.id}`,
                options: { method: 'PATCH' }
            }

            const result = await apiFetch(updateKeyEndpoint, update, ProviderKeyResponseSchema)

            expect(result.success).toBe(true)
            if (update.name) expect(result.data.name).toBe(update.name)
            if ('key' in update && update.key) expect(result.data.key).toBe(update.key)
            if (update.isDefault !== undefined) expect(result.data.isDefault).toBe(update.isDefault)
            expect(result.data.updated).toBeGreaterThan(key.updated)

            // Update local copy with new values
            testKeys[i] = { ...result.data }
        }
    })

    test('GET /api/keys - Verify updates', async () => {
        const listKeysEndpoint: Endpoint<never, any> = { url: `${API_URL}/keys` }
        const result = await apiFetch(listKeysEndpoint, undefined, ProviderKeyListResponseSchema)

        for (const key of testKeys) {
            const found = result.data.find((k: ProviderKey) => k.id === key.id)
            expect(found).toBeDefined()
            if (found) {
                expect(found.name).toBe(key.name)
                expect(found.provider).toBe(key.provider)
                expect(found.isDefault).toBe(key.isDefault)
            }
        }
    })

    test('Only one key per provider can be default', async () => {
        // First, get all keys and check default status
        const listKeysEndpoint: Endpoint<never, any> = { url: `${API_URL}/keys` }
        const result = await apiFetch(listKeysEndpoint, undefined, ProviderKeyListResponseSchema)

        // Group by provider and check that only one is default per provider
        const keysByProvider = result.data.reduce((acc: Record<string, ProviderKey[]>, key: ProviderKey) => {
            if (!acc[key.provider]) acc[key.provider] = []
            const currentProviderKeys = acc[key.provider]
            if (currentProviderKeys) currentProviderKeys.push(key)
            return acc
        }, {} as Record<string, ProviderKey[]>)

        for (const [_provider, keys] of Object.entries(keysByProvider) as [string, ProviderKey[]][]) {
            const defaultKeys = keys.filter((k: ProviderKey) => k.isDefault)
            expect(defaultKeys.length).toBeLessThanOrEqual(1)
        }
    })

    test('DELETE /api/keys/{keyId} - Delete all test provider keys', async () => {
        for (const key of testKeys) {
            const deleteKeyEndpoint: Endpoint<never, any> = {
                url: `${API_URL}/keys/${key.id}`,
                options: { method: 'DELETE' }
            }
            const result = await apiFetch(deleteKeyEndpoint, undefined, OperationSuccessResponseSchema)

            expect(result.success).toBe(true)
            expect(result.message).toBe('Key deleted successfully.')
        }
    })

    test('GET /api/keys - Verify deletions', async () => {
        const listKeysEndpoint: Endpoint<never, any> = { url: `${API_URL}/keys` }
        const result = await apiFetch(listKeysEndpoint, undefined, ProviderKeyListResponseSchema)

        for (const key of testKeys) {
            const found = result.data.find((k: ProviderKey) => k.id === key.id)
            expect(found).toBeUndefined()
        }
    })

    test('GET /api/keys/{keyId} - Verify 404 after deletion', async () => {
        for (const key of testKeys) {
            const response = await fetch(`${API_URL}/keys/${key.id}`)
            expect(response.status).toBe(404)

            const result = await response.json() as any
            expect(result.success).toBe(false)
            expect(result.error.code).toBe('PROVIDER_KEY_NOT_FOUND')
        }
    })
})