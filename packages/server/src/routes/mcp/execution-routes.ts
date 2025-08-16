/**
 * MCP Execution Routes
 * Handles MCP tool and resource execution
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  MCPToolExecutionRequestSchema,
  MCPToolExecutionResultResponseSchema,
  MCPResourceListResponseSchema
} from '@promptliano/schemas'
import {
  listMCPTools,
  executeMCPTool,
  listMCPResources,
  readMCPResource,
  startMCPServer,
  stopMCPServer
} from '@promptliano/services'
import { createStandardResponses, successResponse } from '../../utils/route-helpers'

// List MCP tools
const listMCPToolsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/tools',
  tags: ['MCP', 'Tools'],
  summary: 'List available MCP tools',
  request: {
    query: z.object({
      serverId: z.string().optional()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.array(z.object({
      name: z.string(),
      description: z.string(),
      serverId: z.string().optional()
    }))
  }))
})

// Execute MCP tool
const executeMCPToolRoute = createRoute({
  method: 'post',
  path: '/api/mcp/tools/execute',
  tags: ['MCP', 'Tools'],
  summary: 'Execute an MCP tool',
  request: {
    body: {
      content: { 'application/json': { schema: MCPToolExecutionRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(MCPToolExecutionResultResponseSchema)
})

// List MCP resources
const listMCPResourcesRoute = createRoute({
  method: 'get',
  path: '/api/mcp/resources',
  tags: ['MCP', 'Resources'],
  summary: 'List available MCP resources',
  request: {
    query: z.object({
      serverId: z.string().optional()
    })
  },
  responses: createStandardResponses(MCPResourceListResponseSchema)
})

// Read MCP resource
const readMCPResourceRoute = createRoute({
  method: 'post',
  path: '/api/mcp/resources/read',
  tags: ['MCP', 'Resources'],
  summary: 'Read MCP resource content',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            uri: z.string(),
            serverId: z.string().optional()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      uri: z.string(),
      name: z.string(),
      description: z.string(),
      mimeType: z.string(),
      content: z.any()
    })
  }))
})

// Get builtin tools
const getBuiltinToolsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/builtin-tools',
  tags: ['MCP', 'Tools'],
  summary: 'Get list of built-in MCP tools',
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.array(z.object({
      name: z.string(),
      description: z.string(),
      category: z.string()
    }))
  }))
})

// Start MCP server
const startMCPServerRoute = createRoute({
  method: 'post',
  path: '/api/mcp/servers/{serverId}/start',
  tags: ['MCP', 'Execution'],
  summary: 'Start an MCP server',
  request: {
    params: z.object({
      serverId: z.string()
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Stop MCP server
const stopMCPServerRoute = createRoute({
  method: 'post',
  path: '/api/mcp/servers/{serverId}/stop',
  tags: ['MCP', 'Execution'],
  summary: 'Stop an MCP server',
  request: {
    params: z.object({
      serverId: z.string()
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Export routes
export const mcpExecutionRoutes = new OpenAPIHono()
  .openapi(listMCPToolsRoute, async (c) => {
    const { serverId } = c.req.valid('query')
    // TODO: Need projectId
    const tools = await listMCPTools(1)
    return c.json(successResponse(tools))
  })
  .openapi(executeMCPToolRoute, async (c) => {
    const body = c.req.valid('json')
    const result = await executeMCPTool(
      1, // TODO: projectId
      body.name || '',
      body.arguments || {}
    )
    return c.json(successResponse(result))
  })
  .openapi(listMCPResourcesRoute, async (c) => {
    const { serverId } = c.req.valid('query')
    // TODO: Need projectId
    const resources = await listMCPResources(1)
    return c.json(successResponse(resources))
  })
  .openapi(readMCPResourceRoute, async (c) => {
    const body = c.req.valid('json')
    const content = await readMCPResource(
      1, // TODO: projectId
      parseInt(body.serverId || '1'),
      body.uri
    )
    return c.json(successResponse(content))
  })
  .openapi(getBuiltinToolsRoute, async (c) => {
    // TODO: Implement getBuiltinTools
    const tools = []
    return c.json(successResponse(tools))
  })
  .openapi(startMCPServerRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    await startMCPServer(parseInt(serverId))
    return c.json({ success: true, message: 'MCP server started successfully' })
  })
  .openapi(stopMCPServerRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    await stopMCPServer(parseInt(serverId))
    return c.json({ success: true, message: 'MCP server stopped successfully' })
  })

export type MCPExecutionRouteTypes = typeof mcpExecutionRoutes