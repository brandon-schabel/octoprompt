# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `bun run dev` - Start both client and server in development mode
- `bun run dev:client` - Start only client (port 5173)
- `bun run dev:server` - Start only server (port 3147)

### Testing

- `bun run test:server` - Run server tests
- `bun run test:shared` - Run shared package tests
- `bun run test:schemas` - Run schema tests
- `bun run test:services` - Run services tests
- `bun run test:storage` - Run storage tests
- `bun run test:api-client` - Run API client tests
- `bun run test:all` - Run all tests
- `bun run e2e` - Run Playwright E2E tests (client package)

**Note:** All tests use Bun as the test runner. Individual packages can run tests with `bun test` in their directories.

### Production Build

- `bun run build-binaries` - Build cross-platform binaries
- `bun run format` - Format all code with Prettier (config: `.prettierrc`)
- OpenAPI spec generation happens automatically via `scripts/generate-openapi-spec.ts`

# OctoPrompt Development Guide

## General Code Principles
Write self-explanatory, modular, and functional code. Adhere to DRY (Don't Repeat Yourself), SRP (Single Responsibility Principle), and KISS (Keep It Simple, Stupid). Code should be easily unit-testable and read like a clear sentence, avoiding magic numbers. Include a comment at the top of each file detailing the 5 most recent changes to prevent repeated mistakes. Minimize file size by writing concise code and fitting more characters per line where readable.

---
## TypeScript Rules
Apply these to all TypeScript files for a consistent, high-quality codebase.

### 1. Strong Typing & Advanced TS Features
- **No `any` Unless Absolutely Necessary**: Use strong typing. For unknown shapes, use or create a Zod schema and derive the TS type.
- **Generics & Inference**: Leverage TypeScript’s generics and advanced inference to avoid wide or unknown types.
- **Modern TS Constructs**: Use mapped types, intersection types, `satisfies` expressions, etc., for clarity or correctness.

### 2. Functional & Readable Code
- **Functional Programming Style**: Prefer pure functions; avoid side effects unless essential.
- **No Bloated Functions**: Each function should have a single, small responsibility. Refactor large functions.
- **Descriptive Naming**: Use clear names. Avoid abbreviations or single-letter variables (except in trivial loops).

### 3. Error Handling & Logging
- **Throw or Return**: On error, throw a typed error (`Error` subclass) or return a descriptive error object. Do not silently swallow errors.
- **Logging**: Use a consistent logging approach (e.g., custom `logger` module). Prefer structured logs over `console.log` for production.

### 4. Minimal External Dependencies
- **Prefer Bun & Standard Lib**: Rely on Bun’s built-in features or TS/Node standard libraries. Verify necessary external libraries carefully.
- **Tree Shaking & Dead Code**: Minimize imports and remove unused code. Don’t import entire libraries for small parts.

### 5. File & Module Organization
- **Single-Responsibility Files**: Each file should typically contain one main concept (class, service, or small group of related functions).
- **Clear Imports & Exports**: Use named exports unless a file’s purpose is a single main export. Sort and group imports logically.

### 6. Testing & Documentation
- **Test-Driven Mindset**: Add/update tests when introducing new logic. Keep functions small and unit-testable.
- **Inline Documentation**: Provide concise docstrings or inline comments for complex logic. Keep them accurate.

* **Readability and Simplicity (KISS)**: Write clear, concise code.
* **Modularity**: Organize code into logical modules/packages. Avoid circular dependencies.
* **Error Handling**: Handle exceptions gracefully. Use specific exception types.
* **Docstrings**: Write clear docstrings for modules, functions, and Pydantic models (e.g., Google style).
* **Consistent Formatting**: Use a formatter like Black or Ruff. Adhere to PEP 8.
* **Avoid Global Variables**: Minimize their use.
* **Configuration Over Hardcoding**: Use Pydantic `BaseSettings` for configs.
* **Regularly Refactor**.

---
## OctoPrompt Specifics
- **Timestamps & IDs**: All IDs, `created`, and `updated` timestamps are Unix timestamps in milliseconds. For IDs, `-1` signifies `null`; otherwise, it must be a valid Unix timestamp (ms).
- **Maps with Numeric Keys**: Prefer `new Map()` over plain objects, as object keys are converted to strings.
- **Service File Structure**: Typically:
    - Schema file: Base schema + CRUD operation schemas (e.g., `id`, `created`, `updated` excluded on create).
    - Storage file: JSON file-based data persistence.
    - Service file: Business logic for data manipulation.
    - Routes/API file: API route definitions.
- **API Type Safety**:
    - TypeScript: Zod with Hono for validation (note: route/API params often parse as strings).
- **OpenAPI Specs**: Every API must have proper OpenAPI specifications.
- **Route Ordering**: Crucial. Incorrect order leads to incorrect route matching. Pay very close attention.

---
## Major Features/Services
- **Projects and Files**: Core concept; projects contain chats and files with versioning support.
- **Chats and Messages**: Built-in AI chat functionality with multi-provider support.
- **Claude Code Integration**: Advanced development workflows with Claude Code AI assistant.
- **Gen AI**: Services for generating structured data, coding agents, file search, and summarization.
- **Provider Key Service**: Manages API keys for AI providers (OpenAI, Anthropic, Google, etc.).
- **Prompts**: Manages user prompts used to guide AI with categorization and templates.
- **AI Agents & Workflows**: Mastra-based AI agents for complex automation tasks.
- **File Management**: Advanced file synchronization with ignore rules and live watching.
- **Global State**: Frontend state management synced to local storage.
- **Monaco Editor Integration**: Full-featured code editor with diff viewing capabilities.

---
## Other Technical Info
- **Functional API Tests**: Each API must have them.
- **Unit Testable Functions**: Design functions with minimal external reliance, predictable I/O (except Gen AI).
- **Single Source of Truth (SSOT)**: Adhere to this principle.

---
## Project Overall Structure
```
OctoPrompt  
	packages/
		ai/                          // AI/ML package with Mastra integration
			src/mastra/              // Mastra agents and workflows
				agents/              // AI agents for various tasks
				workflows/           // AI workflow definitions
			index.ts
			package.json
			README.md
		
		api-client/                  // Type-safe API client
			index.ts                 // Main client export
			api-client.ts            // Client implementation
			src/tests/               // Functional API tests
				chat-api.test.ts
				projects-api.test.ts
				prompt-api.test.ts
				provider-key-api.test.ts
				run-functional-tests.ts
				test-config.ts
			package.json
			README.md
	
		client/                      // React frontend (Vite + TanStack Router)
			src/
				components/
					ui/              // ShadCN components
					navigation/      // App navbar, sidebar
					projects/        // Project-specific components
					file-changes/    // Diff viewer, change dialogs
					claude-code/     // Claude Code integration
					error-boundary/  // Error handling
				constants/           // Frontend constants
				hooks/
					api/             // API hooks with schema types
					chat/            // Chat-specific hooks
					utility-hooks/   // Common utility hooks
				routes/              // TanStack Router routes
					__root.tsx
					chat.tsx
					projects.tsx
					prompts.tsx
					claude-code.tsx
					health.tsx
					keys.tsx
				utils/
			components.json          // ShadCN configuration
			tailwind.config.js       // Tailwind CSS config
			vite.config.ts           // Vite configuration
			package.json
			playwright-report/       // E2E test reports
	
		schemas/                     // Zod schemas and TypeScript types
			src/
				project.schemas.ts
				chat.schemas.ts
				prompt.schemas.ts
				provider-key.schemas.ts
				claude-code.schemas.ts
				gen-ai.schemas.ts
				common.schemas.ts
				constants/
					model-default-configs.ts  // AI model configurations
					file-sync-options.ts
				schema-utils.ts
				unix-ts-utils.ts
			index.ts
			package.json
			README.md

		server/                      // Hono backend server
			server.ts                // Main server entry point
			src/
				app.ts               // Hono router, middleware, error handling
				routes/
					chat-routes.ts
					prompt-routes.ts
					project-routes.ts
					claude-code-routes.ts
					gen-ai-routes.ts
					provider-key-routes.ts
					file-serving-routes.ts
			client-dist/             // Built frontend files
			package.json

		services/                    // Business logic layer
			src/
				chat-service.ts
				prompt-service.ts
				project-service.ts
				claude-code-service.ts
				gen-ai-services.ts
				provider-key-service.ts
				file-services/
					file-sync-service-unified.ts
				model-providers/
					model-fetcher-service.ts
					provider-defaults.ts
				utils/                   // Service utilities
				__tests__/               // Service tests
			index.ts
			package.json
			README.md

		shared/                      // Shared utilities and constants
			src/
				constants/
					claude-code-templates.ts
				error/
					api-error.ts
				structured-outputs/
				utils/
					file-tree-utils/
					merge-deep.ts
					parse-timestamp.ts
					pattern-matcher.ts
					service-utils.ts
			index.ts
			package.json

		storage/                     // Enhanced V2 storage system
			src/
				core/                    // Storage core system
					base-storage.ts      // Base storage class
					index-manager.ts     // Indexing system
					migration-manager.ts // Schema migrations
					multi-level-cache.ts // Caching layer
					storage-adapter.ts   // Storage abstractions
				adapters/
					file-storage-adapter.ts
					memory-storage-adapter.ts
				migration/
					storage-migrator.ts
					v2-migrations.ts
				chat-storage.ts
				prompt-storage.ts
				project-storage.ts
				claude-code-storage.ts
				provider-key-storage.ts
				__tests__/               // Storage tests
			index.ts
			package.json
			README.md                    // Basic storage docs
			README-V2.md                 // V2 enhancement docs

	docs/                            // Additional documentation
		chat.md
		coding-agent.md
		general-ai-concepts.md
		monaco-editor-integration.md
		projects.md
		prompts.md
		provider-keys.md

	scripts/                         // Build and utility scripts
		build-binaries.ts
		generate-openapi-spec.ts
		start-dev.ts
		start-client-dev.ts
		start-server-dev.ts

	data/                            // Runtime data storage
		projects/
		chat_storage/
		prompt_storage/
		provider_key_storage/
		claude_code_storage/

	Configuration Files:
		package.json                     // Workspace configuration
		tsconfig.json                    // Root TypeScript config
		.prettierrc                      // Code formatting rules
		.gitignore                       // Git ignore patterns
		bun.lock                         // Dependency lock file
		openapi.json                     // Generated API specification
```
```

---
## Scripts

**Root `package.json`:**
```json
{
	"dev": "bun run scripts/start-dev.ts",
    "dev:client": "bun run scripts/start-client-dev.ts",
    "dev:server": "bun run scripts/start-server-dev.ts",
    "stop": "bun run scripts/stop.ts",
    "build-binaries": "bun run scripts/build-binaries.ts",
    "format": "prettier --write .",
    "test:server": "cd packages/server && bun run test",
    "test:shared": "cd packages/shared && bun run test",
    "test:schemas": "cd packages/schemas && bun run test",
    "test:services": "cd packages/services && bun run test",
    "test:storage": "cd packages/storage && bun run test",
    "test:api-client": "cd packages/api-client && bun run test",
    "test:all": "bun run test:server && bun run test:shared && bun run test:schemas && bun run test:services && bun run test:storage && bun run test:api-client"
}
```

**`packages/server/package.json`:**
```json
{
  "test": "bun test src/",
  "test:watch": "bun test --watch src/",
  "start": "bun server.ts",
  "dev": "DEV=true bun server.ts",
  "dev:watch": "DEV=true bun --watch server.ts",
  "start:prod": "ENVIRONMENT=prod cd dist && ./start.sh"
}
```

**`packages/client/package.json`:**
```json
{
  "dev": "vite",
  "build": "tsc -b tsconfig.app.json && vite build",
  "build:prod": "tsc -b tsconfig.app.json && ENVIRONMENT=prod vite build",
  "preview": "vite preview",
  "test": "bun test",
  "test:watch": "bun test --watch"
}
```

**`packages/shared/package.json`:**
```json
{
  "test": "bun test"
}
```

**`packages/storage/package.json`:**
```json
{
  "test": "bun test src/"
}
```

### Testing Infrastructure
- **Test Runner**: Bun test runner across all packages
- **E2E Testing**: Playwright for client integration tests
- **API Testing**: Type-safe API client tests with Zod validation
- **Mocking**: Bun mock utilities for unit tests
- **Coverage**: Built-in Bun coverage reporting

**`packages/services/package.json`:**
```json
{
  "test": "bun test src/"
}
```

**`packages/api-client/package.json`:**
```json
{
  "test": "bun test"
}
```
---
## Configuration Files

### Code Formatting (`.prettierrc`)
```json
{
  "trailingComma": "none",
  "semi": false,
  "singleQuote": true,
  "jsxSingleQuote": true,
  "printWidth": 120,
  "tabWidth": 2
}
```

### Tailwind CSS (`packages/client/tailwind.config.js`)
- Dark mode support with class-based switching
- Custom animations (gradient effects)
- ShadCN color system with CSS variables
- Typography plugin for markdown rendering

### ShadCN (`packages/client/components.json`)
- Style: "new-york"
- TypeScript support enabled
- Path aliases for components, utils, and UI elements

### TypeScript Configuration
- Root `tsconfig.json` with modern ESNext target
- Package-specific configurations for optimal builds
- Strict mode enabled across all packages

---
## Useful Utils

**`@octoprompt/schemas`:**
- `unixTSSchemaSpec`: Standard Unix timestamp (ms) schema.
- `unixTSOptionalSchemaSpec`: Optional Unix timestamp (ms).
- `unixTSArraySchemaSpec`: Required array of Unix timestamps (ms).
- `unixTSArrayOptionalSchemaSpec`: Optional array of Unix timestamps (ms).

**`@octoprompt/shared`:**
- `mergeDeep<T>([obj1, obj2, ...]): T`: Recursively merges objects.
- `normalizePath(filePath: string): string`: Normalizes path separators.
- `filterByPatterns(filePaths: string[], patterns: string[], options?: picomatch.PicomatchOptions): string[]`: Filters file paths by glob patterns.
- `buildPromptContent({ fileMap, promptData, selectedFiles, selectedPrompts, userPrompt }): string`
- `calculateTotalTokens({ promptData, selectedPrompts, userPrompt, selectedFiles, fileMap }): number`
- `buildFileTree(files: ProjectFile[]): Record<string, any>`
- Predefined prompt file contents (e.g., `contemplativePrompt`, `summarizationSteps`, `octopromptPlanningMetaPrompt`) 
- `promptsMap`: Exported object mapping names to prompt strings.
**`packages/shared/src/constants/model-default-configs.ts`:**
- `LOW_MODEL_CONFIG`, `MEDIUM_MODEL_CONFIG`, `HIGH_MODEL_CONFIG`: `ModelOptionsWithProvider` objects with settings for temperature, maxTokens, provider, model, etc. (e.g., `LOW_MODEL_CONFIG` uses `google/gemini-2.5-flash-preview`).


**`@octoprompt/shared`:**
- `getFullProjectSummary(projectId: number): Promise<string>`: Generates a full project summary.
- `resolveJsonPath(rawPath: string | string[], basePath?: string): string`: Resolves input to a normalized file path.
- `writeJson<TData, S extends ZodTypeAny>(options: { path, data, schema?, basePath? }): Promise<S extends ZodTypeAny ? z.infer<S> : TData>`: Writes data to JSON, optionally validating. Creates directories.
- `readJson<T = unknown>(options: { path, basePath? }): Promise<T | null>`: Reads and parses JSON (no validation on read).
- `parseTimestamp(tsValue: unknown): Date | null`: Safely parses various timestamp formats to `Date`.
- `normalizeToUnixMs(tsValue: unknown): number`: Parses timestamp and converts to Unix ms (defaulting to `new Date().getTime()` if parsing fails).
- `resolvePath(path: string): string`: Resolves path, expanding tilde.
- `normalizePathForDb(path: string): string`: Normalizes path for database storage (consistent format).

---
## Storage System V2 Features

### Advanced Capabilities
- **LRU Caching**: In-memory cache with TTL support for frequently accessed data
- **Indexing System**: 
  - Hash indexes for O(1) lookups by ID
  - B-tree indexes for range queries and sorting
  - Automatic index maintenance on CRUD operations
- **Schema Migrations**: Versioned migrations for data structure evolution
- **Storage Adapters**:
  - File-based adapter (production)
  - Memory-based adapter (testing)
  - Pluggable architecture for future adapters
- **Concurrency Control**:
  - File locking for write operations
  - Atomic operations with rollback support
  - Read-write separation for performance
- **Performance Optimizations**:
  - Batch operations support
  - Lazy loading for large datasets
  - Query performance metrics

### Storage API Example
```typescript
// V2 Storage with caching and indexing
const storage = new StorageV2<Project>({
  adapter: new FileAdapter('projects'),
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'created', type: 'btree' }
  ],
  cache: { maxSize: 100, ttl: 300000 } // 5 min TTL
});

