import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  ProjectIdParamsSchema,
  CommandNameParamsSchema,
  CreateClaudeCommandBodySchema,
  UpdateClaudeCommandBodySchema,
  ExecuteClaudeCommandBodySchema,
  ClaudeCommandResponseSchema,
  ClaudeCommandListResponseSchema,
  CommandSuggestionsResponseSchema,
  CommandExecutionResponseSchema,
  SearchCommandsQuerySchema,
  CommandGenerationRequestSchema,
  CommandGenerationResponseSchema
} from '@promptliano/schemas'
import {
  createCommand,
  listCommands,
  getCommandByName,
  updateCommand,
  deleteCommand,
  executeCommand,
  suggestCommands,
  generateCommand,
  getProjectById
} from '@promptliano/services'
import { ErrorHandler } from '@promptliano/shared'

const createClaudeCommandRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/commands',
  tags: ['Claude Commands'],
  summary: 'Create a new Claude command',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: CreateClaudeCommandBodySchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ClaudeCommandResponseSchema } },
      description: 'Command created successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request - Invalid command name or data'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    409: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Command already exists'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const listClaudeCommandsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/commands',
  tags: ['Claude Commands'],
  summary: 'List Claude commands for a project',
  request: {
    params: ProjectIdParamsSchema,
    query: SearchCommandsQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeCommandListResponseSchema } },
      description: 'Successfully retrieved commands'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const getClaudeCommandRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Get a specific Claude command',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeCommandResponseSchema } },
      description: 'Successfully retrieved command'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or command not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const updateClaudeCommandRoute = createRoute({
  method: 'put',
  path: '/api/projects/{projectId}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Update a Claude command',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    }),
    body: {
      content: { 'application/json': { schema: UpdateClaudeCommandBodySchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeCommandResponseSchema } },
      description: 'Command updated successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or command not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const deleteClaudeCommandRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Delete a Claude command',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Command deleted successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or command not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const executeClaudeCommandRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/commands/{commandName}/execute',
  tags: ['Claude Commands'],
  summary: 'Execute a Claude command',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    }),
    body: {
      content: { 'application/json': { schema: ExecuteClaudeCommandBodySchema } },
      required: false
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CommandExecutionResponseSchema } },
      description: 'Command executed successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or command not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const generateClaudeCommandRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/commands/generate',
  tags: ['Claude Commands'],
  summary: 'Generate a new Claude command using AI',
  description: 'Uses AI to generate a complete slash command based on user requirements and project context',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: CommandGenerationRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CommandGenerationResponseSchema } },
      description: 'Successfully generated command'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request - Invalid input data'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error - AI generation failed'
    }
  }
})

const suggestClaudeCommandsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/commands/suggest',
  tags: ['Claude Commands'],
  summary: 'Get AI-powered command suggestions',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            context: z.string().optional(),
            limit: z.number().int().positive().max(10).optional().default(5)
          })
        }
      },
      required: false
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CommandSuggestionsResponseSchema } },
      description: 'Successfully generated command suggestions'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

export const claudeCommandRoutes = new OpenAPIHono()
  .openapi(createClaudeCommandRoute, async (c) => {
    try {
      const { projectId } = c.req.valid('param')
      const body = c.req.valid('json')

      const project = await getProjectById(projectId)
      const command = await createCommand(project.path, body)

      return c.json({ success: true, data: command }, 201)
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error)
      return c.json(
        { success: false, error: { message: apiError.message, code: apiError.code, details: apiError.details } },
        apiError.status as any
      )
    }
  })
  .openapi(listClaudeCommandsRoute, async (c) => {
    try {
      const { projectId } = c.req.valid('param')
      const query = c.req.valid('query')

      const project = await getProjectById(projectId)
      const commands = await listCommands(project.path, query)

      return c.json({ success: true, data: commands })
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error)
      return c.json(
        { success: false, error: { message: apiError.message, code: apiError.code, details: apiError.details } },
        apiError.status as any
      )
    }
  })
  .openapi(getClaudeCommandRoute, async (c) => {
    try {
      const { projectId, commandName } = c.req.valid('param')
      const { namespace } = c.req.valid('query')

      const project = await getProjectById(projectId)
      const command = await getCommandByName(project.path, commandName, namespace)

      return c.json({ success: true, data: command })
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error)
      return c.json(
        { success: false, error: { message: apiError.message, code: apiError.code, details: apiError.details } },
        apiError.status as any
      )
    }
  })
  .openapi(updateClaudeCommandRoute, async (c) => {
    try {
      const { projectId, commandName } = c.req.valid('param')
      const { namespace } = c.req.valid('query')
      const body = c.req.valid('json')

      const project = await getProjectById(projectId)
      const command = await updateCommand(project.path, commandName, body, namespace)

      return c.json({ success: true, data: command })
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error)
      return c.json(
        { success: false, error: { message: apiError.message, code: apiError.code, details: apiError.details } },
        apiError.status as any
      )
    }
  })
  .openapi(deleteClaudeCommandRoute, async (c) => {
    try {
      const { projectId, commandName } = c.req.valid('param')
      const { namespace } = c.req.valid('query')

      const project = await getProjectById(projectId)
      await deleteCommand(project.path, commandName, namespace)

      return c.json({ success: true })
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error)
      return c.json(
        { success: false, error: { message: apiError.message, code: apiError.code, details: apiError.details } },
        apiError.status as any
      )
    }
  })
  .openapi(executeClaudeCommandRoute, async (c) => {
    try {
      const { projectId, commandName } = c.req.valid('param')
      const { namespace } = c.req.valid('query')
      const body = c.req.valid('json')

      const project = await getProjectById(projectId)
      const result = await executeCommand(project.path, commandName, body?.arguments, namespace)

      return c.json({
        success: true,
        data: {
          result: result.result,
          usage: result.metadata?.usage,
          model: result.metadata?.model,
          sessionId: result.metadata?.sessionId
        }
      })
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error)
      return c.json(
        { success: false, error: { message: apiError.message, code: apiError.code, details: apiError.details } },
        apiError.status as any
      )
    }
  })
  .openapi(generateClaudeCommandRoute, async (c) => {
    try {
      const { projectId } = c.req.valid('param')
      const body = c.req.valid('json')
      const generatedCommand = await generateCommand(projectId, body)
      return c.json({ success: true, data: generatedCommand })
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error)
      return c.json(
        { success: false, error: { message: apiError.message, code: apiError.code, details: apiError.details } },
        apiError.status as any
      )
    }
  })
  .openapi(suggestClaudeCommandsRoute, async (c) => {
    try {
      const { projectId } = c.req.valid('param')
      const body = c.req.valid('json')

      const suggestions = await suggestCommands(projectId, body?.context || '', body?.limit || 5)

      return c.json({ success: true, data: suggestions })
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error)
      return c.json(
        { success: false, error: { message: apiError.message, code: apiError.code, details: apiError.details } },
        apiError.status as any
      )
    }
  })
