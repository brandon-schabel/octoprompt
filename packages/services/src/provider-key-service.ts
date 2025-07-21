import { providerKeyStorage } from '@octoprompt/storage'
import {
  CreateProviderKeyInputSchema,
  type ProviderKey,
  ProviderKeySchema,
  type UpdateProviderKeyInput
} from '@octoprompt/schemas'
import { ApiError } from '@octoprompt/shared'
import { z } from '@hono/zod-openapi'
import { normalizeToUnixMs } from '@octoprompt/shared'

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
        if (allKeys[keyId].provider === data.provider && allKeys[keyId].isDefault) {
          allKeys[keyId].isDefault = false
          allKeys[keyId].updated = now
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

    const newKeyData: ProviderKey = {
      id,
      name: data.name, // Added name
      provider: data.provider,
      key: data.key, // Stored in plaintext initially
      isDefault: data.isDefault ?? false, // Added isDefault, defaults to false
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
    return validatedNewKey
  }

  async function listKeysCensoredKeys(): Promise<ProviderKey[]> {
    const allKeys = await providerKeyStorage.readProviderKeys()
    const keyList = Object.values(allKeys).map((key) => {
      // Mask the API key
      const maskedKey =
        key.key.length > 8 ? `${key.key.substring(0, 4)}****${key.key.substring(key.key.length - 4)}` : '********' // Or handle very short keys differently
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

    const now = normalizeToUnixMs(new Date())

    // If this key is being set to default, unset other defaults for the same provider
    if (data.isDefault === true && existingKey.provider === (data.provider ?? existingKey.provider)) {
      for (const keyId in allKeys) {
        if (
          allKeys[keyId].id !== id &&
          allKeys[keyId].provider === (data.provider ?? existingKey.provider) &&
          allKeys[keyId].isDefault
        ) {
          allKeys[keyId].isDefault = false
          allKeys[keyId].updated = now
        }
      }
    }

    const updatedKeyData: ProviderKey = {
      ...existingKey,
      name: data.name ?? existingKey.name,
      provider: data.provider ?? existingKey.provider,
      key: data.key ?? existingKey.key, // Stored in plaintext initially
      isDefault: data.isDefault !== undefined ? data.isDefault : existingKey.isDefault,
      updated: now
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
    listKeysCensoredKeys,
    listKeysUncensored,
    getKeyById,
    updateKey,
    deleteKey
  }
}

export const providerKeyService = createProviderKeyService()
