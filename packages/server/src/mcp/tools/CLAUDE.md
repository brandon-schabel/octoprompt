# MCP Tools Architecture & Development Guide

This guide documents the comprehensive MCP (Model Context Protocol) tools architecture for Promptliano. The tools system is built on a consistent, action-based pattern that provides robust validation, error handling, and composability.

## Overview

The MCP tools system is organized into categorized modules, each implementing specific domain functionality through consistent action-based patterns. All tools follow the same architectural principles for maintainability, testability, and extensibility.

### Core Architecture Principles

1. **Action-Based Design**: Each tool uses enums to define discrete actions with clear semantics
2. **Consistent Validation**: Shared utilities for parameter validation and error handling
3. **Tracked Execution**: All tools wrapped with telemetry tracking
4. **Comprehensive Error Handling**: Rich error context with recovery suggestions
5. **Category Organization**: Tools grouped by functional domain
6. **Shared Utilities**: Common patterns extracted into reusable utilities

## Tool Categories

### `/analysis/`

- **Purpose**: File analysis and summarization tools
- **Tools**: `file-summarization-manager.tool.ts`
- **Pattern**: Batch processing, progress tracking, AI-powered analysis

### `/content/`

- **Purpose**: Content and agent management
- **Tools**: `agent-manager.tool.ts`, `ai-assistant.tool.ts`
- **Pattern**: CRUD operations, dynamic loading, AI optimization

### `/git/`

- **Purpose**: Git repository operations
- **Tools**: `git-manager.tool.ts`
- **Pattern**: Command execution, state management, comprehensive Git operations

### `/project/`

- **Purpose**: Core project and file operations
- **Tools**: `project-manager.tool.ts`, `prompt-manager.tool.ts`
- **Pattern**: CRUD, file system operations, content suggestions

### `/setup/`

- **Purpose**: MCP configuration and validation
- **Tools**: `mcp-compatibility-checker.tool.ts`, `mcp-config-generator.tool.ts`, `mcp-setup-validator.tool.ts`
- **Pattern**: Validation, configuration generation, environment checking

### `/ui/`

- **Purpose**: UI state and job management
- **Tools**: `job-manager.tool.ts`, `tab-manager.tool.ts`
- **Pattern**: State management, async job tracking

### `/website/`

- **Purpose**: Documentation and demo tools
- **Tools**: `documentation-search.tool.ts`, `website-demo-runner.tool.ts`
- **Pattern**: Search, content retrieval, demo execution

### `/workflow/`

- **Purpose**: Task and ticket workflow management
- **Tools**: `queue-manager.tool.ts`, `queue-processor.tool.ts`, `task-manager.tool.ts`, `ticket-manager.tool.ts`
- **Pattern**: Complex state machines, batch operations, queue processing

## Tool Creation Pattern

### 1. Define Action Enum

Every tool starts with a comprehensive action enum that defines all possible operations:

```typescript
export enum YourToolManagerAction {
  // CRUD operations
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',

  // Specialized operations
  SEARCH = 'search',
  SUGGEST = 'suggest',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete'
}
```

### 2. Define Zod Schema

Create a Zod schema for validation that corresponds to your action enum:

```typescript
export const YourToolManagerSchema = z.object({
  action: z.nativeEnum(YourToolManagerAction),
  projectId: z.number().optional(), // Common pattern
  resourceId: z.number().optional(), // Specific to your domain
  data: z.any().optional() // Action-specific data
})
```

### 3. Add to Shared Types

Add your action enum and schema to `/shared/types.ts`:

```typescript
// Add to shared/types.ts
export { YourToolManagerAction, YourToolManagerSchema } from '../your-category/your-tool.tool'
```

### 4. Create Tool Definition

Follow the established pattern for tool definitions:

```typescript
import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  YourToolManagerAction,
  YourToolManagerSchema
} from '../shared'
import {} from // Import your service functions
'@promptliano/services'
import { ApiError } from '@promptliano/shared'

export const yourToolManagerTool: MCPToolDefinition = {
  name: 'your_tool_manager',
  description:
    'Comprehensive description of what your tool does. Actions: list, get, create, update, delete, search, suggest',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(YourToolManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for: list, create). Example: 1754111018844'
      },
      resourceId: {
        type: 'number',
        description: 'The resource ID (required for: get, update, delete). Example: 456'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For create: { name: "Resource Name", description: "Description" }. For update: { name: "Updated Name" }. For search: { query: "search term", limit: 10 }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'your_tool_manager',
    async (args: z.infer<typeof YourToolManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, resourceId, data } = args

        switch (action) {
          case YourToolManagerAction.LIST: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')
            // Implementation
          }

          case YourToolManagerAction.GET: {
            const validResourceId = validateRequiredParam(resourceId, 'resourceId', 'number', '456')
            // Implementation
          }

          // ... other actions

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(YourToolManagerAction)
            })
        }
      } catch (error) {
        // Standard error handling pattern
        if (error instanceof ApiError) {
          throw createMCPError(
            error.code === 'NOT_FOUND' ? MCPErrorCode.NOT_FOUND : MCPErrorCode.SERVICE_ERROR,
            error.message,
            {
              statusCode: error.statusCode,
              originalError: error.message
            }
          )
        }

        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'your_tool_manager',
                action: args.action,
                projectId: args.projectId
              })

        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
```

### 5. Export from Category Index

Add your tool to the category's `index.ts`:

```typescript
// your-category/index.ts
export { yourToolManagerTool } from './your-tool.tool'
```

### 6. Register in Main Index

Add your tool to the main tools index at `/tools/index.ts`:

```typescript
// Import
import { yourToolManagerTool } from './your-category'

// Add to CONSOLIDATED_TOOLS array
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  // ... existing tools
  yourToolManagerTool
  // ... rest of tools
] as const
```

## Validation Patterns

### Parameter Validation

Use the shared validation utilities for consistent error handling:

```typescript
// Required parameters
const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')

// Data field validation
const name = validateDataField<string>(data, 'name', 'string', '"Resource Name"')

// Optional parameters with defaults
const limit = (data?.limit as number) || 10
const includeHidden = (data?.includeHidden as boolean) || false
```

### Complex Data Validation

For complex data structures, use Zod schemas:

```typescript
import { SomeComplexSchema } from '@promptliano/schemas'

// Parse and validate complex data
const options = SomeComplexSchema.parse(data || {})
```

## Error Handling Patterns

### MCP Error Creation

Use the error creation utilities for consistent error responses:

```typescript
// Resource not found
throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
  requestedPath: filePath,
  availableFiles: availablePaths,
  totalFiles: files.length,
  hint: 'Use browse_files action to explore available files',
  projectId: validProjectId,
  tool: 'project_manager',
  value: filePath
})

// Validation failed
throw createMCPError(MCPErrorCode.VALIDATION_FAILED, 'Input validation failed', {
  parameter: 'data.confirmDelete',
  validationErrors: {
    confirmDelete: 'Must be set to true to confirm deletion'
  },
  relatedResources: [`resource:${resourceId}`]
})
```

### Service Error Conversion

Convert service layer errors to MCP errors:

```typescript
try {
  // Service call
} catch (error) {
  if (error instanceof ApiError) {
    throw createMCPError(
      error.code === 'NOT_FOUND' ? MCPErrorCode.NOT_FOUND : MCPErrorCode.SERVICE_ERROR,
      error.message,
      {
        statusCode: error.statusCode,
        originalError: error.message
      }
    )
  }
  throw error
}
```

## Advanced Patterns

### Batch Operations

For tools that support batch operations, follow this pattern:

```typescript
case YourToolManagerAction.BATCH_CREATE: {
  const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
  const items = validateDataField<any[]>(data, 'items', 'array')

  const results = await batchCreateItems(validProjectId, items)

  const summary = `Created ${results.successful.length} items successfully. ${results.failed.length} failed.`
  return {
    content: [{ type: 'text', text: summary }]
  }
}
```

### Progress Tracking

For long-running operations, implement progress tracking:

```typescript
case YourToolManagerAction.GET_PROGRESS: {
  const jobId = validateDataField<string>(data, 'jobId', 'string')
  const progress = await getJobProgress(jobId)

  const progressText = `Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`
  return {
    content: [{ type: 'text', text: progressText }]
  }
}
```

### File Operations

For file-related operations, handle different file types:

```typescript
// Image file handling
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
const ext = path.extname(filePath).toLowerCase()

if (imageExtensions.includes(ext)) {
  const fullPath = path.join(project.path, filePath)
  const fileData = await fs.readFile(fullPath)
  const base64 = fileData.toString('base64')
  return {
    content: [
      {
        type: 'image',
        data: base64,
        mimeType: `image/${ext.substring(1)}`
      } as any
    ]
  }
}
```

