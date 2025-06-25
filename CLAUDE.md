# CLAUDE.md

OctoPrompt guidance for Claude Code (claude.ai/code).

## Commands

### Development

- `bun run dev` - Start client and server
- `bun run dev:client` - Client only (port 1420)
- `bun run dev:server` - Server only (port 3147)

### Testing

- `bun run test:all` - Run all tests
- `bun run test:[package]` - Run specific package tests
- `bun run e2e` - Run Playwright E2E tests

## CRITICAL FILE SAFETY RULES

- **NEVER delete files outside the project working directory** (/Users/brandon/Programming/td-engine)
- **NEVER make changes that could be catastrophic to the system**
- **ALWAYS double-check before any file deletion** - think carefully about WHY a file is being deleted
- **BE EXTREMELY CAUTIOUS with file operations** - especially deletions
- **If uncertain about a file deletion, ASK THE USER FIRST**
- **Verify file paths** - ensure all operations are within the project scope

### Linear Workspace Configuration

- **Workspace**: BS Projects (Team ID: `2868a346-2a0d-4953-af4e-4b695aa5a981`)
- **Projects**:
  - **OctoPrompt** (Project ID: `9e96fe84-c58e-47d3-8402-3552cdf0bf3b`)

### Linear MCP Integration

The Linear MCP (Model Context Protocol) integration is built into Claude Code and provides direct access to Linear's API for project management. No additional setup or configuration is required - the MCP commands are available out of the box.

### OctoPrompt MCP Usage

OctoPrompt is my personal project, so make heavy use of it. Write a feedback file (octo-feedback.md) on what can be improved.

Use the OctoPrompt MCP for the following

- Creating Tickets and Tasks when planning
- Save and retrieve relevant prompts for later used (retrieve when it would help the context)
- Get suggested files based on relevant context, the project is indexed and sumarized and uses that when providing suggestions
- Retrieve compact project summary to gain quick insights into the architecture of the project.
- Optimize a prompt using the context of the project, for example it can be helpful to upgrade a project by adding project specific context

The OctoPrompt MCP provides seamless integration with the OctoPrompt project management system, allowing you to manage projects, files, prompts, and AI-powered workflows directly from Claude.

**OctoPrompt Project Details:**

- **Project ID**: `1750564533014`

## Creating New MCP Tools

Follow this step-by-step process to add new MCP tools to OctoPrompt:

### 1. Add AI Prompt (if needed)

If your tool uses AI, add a new prompt to `packages/shared/src/utils/prompts-map.ts`:

```typescript
export const promptsMap = {
  // ... existing prompts
  yourNewPrompt: `
## Your New Prompt Title

Your prompt content here with clear instructions for the AI.
Include specific formatting requirements and context guidelines.
  `
}
```

### 2. Create Service Function

Add the business logic to the appropriate service file (e.g., `packages/services/src/project-service.ts`):

```typescript
export async function yourNewFunction(projectId: number, ...params): Promise<YourReturnType> {
  try {
    await getProjectById(projectId) // Validate project exists

    // Your business logic here
    // Use AI if needed: await generateSingleText({...})

    return result
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to execute your function: ${error instanceof Error ? error.message : String(error)}`,
      'YOUR_FUNCTION_FAILED'
    )
  }
}
```

### 3. Add MCP Server Tool

In `packages/server/src/mcp/server.ts`, add your tool to the tools array:

```typescript
{
  name: 'your_new_tool',
  description: 'Description of what your tool does',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The ID of the project'
      },
      // Add other parameters
    },
    required: ['projectId']
  }
}
```

Add the tool handler in the switch statement:

```typescript
case 'your_new_tool':
  return await handleYourNewTool(args as any)
```

Create the handler function:

```typescript
async function handleYourNewTool(args: { projectId: number }): Promise<CallToolResult> {
  const { projectId } = args
  const result = await yourNewFunction(projectId)

  return {
    content: [
      {
        type: 'text',
        text: result
      }
    ]
  }
}
```

### 4. Add MCP Client Mock (optional)

In `packages/mcp-client/src/mcp-client.ts`, add to the mock tools array:

```typescript
{
  id: 'your_new_tool',
  name: 'your_new_tool',
  description: 'Description of your tool',
  serverId: this.config.id,
  parameters: [
    {
      name: 'projectId',
      type: 'number',
      description: 'The ID of the project',
      required: true
    }
  ],
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The ID of the project'
      }
    },
    required: ['projectId']
  }
}
```

Add mock execution handling:

```typescript
private getMockToolExecution(toolId: string, parameters: Record<string, any>): any {
  if (toolId === 'your_new_tool') {
    return [
      {
        type: 'text',
        text: `Mock response for ${toolId} with project ${parameters.projectId}`
      }
    ]
  }
  // ... existing code
}
```

### 5. Add HTTP Route (optional)

If you want HTTP access, add to `packages/server/src/routes/mcp-routes.ts`:

```typescript
const yourNewToolRoute = createRoute({
  method: 'get', // or 'post'
  path: '/api/projects/{projectId}/mcp/your-tool',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              // Define your response schema
            })
          })
        }
      },
      description: 'Your tool response'
    }
  }
})

