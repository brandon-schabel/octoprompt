# Server Architecture Guide - CLAUDE.md

This guide provides comprehensive documentation for working with the Promptliano server built on Hono + Bun with MCP (Model Context Protocol) integration.

## Architecture Overview

The Promptliano server is a high-performance Bun-based HTTP server using Hono as the web framework with full OpenAPI/Swagger integration. Key architectural components:

- **Hono Framework**: Fast, lightweight web framework with Zod OpenAPI integration
- **Bun Runtime**: Ultra-fast JavaScript runtime with native WebSocket support
- **MCP Integration**: Model Context Protocol for AI tool interactions
- **Service Layer**: Business logic abstracted into reusable services
- **WebSocket Manager**: Real-time communication for jobs and events
- **SQLite Database**: Persistent storage with optimized queries

### Core Directory Structure

```
packages/server/
├── server.ts              # Main server entry point
├── src/
│   ├── app.ts             # Hono app configuration & middleware
│   ├── routes/            # API route definitions by domain
│   ├── mcp/               # Model Context Protocol implementation
│   │   ├── server.ts      # MCP server setup
│   │   ├── tools/         # MCP tool implementations by category
│   │   └── consolidated-tools.ts
│   └── services/          # WebSocket and other services
├── mcp-*.ts              # MCP standalone servers
└── data/                 # Runtime data storage
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze implementation quality and suggest improvements
   - Ensure API security, error handling, and performance optimizations

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on service layer abstraction and middleware composition

3. **Package-Specific Agents**
   - Use `hono-bun-api-architect` for API endpoint development
   - Use `promptliano-mcp-tool-creator` for MCP tool implementation
   - Use `zod-schema-architect` for request/response validation schemas
   - Use `promptliano-sqlite-expert` for database optimization

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about what was implemented/changed
- Use multiple agents concurrently for maximum efficiency
- Include API documentation and example requests for new endpoints

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define data structure (source of truth)
2. **Storage layer** - Create tables with validation
3. **Services** - Implement business logic
4. **MCP tools** - Enable AI access (this package)
5. **API routes** - Create endpoints with OpenAPI (this package)
6. **API client** - Add to single api-client.ts file
7. **React hooks** - Setup with TanStack Query
8. **UI components** - Build with shadcn/ui
9. **Page integration** - Wire everything together
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles steps 4-5: Creating MCP tools for AI access and implementing API routes with Hono + Zod OpenAPI integration.

See main `/CLAUDE.md` for complete flow documentation.

## API Route Creation Patterns

### Basic Route Structure

All routes follow consistent Hono + Zod OpenAPI patterns:

```typescript
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'

// Define route with OpenAPI schema
const getProjectRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Get project by ID',
  request: {
    params: ProjectIdParamsSchema,
    query: RefreshQuerySchema.optional()
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectResponseSchema } },
      description: 'Successfully retrieved project'
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

// Implement route handler
export const projectRoutes = new OpenAPIHono()

projectRoutes.openapi(getProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { refresh } = c.req.valid('query') || {}

  try {
    const project = await getProjectById(projectId, refresh)
    return c.json({ success: true, data: project })
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to retrieve project')
  }
})
```

### Route Organization Patterns

Routes are organized by domain in separate files:

- `project-routes.ts` - Project management
- `chat-routes.ts` - Chat and messaging
- `ticket-routes.ts` - Ticket/task management
- `mcp-routes.ts` - MCP-specific endpoints
- `git-routes.ts` - Git operations
- `queue-routes.ts` - Job queue management

### Schema-First Development

Always define Zod schemas first, then implement routes:

```typescript
// 1. Define schemas in @promptliano/schemas
const CreateProjectBodySchema = z.object({
  name: z.string().min(1).max(255),
  path: z.string(),
  description: z.string().optional()
})

// 2. Use schemas in route definition
request: {
  body: {
    content: { 'application/json': { schema: CreateProjectBodySchema } },
    required: true
  }
}

// 3. Access validated data
const validatedBody = c.req.valid('json')
```

## MCP Tool Architecture

The MCP (Model Context Protocol) implementation provides structured AI tool interactions.

### Tool Definition Pattern

```typescript
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import { createTrackedHandler, validateRequiredParam, validateDataField } from '../shared'