## Comprehensive Testing Patterns

### Test Setup and Configuration

Create a test utility file for common MCP testing patterns:

```typescript
// __tests__/mcp-test-utils.ts
import { beforeEach, afterEach } from 'bun:test'
import { DatabaseManager } from '@promptliano/storage'
import { setTestEnvironment, clearTestEnvironment } from '@promptliano/config'

export interface MockMCPContext {
  db: DatabaseManager
  projectId: number
  testData: {
    project: any
    tickets: any[]
    tasks: any[]
  }
}

export async function createMockMCPContext(): Promise<MockMCPContext> {
  // Create in-memory test database
  const db = await DatabaseManager.createTestInstance(':memory:')
  await db.runMigrations()

  // Create test project
  const project = await db.createProject({
    name: 'Test Project',
    path: '/test/project',
    description: 'Test project for MCP tools'
  })

  // Create test tickets and tasks
  const tickets = []
  const tasks = []

  for (let i = 1; i <= 3; i++) {
    const ticket = await db.createTicket({
      projectId: project.id,
      title: `Test Ticket ${i}`,
      status: 'open'
    })
    tickets.push(ticket)

    for (let j = 1; j <= 2; j++) {
      const task = await db.createTask({
        ticketId: ticket.id,
        title: `Task ${j} for Ticket ${i}`,
        completed: false
      })
      tasks.push(task)
    }
  }

  return {
    db,
    projectId: project.id,
    testData: { project, tickets, tasks }
  }
}

export async function cleanupMockMCPContext(context: MockMCPContext) {
  await context.db.close()
}
```

### Unit Test Structure

Create comprehensive unit tests for each tool action:

```typescript
// __tests__/project-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { projectManagerTool } from '../project/project-manager.tool'
import { ProjectManagerAction } from '../shared'
import { createMockMCPContext, cleanupMockMCPContext, type MockMCPContext } from './mcp-test-utils'

describe('ProjectManagerTool', () => {
  let mockContext: MockMCPContext

  beforeEach(async () => {
    mockContext = await createMockMCPContext()
  })

  afterEach(async () => {
    await cleanupMockMCPContext(mockContext)
  })

  describe('LIST action', () => {
    it('should list projects successfully', async () => {
      const result = await projectManagerTool.handler({
        action: ProjectManagerAction.LIST,
        data: { limit: 10 }
      })

      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Test Project')
    })

    it('should respect limit parameter', async () => {
      const result = await projectManagerTool.handler({
        action: ProjectManagerAction.LIST,
        data: { limit: 1 }
      })

      const text = result.content[0].text as string
      const projectCount = (text.match(/Project ID:/g) || []).length
      expect(projectCount).toBe(1)
    })
  })

  describe('GET action', () => {
    it('should get project details', async () => {
      const result = await projectManagerTool.handler({
        action: ProjectManagerAction.GET,
        projectId: mockContext.projectId
      })

      expect(result.content[0].text).toContain('Test Project')
      expect(result.content[0].text).toContain('/test/project')
    })

    it('should handle non-existent project', async () => {
      const result = await projectManagerTool.handler({
        action: ProjectManagerAction.GET,
        projectId: 999999
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })
  })

  describe('CREATE action', () => {
    it('should create project with valid data', async () => {
      const result = await projectManagerTool.handler({
        action: ProjectManagerAction.CREATE,
        data: {
          name: 'New Test Project',
          path: '/new/test/project',
          description: 'Created via test'
        }
      })

      expect(result.content[0].text).toContain('successfully created')
      expect(result.content[0].text).toContain('New Test Project')
    })

    it('should validate required fields', async () => {
      const result = await projectManagerTool.handler({
        action: ProjectManagerAction.CREATE,
        data: { name: 'Missing Path' }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('path')
    })
  })
})
```

### Error Handling Tests

Test comprehensive error scenarios:

