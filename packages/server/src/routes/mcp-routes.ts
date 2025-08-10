import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  CreateMCPServerConfigBodySchema,
  UpdateMCPServerConfigBodySchema,
  MCPServerConfigSchema,
  MCPServerConfigResponseSchema,
  MCPServerConfigListResponseSchema,
  MCPToolListResponseSchema,
  MCPResourceListResponseSchema,
  MCPToolExecutionRequestSchema,
  MCPToolExecutionResultResponseSchema,
  MCPServerStateSchema,
  ApiErrorResponseSchema
} from '@promptliano/schemas'
import {
  createMCPServerConfig,
  getMCPServerConfigById,
  listMCPServerConfigs,
  updateMCPServerConfig,
  deleteMCPServerConfig,
  startMCPServer,
  stopMCPServer,
  getMCPServerState,
  listMCPTools,
  executeMCPTool,
  listMCPResources,
  readMCPResource,
  getMCPClientManager,
  listTicketsWithTaskCount,
  suggestTasksForTicket
} from '@promptliano/services'
import { handleHTTPTransport, getActiveSessions, closeSession } from '../mcp/transport'
import * as projectService from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import { CONSOLIDATED_TOOLS, getAllConsolidatedToolNames } from '../mcp/tools-registry'
import {
  getMCPToolExecutions,
  getMCPAnalyticsOverview,
  getMCPToolStatistics,
  getMCPExecutionTimeline,
  getTopErrorPatterns
} from '@promptliano/services'
import {
  mcpExecutionQuerySchema,
  mcpAnalyticsRequestSchema,
  type MCPExecutionQuery,
  type MCPAnalyticsRequest,
  mcpExecutionQueryRequestSchema
} from '@promptliano/schemas'

export const mcpRoutes = new OpenAPIHono()

// Debug middleware for all MCP routes
mcpRoutes.use('*', async (c, next) => {
  const start = Date.now()
  console.log('[MCP Debug] Request:', {
    method: c.req.method,
    path: c.req.path,
    url: c.req.url,
    params: c.req.param(),
    query: c.req.query()
  })

  await next()

  const duration = Date.now() - start
  console.log('[MCP Debug] Response:', {
    status: c.res.status,
    duration: `${duration}ms`,
    path: c.req.path
  })
})

// ====================
// MCP PROTOCOL ENDPOINTS (Streamable HTTP Transport)
// ====================
// IMPORTANT: These wildcard routes MUST be defined first to avoid conflicts

/**
 * Main MCP endpoint implementing Streamable HTTP transport
 * This is the primary endpoint that Claude Code and other MCP clients connect to
 */
mcpRoutes.all('/api/mcp', async (c) => {
  console.log('[MCP Route] Handling request to /api/mcp', {
    method: c.req.method,
    url: c.req.url,
    headers: c.req.header()
  })
  try {
    const response = await handleHTTPTransport(c)
    console.log('[MCP Route] Response status:', response.status)
    return response
  } catch (error) {
    console.error('[MCP Route] Error handling request:', error)
    throw error
  }
})

/**
 * Project-specific MCP endpoint
 * Provides MCP access with project context
 */
mcpRoutes.all('/api/projects/:projectId/mcp', async (c) => {
  const projectId = c.req.param('projectId')
  console.log('[MCP Route] Handling request to /api/projects/:projectId/mcp', {
    method: c.req.method,
    projectId,
    url: c.req.url,
    headers: c.req.header()
  })
  try {
    const response = await handleHTTPTransport(c)
    console.log('[MCP Route] Response status:', response.status)
    return response
  } catch (error) {
    console.error('[MCP Route] Error handling request:', error)
    throw error
  }
})

// Helper function to handle ApiError responses consistently
const handleApiError = (error: unknown, c: any) => {
  if (error instanceof ApiError) {
    return c.json(
      { success: false, error: { message: error.message, code: error.code, details: error.details } },
      error.status
    )
  }
  return c.json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } }, 500)
}

// MCP Server Config Routes

const createMCPServerConfigRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp-servers',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateMCPServerConfigBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MCPServerConfigResponseSchema
        }
      },
      description: 'MCP server config created successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Project not found'
    }
  }
})

mcpRoutes.openapi(createMCPServerConfigRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    const config = await createMCPServerConfig(projectId, body)
    return c.json({ success: true, data: config })
  } catch (error) {
    return handleApiError(error, c)
  }
})

const listMCPServerConfigsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp-servers',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MCPServerConfigListResponseSchema
        }
      },
      description: 'List of MCP server configs'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Project not found'
    }
  }
})

mcpRoutes.openapi(listMCPServerConfigsRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const configs = await listMCPServerConfigs(projectId)
    return c.json({ success: true, data: configs })
  } catch (error) {
    return handleApiError(error, c)
  }
})

const getMCPServerConfigRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp-servers/{configId}',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      configId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MCPServerConfigResponseSchema
        }
      },
      description: 'MCP server config'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'MCP server config not found'
    }
  }
})

mcpRoutes.openapi(getMCPServerConfigRoute, async (c) => {
  try {
    const { configId } = c.req.valid('param')
    const config = await getMCPServerConfigById(configId)
    return c.json({ success: true, data: config })
  } catch (error) {
    return handleApiError(error, c)
  }
})

const updateMCPServerConfigRoute = createRoute({
  method: 'patch',
  path: '/api/projects/{projectId}/mcp-servers/{configId}',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      configId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateMCPServerConfigBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MCPServerConfigResponseSchema
        }
      },
      description: 'MCP server config updated successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'MCP server config not found'
    }
  }
})

mcpRoutes.openapi(updateMCPServerConfigRoute, async (c) => {
  try {
    const { configId } = c.req.valid('param')
    const body = c.req.valid('json')
    const config = await updateMCPServerConfig(configId, body)
    return c.json({ success: true, data: config })
  } catch (error) {
    return handleApiError(error, c)
  }
})

const deleteMCPServerConfigRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/mcp-servers/{configId}',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      configId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean() })
        }
      },
      description: 'MCP server config deleted successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'MCP server config not found'
    }
  }
})

mcpRoutes.openapi(deleteMCPServerConfigRoute, async (c) => {
  try {
    const { configId } = c.req.valid('param')
    const deleted = await deleteMCPServerConfig(configId)
    return c.json({ success: deleted })
  } catch (error) {
    return handleApiError(error, c)
  }
})

// MCP Server Management Routes

const startMCPServerRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp-servers/{configId}/start',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      configId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: MCPServerStateSchema
          })
        }
      },
      description: 'MCP server started successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'MCP server config not found'
    }
  }
})

mcpRoutes.openapi(startMCPServerRoute, async (c) => {
  try {
    const { configId } = c.req.valid('param')
    const state = await startMCPServer(configId)
    return c.json({ success: true, data: state })
  } catch (error) {
    return handleApiError(error, c)
  }
})

const stopMCPServerRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp-servers/{configId}/stop',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      configId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: MCPServerStateSchema
          })
        }
      },
      description: 'MCP server stopped successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'MCP server config not found'
    }
  }
})

mcpRoutes.openapi(stopMCPServerRoute, async (c) => {
  try {
    const { configId } = c.req.valid('param')
    const state = await stopMCPServer(configId)
    return c.json({ success: true, data: state })
  } catch (error) {
    return handleApiError(error, c)
  }
})

const getMCPServerStateRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp-servers/{configId}/state',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      configId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: MCPServerStateSchema
          })
        }
      },
      description: 'MCP server state'
    }
  }
})

mcpRoutes.openapi(getMCPServerStateRoute, async (c) => {
  try {
    const { configId } = c.req.valid('param')
    const state = await getMCPServerState(configId)
    return c.json({ success: true, data: state })
  } catch (error) {
    return handleApiError(error, c)
  }
})

// MCP Tool Routes

const listMCPToolsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp-tools',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MCPToolListResponseSchema
        }
      },
      description: 'List of available MCP tools'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Project not found'
    }
  }
})

mcpRoutes.openapi(listMCPToolsRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const tools = await listMCPTools(projectId)
    return c.json({ success: true, data: tools })
  } catch (error) {
    return handleApiError(error, c)
  }
})

const executeMCPToolRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp-tools/execute',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: MCPToolExecutionRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MCPToolExecutionResultResponseSchema
        }
      },
      description: 'Tool executed successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Bad request'
    },
    403: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Access denied'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Project or tool not found'
    }
  }
})

mcpRoutes.openapi(executeMCPToolRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const request = c.req.valid('json')
    const result = await executeMCPTool(projectId, request)
    return c.json({ success: true, data: result })
  } catch (error) {
    return handleApiError(error, c)
  }
})

// MCP Resource Routes

const listMCPResourcesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp-resources',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MCPResourceListResponseSchema
        }
      },
      description: 'List of available MCP resources'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Project not found'
    }
  }
})

mcpRoutes.openapi(listMCPResourcesRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const resources = await listMCPResources(projectId)
    return c.json({ success: true, data: resources })
  } catch (error) {
    return handleApiError(error, c)
  }
})

const readMCPResourceRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp-resources/{serverId}',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      serverId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      uri: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any()
          })
        }
      },
      description: 'Resource content'
    },
    403: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Access denied'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Resource not found'
    }
  }
})

mcpRoutes.openapi(readMCPResourceRoute, async (c) => {
  try {
    const { projectId, serverId } = c.req.valid('param')
    const { uri } = c.req.valid('query')
    const content = await readMCPResource(projectId, serverId, uri)
    return c.json({ success: true, data: content })
  } catch (error) {
    return handleApiError(error, c)
  }
})

// ====================
// MCP BUILTIN TOOLS REGISTRY
// ====================

/**
 * Get all built-in MCP tools from the registry
 */
const getBuiltinToolsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/builtin-tools',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              tools: z.array(
                z.object({
                  name: z.string(),
                  description: z.string(),
                  inputSchema: z.any()
                })
              ),
              toolNames: z.array(z.string()),
              totalCount: z.number()
            })
          })
        }
      },
      description: 'List of all built-in MCP tools'
    }
  }
})

mcpRoutes.openapi(getBuiltinToolsRoute, async (c) => {
  try {
    const tools = CONSOLIDATED_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))

    const toolNames = getAllConsolidatedToolNames()

    return c.json({
      success: true,
      data: {
        tools,
        toolNames,
        totalCount: tools.length
      }
    })
  } catch (error) {
    return handleApiError(error, c)
  }
})

// (MCP protocol endpoints moved to top of file to ensure proper route priority)

// ====================
// MCP SESSION MANAGEMENT
// ====================

/**
 * Get active MCP sessions
 */
const getMCPSessionsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/sessions',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(
              z.object({
                id: z.string(),
                projectId: z.number().optional(),
                createdAt: z.number(),
                lastActivity: z.number()
              })
            )
          })
        }
      },
      description: 'List of active MCP sessions'
    }
  }
})

mcpRoutes.openapi(getMCPSessionsRoute, async (c) => {
  const sessions = getActiveSessions()
  return c.json({ success: true, data: sessions })
})

/**
 * Close an MCP session
 */
const closeMCPSessionRoute = createRoute({
  method: 'delete',
  path: '/api/mcp/sessions/{sessionId}',
  request: {
    params: z.object({
      sessionId: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean() })
        }
      },
      description: 'Session closed successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Session not found'
    }
  }
})

mcpRoutes.openapi(closeMCPSessionRoute, async (c) => {
  try {
    const { sessionId } = c.req.valid('param')
    const closed = closeSession(sessionId)

    if (!closed) {
      throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND')
    }

    return c.json({ success: true })
  } catch (error) {
    return handleApiError(error, c)
  }
})

// ====================
// ADDITIONAL MCP UTILITIES
// ====================

/**
 * Suggest files as an MCP resource
 * This provides the suggest files functionality as an MCP-compatible resource
 */
const suggestFilesResourceRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/suggest-files',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            prompt: z.string().min(1).describe('The prompt to analyze for file suggestions'),
            limit: z.number().int().positive().optional().default(10).describe('Maximum number of files to suggest')
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              uri: z.string(),
              name: z.string(),
              description: z.string(),
              mimeType: z.string(),
              content: z.any()
            })
          })
        }
      },
      description: 'Suggest files resource content'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Project not found'
    }
  }
})

mcpRoutes.openapi(suggestFilesResourceRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { prompt, limit = 10 } = c.req.valid('json')

    const suggestedFiles = await projectService.suggestFiles(projectId, prompt, limit)

    const resourceContent = {
      uri: `promptliano://projects/${projectId}/suggest-files`,
      name: 'File Suggestions',
      description: `AI-suggested files based on: "${prompt}"`,
      mimeType: 'application/json',
      content: {
        prompt,
        limit,
        suggestions: suggestedFiles.map((file) => ({
          id: file.id,
          name: file.name,
          path: file.path,
          extension: file.extension,
          summary: file.summary,
          size: file.size
        }))
      }
    }

    return c.json({ success: true, data: resourceContent })
  } catch (error) {
    console.error('[MCP SuggestFiles] Error:', error)
    return handleApiError(error, c)
  }
})

