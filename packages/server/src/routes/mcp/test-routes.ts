/**
 * MCP Test Routes
 * Handles MCP testing and debugging operations
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema
} from '@promptliano/schemas'
import { executeMCPTool } from '@promptliano/services'
import { createStandardResponses, successResponse } from '../../utils/route-helpers'

// Test MCP connection
const testMCPConnectionRoute = createRoute({
  method: 'post',
  path: '/api/mcp/test/connection',
  tags: ['MCP', 'Testing'],
  summary: 'Test MCP server connection',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().describe('MCP server URL to test'),
            timeout: z.number().int().positive().optional().default(5000)
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      connected: z.boolean(),
      responseTime: z.number(),
      error: z.string().optional(),
      serverInfo: z.any().optional()
    })
  }))
})

// Test MCP initialize handshake
const testMCPInitializeRoute = createRoute({
  method: 'post',
  path: '/api/mcp/test/initialize',
  tags: ['MCP', 'Testing'],
  summary: 'Test MCP initialize handshake',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().describe('MCP server URL to test'),
            capabilities: z.object({
              tools: z.boolean().optional().default(true),
              resources: z.boolean().optional().default(true),
              prompts: z.boolean().optional().default(false)
            }).optional()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      initialized: z.boolean(),
      sessionId: z.string().optional(),
      capabilities: z.any().optional(),
      serverInfo: z.any().optional(),
      error: z.string().optional()
    })
  }))
})

// Test tool execution
const testToolExecutionRoute = createRoute({
  method: 'post',
  path: '/api/mcp/test/tool',
  tags: ['MCP', 'Testing'],
  summary: 'Test MCP tool execution',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            serverId: z.string().optional(),
            toolName: z.string(),
            arguments: z.record(z.any()).optional().default({}),
            validateOnly: z.boolean().optional().default(false)
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      executed: z.boolean(),
      result: z.any().optional(),
      executionTime: z.number(),
      error: z.string().optional(),
      validationErrors: z.array(z.string()).optional()
    })
  }))
})

// Validate MCP configuration
const validateMCPConfigRoute = createRoute({
  method: 'post',
  path: '/api/mcp/test/validate-config',
  tags: ['MCP', 'Testing'],
  summary: 'Validate MCP server configuration',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            serverId: z.string(),
            checkConnectivity: z.boolean().optional().default(true),
            checkCapabilities: z.boolean().optional().default(true),
            checkTools: z.boolean().optional().default(true)
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      valid: z.boolean(),
      checks: z.object({
        connectivity: z.object({
          passed: z.boolean(),
          message: z.string().optional()
        }).optional(),
        capabilities: z.object({
          passed: z.boolean(),
          message: z.string().optional(),
          details: z.any().optional()
        }).optional(),
        tools: z.object({
          passed: z.boolean(),
          message: z.string().optional(),
          availableTools: z.array(z.string()).optional()
        }).optional()
      }),
      errors: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional()
    })
  }))
})

// Debug MCP communication
const debugMCPCommunicationRoute = createRoute({
  method: 'post',
  path: '/api/mcp/test/debug',
  tags: ['MCP', 'Testing'],
  summary: 'Debug MCP communication',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            serverId: z.string(),
            action: z.enum(['list-tools', 'list-resources', 'get-capabilities', 'raw-request']),
            rawRequest: z.object({
              method: z.string(),
              params: z.any().optional()
            }).optional()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      request: z.any(),
      response: z.any(),
      timing: z.object({
        start: z.string(),
        end: z.string(),
        duration: z.number()
      }),
      metadata: z.object({
        serverId: z.string(),
        action: z.string(),
        protocol: z.string().optional()
      })
    })
  }))
})

// Export routes
export const mcpTestRoutes = new OpenAPIHono()
  .openapi(testMCPConnectionRoute, async (c) => {
    const { url, timeout } = c.req.valid('json')
    const startTime = Date.now()

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'User-Agent': 'Promptliano-MCP-Tester/1.0'
        },
        signal: AbortSignal.timeout(timeout)
      })

      const responseTime = Date.now() - startTime

      if (response.ok) {
        return c.json(successResponse({
          connected: true,
          responseTime,
          serverInfo: response.headers.get('Server')
        }))
      } else {
        return c.json(successResponse({
          connected: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        }))
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      return c.json(successResponse({
        connected: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  })
  .openapi(testMCPInitializeRoute, async (c) => {
    const { url, capabilities } = c.req.valid('json')
    // TODO: Implement testMCPInitialize
    const result = {
      initialized: false,
      error: 'Not implemented'
    }
    return c.json(successResponse(result))
  })
  .openapi(testToolExecutionRoute, async (c) => {
    const body = c.req.valid('json')
    const startTime = Date.now()
    
    try {
      if (body.validateOnly) {
        // TODO: Implement validateToolArguments
        const validationResult = { errors: [] as string[] }
        return c.json(successResponse({
          executed: false,
          executionTime: Date.now() - startTime,
          validationErrors: validationResult.errors
        }))
      }
      
      // TODO: Fix executeMCPTool call
      const result = await executeMCPTool(
        1, // projectId
        body.toolName,
        body.arguments || {}
      )
      
      return c.json(successResponse({
        executed: true,
        result,
        executionTime: Date.now() - startTime
      }))
    } catch (error) {
      return c.json(successResponse({
        executed: false,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Execution failed'
      }))
    }
  })
  .openapi(validateMCPConfigRoute, async (c) => {
    const body = c.req.valid('json')
    // TODO: Implement validateMCPServerConfig
    const validationResult = {
      valid: true,
      checks: {},
      errors: [],
      warnings: []
    }
    return c.json(successResponse(validationResult))
  })
  .openapi(debugMCPCommunicationRoute, async (c) => {
    const body = c.req.valid('json')
    // TODO: Implement debugMCPCommunication
    const debugResult = {
      request: body,
      response: {},
      timing: {
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        duration: 0
      },
      metadata: {
        serverId: body.serverId,
        action: body.action,
        protocol: 'mcp'
      }
    }
    return c.json(successResponse(debugResult))
  })

export type MCPTestRouteTypes = typeof mcpTestRoutes