/**
 * File: /packages/shared/src/utils/service-utils.ts
 * Recent changes:
 * 1. Initial creation with core service utility functions
 * 2. Added requireEntity for 404 error handling
 * 3. Added ensureSingleDefault for default entity management
 * 4. Added validateOwnership for resource ownership checks
 * 5. Added buildSearchQuery and common error factories
 */

import { ApiError } from '../error/api-error'

/**
 * Helper that throws a 404 ApiError if an entity is not found
 * @param entity - The entity to check (null/undefined = not found)
 * @param entityName - Name of the entity type (e.g., "Project", "Chat")
 * @param identifier - The identifier used to look up the entity
 * @param field - The field name used for lookup (defaults to "ID")
 * @returns The entity if it exists
 * @throws ApiError with 404 status if entity is null/undefined
 */
export function requireEntity<T>(
  entity: T | null | undefined,
  entityName: string,
  identifier: number | string,
  field: string = 'ID'
): T {
  if (entity == null) {
    throw new ApiError(
      404,
      `${entityName} with ${field} ${identifier} not found.`,
      `${entityName.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`,
      { [field.toLowerCase()]: identifier }
    )
  }
  return entity
}

/**
 * Ensures only one entity has isDefault=true within a collection
 * Useful for provider keys, settings, etc. where only one can be default
 * @param entities - Array of entities that may have isDefault property
 * @param newDefault - The entity that should be the new default
 * @param updateFn - Function to update an entity's isDefault property
 * @param getIdFn - Function to get the ID from an entity (defaults to .id property)
 */
export async function ensureSingleDefault<T extends { isDefault?: boolean }>(
  entities: T[],
  newDefault: T,
  updateFn: (entity: T, isDefault: boolean) => Promise<void>,
  getIdFn: (entity: T) => number | string = (entity: any) => entity.id
): Promise<void> {
  const newDefaultId = getIdFn(newDefault)
  
  // Find other entities that are currently default
  const currentDefaults = entities.filter(
    entity => entity.isDefault && getIdFn(entity) !== newDefaultId
  )
  
  // Unset default on all other entities
  for (const entity of currentDefaults) {
    await updateFn(entity, false)
  }
}

/**
 * Validates if a user owns a resource
 * @param resource - The resource to check ownership of
 * @param userId - The user ID to check against
 * @param getUserIdFn - Function to extract user ID from resource (defaults to .userId property)
 * @param resourceName - Name of the resource type for error messages
 * @throws ApiError with 403 status if user doesn't own the resource
 */
export function validateOwnership<T>(
  resource: T,
  userId: number | string,
  getUserIdFn: (resource: T) => number | string = (resource: any) => resource.userId,
  resourceName: string = 'Resource'
): void {
  const resourceUserId = getUserIdFn(resource)
  
  if (resourceUserId !== userId) {
    throw new ApiError(
      403,
      `Access denied. You don't have permission to access this ${resourceName.toLowerCase()}.`,
      'ACCESS_DENIED',
      { 
        resourceUserId, 
        requestUserId: userId, 
        resourceType: resourceName 
      }
    )
  }
}

/**
 * Interface for search query options
 */
export interface SearchQueryOptions {
  /** Search term to filter by */
  search?: string
  /** Fields to search in */
  searchFields?: string[]
  /** Number of results to return */
  limit?: number
  /** Number of results to skip */
  offset?: number
  /** Field to sort by */
  sortBy?: string
  /** Sort direction */
  sortOrder?: 'asc' | 'desc'
  /** Additional filters */
  filters?: Record<string, any>
}

/**
 * Builds a consistent search query object with defaults
 * @param options - Search options
 * @returns Normalized search query options
 */
export function buildSearchQuery(options: SearchQueryOptions = {}): Required<SearchQueryOptions> {
  return {
    search: options.search || '',
    searchFields: options.searchFields || ['name', 'title', 'description'],
    limit: Math.min(options.limit || 50, 100), // Cap at 100
    offset: Math.max(options.offset || 0, 0), // Ensure non-negative
    sortBy: options.sortBy || 'created',
    sortOrder: options.sortOrder || 'desc',
    filters: options.filters || {}
  }
}

/**
 * Filters an array of entities based on search criteria
 * @param entities - Array of entities to filter
 * @param query - Search query options
 * @param getFieldValue - Function to extract field values from entities
 * @returns Filtered and sorted entities
 */
