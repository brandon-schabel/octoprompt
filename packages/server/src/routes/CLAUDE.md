# Hono API Routes Architecture Guide

This document provides a comprehensive guide to the Hono + Zod OpenAPI route architecture used in Promptliano's server package.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Creating New API Routes](#creating-new-api-routes)
3. [OpenAPI Documentation Patterns](#openapi-documentation-patterns)
4. [Middleware Composition](#middleware-composition)
5. [Error Handling Strategies](#error-handling-strategies)
6. [WebSocket Integration](#websocket-integration)
7. [Testing Routes](#testing-routes)
8. [Performance Considerations](#performance-considerations)

## Architecture Overview

### Core Technologies

- **Hono**: Fast, lightweight web framework
- **Zod**: TypeScript-first schema validation
- **OpenAPI**: API documentation and contract-first development
- **@hono/zod-openapi**: Integration between Hono and Zod for OpenAPI

### Route Organization

Routes are organized by domain/feature in separate files:

```
routes/
├── project-routes.ts       # Project management
├── chat-routes.ts          # Chat and AI interactions
├── ticket-routes.ts        # Ticket and task management
├── git-routes.ts           # Git operations
├── mcp-routes.ts           # MCP protocol implementation
├── claude-hook-routes.ts   # Claude Code hooks
└── ...
```

### Standard Route Pattern ⭐ **UPDATED WITH ROUTE HELPERS**

Every route file now follows this standardized pattern using route helpers:

```typescript
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema } from '@promptliano/schemas'
import { 
  createStandardResponses, 
  createStandardResponsesWithStatus,
  standardResponses,
  successResponse, 
  operationSuccessResponse 
} from '../utils/route-helpers'
import * as service from '@promptliano/services'

// 1. Define schemas (unchanged)
const RequestSchema = z.object({
  // Request validation
})

const ResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    // Response data
  })
})

// 2. Create route definition with standardized responses
const exampleGetRoute = createRoute({
  method: 'get',
  path: '/api/example/{id}',
  tags: ['Example'],
  summary: 'Get example by ID',
  request: {
    params: z.object({ id: z.string() })
  },
  responses: createStandardResponses(ResponseSchema) // ⭐ NEW: Standardized responses
})

const exampleCreateRoute = createRoute({
  method: 'post', 
  path: '/api/example',
  tags: ['Example'],
  summary: 'Create new example',
  request: {
    body: { content: { 'application/json': { schema: RequestSchema } } }
  },
  responses: createStandardResponsesWithStatus(ResponseSchema, 201, 'Example created successfully') // ⭐ NEW: 201 with standard errors
})

// 3. Export routes with enhanced error handling
export const exampleRoutes = new OpenAPIHono()
  .openapi(exampleGetRoute, async (c) => {
    const { id } = c.req.valid('param')
    const result = await service.getExample(parseInt(id))
    
    return c.json(successResponse(result)) // ⭐ NEW: Helper function
  })
  .openapi(exampleCreateRoute, async (c) => {
    const body = c.req.valid('json')
    const result = await service.createExample(body)

    return c.json(successResponse(result), 201) // ⭐ NEW: Helper with status
  })
```

### Available Route Helper Functions ⭐ **NEW UTILITIES**

**Response Helper Functions:**
```typescript
// Standard response sets (replaces manual response definitions)
createStandardResponses(successSchema: z.ZodTypeAny): ResponseObject
createStandardResponsesWithStatus(schema: z.ZodTypeAny, statusCode: number, description: string): ResponseObject

// Individual response builders
successResponse<T>(data: T): { success: true, data: T }
operationSuccessResponse(message?: string): { success: true, message: string }

// Standard error responses for manual composition
standardResponses: {
  400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Bad Request' },
  404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Not Found' },
  422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
  500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
}
```

**Error Handling Helpers:**
```typescript
// Automatic error boundary for route handlers
withErrorHandling<T>(handler: (c: Context) => Promise<T>): (c: Context) => Promise<T>

// Route parameter validation
validateRouteParam(c: Context, paramName: string, type: 'number' | 'string'): number | string

// Advanced route handler factory
createRouteHandler<TParams, TQuery, TBody, TResponse>(
  handler: (args: { params?: TParams, query?: TQuery, body?: TBody, c: Context }) => Promise<TResponse>
): (c: Context) => Promise<Response>
```

### Migration from Old Pattern ⭐ **BEFORE/AFTER COMPARISON**

**Before (Manual Response Definitions):**
```typescript
// Old pattern - 15+ lines of repetitive response definitions
const oldRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}',
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectResponseSchema } },
      description: 'Project retrieved successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'  
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})
```

**After (Standardized Route Helpers):**
```typescript
// New pattern - 1 line with consistent error handling
const newRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}',
  responses: createStandardResponses(ProjectResponseSchema) // ⭐ Replaces 15+ lines
})
```

### Special Response Patterns

**For 201 Created Routes:**
```typescript
const createRoute = createRoute({
  method: 'post',
  path: '/api/projects',
  responses: createStandardResponsesWithStatus(ProjectResponseSchema, 201, 'Project created successfully')
})
```

**For Custom Status Codes with Standard Errors:**
```typescript
const customRoute = createRoute({
  method: 'post',
  path: '/api/complex-operation',
  responses: {
    202: {
      content: { 'application/json': { schema: AcceptedResponseSchema } },
      description: 'Operation accepted for processing'
    },
    409: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Resource conflict'
    },
    ...standardResponses // ⭐ Spread standard error responses
  }
})
```

**For Streaming/Binary Responses (Keep Manual):**
```typescript
const streamingRoute = createRoute({
  method: 'get', 
  path: '/api/stream',
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({ description: 'Server-sent events stream' })
        }
      },
      description: 'Event stream'
    },
    ...standardResponses // ⭐ Still include standard errors
  }
})
```

## Creating New API Routes ⭐ **UPDATED PROCESS**

### 1. File Structure

Create a new route file following the naming convention and import the new route helpers:

```typescript
// packages/server/src/routes/my-feature-routes.ts
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { 
  createStandardResponses, 
  createStandardResponsesWithStatus,
  standardResponses,
  successResponse, 
  operationSuccessResponse 
} from '../utils/route-helpers' // ⭐ NEW: Import helpers
import { ApiErrorResponseSchema } from '@promptliano/schemas'
// packages/server/src/routes/feature-routes.ts
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema } from '@promptliano/schemas'
```

### 2. Schema Definition

Define request/response schemas using Zod:

```typescript
// Parameter schemas
const FeatureIdParamsSchema = z.object({
  featureId: z.string().transform((val) => parseInt(val, 10))
})

// Request body schemas
const CreateFeatureBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true)
})

// Response schemas
const FeatureResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
})
```

### 3. Route Creation

Use `createRoute` to define OpenAPI specifications:

```typescript
const createFeatureRoute = createRoute({
  method: 'post',
  path: '/api/features',
  tags: ['Features'],
  summary: 'Create a new feature',
  description: 'Creates a new feature with the provided configuration',
  request: {
    body: {
      content: { 'application/json': { schema: CreateFeatureBodySchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: FeatureResponseSchema } },
      description: 'Feature created successfully'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})
```

### 4. Handler Implementation

Implement the route handler:

```typescript
export const featureRoutes = new OpenAPIHono().openapi(createFeatureRoute, async (c) => {
  try {
    const body = c.req.valid('json')
    const feature = await featureService.createFeature(body)

    return c.json(
      {
        success: true,
        data: feature
      },
      201
    )
  } catch (error) {
    if (error instanceof ApiError) {
      throw error // Will be handled by error middleware
    }
    throw new ApiError(500, 'Failed to create feature', 'CREATE_FEATURE_ERROR')
  }
})
```

### 5. Register Routes

Add to `app.ts`:

```typescript
import { featureRoutes } from './routes/feature-routes'

// Register routes
app.route('/', featureRoutes)
```

## OpenAPI Documentation Patterns

### Response Schema Conventions

All successful responses follow this pattern:

```typescript
const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    // Actual data
  }),
  // Optional metadata
  message: z.string().optional(),
  pagination: z
    .object({
      page: z.number(),
      limit: z.number(),
      total: z.number()
    })
    .optional()
})
```

### Error Response Schema

Consistent error responses:

```typescript
const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.any().optional()
  })
})
```

### Parameter Validation

Transform and validate parameters:

```typescript
// Path parameters
const ProjectIdParamsSchema = z.object({
  projectId: z.string().transform((val) => parseInt(val, 10))
})

// Query parameters
const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
  search: z.string().optional()
})
```

### Tags and Organization

Use consistent tags for grouping:

```typescript
const route = createRoute({
  // Core domains
  tags: ['Projects', 'Files', 'AI'],

  // Feature-specific
  tags: ['Git', 'Branches'],

  // Integration
  tags: ['MCP', 'Claude Code']
})
```

## Middleware Composition

### Rate Limiting

Apply rate limiting based on endpoint type:

```typescript
// General rate limiter (500 requests/15min)
app.use('/api/*', generalRateLimiter)

// AI-specific rate limiter (50 requests/hour)
app.use('/api/ai/*', aiRateLimiter)
app.use('/api/*/suggest-*', aiRateLimiter)
```

### Authentication

For protected routes:

```typescript
app.use('/api/protected/*', authMiddleware)
```

### CORS

Global CORS configuration:

```typescript
app.use(
  '*',
  cors({
    origin: ['http://localhost:1420', 'http://localhost:3000'],
    credentials: true
  })
)
```

### Logging

Request/response logging:

```typescript
app.use('*', logger())

// Custom debug logging for MCP routes
mcpRoutes.use('*', async (c, next) => {
  console.log('[MCP Debug]', {
    method: c.req.method,
    path: c.req.path,
    params: c.req.param(),
    query: c.req.query()
  })

  await next()
})
```

## Error Handling Strategies

### Global Error Handler

Automatic Zod validation error handling:

```typescript
const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Validation Failed',
            code: 'VALIDATION_ERROR',
            details: result.error.flatten().fieldErrors
          }
        },
        422
      )
    }
  }
})
```

### Custom Error Classes

Use ApiError for consistent error handling:

```typescript
import { ApiError } from '@promptliano/shared'

// In route handlers
if (!project) {
  throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
}

// Service layer errors
try {
  const result = await service.performOperation()
} catch (error) {
  if (error instanceof ApiError) {
    throw error // Re-throw API errors
  }
  throw new ApiError(500, 'Operation failed', 'OPERATION_ERROR', {
    originalError: error.message
  })
}
```

### Error Response Patterns

Consistent error responses by status code:

```typescript
// 400 - Bad Request
throw new ApiError(400, 'Invalid input parameters', 'INVALID_INPUT')

// 404 - Not Found
throw new ApiError(404, 'Resource not found', 'RESOURCE_NOT_FOUND')

// 422 - Validation Error (handled automatically by Zod)

// 500 - Internal Server Error
throw new ApiError(500, 'Internal server error', 'INTERNAL_ERROR')
```

## WebSocket Integration

### Chat Streaming

Example of WebSocket/SSE integration for AI chat:

```typescript
import { stream } from 'hono/streaming'

const chatStreamRoute = createRoute({
  method: 'post',
  path: '/api/ai/chat',
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({
            description: 'Stream of response tokens'
          })
        }
      }
    }
  }
})

app.openapi(chatStreamRoute, async (c) => {
  const { chatId, userMessage } = c.req.valid('json')

  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  const readableStream = await handleChatMessage({
    chatId,
    userMessage
  })

  return stream(c, async (streamInstance) => {
    await streamInstance.pipe(readableStream.toDataStream())
  })
})
```

### MCP Protocol Integration

WebSocket handling for MCP protocol:

```typescript
// MCP transport handling
mcpRoutes.all('/api/mcp', async (c) => {
  const response = await handleHTTPTransport(c)
  return response
})
```

## Testing Routes

### Unit Testing

Test route handlers in isolation:

```typescript
import { testClient } from 'hono/testing'
import { featureRoutes } from '../routes/feature-routes'

describe('Feature Routes', () => {
  const client = testClient(featureRoutes)

  test('POST /api/features', async () => {
    const res = await client.features.$post({
      json: {
        name: 'Test Feature',
        description: 'Test description'
      }
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.name).toBe('Test Feature')
  })
})
```

### Integration Testing

Test complete request/response cycle:

```typescript
import { app } from '../app'
import request from 'supertest'

describe('API Integration', () => {
  test('Create and retrieve feature', async () => {
    // Create feature
    const createRes = await request(app).post('/api/features').send({
      name: 'Integration Test Feature'
    })

    expect(createRes.status).toBe(201)
    const featureId = createRes.body.data.id

    // Retrieve feature
    const getRes = await request(app).get(`/api/features/${featureId}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body.data.name).toBe('Integration Test Feature')
  })
})
```

### Schema Testing

Validate OpenAPI schema compliance:

```typescript
import { OpenAPIV3 } from 'openapi-types'

test('OpenAPI schema validation', () => {
  const spec = app.getOpenAPIDocument({
    openapi: '3.0.0',
    info: { title: 'API', version: '1.0.0' }
  })

  // Validate schema structure
  expect(spec.paths['/api/features']).toBeDefined()
  expect(spec.paths['/api/features'].post).toBeDefined()
})
```

## Performance Considerations

### Response Streaming

For large datasets, use streaming:

```typescript
const getLargeDatasetRoute = createRoute({
  method: 'get',
  path: '/api/large-dataset',
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() }
      }
    }
  }
})

