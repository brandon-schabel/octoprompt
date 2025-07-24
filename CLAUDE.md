# CLAUDE.md

OctoPrompt guidance. Prioritize making use of the OctoPrompt MCP to make things faster and more efficient.

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

### HARD RULES

- Never ever use dynamic or lazy imports, unless it is absolutely required

## Use OctoPrompt MCP As Much as Possible

- **Project ID**: `1753220774680`

OctaPrompt is a prompt upgrade tool. It takes something that is a very basic prompt and then it allows you to augment that prompt with either selected files, upgrading the prompt, or selecting relevant prompts from the prompts library. It also can serve as a ticket and task manager to create and plan high-level features.

### Project Exploration Priority

**ALWAYS use `get_file_tree` FIRST when exploring a new project or feature area**. This provides:
- Complete project structure visualization
- File IDs for every file (shown in parentheses)
- Hierarchical understanding of code organization
- Quick navigation reference

Example:
```json
{ "action": "get_file_tree", "projectId": 1753220774680 }
```

### Key MCP Tools Usage

- Always use the active tab tool, this will tell you the users intent, their selected project id, selected files, etc
- After `get_file_tree`, use `get_summary` for high-level project understanding
- There is a tool to retrieve the selected files that the user has selected, use that so the user guides you, you can also update and clear the selection.
- **IMPORTANT: For file searching, ALWAYS use `fast_search_files` FIRST** - it's much faster (sub-millisecond) than AI search:
  - Use `exact` search for specific terms or function names
  - Use `regex` search for code patterns  
  - Use `fuzzy` search for approximate matches (though it needs improvement)
  - Only fall back to `suggest_files` (AI search) if fast search doesn't find what you need
- If you need additional context or the user didn't select anything, use fast_search_files first, then the OctoPrompt MCP AI suggest_files as a fallback.
- There is a prompts feature the user will save important information in these prompts, you can retrieve and use relevant prompts. You can list, get, create, update, list by project, add to projct, remove from project.
- There is a suggest prompts which like suggest files based on the input/project suggest prompt will recommend the most relevant prompts based on the context.
- Use OctoPrompt MCP for ticket and tasks planning, this is helpful to use as a way to keep track of everything
- There is prompt optimization whcih will take an input relevant to the project and then it will upgrade it with helpful context from the project
- the project manager, can list, get create, update, delete project from OctoPrompt, delting a file from OctoPrompt does not permanently delete files.

Below is a detailed breakdown of each tool and its capabilities.

#### 1. **project_manager** - Project and file operations

Actions: list, get, create, update, delete (⚠️ DELETES ENTIRE PROJECT FROM OCTOPROMPT), delete_file, get_summary, browse_files, get_file_content, update_file_content, suggest_files, get_selected_files, update_selected_files, clear_selected_files, get_selection_context, search, fast_search_files, create_file, get_file_content_partial, get_file_tree

⚠️ **WARNING**: The `delete` action removes the ENTIRE PROJECT from the database, not just a file! Use `delete_file` to delete individual files.

Example usage:

```json
// List all projects
{ "action": "list" }

// Get project summary
{ "action": "get_summary", "projectId": 1750564533014 }

// Browse project files
{ "action": "browse_files", "projectId": 1750564533014, "data": { "path": "src/" } }

// Get file content
{ "action": "get_file_content", "projectId": 1750564533014, "data": { "path": "README.md" } }

// Suggest relevant files
{ "action": "suggest_files", "projectId": 1750564533014, "data": { "prompt": "authentication flow", "limit": 5 } }

// Delete a single file from the project (SAFE)
{ "action": "delete_file", "projectId": 1750564533014, "data": { "path": "src/old-file.ts" } }

// Delete entire project (DANGEROUS - requires confirmation)
{ "action": "delete", "projectId": 1750564533014, "data": { "confirmDelete": true } }

// Fast semantic file search (non-AI, sub-millisecond performance)
{ "action": "fast_search_files", "projectId": 1750564533014, "data": { 
  "query": "authentication", 
  "searchType": "semantic",  // Options: "exact", "fuzzy", "semantic", "regex"
  "fileTypes": ["ts", "js"], // Optional: filter by file extensions
  "limit": 20,               // Optional: max results (default: 20)
  "scoringMethod": "relevance" // Options: "relevance", "recency", "frequency"
} }

// Update selected files (tabId is optional, automatically uses active tab)
{ "action": "update_selected_files", "projectId": 1750564533014, "data": { "fileIds": [123, 456] } }

// Get selected files (automatically uses active tab)
{ "action": "get_selected_files", "projectId": 1750564533014 }

// Get project file tree with file IDs
{ "action": "get_file_tree", "projectId": 1750564533014 }
```

