import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { 
  ApiErrorResponseSchema, 
  ProjectIdParamsSchema,
  ClaudeSessionsResponseSchema,
  ClaudeMessagesResponseSchema,
  ClaudeProjectDataResponseSchema,
  ClaudeSessionQuerySchema,
  ClaudeMessageQuerySchema,
  ChatResponseSchema
} from '@promptliano/schemas'
import { claudeCodeMCPService, claudeCodeImportService } from '@promptliano/services'
import { ApiError } from '@promptliano/shared'

// Response schema for MCP status
const MCPStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      claudeDesktop: z.object({
        installed: z.boolean(),
        configExists: z.boolean(),
        hasPromptliano: z.boolean(),
        configPath: z.string().optional(),
        error: z.string().optional()
      }),
      claudeCode: z.object({
        globalConfigExists: z.boolean(),
        globalHasPromptliano: z.boolean(),
        globalConfigPath: z.string().optional(),
        projectConfigExists: z.boolean(),
        projectHasPromptliano: z.boolean(),
        projectConfigPath: z.string().optional(),
        localConfigExists: z.boolean(),
        localHasPromptliano: z.boolean(),
        localConfigPath: z.string().optional(),
        error: z.string().optional()
      }),
      projectId: z.string(),
      installCommand: z.string()
    })
  })
  .openapi('MCPStatusResponse')

// Get MCP status route
const getMCPStatusRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/mcp-status/{projectId}',
  tags: ['Claude Code'],
  summary: 'Get MCP installation status for Claude Code and Claude Desktop',
  description: 'Checks MCP configuration status across Claude Desktop and Claude Code CLI',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MCPStatusResponseSchema } },
      description: 'Successfully retrieved MCP status'
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

// Get sessions route
const getSessionsRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{projectId}',
  tags: ['Claude Code'],
  summary: 'Get all Claude Code chat sessions for a project',
  description: 'Retrieves all chat sessions from Claude Code local storage',
  request: {
    params: ProjectIdParamsSchema,
    query: ClaudeSessionQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeSessionsResponseSchema } },
      description: 'Successfully retrieved sessions'
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

// Get session messages route
const getSessionMessagesRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{projectId}/{sessionId}',
  tags: ['Claude Code'],
  summary: 'Get messages for a specific Claude Code session',
  description: 'Retrieves all messages from a specific chat session',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      sessionId: z.string()
    }),
    query: ClaudeMessageQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeMessagesResponseSchema } },
      description: 'Successfully retrieved messages'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or session not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// Get project data route
const getProjectDataRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/project-data/{projectId}',
  tags: ['Claude Code'],
  summary: 'Get Claude Code project metadata',
  description: 'Retrieves project-level data including branches, working directories, and statistics',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeProjectDataResponseSchema } },
      description: 'Successfully retrieved project data'
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

// Import session to chat route
const importSessionRoute = createRoute({
  method: 'post',
  path: '/api/claude-code/import-session/{projectId}/{sessionId}',
  tags: ['Claude Code'],
  summary: 'Import a Claude Code session into a Promptliano chat',
  description: 'Imports all messages from a Claude Code session into a new Promptliano chat',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      sessionId: z.string()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ChatResponseSchema } },
      description: 'Successfully imported session to chat'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or session not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

export const claudeCodeRoutes = new OpenAPIHono()
  .openapi(getMCPStatusRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    
    try {
      const status = await claudeCodeMCPService.getMCPStatus(projectId)
      return c.json({ 
        success: true, 
        data: status 
      } satisfies z.infer<typeof MCPStatusResponseSchema>, 200)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get MCP status: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_STATUS_FAILED'
      )
    }
  })
  .openapi(getSessionsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      let sessions = await claudeCodeMCPService.getSessions(projectId)
      
      // Apply filters
      if (query.search) {
        const searchLower = query.search.toLowerCase()
        sessions = sessions.filter(s => 
          s.sessionId.toLowerCase().includes(searchLower) ||
          s.gitBranch?.toLowerCase().includes(searchLower) ||
          s.cwd?.toLowerCase().includes(searchLower)
        )
      }
      
      if (query.branch) {
        sessions = sessions.filter(s => s.gitBranch === query.branch)
      }
      
      if (query.startDate) {
        const startTime = new Date(query.startDate).getTime()
        sessions = sessions.filter(s => new Date(s.startTime).getTime() >= startTime)
      }
      
      if (query.endDate) {
        const endTime = new Date(query.endDate).getTime()
        sessions = sessions.filter(s => new Date(s.lastUpdate).getTime() <= endTime)
      }
      
      // Apply pagination
      const start = query.offset || 0
      const limit = query.limit || 50
      const paginated = sessions.slice(start, start + limit)
      
      return c.json({ 
        success: true, 
        data: paginated 
      } satisfies z.infer<typeof ClaudeSessionsResponseSchema>, 200)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get sessions: ${error instanceof Error ? error.message : String(error)}`,
        'GET_SESSIONS_FAILED'
      )
    }
  })
  .openapi(getSessionMessagesRoute, async (c) => {
    const { projectId, sessionId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      let messages = await claudeCodeMCPService.getSessionMessages(projectId, sessionId)
      
      // Apply filters
      if (query.search) {
        const searchLower = query.search.toLowerCase()
        messages = messages.filter(m => {
          const content = typeof m.message.content === 'string' 
            ? m.message.content 
            : m.message.content.map(c => 
                typeof c === 'string' ? c : c.type === 'text' ? c.text : ''
              ).join(' ')
          return content.toLowerCase().includes(searchLower)
        })
      }
      
      if (query.role && query.role !== 'all') {
        messages = messages.filter(m => m.message.role === query.role)
      }
      
      // Apply pagination
      const start = query.offset || 0
      const limit = query.limit || 100
      const paginated = messages.slice(start, start + limit)
      
      return c.json({ 
        success: true, 
        data: paginated 
      } satisfies z.infer<typeof ClaudeMessagesResponseSchema>, 200)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get messages: ${error instanceof Error ? error.message : String(error)}`,
        'GET_MESSAGES_FAILED'
      )
    }
  })
  .openapi(getProjectDataRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    
    try {
      const projectData = await claudeCodeMCPService.getProjectData(projectId)
      
      if (!projectData) {
        throw new ApiError(404, 'No Claude Code data found for this project')
      }
      
      return c.json({ 
        success: true, 
        data: projectData 
      } satisfies z.infer<typeof ClaudeProjectDataResponseSchema>, 200)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get project data: ${error instanceof Error ? error.message : String(error)}`,
        'GET_PROJECT_DATA_FAILED'
      )
    }
  })
  .openapi(importSessionRoute, async (c) => {
    const { projectId, sessionId } = c.req.valid('param')
    
    try {
      const chat = await claudeCodeImportService.importSession(projectId, sessionId)
      
      return c.json({ 
        success: true, 
        data: chat 
      } satisfies z.infer<typeof ChatResponseSchema>, 200)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to import session: ${error instanceof Error ? error.message : String(error)}`,
        'IMPORT_SESSION_FAILED'
      )
    }
  })

export type ClaudeCodeRouteTypes = typeof claudeCodeRoutes