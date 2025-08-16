import { ApiError } from '@promptliano/shared'

/**
 * Common error factory for services
 * Reduces repetitive error throwing patterns
 */
export class ErrorFactory {
  /**
   * Entity not found error
   */
  static notFound(entity: string, id: number | string): never {
    throw new ApiError(
      404,
      `${entity} with ID ${id} not found`,
      `${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`
    )
  }

  /**
   * Validation failed error
   */
  static validationFailed(entity: string, details?: any): never {
    throw new ApiError(
      400,
      `Validation failed for ${entity}`,
      'VALIDATION_ERROR',
      details
    )
  }

  /**
   * Operation failed error
   */
  static operationFailed(operation: string, reason?: string): never {
    throw new ApiError(
      500,
      reason || `Operation '${operation}' failed`,
      `${operation.toUpperCase().replace(/\s+/g, '_')}_FAILED`
    )
  }

  /**
   * Permission denied error
   */
  static permissionDenied(resource: string, action: string): never {
    throw new ApiError(
      403,
      `Permission denied: Cannot ${action} ${resource}`,
      'PERMISSION_DENIED'
    )
  }

  /**
   * Duplicate entity error
   */
  static duplicate(entity: string, field: string, value: any): never {
    throw new ApiError(
      409,
      `${entity} with ${field} '${value}' already exists`,
      'DUPLICATE_ENTITY',
      { field, value }
    )
  }

  /**
   * Invalid state error
   */
  static invalidState(entity: string, currentState: string, attemptedAction: string): never {
    throw new ApiError(
      400,
      `Cannot ${attemptedAction} ${entity} in current state: ${currentState}`,
      'INVALID_STATE',
      { currentState, attemptedAction }
    )
  }

  /**
   * Missing required field error
   */
  static missingRequired(field: string, context?: string): never {
    throw new ApiError(
      400,
      `Missing required field: ${field}${context ? ` in ${context}` : ''}`,
      'MISSING_REQUIRED_FIELD',
      { field, context }
    )
  }

  /**
   * Invalid parameter error
   */
  static invalidParam(param: string, expected: string, received?: any): never {
    throw new ApiError(
      400,
      `Invalid parameter '${param}': expected ${expected}${received !== undefined ? `, got ${typeof received}` : ''}`,
      'INVALID_PARAMETER',
      { param, expected, received }
    )
  }

  /**
   * Resource busy error
   */
  static resourceBusy(resource: string, operation?: string): never {
    throw new ApiError(
      423,
      `${resource} is currently busy${operation ? ` and cannot ${operation}` : ''}`,
      'RESOURCE_BUSY'
    )
  }

  /**
   * Batch operation error
   */
  static batchFailed(operation: string, failures: any[]): never {
    throw new ApiError(
      400,
      `Batch ${operation} failed for ${failures.length} items`,
      'BATCH_OPERATION_FAILED',
      { failures }
    )
  }

  /**
   * Database operation error
   */
  static databaseError(operation: string, details?: string): never {
    throw new ApiError(
      500,
      `Database operation failed: ${operation}${details ? ` - ${details}` : ''}`,
      'DATABASE_ERROR',
      { operation, details }
    )
  }

  /**
   * File system operation error
   */
  static fileSystemError(operation: string, path: string, details?: string): never {
    throw new ApiError(
      500,
      `File system operation failed: ${operation} at '${path}'${details ? ` - ${details}` : ''}`,
      'FILE_SYSTEM_ERROR',
      { operation, path, details }
    )
  }

  /**
   * Internal validation error (when our own schemas fail)
   */
  static internalValidation(entity: string, operation: string, details?: any): never {
    throw new ApiError(
      500,
      `Internal validation failed for ${entity} during ${operation}`,
      'INTERNAL_VALIDATION_ERROR',
      { entity, operation, details }
    )
  }

  /**
   * Update operation failed
   */
  static updateFailed(entity: string, id: number | string, reason?: string): never {
    throw new ApiError(
      500,
      `Failed to update ${entity} ${id}${reason ? `: ${reason}` : ''}`,
      `${entity.toUpperCase().replace(/\s+/g, '_')}_UPDATE_FAILED`,
      { id, reason }
    )
  }

  /**
   * Delete operation failed
   */
  static deleteFailed(entity: string, id: number | string, reason?: string): never {
    throw new ApiError(
      500,
      `Failed to delete ${entity} ${id}${reason ? `: ${reason}` : ''}`,
      `${entity.toUpperCase().replace(/\s+/g, '_')}_DELETE_FAILED`,
      { id, reason }
    )
  }

