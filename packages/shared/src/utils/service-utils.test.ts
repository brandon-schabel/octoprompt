/**
 * File: /packages/shared/src/utils/service-utils.test.ts
 * Recent changes:
 * 1. Initial creation with comprehensive test coverage
 * 2. Tests for requireEntity function
 * 3. Tests for ensureSingleDefault function
 * 4. Tests for validateOwnership function
 * 5. Tests for search query utilities and error factories
 */

import { describe, test, expect, mock } from 'bun:test'
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
import { ApiError } from '../error/api-error'

describe('requireEntity', () => {
  test('should return entity when it exists', () => {
    const entity = { id: 1, name: 'Test' }
    const result = requireEntity(entity, 'Project', 1)
    expect(result).toBe(entity)
  })

  test('should throw 404 ApiError when entity is null', () => {
    expect(() => {
      requireEntity(null, 'Project', 1)
    }).toThrow(ApiError)

    try {
      requireEntity(null, 'Project', 1)
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(404)
      expect((error as ApiError).code).toBe('PROJECT_NOT_FOUND')
      expect((error as ApiError).message).toBe('Project with ID 1 not found.')
    }
  })

  test('should throw 404 ApiError when entity is undefined', () => {
    expect(() => {
      requireEntity(undefined, 'Chat', 'abc-123', 'slug')
    }).toThrow(ApiError)

    try {
      requireEntity(undefined, 'Chat', 'abc-123', 'slug')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(404)
      expect((error as ApiError).code).toBe('CHAT_NOT_FOUND')
      expect((error as ApiError).message).toBe('Chat with slug abc-123 not found.')
    }
  })

  test('should handle entity names with spaces', () => {
    expect(() => {
      requireEntity(null, 'Provider Key', 1)
    }).toThrow(ApiError)

    try {
      requireEntity(null, 'Provider Key', 1)
    } catch (error) {
      expect((error as ApiError).code).toBe('PROVIDER_KEY_NOT_FOUND')
    }
  })
})

describe('ensureSingleDefault', () => {
  test('should unset other defaults when setting new default', async () => {
    const entities = [
      { id: 1, name: 'key1', isDefault: true },
      { id: 2, name: 'key2', isDefault: false },
      { id: 3, name: 'key3', isDefault: true }
    ]
    
    const updateCalls: Array<{ entity: any, isDefault: boolean }> = []
    const mockUpdate = mock((entity: any, isDefault: boolean) => {
      updateCalls.push({ entity, isDefault })
      return Promise.resolve()
    })

    const newDefault = { id: 2, name: 'key2', isDefault: true }
    
    await ensureSingleDefault(entities, newDefault, mockUpdate)
    
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls).toContainEqual({ entity: entities[0], isDefault: false })
    expect(updateCalls).toContainEqual({ entity: entities[2], isDefault: false })
  })

  test('should not unset defaults when new default is already the only default', async () => {
    const entities = [
      { id: 1, name: 'key1', isDefault: false },
      { id: 2, name: 'key2', isDefault: true },
      { id: 3, name: 'key3', isDefault: false }
    ]
    
    const updateCalls: Array<{ entity: any, isDefault: boolean }> = []
    const mockUpdate = mock((entity: any, isDefault: boolean) => {
      updateCalls.push({ entity, isDefault })
      return Promise.resolve()
    })

    const newDefault = entities[1]
    
    await ensureSingleDefault(entities, newDefault, mockUpdate)
    
    expect(updateCalls).toHaveLength(0)
  })

  test('should work with custom getId function', async () => {
    const entities = [
      { uuid: 'a', name: 'key1', isDefault: true },
      { uuid: 'b', name: 'key2', isDefault: false }
    ]
    
    const updateCalls: Array<{ entity: any, isDefault: boolean }> = []
    const mockUpdate = mock((entity: any, isDefault: boolean) => {
      updateCalls.push({ entity, isDefault })
      return Promise.resolve()
    })

    const newDefault = entities[1]
    
    await ensureSingleDefault(
      entities, 
      newDefault, 
      mockUpdate, 
      (entity) => entity.uuid
    )
    
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]).toEqual({ entity: entities[0], isDefault: false })
  })
})

