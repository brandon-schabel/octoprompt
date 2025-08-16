import { ApiError } from './api-error'

/**
 * Factory for creating standardized entity-related errors
 * Reduces code duplication across services and storage layers
 */
export class EntityErrors {
  /**
   * Entity not found error (404)
   */
  static notFound(entity: string, id: number | string): never {
    throw new ApiError(
      404,
      `${entity} ${id} not found`,
      `${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`
    )
  }

  /**
   * Multiple entities not found error (404)
   */
  static manyNotFound(entity: string, ids: Array<number | string>): never {
    throw new ApiError(
      404,
      `${entity}s not found: ${ids.join(', ')}`,
      `${entity.toUpperCase().replace(/\s+/g, '_')}S_NOT_FOUND`,
      { ids }
    )
  }

  /**
   * Validation error (400)
   */
  static validationFailed(entity: string, errors: any, context?: string): never {
    const message = context 
      ? `Validation failed for ${entity} in ${context}`
      : `Validation failed for ${entity}`
    
    throw new ApiError(
      400,
      message,
      'VALIDATION_ERROR',
      { entity, errors }
    )
  }

  /**
   * Duplicate entity error (409)
   */
  static duplicate(entity: string, field: string, value: any): never {
    throw new ApiError(
      409,
      `${entity} with ${field} '${value}' already exists`,
      'DUPLICATE_ENTITY',
      { entity, field, value }
    )
  }

  /**
   * Entity state conflict (409)
   */
  static stateConflict(entity: string, id: number | string, currentState: string, attemptedAction: string): never {
    throw new ApiError(
      409,
      `Cannot ${attemptedAction} ${entity} ${id} in state '${currentState}'`,
      'STATE_CONFLICT',
      { entity, id, currentState, attemptedAction }
    )
  }

  /**
   * Batch size exceeded error (400)
   */
  static batchSizeExceeded(entity: string, limit: number, provided: number): never {
    throw new ApiError(
      400,
      `Batch size exceeded for ${entity}. Maximum ${limit}, provided ${provided}`,
      'BATCH_SIZE_EXCEEDED',
      { entity, limit, provided }
    )
  }

  /**
   * Mismatched entity relationship (400)
   */
  static mismatch(childEntity: string, childId: number | string, parentEntity: string, parentId: number | string): never {
    throw new ApiError(
      400,
      `${childEntity} ${childId} does not belong to ${parentEntity} ${parentId}`,
      'ENTITY_MISMATCH',
      { childEntity, childId, parentEntity, parentId }
    )
  }

  /**
   * Invalid relationship error (400) - alias for mismatch
   */
  static invalidRelationship(childEntity: string, childId: number | string, parentEntity: string, parentId: number | string): never {
    return EntityErrors.mismatch(childEntity, childId, parentEntity, parentId)
  }

  /**
   * Missing required field (400)
   */
  static missingRequired(entity: string, field: string): never {
    throw new ApiError(
      400,
      `${field} required for ${entity}`,
      'MISSING_REQUIRED_FIELD',
      { entity, field }
    )
  }

  /**
   * Invalid entity state transition (400)
   */
  static invalidTransition(entity: string, id: number | string, from: string, to: string): never {
    throw new ApiError(
      400,
      `Invalid state transition for ${entity} ${id}: ${from} -> ${to}`,
      'INVALID_STATE_TRANSITION',
      { entity, id, from, to }
    )
  }

  /**
   * Entity already in state (400)
   */
  static alreadyInState(entity: string, id: number | string, state: string): never {
    throw new ApiError(
      400,
      `${entity} ${id} is already ${state}`,
      `${entity.toUpperCase().replace(/\s+/g, '_')}_ALREADY_${state.toUpperCase().replace(/\s+/g, '_')}`,
      { entity, id, state }
    )
  }

  /**
   * Database read error (500)
   */
  static dbReadError(entity: string, error: any, context?: string): never {
    const message = context
      ? `Failed to read ${entity} from database: ${context}`
      : `Failed to read ${entity} from database`
    
    throw new ApiError(
      500,
      message,
      'DB_READ_ERROR',
      { entity, originalError: error?.message }
    )
  }

