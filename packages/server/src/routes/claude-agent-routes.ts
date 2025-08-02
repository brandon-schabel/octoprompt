import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  ProjectIdParamsSchema,
  AgentIdParamsSchema,
  CreateClaudeAgentBodySchema,
  UpdateClaudeAgentBodySchema,
  ClaudeAgentResponseSchema,
  ClaudeAgentListResponseSchema,
  SuggestAgentsRequestSchema,
  AgentSuggestionsResponseSchema
} from '@promptliano/schemas'
import {
  createAgent,
  listAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  getAgentsByProjectId,
  suggestAgents,
  getProjectById
} from '@promptliano/services'
import { ApiError } from '@promptliano/shared'

const createClaudeAgentRoute = createRoute({
  method: 'post',
  path: '/api/agents',
  tags: ['Claude Agents'],
  summary: 'Create a new Claude agent',
  request: {
    query: z.object({
      projectId: z.coerce.number().optional()
    }),
    body: {
      content: { 'application/json': { schema: CreateClaudeAgentBodySchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ClaudeAgentResponseSchema } },
      description: 'Agent created successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request - projectId required'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Referenced project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const listAllClaudeAgentsRoute = createRoute({
  method: 'get',
  path: '/api/agents',
  tags: ['Claude Agents'],
  summary: 'List all available Claude agents',
  request: {
    query: z.object({
      projectId: z.coerce.number().optional()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeAgentListResponseSchema } },
      description: 'Successfully retrieved all agents'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request - projectId required'
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

const getClaudeAgentByIdRoute = createRoute({
  method: 'get',
  path: '/api/agents/{agentId}',
  tags: ['Claude Agents'],
  summary: 'Get a specific Claude agent by its ID',
  request: {
    params: AgentIdParamsSchema,
    query: z.object({
      projectId: z.coerce.number().optional()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeAgentResponseSchema } },
      description: 'Successfully retrieved agent'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request - projectId required'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Agent not found'
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

const updateClaudeAgentRoute = createRoute({
  method: 'patch',
  path: '/api/agents/{agentId}',
  tags: ['Claude Agents'],
  summary: "Update a Claude agent's details",
  request: {
    params: AgentIdParamsSchema,
    query: z.object({
      projectId: z.coerce.number().optional()
    }),
    body: {
      content: { 'application/json': { schema: UpdateClaudeAgentBodySchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeAgentResponseSchema } },
      description: 'Agent updated successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request - projectId required'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Agent not found'
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

const deleteClaudeAgentRoute = createRoute({
  method: 'delete',
  path: '/api/agents/{agentId}',
  tags: ['Claude Agents'],
  summary: 'Delete a Claude agent',
  request: {
    params: AgentIdParamsSchema,
    query: z.object({
      projectId: z.coerce.number().optional()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Agent deleted successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request - projectId required'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Agent not found'
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

const listProjectClaudeAgentsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/agents',
  tags: ['Projects', 'Claude Agents'],
  summary: 'List Claude agents associated with a specific project',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeAgentListResponseSchema } },
      description: 'Successfully retrieved project agents'
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
      description: 'Internal Server Error'
    }
  }
})


const suggestClaudeAgentsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/suggest-agents',
  tags: ['Projects', 'Claude Agents', 'AI'],
  summary: 'Get AI-suggested Claude agents based on user input',
  description: 'Uses AI to analyze user input and suggest the most relevant agents for the task',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: SuggestAgentsRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AgentSuggestionsResponseSchema } },
      description: 'Successfully retrieved suggested agents'
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
      description: 'Internal Server Error'
    }
  }
})

export const claudeAgentRoutes = new OpenAPIHono()
  .openapi(createClaudeAgentRoute, async (c) => {
    const body = c.req.valid('json')
    const { projectId } = c.req.valid('query')

    const effectiveProjectId = projectId || body.projectId
    if (!effectiveProjectId) {
      throw new ApiError(400, 'projectId is required either in query or body', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(effectiveProjectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const createdAgent = await createAgent(project.path, { ...body, projectId: effectiveProjectId })
    return c.json({ success: true, data: createdAgent } satisfies z.infer<typeof ClaudeAgentResponseSchema>, 201)
  })
  .openapi(listAllClaudeAgentsRoute, async (c) => {
    const { projectId } = c.req.valid('query')

    if (!projectId) {
      throw new ApiError(400, 'projectId query parameter is required', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const agents = await listAgents(project.path)
    return c.json({ success: true, data: agents } satisfies z.infer<typeof ClaudeAgentListResponseSchema>, 200)
  })
  .openapi(getClaudeAgentByIdRoute, async (c) => {
    const { agentId } = c.req.valid('param')
    const { projectId } = c.req.valid('query')

    if (!projectId) {
      throw new ApiError(400, 'projectId query parameter is required', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const agent = await getAgentById(project.path, agentId.toString())
    return c.json({ success: true, data: agent } satisfies z.infer<typeof ClaudeAgentResponseSchema>, 200)
  })
  .openapi(updateClaudeAgentRoute, async (c) => {
    const { agentId } = c.req.valid('param')
    const body = c.req.valid('json')
    const { projectId } = c.req.valid('query')

    if (!projectId) {
      throw new ApiError(400, 'projectId query parameter is required', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const updatedAgent = await updateAgent(project.path, agentId.toString(), body)
    return c.json({ success: true, data: updatedAgent } satisfies z.infer<typeof ClaudeAgentResponseSchema>, 200)
  })
  .openapi(deleteClaudeAgentRoute, async (c) => {
    const { agentId } = c.req.valid('param')
    const { projectId } = c.req.valid('query')

    if (!projectId) {
      throw new ApiError(400, 'projectId query parameter is required', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    await deleteAgent(project.path, agentId.toString())
    return c.json(
      { success: true, message: 'Agent deleted successfully.' } satisfies z.infer<
        typeof OperationSuccessResponseSchema
      >,
      200
    )
  })
  .openapi(listProjectClaudeAgentsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }
    // Use listAgents to read all agents from the project's .claude/agents directory
    const agents = await listAgents(project.path)
    return c.json({ success: true, data: agents } satisfies z.infer<typeof ClaudeAgentListResponseSchema>, 200)
  })
  .openapi(suggestClaudeAgentsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { userInput, limit } = c.req.valid('json')
    const suggestedAgents = await suggestAgents(projectId, userInput, limit)
    return c.json(
      { success: true, data: { agents: suggestedAgents } } satisfies z.infer<typeof AgentSuggestionsResponseSchema>,
      200
    )
  })

export type ClaudeAgentRouteTypes = typeof claudeAgentRoutes