describe('validateOwnership', () => {
  test('should not throw when user owns resource', () => {
    const resource = { id: 1, userId: 123, name: 'Test' }
    
    expect(() => {
      validateOwnership(resource, 123)
    }).not.toThrow()
  })

  test('should throw 403 ApiError when user does not own resource', () => {
    const resource = { id: 1, userId: 123, name: 'Test' }
    
    expect(() => {
      validateOwnership(resource, 456, undefined, 'Project')
    }).toThrow(ApiError)

    try {
      validateOwnership(resource, 456, undefined, 'Project')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(403)
      expect((error as ApiError).code).toBe('ACCESS_DENIED')
      expect((error as ApiError).message).toContain('Access denied')
      expect((error as ApiError).message).toContain('project')
    }
  })

  test('should work with custom getUserId function', () => {
    const resource = { id: 1, ownerId: 123, name: 'Test' }
    
    expect(() => {
      validateOwnership(resource, 123, (r) => r.ownerId)
    }).not.toThrow()

    expect(() => {
      validateOwnership(resource, 456, (r) => r.ownerId)
    }).toThrow(ApiError)
  })
})

describe('buildSearchQuery', () => {
  test('should return defaults when no options provided', () => {
    const result = buildSearchQuery()
    
    expect(result).toEqual({
      search: '',
      searchFields: ['name', 'title', 'description'],
      limit: 50,
      offset: 0,
      sortBy: 'created',
      sortOrder: 'desc',
      filters: {}
    })
  })

  test('should merge provided options with defaults', () => {
    const options: SearchQueryOptions = {
      search: 'test',
      limit: 25,
      sortBy: 'name',
      filters: { status: 'active' }
    }
    
    const result = buildSearchQuery(options)
    
    expect(result).toEqual({
      search: 'test',
      searchFields: ['name', 'title', 'description'],
      limit: 25,
      offset: 0,
      sortBy: 'name',
      sortOrder: 'desc',
      filters: { status: 'active' }
    })
  })

  test('should cap limit at 100', () => {
    const result = buildSearchQuery({ limit: 200 })
    expect(result.limit).toBe(100)
  })

  test('should ensure offset is non-negative', () => {
    const result = buildSearchQuery({ offset: -10 })
    expect(result.offset).toBe(0)
  })
})

describe('applySearchQuery', () => {
  const testEntities = [
    { id: 1, name: 'Apple Project', description: 'A fruit project', created: 1000 },
    { id: 2, name: 'Banana App', description: 'Yellow application', created: 2000 },
    { id: 3, name: 'Cherry Tool', description: 'Red utility', created: 1500 },
    { id: 4, name: 'Date Manager', description: 'Calendar application', created: 3000 }
  ]

  test('should filter by search term', () => {
    const result = applySearchQuery(testEntities, { search: 'app' })
    
    expect(result).toHaveLength(3)
    expect(result.map(e => e.id)).toContain(1) // "Apple" contains "app"
    expect(result.map(e => e.id)).toContain(2) // "App" contains "app"
    expect(result.map(e => e.id)).toContain(4) // "application" contains "app"
  })

  test('should sort by specified field and order', () => {
    const result = applySearchQuery(testEntities, { 
      sortBy: 'created', 
      sortOrder: 'asc' 
    })
    
    expect(result.map(e => e.id)).toEqual([1, 3, 2, 4])
  })

  test('should apply pagination', () => {
    const result = applySearchQuery(testEntities, { 
      limit: 2, 
      offset: 1,
      sortBy: 'id',
      sortOrder: 'asc'
    })
    
    expect(result).toHaveLength(2)
    expect(result.map(e => e.id)).toEqual([2, 3])
  })

  test('should apply filters', () => {
    const entitiesWithStatus = testEntities.map(e => ({ 
      ...e, 
      status: e.id % 2 === 0 ? 'active' : 'inactive' 
    }))
    
    const result = applySearchQuery(entitiesWithStatus, { 
      filters: { status: 'active' } 
    })
    
    expect(result).toHaveLength(2)
    expect(result.map(e => e.id)).toEqual([4, 2]) // sorted by created desc by default
  })

  test('should work with custom getFieldValue function', () => {
    const nestedEntities = [
      { id: 1, data: { name: 'Test 1' }, created: 1000 },
      { id: 2, data: { name: 'Example 2' }, created: 2000 }
    ]
    
    const result = applySearchQuery(
      nestedEntities, 
      { search: 'test' },
      (entity, field) => field === 'name' ? entity.data.name : (entity as any)[field]
    )
    
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })
})