app.openapi(getLargeDatasetRoute, async (c) => {
  return stream(c, async (stream) => {
    const data = await service.getLargeDataset()

    await stream.write('{"success": true, "data": [')

    for (let i = 0; i < data.length; i++) {
      if (i > 0) await stream.write(',')
      await stream.write(JSON.stringify(data[i]))
    }

    await stream.write(']}')
  })
})
```

### Pagination

Implement consistent pagination:

```typescript
const PaginatedResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    hasMore: z.boolean()
  })
})

app.openapi(listRoute, async (c) => {
  const { page, limit } = c.req.valid('query')
  const { items, total } = await service.getPaginatedItems(page, limit)

  return c.json({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total
    }
  })
})
```

### Caching

Add caching headers for static data:

```typescript
app.openapi(staticDataRoute, async (c) => {
  const data = await service.getStaticData()

  c.header('Cache-Control', 'public, max-age=3600') // 1 hour
  c.header('ETag', `"${hashData(data)}"`)

  return c.json({ success: true, data })
})
```

### Async Processing

For long-running operations, use job queues:

```typescript
const longRunningRoute = createRoute({
  method: 'post',
  path: '/api/long-operation',
  responses: {
    202: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            jobId: z.string(),
            message: z.string()
          })
        }
      }
    }
  }
})