mcpRoutes.openapi(yourNewToolRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const result = await projectService.yourNewFunction(projectId)
    return c.json({ success: true, data: result })
  } catch (error) {
    return handleApiError(error, c)
  }
})
```

### 6. Testing

1. **Unit Tests**: Add tests in the appropriate service test file
2. **Integration Tests**: Test the MCP tool through the protocol
3. **Manual Testing**: Use the MCP test endpoints in the API

### Example: Compact Project Summary Tool

See the recently added `get_project_compact_summary` tool as a complete example:

- **Prompt**: `compactProjectSummary` in `prompts-map.ts`
- **Service**: `getProjectCompactSummary()` in `project-service.ts`
- **Utility**: `getCompactProjectSummary()` in `get-full-project-summary.ts`
- **MCP Tool**: `get_project_compact_summary` in `mcp/server.ts`
- **HTTP Route**: `/api/projects/{projectId}/mcp/compact-summary`

This tool takes a full project summary and uses AI to create a compact, architecture-focused version that's perfect for providing context to AI assistants without overwhelming them with details.

### Important Notes

- **All MCP tools now use compact summaries** - Both the core MCP server and the tools registry have been updated to use `getProjectCompactSummary` instead of the verbose full summary
- **Consistent experience** - Whether accessing via MCP tools, HTTP routes, or the tools registry, all project summary features now return the AI-optimized compact version
- **Legacy compatibility** - The full summary function still exists for internal use but is no longer exposed through MCP interfaces

### Issue Workflow

1. **Check available issues** using MCP commands with the appropriate project ID
2. **Copy branch name** from Linear issue (Cmd/Ctrl + Shift + .)
3. **Create feature branch** with Linear's naming convention (e.g., `brandonschabel/td-123-feature-name`)
4. **Link commits/PRs** to Linear issues using issue ID (e.g., TD-123, OP-456)
5. **Linear automatically updates** issue status based on PR activity

### Branch Naming Convention

- Format: `username/project-issueNumber-description`
- Examples:
  - OctoPrompt: `brandonschabel/op-456-implement-feature`

### Build

- `bun run build-binaries` - Build cross-platform binaries
- `bun run format` - Format with Prettier

### Database

- `bun run migrate:sqlite` - Run SQLite database migrations

## Code Principles

- Write self-explanatory, modular, functional code
- Follow DRY, SRP, KISS principles
- Make code unit-testable
- Use descriptive naming, avoid magic numbers
- Keep files concise

## TypeScript Rules

1. **Strong Typing**: No `any`, use Zod schemas
2. **Functional Style**: Pure functions, minimal side effects
3. **Error Handling**: Throw typed errors or return error objects
4. **Minimal Dependencies**: Prefer Bun/standard lib
5. **Single Responsibility**: One concept per file
6. **Clear Documentation**: Concise docstrings for complex logic

## OctoPrompt Specifics

- **IDs & Timestamps**: Unix timestamps in milliseconds, `-1` = null
- **Maps**: Use `Map()` for numeric keys (not plain objects)
- **File Structure**: Schema → Storage → Service → Routes
- **Type Safety**: Zod + Hono validation
- **Route Order**: Critical - specific routes before parameterized

## Project Structure

```
packages/
  api-client/            # Type-safe API client
  client/                # React frontend (Vite + TanStack)
  schemas/               # Zod schemas and types
  server/                # Hono backend
  services/              # Business logic
  shared/                # Utilities
  storage/               # V2 storage with caching/indexing

data/                    # Runtime storage
  octoprompt.db          # SQLite database (production)
scripts/                 # Build scripts
docs/                    # Documentation
```

## Storage V2 Features

- **LRU Caching** with TTL
- **Indexing**: Hash (O(1)) and B-tree for ranges
- **Migrations**: Versioned schema evolution
- **Adapters**: File-based (prod), SQLite, and memory (test)
- **Concurrency**: File locking, atomic operations

```typescript
// File-based adapter (JSON storage)
const storage = new StorageV2<Project>({
  adapter: new FileAdapter('projects'),
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'created', type: 'btree' }
  ],
  cache: { maxSize: 100, ttl: 300000 }
})

