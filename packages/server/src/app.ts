import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ApiError } from '@promptliano/shared'
import { chatRoutes } from './routes/chat-routes'
import { genAiRoutes } from './routes/gen-ai-routes'
import { projectRoutes } from './routes/project-routes'
import { providerKeyRoutes } from './routes/provider-key-routes'
import { promptRoutes } from './routes/prompt-routes'
import { ticketRoutes } from './routes/ticket-routes'
import { queueRoutes } from './routes/queue-routes'
import { flowRoutes } from './routes/flow-routes'
import { browseDirectoryRoutes } from './routes/browse-directory-routes'
import { mcpRoutes } from './routes/mcp'
import { gitRoutes } from './routes/git'
import { gitAdvancedRoutes } from './routes/git-advanced-routes'
import { activeTabRoutes } from './routes/active-tab-routes'
import { projectTabRoutes } from './routes/project-tab-routes'
import { agentFilesRoutes } from './routes/agent-files-routes'
import { claudeAgentRoutes } from './routes/claude-agent-routes'
import { claudeCommandRoutes } from './routes/claude-command-routes'
import { claudeCodeRoutes } from './routes/claude-code-routes'
import { claudeHookRoutesSimple } from './routes/claude-hook-routes-simple'
import { mcpInstallationRoutes } from './routes/mcp-installation-routes'
import { mcpProjectConfigApp } from './routes/mcp-project-config-routes'
import { mcpGlobalConfigRoutes } from './routes/mcp-global-config-routes'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import packageJson from '../package.json'
import { getServerConfig, getRateLimitConfig } from '@promptliano/config'
import { rateLimiter } from 'hono-rate-limiter'

const serverConfig = getServerConfig()
const rateLimitConfig = getRateLimitConfig()

// Rate limit configuration
const RATE_LIMIT_ENABLED = rateLimitConfig.enabled
const RATE_LIMIT_WINDOW_MS = rateLimitConfig.windowMs
const RATE_LIMIT_MAX_REQUESTS = rateLimitConfig.maxRequests
const AI_RATE_LIMIT_WINDOW_MS = rateLimitConfig.aiWindowMs
const AI_RATE_LIMIT_MAX_REQUESTS = rateLimitConfig.aiMaxRequests
import { swaggerUI } from '@hono/swagger-ui'
import { ApiErrorResponseSchema } from '@promptliano/schemas'

// Helper to format Zod errors for more readable responses
const formatZodErrors = (error: z.ZodError) => {
  return error.flatten().fieldErrors
}

// Initialize the Hono app with default error handling for validation
export const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      console.error('Validation Error:', JSON.stringify(result.error.issues, null, 2))
      return c.json(
        {
          success: false,
          error: {
            message: 'Validation Failed',
            code: 'VALIDATION_ERROR',
            details: formatZodErrors(result.error)
          }
        } satisfies z.infer<typeof ApiErrorResponseSchema>,
        422
      )
    }
  }
})

// Add CORS middleware
app.use('*', cors(serverConfig.corsConfig))

// Add logger middleware
app.use('*', logger())

// Helper function to get client IP with better localhost detection
const getClientIP = (c: any) => {
  // Check for forwarded headers first (production)
  const forwarded = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
  if (forwarded) return forwarded

  // For local development, try to get the actual connection IP
  const connection = c.env?.incoming?.socket || c.req.raw?.connection || c.req.raw?.socket
  const remoteAddress = connection?.remoteAddress

  // Check if it's a localhost IP
  if (remoteAddress === '::1' || remoteAddress === '127.0.0.1' || remoteAddress === 'localhost') {
    return 'localhost'
  }
  return remoteAddress || 'unknown'
}

// General rate limiter - 500 requests per 15 minutes per IP
const generalLimiter = rateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-6', // Return rate limit info in headers
  keyGenerator: getClientIP,
  handler: (c) => {
    return c.json(
      {
        success: false,
        error: {
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            resetAt: Date.now() + RATE_LIMIT_WINDOW_MS
          }
        }
      } satisfies z.infer<typeof ApiErrorResponseSchema>,
      429
    )
  }
})

// Stricter AI rate limiter - 100 requests per 10 minutes per IP
const aiLimiter = rateLimiter({
  windowMs: AI_RATE_LIMIT_WINDOW_MS,
  limit: AI_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-6',
  keyGenerator: getClientIP,
  handler: (c) => {
    return c.json(
      {
        success: false,
        error: {
          message: 'AI endpoint rate limit exceeded. Please try again later.',
          code: 'AI_RATE_LIMIT_EXCEEDED',
          details: {
            resetAt: Date.now() + AI_RATE_LIMIT_WINDOW_MS
          }
        }
      } satisfies z.infer<typeof ApiErrorResponseSchema>,
      429
    )
  }
})

