import { ApiError } from './api-error'

/**
 * Base error class for domain-specific errors
 * Provides a consistent error interface across all packages
 */
export abstract class DomainError extends Error {
  public readonly code: string
  public readonly details?: any
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.details = details
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Convert to ApiError for HTTP responses
   */
  toApiError(): ApiError {
    return new ApiError(this.statusCode, this.message, this.code, this.details)
  }

  /**
   * Convert to MCP error format
   */
  toMCPError(): { code: string; message: string; details?: any } {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    }
  }
}

/**
 * Validation error - 400 Bad Request
 */
export class ValidationError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details)
  }
}

/**
 * Not found error - 404 Not Found
 */
export class NotFoundError extends DomainError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier 
      ? `${resource} with ID '${identifier}' not found`
      : `${resource} not found`
    super(message, 'NOT_FOUND', 404, { resource, identifier })
  }
}

/**
 * Conflict error - 409 Conflict
 */
export class ConflictError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', 409, details)
  }
}

/**
 * Permission error - 403 Forbidden
 */
export class PermissionError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'PERMISSION_DENIED', 403, details)
  }
}

/**
 * Parser error - specific to parsing operations
 */
export class ParseError extends DomainError {
  constructor(message: string, filePath?: string, details?: any) {
    super(message, 'PARSE_ERROR', 422, { filePath, ...details })
  }
}

/**
 * File system error - for file operations
 */
export class FileSystemError extends DomainError {
  constructor(operation: string, path: string, originalError?: Error) {
    const message = `File ${operation} failed: ${path}`
    super(message, 'FILE_SYSTEM_ERROR', 500, {
      operation,
      path,
      originalError: originalError?.message
    })
  }
}

/**
 * Service error - general service layer errors
 */
export class ServiceError extends DomainError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code || 'SERVICE_ERROR', 500, details)
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Convert any error to a DomainError
   */
  static toDomainError(error: unknown): DomainError {
    if (error instanceof DomainError) {
      return error
    }

    if (error instanceof ApiError) {
      return new ServiceError(error.message, error.code, error.details)
    }

    if (error instanceof Error) {
      // Check for specific error patterns
      if (error.message.includes('not found')) {
        return new NotFoundError('Resource', undefined)
      }
      
      if (error.message.includes('already exists')) {
        return new ConflictError(error.message)
      }

      if (error.message.includes('invalid') || error.message.includes('validation')) {
        return new ValidationError(error.message)
      }

      // Default service error
      return new ServiceError(error.message)
    }

    // Unknown error type
    return new ServiceError('An unexpected error occurred', 'UNKNOWN_ERROR', {
      error: String(error)
    })
  }

  /**
   * Handle error at API boundary
   */
  static handleApiError(error: unknown): ApiError {
    const domainError = this.toDomainError(error)
    return domainError.toApiError()
  }

  /**
   * Handle error at MCP boundary
   */
  static handleMCPError(error: unknown): { code: string; message: string; details?: any } {
    const domainError = this.toDomainError(error)
    return domainError.toMCPError()
  }
}