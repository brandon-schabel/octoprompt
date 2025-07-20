import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ApiError } from '@octoprompt/shared'
import { chatRoutes } from './routes/chat-routes'
import { genAiRoutes } from './routes/gen-ai-routes'
import { projectRoutes } from './routes/project-routes'
import { providerKeyRoutes } from './routes/provider-key-routes'
import { promptRoutes } from './routes/prompt-routes'
import { ticketRoutes } from './routes/ticket-routes'
import { agentCoderRoutes } from './routes/agent-coder-routes'
import { browseDirectoryRoutes } from './routes/browse-directory-routes'
import { mcpRoutes } from './routes/mcp-routes'
import { gitRoutes } from './routes/git-routes'
import { gitAdvancedRoutes } from './routes/git-advanced-routes'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import packageJson from '../package.json'
import { corsConfig } from '@octoprompt/services/src/constants/server-config'
import { swaggerUI } from '@hono/swagger-ui'
import { ApiErrorResponseSchema } from '@octoprompt/schemas'

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
app.use('*', cors(corsConfig))

// Add logger middleware
app.use('*', logger())

app.get('/api/health', (c) => c.json({ success: true }))

// register all hono routes
app.route('/', chatRoutes)
app.route('/', projectRoutes)
app.route('/', providerKeyRoutes)
app.route('/', promptRoutes)
app.route('/', ticketRoutes)
app.route('/', genAiRoutes)
app.route('/', agentCoderRoutes)
app.route('/', browseDirectoryRoutes)
app.route('/', mcpRoutes)
app.route('/', gitRoutes)
app.route('/', gitAdvancedRoutes)

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
    description: 'OctoPrompt OpenAPI Server Spec',
    version: packageJson.version,
    title: packageJson.name
  }
})
