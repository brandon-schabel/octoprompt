# MCP (Model Context Protocol) Implementation Guide

This guide covers the MCP implementation in Promptliano, providing patterns and best practices for creating and organizing MCP tools.

## Architecture Overview

The MCP implementation follows a modular, consolidated architecture:

```
packages/server/src/mcp/
├── server.ts                    # Main MCP server (stdio transport)
├── transport.ts                 # HTTP transport layer with JSON-RPC 2.0
├── tools-registry.ts            # Tool type definitions and registry
├── consolidated-tools.ts        # Tool aggregation and exports
├── mcp-errors.ts               # Enhanced error handling system
├── mcp-transaction.ts          # Transaction wrapper for complex operations
├── command-manager-tool.ts     # Command management tool
├── hook-manager-tool.ts        # Hook management tool
└── tools/                      # Modular tool organization
    ├── index.ts                # Main tool aggregator
    ├── shared/                 # Shared utilities and types
    │   ├── types.ts           # Action enums and schemas
    │   ├── utils.ts           # Validation and tracking helpers
    │   └── index.ts           # Shared exports
    ├── project/               # Project management tools
    ├── workflow/              # Workflow and task tools
    ├── content/               # Content and AI tools
    ├── analysis/              # File analysis tools
    ├── git/                   # Git integration tools
    ├── ui/                    # UI state management tools
    ├── setup/                 # MCP setup and validation tools
    └── website/               # Website and documentation tools
```

## Core Concepts

### 1. Transport Layer

The MCP implementation supports two transport methods:

#### STDIO Transport (server.ts)

- Used for direct CLI integration
- Singleton server instance
- Handles tools and resources registration
- Simple request/response flow

#### HTTP Transport (transport.ts)

- JSON-RPC 2.0 over HTTP/SSE
- Session management with cleanup
- CORS support for web clients
- Notification handling for requests without responses

### 2. Tool Registration

Tools are registered through a consolidated system:

```typescript
// All tools are aggregated in tools/index.ts
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  projectManagerTool,
  ticketManagerTool
  // ... other tools
] as const

// Helper functions for tool access
export function getConsolidatedToolByName(name: string): MCPToolDefinition | undefined
export function getAllConsolidatedToolNames(): string[]
```

### 3. Error Handling System

Enhanced error handling with structured details:

```typescript
export enum MCPErrorCode {
  INVALID_PARAMS = 'INVALID_PARAMS',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  SERVICE_ERROR = 'SERVICE_ERROR'
  // ... more specific codes
}

// Structured error with recovery suggestions
export class MCPError extends ApiError {
  public readonly mcpCode: MCPErrorCode
  public readonly suggestion: string
  public readonly context?: MCPErrorDetails['context']
}
```

## Creating New MCP Tools

### 1. Tool Structure

Every MCP tool follows this pattern:

```typescript
// tools/category/my-tool.tool.ts
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import { createTrackedHandler, validateRequiredParam, validateDataField } from '../shared'

export const myTool: MCPToolDefinition = {
  name: 'my_tool',
  description: 'Tool description with available actions and examples',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(MyToolAction)
      },
      projectId: {
        type: 'number',
        description: 'Project ID (required for most actions)'
      },
      data: {
        type: 'object',
        description: 'Action-specific data with examples'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler('my_tool', async (args) => {
    // Implementation
  })
}
```

### 2. Action Enums and Schemas

Define actions in `tools/shared/types.ts`:

```typescript
export enum MyToolAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

export const MyToolSchema = z.object({
  action: z.nativeEnum(MyToolAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})
```

### 3. Handler Implementation

Use the tracked handler pattern with proper error handling:

```typescript
handler: createTrackedHandler('my_tool', async (args): Promise<MCPToolResponse> => {
  try {
    const { action, projectId, data } = args

    switch (action) {
      case MyToolAction.LIST: {
        // Validate required parameters
        const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')

        // Call service layer
        const items = await listMyItems(validProjectId)

        return {
          content: [
            {
              type: 'text',
              text: formatItemsList(items)
            }
          ]
        }
      }

      case MyToolAction.CREATE: {
        // Validate data fields
        const name = validateDataField<string>(data, 'name', 'string', '"My Item"')

        const item = await createMyItem(projectId, { name, ...data })

        return {
          content: [
            {
              type: 'text',
              text: `Item created: ${item.name} (ID: ${item.id})`
            }
          ]
        }
      }

      default:
        throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, { tool: 'my_tool', action })
    }
  } catch (error) {
    if (error instanceof MCPError) {
      return formatMCPErrorResponse(error)
    }

    const mcpError = MCPError.fromError(error, {
      tool: 'my_tool',
      action: args.action
    })
    return formatMCPErrorResponse(mcpError)
  }
})
```

### 4. Tool Registration

Add your tool to the appropriate category index:

```typescript
// tools/category/index.ts
export { myTool } from './my-tool.tool'

// tools/index.ts - add to CONSOLIDATED_TOOLS array
import { myTool } from './category'

export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  // ... existing tools
  myTool
] as const
```

## Shared Utilities

### Validation Helpers

```typescript
// Validate required parameters
validateRequiredParam(value, 'paramName', 'type', 'example')

// Validate data object fields
validateDataField(data, 'fieldName', 'type', 'example')
```

### Tracking Wrapper