/**
 * Get compact project summary as an MCP resource
 * This provides a condensed, AI-optimized project overview for quick context
 */
const getCompactProjectSummaryRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/compact-summary',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              uri: z.string(),
              name: z.string(),
              description: z.string(),
              mimeType: z.string(),
              content: z.string()
            })
          })
        }
      },
      description: 'Compact project summary resource content'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Project not found'
    }
  }
})

mcpRoutes.openapi(getCompactProjectSummaryRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')

    const compactSummary = await projectService.getProjectCompactSummary(projectId)

    const resourceContent = {
      uri: `promptliano://projects/${projectId}/compact-summary`,
      name: 'Compact Project Summary',
      description: 'AI-generated compact overview of project architecture and structure',
      mimeType: 'text/markdown',
      content: compactSummary
    }

    return c.json({ success: true, data: resourceContent })
  } catch (error) {
    console.error('[MCP CompactSummary] Error:', error)
    return handleApiError(error, c)
  }
})

// ====================
// TICKET MCP ROUTES
// ====================

/**
 * List tickets as MCP resource
 */
const listTicketsResourceRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/tickets',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      status: z.enum(['open', 'in_progress', 'closed']).optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              uri: z.string(),
              name: z.string(),
              description: z.string(),
              mimeType: z.string(),
              content: z.object({
                tickets: z.array(z.any())
              })
            })
          })
        }
      },
      description: 'Tickets resource content'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Project not found'
    }
  }
})

mcpRoutes.openapi(listTicketsResourceRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { status } = c.req.valid('query')

    const tickets = await listTicketsWithTaskCount(projectId, status)

    const resourceContent = {
      uri: `promptliano://projects/${projectId}/tickets`,
      name: 'Project Tickets',
      description: `Tickets for project ${projectId}${status ? ` filtered by status: ${status}` : ''}`,
      mimeType: 'application/json',
      content: { tickets }
    }

    return c.json({ success: true, data: resourceContent })
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Get AI-suggested tasks for a ticket
 */
const suggestTicketTasksRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/mcp/suggest-tasks',
  request: {
    params: z.object({
      ticketId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userContext: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              ticketId: z.number(),
              suggestions: z.array(z.string())
            })
          })
        }
      },
      description: 'AI-suggested tasks'
    },
    404: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Ticket not found'
    }
  }
})

mcpRoutes.openapi(suggestTicketTasksRoute, async (c) => {
  try {
    const { ticketId } = c.req.valid('param')
    const { userContext } = c.req.valid('json')

    const suggestions = await suggestTasksForTicket(ticketId, userContext)

    return c.json({
      success: true,
      data: {
        ticketId,
        suggestions
      }
    })
  } catch (error) {
    return handleApiError(error, c)
  }
})

// ====================
// MCP TESTING ENDPOINTS
// ====================

/**
 * Test MCP connection
 */
const testMCPConnectionRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/test-connection',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().describe('MCP server URL to test')
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              connected: z.boolean(),
              responseTime: z.number(),
              error: z.string().optional(),
              serverInfo: z.any().optional()
            })
          })
        }
      },
      description: 'Connection test result'
    }
  }
})

mcpRoutes.openapi(testMCPConnectionRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { url } = c.req.valid('json')

    const startTime = Date.now()

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'User-Agent': 'Promptliano-MCP-Tester/1.0'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      const responseTime = Date.now() - startTime

      if (response.ok) {
        // Try to read a bit of the response to see if it's valid SSE
        const reader = response.body?.getReader()
        let serverInfo = null

        if (reader) {
          try {
            const { value } = await reader.read()
            if (value) {
              const text = new TextDecoder().decode(value)
              // Try to parse SSE data
              const dataMatch = text.match(/data: (.+)/)
              if (dataMatch) {
                serverInfo = JSON.parse(dataMatch[1])
              }
            }
          } catch (e) {
            // Ignore parsing errors
          } finally {
            reader.releaseLock()
          }
        }

        return c.json({
          success: true,
          data: {
            connected: true,
            responseTime,
            serverInfo
          }
        })
      } else {
        return c.json({
          success: true,
          data: {
            connected: false,
            responseTime,
            error: `HTTP ${response.status}: ${response.statusText}`
          }
        })
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      return c.json({
        success: true,
        data: {
          connected: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Test MCP initialize handshake
 */
const testMCPInitializeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/test-initialize',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().describe('MCP server URL to test')
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              initialized: z.boolean(),
              sessionId: z.string().optional(),
              capabilities: z.any().optional(),
              serverInfo: z.any().optional(),
              error: z.string().optional()
            })
          })
        }
      },
      description: 'Initialize test result'
    }
  }
})

