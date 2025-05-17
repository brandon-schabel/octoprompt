import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas'
import {
  generateFileChange,
  getFileChange,
  confirmFileChange,
  rejectFileChange
} from '@/services/file-services/ai-file-change-service'
import {
  AIFileChangeRecordSchema,
  GenerateChangeBodySchema as AIChangeGenerateBodySchema,
  FileChangeIdParamsSchema as AIChangeFileChangeIdParamsSchema
} from 'shared/src/schemas/ai-file-change.schemas'
import { ProjectIdParamsSchema } from 'shared/src/schemas/project.schemas'
import { ApiError } from 'shared'

const AIFileChangeRecordResponseSchema = AIFileChangeRecordSchema.openapi('AIFileChangeRecordResponse')

const GenerateAIFileChangeResponseSchema = z.object({
  success: z.literal(true),
  result: AIFileChangeRecordResponseSchema
}).openapi('GenerateAIFileChangeResponse')

const GetAIFileChangeDetailsResponseSchema = z.object({
  success: z.literal(true),
  fileChange: AIFileChangeRecordResponseSchema
}).openapi('GetAIFileChangeDetailsResponse')

const ConfirmAIFileChangeResponseSchema = z.object({
  success: z.literal(true),
  result: z.object({
    status: z.string(),
    message: z.string()
  })
}).openapi('ConfirmAIFileChangeResponse')

const generateFileChangeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/ai-file-changes',
  tags: ['Projects', 'AI File Changes'],
  summary: 'Generate AI-assisted file changes for a project file',
  request: {
    params: ProjectIdParamsSchema,
    body: { content: { 'application/json': { schema: AIChangeGenerateBodySchema.omit({ projectId: true }) } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: GenerateAIFileChangeResponseSchema } },
      description: 'Successfully generated file change'
    },
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Invalid request' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error generating file change'
    }
  }
})

const getFileChangeRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/ai-file-changes/{aiFileChangeId}',
  tags: ['Projects', 'AI File Changes'],
  summary: 'Retrieve details for a specific AI file change',
  request: {
    params: AIChangeFileChangeIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: GetAIFileChangeDetailsResponseSchema } },
      description: 'Successfully retrieved file change'
    },
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Invalid ID' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Resource not found' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error retrieving file change'
    }
  }
})

const confirmFileChangeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/ai-file-changes/{aiFileChangeId}/confirm',
  tags: ['Projects', 'AI File Changes'],
  summary: 'Confirm and apply an AI-generated file change',
  request: {
    params: AIChangeFileChangeIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ConfirmAIFileChangeResponseSchema } },
      description: 'Successfully confirmed file change'
    },
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Invalid ID or state' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Resource not found' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error confirming file change'
    }
  }
})

const rejectFileChangeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/ai-file-changes/{aiFileChangeId}/reject',
  tags: ['Projects', 'AI File Changes'],
  summary: 'Reject an AI-generated file change',
  request: {
    params: AIChangeFileChangeIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ConfirmAIFileChangeResponseSchema } },
      description: 'Successfully rejected file change'
    },
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Invalid ID or state' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Resource not found' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error rejecting file change'
    }
  }
})

