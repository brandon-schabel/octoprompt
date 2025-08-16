import { ApiError } from '@promptliano/shared'
import { ErrorFactory, withErrorContext, assertExists } from './error-factory'

/**
 * Service layer helpers to reduce duplication
 */

/**
 * Wrap service method with standard error handling
 */
export function createServiceMethod<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  context: {
    entity: string
    action: string
  }
) {
  return async (...args: TArgs): Promise<TReturn> => {
    return withErrorContext(
      () => fn(...args),
      context
    )
  }
}

/**
 * Create standard CRUD service methods
 */
export interface CrudServiceOptions<TEntity, TCreate, TUpdate> {
  entityName: string
  storage: {
    readAll: () => Promise<Record<string, TEntity>>
    getById: (id: number) => Promise<TEntity | null>
    add: (entity: TEntity) => Promise<TEntity>
    update: (id: number, updates: Partial<TEntity>) => Promise<TEntity>
    delete: (id: number) => Promise<boolean>
  }
  generateId: () => number
  transform?: {
    beforeCreate?: (data: TCreate) => TEntity | Promise<TEntity>
    afterCreate?: (entity: TEntity) => TEntity | Promise<TEntity>
    beforeUpdate?: (id: number, data: TUpdate) => Partial<TEntity> | Promise<Partial<TEntity>>
    afterUpdate?: (entity: TEntity) => TEntity | Promise<TEntity>
  }
}

/**
 * Create a complete CRUD service
 */
export function createCrudService<
  TEntity extends { id: number },
  TCreate = Omit<TEntity, 'id' | 'created' | 'updated'>,
  TUpdate = Partial<Omit<TEntity, 'id' | 'created' | 'updated'>>
>(options: CrudServiceOptions<TEntity, TCreate, TUpdate>) {
  const { entityName, storage, generateId, transform = {} } = options

  return {
    async list(): Promise<TEntity[]> {
      return withErrorContext(
        async () => {
          const entities = await storage.readAll()
          return Object.values(entities)
        },
        { entity: entityName, action: 'list' }
      )
    },

    async getById(id: number): Promise<TEntity> {
      return withErrorContext(
        async () => {
          const entity = await storage.getById(id)
          assertExists(entity, entityName, id)
          return entity
        },
        { entity: entityName, action: 'get', id }
      )
    },

    async create(data: TCreate): Promise<TEntity> {
      return withErrorContext(
        async () => {
          const now = Date.now()
          
          let entity: TEntity = {
            ...(transform.beforeCreate ? await transform.beforeCreate(data) : data),
            id: generateId(),
            created: now,
            updated: now
          } as TEntity
          
          const created = await storage.add(entity)
          
          if (transform.afterCreate) {
            return await transform.afterCreate(created)
          }
          
          return created
        },
        { entity: entityName, action: 'create' }
      )
    },

    async update(id: number, data: TUpdate): Promise<TEntity> {
      return withErrorContext(
        async () => {
          // Verify entity exists
          const existing = await storage.getById(id)
          assertExists(existing, entityName, id)
          
          const updates = transform.beforeUpdate
            ? await transform.beforeUpdate(id, data)
            : data as Partial<TEntity>
          
          const updated = await storage.update(id, {
            ...updates,
            updated: Date.now()
          })
          
          if (transform.afterUpdate) {
            return await transform.afterUpdate(updated)
          }
          
          return updated
        },
        { entity: entityName, action: 'update', id }
      )
    },

    async delete(id: number): Promise<boolean> {
      return withErrorContext(
        async () => {
          const existing = await storage.getById(id)
          assertExists(existing, entityName, id)
          
          const success = await storage.delete(id)
          if (!success) {
            ErrorFactory.operationFailed(`delete ${entityName}`)
          }
          
          return success
        },
        { entity: entityName, action: 'delete', id }
      )
    }
  }
}

/**
 * Batch operation helper
 */
export async function batchOperation<TItem, TResult>(
  items: TItem[],
  operation: (item: TItem, index: number) => Promise<TResult>,
  options: {
    continueOnError?: boolean
    maxConcurrent?: number
  } = {}
): Promise<{
  successful: Array<{ item: TItem; result: TResult; index: number }>
  failed: Array<{ item: TItem; error: Error; index: number }>
}> {
  const { continueOnError = false, maxConcurrent = 10 } = options
  
  const successful: Array<{ item: TItem; result: TResult; index: number }> = []
  const failed: Array<{ item: TItem; error: Error; index: number }> = []
  
  // Process in chunks for concurrency control
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const chunk = items.slice(i, i + maxConcurrent)
    
    const results = await Promise.allSettled(
      chunk.map((item, chunkIndex) => {
        const index = i + chunkIndex
        return operation(item, index).then(
          result => ({ item, result, index }),
          error => Promise.reject({ item, error, index })
        )
      })
    )
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successful.push(result.value)
      } else {
        failed.push(result.reason)
        
        if (!continueOnError) {
          break
        }
      }
    }
    
    if (failed.length > 0 && !continueOnError) {
      break
    }
  }
  
  return { successful, failed }
}

/**
 * Transaction helper for multiple operations
 */
export async function withTransaction<T>(
  operations: Array<() => Promise<any>>,
  rollback?: () => Promise<void>
): Promise<T> {
  const completed: number[] = []
  
  try {
    const results: any[] = []
    
    for (let i = 0; i < operations.length; i++) {
      results.push(await operations[i]())
      completed.push(i)
    }
    
    return results as T
  } catch (error) {
    // Rollback on failure
    if (rollback) {
      try {
        await rollback()
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError)
      }
    }
    
    throw error
  }
}

/**
 * Retry helper for unreliable operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    backoff?: number
    shouldRetry?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true
  } = options
  
  let lastError: any
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error
      }
      
      // Wait before retry with exponential backoff
      const waitTime = delay * Math.pow(backoff, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  throw lastError
}

/**
 * Cache helper for expensive operations
 */
export function withCache<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    ttl?: number
    keyGenerator?: (...args: TArgs) => string
  } = {}
) {
  const { ttl = 60000, keyGenerator = (...args) => JSON.stringify(args) } = options
  const cache = new Map<string, { value: TResult; expires: number }>()
  
  return async (...args: TArgs): Promise<TResult> => {
    const key = keyGenerator(...args)
    const cached = cache.get(key)
    
    if (cached && cached.expires > Date.now()) {
      return cached.value
    }
    
    const value = await fn(...args)
    cache.set(key, {
      value,
      expires: Date.now() + ttl
    })
    
    // Clean expired entries periodically
    if (cache.size > 100) {
      const now = Date.now()
      for (const [k, v] of cache.entries()) {
        if (v.expires < now) {
          cache.delete(k)
        }
      }
    }
    
    return value
  }
}