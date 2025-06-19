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

### Build

- `bun run build-binaries` - Build cross-platform binaries
- `bun run format` - Format with Prettier

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
scripts/                 # Build scripts
docs/                    # Documentation
```

## Storage V2 Features

- **LRU Caching** with TTL
- **Indexing**: Hash (O(1)) and B-tree for ranges
- **Migrations**: Versioned schema evolution
- **Adapters**: File-based (prod) and memory (test)
- **Concurrency**: File locking, atomic operations

```typescript
const storage = new StorageV2<Project>({
  adapter: new FileAdapter('projects'),
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'created', type: 'btree' }
  ],
  cache: { maxSize: 100, ttl: 300000 }
})
```

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

1. **Storage**: Enhanced JSON storage with V2 features
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
