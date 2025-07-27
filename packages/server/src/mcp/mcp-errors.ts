import { ApiError } from '@promptliano/shared'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Extended error codes for MCP operations with more specific error types
 */
export enum MCPErrorCode {
  // Parameter validation errors
  MISSING_REQUIRED_PARAM = 'MISSING_REQUIRED_PARAM',
  INVALID_PARAM_VALUE = 'INVALID_PARAM_VALUE',
  INVALID_PARAM_TYPE = 'INVALID_PARAM_TYPE',
  PARAM_OUT_OF_RANGE = 'PARAM_OUT_OF_RANGE',
  // Resource errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',
  PROMPT_NOT_FOUND = 'PROMPT_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  // Service errors
  SERVICE_ERROR = 'SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  // Operation errors
  UNKNOWN_ACTION = 'UNKNOWN_ACTION',
  OPERATION_FAILED = 'OPERATION_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PATH_TRAVERSAL_DENIED = 'PATH_TRAVERSAL_DENIED',

  // State errors
  INVALID_STATE = 'INVALID_STATE',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',

  // Search and filter errors
  SEARCH_FAILED = 'SEARCH_FAILED',
  INVALID_SEARCH_QUERY = 'INVALID_SEARCH_QUERY',
  NO_SEARCH_RESULTS = 'NO_SEARCH_RESULTS',
  // Batch operation errors
  BATCH_OPERATION_FAILED = 'BATCH_OPERATION_FAILED',
  BATCH_OPERATION_PARTIAL_FAILURE = 'BATCH_OPERATION_PARTIAL_FAILURE',
  BATCH_SIZE_EXCEEDED = 'BATCH_SIZE_EXCEEDED',
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

/**
 * Recovery suggestions for each error code
 */
const ERROR_RECOVERY_SUGGESTIONS: Record<MCPErrorCode, string> = {
  [MCPErrorCode.MISSING_REQUIRED_PARAM]: 'Ensure all required parameters are provided in the request.',
  [MCPErrorCode.INVALID_PARAM_VALUE]: 'Check that the parameter value matches the expected format and constraints.',
  [MCPErrorCode.INVALID_PARAM_TYPE]: 'Verify the parameter type matches the expected type (string, number, etc.).',
  [MCPErrorCode.PARAM_OUT_OF_RANGE]: 'Ensure the parameter value is within the allowed range.',

  [MCPErrorCode.PROJECT_NOT_FOUND]:
    'Verify the project ID exists. Use the project_manager list action to see available projects.',
  [MCPErrorCode.FILE_NOT_FOUND]: 'Check the file path is correct. Use browse_files to explore available files.',
  [MCPErrorCode.TICKET_NOT_FOUND]:
    'Verify the ticket ID exists. Use ticket_manager list action to see available tickets.',
  [MCPErrorCode.PROMPT_NOT_FOUND]:
    'Check the prompt ID exists. Use prompt_manager list action to see available prompts.',
  [MCPErrorCode.RESOURCE_ALREADY_EXISTS]:
    'The resource already exists. Use update action instead of create, or choose a different name.',

  [MCPErrorCode.SERVICE_ERROR]: 'An internal service error occurred. Check server logs for details.',
  [MCPErrorCode.DATABASE_ERROR]: 'Database operation failed. Ensure the database is accessible and not corrupted.',
  [MCPErrorCode.TRANSACTION_FAILED]: 'The operation could not be completed. Some changes may have been rolled back.',
  [MCPErrorCode.AI_SERVICE_ERROR]: 'AI service is unavailable or returned an error. Check API keys and service status.',
  [MCPErrorCode.STORAGE_ERROR]: 'Storage operation failed. Check disk space and file permissions.',

  [MCPErrorCode.UNKNOWN_ACTION]: 'The requested action is not supported. Check available actions for this tool.',
  [MCPErrorCode.OPERATION_FAILED]:
    'The operation could not be completed. Check the error details for more information.',
  [MCPErrorCode.SYNC_FAILED]: 'File synchronization failed. Check file system permissions and project path.',
  [MCPErrorCode.VALIDATION_FAILED]: 'Input validation failed. Review the validation errors in the details.',

  [MCPErrorCode.PERMISSION_DENIED]: 'You do not have permission to perform this operation.',
  [MCPErrorCode.PATH_TRAVERSAL_DENIED]: 'Path traversal detected. Use relative paths within the project directory.',

  [MCPErrorCode.INVALID_STATE]:
    'The resource is in an invalid state for this operation. Check current state and try again.',
  [MCPErrorCode.CONCURRENT_MODIFICATION]: 'The resource was modified by another operation. Refresh and retry.',

  [MCPErrorCode.SEARCH_FAILED]: 'Search operation failed. Check your search syntax and try again.',
  [MCPErrorCode.INVALID_SEARCH_QUERY]:
    'Invalid search query. Use format: { query: "text", filters: { status: "open", tags: ["frontend"] } }',
  [MCPErrorCode.NO_SEARCH_RESULTS]:
    'No results found. Try broadening your search criteria or check if resources exist.',

  [MCPErrorCode.BATCH_OPERATION_FAILED]: 'All items in the batch operation failed. Check individual error details.',
  [MCPErrorCode.BATCH_OPERATION_PARTIAL_FAILURE]:
    'Some items failed. Check the response for succeeded and failed items.',
  [MCPErrorCode.BATCH_SIZE_EXCEEDED]:
    'Too many items in batch. Maximum batch size is 100 items. Split into smaller batches.',

  [MCPErrorCode.RATE_LIMIT_EXCEEDED]:
    'Too many requests. Please wait before retrying. Current limit: 100 requests per minute.'
}

/**
 * Structured error details for MCP errors
 */
export interface MCPErrorDetails {
  code: MCPErrorCode
  message: string
  suggestion?: string
  context?: {
    tool?: string
    action?: string
    parameter?: string
    value?: any
    validationErrors?: Record<string, string>
    relatedResources?: string[]
  }
  timestamp: number
}

/**
 * Enhanced MCP Error class with structured details and recovery suggestions
 */
export class MCPError extends ApiError {
  public readonly mcpCode: MCPErrorCode
  public readonly suggestion: string
  public readonly context?: MCPErrorDetails['context']

