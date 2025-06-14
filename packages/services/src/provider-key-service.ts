import { providerKeyStorage } from '@octoprompt/storage'
import {
  CreateProviderKeyInputSchema,
  type ProviderKey,
  ProviderKeySchema,
  type UpdateProviderKeyInput
} from '@octoprompt/schemas'
import { 
  ApiError,
  normalizeToUnixMs,
  requireEntity,
  ensureSingleDefault
} from '@octoprompt/shared'
import { z } from '@hono/zod-openapi'
import { safeAsync, throwNotFound, handleValidationError } from './utils/error-handlers'

// The mapDbRowToProviderKey function is no longer needed as we store objects directly
// that should conform to the ProviderKey schema.

export type CreateProviderKeyInput = z.infer<typeof CreateProviderKeyInputSchema>

/**
 * Returns an object of functions to create, list, update, and delete provider keys,
 * using JSON file storage.
 */
export function createProviderKeyService() {
  async function createKey(data: CreateProviderKeyInput): Promise<ProviderKey> {
    return safeAsync(
      async () => {
        const newKeyData = {
          name: data.name,
          provider: data.provider,
          key: data.key,
          isDefault: data.isDefault ?? false,
          isActive: true,
          environment: 'production'
        }

        // If this new key is set to default, ensure only one default per provider
        if (newKeyData.isDefault) {
          const allKeys = await providerKeyStorage.list()
          const providerKeys = allKeys.filter(k => k.provider === data.provider)
          // For new entities, pass -1 as the ID to indicate it doesn't exist yet
          await ensureSingleDefault(providerKeys, -1, {
            updateFn: async (keyId, updates) => {
              await providerKeyStorage.update(keyId, updates)
            }
          })
        }

        const newKey = await providerKeyStorage.create(newKeyData)
        return newKey
      },
      {
        entityName: 'provider key',
        action: 'creating',
        details: { provider: data.provider, name: data.name }
      }
    )
  }

  async function listKeysCensoredKeys(): Promise<ProviderKey[]> {
    const allKeys = await providerKeyStorage.getAllProviderKeys()
    const keyList = allKeys.map((key) => {
      // Mask the API key
      const maskedKey =
        key.key.length > 8 ? `${key.key.substring(0, 4)}****${key.key.substring(key.key.length - 4)}` : '********' // Or handle very short keys differently
      return { ...key, key: maskedKey }
    })

    // Sort by provider, then by created descending (as in original SQL)
    keyList.sort((a, b) => {
      if (a.provider < b.provider) return -1
      if (a.provider > b.provider) return 1
      // Sort by created timestamp (descending)
      if (a.created > b.created) return -1
      if (a.created < b.created) return 1
      return 0
    })
    return keyList
  }

  async function listKeysUncensored(): Promise<ProviderKey[]> {
    const allKeys = await providerKeyStorage.getAllProviderKeys()
    
    // Sort by provider, then by created descending (as in original SQL)
    allKeys.sort((a, b) => {
      if (a.provider < b.provider) return -1
      if (a.provider > b.provider) return 1
      // Sort by created timestamp (descending)
      if (a.created > b.created) return -1
      if (a.created < b.created) return 1
      return 0
    })
    return allKeys
  }

  async function getKeyById(id: number): Promise<ProviderKey | null> {
    return await providerKeyStorage.getById(id)
  }

  async function updateKey(id: number, data: UpdateProviderKeyInput): Promise<ProviderKey> {
    return safeAsync(
      async () => {
        const existingKey = await requireEntity(
          await providerKeyStorage.getById(id),
          'Provider key',
          id
        )

        // If this key is being set to default, ensure only one default per provider
        if (data.isDefault === true) {
          const provider = data.provider ?? existingKey.provider
          const allKeys = await providerKeyStorage.list()
          const providerKeys = allKeys.filter(k => k.provider === provider)
          await ensureSingleDefault(providerKeys, id, {
            updateFn: async (keyId, updates) => {
              await providerKeyStorage.update(keyId, updates)
            }
          })
        }

        const updated = await providerKeyStorage.update(id, data)
        return requireEntity(updated, 'Provider key', id)
      },
      {
        entityName: 'provider key',
        action: 'updating',
        details: { id, data }
      }
    )
  }

  async function deleteKey(id: number): Promise<boolean> {
    return await providerKeyStorage.delete(id)
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
