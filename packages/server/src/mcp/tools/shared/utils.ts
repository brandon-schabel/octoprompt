import { MCPError, MCPErrorCode, createMCPError } from '../../mcp-errors'
import type { MCPToolResponse } from '../../tools-registry'
import { trackMCPToolExecution } from '@promptliano/services'

/**
 * Validates that a required parameter is present
 * @param value The value to validate
 * @param paramName The name of the parameter
 * @param paramType The type of parameter (for error messages)
 * @param example Optional example value for error messages
 * @returns The validated value
 * @throws MCPError if the value is null or undefined
 */
export function validateRequiredParam<T>(
  value: T | undefined | null,
  paramName: string,
  paramType: string = 'parameter',
  example?: string
): T {
  if (value === undefined || value === null) {
    const exampleText = example ? `\nExample: { "${paramName}": ${example} }` : ''
    throw createMCPError(MCPErrorCode.MISSING_REQUIRED_PARAM, `${paramName} is required${exampleText}`, {
      parameter: paramName,
      value: value,
      validationErrors: { [paramName]: `Required ${paramType} is missing` }
    })
  }
  return value
}

/**
 * Validates that a required field exists in a data object
 * @param data The data object to check
 * @param fieldName The name of the field to validate
 * @param fieldType The type of field (for error messages)
 * @param example Optional example value for error messages
 * @returns The validated field value
 * @throws MCPError if the field is missing
 */
export function validateDataField<T>(data: any, fieldName: string, fieldType: string = 'field', example?: string): T {
  const value = data?.[fieldName]
  if (value === undefined || value === null) {
    const exampleText = example ? `\nExample: { "data": { "${fieldName}": ${example} } }` : ''
    throw createMCPError(MCPErrorCode.MISSING_REQUIRED_PARAM, `${fieldName} is required in data${exampleText}`, {
      parameter: `data.${fieldName}`,
      value: value,
      validationErrors: { [fieldName]: `Required ${fieldType} is missing from data object` },
      relatedResources: [`data.${fieldName}`]
    })
  }
  return value as T
}

/**
 * Creates a tracked handler that wraps tool execution with telemetry
 * @param toolName The name of the tool for tracking
 * @param handler The actual handler function
 * @returns A wrapped handler that includes tracking
 */
export function createTrackedHandler(
  toolName: string,
  handler: (args: any) => Promise<MCPToolResponse>
): (args: any) => Promise<MCPToolResponse> {
  return async (args: any) => {
    // Extract projectId if available
    const projectId = args.projectId as number | undefined

    // Use the tracking service to wrap the handler
    return trackMCPToolExecution(toolName, projectId, args, () => handler(args))
  }
}