  /**
   * Database write error (500)
   */
  static dbWriteError(entity: string, error: any, context?: string): never {
    const message = context
      ? `Failed to write ${entity} to database: ${context}`
      : `Failed to write ${entity} to database`
    
    throw new ApiError(
      500,
      message,
      'DB_WRITE_ERROR',
      { entity, originalError: error?.message }
    )
  }

  /**
   * Database delete error (500)
   */
  static dbDeleteError(entity: string, error: any, context?: string): never {
    const message = context
      ? `Failed to delete ${entity} from database: ${context}`
      : `Failed to delete ${entity} from database`
    
    throw new ApiError(
      500,
      message,
      'DB_DELETE_ERROR',
      { entity, originalError: error?.message }
    )
  }

  /**
   * Delete operation failed (500)
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
   * Transaction error (500)
   */
  static transactionError(operation: string, error: any): never {
    throw new ApiError(
      500,
      `Transaction failed during ${operation}`,
      'TRANSACTION_ERROR',
      { operation, originalError: error?.message }
    )
  }

  /**
   * Entity operation not permitted (403)
   */
  static notPermitted(entity: string, operation: string, reason?: string): never {
    const message = reason
      ? `${operation} not permitted for ${entity}: ${reason}`
      : `${operation} not permitted for ${entity}`
    
    throw new ApiError(
      403,
      message,
      'OPERATION_NOT_PERMITTED',
      { entity, operation, reason }
    )
  }

  /**
   * Create a custom entity error with any status code
   */
  static custom(statusCode: number, entity: string, message: string, code: string, details?: any): never {
    throw new ApiError(
      statusCode,
      `${entity}: ${message}`,
      code,
      { entity, ...details }
    )
  }
}

/**
 * Helper to create entity-specific error factories
 */
export function createEntityErrorFactory(entityName: string) {
  return {
    notFound: (id: number | string) => EntityErrors.notFound(entityName, id),
    manyNotFound: (ids: Array<number | string>) => EntityErrors.manyNotFound(entityName, ids),
    validationFailed: (errors: any, context?: string) => EntityErrors.validationFailed(entityName, errors, context),
    duplicate: (field: string, value: any) => EntityErrors.duplicate(entityName, field, value),
    stateConflict: (id: number | string, currentState: string, attemptedAction: string) => 
      EntityErrors.stateConflict(entityName, id, currentState, attemptedAction),
    batchSizeExceeded: (limit: number, provided: number) => 
      EntityErrors.batchSizeExceeded(entityName, limit, provided),
    missingRequired: (field: string) => EntityErrors.missingRequired(entityName, field),
    invalidTransition: (id: number | string, from: string, to: string) => 
      EntityErrors.invalidTransition(entityName, id, from, to),
    alreadyInState: (id: number | string, state: string) => 
      EntityErrors.alreadyInState(entityName, id, state),
    dbReadError: (error: any, context?: string) => EntityErrors.dbReadError(entityName, error, context),
    dbWriteError: (error: any, context?: string) => EntityErrors.dbWriteError(entityName, error, context),
    dbDeleteError: (error: any, context?: string) => EntityErrors.dbDeleteError(entityName, error, context),
    deleteFailed: (id: number | string, reason?: string) => 
      EntityErrors.deleteFailed(entityName, id, reason),
    invalidRelationship: (childId: number | string, parentEntity: string, parentId: number | string) => 
      EntityErrors.invalidRelationship(entityName, childId, parentEntity, parentId),
    notPermitted: (operation: string, reason?: string) => 
      EntityErrors.notPermitted(entityName, operation, reason),
    custom: (statusCode: number, message: string, code: string, details?: any) => 
      EntityErrors.custom(statusCode, entityName, message, code, details)
  }
}

// Pre-created factories for common entities
export const ProjectErrors = createEntityErrorFactory('Project')
export const TicketErrors = createEntityErrorFactory('Ticket')
export const TaskErrors = createEntityErrorFactory('Task')
export const QueueErrors = createEntityErrorFactory('Queue')
export const PromptErrors = createEntityErrorFactory('Prompt')
export const ChatErrors = createEntityErrorFactory('Chat')
export const FileErrors = createEntityErrorFactory('File')