export function applySearchQuery<T>(
  entities: T[],
  query: SearchQueryOptions,
  getFieldValue: (entity: T, field: string) => any = (entity: any, field: string) => entity[field]
): T[] {
  const normalizedQuery = buildSearchQuery(query)
  let filtered = [...entities]
  
  // Apply search term filter
  if (normalizedQuery.search) {
    const searchTerm = normalizedQuery.search.toLowerCase()
    filtered = filtered.filter(entity => {
      return normalizedQuery.searchFields.some(field => {
        const value = getFieldValue(entity, field)
        return value && String(value).toLowerCase().includes(searchTerm)
      })
    })
  }
  
  // Apply additional filters
  if (Object.keys(normalizedQuery.filters).length > 0) {
    filtered = filtered.filter(entity => {
      return Object.entries(normalizedQuery.filters).every(([field, expectedValue]) => {
        const actualValue = getFieldValue(entity, field)
        return actualValue === expectedValue
      })
    })
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    const aValue = getFieldValue(a, normalizedQuery.sortBy)
    const bValue = getFieldValue(b, normalizedQuery.sortBy)
    
    if (aValue < bValue) return normalizedQuery.sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return normalizedQuery.sortOrder === 'asc' ? 1 : -1
    return 0
  })
  
  // Apply pagination
  const start = normalizedQuery.offset
  const end = start + normalizedQuery.limit
  
  return filtered.slice(start, end)
}

/**
 * Common error factory functions for consistent error messages
 */
export const ErrorFactories = {
  /**
   * Creates a validation error
   */
  validation: (entityName: string, details?: unknown): ApiError => {
    return new ApiError(
      400,
      `Invalid ${entityName.toLowerCase()} data provided.`,
      `${entityName.toUpperCase().replace(/\s+/g, '_')}_VALIDATION_ERROR`,
      details
    )
  },

  /**
   * Creates a duplicate error
   */
  duplicate: (entityName: string, field: string, value: any): ApiError => {
    return new ApiError(
      409,
      `A ${entityName.toLowerCase()} with ${field} '${value}' already exists.`,
      `${entityName.toUpperCase().replace(/\s+/g, '_')}_DUPLICATE`,
      { field, value }
    )
  },

  /**
   * Creates a dependency error (when trying to delete something that's referenced)
   */
  dependency: (entityName: string, dependentEntity: string): ApiError => {
    return new ApiError(
      409,
      `Cannot delete ${entityName.toLowerCase()} because it's referenced by existing ${dependentEntity.toLowerCase()}(s).`,
      `${entityName.toUpperCase().replace(/\s+/g, '_')}_HAS_DEPENDENCIES`,
      { dependentEntity }
    )
  },

  /**
   * Creates a forbidden error
   */
  forbidden: (action: string, entityName: string): ApiError => {
    return new ApiError(
      403,
      `You don't have permission to ${action} this ${entityName.toLowerCase()}.`,
      'FORBIDDEN',
      { action, entityType: entityName }
    )
  },

  /**
   * Creates a rate limit error
   */
  rateLimit: (resource: string, resetTime?: number): ApiError => {
    return new ApiError(
      429,
      `Rate limit exceeded for ${resource}. Please try again later.`,
      'RATE_LIMIT_EXCEEDED',
      { resource, resetTime }
    )
  },

  /**
   * Creates a service unavailable error
   */
  serviceUnavailable: (serviceName: string, reason?: string): ApiError => {
    return new ApiError(
      503,
      `${serviceName} service is temporarily unavailable${reason ? `: ${reason}` : '.'}`,
      'SERVICE_UNAVAILABLE',
      { serviceName, reason }
    )
  }
}

/**
 * Utility for handling async operations with consistent error context
 * @param operation - The async operation to execute
 * @param context - Error context information
 * @returns The result of the operation
 * @throws ApiError with consistent formatting
 */
export async function withServiceContext<T>(
  operation: () => Promise<T>,
  context: {
    entityName: string
    action: string
    identifier?: number | string
    userId?: number | string
  }
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    // Re-throw ApiErrors as-is
    if (error instanceof ApiError) {
      throw error
    }
    
    // Wrap other errors in a consistent format
    const message = `Failed to ${context.action} ${context.entityName}${
      context.identifier ? ` (ID: ${context.identifier})` : ''
    }: ${error instanceof Error ? error.message : String(error)}`
    
    throw new ApiError(
      500,
      message,
      `${context.entityName.toUpperCase().replace(/\s+/g, '_')}_${context.action.toUpperCase().replace(/\s+/g, '_')}_FAILED`,
      {
        originalError: error instanceof Error ? error.message : String(error),
        context
      }
    )
  }
}