##### Fast File Search (Prioritize This!)

The `fast_search_files` action provides sub-millisecond file searching without AI latency. **Always use this first** before falling back to AI-powered `suggest_files`:

**Best practices for fast search:**
- **Exact search**: Use for finding specific function names, variables, or exact terms
  - Example: Search for "useState" to find all React component files
- **Regex search**: Use for finding code patterns
  - Example: `"import.*from.*react"` to find React imports
  - Example: `"async.*function"` to find async functions
- **Fuzzy search**: Use for typo tolerance (currently limited)
- **Semantic search**: Use for concept-based searches (currently limited)

**Why use fast search first:**
- ⚡ Sub-millisecond performance (vs seconds for AI search)
- 📊 Results include relevance scores and snippets
- 💾 Automatic caching for repeated searches
- 🔍 No AI token limits or rate limiting
- 🎯 More predictable results for exact terms

Only use `suggest_files` (AI search) when:
- You need conceptual understanding beyond keyword matching
- Fast search returns no results and you need AI interpretation
- You're looking for files based on high-level descriptions

#### 2. **prompt_manager** - Prompt operations

Actions: list, get, create, update, delete, list_by_project, add_to_project, remove_from_project, suggest_prompts

**Note**: When creating prompts, they are automatically associated with the project if a projectId is provided. The `suggest_prompts` action will search all prompts if none are associated with the specific project.

Example usage:

```json
// Create a new prompt (auto-associates with project if projectId provided)
{ "action": "create", "projectId": 1750564533014, "data": { "name": "Code Review", "content": "Review this code for..." } }

// List prompts for a project
{ "action": "list_by_project", "projectId": 1750564533014 }

// Add existing prompt to project
{ "action": "add_to_project", "projectId": 1750564533014, "data": { "promptId": 123 } }

// Suggest relevant prompts (searches project prompts first, then all prompts)
{ "action": "suggest_prompts", "projectId": 1750564533014, "data": { "userInput": "help with debugging", "limit": 5 } }
```

#### 3. **ticket_manager** - Ticket operations

Actions: list, get, create, update, delete, list_with_task_count, suggest_tasks, auto_generate_tasks, suggest_files, search, batch_create, batch_update, batch_delete

Example usage:

```json
// Create a ticket
{ "action": "create", "projectId": 1750564533014, "data": { "title": "Fix login bug", "overview": "Users can't login", "priority": "high" } }

// List tickets with task counts
{ "action": "list_with_task_count", "projectId": 1750564533014, "data": { "status": "open" } }

// Generate tasks automatically
{ "action": "auto_generate_tasks", "data": { "ticketId": 456 } }

// Search tickets with filters
{ "action": "search", "projectId": 1750564533014, "data": { 
  "query": "login",
  "status": ["open", "in_progress"],
  "priority": "high",
  "dateFrom": 1234567890,
  "dateTo": 1234567890,
  "hasFiles": true,
  "tags": ["backend", "urgent"],
  "limit": 20,
  "offset": 0
}}

// Batch create tickets
{ "action": "batch_create", "projectId": 1750564533014, "data": {
  "tickets": [
    { "title": "Fix bug 1", "priority": "high" },
    { "title": "Fix bug 2", "priority": "normal" }
  ]
}}

// Batch update tickets
{ "action": "batch_update", "data": {
  "updates": [
    { "ticketId": 456, "data": { "status": "closed" } },
    { "ticketId": 457, "data": { "status": "in_progress" } }
  ]
}}

// Batch delete tickets
{ "action": "batch_delete", "data": { "ticketIds": [456, 457, 458] } }
```