describe('ErrorFactories', () => {
  test('validation should create proper validation error', () => {
    const error = ErrorFactories.validation('Project', { field: 'name' })
    
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.code).toBe('PROJECT_VALIDATION_ERROR')
    expect(error.message).toBe('Invalid project data provided.')
    expect(error.details).toEqual({ field: 'name' })
  })

  test('duplicate should create proper duplicate error', () => {
    const error = ErrorFactories.duplicate('User', 'email', 'test@example.com')
    
    expect(error.status).toBe(409)
    expect(error.code).toBe('USER_DUPLICATE')
    expect(error.message).toBe("A user with email 'test@example.com' already exists.")
    expect(error.details).toEqual({ field: 'email', value: 'test@example.com' })
  })

  test('dependency should create proper dependency error', () => {
    const error = ErrorFactories.dependency('Project', 'Chat')
    
    expect(error.status).toBe(409)
    expect(error.code).toBe('PROJECT_HAS_DEPENDENCIES')
    expect(error.message).toBe("Cannot delete project because it's referenced by existing chat(s).")
    expect(error.details).toEqual({ dependentEntity: 'Chat' })
  })

  test('forbidden should create proper forbidden error', () => {
    const error = ErrorFactories.forbidden('delete', 'Project')
    
    expect(error.status).toBe(403)
    expect(error.code).toBe('FORBIDDEN')
    expect(error.message).toBe("You don't have permission to delete this project.")
    expect(error.details).toEqual({ action: 'delete', entityType: 'Project' })
  })

  test('rateLimit should create proper rate limit error', () => {
    const error = ErrorFactories.rateLimit('API', 1234567890)
    
    expect(error.status).toBe(429)
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(error.message).toBe('Rate limit exceeded for API. Please try again later.')
    expect(error.details).toEqual({ resource: 'API', resetTime: 1234567890 })
  })

  test('serviceUnavailable should create proper service unavailable error', () => {
    const error = ErrorFactories.serviceUnavailable('Database', 'Maintenance')
    
    expect(error.status).toBe(503)
    expect(error.code).toBe('SERVICE_UNAVAILABLE')
    expect(error.message).toBe('Database service is temporarily unavailable: Maintenance')
    expect(error.details).toEqual({ serviceName: 'Database', reason: 'Maintenance' })
  })
})

describe('withServiceContext', () => {
  test('should return result when operation succeeds', async () => {
    const result = await withServiceContext(
      async () => 'success',
      { entityName: 'Project', action: 'creating' }
    )
    
    expect(result).toBe('success')
  })

  test('should re-throw ApiErrors as-is', async () => {
    const originalError = new ApiError(400, 'Bad request', 'BAD_REQUEST')
    
    try {
      await withServiceContext(
        async () => { throw originalError },
        { entityName: 'Project', action: 'creating' }
      )
    } catch (error) {
      expect(error).toBe(originalError)
    }
  })

  test('should wrap other errors in ApiError', async () => {
    const originalError = new Error('Something went wrong')
    
    try {
      await withServiceContext(
        async () => { throw originalError },
        { entityName: 'Project', action: 'creating', identifier: 123 }
      )
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(500)
      expect((error as ApiError).code).toBe('PROJECT_CREATING_FAILED')
      expect((error as ApiError).message).toContain('Failed to creating Project (ID: 123)')
      expect((error as ApiError).details).toHaveProperty('originalError')
    }
  })

  test('should handle non-Error objects', async () => {
    try {
      await withServiceContext(
        async () => { throw 'string error' },
        { entityName: 'Project', action: 'updating' }
      )
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).message).toContain('string error')
      expect((error as ApiError).details).toHaveProperty('originalError', 'string error')
    }
  })
})