```typescript
describe('Error Handling', () => {
  it('should handle unknown action', async () => {
    const result = await projectManagerTool.handler({
      action: 'INVALID_ACTION' as any
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Unknown action')
    expect(result.content[0].text).toContain('validActions')
  })

  it('should handle missing required parameters', async () => {
    const result = await projectManagerTool.handler({
      action: ProjectManagerAction.UPDATE,
      // Missing projectId
      data: { name: 'Updated Name' }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Missing required parameter')
    expect(result.content[0].text).toContain('projectId')
  })

  it('should handle service layer errors gracefully', async () => {
    // Mock service error
    jest
      .spyOn(projectService, 'getProjectById')
      .mockRejectedValueOnce(new ApiError(500, 'DATABASE_ERROR', 'Database connection failed'))

    const result = await projectManagerTool.handler({
      action: ProjectManagerAction.GET,
      projectId: mockContext.projectId
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Database connection failed')
  })
})
```

### Integration Tests

Test tool integration with the MCP system:

```typescript
// __tests__/mcp-integration.test.ts
import { describe, it, expect } from 'bun:test'
import { getAllConsolidatedTools } from '../index'
import { MCPServer } from '../../server'
import { JSONRPCRequest } from '../../types'

describe('MCP Tool Integration', () => {
  let mcpServer: MCPServer

  beforeEach(async () => {
    mcpServer = new MCPServer()
    await mcpServer.initialize()
  })

  afterEach(async () => {
    await mcpServer.shutdown()
  })

  it('should register all tools correctly', () => {
    const tools = getAllConsolidatedTools()

    expect(tools.length).toBeGreaterThan(0)

    // Check each tool has required properties
    tools.forEach((tool) => {
      expect(tool.name).toBeDefined()
      expect(tool.description).toBeDefined()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.handler).toBeDefined()
    })
  })

  it('should handle tool invocation through MCP protocol', async () => {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'project_manager',
        arguments: {
          action: 'list',
          data: { limit: 5 }
        }
      }
    }

    const response = await mcpServer.handleRequest(request)

    expect(response.result).toBeDefined()
    expect(response.error).toBeUndefined()
    expect(response.result.content).toBeDefined()
  })
})
```

### Performance and Load Tests

Test tool performance under load:

```typescript
describe('Performance Tests', () => {
  it('should handle concurrent tool invocations', async () => {
    const promises = []

    // Create 100 concurrent requests
    for (let i = 0; i < 100; i++) {
      promises.push(
        projectManagerTool.handler({
          action: ProjectManagerAction.LIST,
          data: { limit: 10 }
        })
      )
    }

    const start = Date.now()
    const results = await Promise.all(promises)
    const duration = Date.now() - start

    // All should succeed
    results.forEach((result) => {
      expect(result.content).toBeDefined()
      expect(result.isError).not.toBe(true)
    })

    // Should complete within reasonable time (adjust based on your requirements)
    expect(duration).toBeLessThan(5000) // 5 seconds for 100 requests
  })

  it('should handle large dataset efficiently', async () => {
    // Create many test items
    for (let i = 0; i < 1000; i++) {
      await createTestProject(`Project ${i}`, `/project/${i}`)
    }

    const start = Date.now()
    const result = await projectManagerTool.handler({
      action: ProjectManagerAction.LIST,
      data: { limit: 100 }
    })
    const duration = Date.now() - start

    expect(result.content).toBeDefined()
    expect(duration).toBeLessThan(1000) // Should complete within 1 second
  })
})
```

### Mock and Stub Patterns

Use mocks for external dependencies:

```typescript
// __tests__/mocks/services.mock.ts
export const mockProjectService = {
  getProjectById: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  searchProjects: jest.fn()
}

// In tests
import { mockProjectService } from './mocks/services.mock'

jest.mock('@promptliano/services', () => ({
  ...jest.requireActual('@promptliano/services'),
  ...mockProjectService
}))

describe('ProjectManager with Mocks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call service with correct parameters', async () => {
    mockProjectService.getProjectById.mockResolvedValue({
      id: 123,
      name: 'Mocked Project',
      path: '/mocked'
    })

    await projectManagerTool.handler({
      action: ProjectManagerAction.GET,
      projectId: 123
    })

    expect(mockProjectService.getProjectById).toHaveBeenCalledWith(123)
    expect(mockProjectService.getProjectById).toHaveBeenCalledTimes(1)
  })
})
```

### Test Coverage Requirements

Ensure comprehensive test coverage:

```typescript
// Run with coverage
// bun test --coverage

// Coverage requirements:
// - Minimum 80% overall coverage
// - 100% coverage for error handling paths
// - 100% coverage for validation logic
// - 90% coverage for action handlers
```