```typescript
// Automatically tracks tool execution with telemetry
createTrackedHandler(toolName, handlerFunction)
```

### Error Handling

```typescript
// Create specific MCP errors
createMCPError(MCPErrorCode.INVALID_PARAMS, 'Message', context)

// Convert unknown errors to MCP errors
MCPError.fromError(error, context)

// Format errors for tool responses
formatMCPErrorResponse(mcpError)
```

## Transaction Support

For complex multi-step operations, use the transaction system:

```typescript
import { executeTransaction, createTransactionStep } from '../mcp-transaction'

// Define transaction steps
const steps = [
  createTransactionStep('validate-input', async () => {
    // Validation logic
    return validatedData
  }),

  createTransactionStep(
    'create-resource',
    async () => {
      // Resource creation
      return createdResource
    },
    async (resource) => {
      // Rollback: delete created resource
      await deleteResource(resource.id)
    },
    { retryable: true, maxRetries: 3 }
  ),

  createTransactionStep('update-related', async () => {
    // Update related resources
    return updatedRelated
  })
]

// Execute with automatic rollback on failure
const result = await executeTransaction(steps, {
  stopOnError: true,
  rollbackOnError: true
})

if (!result.success) {
  // Handle transaction failure
  throw new MCPError(MCPErrorCode.TRANSACTION_FAILED, 'Operation failed')
}
```

## Resource Management

MCP supports both tools and resources. Resources provide read-only access to data:

```typescript
// In server registration (server.ts)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: Resource[] = [
    {
      uri: 'promptliano://projects',
      name: 'All Projects',
      description: 'List of available projects',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://project/${projectId}/summary`,
      name: 'Project Summary',
      description: 'Project overview and structure',
      mimeType: 'text/plain'
    }
  ]

  return { resources }
})
```

## Testing MCP Tools

### Unit Testing Pattern

```typescript
// tools/__tests__/my-tool.test.ts
import { myTool } from '../category/my-tool.tool'
import { MyToolAction } from '../shared/types'

describe('MyTool', () => {
  it('should list items', async () => {
    const args = {
      action: MyToolAction.LIST,
      projectId: 1
    }

    const result = await myTool.handler(args)

    expect(result.content).toBeDefined()
    expect(result.content[0].type).toBe('text')
  })

  it('should handle missing projectId', async () => {
    const args = {
      action: MyToolAction.LIST
      // Missing projectId
    }

    const result = await myTool.handler(args)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('projectId is required')
  })
})
```

### Integration Testing

```typescript
// Test with actual MCP client
import { getMCPServer } from '../server'

describe('MCP Integration', () => {
  it('should execute tools through MCP protocol', async () => {
    const server = getMCPServer()

    const result = await server.request({
      method: 'tools/call',
      params: {
        name: 'my_tool',
        arguments: {
          action: 'list',
          projectId: 1
        }
      }
    })

    expect(result.content).toBeDefined()
  })
})
```

## Best Practices

### 1. Tool Design

- **Single Responsibility**: Each tool handles one domain (projects, tickets, etc.)
- **Action-based**: Use action enums for different operations within a tool
- **Consistent Naming**: Follow `snake_case` for tool names and actions
- **Rich Descriptions**: Provide detailed descriptions with examples

### 2. Error Handling

- **Specific Error Codes**: Use appropriate MCPErrorCode for different failure types
- **Recovery Suggestions**: Always provide actionable suggestions
- **Context Information**: Include relevant context (tool, action, parameters)
- **Graceful Degradation**: Handle partial failures appropriately

### 3. Parameter Validation

- **Early Validation**: Validate all required parameters upfront
- **Clear Examples**: Provide examples in error messages
- **Type Safety**: Use TypeScript for compile-time validation
- **Consistent Patterns**: Use shared validation utilities

### 4. Performance

- **Tracking**: Use `createTrackedHandler` for telemetry
- **Caching**: Cache expensive operations where appropriate
- **Pagination**: Support limits and offsets for large datasets
- **Streaming**: Consider streaming for large responses

### 5. Documentation

- **Tool Descriptions**: Include available actions and examples in description
- **Parameter Documentation**: Document all parameters with types and examples
- **Error Documentation**: Document possible error conditions
- **Usage Examples**: Provide practical usage examples

## Integration with Services

MCP tools should call service layer functions, not directly access storage:

```typescript
// Good: Call service layer
import { listProjects, createProject } from '@promptliano/services'

const projects = await listProjects()
const newProject = await createProject(projectData)

// Avoid: Direct storage access
// import { db } from '@promptliano/storage'
// const projects = await db.query('SELECT * FROM projects')
```

## Session Management

For HTTP transport, sessions are automatically managed:

- Session IDs are generated on `initialize`
- Sessions expire after 1 hour of inactivity
- Session cleanup runs every 5 minutes
- Session context is available in tool handlers

## Development Workflow

1. **Define Actions**: Add action enum to `tools/shared/types.ts`
2. **Create Tool**: Implement tool in appropriate category directory
3. **Add Validation**: Use shared validation utilities
4. **Error Handling**: Implement comprehensive error handling
5. **Register Tool**: Add to category index and main tools index
6. **Write Tests**: Create unit and integration tests
7. **Update Documentation**: Update tool descriptions and examples

This architecture provides a scalable, maintainable foundation for MCP tool development in Promptliano.