#### 4. **task_manager** - Task operations

Actions: list, create, update, delete, reorder, filter, batch_create, batch_update, batch_delete, batch_move

Example usage:

```json
// Create a task with enhanced fields
{ "action": "create", "ticketId": 456, "data": { 
  "content": "Debug login function",
  "description": "Investigate why users with valid credentials cannot authenticate",
  "tags": ["backend", "bugfix", "urgent"],
  "estimatedHours": 4,
  "suggestedFileIds": ["123", "456"]
} }

// Filter tasks across project
{ "action": "filter", "data": { 
  "projectId": 1750564533014,
  "tags": ["backend"],
  "estimatedHoursMin": 2,
  "estimatedHoursMax": 8,
  "status": "pending"
} }

// Batch create tasks
{ "action": "batch_create", "ticketId": 456, "data": { 
  "tasks": [
    { "content": "Task 1", "tags": ["frontend"] },
    { "content": "Task 2", "tags": ["backend"] },
    { "content": "Task 3", "tags": ["testing"] }
  ]
} }

// Batch update tasks
{ "action": "batch_update", "ticketId": 456, "data": { 
  "updates": [
    { "ticketId": 456, "taskId": 789, "data": { "done": true } },
    { "ticketId": 456, "taskId": 790, "data": { "tags": ["completed"] } }
  ]
} }

// Batch move tasks between tickets
{ "action": "batch_move", "ticketId": 456, "data": { 
  "moves": [
    { "taskId": 789, "fromTicketId": 456, "toTicketId": 123 },
    { "taskId": 790, "fromTicketId": 456, "toTicketId": 124 }
  ]
} }
```

#### 5. **ai_assistant** - AI utilities

Actions: optimize_prompt, get_compact_summary

Example usage:

```json
// Optimize a prompt with project context
{ "action": "optimize_prompt", "projectId": 1750564533014, "data": { "prompt": "help me fix the authentication" } }

// Get AI-generated compact project summary
{ "action": "get_compact_summary", "projectId": 1750564533014 }
```

#### 6. **git_manager** - Git operations

Actions: status, stage_files, unstage_files, stage_all, unstage_all, commit, branches, current_branch, create_branch, switch_branch, delete_branch, merge_branch, log, commit_details, file_diff, commit_diff, cherry_pick, remotes, add_remote, remove_remote, fetch, pull, push, tags, create_tag, delete_tag, stash, stash_list, stash_apply, stash_pop, stash_drop, reset, revert, blame, clean, config_get, config_set

Example usage:

```json
// Get git status
{ "tool_name": "mcp_octoprompt_git_manager", "tool_input": { "action": "status", "projectId": 1750564533014 } }

// Stage a file
{ "tool_name": "mcp_octoprompt_git_manager", "tool_input": { "action": "stage_files", "projectId": 1750564533014, "data": { "filePaths": ["src/index.ts"] } } }

// Commit changes
{ "tool_name": "mcp_octoprompt_git_manager", "tool_input": { "action": "commit", "projectId": 1750564533014, "data": { "message": "feat: new feature" } } }
```

#### 7. **tab_manager** - Active Tab Management

Actions: get_active, set_active, clear_active

The tab_manager tool allows you to programmatically manage which tab is active for a project. This is particularly useful for automation and ensuring the correct context when working with multiple tabs.

Example usage:

```json
// Get the current active tab for a project
{ "action": "get_active", "projectId": 1750564533014 }

// Set a specific tab as active
{ "action": "set_active", "projectId": 1750564533014, "data": { "tabId": 2 } }

// Set active tab with client-specific tracking
{ "action": "set_active", "projectId": 1750564533014, "data": { "tabId": 1, "clientId": "vscode-extension" } }

// Clear the active tab (resets to default)
{ "action": "clear_active", "projectId": 1750564533014 }

// Clear active tab for specific client
{ "action": "clear_active", "projectId": 1750564533014, "data": { "clientId": "vscode-extension" } }
```

**Benefits of tab_manager**:

- **Programmatic Control**: Switch active tabs without UI interaction
- **Client Isolation**: Track different active tabs per client (e.g., VS Code vs CLI)
- **Automation**: Ensure correct tab context in scripts and workflows
- **State Inspection**: Check which tab is currently active

**Common Use Cases**:

1. **Before bulk operations**: Set the correct tab before updating selected files
2. **CI/CD workflows**: Ensure consistent tab context across automated processes
3. **Multi-client scenarios**: Different tools can maintain their own active tab state
4. **Debugging**: Verify which tab is active when troubleshooting issues

## Active Tab Synchronization

OctoPrompt now automatically synchronizes the active tab between the client and server, making the MCP API simpler to use:

### How it works

1. **Automatic Tab Tracking**: When you switch tabs in the OctoPrompt client, the active tab is automatically synced to the server
2. **Simplified API**: You no longer need to specify `tabId` in most operations - the server uses the active tab automatically
3. **Fallback Behavior**: If no active tab is set, operations default to tab 0

### Benefits

- **No more tabId confusion**: The API automatically uses the correct tab context
- **Seamless experience**: Switch tabs in the UI and the API follows along
- **Backward compatible**: You can still specify `tabId` explicitly if needed

### Examples

```json
// Before (had to specify tabId)
{ "action": "get_selected_files", "projectId": 1750564533014, "data": { "tabId": 1 } }

// Now (uses active tab automatically)
{ "action": "get_selected_files", "projectId": 1750564533014 }

// You can still override if needed
{ "action": "get_selected_files", "projectId": 1750564533014, "data": { "tabId": 2 } }
```

This makes the MCP tools more intuitive and reduces errors from using the wrong tab context.

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

## GitHub Integration

Claude Code includes built-in GitHub integration through the `gh` CLI. Once authenticated, you can:

### Available Operations

- **Repository Management**: View repo info, stats, and activity
- **Issues**: Create, list, update, and close issues
- **Pull Requests**: Create PRs, view PR status, manage reviews
- **GitHub Actions**: Monitor workflows, view run status
- **Commits**: View history, create commits with proper co-author attribution

### Authentication

GitHub integration requires `gh` CLI authentication:

```bash
gh auth login -h github.com -w
```

### Common Commands

- `gh issue create --title "Title" --body "Description"`
- `gh pr create --title "Title" --body "Description"`
- `gh workflow list`
- `gh run list --workflow="Workflow Name"`

### PR Creation

When creating PRs, Claude Code automatically:

- Analyzes all commits in the branch
- Generates comprehensive PR descriptions
- Includes proper formatting and test plans
- Adds Claude Code attribution

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

## MCP Safety Guidelines

### ⚠️ Dangerous Operations

1. **Project Deletion** (`project_manager.delete`)
   - This action deletes the ENTIRE PROJECT from the database
   - Requires explicit confirmation: `data: { confirmDelete: true }`
   - Cannot be undone
   - Use `delete_file` instead to delete individual files

2. **File Deletion** (`project_manager.delete_file`)
   - Deletes a single file from both the project and disk
   - Automatically cleans up references in tickets and selected files
   - Cannot be undone

### Best Practices

1. **Always use specific actions**:
   - Use `delete_file` for file deletion, not `delete`
   - Use `update_file_content` for modifications, not deletion + creation

