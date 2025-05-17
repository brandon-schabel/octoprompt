import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { db } from '@db'
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas'
import { generateFileChange, getFileChange, confirmFileChange } from '@/services/file-services/ai-file-change-service'

const GenerateChangeBodySchema = z
  .object({
    filePath: z
      .string()
      .min(1)
      .openapi({ example: 'src/components/Button.tsx', description: 'Path to the file to modify' }),
    prompt: z
      .string()
      .min(1)
      .openapi({ example: 'Add hover effects to the button', description: 'Instruction for the AI to follow' })
  })
  .openapi('GenerateChangeBody')

const FileChangeIdParamsSchema = z
  .object({
    fileChangeId: z
      .string()
      .transform((val) => parseInt(val, 10))
      .openapi({
        param: { name: 'fileChangeId', in: 'path' },
        example: '123',
        description: 'ID of the file change'
      })
  })
  .openapi('FileChangeIdParams')

const FileChangeResponseSchema = z
  .object({
    success: z.literal(true),
    result: z
      .object({
        id: z.number(),
        filePath: z.string(),
        originalContent: z.string(),
        suggestedContent: z.string(),
        diff: z.string(),
        prompt: z.string(),
        status: z.string(),
        createdAt: z.string().datetime()
      })
      .openapi('FileChangeResult')
  })
  .openapi('FileChangeResponse')

const FileChangeDetailsResponseSchema = z
  .object({
    success: z.literal(true),
    fileChange: z
      .object({
        id: z.number(),
        filePath: z.string(),
        originalContent: z.string(),
        suggestedContent: z.string(),
        diff: z.string(),
        prompt: z.string(),
        status: z.string(),
        createdAt: z.string().datetime()
      })
      .openapi('FileChangeDetails')
  })
  .openapi('FileChangeDetailsResponse')

const ConfirmChangeResponseSchema = z
  .object({
    success: z.literal(true),
    result: z
      .object({
        status: z.string(),
        message: z.string()
      })
      .openapi('ConfirmChangeResult')
  })
  .openapi('ConfirmChangeResponse')

// Route definitions
const generateFileChangeRoute = createRoute({
  method: 'post',
  path: '/api/file/ai-change',
  tags: ['Files', 'AI'],
  summary: 'Generate AI-assisted file changes based on a prompt',
  request: {
    body: { content: { 'application/json': { schema: GenerateChangeBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: FileChangeResponseSchema } },
      description: 'Successfully generated file change'
    },
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Invalid request' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error generating file change'
    }
  }
})

const getFileChangeRoute = createRoute({
  method: 'get',
  path: '/api/file/ai-change/{fileChangeId}',
  tags: ['Files', 'AI'],
  summary: 'Retrieve details about a specific AI file change',
  request: {
    params: FileChangeIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: FileChangeDetailsResponseSchema } },
      description: 'Successfully retrieved file change'
    },
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Invalid file change ID' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'File change not found' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error retrieving file change'
    }
  }
})

const confirmFileChangeRoute = createRoute({
  method: 'post',
  path: '/api/file/ai-change/{fileChangeId}/confirm',
  tags: ['Files', 'AI'],
  summary: 'Confirm and apply an AI-generated file change',
  request: {
    params: FileChangeIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ConfirmChangeResponseSchema } },
      description: 'Successfully confirmed file change'
    },
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Invalid file change ID' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'File change not found' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error confirming file change'
    }
  }
})

export const aiFileChangeRoutes = new OpenAPIHono()
  .openapi(generateFileChangeRoute, async (c) => {
    try {
      const body = c.req.valid('json')
      const changeRecord = await generateFileChange({
        filePath: body.filePath,
        prompt: body.prompt,
        db
      })

      // Map the DB record to the response schema
      const payload: z.infer<typeof FileChangeResponseSchema> = {
        success: true,
        result: {
          id: changeRecord.id,
          filePath: changeRecord.file_path,
          originalContent: changeRecord.original_content,
          suggestedContent: changeRecord.suggested_content ?? '',
          diff: changeRecord.suggested_diff ?? '',
          prompt: changeRecord.prompt ?? '',
          status: changeRecord.status,
          createdAt: new Date(changeRecord.timestamp * 1000).toISOString() // Convert Unix timestamp
        }
      }
      return c.json(payload, 200)
    } catch (error) {
      console.error('Error generating file change:', error)
      const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
        success: false,
        error: {
          message: 'Failed to generate file change',
          code: 'FILE_CHANGE_GENERATION_ERROR',
          details: {}
        }
      }
      return c.json(errorPayload, 500)
    }
  })
  .openapi(getFileChangeRoute, async (c) => {
    try {
      const { fileChangeId } = c.req.valid('param')

      if (isNaN(fileChangeId)) {
        const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
          success: false,
          error: {
            message: 'Invalid file change ID',
            code: 'INVALID_INPUT',
            details: {}
          }
        }
        return c.json(errorPayload, 400)
      }

      const fileChangeRecord = await getFileChange(db, fileChangeId)

      if (fileChangeRecord === null) {
        const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
          success: false,
          error: {
            message: 'File change not found',
            code: 'NOT_FOUND',
            details: {}
          }
        }
        return c.json(errorPayload, 404)
      }

      const payload: z.infer<typeof FileChangeDetailsResponseSchema> = {
        success: true,
        fileChange: {
          id: fileChangeRecord.id,
          filePath: fileChangeRecord.file_path,
          originalContent: fileChangeRecord.original_content,
          suggestedContent: fileChangeRecord.suggested_content ?? '',
          diff: fileChangeRecord.suggested_diff ?? '',
          prompt: fileChangeRecord.prompt ?? '',
          status: fileChangeRecord.status,
          createdAt: new Date(fileChangeRecord.timestamp * 1000).toISOString()
        }
      }
      return c.json(payload, 200)
    } catch (error) {
      console.error('Error retrieving file change:', error)
      const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
        success: false,
        error: {
          message: 'Failed to retrieve file change',
          code: 'FILE_CHANGE_RETRIEVAL_ERROR',
          details: {}
        }
      }
      return c.json(errorPayload, 500)
    }
  })
  .openapi(confirmFileChangeRoute, async (c) => {
    try {
      const { fileChangeId } = c.req.valid('param')

      if (isNaN(fileChangeId)) {
        const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
          success: false,
          error: {
            message: 'Invalid file change ID',
            code: 'INVALID_INPUT',
            details: {}
          }
        }
        return c.json(errorPayload, 400)
      }

      const result = await confirmFileChange(db, fileChangeId)

      const payload: z.infer<typeof ConfirmChangeResponseSchema> = {
        success: true,
        result: result
      }
      return c.json(payload, 200)
    } catch (error) {
      console.error('Error confirming file change:', error)
      let statusCode: 400 | 404 | 500 = 500
      let errorCode = 'FILE_CHANGE_CONFIRM_ERROR'
      let errorMessage = 'Failed to confirm file change'

      if (error instanceof Error) {
        errorMessage = error.message
        const code = (error as any).code
        if (code === 'NOT_FOUND') {
          statusCode = 404
          errorCode = 'NOT_FOUND'
        } else if (code === 'INVALID_STATE') {
          statusCode = 400
          errorCode = 'INVALID_STATE'
        }
      }

      const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
        success: false,
        error: {
          message: errorMessage,
          code: errorCode,
          details: {}
        }
      }

      return c.json(errorPayload, statusCode)
    }
  })

export type AiFileChangeRouteTypes = typeof aiFileChangeRoutes