export const myTool: MCPToolDefinition = {
  name: 'my_tool',
  description: 'Description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: ['create', 'read', 'update', 'delete']
      },
      projectId: {
        type: 'number',
        description: 'The project ID'
      },
      data: {
        type: 'object',
        description: 'Action-specific data'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler('my_tool', async (args): Promise<MCPToolResponse> => {
    const { action, projectId, data } = args

    // Validate required parameters
    const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')

    switch (action) {
      case 'create':
        const name = validateDataField(data, 'name', 'string')
        // Implementation here
        return {
          content: [{ type: 'text', text: 'Success message' }]
        }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  })
}
```

### Tool Organization

Tools are organized by category in the `src/mcp/tools/` directory:

- **project/** - Project and file management
- **workflow/** - Tickets, tasks, and queues
- **content/** - AI assistance and agents
- **analysis/** - File analysis and summarization
- **git/** - Git operations
- **ui/** - UI state management
- **website/** - Documentation and demos
- **setup/** - MCP configuration

### Error Handling in MCP Tools

```typescript
import { MCPError, MCPErrorCode, createMCPError } from '../../mcp-errors'

// Validation errors
if (!requiredField) {
  throw createMCPError(MCPErrorCode.MISSING_REQUIRED_PARAM, 'Field is required', {
    parameter: 'fieldName',
    validationErrors: { fieldName: 'Required' }
  })
}

// Business logic errors
if (notFound) {
  throw createMCPError(MCPErrorCode.RESOURCE_NOT_FOUND, 'Project not found', {
    resourceId: projectId,
    resourceType: 'project'
  })
}
```

### Tool Registration

Tools are automatically registered via the consolidated tools system:

```typescript
// In src/mcp/tools/index.ts
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  projectManagerTool,
  ticketManagerTool
  // ... other tools
] as const
```

## WebSocket Implementation

### WebSocket Manager Pattern

The server includes a comprehensive WebSocket manager for real-time communication:

```typescript
import { getWebSocketManager } from './src/services/websocket-manager'

// In server initialization
const wsManager = getWebSocketManager()

// WebSocket handling in server
websocket: {
  async open(ws: ServerWebSocket<WebSocketData>) {
    wsManager.addClient(ws)
  },
  close(ws: ServerWebSocket<WebSocketData>) {
    wsManager.removeClient(ws.data.clientId)
  },
  async message(ws: ServerWebSocket<WebSocketData>, rawMessage: string | Buffer) {
    const message = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString()
    wsManager.handleMessage(ws, message)
  }
}
```

### Job Queue Integration

WebSockets are integrated with the job queue system:

```typescript
// Connect job events to WebSocket
const jobQueue = getJobQueue()
jobQueue.on('job-event', (event) => {
  wsManager.sendJobEvent(event)
})
```

## Middleware Patterns

### CORS Configuration

```typescript
import { cors } from 'hono/cors'
import { getServerConfig } from '@promptliano/config'

const serverConfig = getServerConfig()
app.use('*', cors(serverConfig.corsConfig))
```

### Rate Limiting

```typescript
import { rateLimiter } from 'hono-rate-limiter'

// General rate limiter
const generalLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500,
  keyGenerator: (c) => getClientIP(c),
  handler: (c) => c.json({ error: 'Rate limit exceeded' }, 429)
})

// Apply to routes
app.use('*', generalLimiter)
app.use('/api/gen-ai/*', aiLimiter) // Stricter for AI endpoints
```

### Error Handling Middleware

Global error handler with comprehensive error type support:

```typescript
app.onError((err, c) => {
  let statusCode = 500
  let responseBody: z.infer<typeof ApiErrorResponseSchema>

  if (err instanceof ApiError) {
    statusCode = err.status
    responseBody = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details
      }
    }
  } else if (err instanceof z.ZodError) {
    statusCode = 422
    responseBody = {
      success: false,
      error: {
        message: 'Validation Failed',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(err)
      }
    }
  }

  return c.json(responseBody, statusCode)
})
```

### Request Logging

```typescript
import { logger } from 'hono/logger'
app.use('*', logger())
```

## Service Layer Integration

### Service Usage Pattern

```typescript
import * as projectService from '@promptliano/services'
import { getProjectById, createProject, updateProject } from '@promptliano/services'

// In route handlers
const project = await getProjectById(projectId)
const newProject = await createProject(createData)
const updatedProject = await updateProject(projectId, updateData)
```

### Service Error Handling

Services throw `ApiError` instances that are automatically handled:

```typescript
import { ApiError } from '@promptliano/shared'

// In service layer
if (!project) {
  throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found')
}

// In route handler - automatically caught by error middleware
const project = await getProjectById(projectId) // May throw ApiError
```

## Authentication & Security

### API Key Patterns

```typescript
// Provider key validation
const providerKeys = await getProviderKeys()
const validKey = providerKeys.find((key) => key.provider === 'openai')
```

### Input Validation

Always use Zod schemas for input validation:

```typescript
const bodySchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