  constructor(code: MCPErrorCode, message: string, context?: MCPErrorDetails['context'], httpStatus: number = 400) {
    // Determine HTTP status based on error code
    const status = MCPError.getHttpStatus(code, httpStatus)

    // Get recovery suggestion
    const suggestion = ERROR_RECOVERY_SUGGESTIONS[code] || 'Check the error details and try again.'

    // Create detailed error message
    const detailedMessage = `[${code}] ${message}`

    // Call parent constructor
    super(status, detailedMessage, code)

    this.mcpCode = code
    this.suggestion = suggestion
    this.context = context

    // Add structured details
    this.details = {
      code,
      message,
      suggestion,
      context,
      timestamp: Date.now()
    } as MCPErrorDetails
  }
  /**
   * Determine appropriate HTTP status code based on error type
   */
  private static getHttpStatus(code: MCPErrorCode, defaultStatus: number): number {
    switch (code) {
      // 400 Bad Request
      case MCPErrorCode.MISSING_REQUIRED_PARAM:
      case MCPErrorCode.INVALID_PARAM_VALUE:
      case MCPErrorCode.INVALID_PARAM_TYPE:
      case MCPErrorCode.PARAM_OUT_OF_RANGE:
      case MCPErrorCode.VALIDATION_FAILED:
        return 400
      // 403 Forbidden
      case MCPErrorCode.PERMISSION_DENIED:
      case MCPErrorCode.PATH_TRAVERSAL_DENIED:
        return 403
      // 404 Not Found
      case MCPErrorCode.PROJECT_NOT_FOUND:
      case MCPErrorCode.FILE_NOT_FOUND:
      case MCPErrorCode.TICKET_NOT_FOUND:
      case MCPErrorCode.PROMPT_NOT_FOUND:
        return 404
      // 409 Conflict
      case MCPErrorCode.RESOURCE_ALREADY_EXISTS:
      case MCPErrorCode.CONCURRENT_MODIFICATION:
      case MCPErrorCode.INVALID_STATE:
        return 409
      // 500 Internal Server Error
      case MCPErrorCode.SERVICE_ERROR:
      case MCPErrorCode.DATABASE_ERROR:
      case MCPErrorCode.TRANSACTION_FAILED:
      case MCPErrorCode.STORAGE_ERROR:
      case MCPErrorCode.OPERATION_FAILED:
      case MCPErrorCode.SYNC_FAILED:
        return 500

      // 503 Service Unavailable
      case MCPErrorCode.AI_SERVICE_ERROR:
        return 503

      default:
        return defaultStatus
    }
  }
  /**
   * Create MCP error from an unknown error
   */
  static fromError(error: unknown, context?: MCPErrorDetails['context']): MCPError {
    if (error instanceof MCPError) {
      return error
    }

    if (error instanceof ApiError) {
      // Check for validation errors and use appropriate code
      if (error.code === 'VALIDATION_ERROR' || error.code === 'TICKET_VALIDATION_ERROR') {
        return new MCPError(MCPErrorCode.VALIDATION_FAILED, error.message, context, error.status)
      }
      return new MCPError(MCPErrorCode.SERVICE_ERROR, error.message, context, error.status)
    }

    if (error instanceof Error) {
      // Check for specific error patterns
      if (error.message.includes('ENOENT')) {
        return new MCPError(MCPErrorCode.FILE_NOT_FOUND, 'File or directory not found', {
          ...context,
          originalError: error.message
        })
      }

      if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        return new MCPError(MCPErrorCode.PERMISSION_DENIED, 'Permission denied for this operation', {
          ...context,
          originalError: error.message
        })
      }

      if (error.message.includes('database') || error.message.includes('sqlite')) {
        return new MCPError(MCPErrorCode.DATABASE_ERROR, 'Database operation failed', {
          ...context,
          originalError: error.message
        })
      }

      return new MCPError(MCPErrorCode.SERVICE_ERROR, error.message, context)
    }

    return new MCPError(MCPErrorCode.SERVICE_ERROR, 'An unknown error occurred', {
      ...context,
      originalError: String(error)
    })
  }
}

/**
 * Helper function to create MCP errors with context
 */
export function createMCPError(code: MCPErrorCode, message: string, context?: MCPErrorDetails['context']): MCPError {
  return new MCPError(code, message, context)
}

/**
 * Type guard to check if an error is an MCPError
 */
export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError
}

/**
 * Format MCP error for tool response
 */
export function formatMCPErrorResponse(error: MCPError): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${error.message}\n\nSuggestion: ${error.suggestion}\n\nDetails: ${JSON.stringify(error.context, null, 2)}`
      }
    ],
    isError: true
  }
}
