import { ApiError } from '@octoprompt/shared'
import { ZodError } from 'zod'

/**
 * Handle validation errors consistently across services
 */
export function handleValidationError(
  error: unknown,
  entityName: string,
  action: string,
  additionalContext?: Record<string, any>
): never {
  if (error instanceof ZodError) {
    console.error(
      `Validation failed ${action} ${entityName}: ${error.message}`,
      error.flatten().fieldErrors,
      additionalContext
    )
    throw new ApiError(
      500,
      `Internal validation error ${action} ${entityName}.`,
      `${entityName.toUpperCase().replace(/\s+/g, '_')}_VALIDATION_ERROR`,
      error.flatten().fieldErrors
    )
  }
  throw error
}

/**
 * Throw a standardized not found error
 */
export function throwNotFound(entityName: string, identifier: number | string, field: string = 'ID'): never {
  throw new ApiError(
    404,
    `${entityName} with ${field} ${identifier} not found.`,
    `${entityName.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`
  )
}

/**
 * Wrap a service method with standard error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  method: T,
  entityName: string,
  action: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await method(...args)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      handleValidationError(error, entityName, action)
    }
  }) as T
}

/**
 * Create a standard CRUD error handler
 */
export function createCrudErrorHandlers(entityName: string) {
  return {
    handleCreate: (error: unknown, data?: any) => 
      handleValidationError(error, entityName, 'creating', { data }),
    
    handleUpdate: (error: unknown, id: number | string, data?: any) => 
      handleValidationError(error, entityName, 'updating', { id, data }),
    
    handleDelete: (error: unknown, id: number | string) => 
      handleValidationError(error, entityName, 'deleting', { id }),
    
    handleGet: (error: unknown, id: number | string) => 
      handleValidationError(error, entityName, 'retrieving', { id }),
    
    notFound: (id: number | string) => 
      throwNotFound(entityName, id)
  }
}

/**
 * Handle API errors with context
 */
export function throwApiError(
  status: number,
  message: string,
  code: string,
  details?: unknown
): never {
  throw new ApiError(status, message, code, details)
}

/**
 * Wrap async operations with consistent error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorContext: {
    entityName: string
    action: string
    fallbackMessage?: string
    details?: any
  }
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    
    if (error instanceof ZodError) {
      handleValidationError(error, errorContext.entityName, errorContext.action, errorContext.details)
    }
    
    const message = errorContext.fallbackMessage || 
      `Failed to ${errorContext.action} ${errorContext.entityName}: ${error instanceof Error ? error.message : String(error)}`
    
    throw new ApiError(
      500,
      message,
      `${errorContext.entityName.toUpperCase().replace(/\s+/g, '_')}_${errorContext.action.toUpperCase().replace(/\s+/g, '_')}_FAILED`,
      errorContext.details
    )
  }
}