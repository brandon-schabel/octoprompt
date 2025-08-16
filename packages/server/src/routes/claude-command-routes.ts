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
import { ApiError } from '@promptliano/shared'
import { createStandardResponses, createStandardResponsesWithStatus, successResponse, operationSuccessResponse } from '../utils/route-helpers'

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
    ...createStandardResponsesWithStatus(ClaudeCommandResponseSchema, 201, 'Command created successfully'),
    409: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Command already exists'
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
  responses: createStandardResponses(ClaudeCommandListResponseSchema)
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
  responses: createStandardResponses(ClaudeCommandResponseSchema)
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
  responses: createStandardResponses(ClaudeCommandResponseSchema)
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
  responses: createStandardResponses(OperationSuccessResponseSchema)
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
  responses: createStandardResponses(CommandExecutionResponseSchema)
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
  responses: createStandardResponses(CommandGenerationResponseSchema)
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
  responses: createStandardResponses(CommandSuggestionsResponseSchema)
})

export const claudeCommandRoutes = new OpenAPIHono()
  .openapi(createClaudeCommandRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    
    const command = await createCommand(project.path, body)
    return c.json(successResponse(command), 201) as any
  })
  .openapi(listClaudeCommandsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    
    const commands = await listCommands(project.path, query)
    return c.json(successResponse(commands)) as any
  })
  .openapi(getClaudeCommandRoute, async (c) => {
    const { projectId, commandName } = c.req.valid('param')
    const { namespace } = c.req.valid('query')

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    
    const command = await getCommandByName(project.path, commandName, namespace)
    return c.json(successResponse(command)) as any
  })
  .openapi(updateClaudeCommandRoute, async (c) => {
    const { projectId, commandName } = c.req.valid('param')
    const { namespace } = c.req.valid('query')
    const body = c.req.valid('json')

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    
    const command = await updateCommand(project.path, commandName, body, namespace)
    return c.json(successResponse(command)) as any
  })
  .openapi(deleteClaudeCommandRoute, async (c) => {
    const { projectId, commandName } = c.req.valid('param')
    const { namespace } = c.req.valid('query')

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    
    await deleteCommand(project.path, commandName, namespace)
    return c.json(operationSuccessResponse('Command deleted successfully')) as any
  })
  .openapi(executeClaudeCommandRoute, async (c) => {
    const { projectId, commandName } = c.req.valid('param')
    const { namespace } = c.req.valid('query')
    const body = c.req.valid('json')

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    
    const result = await executeCommand(project.path, commandName, body?.arguments, namespace)
    
    const responseData = {
      result: result.result,
      usage: result.metadata?.usage ? {
        inputTokens: result.metadata.usage.inputTokens || 0,
        outputTokens: result.metadata.usage.outputTokens || 0,
        totalTokens: result.metadata.usage.totalTokens || 0
      } : undefined,
      model: result.metadata?.model,
      sessionId: result.metadata?.sessionId
    }
    
    return c.json(successResponse(responseData)) as any
  })
  .openapi(generateClaudeCommandRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    
    const generatedCommand = await generateCommand(projectId, body)
    return c.json(successResponse(generatedCommand)) as any
  })
  .openapi(suggestClaudeCommandsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const suggestions = await suggestCommands(projectId, body?.context || '', body?.limit || 5)
    return c.json(successResponse(suggestions)) as any
  })