  /**
   * Create operation failed
   */
  static createFailed(entity: string, reason?: string): never {
    throw new ApiError(
      500,
      `Failed to create ${entity}${reason ? `: ${reason}` : ''}`,
      `${entity.toUpperCase().replace(/\s+/g, '_')}_CREATE_FAILED`,
      { reason }
    )
  }

  /**
   * Invalid relationship error
   */
  static invalidRelationship(childEntity: string, childId: number | string, parentEntity: string, parentId: number | string): never {
    throw new ApiError(
      400,
      `${childEntity} ${childId} does not belong to ${parentEntity} ${parentId}`,
      'INVALID_RELATIONSHIP',
      { childEntity, childId, parentEntity, parentId }
    )
  }
}

/**
 * Create entity-specific error factory
 */
export function createEntityErrorFactory(entityName: string) {
  return {
    notFound: (id: number | string) => ErrorFactory.notFound(entityName, id),
    validationFailed: (details?: any) => ErrorFactory.validationFailed(entityName, details),
    duplicate: (field: string, value: any) => ErrorFactory.duplicate(entityName, field, value),
    invalidState: (currentState: string, attemptedAction: string) => 
      ErrorFactory.invalidState(entityName, currentState, attemptedAction),
    permissionDenied: (action: string) => ErrorFactory.permissionDenied(entityName, action),
    updateFailed: (id: number | string, reason?: string) => 
      ErrorFactory.updateFailed(entityName, id, reason),
    deleteFailed: (id: number | string, reason?: string) => 
      ErrorFactory.deleteFailed(entityName, id, reason),
    createFailed: (reason?: string) => ErrorFactory.createFailed(entityName, reason),
    internalValidation: (operation: string, details?: any) =>
      ErrorFactory.internalValidation(entityName, operation, details)
  }
}

/**
 * Wrap async operations with standardized error handling
 */
export async function withErrorContext<T>(
  operation: () => Promise<T>,
  context: {
    entity?: string
    action?: string
    id?: number | string
  }
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error'
    const errorContext = [
      context.entity && `Entity: ${context.entity}`,
      context.action && `Action: ${context.action}`,
      context.id && `ID: ${context.id}`
    ].filter(Boolean).join(', ')
    
    throw new ApiError(
      500,
      `Operation failed${errorContext ? ` (${errorContext})` : ''}: ${message}`,
      'OPERATION_ERROR',
      { originalError: message, ...context }
    )
  }
}

/**
 * Assert condition or throw error
 */
export function assert(condition: any, error: ApiError | string): asserts condition {
  if (!condition) {
    if (typeof error === 'string') {
      throw new ApiError(400, error, 'ASSERTION_FAILED')
    }
    throw error
  }
}

/**
 * Assert entity exists or throw not found
 */
export function assertExists<T>(
  entity: T | null | undefined,
  entityName: string,
  id: number | string
): asserts entity is T {
  if (!entity) {
    ErrorFactory.notFound(entityName, id)
  }
}

/**
 * Validate and assert all required fields are present
 */
export function assertRequiredFields<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[],
  context?: string
): void {
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      ErrorFactory.missingRequired(String(field), context)
    }
  }
}

/**
 * Assert database operation succeeded
 */
export function assertDatabaseOperation<T>(
  result: T | null | undefined,
  operation: string,
  details?: string
): asserts result is T {
  if (result === null || result === undefined) {
    ErrorFactory.databaseError(operation, details)
  }
}

/**
 * Assert update operation affected rows
 */
export function assertUpdateSucceeded(
  result: boolean | number,
  entity: string,
  id: number | string
): void {
  if (!result || result === 0) {
    ErrorFactory.updateFailed(entity, id, 'Update operation returned false/0')
  }
}

/**
 * Assert delete operation affected rows
 */
export function assertDeleteSucceeded(
  result: boolean | number,
  entity: string,
  id: number | string
): void {
  if (!result || result === 0) {
    ErrorFactory.deleteFailed(entity, id, 'Delete operation returned false/0')
  }
}

/**
 * Wrap Zod validation errors with proper context
 */
export function handleZodError(error: any, entity: string, operation: string): never {
  if (error?.name === 'ZodError') {
    ErrorFactory.internalValidation(entity, operation, error.flatten().fieldErrors)
  }
  throw error
}