mcpRoutes.openapi(testMCPInitializeRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { url } = c.req.valid('json')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Promptliano-MCP-Tester/1.0'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: true,
              resources: true,
              prompts: false
            },
            clientInfo: {
              name: 'promptliano-tester',
              version: '0.9.0'
            }
          }
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (response.ok) {
        const result = (await response.json()) as any
        const sessionId = response.headers.get('Mcp-Session-Id')

        if (result.error) {
          return c.json({
            success: true,
            data: {
              initialized: false,
              error: `JSON-RPC Error: ${result.error.message} (Code: ${result.error.code})`
            }
          })
        }

        return c.json({
          success: true,
          data: {
            initialized: true,
            sessionId: sessionId || undefined,
            capabilities: result.result?.capabilities,
            serverInfo: result.result?.serverInfo
          }
        })
      } else {
        return c.json({
          success: true,
          data: {
            initialized: false,
            error: `HTTP ${response.status}: ${response.statusText}`
          }
        })
      }
    } catch (error) {
      return c.json({
        success: true,
        data: {
          initialized: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  } catch (error) {
    return handleApiError(error, c)
  }
})

// ====================
// MCP ANALYTICS ROUTES
// ====================

/**
 * Get MCP tool executions with filtering
 */
const getMCPExecutionsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/analytics/executions',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: mcpExecutionQueryRequestSchema.partial()
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              executions: z.array(z.any()), // TODO: Use proper execution schema
              total: z.number(),
              page: z.number(),
              pageSize: z.number()
            })
          })
        }
      },
      description: 'MCP tool executions'
    }
  }
})

mcpRoutes.openapi(getMCPExecutionsRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')

    // Ensure numeric values for limit and offset
    const executionQuery: MCPExecutionQuery = {
      ...query,
      projectId,
      limit: query?.limit ? parseInt(String(query.limit), 10) : 100,
      offset: query?.offset ? parseInt(String(query.offset), 10) : 0
    }

    const result = await getMCPToolExecutions(executionQuery)

    return c.json({ success: true, data: result })
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Get MCP analytics overview
 */
const getMCPAnalyticsOverviewRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/analytics/overview',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: mcpAnalyticsRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.any() // TODO: Use proper overview schema
          })
        }
      },
      description: 'MCP analytics overview'
    }
  }
})

mcpRoutes.openapi(getMCPAnalyticsOverviewRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const overview = await getMCPAnalyticsOverview(projectId, body?.startDate, body?.endDate)

    return c.json({ success: true, data: overview })
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Get MCP tool statistics
 */
const getMCPToolStatisticsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/analytics/statistics',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: mcpAnalyticsRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.any()) // TODO: Use proper statistics schema
          })
        }
      },
      description: 'MCP tool statistics'
    }
  }
})

mcpRoutes.openapi(getMCPToolStatisticsRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const statistics = await getMCPToolStatistics({
      ...body,
      projectId
    })

    return c.json({ success: true, data: statistics })
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Get MCP execution timeline
 */
const getMCPExecutionTimelineRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/analytics/timeline',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: mcpAnalyticsRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.any()) // TODO: Use proper timeline schema
          })
        }
      },
      description: 'MCP execution timeline'
    }
  }
})

mcpRoutes.openapi(getMCPExecutionTimelineRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const timeline = await getMCPExecutionTimeline(projectId, body?.period || 'day', body?.startDate, body?.endDate)

    return c.json({ success: true, data: timeline })
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Get global MCP analytics (across all projects)
 */
const getGlobalMCPAnalyticsRoute = createRoute({
  method: 'post',
  path: '/api/mcp/analytics/global',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            startDate: z.number().optional(),
            endDate: z.number().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.any() // TODO: Use proper overview schema
          })
        }
      },
      description: 'Global MCP analytics'
    }
  }
})

