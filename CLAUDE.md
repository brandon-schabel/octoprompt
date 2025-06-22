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

### Available Linear MCP Commands

- **List teams**: `mcp__linear__list_teams` - View all teams in the workspace
- **List projects**: `mcp__linear__list_projects` - View all projects (use with teamId parameter)
- **List issues**: `mcp__linear__list_issues` - View issues (use with teamId or projectId)
- **Get issue details**: `mcp__linear__get_issue` - Get specific issue details (use with issue ID)
- **Create comments**: `mcp__linear__create_comment` - Add comments to issues
- **Create issue**: `mcp__linear__create_issue` - Create new issues
- **Update issue**: `mcp__linear__update_issue` - Update existing issues
- **List issue statuses**: `mcp__linear__list_issue_statuses` - View available statuses
- **Get user**: `mcp__linear__get_user` - Get user information
- **Search documentation**: `mcp__linear__search_documentation` - Search Linear docs

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
