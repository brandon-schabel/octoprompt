import { createRoute, z } from '@hono/zod-openapi'
import { OpenAPIHono } from '@hono/zod-openapi'
import { stream } from 'hono/streaming'

import { createClaudeCodeService } from '@octoprompt/services'
import { ApiError } from '@octoprompt/shared'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  ClaudeCodeRequestSchema,
  ClaudeCodeContinueRequestSchema,
  ClaudeCodeSessionSchema,
  ClaudeCodeResultSchema,
  ClaudeCodeSessionListSchema,
  GetAuditLogsQuerySchema,
  ClaudeCodeAuditLogSchema,
  AuditLogSummarySchema
} from '@octoprompt/schemas'

const claudeCodeService = createClaudeCodeService()

// Routes

// POST /api/claude-code/execute
const executeQueryRoute = createRoute({
  method: 'post',
  path: '/api/claude-code/execute',
  tags: ['Claude Code'],
  summary: 'Execute a Claude Code query',
  request: {
    body: {
      content: { 'application/json': { schema: ClaudeCodeRequestSchema } },
      description: 'Claude Code execution request'
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeCodeResultSchema } },
      description: 'Query executed successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// POST /api/claude-code/stream
const executeStreamRoute = createRoute({
  method: 'post',
  path: '/api/claude-code/stream',
  tags: ['Claude Code'],
  summary: 'Execute a Claude Code query with streaming response',
  request: {
    body: {
      content: { 'application/json': { schema: ClaudeCodeRequestSchema } },
      description: 'Claude Code execution request'
    }
  },
  responses: {
    200: {
      content: { 'text/plain': { schema: z.string() } },
      description: 'Streaming response'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// POST /api/claude-code/sessions/{sessionId}/continue
const continueSessionRoute = createRoute({
  method: 'post',
  path: '/api/claude-code/sessions/{sessionId}/continue',
  tags: ['Claude Code'],
  summary: 'Continue an existing Claude Code session',
  request: {
    params: z.object({
      sessionId: z.string()
    }),
    body: {
      content: { 'application/json': { schema: ClaudeCodeContinueRequestSchema } },
      description: 'Continue session request'
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeCodeResultSchema } },
      description: 'Session continued successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Session not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// GET /api/claude-code/sessions
const getSessionsRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions',
  tags: ['Claude Code'],
  summary: 'Get all Claude Code sessions',
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeCodeSessionListSchema } },
      description: 'Sessions retrieved successfully'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// GET /api/claude-code/sessions/{sessionId}
const getSessionRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{sessionId}',
  tags: ['Claude Code'],
  summary: 'Get a specific Claude Code session',
  request: {
    params: z.object({
      sessionId: z.string()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ClaudeCodeSessionSchema } },
      description: 'Session retrieved successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Session not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// DELETE /api/claude-code/sessions/{sessionId}
const deleteSessionRoute = createRoute({
  method: 'delete',
  path: '/api/claude-code/sessions/{sessionId}',
  tags: ['Claude Code'],
  summary: 'Delete a Claude Code session',
  request: {
    params: z.object({
      sessionId: z.string()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Session deleted successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Session not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// GET /api/claude-code/audit-logs
const getAuditLogsRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/audit-logs',
  tags: ['Claude Code'],
  summary: 'Get Claude Code audit logs with filters',
  request: {
    query: GetAuditLogsQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(ClaudeCodeAuditLogSchema)
        }
      },
      description: 'Successfully retrieved audit logs'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// GET /api/claude-code/sessions/{sessionId}/audit-summary
const getSessionAuditSummaryRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{sessionId}/audit-summary',
  tags: ['Claude Code'],
  summary: 'Get audit summary for a Claude Code session',
  request: {
    params: z.object({
      sessionId: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuditLogSummarySchema
        }
      },
      description: 'Successfully retrieved audit summary'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Session not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// GET /api/claude-code/sessions/{sessionId}/file-changes
const getSessionFileChangesRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{sessionId}/file-changes',
  tags: ['Claude Code'],
  summary: 'Get file changes made during a Claude Code session',
  request: {
    params: z.object({
      sessionId: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              sessionId: z.string(),
              timestamp: z.number(),
              event: z.enum(['created', 'modified', 'deleted']),
              filePath: z.string(),
              projectId: z.number()
            })
          )
        }
      },
      description: 'Successfully retrieved file changes'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Session not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// Route handlers
export const claudeCodeRoutes = new OpenAPIHono()
  .openapi(executeQueryRoute, async (c) => {
    try {
      const request = c.req.valid('json')
      const result = await claudeCodeService.executeQuery(request)
      return c.json(result)
    } catch (error) {
      if (error instanceof ApiError) {
        return c.json({ error: error.message, code: error.code }, error.status)
      }
      console.error('[ClaudeCodeRoutes] Error executing query:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
  .openapi(executeStreamRoute, async (c) => {
    try {
      const request = c.req.valid('json')

      return stream(c, async (stream) => {
        try {
          for await (const message of claudeCodeService.executeQueryStream(request)) {
            const messageJson = JSON.stringify(message) + '\n'
            await stream.write(messageJson)
          }
        } catch (error) {
          console.error('[ClaudeCodeRoutes] Stream error:', error)
          const errorMessage =
            JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }) + '\n'
          await stream.write(errorMessage)
        }
      })
    } catch (error) {
      if (error instanceof ApiError) {
        return c.json({ error: error.message, code: error.code }, error.status)
      }
      console.error('[ClaudeCodeRoutes] Error setting up stream:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
  .openapi(continueSessionRoute, async (c) => {
    try {
      const { sessionId } = c.req.valid('param')
      const { prompt } = c.req.valid('json')

      const result = await claudeCodeService.continueSession(sessionId, prompt)
      return c.json(result)
    } catch (error) {
      if (error instanceof ApiError) {
        return c.json({ error: error.message, code: error.code }, error.status)
      }
      console.error('[ClaudeCodeRoutes] Error continuing session:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
  .openapi(getSessionsRoute, async (c) => {
    try {
      const sessions = await claudeCodeService.listSessions()
      return c.json({ sessions })
    } catch (error) {
      console.error('[ClaudeCodeRoutes] Error getting sessions:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
  .openapi(getSessionRoute, async (c) => {
    try {
      const { sessionId } = c.req.valid('param')
      const session = await claudeCodeService.getSession(sessionId)

      if (!session) {
        return c.json({ error: 'Session not found' }, 404)
      }

      return c.json(session)
    } catch (error) {
      console.error('[ClaudeCodeRoutes] Error getting session:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
  .openapi(deleteSessionRoute, async (c) => {
    try {
      const { sessionId } = c.req.valid('param')
      const deleted = await claudeCodeService.deleteSession(sessionId)

      if (!deleted) {
        return c.json({ error: 'Session not found' }, 404)
      }

      return c.json({ success: true, message: 'Session deleted successfully' })
    } catch (error) {
      console.error('[ClaudeCodeRoutes] Error deleting session:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
  .openapi(getSessionFileChangesRoute, async (c) => {
    try {
      const { sessionId } = c.req.valid('param')
      const changes = await claudeCodeService.getSessionFileChanges(sessionId)

      if (!changes || changes.length === 0) {
        return c.json([])
      }

      return c.json(changes)
    } catch (error) {
      console.error('[ClaudeCodeRoutes] Error getting file changes:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
  .openapi(getAuditLogsRoute, async (c) => {
    try {
      const query = c.req.valid('query')
      const logs = await claudeCodeService.getAuditLogs(query)
      return c.json(logs)
    } catch (error) {
      console.error('[ClaudeCodeRoutes] Error getting audit logs:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
  .openapi(getSessionAuditSummaryRoute, async (c) => {
    try {
      const { sessionId } = c.req.valid('param')
      const summary = await claudeCodeService.getSessionAuditSummary(sessionId)
      return c.json(summary)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return c.json({ error: error.message }, 404)
      }
      console.error('[ClaudeCodeRoutes] Error getting audit summary:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

// Schemas are now exported from @octoprompt/schemas