app.openapi(longRunningRoute, async (c) => {
  const { async: asyncMode } = c.req.query()

  if (asyncMode === 'true') {
    const job = await jobQueue.createJob({
      type: 'long-operation',
      input: c.req.valid('json')
    })

    return c.json(
      {
        success: true,
        jobId: job.id,
        message: 'Job started'
      },
      202
    )
  }

  // Synchronous processing
  const result = await service.performLongOperation()
  return c.json({ success: true, data: result })
})
```

## Best Practices

### 1. Schema Organization

- Keep schemas close to routes that use them
- Reuse common schemas from `@promptliano/schemas`
- Use meaningful names with clear suffixes (`RequestSchema`, `ResponseSchema`)

### 2. Error Handling

- Always use `ApiError` for consistent error responses
- Provide descriptive error messages and codes
- Include relevant context in error details

### 3. OpenAPI Documentation

- Write clear summaries and descriptions
- Use appropriate HTTP status codes
- Group related endpoints with consistent tags

### 4. Type Safety

- Leverage Zod's type inference with `z.infer<typeof Schema>`
- Use parameter validation and transformation
- Ensure request/response types match schemas

### 5. Testing

- Test both successful and error scenarios
- Validate schema compliance
- Include integration tests for critical workflows

### 6. Performance

- Use streaming for large responses
- Implement pagination for list endpoints
- Add appropriate caching headers
- Consider async processing for expensive operations

This guide provides the foundation for creating consistent, well-documented, and performant API routes in the Promptliano server architecture.
