import { z } from '@hono/zod-openapi'

// Common error response schema
export const ApiErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      message: z.string().openapi({ example: 'An error occurred' }),
      code: z.string().optional().openapi({ example: 'ERROR_CODE' }),
      details: z.record(z.any()).optional()
    })
  })
  .openapi('ApiErrorResponse')

// Common success response schema
export const OperationSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().openapi({ example: 'Operation completed successfully' })
  })
  .openapi('OperationSuccessResponse')

export const MessageRoleEnum = z.enum([
  'assistant',
  'user',
  'system'
  // 'tool',
  // 'function'
])