export const aiFileChangeRoutes = new OpenAPIHono()
  .openapi(generateFileChangeRoute, async (c) => {
    try {
      const { projectId } = c.req.valid('param')
      const body = c.req.valid('json')
      const changeRecord = await generateFileChange({
        projectId,
        filePath: body.filePath,
        prompt: body.prompt
      })

      const payload = {
        success: true as const,
        result: changeRecord
      } satisfies z.infer<typeof GenerateAIFileChangeResponseSchema>
      return c.json(payload, 200)
    } catch (error) {
      console.error('Error generating file change:', error)
      if (error instanceof ApiError) {
        return c.json({ success: false as const, error: { message: error.message, code: error.code, details: error.details || {} } } satisfies z.infer<typeof ApiErrorResponseSchema>, error.status as any)
      }
      const errorPayload = {
        success: false as const,
        error: {
          message: error instanceof Error ? error.message : 'Failed to generate file change',
          code: 'FILE_CHANGE_GENERATION_ERROR',
          details: {}
        }
      } satisfies z.infer<typeof ApiErrorResponseSchema>
      return c.json(errorPayload, 500)
    }
  })
  .openapi(getFileChangeRoute, async (c) => {
    try {
      const { projectId, aiFileChangeId } = c.req.valid('param')

      if (!projectId || !aiFileChangeId) {
        throw new ApiError(400, 'Project ID and File Change ID are required', 'INVALID_INPUT')
      }

      const fileChangeRecord = await getFileChange(projectId, aiFileChangeId)

      if (!fileChangeRecord) {
        throw new ApiError(404, 'File change not found', 'NOT_FOUND')
      }

      const payload = {
        success: true as const,
        fileChange: fileChangeRecord
      } satisfies z.infer<typeof GetAIFileChangeDetailsResponseSchema>
      return c.json(payload, 200)
    } catch (error) {
      console.error('Error retrieving file change:', error)
      if (error instanceof ApiError) {
        return c.json({ success: false as const, error: { message: error.message, code: error.code, details: error.details || {} } } satisfies z.infer<typeof ApiErrorResponseSchema>, error.status as any)
      }
      const errorPayload = {
        success: false as const,
        error: {
          message: error instanceof Error ? error.message : 'Failed to retrieve file change',
          code: 'FILE_CHANGE_RETRIEVAL_ERROR',
          details: {}
        }
      } satisfies z.infer<typeof ApiErrorResponseSchema>
      return c.json(errorPayload, 500)
    }
  })
  .openapi(confirmFileChangeRoute, async (c) => {
    try {
      const { projectId, aiFileChangeId } = c.req.valid('param')

      if (!projectId || !aiFileChangeId) {
        throw new ApiError(400, 'Project ID and File Change ID are required', 'INVALID_INPUT')
      }

      const result = await confirmFileChange(projectId, aiFileChangeId)

      const payload = {
        success: true as const,
        result: result
      } satisfies z.infer<typeof ConfirmAIFileChangeResponseSchema>
      return c.json(payload, 200)
    } catch (error) {
      console.error('Error confirming file change:', error)
      if (error instanceof ApiError) {
        return c.json({ success: false as const, error: { message: error.message, code: error.code, details: error.details || {} } } satisfies z.infer<typeof ApiErrorResponseSchema>, error.status as any)
      }
      const errorPayload = {
        success: false as const,
        error: {
          message: error instanceof Error ? error.message : 'Failed to confirm file change',
          code: 'FILE_CHANGE_CONFIRM_ERROR',
          details: {}
        }
      } satisfies z.infer<typeof ApiErrorResponseSchema>
      return c.json(errorPayload, 500)
    }
  })
  .openapi(rejectFileChangeRoute, async (c) => {
    try {
      const { projectId, aiFileChangeId } = c.req.valid('param')
      if (!projectId || !aiFileChangeId) {
        throw new ApiError(400, 'Project ID and File Change ID are required', 'INVALID_INPUT')
      }
      const result = await rejectFileChange(projectId, aiFileChangeId)
      const payload = {
        success: true as const,
        result: result
      } satisfies z.infer<typeof ConfirmAIFileChangeResponseSchema>
      return c.json(payload, 200)
    } catch (error) {
      console.error('Error rejecting file change:', error)
      if (error instanceof ApiError) {
        return c.json({ success: false as const, error: { message: error.message, code: error.code, details: error.details || {} } } satisfies z.infer<typeof ApiErrorResponseSchema>, error.status as any)
      }
      const errorPayload = {
        success: false as const,
        error: {
          message: error instanceof Error ? error.message : 'Failed to reject file change',
          code: 'FILE_CHANGE_REJECT_ERROR',
          details: {}
        }
      } satisfies z.infer<typeof ApiErrorResponseSchema>
      return c.json(errorPayload, 500)
    }
  })

export type AiFileChangeRouteTypes = typeof aiFileChangeRoutes
