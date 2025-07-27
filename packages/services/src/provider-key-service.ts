import { providerKeyStorage } from '@promptliano/storage'
import {
  CreateProviderKeyInputSchema,
  type ProviderKey,
  ProviderKeySchema,
  type UpdateProviderKeyInput
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
    if (validatedUpdatedKey.encrypted && validatedUpdatedKey.iv && validatedUpdatedKey.tag && validatedUpdatedKey.salt) {
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