// Apply rate limiters only if enabled
if (RATE_LIMIT_ENABLED) {
  console.log(
    `[Server] Rate limiting enabled - General: ${RATE_LIMIT_MAX_REQUESTS}/${RATE_LIMIT_WINDOW_MS}ms, AI: ${AI_RATE_LIMIT_MAX_REQUESTS}/${AI_RATE_LIMIT_WINDOW_MS}ms`
  )

  // Apply general rate limiter to all routes
  app.use('*', generalLimiter)

  // Apply stricter AI rate limiter to AI-intensive endpoints
  app.use('/api/gen-ai/*', aiLimiter)
  app.use('/api/chats/*', aiLimiter)
  app.use('/api/projects/*/suggest-files', aiLimiter)
  app.use('/api/projects/*/optimize-input', aiLimiter)
  app.use('/api/projects/*/mcp/suggest-files', aiLimiter)
  app.use('/api/projects/*/mcp/compact-summary', aiLimiter)
  app.use('/api/projects/*/files/*/summarize', aiLimiter)
  app.use('/api/tickets/*/suggest-tasks', aiLimiter)
  app.use('/api/tickets/*/suggest-files', aiLimiter)
  app.use('/api/tickets/*/auto-generate-tasks', aiLimiter)
  app.use('/api/projects/*/suggest-agents', aiLimiter)
  app.use('/api/projects/*/commands/suggest', aiLimiter)
} else {
  console.log('[Server] Rate limiting disabled in development mode')
}

// Add specific MCP route debugging
app.use('/api/mcp*', async (c, next) => {
  console.log(`[MCP Debug] ${c.req.method} ${c.req.path}`)
  await next()
  console.log(`[MCP Debug] Response status: ${c.res.status}`)
})

app.use('/api/projects/*/mcp*', async (c, next) => {
  console.log(`[MCP Debug] ${c.req.method} ${c.req.path}`)
  await next()
  console.log(`[MCP Debug] Response status: ${c.res.status}`)
})

app.get('/api/health', (c) => c.json({ success: true }))

// register all hono routes
app.route('/', chatRoutes)
app.route('/', projectRoutes)
app.route('/', providerKeyRoutes)
app.route('/', promptRoutes)
app.route('/', ticketRoutes)
app.route('/', queueRoutes)
app.route('/', flowRoutes)
app.route('/', genAiRoutes)
app.route('/', browseDirectoryRoutes)
app.route('/', mcpRoutes)
app.route('/', gitRoutes)
app.route('/', gitAdvancedRoutes)
app.route('/', activeTabRoutes)
app.route('/', projectTabRoutes)
app.route('/', agentFilesRoutes)
app.route('/', claudeAgentRoutes)
app.route('/', claudeCommandRoutes)
app.route('/', claudeCodeRoutes)
app.route('/', claudeHookRoutesSimple)
app.route('/', mcpInstallationRoutes)
app.route('/', mcpProjectConfigApp)
app.route('/', mcpGlobalConfigRoutes)

// Global error handler
app.onError((err, c) => {
  console.error('[ErrorHandler]', err)

  let statusCode = 500
  let responseBody: z.infer<typeof ApiErrorResponseSchema>

  if (err instanceof ApiError) {
    console.error(`[ErrorHandler] ApiError: ${err.status} - ${err.code} - ${err.message}`)
    statusCode = err.status
    responseBody = {
      success: false,
      error: {
        message: err.message,
        code: err.code || 'API_ERROR',
        details: err.details as Record<string, any> | undefined
      }
    }
  } else if (err instanceof z.ZodError) {
    console.error('[ErrorHandler] ZodError (fallback):', err.issues)
    statusCode = 422
    responseBody = {
      success: false,
      error: {
        message: 'Invalid Data Provided',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(err)
      }
    }
  } else if (err instanceof Error) {
    console.error(`[ErrorHandler] Generic Error: ${err.message}`)
    // Handle not found errors
    if (
      err.message.includes('not found') ||
      err.message.toLowerCase().includes('does not exist') ||
      err.message.toLowerCase().includes('cannot find')
    ) {
      statusCode = 404
      responseBody = {
        success: false,
        error: {
          message: err.message,
          code: 'NOT_FOUND'
        }
      }
    } else {
      // Default internal server error
      responseBody = {
        success: false,
        error: {
          message: 'Internal Server Error',
          code: 'INTERNAL_SERVER_ERROR',
          details: { env: process.env.NODE_ENV !== 'production' ? err.stack : undefined }
        }
      }
    }
  } else {
    // Non-Error object thrown
    console.error('[ErrorHandler] Unknown throwable:', err)
    responseBody = {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR'
      }
    }
  }

  return c.json(responseBody, statusCode as any)
})

// server swagger ui at /swagger
app.get('/swagger', swaggerUI({ url: '/doc' }))

app.doc('/doc', {
  openapi: '3.1.1',
  info: {
    description: 'Promptliano OpenAPI Server Spec',
    version: packageJson.version,
    title: packageJson.name
  }
})
