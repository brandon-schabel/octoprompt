// packages/server/src/services/model-providers/provider-key-service.ts
import { providerKeyStorage } from '@/utils/storage/provider-key-storage' // ADDED
import {
  CreateProviderKeyInputSchema,
  ProviderKey,
  ProviderKeySchema,
  UpdateProviderKeyInput
} from 'shared/src/schemas/provider-key.schemas'
import { ApiError } from 'shared'
import { z } from '@hono/zod-openapi'
import { normalizeToUnixMs } from '@/utils/parse-timestamp'

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
    const id = providerKeyStorage.generateId()

    const newKeyData: ProviderKey = {
      id,
      provider: data.provider,
      key: data.key, // Stored in plaintext initially
      created: now,
      updated: now,
      // Add any other fields from ProviderKeySchema with defaults if necessary
      // e.g., metadata: data.metadata ?? null, if metadata was part of your schema
    }

    // Validate the new key data against the schema before saving
    const parseResult = ProviderKeySchema.safeParse(newKeyData)
    if (!parseResult.success) {
      console.error(`Validation failed for new provider key data: ${parseResult.error.message}`, {
        rawData: data,
        constructedData: newKeyData,
        error: parseResult.error.flatten()
      })
      throw new ApiError(500, 'Internal validation error creating provider key.', 'PROVIDER_KEY_VALIDATION_ERROR', parseResult.error.flatten())
    }

    const validatedNewKey = parseResult.data;

    if (allKeys[validatedNewKey.id]) {
      // Extremely unlikely with UUIDs but a good safeguard
      throw new ApiError(500, `Provider key ID conflict for ${validatedNewKey.id}`, 'PROVIDER_KEY_ID_CONFLICT')
    }

    allKeys[validatedNewKey.id] = validatedNewKey
    await providerKeyStorage.writeProviderKeys(allKeys)
    return validatedNewKey
  }

  async function listKeys(): Promise<ProviderKey[]> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const keyList = Object.values(allKeys)

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

  async function getKeyById(id: number): Promise<ProviderKey | null> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const foundKeyData = allKeys[id]

    if (!foundKeyData) {
      return null
    }
    // Data should already be validated by readValidatedJson via providerKeyStorage.
    // If an extra check is desired, uncomment:
    /*
    const parseResult = ProviderKeySchema.safeParse(foundKeyData)
    if (!parseResult.success) {
      console.error(`Failed to parse provider key data for ID ${id} from storage. Data integrity issue.`, {
        id,
        foundData: foundKeyData,
        error: parseResult.error.flatten()
      })
      throw new ApiError(
        500,
        `Failed to parse provider key data for ID ${id}. Data integrity issue.`,
        'PROVIDER_KEY_PARSE_FAILED_ON_READ',
        { id, foundData: foundKeyData, error: parseResult.error.flatten() }
      )
    }
    return parseResult.data
    */
    return foundKeyData
  }

  async function updateKey(id: number, data: UpdateProviderKeyInput): Promise<ProviderKey> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const existingKey = allKeys[id]

    if (!existingKey) {
      throw new ApiError(404, `Provider key with ID ${id} not found for update.`, 'PROVIDER_KEY_NOT_FOUND_FOR_UPDATE')
    }

    const updatedKeyData: ProviderKey = {
      ...existingKey,
      provider: data.provider ?? existingKey.provider,
      key: data.key ?? existingKey.key, // Stored in plaintext initially
      updated: normalizeToUnixMs(new Date())
      // any other updatable fields
    }

    const parseResult = ProviderKeySchema.safeParse(updatedKeyData)
    if (!parseResult.success) {
      console.error(`Validation failed updating provider key ${id}: ${parseResult.error.message}`, {
        id,
        updatePayload: data,
        mergedData: updatedKeyData,
        error: parseResult.error.flatten()
      })
      throw new ApiError(500, `Internal validation error updating provider key.`, 'PROVIDER_KEY_UPDATE_VALIDATION_ERROR', parseResult.error.flatten())
    }

    const validatedUpdatedKey = parseResult.data;
    allKeys[id] = validatedUpdatedKey
    await providerKeyStorage.writeProviderKeys(allKeys)
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

  return {
    createKey,
    listKeys,
    getKeyById,
    updateKey,
    deleteKey
  }
}

export const providerKeyService = createProviderKeyService()