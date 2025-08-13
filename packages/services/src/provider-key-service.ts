import { providerKeyStorage } from '@promptliano/storage'
import {
  CreateProviderKeyInputSchema,
  type ProviderKey,
  ProviderKeySchema,
  type UpdateProviderKeyInput,
  type TestProviderRequest,
  type TestProviderResponse,
  type BatchTestProviderRequest,
  type BatchTestProviderResponse,
  type ProviderHealthStatus,
  type ProviderModel,
  ProviderStatusEnum,
  ProviderHealthStatusEnum
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { z } from '@hono/zod-openapi'
import { normalizeToUnixMs } from '@promptliano/shared'
import { encryptKey, decryptKey, isEncrypted, type EncryptedData } from '@promptliano/shared/src/utils/crypto'

// The mapDbRowToProviderKey function is no longer needed as we store objects directly
// that should conform to the ProviderKey schema.

export type CreateProviderKeyInput = z.infer<typeof CreateProviderKeyInputSchema>

/**
 * Returns an object of functions to create, list, update, and delete provider keys,
 * using JSON file storage.
 */
export function createProviderKeyService() {
  async function createKey(data: CreateProviderKeyInput): Promise<ProviderKey> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const now = normalizeToUnixMs(new Date())
    let id = providerKeyStorage.generateId()
    const initialId = id
    let incrementCount = 0

    // If this new key is set to default, unset other defaults for the same provider
    if (data.isDefault) {
      for (const keyId in allKeys) {
        const key = allKeys[keyId]
        if (key && key.provider === data.provider && key.isDefault) {
          key.isDefault = false
          key.updated = now
        }
      }
    }

    // Handle ID conflicts by incrementing
    while (allKeys[id]) {
      id++
      incrementCount++
    }

    if (incrementCount > 0) {
      console.log(
        `Provider key ID ${initialId} was taken. Found available ID ${id} after ${incrementCount} increment(s).`
      )
    }

    // Encrypt the API key
    const encryptedData = await encryptKey(data.key)

    const newKeyData: ProviderKey = {
      id,
      name: data.name,
      provider: data.provider,
      key: encryptedData.encrypted, // Store encrypted key
      encrypted: true,
      iv: encryptedData.iv,
      tag: encryptedData.tag,
      salt: encryptedData.salt,
      isDefault: data.isDefault ?? false,
      isActive: data.isActive ?? true,
      environment: data.environment ?? 'production',
      description: data.description,
      expiresAt: data.expiresAt,
      lastUsed: data.lastUsed,
      created: now,
      updated: now
    }

    // Validate the new key data against the schema before saving
    const parseResult = ProviderKeySchema.safeParse(newKeyData)
    if (!parseResult.success) {
      console.error(`Validation failed for new provider key data: ${parseResult.error.message}`, {
        rawData: data,
        constructedData: newKeyData,
        error: parseResult.error.flatten()
      })
      throw new ApiError(
        500,
        'Internal validation error creating provider key.',
        'PROVIDER_KEY_VALIDATION_ERROR',
        parseResult.error.flatten()
      )
    }

    const validatedNewKey = parseResult.data

    allKeys[validatedNewKey.id] = validatedNewKey
    await providerKeyStorage.writeProviderKeys(allKeys)

    // Return the key with decrypted value (similar to getKeyById)
    return { ...validatedNewKey, key: data.key }
  }

  async function listKeysCensoredKeys(): Promise<ProviderKey[]> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const keyList = Object.values(allKeys).map((key) => {
      // For encrypted keys, we don't decrypt them, just show a generic mask
      if (key.encrypted) {
        return { ...key, key: '********' }
      }
      // For unencrypted keys (legacy), mask them properly
      const maskedKey =
        key.key.length > 8 ? `${key.key.substring(0, 4)}****${key.key.substring(key.key.length - 4)}` : '********'
      return { ...key, key: maskedKey }
    })

    // Sort by provider, then by created descending (as in original SQL)
    keyList.sort((a, b) => {
      if (a.provider < b.provider) return -1
      if (a.provider > b.provider) return 1
      // Assuming created are valid ISO strings, direct string comparison for descending order
      if (a.created > b.created) return -1
      if (a.created < b.created) return 1
      return 0
    })
    return keyList
  }

  async function listKeysUncensored(): Promise<ProviderKey[]> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const keyList = await Promise.all(
      Object.values(allKeys).map(async (key) => {
        // Decrypt key if encrypted
        if (key.encrypted && key.iv && key.tag && key.salt) {
          try {
            const decryptedKey = await decryptKey({
              encrypted: key.key,
              iv: key.iv,
              tag: key.tag,
              salt: key.salt
            })
            return { ...key, key: decryptedKey }
          } catch (error) {
            console.error(`Failed to decrypt key ${key.id}:`, error)
            return key // Return with encrypted key on error
          }
        }
        return key
      })
    )

    // Sort by provider, then by created descending
    keyList.sort((a, b) => {
      if (a.provider < b.provider) return -1
      if (a.provider > b.provider) return 1
      if (a.created > b.created) return -1
      if (a.created < b.created) return 1
      return 0
    })
    return keyList
  }

  async function getKeyById(id: number): Promise<ProviderKey | null> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const foundKeyData = allKeys[id]

    if (!foundKeyData) {
      return null
    }

    // Decrypt key if encrypted
    if (foundKeyData.encrypted && foundKeyData.iv && foundKeyData.tag && foundKeyData.salt) {
      try {
        const decryptedKey = await decryptKey({
          encrypted: foundKeyData.key,
          iv: foundKeyData.iv,
          tag: foundKeyData.tag,
          salt: foundKeyData.salt
        })
        return { ...foundKeyData, key: decryptedKey }
      } catch (error) {
        console.error(`Failed to decrypt key ${id}:`, error)
        throw new ApiError(500, `Failed to decrypt provider key`, 'PROVIDER_KEY_DECRYPTION_FAILED', { id })
      }
    }

    return foundKeyData
  }

  async function updateKey(id: number, data: UpdateProviderKeyInput): Promise<ProviderKey> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const existingKey = allKeys[id]

    if (!existingKey) {
      throw new ApiError(404, `Provider key with ID ${id} not found for update.`, 'PROVIDER_KEY_NOT_FOUND_FOR_UPDATE')
    }

    const now = normalizeToUnixMs(new Date())

    // If this key is being set to default, unset other defaults for the same provider
    if (data.isDefault === true && existingKey.provider === (data.provider ?? existingKey.provider)) {
      for (const keyId in allKeys) {
        const key = allKeys[keyId]
        if (
          key &&
          key.id !== id &&
          key.provider === (data.provider ?? existingKey.provider) &&
          key.isDefault
        ) {
          key.isDefault = false
          key.updated = now
        }
      }
    }

    let updatedKeyData: ProviderKey = {
      ...existingKey,
      name: data.name ?? existingKey.name,
      provider: data.provider ?? existingKey.provider,
      isDefault: data.isDefault !== undefined ? data.isDefault : existingKey.isDefault,
      updated: now
    }

    // If key is being updated, encrypt it
    if (data.key) {
      const encryptedData = await encryptKey(data.key)
      updatedKeyData = {
        ...updatedKeyData,
        key: encryptedData.encrypted,
        encrypted: true,
        iv: encryptedData.iv,
        tag: encryptedData.tag,
        salt: encryptedData.salt
      }
    } else {
      // Keep existing encrypted key
      updatedKeyData.key = existingKey.key
    }

    const parseResult = ProviderKeySchema.safeParse(updatedKeyData)
    if (!parseResult.success) {
      console.error(`Validation failed updating provider key ${id}: ${parseResult.error.message}`, {
        id,
        updatePayload: data,
        mergedData: updatedKeyData,
        error: parseResult.error.flatten()
      })
      throw new ApiError(
        500,
        `Internal validation error updating provider key.`,
        'PROVIDER_KEY_UPDATE_VALIDATION_ERROR',
        parseResult.error.flatten()
      )
    }

    const validatedUpdatedKey = parseResult.data
    allKeys[id] = validatedUpdatedKey
    await providerKeyStorage.writeProviderKeys(allKeys)

    // Return the key with decrypted value (similar to getKeyById)
    if (
      validatedUpdatedKey.encrypted &&
      validatedUpdatedKey.iv &&
      validatedUpdatedKey.tag &&
      validatedUpdatedKey.salt
    ) {
      try {
        const decryptedKey = await decryptKey({
          encrypted: validatedUpdatedKey.key,
          iv: validatedUpdatedKey.iv,
          tag: validatedUpdatedKey.tag,
          salt: validatedUpdatedKey.salt
        })
        return { ...validatedUpdatedKey, key: decryptedKey }
      } catch (error) {
        console.error(`Failed to decrypt key ${id}:`, error)
        throw new ApiError(500, `Failed to decrypt provider key`, 'PROVIDER_KEY_DECRYPTION_FAILED', { id })
      }
    }

    return validatedUpdatedKey
  }

  async function deleteKey(id: number): Promise<boolean> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    if (!allKeys[id]) {
      return false // Key not found, nothing to delete
    }

    delete allKeys[id]
    await providerKeyStorage.writeProviderKeys(allKeys)
    return true
  }

  async function testProvider(request: TestProviderRequest): Promise<TestProviderResponse> {
    const startTime = Date.now()
    const testedAt = normalizeToUnixMs(new Date())

    try {
      // Test connection based on provider type
      const result = await performProviderTest(request)
      const responseTime = Date.now() - startTime

      return {
        success: true,
        provider: request.provider,
        status: 'connected',
        models: result.models,
        responseTime,
        testedAt
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        success: false,
        provider: request.provider,
        status: 'error',
        models: [],
        responseTime,
        error: errorMessage,
        testedAt
      }
    }
  }

  async function batchTestProviders(request: BatchTestProviderRequest): Promise<BatchTestProviderResponse> {
    const startTime = Date.now()
    let results: TestProviderResponse[]

    if (request.parallel) {
      // Run tests in parallel
      results = await Promise.all(request.providers.map(testProvider))
    } else {
      // Run tests sequentially
      results = []
      for (const providerRequest of request.providers) {
        const result = await testProvider(providerRequest)
        results.push(result)
      }
    }

    const totalTime = Date.now() - startTime

    // Calculate summary
    const summary = {
      connected: results.filter((r) => r.status === 'connected').length,
      disconnected: results.filter((r) => r.status === 'disconnected').length,
      error: results.filter((r) => r.status === 'error').length
    }

    return {
      results,
      summary,
      totalTime
    }
  }

  async function getProviderHealthStatus(refresh: boolean = false): Promise<ProviderHealthStatus[]> {
    // Get all configured provider keys
    const allKeys = await listKeysUncensored()
    const providerMap = new Map<string, ProviderKey>()

    // Get the default or first key for each provider
    for (const key of allKeys) {
      if (!providerMap.has(key.provider) || key.isDefault) {
        providerMap.set(key.provider, key)
      }
    }

    const healthStatuses: ProviderHealthStatus[] = []

    for (const [provider, key] of providerMap) {
      try {
        if (refresh) {
          // Perform fresh health check
          const testRequest: TestProviderRequest = {
            provider,
            apiKey: key.key,
            timeout: 5000 // Short timeout for health checks
          }

          const testResult = await testProvider(testRequest)

          healthStatuses.push({
            provider,
            status: testResult.success ? 'healthy' : 'unhealthy',
            lastChecked: testResult.testedAt,
            uptime: testResult.success ? 100 : 0, // Simplified uptime calculation
            averageResponseTime: testResult.responseTime,
            modelCount: testResult.models.length
          })
        } else {
          // Return cached/estimated health status based on key data
          healthStatuses.push({
            provider,
            status: (key.isActive ?? true) ? 'healthy' : 'unknown',
            lastChecked: key.lastUsed ?? key.updated,
            uptime: (key.isActive ?? true) ? 99.8 : 0, // Estimated uptime
            averageResponseTime: 1000, // Default estimate
            modelCount: 0 // Unknown without fresh check
          })
        }
      } catch (error) {
        // Failed to check this provider
        healthStatuses.push({
          provider,
          status: 'unhealthy',
          lastChecked: normalizeToUnixMs(new Date()),
          uptime: 0,
          averageResponseTime: 0,
          modelCount: 0
        })
      }
    }

    return healthStatuses
  }

  /**
   * Internal helper function to perform the actual provider test
   */
  async function performProviderTest(request: TestProviderRequest): Promise<{ models: ProviderModel[] }> {
    const { provider, apiKey, url, timeout = 10000 } = request

    // Create fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      let response: Response
      let models: ProviderModel[] = []

      switch (provider) {
        case 'openai':
          if (!apiKey) {
            throw new ApiError(400, 'API key required for OpenAI provider', 'MISSING_API_KEY')
          }
          response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })
          if (!response.ok) {
            throw new ApiError(response.status, `OpenAI API error: ${response.statusText}`, 'PROVIDER_API_ERROR')
          }
          const openaiData = await response.json()
          models =
            openaiData.data?.map((model: any) => ({
              id: model.id,
              name: model.id,
              description: `OpenAI model: ${model.id}`
            })) || []
          break

        case 'anthropic':
          if (!apiKey) {
            throw new ApiError(400, 'API key required for Anthropic provider', 'MISSING_API_KEY')
          }
          // Anthropic doesn't have a direct models endpoint, so we'll test with a simple request
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }]
            }),
            signal: controller.signal
          })
          // Even if we get a specific error, if we get a 200 or auth-related error, the key is working
          if (response.ok || response.status === 400) {
            models = [
              { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most intelligent model' },
              { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model' },
              { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Powerful model for complex tasks' }
            ]
          } else if (response.status === 401) {
            throw new ApiError(401, 'Invalid Anthropic API key', 'INVALID_API_KEY')
          } else {
            throw new ApiError(response.status, `Anthropic API error: ${response.statusText}`, 'PROVIDER_API_ERROR')
          }
          break

        case 'ollama':
          const ollamaUrl = url || 'http://localhost:11434'
          response = await fetch(`${ollamaUrl}/api/tags`, {
            signal: controller.signal
          })
          if (!response.ok) {
            throw new ApiError(
              response.status,
              `Ollama connection error: ${response.statusText}`,
              'PROVIDER_CONNECTION_ERROR'
            )
          }
          const ollamaData = await response.json()
          models =
            ollamaData.models?.map((model: any) => ({
              id: model.name,
              name: model.name,
              description: `Ollama model: ${model.name}`
            })) || []
          break

        case 'lmstudio':
          const lmstudioUrl = url || 'http://localhost:1234'
          response = await fetch(`${lmstudioUrl}/v1/models`, {
            signal: controller.signal
          })
          if (!response.ok) {
            throw new ApiError(
              response.status,
              `LMStudio connection error: ${response.statusText}`,
              'PROVIDER_CONNECTION_ERROR'
            )
          }
          const lmstudioData = await response.json()
          models =
            lmstudioData.data?.map((model: any) => ({
              id: model.id,
              name: model.id,
              description: `LMStudio model: ${model.id}`
            })) || []
          break

        default:
          throw new ApiError(400, `Unsupported provider: ${provider}`, 'UNSUPPORTED_PROVIDER')
      }

      return { models }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return {
    createKey,
    listKeysCensoredKeys,
    listKeysUncensored,
    getKeyById,
    updateKey,
    deleteKey,
    testProvider,
    batchTestProviders,
    getProviderHealthStatus
  }
}

export const providerKeyService = createProviderKeyService()