### Testing Checklist

For each MCP tool, ensure:

- [ ] All actions have at least one happy path test
- [ ] All actions have error case tests
- [ ] Parameter validation is tested
- [ ] Error messages are clear and helpful
- [ ] Integration with MCP system is tested
- [ ] Performance under load is acceptable
- [ ] Mocks are used for external dependencies
- [ ] Test data cleanup is performed
- [ ] Coverage meets minimum requirements

### Running Tests

```bash
# Run all MCP tool tests
bun test packages/server/src/mcp/tools/__tests__

# Run specific tool tests
bun test packages/server/src/mcp/tools/__tests__/project-manager.test.ts

# Run with coverage
bun test --coverage packages/server/src/mcp/tools

# Run in watch mode during development
bun test --watch packages/server/src/mcp/tools/__tests__
```

### Continuous Integration

Add to CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run MCP Tool Tests
  run: |
    bun test packages/server/src/mcp/tools/__tests__
    bun test --coverage packages/server/src/mcp/tools > coverage.txt

- name: Check Coverage
  run: |
    coverage=$(grep "All files" coverage.txt | awk '{print $10}' | sed 's/%//')
    if [ "$coverage" -lt 80 ]; then
      echo "Coverage is below 80%"
      exit 1
    fi
```

### Integration Tests

## Performance Best Practices

### 1. Efficient Data Loading

- Load only necessary data
- Use pagination for large datasets
- Implement caching where appropriate

### 2. Batch Operations

- Combine multiple operations when possible
- Use database transactions for consistency
- Provide progress feedback for long operations

### 3. Error Recovery

- Provide specific error messages with context
- Include recovery suggestions
- Fail fast with clear error codes

### 4. Resource Management

- Clean up resources after use
- Handle concurrent operations safely
- Implement proper timeout handling

## Code Quality Standards

### 1. Consistent Naming

- Use descriptive action names (`GET_SUMMARY_ADVANCED` not `GET_SUMMARY2`)
- Follow project naming conventions
- Use clear parameter names

### 2. Comprehensive Documentation

- Document all actions in the tool description
- Provide examples for complex data structures
- Include parameter requirements and formats

### 3. Type Safety

- Use proper TypeScript types throughout
- Validate inputs with Zod schemas
- Handle all possible error cases

### 4. Modularity

- Extract common patterns to shared utilities
- Keep individual action handlers focused
- Use composition over inheritance

## Migration and Maintenance

### Adding New Actions

When adding new actions to existing tools:

1. Add the action to the enum
2. Update the tool description
3. Add the action handler in the switch statement
4. Update input schema documentation
5. Add tests for the new action
6. Update any related documentation

### Deprecating Actions

When removing actions:

1. Mark as deprecated in the enum
2. Add deprecation notice in tool description
3. Maintain backward compatibility for a transition period
4. Provide migration guidance

### Version Management

- Follow semantic versioning for tool changes
- Document breaking changes in release notes
- Provide migration scripts when needed

## Example: Complete Tool Implementation

Here's a complete example of a well-structured MCP tool:

```typescript
// example-manager.tool.ts
import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse
} from '../shared'

export enum ExampleManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SEARCH = 'search'
}

export const ExampleManagerSchema = z.object({
  action: z.nativeEnum(ExampleManagerAction),
  projectId: z.number().optional(),
  exampleId: z.number().optional(),
  data: z.any().optional()
})

export const exampleManagerTool: MCPToolDefinition = {
  name: 'example_manager',
  description: 'Manage examples with full CRUD operations. Actions: list, get, create, update, delete, search',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(ExampleManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'Project ID (required for: list, create, search). Example: 1754111018844'
      },
      exampleId: {
        type: 'number',
        description: 'Example ID (required for: get, update, delete). Example: 456'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For create: { name: "Example Name", content: "Content" }. For search: { query: "search term", limit: 10 }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'example_manager',
    async (args: z.infer<typeof ExampleManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, exampleId, data } = args

        switch (action) {
          case ExampleManagerAction.LIST: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')
            // Implementation here
            return {
              content: [{ type: 'text', text: 'List of examples' }]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(ExampleManagerAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'example_manager',
                action: args.action,
                projectId: args.projectId
              })

        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
```

This comprehensive guide provides everything needed to create, maintain, and extend MCP tools following the established patterns in the Promptliano codebase.
