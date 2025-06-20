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
} from '@octoprompt/schemas'
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
  getMCPClientManager
} from '@octoprompt/services'
import { handleHTTPTransport, getActiveSessions, closeSession } from '../mcp/transport'
import * as projectService from '@octoprompt/services'

export const mcpRoutes = new OpenAPIHono()

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
  const { projectId } = c.req.valid('param')
  const body = c.req.valid('json')
  const config = await createMCPServerConfig(projectId, body)
  return c.json({ success: true, data: config })
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
  const { projectId } = c.req.valid('param')
  const configs = await listMCPServerConfigs(projectId)
  return c.json({ success: true, data: configs })
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
  const { configId } = c.req.valid('param')
  const config = await getMCPServerConfigById(configId)
  return c.json({ success: true, data: config })
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
  const { configId } = c.req.valid('param')
  const body = c.req.valid('json')
  const config = await updateMCPServerConfig(configId, body)
  return c.json({ success: true, data: config })
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
  const { configId } = c.req.valid('param')
  const deleted = await deleteMCPServerConfig(configId)
  return c.json({ success: deleted })
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
  const { configId } = c.req.valid('param')
  const state = await startMCPServer(configId)
  return c.json({ success: true, data: state })
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
  const { configId } = c.req.valid('param')
  const state = await stopMCPServer(configId)
  return c.json({ success: true, data: state })
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
  const { configId } = c.req.valid('param')
  const state = await getMCPServerState(configId)
  return c.json({ success: true, data: state })
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
  const { projectId } = c.req.valid('param')
  const tools = await listMCPTools(projectId)
  return c.json({ success: true, data: tools })
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
  const { projectId } = c.req.valid('param')
  const request = c.req.valid('json')
  const result = await executeMCPTool(projectId, request)
  return c.json({ success: true, data: result })
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
  const { projectId } = c.req.valid('param')
  const resources = await listMCPResources(projectId)
  return c.json({ success: true, data: resources })
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
  const { projectId, serverId } = c.req.valid('param')
  const { uri } = c.req.valid('query')
  const content = await readMCPResource(projectId, serverId, uri)
  return c.json({ success: true, data: content })
})

// MCP Server Transport Routes (for direct MCP protocol access)

/**
 * MCP Server endpoint for HTTP transport (SSE)
 * This is used by Cursor and other HTTP-based MCP clients
 */
mcpRoutes.get('/api/mcp', async (c) => {
  return await handleHTTPTransport(c)
})

/**
 * MCP Server endpoint with project context
 */
mcpRoutes.get('/api/projects/:projectId/mcp', async (c) => {
  return await handleHTTPTransport(c)
})

/**
 * Handle MCP message POST requests
 * This endpoint would be used for SSE transport message handling
 */
mcpRoutes.post('/api/mcp/messages', async (c) => {
  // Placeholder for SSE message handling
  return c.json({
    success: false,
    error: {
      message: 'SSE transport not yet implemented',
      code: 'NOT_IMPLEMENTED'
    }
  }, 501)
})

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
            data: z.array(z.object({
              id: z.string(),
              projectId: z.number().optional(),
              createdAt: z.number(),
              lastActivity: z.number()
            }))
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
  const { sessionId } = c.req.valid('param')
  const closed = closeSession(sessionId)

  if (!closed) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      },
      404
    )
  }

  return c.json({ success: true })
})

// Additional MCP Management Routes

/**
 * Get connection info for an MCP server
 */
const getMCPConnectionInfoRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp-servers/{configId}/connection',
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
            data: z.object({
              serverId: z.number(),
              transport: z.enum(['stdio', 'websocket', 'http']),
              endpoint: z.string().optional(),
              capabilities: z.object({
                tools: z.boolean(),
                resources: z.boolean(),
                prompts: z.boolean(),
                sampling: z.boolean()
              }).optional()
            })
          })
        }
      },
      description: 'MCP server connection information'
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

mcpRoutes.openapi(getMCPConnectionInfoRoute, async (c) => {
  const { configId } = c.req.valid('param')
  const config = await getMCPServerConfigById(configId)
  const state = await getMCPServerState(configId)

  return c.json({
    success: true,
    data: {
      serverId: config.id,
      transport: 'stdio' as const,
      capabilities: {
        tools: true,
        resources: true,
        prompts: false, // Not yet implemented
        sampling: false // Not yet implemented
      }
    }
  })
})

/**
 * List all active MCP servers across all projects
 */
const listAllActiveMCPServersRoute = createRoute({
  method: 'get',
  path: '/api/mcp-servers/active',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(z.object({
              config: MCPServerConfigSchema,
              state: MCPServerStateSchema
            }))
          })
        }
      },
      description: 'List of all active MCP servers'
    }
  }
})

mcpRoutes.openapi(listAllActiveMCPServersRoute, async (c) => {
  const manager = getMCPClientManager()
  const activeServers = await manager.getActiveServers()

  const serversWithState = await Promise.all(
    activeServers.map(async (config) => {
      const state = await getMCPServerState(config.id)
      return { config, state }
    })
  )

  return c.json({ success: true, data: serversWithState })
})

/**
 * Restart an MCP server
 */
const restartMCPServerRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp-servers/{configId}/restart',
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
      description: 'MCP server restarted successfully'
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

mcpRoutes.openapi(restartMCPServerRoute, async (c) => {
  const { configId } = c.req.valid('param')

  // Stop the server first
  await stopMCPServer(configId)

  // Wait a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Start it again
  const state = await startMCPServer(configId)

  return c.json({ success: true, data: state })
})

/**
 * Get health/status of all MCP servers for a project
 */
const getMCPHealthRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp-servers/health',
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
              total: z.number(),
              running: z.number(),
              stopped: z.number(),
              error: z.number(),
              servers: z.array(z.object({
                id: z.number(),
                name: z.string(),
                status: z.enum(['stopped', 'starting', 'running', 'error']),
                lastHeartbeat: z.number().nullable()
              }))
            })
          })
        }
      },
      description: 'Health status of all MCP servers'
    }
  }
})

mcpRoutes.openapi(getMCPHealthRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const configs = await listMCPServerConfigs(projectId)

  const serversHealth = await Promise.all(
    configs.map(async (config) => {
      const state = await getMCPServerState(config.id)
      return {
        id: config.id,
        name: config.name,
        status: state.status,
        lastHeartbeat: state.lastHeartbeat
      }
    })
  )

  const statusCounts = serversHealth.reduce(
    (acc, server) => {
      acc[server.status]++
      return acc
    },
    { running: 0, stopped: 0, error: 0, starting: 0 }
  )

  return c.json({
    success: true,
    data: {
      total: serversHealth.length,
      running: statusCounts.running,
      stopped: statusCounts.stopped,
      error: statusCounts.error,
      servers: serversHealth
    }
  })
})

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
  const { projectId } = c.req.valid('param')
  const { prompt, limit = 10 } = c.req.valid('json')

  try {
    const suggestedFiles = await projectService.suggestFiles(projectId, prompt, limit)

    const resourceContent = {
      uri: `octoprompt://projects/${projectId}/suggest-files`,
      name: 'File Suggestions',
      description: `AI-suggested files based on: "${prompt}"`,
      mimeType: 'application/json',
      content: {
        prompt,
        limit,
        suggestions: suggestedFiles.map(file => ({
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
  } catch (error: any) {
    console.error('[MCP SuggestFiles] Error:', error)
    if (error instanceof ApiError) throw error
    throw new ApiError(500, `Failed to suggest files: ${error.message}`, 'MCP_SUGGEST_FILES_ERROR')
  }
})