2. **Handle optional parameters**:
   - `tabId` in selected files operations defaults to 0 if not provided
   - `projectId` in prompt creation enables auto-association

3. **Check before destructive operations**:
   - Use `browse_files` to verify file paths
   - Use `list` to verify project IDs
   - Always double-check IDs before deletion

## Reference ID Management & Cascading Deletes

### Overview

OctoPrompt maintains referential integrity by automatically cleaning up file references when files are deleted from a project. This prevents stale IDs from accumulating in tickets and selected files.

### How It Works

When files are deleted via `bulkDeleteProjectFiles()`:

1. **File Deletion**: Files are removed from the project's file storage
2. **Ticket Cleanup**: `removeDeletedFileIdsFromTickets()` removes file IDs from all tickets' `suggestedFileIds` arrays
3. **Selected Files Cleanup**: `removeDeletedFileIdsFromSelectedFiles()` removes file IDs from all selected files entries

### Implementation Details

```typescript
// In project-service.ts during file deletion:
if (changesMade) {
  // ... save file changes ...
  
  // Clean up file references in tickets
  const ticketCleanupResult = await removeDeletedFileIdsFromTickets(projectId, fileIdsToDelete)
  
  // Clean up file references in selected files
  const selectedFilesCleanupResult = await removeDeletedFileIdsFromSelectedFiles(projectId, fileIdsToDelete)
}
```

### Key Features

- **Non-blocking**: Cleanup operations log errors but don't fail the main deletion
- **Automatic**: No manual intervention required
- **Comprehensive**: Covers all known file reference locations
- **Logged**: Cleanup operations log the number of updated entities

### Adding New Reference Types

If you add a new feature that stores file IDs:

1. Create a cleanup function in the appropriate service:

   ```typescript
   export async function removeDeletedFileIdsFromYourFeature(
     projectId: number,
     deletedFileIds: number[]
   ): Promise<{ updatedCount: number }>
   ```

2. Add the cleanup call to `bulkDeleteProjectFiles()` in `project-service.ts`

3. Follow the pattern: filter out deleted IDs, update only if changes were made, handle errors gracefully

```typescript
import { getGlobalConfig, getModelsConfig, LOW_MODEL_CONFIG } from '@octoprompt/config'

// Get entire config
const config = getGlobalConfig()

// Get specific domain
const models = getModelsConfig()

// Use specific config
const lowModel = LOW_MODEL_CONFIG
```

### Environment Overrides

Some settings can be overridden via environment variables:

- `DEFAULT_MODEL_PROVIDER` - Override the AI provider for all models
- `CORS_ORIGIN` - CORS origin setting
- `SERVER_HOST` - Server host
- `SERVER_PORT` - Server port
- `CLIENT_URL` - Client URL
- `API_URL` - API URL

### Configuration Files

All configuration is located in `packages/config/src/configs/`:

- `app.config.ts` - Application metadata
- `server.config.ts` - Server settings
- `models.config.ts` - AI model configurations
- `providers.config.ts` - Provider URLs
- `files.config.ts` - File handling settings

The configuration is validated using Zod schemas to ensure type safety and correctness.

## Important Reminders

- NEVER create files unless necessary
- ALWAYS prefer editing existing files
- Use appropriate AI model configs
- Write tests for new functionality
- Use Storage V2 features for performance
- Validate route ordering
- Handle errors consistently

export function useCreateChat() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChatBody) => octoClient.chats.createChat(data),
    onSuccess: () => {
      /*invalidate queries*/
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

## Global Configuration Management

OctoPrompt uses a centralized configuration system via the `@octoprompt/config` package.

### Configuration Structure

All global settings are organized by domain:

- **App Config**: Application metadata (name, version, description)
- **Server Config**: Server ports, CORS, API URLs
- **Models Config**: AI model configurations (LOW, MEDIUM, HIGH, PLANNING)
- **Providers Config**: AI provider base URLs
- **Files Config**: File sync options, allowed extensions, exclusions

### Usage