// SQLite adapter (recommended for production)
const storage = new StorageV2<Project>({
  adapter: new SQLiteAdapter(db, 'projects'),
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'created', type: 'btree' }
  ],
  cache: { maxSize: 100, ttl: 300000 }
})
```

## SQLite Storage

### Overview

- **Database Location**: `data/octoprompt.db` (production)
- **Test Mode**: Automatically uses `:memory:` database for tests
- **Migration Command**: `bun run migrate:sqlite`
- **Performance**: 10-50x faster than file-based storage

### Architecture

- **DatabaseManager**: Singleton for database lifecycle
- **SQLiteAdapter**: Storage V2 adapter implementation
- **Migrations**: Automatic schema versioning
- **Connection Pooling**: Built-in with better-sqlite3

### Usage

```typescript
import { DatabaseManager } from '@octoprompt/storage'

// Initialize database (runs migrations automatically)
const db = DatabaseManager.getInstance()

// Create storage with SQLite adapter
const projectStorage = new StorageV2<Project>({
  adapter: new SQLiteAdapter(db, 'projects'),
  indexes: [{ field: 'id', type: 'hash' }],
  cache: { maxSize: 100, ttl: 300000 }
})
```

### Benefits

- **ACID Compliance**: Full transactional support
- **Concurrent Access**: Multiple processes can read/write safely
- **Query Performance**: Native SQL indexing
- **Reduced I/O**: Single file vs many JSON files
- **Atomic Operations**: No partial writes
- **Backup**: Simple file copy for full backup

### Migration System

```typescript
// Migrations run automatically on startup
// Located in packages/storage/src/migrations/
export const migrations = [
  {
    version: 1,
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS projects (...)`)
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS projects`)
    }
  }
]
```

### Troubleshooting

- **Database Locked**: Check for multiple server instances
- **Migration Errors**: Run `bun run migrate:sqlite` manually
- **Performance**: Enable WAL mode (enabled by default)
- **Disk Space**: Database in `data/` directory
- **Testing**: Uses `:memory:` automatically, no cleanup needed

## Frontend Stack

- React 19 with Compiler
- TanStack Router/Query
- ShadCN UI (Radix)
- Monaco Editor
- Tailwind CSS

### Key Hooks Pattern

```typescript
export function useCreateChat() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChatBody) => octoClient.chats.createChat(data),
    onSuccess: () => {
      /* invalidate queries */
    }
  })
}
```

## Backend Architecture

### Layers

1. **Storage**: Enhanced storage with V2 features (SQLite or JSON)
2. **Services**: Business logic orchestration
3. **Routes**: Hono + OpenAPI specs

### Core Patterns

- **Error Handling**: `ApiError` class
- **Validation**: Zod at storage and API layers
- **ID Generation**: `Date.now()` with collision handling

## AI Integration

- **Multi-Provider**: OpenAI, Anthropic, Google, Groq
- **Streaming**: Real-time responses
- **Model Configs**: LOW, MEDIUM, HIGH presets

## Testing

- **Runner**: Bun test
- **E2E**: Playwright
- **API**: Type-safe functional tests
- **Patterns**: Schema validation, mocking, cleanup

## Hono Route Ordering

Order routes from most to least specific:

1. Exact literals (`/api/health`)
2. Literal + param (`/api/users/me`)
3. Single param (`/api/users/{id}`)
4. Multi-param (`/api/projects/{pId}/files/{fId}`)
5. Catch-alls (`*`)

## Utilities

**Schemas (`@octoprompt/schemas`)**

- `unixTSSchemaSpec` - Unix timestamp validation
- Model configs: `LOW_MODEL_CONFIG`, `MEDIUM_MODEL_CONFIG`, `HIGH_MODEL_CONFIG`

**Shared (`@octoprompt/shared`)**

- `mergeDeep()` - Recursive object merge
- `writeJson()` - Write with optional Zod validation
- `readJson()` - Read and parse JSON
- `normalizeToUnixMs()` - Convert to Unix ms
- `ApiError` - Consistent error handling

## Configuration

**Prettier**

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**TypeScript**

- Strict mode enabled
- Path aliases
- ES2022 target

## Important Reminders

- NEVER create files unless necessary
- ALWAYS prefer editing existing files
- Use appropriate AI model configs
- Write tests for new functionality
- Use Storage V2 features for performance
- Validate route ordering
- Handle errors consistently