// Fast queries with indexes
const recent = await storage.query({
  where: { created: { $gte: Date.now() - 86400000 } },
  orderBy: 'created',
  limit: 10
});
```

---
## AI Integration Architecture

### Mastra Framework Integration
- **Multi-Provider Support**: OpenAI, Anthropic, Google (Gemini), Groq
- **Tool System**: Custom tools for code generation, file search, summarization
- **Agent Capabilities**: Autonomous coding agents with project context
- **Streaming Support**: Real-time AI responses with token streaming

### AI Service Patterns
```typescript
// Provider-agnostic AI interface
const ai = getProviderLanguageModelInterface({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Structured data generation
const result = await generateStructuredData({
  model: ai,
  schema: TodoSchema,
  prompt: 'Generate todos for this feature',
  context: projectContext
});
```

---
## Frontend
### Major Packages
- **React v19** with React Compiler for optimization
- **TanStack Router** with automatic route generation (`routeTree.gen.ts`)
- **TanStack Query** for server state management
- **DND Kit** for drag-and-drop functionality
- **ShadCN/UI (Radix)** component library with custom theming
- **React Hook Form** with Zod validation integration
- **Tailwind CSS** with custom animations and dark mode
- **Monaco Editor** (`@monaco-editor/react`) for code editing
- **AI SDK (Vercel)** for chat interfaces
- **React Syntax Highlighter** for code display
- **React Markdown** with highlight.js support
- **Next Themes** for dark/light mode switching

### Frontend Architecture
- **Component Organization**: Feature-based structure with shared UI components
- **Type Safety**: Direct schema imports from `@octoprompt/schemas`
- **Error Boundaries**: Comprehensive error handling with fallback UIs
- **Responsive Design**: Mobile-first with sidebar navigation
- **Performance**: Code splitting, lazy loading, and React 19 optimizations

### Routes (`packages/client/src/routes`)
- `__root.tsx` - Base layout with navigation and providers
- `index.tsx` - Dashboard/landing page
- `projects.tsx` - Project management interface
- `chat.tsx` - AI chat interface
- `prompts.tsx` - Prompt management
- `claude-code.tsx` - Claude Code integration interface
- `keys.tsx` - API key management
- `health.tsx` - System health monitoring

**Route Generation**: Uses TanStack Router's file-based routing with automatic type generation.

### Components (`packages/client/src/components`)
- **UI Components (`components/ui`)**: Complete ShadCN component library
  - Base: `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `textarea.tsx`
  - Navigation: `sidebar.tsx`, `breadcrumb.tsx`, `menubar.tsx`
  - Data: `table.tsx`, `chart.tsx`, `progress.tsx`
  - Forms: `form.tsx`, `select.tsx`, `checkbox.tsx`, `switch.tsx`
  - Layout: `resizable-panel.tsx`, `vertical-resizable-panel.tsx`

- **Feature Components**:
  - **File Management**: `diff-viewer.tsx`, `monaco-editor-wrapper.tsx`, `lazy-monaco-editor.tsx`
  - **Claude Code**: `claude-code-agent.tsx`, `claude-code-modal.tsx`, `claude-code-fab.tsx`
  - **Projects**: `project-list.tsx`, `file-panel/`, `project-settings-dialog.tsx`
  - **Navigation**: `app-navbar.tsx`, `app-sidebar.tsx`, `help-dialog.tsx`
  - **Prompts**: `all-prompts-dialog.tsx`, `promptimizer-dialog.tsx`
  - **Error Handling**: `error-boundary.tsx`, `component-error-boundary.tsx`

- **Common Components**: 
  - `markdown-renderer.tsx` (with syntax highlighting)
  - `shortcuts-palette.tsx` (command palette)
  - `file-attachment.tsx`, `file-upload-input.tsx`
  - `expandable-textarea.tsx`, `format-token-count.tsx`

### Data Fetching
Direct schema import approach for type safety (TypeScript types from shared Zod schemas).

**API Hooks (`packages/client/src/hooks/api`):**
- Core APIs: `use-projects-api.ts`, `use-chat-api.ts`, `use-prompts-api.ts`
- Services: `use-keys-api.ts`, `use-gen-ai-api.ts`, `use-claude-code-api.ts`
- File Operations: `use-file-upload-api.ts`
- AI Integration: `use-ai-chat.ts`
- Error Handling: `common-mutation-error-handler.ts`

**Other Hooks (`packages/client/src/hooks`):**
- **Chat Hooks**: `chat/use-chat-model-params.tsx`
- **Utility Hooks**: `utility-hooks/use-debounce.ts`, `use-copy-clipboard.ts`, `use-local-storage.ts`
- **Project Hooks**: `use-project-file-tree.tsx`, `use-selected-files.ts`
- **Form Hooks**: `use-zod-hook-form.ts` (React Hook Form + Zod integration)
- **Storage Hooks**: `use-kv-local-storage.ts`

**Modern API Hook Pattern (Example `useCreateChat`):**
```typescript
import type { CreateChatBody } from '@octoprompt/schemas'; // Import types directly
// ... other imports: useQueryClient, useMutation, octoClient, toast

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChatBody) => octoClient.chats.createChat(data),
    onSuccess: () => { /* Invalidate queries, show toast */ },
    onError: (error) => { /* Show error toast */ },
  });
}
```

**Schema-First Query (Example `useGetPrompt`):**
```typescript
import type { Prompt } from '@octoprompt/schemas'; // Import types
// ... other imports: useQuery, octoClient, PROMPT_KEYS

export function useGetPrompt(promptId: number) {
  return useQuery({
    queryKey: PROMPT_KEYS.detail(promptId),
    queryFn: () => octoClient.prompts.getPrompt(promptId),
    enabled: !!promptId,
    staleTime: 5 * 60 * 1000,
  });
}
```

**OctoPrompt Client Instance (`octoClient`):**
Singleton client in `packages/client/src/hooks/api.ts` (created via `createOctoPromptClient`) provides type-safe methods for each service (e.g., `octoClient.chats.createChat(data)`).

---
## OctoPrompt Backend Architecture
TypeScript/Bun backend: AI-powered project management, layered architecture, file-based JSON storage with V2 enhancements, service-oriented logic, OpenAPI-compliant REST APIs.

### Core Technologies
- **Runtime**: Bun for fast performance and built-in TypeScript support
- **Framework**: Hono for lightweight, high-performance HTTP handling
- **Validation**: Zod schemas for runtime type safety
- **Storage**: JSON file-based with V2 enhancements (caching, indexing)
- **AI**: Multi-provider support via Vercel AI SDK and Mastra
- **API Docs**: OpenAPI 3.0 specification auto-generation

### Architecture Layers
- **Storage Layer (`@octoprompt/storage`)**: Enhanced V2 storage system with advanced features.
  - **Core Features**: Caching (LRU with TTL), indexing (hash & B-tree), migrations, concurrency control
  - **Base Storage Class**: `BaseStorage<T, S>` provides common functionality
  - **Index Manager**: `IndexManager` for efficient querying
  - **Migration Manager**: `MigrationManager` for schema evolution
  - **Storage Adapters**: File-based and memory-based adapters
  - **Files**: `project-storage.ts`, `chat-storage.ts`, `prompt-storage.ts`, `claude-code-storage.ts`, `provider-key-storage.ts`
  - **Patterns**: Unix ms IDs, `Record<string, Entity>` data structure, Zod validation, atomic file ops, indexed queries

- **Services Layer (`@octoprompt/services`)**: Business logic orchestrating storage.
  Example: `projectService.createProject(data)`.
  Services: `project-service.ts`, `chat-service.ts`, `gen-ai-services.ts`, `claude-code-service.ts`, `provider-key-service.ts`, `file-services/`
  - **File Services**: Unified file sync service with versioning support
  - **Model Providers**: Service for fetching and managing AI model configurations
  - **Utils**: Service utilities, bulk operations, error handlers
  - **Testing**: Comprehensive test suites with mocking patterns

- **API Layer (`packages/server/src/routes`)**: Hono-based routes with OpenAPI specs.
  Example: `createRoute()` for OpenAPI definitions, `OpenAPIHono().openapi(route, handler)`.

### Core Systems
- **File Synchronization**: `syncProject()` uses `getTextFiles`, `loadIgnoreRules`, `syncFileSet`. `createFileChangeWatcher()` for live updates, triggering sync and summarization.
- **AI Integration**: Multi-provider AI via Vercel AI SDK. `getProviderLanguageModelInterface()` (handles OpenAI, Anthropic, OpenRouter, Google, Groq), `generateStructuredData()` (uses `generateObject` from AI SDK).
- **Claude Code Integration**: Full integration with Anthropic's Claude Code via `@anthropic-ai/claude-code` package for enhanced development workflows.
- **Mastra AI Framework**: Advanced AI agents and workflows via `@octoprompt/ai` package with Mastra integration.

---
## Complete Feature Example: Todo System
This example illustrates the full stack implementation pattern used throughout OctoPrompt, demonstrating schema definition, storage layer, service logic, API routes, and testing.

### 1. Schemas (`schemas/src/todo.schemas.ts`)
Defines `TodoSchema`, `TodoCategorySchema`, `CreateTodoBodySchema`, `TodoResponseSchema`, `TodoListResponseSchema` using Zod and `openapi()` helpers. Includes type exports derived via `z.infer`.
```typescript
import { z } from '@hono/zod-openapi'
import { unixTSSchemaSpec, unixTSArraySchemaSpec } from './schema-utils' // Assuming path

export const TodoSchema = z.object({
  id: unixTSSchemaSpec, projectId: unixTSSchemaSpec, title: z.string().min(1),
  description: z.string().optional(), status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']), assignedTo: z.string().optional(),
  dueDate: unixTSSchemaSpec.optional(), tags: z.array(z.string()).default([]),
  created: unixTSSchemaSpec, updated: unixTSSchemaSpec
}).openapi('Todo')

// ... (TodoCategorySchema, CreateTodoBodySchema, etc. are similarly defined)

export type Todo = z.infer<typeof TodoSchema>; /* ... other types */
```

### 2. Storage (`packages/storage/src/todo-storage.ts`)
Implements `readTodos`, `writeTodos`, `readTodoCategories`, `writeTodoCategories`, `generateId` using `readJson`, `writeJson` from `json-scribe.ts`. Data validated with Zod schemas.
```typescript
import { z } from 'zod'; // Assuming path
import { TodoSchema, TodoCategorySchema } from '@octoprompt/schemas';
import { readJson, writeJson } from '../json-scribe'; // Assuming path
import { normalizeToUnixMs } from '@octoprompt/schemas'; // Assuming path

export const TodoStorageSchema = z.record(z.string(), TodoSchema);
// ... (TodoCategoryStorageSchema defined similarly)
const getTodosPath = (projectId: number): string[] => ['data', 'projects', projectId.toString(), 'todos.json'];

export const todoStorage = {
  async readTodos(projectId: number): Promise<z.infer<typeof TodoStorageSchema>> { /* ... */ },
  async writeTodos(projectId: number, todos: z.infer<typeof TodoStorageSchema>): Promise<z.infer<typeof TodoStorageSchema>> { /* ... */ },
  // ... (category methods and generateId)
};
```

### 3. Service (`packages/services/src/todo-service.ts`)
Business logic: `createTodo`, `updateTodoStatus`, `getTodosByProject`, `deleteTodo`, `generateTodoSuggestions` (uses `generateStructuredData`). Handles ID conflicts, validation, and error wrapping (`ApiError`).
```typescript
import { Todo, CreateTodoBody, TodoSchema } from '@octoprompt/schemas'; // Assuming path
import { todoStorage } from '@/utils/storage/todo-storage'; // Assuming path
import { ApiError } from '@octoprompt/shared'; // Assuming path
// ... (other imports like generateStructuredData, getProjectById)

export async function createTodo(data: CreateTodoBody): Promise<Todo> {
  let todoId = todoStorage.generateId(); const now = Date.now();
  const newTodoData: Todo = { id: todoId, ...data, status: 'pending', created: now, updated: now };
  // try-catch for error handling, ID conflict resolution, validation, and writing
  // ...
}
// ... (updateTodoStatus, getTodosByProject, deleteTodo, generateTodoSuggestions)
```

### 4. Routes (`packages/storage/src/routes/todo-routes.ts`)
Hono `OpenAPIHono` routes for CRUD operations and suggestions. Uses `createRoute` for OpenAPI definitions, Zod schemas for request/response validation.
```typescript
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'; // Assuming path
import { CreateTodoBodySchema, TodoResponseSchema, /* ... */ } from 'shared/src/schemas/todo.schemas'; // Path
import { createTodo, /* ... */ } from '@/services/todo-service'; // Path

const createTodoRoute = createRoute({ method: 'post', path: '/api/todos', /* ... */ });
// ... (other route definitions: getTodosRoute, updateTodoStatusRoute, etc.)

export const todoRoutes = new OpenAPIHono()
  .openapi(createTodoRoute, async (c) => {
    const body = c.req.valid('json');
    const todo = await createTodo(body);
    return c.json({ success: true, data: todo }, 201);
  })
  // ... (other route handlers for get, patch, delete, suggestions)
```

### 5. Register Routes (`packages/server/src/app.ts`)
Todo routes are registered with the main Hono app instance.
```typescript
// import { todoRoutes } from './routes/todo-routes'; // Assuming path
// export const app = new OpenAPIHono().route('/', todoRoutes); // Example
```
(Actual registration may vary based on full `app.ts` structure)

### 6. Tests (`packages/services/src/todo-service.test.ts`)
Unit tests for `todo-service` using `bun:test`. Mocks `todoStorage` and `project-service` for isolated testing of service logic, including ID generation and conflict resolution.
```typescript
import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createTodo, /* ... */ } from './todo-service'; // Path
import { CreateTodoBody, Todo } from 'shared/src/schemas/todo.schemas'; // Path

// Mock setup for todoStorage and projectService
// In-memory DB for tests: mockTodosDb
// beforeEach clears mockTodosDb
// Test cases for createTodo, updateTodoStatus, getTodosByProject, deleteTodo, ID conflict
describe('TodoService (Mocked Storage)', () => {
  // ... (setup like testProjectId, beforeEach, afterEach)
  test('createTodo should insert a new todo record', async () => { /* ... */ });
  // ... (other tests)
});
```

---
## Key Backend Patterns
- **Error Handling**: Custom `ApiError` class for consistent API error responses. Global error handler in `app.ts` catches `ApiError` instances.
  ```typescript
  // if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  // app.onError((err, c) => { /* handle ApiError */ });
  ```
- **Validation**: Zod schemas for data validation at storage and API layers. `c.req.valid('json')` for auto-validated request bodies in Hono.
- **ID Generation**: `storage.generateId()` (typically `normalizeToUnixMs(new Date())` or `Date.now()`). Handles collisions by incrementing ID if already exists in the storage record.

---
## Storage System V2 Enhanced Features

The storage system has evolved significantly beyond basic JSON file storage:

### Core Enhancements

**1. Base Storage Class**
```typescript
import { BaseStorage } from '@octoprompt/storage'

class MyStorage extends BaseStorage<MyEntity, MyStorageType> {
  constructor(options?: StorageOptions) {
    super(storageSchema, entitySchema, 'my_data', options)
  }
}
```

**2. Caching System**
- **LRU Cache**: In-memory caching with configurable TTL
- **Cache Stats**: Monitor hit rates and performance
- **Selective Caching**: Enable/disable per storage instance

**3. Indexing System**
```typescript
// Create indexes for fast querying
await indexManager.createIndex({
  name: 'projects_by_name',
  type: 'hash',
  fields: ['name'],
  unique: false
})

// Query using indexes
const projects = await indexManager.query('projects_by_name', 'My Project')
const recentProjects = await indexManager.queryRange(
  'projects_by_created',
  startDate.getTime(),
  endDate.getTime()
)
```

**4. Migration System**
```typescript
import { MigrationManager } from '@octoprompt/storage'

const migrationManager = new MigrationManager(basePath)
migrationManager.register({
  version: '1.0.0',
  description: 'Add project indexes',
  async up() { /* Migration logic */ },
  async down() { /* Rollback logic */ }
})

await migrationManager.migrate()
```

**5. Storage Adapters**
- **File Storage Adapter**: Default JSON file-based storage
- **Memory Storage Adapter**: In-memory storage for testing
- **Extensible**: Easy to add database backends

**6. Concurrency Control**
- **File Locking**: Prevents race conditions
- **Atomic Operations**: Safe concurrent access
- **Lock Timeouts**: Configurable timeout handling

### Performance Improvements

| Operation | V1 (Old) | V2 (Cold) | V2 (Cached) |
|-----------|----------|-----------|-------------|
| Get by ID | O(n) | O(1) + disk | O(1) memory |
| Find by field | O(n) | O(1) with index | O(1) cached |
| Range query | O(n) | O(log n) B-tree | O(log n) |

### Configuration Options
```typescript
interface StorageOptions {
  basePath?: string        // Base directory
  cacheEnabled?: boolean   // Enable caching (default: true)
  cacheTTL?: number       // Cache TTL in ms (default: 5 minutes)
  maxCacheSize?: number   // Max cache entries (default: 100)
  lockTimeout?: number    // Lock timeout in ms (default: 30 seconds)
}
```

---
## End-to-End Testing

### Playwright Integration
- **Test Reports**: Automated E2E test reports in `packages/client/playwright-report/`
- **Visual Testing**: Screenshots and video recordings of test runs
- **Cross-browser**: Testing across different browser environments

### Functional API Testing (`packages/api-client/src/tests/`)
**Test Files:**
- `chat-api.test.ts` - Chat functionality testing
- `projects-api.test.ts` - Project management API testing
- `prompt-api.test.ts` - Prompt management testing
- `provider-key-api.test.ts` - API key management testing
- `run-functional-tests.ts` - Test runner and orchestration
- `test-config.ts` - Test configuration and helpers

**Test Patterns:**
- **Schema Validation**: All responses validated against Zod schemas
- **Type Safety**: Full TypeScript integration with API client
- **Data Cleanup**: Automatic cleanup of test data
- **Error Scenarios**: Comprehensive error handling tests
- **Integration Testing**: Complete request/response cycles

```typescript
// Example functional test pattern
import { describe, test, expect } from 'bun:test'
import { apiClient } from './test-config'
import { ProjectResponseSchema } from '@octoprompt/schemas'

describe('Projects API', () => {
  test('should create project successfully', async () => {
    const project = await apiClient.projects.createProject({
      name: 'Test Project',
      path: '/test/path',
      description: 'Test description'
    })
    
    // Automatic schema validation
    expect(() => ProjectResponseSchema.parse(project)).not.toThrow()
    expect(project.data.name).toBe('Test Project')
  })
})
```

---
## Hono Route Matching (First-Match-Wins)
Routes are evaluated in registration order; the earliest match handles the request.

### 1. Matching Basics
```ts
app.get('/users/{id}', h1)   // /users/profile matches this if h1 is registered first
   .get('/users/profile', h2); // This would be unreachable
```
Different HTTP verbs on the *same* path are fine but subject to ordering if paths are similar (e.g., `/path/{param}` vs `/path/literal`).

### 2. Ordering Strategy: High → Low Specificity
1.  Exact literals (e.g., `/api/health`)
2.  Literal segments + param (e.g., `/api/users/me`)
3.  Specific literal actions (e.g., `/api/projects/{pId}/files/bulk`) before more general params.
4.  Single-param (e.g., `/api/users/{uId}`)
5.  Multi-param (e.g., `/api/projects/{pId}/files/{fId}`)
6.  Catch-alls (e.g., `/api/{resource}`, `*`)

### 3. Typical Conflict Patterns & Fixes
| Pattern        | Wrong                           | Right                                           |
|----------------|---------------------------------|-------------------------------------------------|
| Literal vs Param | `/{userId}` before `/me`        | `/me` first                                     |
| Nested action  | `/{fileId}` before `/bulk`      | `/bulk` first                                   |
| Param type     | `z.coerce.number()` captures "bulk" → NaN | Reorder; or validate param as string then cast/check |

### 4. Debugging
- Log registered paths.
- Use middleware to log `c.req.method`, `c.req.path`, `c.req.param()` on match.

### 5. Testing Precedence
Write tests that explicitly check if the more specific route is hit before a parameterized one.
```ts
// it('bulk vs param', async () => {
//   expect((await app.request('/api/projects/1/files/bulk', { method:'PUT' })).status).toBe(200); // Specific
//   expect((await app.request('/api/projects/1/files/2',    { method:'PUT' })).status).toBe(200); // Param
// });
```

### 6. Parameter Schemas
Use Zod for param validation, e.g., `z.coerce.number().int().positive()`.

### 7. Gotchas & Mitigations
- Paths are case-sensitive.
- `/path` vs `/path/`: Normalize using middleware if needed.
- For IDs that might conflict with literal segments (e.g., "bulk", "me"), validate as string + regex first, then cast, rather than direct `z.coerce.number()`.
- For many versioned routes, consider sub-routers: `app.route('/v1', v1Router)`.
- Always use proper ID validation to prevent injection attacks.

---
## Additional Documentation

Comprehensive documentation is available in the `docs/` directory:

- **`chat.md`** - Chat system implementation details
- **`coding-agent.md`** - AI coding agent workflows
- **`general-ai-concepts.md`** - AI integration concepts
- **`monaco-editor-integration.md`** - Code editor implementation
- **`projects.md`** - Project management system
- **`prompts.md`** - Prompt management and templates
- **`provider-keys.md`** - API key management system

### Build System

**Binary Generation:**
- Cross-platform binary building via `scripts/build-binaries.ts`
- Automated packaging for distribution

**Development Workflow:**
- Hot reloading for both client and server
- Automatic TypeScript compilation
- Real-time OpenAPI spec generation

**Code Quality:**
- Prettier formatting with consistent rules
- TypeScript strict mode across all packages
- Comprehensive test coverage with Bun test runner

---
## Configuration Files

### Prettier Configuration
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Tailwind Configuration
- Custom color palette with semantic naming
- Extended animation utilities
- Custom spacing scale
- Typography plugin configuration
- Dark mode support with CSS variables

### TypeScript Configuration
- Strict mode enabled
- Path aliases for clean imports
- Composite projects for monorepo
- Incremental compilation
- ES2022 target with ESNext modules

---
## Development Workflow

### Feature Development
1. **Branch Strategy**: Feature branches from main
2. **Commit Convention**: Conventional commits (feat, fix, docs, etc.)
3. **Testing**: Unit tests required, E2E for critical paths
4. **Code Review**: PR with passing tests and documentation
5. **Deployment**: Automated via GitHub Actions

### Performance Considerations

#### Backend
- Storage V2 with caching reduces file I/O by 80%
- Indexed queries 100x faster than linear search
- Batch operations for bulk updates
- Connection pooling for AI providers

#### Frontend
- React 19 compiler reduces re-renders
- Virtual scrolling for large lists
- Code splitting by route
- Image optimization with lazy loading

---
## Security Best Practices

### API Security
- API key encryption at rest
- Rate limiting per endpoint
- Input validation with Zod
- CORS configuration for production

### Data Security
- File permissions validation
- Path traversal prevention
- Sensitive data redaction in logs
- Secure key storage with encryption

---
## Important Instruction Reminders

### Code Quality
- Do what has been asked; nothing more, nothing less
- Write self-documenting code that reads like clear sentences
- Follow existing patterns and conventions in the codebase
- Ensure all code is type-safe with no `any` types
- Add tests for new functionality

### File Management
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER proactively create documentation files (*.md) unless requested
- Check file existence before creating new ones
- Follow the established directory structure

### AI Integration
- Use appropriate model configs (LOW, MEDIUM, HIGH) based on task complexity
- Implement proper error handling for AI operations
- Cache AI responses when appropriate
- Use streaming for long-running AI operations

### Testing
- Write unit tests for new services
- Add API tests for new endpoints  
- Use mocks for external dependencies
- Ensure tests are deterministic

### Performance
- Use Storage V2 features (caching, indexes) for data access
- Implement pagination for large datasets
- Optimize bundle size with lazy imports
- Monitor query performance metrics
