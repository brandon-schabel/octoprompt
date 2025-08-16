import { createRoute, z } from '@hono/zod-openapi'
import { OpenAPIHono } from '@hono/zod-openapi'
import { OperationSuccessResponseSchema, ApiErrorResponseSchema } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { generateTabName, getProjectById } from '@promptliano/services'
import { createStandardResponses, successResponse } from '../utils/route-helpers'

const projectTabNameGenerateRoute = createRoute({
  method: 'post',
  path: '/api/project-tabs/{tabId}/generate-name',
  request: {
    params: z.object({
      tabId: z.string().transform(Number)
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            projectId: z.number(),
            tabData: z
              .object({
                selectedFiles: z.array(z.number()).optional(),
                userPrompt: z.string().optional()
              })
              .optional(),
            existingNames: z.array(z.string()).optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        name: z.string(),
        status: z.literal('success'),
        generatedAt: z.string()
      })
    })
  ),
  tags: ['Project Tabs'],
  operationId: 'generateProjectTabName',
  summary: 'Generate an AI-powered name for a project tab'
})

export const projectTabRoutes = new OpenAPIHono().openapi(projectTabNameGenerateRoute, async (c) => {
  try {
    const { projectId, tabData, existingNames } = c.req.valid('json')

    // Get project information
    const project = await getProjectById(projectId)

    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    // Generate tab name using the AI service
    const selectedFiles = tabData?.selectedFiles || []
    const context = tabData?.userPrompt || undefined

    const generatedName = await generateTabName(project.name, selectedFiles, context)

    return c.json(successResponse({
      name: generatedName,
      status: 'success' as const,
      generatedAt: new Date().toISOString()
    }))
  } catch (error) {
    console.error('Failed to generate tab name:', error)

    if (error instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code
          }
        },
        error.status as any
      )
    }

    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to generate tab name',
          code: 'TAB_NAME_GENERATION_ERROR'
        }
      },
      500
    )
  }
})

export type ProjectTabRoutes = typeof projectTabRoutes