mcpRoutes.openapi(getGlobalMCPAnalyticsRoute, async (c) => {
  try {
    const body = c.req.valid('json')

    const overview = await getMCPAnalyticsOverview(undefined, body?.startDate, body?.endDate)

    return c.json({ success: true, data: overview })
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Get top error patterns
 */
const getMCPErrorPatternsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/analytics/error-patterns',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: mcpAnalyticsRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(
              z.object({
                pattern: z.any(),
                count: z.number(),
                lastSeen: z.number()
              })
            )
          })
        }
      },
      description: 'Top error patterns'
    }
  }
})

mcpRoutes.openapi(getMCPErrorPatternsRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const patterns = await getTopErrorPatterns(projectId, 10)

    return c.json({ success: true, data: patterns })
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Test MCP method
 */
const testMCPMethodRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/test-method',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().describe('MCP server URL'),
            method: z.string().describe('JSON-RPC method name'),
            params: z.any().optional().describe('Method parameters'),
            sessionId: z.string().optional().describe('MCP session ID')
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              request: z.any(),
              response: z.any(),
              responseTime: z.number(),
              error: z.string().optional()
            })
          })
        }
      },
      description: 'Method test result'
    }
  }
})

mcpRoutes.openapi(testMCPMethodRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { url, method, params, sessionId } = c.req.valid('json')

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: params || {}
    }

    const startTime = Date.now()

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Promptliano-MCP-Tester/1.0'
      }

      if (sessionId) {
        headers['Mcp-Session-Id'] = sessionId
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      })

      const responseTime = Date.now() - startTime
      const responseData = await response.json()

      return c.json({
        success: true,
        data: {
          request,
          response: responseData,
          responseTime,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
        }
      })
    } catch (error) {
      const responseTime = Date.now() - startTime
      return c.json({
        success: true,
        data: {
          request,
          response: null,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  } catch (error) {
    return handleApiError(error, c)
  }
})

/**
 * Get MCP test data for project
 */
const getMCPTestDataRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/test-data',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              projectId: z.number(),
              projectName: z.string(),
              mcpEndpoints: z.object({
                main: z.string(),
                projectSpecific: z.string()
              }),
              sampleMethods: z.array(
                z.object({
                  method: z.string(),
                  description: z.string(),
                  params: z.any(),
                  example: z.any()
                })
              ),
              sampleFiles: z
                .array(
                  z.object({
                    path: z.string(),
                    name: z.string(),
                    id: z.number()
                  })
                )
                .optional()
            })
          })
        }
      },
      description: 'MCP test data for project'
    }
  }
})

mcpRoutes.openapi(getMCPTestDataRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')

    // Get project info
    const project = await projectService.getProjectById(projectId)

    // Get some sample files from the project
    const projectFiles = await projectService.getProjectFiles(projectId)
    const sampleFiles = (projectFiles || []).slice(0, 5).map((file) => ({
      path: file.path,
      name: file.name,
      id: file.id
    }))

    const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3147' : 'http://localhost:3147'

    const testData = {
      projectId,
      projectName: project.name,
      mcpEndpoints: {
        main: `${baseUrl}/api/mcp`,
        projectSpecific: `${baseUrl}/api/projects/${projectId}/mcp`
      },
      sampleMethods: [
        {
          method: 'initialize',
          description: 'Initialize MCP session and negotiate capabilities',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: true,
              resources: true,
              prompts: false
            },
            clientInfo: {
              name: 'promptliano-tester',
              version: '0.9.0'
            }
          },
          example: {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: true, resources: true },
              clientInfo: { name: 'promptliano-tester', version: '0.9.0' }
            }
          }
        },
        {
          method: 'tools/list',
          description: 'List all available tools',
          params: {},
          example: {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
          }
        },
        {
          method: 'resources/list',
          description: 'List all available resources',
          params: {},
          example: {
            jsonrpc: '2.0',
            id: 3,
            method: 'resources/list',
            params: {}
          }
        },
        {
          method: 'tools/call',
          description: 'Execute a tool',
          params: {
            name: 'file_read',
            arguments: {
              path: sampleFiles[0]?.path || '/README.md'
            }
          },
          example: {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
              name: 'file_read',
              arguments: { path: sampleFiles[0]?.path || '/README.md' }
            }
          }
        },
        {
          method: 'ping',
          description: 'Health check endpoint',
          params: {},
          example: {
            jsonrpc: '2.0',
            id: 5,
            method: 'ping',
            params: {}
          }
        }
      ],
      sampleFiles
    }

    return c.json({ success: true, data: testData })
  } catch (error) {
    return handleApiError(error, c)
  }
})
