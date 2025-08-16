/**
 * MCP Analytics Routes
 * Handles MCP analytics and statistics operations
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema
} from '@promptliano/schemas'
import { getMCPAnalyticsOverview, getMCPToolStatistics, getMCPExecutionTimeline, getMCPToolExecutions, getTopErrorPatterns } from '@promptliano/services'
import { createStandardResponses, successResponse } from '../../utils/route-helpers'

// Get MCP analytics
const getMCPAnalyticsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/analytics',
  tags: ['MCP', 'Analytics'],
  summary: 'Get MCP usage analytics',
  request: {
    query: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      serverId: z.string().optional()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      period: z.object({
        start: z.string(),
        end: z.string()
      }),
      servers: z.array(z.object({
        serverId: z.string(),
        totalRequests: z.number(),
        successRate: z.number(),
        avgResponseTime: z.number()
      })),
      tools: z.array(z.object({
        name: z.string(),
        executions: z.number(),
        avgDuration: z.number()
      })),
      totalRequests: z.number(),
      totalErrors: z.number()
    })
  }))
})

// Get MCP server statistics
const getMCPServerStatsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/servers/{serverId}/stats',
  tags: ['MCP', 'Analytics'],
  summary: 'Get statistics for a specific MCP server',
  request: {
    params: z.object({
      serverId: z.string()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      serverId: z.string(),
      status: z.enum(['connected', 'disconnected', 'error']),
      uptime: z.number(),
      totalRequests: z.number(),
      successRate: z.number(),
      avgResponseTime: z.number(),
      lastActivity: z.string(),
      capabilities: z.any().optional()
    })
  }))
})

// Get tool usage statistics
const getToolUsageStatsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/tools/stats',
  tags: ['MCP', 'Analytics'],
  summary: 'Get tool usage statistics',
  request: {
    query: z.object({
      period: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
      limit: z.number().int().positive().optional().default(10)
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      period: z.string(),
      topTools: z.array(z.object({
        name: z.string(),
        count: z.number(),
        avgExecutionTime: z.number(),
        successRate: z.number()
      })),
      totalExecutions: z.number(),
      totalErrors: z.number()
    })
  }))
})

// Get resource access statistics
const getResourceAccessStatsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/resources/stats',
  tags: ['MCP', 'Analytics'],
  summary: 'Get resource access statistics',
  request: {
    query: z.object({
      period: z.enum(['hour', 'day', 'week', 'month']).optional().default('day')
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      period: z.string(),
      topResources: z.array(z.object({
        uri: z.string(),
        accessCount: z.number(),
        avgResponseTime: z.number()
      })),
      totalAccesses: z.number()
    })
  }))
})

// Generate usage report
const generateUsageReportRoute = createRoute({
  method: 'post',
  path: '/api/mcp/analytics/report',
  tags: ['MCP', 'Analytics'],
  summary: 'Generate MCP usage report',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            startDate: z.string(),
            endDate: z.string(),
            format: z.enum(['json', 'csv', 'pdf']).optional().default('json'),
            includeServerDetails: z.boolean().optional().default(true),
            includeToolDetails: z.boolean().optional().default(true)
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      reportId: z.string(),
      generatedAt: z.string(),
      period: z.object({
        start: z.string(),
        end: z.string()
      }),
      format: z.string(),
      content: z.any(),
      downloadUrl: z.string().optional()
    })
  }))
})

// Get session statistics
const getSessionStatsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/sessions/stats',
  tags: ['MCP', 'Analytics'],
  summary: 'Get MCP session statistics',
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      activeSessions: z.number(),
      totalSessionsToday: z.number(),
      avgSessionDuration: z.number(),
      peakConcurrentSessions: z.number(),
      sessionsByServer: z.record(z.string(), z.number())
    })
  }))
})

// Get performance metrics
const getPerformanceMetricsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/analytics/performance',
  tags: ['MCP', 'Analytics'],
  summary: 'Get MCP performance metrics',
  request: {
    query: z.object({
      metricType: z.enum(['latency', 'throughput', 'error_rate']).optional(),
      aggregation: z.enum(['avg', 'min', 'max', 'p50', 'p95', 'p99']).optional().default('avg')
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      metrics: z.array(z.object({
        timestamp: z.string(),
        value: z.number(),
        type: z.string()
      })),
      aggregation: z.string(),
      summary: z.object({
        current: z.number(),
        trend: z.enum(['up', 'down', 'stable']),
        changePercent: z.number()
      })
    })
  }))
})

// Project-specific MCP analytics routes
const getProjectMCPOverviewRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/analytics/overview',
  tags: ['MCP', 'Analytics', 'Projects'],
  summary: 'Get MCP analytics overview for a project',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      period: z.enum(['hour', 'day', 'week', 'month']).optional(),
      toolNames: z.string().optional()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      totalExecutions: z.number(),
      uniqueTools: z.number(),
      overallSuccessRate: z.number(),
      avgExecutionTime: z.number(),
      topTools: z.array(z.any()),
      recentErrors: z.array(z.any()),
      executionTrend: z.array(z.any())
    })
  }))
})

const getProjectMCPStatisticsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/analytics/statistics',
  tags: ['MCP', 'Analytics', 'Projects'],
  summary: 'Get MCP tool statistics for a project',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      period: z.enum(['hour', 'day', 'week', 'month']).optional(),
      toolNames: z.string().optional()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.array(z.any())
  }))
})

const getProjectMCPTimelineRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/analytics/timeline',
  tags: ['MCP', 'Analytics', 'Projects'],
  summary: 'Get MCP execution timeline for a project',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      period: z.enum(['hour', 'day', 'week', 'month']).optional(),
      toolNames: z.string().optional()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.array(z.any())
  }))
})

const getProjectMCPErrorPatternsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/analytics/error-patterns',
  tags: ['MCP', 'Analytics', 'Projects'],
  summary: 'Get MCP error patterns for a project',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      period: z.enum(['hour', 'day', 'week', 'month']).optional(),
      toolNames: z.string().optional()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.array(z.any())
  }))
})

const getProjectMCPExecutionsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/analytics/executions',
  tags: ['MCP', 'Analytics', 'Projects'],
  summary: 'Get MCP tool executions for a project',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      toolName: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
      offset: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined)
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      executions: z.array(z.any()),
      total: z.number(),
      page: z.number(),
      pageSize: z.number()
    })
  }))
})

// Export routes
export const mcpAnalyticsRoutes = new OpenAPIHono()
  .openapi(getMCPAnalyticsRoute, async (c) => {
    const query = c.req.valid('query')
    // TODO: Implement full analytics
    const analytics = {
      period: {
        start: query.startDate || new Date().toISOString(),
        end: query.endDate || new Date().toISOString()
      },
      servers: [],
      tools: [],
      totalRequests: 0,
      totalErrors: 0
    }
    return c.json(successResponse(analytics))
  })
  .openapi(getMCPServerStatsRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    // TODO: Implement server stats
    const stats = {
      serverId,
      status: 'connected' as const,
      uptime: 0,
      totalRequests: 0,
      successRate: 100,
      avgResponseTime: 0,
      lastActivity: new Date().toISOString()
    }
    return c.json(successResponse(stats))
  })
  .openapi(getToolUsageStatsRoute, async (c) => {
    const { period, limit } = c.req.valid('query')
    // TODO: Implement tool usage stats
    const stats = {
      period,
      topTools: [],
      totalExecutions: 0,
      totalErrors: 0
    }
    return c.json(successResponse(stats))
  })
  .openapi(getResourceAccessStatsRoute, async (c) => {
    const { period } = c.req.valid('query')
    // TODO: Implement resource access stats
    const stats = {
      period,
      topResources: [],
      totalAccesses: 0
    }
    return c.json(successResponse(stats))
  })
  .openapi(generateUsageReportRoute, async (c) => {
    const body = c.req.valid('json')
    // TODO: Implement usage report generation
    const report = {
      reportId: Date.now().toString(),
      generatedAt: new Date().toISOString(),
      period: {
        start: body.startDate,
        end: body.endDate
      },
      format: body.format || 'json',
      content: {}
    }
    return c.json(successResponse(report))
  })
  .openapi(getSessionStatsRoute, async (c) => {
    // TODO: Implement session stats
    const stats = {
      activeSessions: 0,
      totalSessionsToday: 0,
      avgSessionDuration: 0,
      peakConcurrentSessions: 0,
      sessionsByServer: {}
    }
    return c.json(successResponse(stats))
  })
  .openapi(getPerformanceMetricsRoute, async (c) => {
    const { metricType, aggregation } = c.req.valid('query')
    // TODO: Implement performance metrics
    const metrics = {
      metrics: [],
      aggregation,
      summary: {
        current: 0,
        trend: 'stable' as const,
        changePercent: 0
      }
    }
    return c.json(successResponse(metrics))
  })
  // Add new project-specific routes
  .openapi(getProjectMCPOverviewRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      const request = {
        projectId,
        period: query.period,
        toolNames: query.toolNames?.split(',')
      }
      const overview = await getMCPAnalyticsOverview(request)
      return c.json(successResponse(overview))
    } catch (error) {
      throw error
    }
  })
  .openapi(getProjectMCPStatisticsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      const request = {
        projectId,
        period: query.period,
        toolNames: query.toolNames?.split(',')
      }
      const statistics = await getMCPToolStatistics(request)
      return c.json(successResponse(statistics))
    } catch (error) {
      throw error
    }
  })
  .openapi(getProjectMCPTimelineRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      const timeline = await getMCPExecutionTimeline(
        projectId,
        query.period || 'day'
      )
      return c.json(successResponse(timeline))
    } catch (error) {
      throw error
    }
  })
  .openapi(getProjectMCPErrorPatternsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      const errorPatterns = await getTopErrorPatterns(projectId, 10)
      return c.json(successResponse(errorPatterns))
    } catch (error) {
      throw error
    }
  })
  .openapi(getProjectMCPExecutionsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      const executionQuery = {
        projectId,
        toolName: query.toolName,
        status: query.status,
        startDate: query.startDate,
        endDate: query.endDate,
        limit: query.limit,
        offset: query.offset
      }
      const result = await getMCPToolExecutions(executionQuery)
      return c.json(successResponse(result))
    } catch (error) {
      throw error
    }
  })

export type MCPAnalyticsRouteTypes = typeof mcpAnalyticsRoutes