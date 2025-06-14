/**
 * File: /packages/shared/src/utils/service-utils-examples.ts
 * Recent changes:
 * 1. Initial creation with usage examples
 * 2. Added example service using all utility functions
 * 3. Demonstrates error handling patterns
 * 4. Shows search and pagination usage
 * 5. Shows ownership validation and default management
 */

// This file contains examples of how to use the service utilities.
// It's not meant to be imported, just for reference.

import {
  requireEntity,
  ensureSingleDefault,
  validateOwnership,
  buildSearchQuery,
  applySearchQuery,
  ErrorFactories,
  withServiceContext,
  type SearchQueryOptions
} from './service-utils'

// Example entity types
interface User {
  id: number
  name: string
  email: string
  created: number
  updated: number
}

interface ProviderKey {
  id: number
  userId: number
  provider: string
  name: string
  key: string
  isDefault: boolean
  created: number
  updated: number
}

// Example storage layer (would be imported from @octoprompt/storage)
class MockStorage {
  private keys: ProviderKey[] = []

  async getById(id: number): Promise<ProviderKey | null> {
    return this.keys.find((k) => k.id === id) || null
  }

  async getByUserId(userId: number): Promise<ProviderKey[]> {
    return this.keys.filter((k) => k.userId === userId)
  }

  async update(id: number, data: Partial<ProviderKey>): Promise<ProviderKey> {
    const index = this.keys.findIndex((k) => k.id === id)
    if (index === -1) throw new Error('Not found')

    this.keys[index] = { ...this.keys[index], ...data, updated: Date.now() }
    return this.keys[index]
  }

  async create(data: Omit<ProviderKey, 'id' | 'created' | 'updated'>): Promise<ProviderKey> {
    const now = Date.now()
    const newKey: ProviderKey = {
      ...data,
      id: now,
      created: now,
      updated: now
    }
    this.keys.push(newKey)
    return newKey
  }
}

// Example service using the utilities
class ExampleProviderKeyService {
  constructor(private storage: MockStorage) {}

  /**
   * Get a provider key by ID, ensuring it exists and user owns it
   */
  async getKey(keyId: number, userId: number): Promise<ProviderKey> {
    return withServiceContext(
      async () => {
        // Use requireEntity to throw 404 if not found
        const key = requireEntity(await this.storage.getById(keyId), 'Provider Key', keyId)

        // Use validateOwnership to ensure user owns the resource
        validateOwnership(key, userId, (k) => k.userId, 'Provider Key')

        return key
      },
      {
        entityName: 'Provider Key',
        action: 'retrieving',
        identifier: keyId,
        userId
      }
    )
  }

  /**
   * Create a new provider key, handling default logic
   */
  async createKey(data: Omit<ProviderKey, 'id' | 'created' | 'updated'>, userId: number): Promise<ProviderKey> {
    return withServiceContext(
      async () => {
        // Validate ownership (if creating for another user)
        if (data.userId !== userId) {
          throw ErrorFactories.forbidden('create', 'Provider Key')
        }

        // Check for duplicates
        const existingKeys = await this.storage.getByUserId(userId)
        const duplicate = existingKeys.find((k) => k.provider === data.provider && k.name === data.name)

        if (duplicate) {
          throw ErrorFactories.duplicate('Provider Key', 'name', data.name)
        }

        // Create the key
        const newKey = await this.storage.create(data)

        // Handle default logic if this key is set as default
        if (data.isDefault) {
          await ensureSingleDefault(
            existingKeys.filter((k) => k.provider === data.provider),
            newKey,
            async (key, isDefault) => {
              await this.storage.update(key.id, { isDefault })
            }
          )
        }

        return newKey
      },
      {
        entityName: 'Provider Key',
        action: 'creating',
        userId
      }
    )
  }

  /**
   * Search and list provider keys with pagination
   */
  async searchKeys(
    userId: number,
    searchOptions: SearchQueryOptions = {}
  ): Promise<{
    keys: ProviderKey[]
    total: number
    hasMore: boolean
  }> {
    return withServiceContext(
      async () => {
        // Get all keys for the user
        const allKeys = await this.storage.getByUserId(userId)

        // Build normalized search query
        const query = buildSearchQuery({
          ...searchOptions,
          // Add provider-specific search fields
          searchFields: ['name', 'provider', 'environment']
        })

        // Apply search and pagination
        const filteredKeys = applySearchQuery(
          allKeys,
          query,
          // Custom field accessor for nested or computed fields
          (key, field) => {
            if (field === 'provider') return key.provider
            if (field === 'name') return key.name
            if (field === 'environment') return 'production' // example
            return (key as any)[field]
          }
        )

        return {
          keys: filteredKeys,
          total: allKeys.length,
          hasMore: query.offset + query.limit < allKeys.length
        }
      },
      {
        entityName: 'Provider Key',
        action: 'searching',
        userId
      }
    )
  }

  /**
   * Set a key as default, ensuring only one is default per provider
   */
  async setAsDefault(keyId: number, userId: number): Promise<ProviderKey> {
    return withServiceContext(
      async () => {
        // Get and validate ownership
        const key = await this.getKey(keyId, userId)

        // Get all keys for this provider
        const allKeys = await this.storage.getByUserId(userId)
        const providerKeys = allKeys.filter((k) => k.provider === key.provider)

        // Update this key as default
        const updatedKey = await this.storage.update(keyId, { isDefault: true })

        // Ensure single default
        await ensureSingleDefault(providerKeys, updatedKey, async (k, isDefault) => {
          await this.storage.update(k.id, { isDefault })
        })

        return updatedKey
      },
      {
        entityName: 'Provider Key',
        action: 'updating default',
        identifier: keyId,
        userId
      }
    )
  }

  /**
   * Delete a key, checking for dependencies
   */
  async deleteKey(keyId: number, userId: number): Promise<void> {
    return withServiceContext(
      async () => {
        // Get and validate ownership
        const key = await this.getKey(keyId, userId)

        // Check if this key is being used (example dependency check)
        if (key.isDefault) {
          const allKeys = await this.storage.getByUserId(userId)
          const otherKeys = allKeys.filter((k) => k.provider === key.provider && k.id !== keyId)

          if (otherKeys.length === 0) {
            throw ErrorFactories.dependency('Provider Key', 'active configurations')
          }
        }

        // Delete logic would go here
        // await this.storage.delete(keyId)
      },
      {
        entityName: 'Provider Key',
        action: 'deleting',
        identifier: keyId,
        userId
      }
    )
  }
}

// Example usage in a route handler
async function exampleRouteHandler(request: any) {
  try {
    const service = new ExampleProviderKeyService(new MockStorage())
    const userId = 123 // from auth

    // Search with pagination
    const results = await service.searchKeys(userId, {
      search: 'openai',
      limit: 10,
      offset: 0,
      sortBy: 'created',
      sortOrder: 'desc',
      filters: { provider: 'openai' }
    })

    return { success: true, data: results }
  } catch (error) {
    // The utilities will throw properly formatted ApiErrors
    if (error instanceof Error) {
      return {
        success: false,
        error: {
          message: error.message,
          code: (error as any).code || 'UNKNOWN_ERROR',
          status: (error as any).status || 500
        }
      }
    }
    throw error
  }
}