// Automatic validation via OpenAPI route definition
request: {
  body: {
    content: { 'application/json': { schema: bodySchema } },
    required: true
  }
}
```

## Response Formatting

### Standard Response Schema

All API responses follow consistent schemas:

```typescript
// Success responses
{
  success: true,
  data: T // The actual response data
}

// Error responses
{
  success: false,
  error: {
    message: string,
    code: string,
    details?: Record<string, any>
  }
}
```

### Streaming Responses

For AI chat and long-running operations:

```typescript
import { stream } from 'hono/streaming'

app.post('/api/chat/stream', async (c) => {
  return stream(c, async (stream) => {
    // Write streaming data
    await stream.writeln(JSON.stringify({ type: 'message', content: 'Hello' }))
    await stream.writeln(JSON.stringify({ type: 'done' }))
  })
})
```

## Testing Strategies

### Route Testing

```typescript
import { testClient } from 'hono/testing'
import { app } from '../src/app'

describe('Project Routes', () => {
  const client = testClient(app)

  it('should get project by ID', async () => {
    const res = await client.api.projects[':projectId'].$get({
      param: { projectId: '123' }
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
```

### MCP Tool Testing

```typescript
describe('Project Manager Tool', () => {
  it('should list projects', async () => {
    const result = await projectManagerTool.handler({
      action: 'list'
    })

    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
  })
})
```

## Performance Optimization

### Database Query Optimization

```typescript
// Use direct SQL queries for performance
const projects = await db.query('SELECT * FROM projects WHERE user_id = ?', [userId])

// Avoid N+1 queries - batch operations
const projectIds = projects.map((p) => p.id)
const files = await getFilesByProjectIds(projectIds)
```

### Caching Strategies

```typescript
// Summary caching
import { invalidateProjectSummaryCache } from '@promptliano/services'

// Invalidate when project changes
await updateProject(projectId, data)
invalidateProjectSummaryCache(projectId)
```

### Rate Limit Configuration

Different limits for different endpoint types:

```typescript
// General API: 500 requests/15 minutes
// AI endpoints: 100 requests/10 minutes
app.use('/api/gen-ai/*', aiLimiter)
app.use('/api/projects/*/suggest-files', aiLimiter)
```

## Development Workflow

### Server Startup

```bash
# Development mode
bun run dev

# Production mode
bun run start

# MCP mode
bun run server.ts --mcp-stdio
```

### Adding New Routes

1. Create route file in `src/routes/`
2. Define OpenAPI schemas with Zod
3. Implement route handlers with service calls
4. Register routes in `src/app.ts`
5. Add tests for route functionality

### Adding New MCP Tools

1. Create tool file in appropriate `src/mcp/tools/` category
2. Define tool schema and handler
3. Export from category index file
4. Add to `CONSOLIDATED_TOOLS` array
5. Test tool functionality

### Database Changes

1. Create migration in `@promptliano/storage`
2. Update service layer to use new schema
3. Update API routes and responses
4. Test migration and rollback

## Common Patterns

### File Operations

```typescript
// File content operations
const fileContent = await getFileContent(projectId, filePath)
await updateFileContent(projectId, filePath, newContent)
```

### Project Context

```typescript
// Get comprehensive project context
const overview = await getProjectOverview(projectId)
const summary = await getProjectSummaryWithOptions(projectId, {
  depth: 'standard',
  format: 'markdown'
})
```

### Async Job Processing

```typescript
// Queue job for background processing
const jobQueue = getJobQueue()
await jobQueue.enqueue('git-operation', { projectId, operation: 'clone' })
```

### WebSocket Broadcasting

```typescript
// Send updates to connected clients
const wsManager = getWebSocketManager()
wsManager.broadcast({ type: 'project-updated', projectId })
wsManager.sendToProject(projectId, { type: 'file-changed', path: filePath })
```

## Deployment Considerations

### Environment Configuration

```typescript
import { getServerConfig } from '@promptliano/config'

const config = getServerConfig()
// config.serverPort, config.isDevEnv, config.corsConfig
```

### Production Settings

- Enable rate limiting
- Configure proper CORS origins
- Set up error logging
- Use production database paths
- Configure SSL/TLS for HTTPS

### Monitoring

- WebSocket connection monitoring
- Job queue health checks
- API response time tracking
- Error rate monitoring

This comprehensive guide covers all aspects of working with the Promptliano server architecture. The patterns shown here ensure consistency, performance, and maintainability across the entire codebase.
