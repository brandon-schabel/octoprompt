Okay, here's a revised version of your OctoPrompt Development Guide, optimized for conciseness and token count while aiming to preserve all essential information and remove redundancies.

```markdown
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

---
## Python Rules for Functional, Testable, and Robust Code
- Environment: `uv` with `.venv` (`source .venv/bin/activate`)
- Testing: `uv pytest` (run with `uv run pytest`)
- Execution: Use `uv` for running Python files.

### 1. Embrace Functional Programming
* **Prefer Pure Functions**: Functions should return the same output for the same input with no side effects.
  ```python
  # Good: Pure function
  def add(a: int, b: int) -> int:
      return a + b
  ```
* **Immutability**: Treat data as immutable. Create new data structures instead of modifying in-place.
  ```python
  # Good: Returning a new list
  def append_item(my_list: list[int], item: int) -> list[int]:
      return my_list + [item]
  ```
* **Avoid Side Effects**: Isolate side effects (I/O, API calls).
* **Higher-Order Functions**: Utilize `map`, `filter`, `functools.reduce`.

### 2. Prioritize Functions Over Classes
* **Default to Functions**: Use standalone functions for most logic.
* **When to Use Classes (Sparingly)**: For managing complex state coupled with multiple methods, implementing external interfaces, or for Pydantic models.
* **Avoid "Manager" or "Util" Classes**: Use modules with functions instead.
* **SRP for Functions**: Each function does one thing well.

### 3. Leverage Pydantic for Data Validation and Settings
* **Define Clear Data Structures**: Use Pydantic models for runtime data validation and serialization.
  ```python
  from pydantic import BaseModel, PositiveInt, EmailStr
  from typing import List

  class UserProfile(BaseModel):
      user_id: PositiveInt; username: str; email: EmailStr; tags: List[str] = []
  ```
* **Configuration Management**: Use Pydantic's `BaseSettings` for app settings.
  ```python
  from pydantic_settings import BaseSettings
  class AppSettings(BaseSettings):
      database_url: str; api_key: str; debug_mode: bool = False
      class Config: env_file = ".env"
  ```
* **API Request/Response Validation**: Use Pydantic models for API data integrity.

### 4. Write Testable Code
* **Design for Testability**: Pure functions, decoupled components, dependency injection.
  ```python
  from typing import Protocol
  class DataStore(Protocol):
      def get_user(self, user_id: int) -> dict | None: ...

  def process_user_data(user_id: int, store: DataStore) -> str:
      user = store.get_user(user_id)
      return f"Processing {user['name']}" if user else "User not found"
  ```
* **Unit Tests**: Test every function, especially pure functions and core logic.
* **Test Edge Cases**: Test invalid inputs, boundary conditions, and failure modes.
* **Aim for High Test Coverage**.

### 5. General Good Coding Practices
* **Type Hinting (PEP 484)**: Use for all function signatures and relevant variable declarations.
  ```python
  def greet(name: str, age: int) -> str:
      return f"Hello, {name}! You are {age} years old."
  ```
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
    - Python: Pydantic models for type safety and validation.
- **OpenAPI Specs**: Every API must have proper OpenAPI specifications.
- **Route Ordering**: Crucial. Incorrect order leads to incorrect route matching. Pay very close attention.

---
## Major Features/Services
- **Projects and Files**: Core concept; projects contain chats.
- **Chats and Messages**: Built-in AI chat functionality.
- **Gen AI**: Services for generating structured data, coding agents, file search, and summarization.
- **Provider Key Service**: Manages API keys for AI providers.
- **Prompts**: Manages user prompts used to guide AI.
- **Tickets and Tasks**: Project-related; users create tickets and tasks with project context.
- **Global State**: Primarily frontend; synced to local storage to preserve user context.

---
## Other Technical Info
- **Functional API Tests**: Each API must have them.
- **Unit Testable Functions**: Design functions with minimal external reliance, predictable I/O (except Gen AI).
- **Single Source of Truth (SSOT)**: Adhere to this principle.

---
## Project Overall Structure
```
OctoPrompt
├── packages
│   ├── api-tests
│   │   └── tests
│   │       ├── chat-api.ts
│   │       ├── project-api.ts
│   │       └── prompt-api.ts
│   ├── client
│   │   └── src
│   │       ├── constants
│   │       ├── utils
│   │       ├── routes
│   │       │   ├── chat.tsx
│   │       │   ├── projects.tsx
│   │       │   └── prompts.tsx
│   │       ├── components
│   │       ├── hooks
│   │       │   └── api // API hooks directly importing shared schema types
│   │       └── generated // Legacy generated files (being phased out)
│   ├── python_backend
│   │   ├── app
│   │   ├── schemas
│   │   ├── services
│   │   │   ├── chat_service.py
│   │   │   ├── prompt_service.py
│   │   │   └── project_service.py
│   │   └── utils
│   │       └── storage
│   │           ├── chat_storage.py
│   │           ├── prompt_storage.py
│   │           └── project_storage.py
│   ├── shared
│   │   └── src
│   │       ├── constants
│   │       │   └── model-default.ts // LLM default configs (low, med, high)
│   │       └── schemas
│   │           ├── project.schema.ts
│   │           ├── chat.schema.ts
│   │           ├── prompt.schema.ts
│   │           // All TS types inferred from Zod schemas via z.infer<>
│   └── server
│       ├── server.ts // Main server entry
│       └── src
│           ├── app.ts // Hono router, routes, middleware, global error handling
│           ├── routes
│           │   ├── chat-routes.ts
│           │   ├── prompt-routes.ts
│           │   └── project-routes.ts
│           ├── services
│           │   ├── chat-service.ts
│           │   ├── prompt-service.ts
│           │   └── project-service.ts
│           └── utils
│               └── storage
│                   ├── chat-storage.ts
│                   ├── prompt-storage.ts
│                   └── project-storage.ts
```

---
## Scripts

**Root `package.json`:**
```json
{
  "dev": "bun run scripts/start-dev.ts",
  "dev:client": "bun run openapi-ts && bun run scripts/start-client-dev.ts",
  "dev:server": "bun run scripts/start-server-dev.ts",
  "stop": "bun run scripts/stop.ts",
  "build-binaries": "bun run scripts/build-binaries.ts",
  "format": "prettier --write .",
  "test:server": "cd packages/server && bun run test",
  "test:shared": "cd packages/shared && bun run test",
  "generate-openapi-spec": "bun run scripts/generate-openapi-spec.ts",
  "openapi-ts": "bun run generate-openapi-spec && openapi-ts && prettier --write packages/client/src/generated",
  "openapi-ts:prod": "bun run generate-openapi-spec && ENVIRONMENT=prod bun run openapi-ts"
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

**`packages/shared/package.json`:** (Assuming a `package.json` exists here)
```json
{
  "test": "bun test"
}
```
---
## Useful Utils

**`shared/schemas/schema-utils`:**
- `unixTSSchemaSpec`: Standard Unix timestamp (ms) schema.
- `unixTSOptionalSchemaSpec`: Optional Unix timestamp (ms).
- `unixTSArraySchemaSpec`: Required array of Unix timestamps (ms).
- `unixTSArrayOptionalSchemaSpec`: Optional array of Unix timestamps (ms).

**`shared/utils/merge-deep.ts`:**
- `mergeDeep<T>([obj1, obj2, ...]): T`: Recursively merges objects.

**`shared/utils/pattern-match.ts`:**
- `normalizePath(filePath: string): string`: Normalizes path separators.
- `filterByPatterns(filePaths: string[], patterns: string[], options?: picomatch.PicomatchOptions): string[]`: Filters file paths by glob patterns.

**`shared/utils/project-utils.ts`:**
- `buildPromptContent({ fileMap, promptData, selectedFiles, selectedPrompts, userPrompt }): string`
- `calculateTotalTokens({ promptData, selectedPrompts, userPrompt, selectedFiles, fileMap }): number`
- `buildFileTree(files: ProjectFile[]): Record<string, any>`

**`packages/server/src/utils/get-full-project-summary.ts`:**
- `getFullProjectSummary(projectId: number): Promise<string>`: Generates a full project summary.

**`packages/server/src/utils/json-scribe.ts` (`json-scribe.ts`):**
- `resolveJsonPath(rawPath: string | string[], basePath?: string): string`: Resolves input to a normalized file path.
- `writeJson<TData, S extends ZodTypeAny>(options: { path, data, schema?, basePath? }): Promise<S extends ZodTypeAny ? z.infer<S> : TData>`: Writes data to JSON, optionally validating. Creates directories.
- `readJson<T = unknown>(options: { path, basePath? }): Promise<T | null>`: Reads and parses JSON (no validation on read).
- `parseTimestamp(tsValue: unknown): Date | null`: Safely parses various timestamp formats to `Date`.
- `normalizeToUnixMs(tsValue: unknown): number`: Parses timestamp and converts to Unix ms (defaulting to `new Date().getTime()` if parsing fails).

**`packages/server/src/utils/path-utils.ts`:**
- `resolvePath(path: string): string`: Resolves path, expanding tilde.
- `normalizePathForDb(path: string): string`: Normalizes path for database storage (consistent format).

**`packages/server/src/utils/prompts-map.ts`:**
- Predefined prompt file contents (e.g., `contemplativePrompt`, `summarizationSteps`, `octopromptPlanningMetaPrompt`) loaded via `Bun.file().text()`.
- `promptsMap`: Exported object mapping names to prompt strings.

**`packages/shared/src/constants/model-default-configs.ts`:**
- `LOW_MODEL_CONFIG`, `MEDIUM_MODEL_CONFIG`, `HIGH_MODEL_CONFIG`: `ModelOptionsWithProvider` objects with settings for temperature, maxTokens, provider, model, etc. (e.g., `LOW_MODEL_CONFIG` uses `google/gemini-2.5-flash-preview`).

---
## Python Backend (`packages/python_backend`)
- Activate env: `source ./.venv/bin/activate`
- Run server: `python main.py`
- Run unit tests: `uv run tests` (Note: original doc said `uv run pytest` and `uv run tests`. `uv run pytest` is more standard if `pytest` is the task name in `pyproject.toml`)

---
## Frontend
### Major Packages
React (v19), TanStack Router, DND Kit, ShadCN (Radix), React Hook Form, Tailwind CSS, TanStack Query, AI SDK (Vercel AI SDK).

Organized by major features (Projects, Chat & Messages, Prompts, Tickets & Tasks).

### Routes (`packages/client/src/routes`)
`__root.tsx` (base layout), `index.tsx`, `projects.tsx`, `chat.tsx`, `prompts.tsx`, `keys.tsx`, `project-summarization.tsx`, `tickets.tsx`, `admin.tsx`, `health.tsx`.

### Components (`packages/client/src/components`)
- `components/ui`: ShadCN components (e.g., `button.tsx`, `card.tsx`, `dialog.tsx`).
- Feature-specific components:
    - `file-changes`: `diff-viewer.tsx`, `ai-file-change-dialog.tsx`.
    - `settings`: `settings-dialog.tsx`.
    - `tickets`: `ticket-list-panel.tsx`, `ticket-dialog.tsx`.
    - `projects`: `project-list.tsx`, `file-panel/file-tree.tsx`, `agent-coding-dialog.tsx`.
    - `navigation`: `app-navbar.tsx`, `app-sidebar.tsx`.
    - `prompts`: `all-prompts-dialog.tsx`.
- Common components: `markdown-renderer.tsx`, `error-boundary/error-boundary.tsx`, `shortcuts-palette.tsx`.

### Data Fetching
Direct schema import approach for type safety (TypeScript types from shared Zod schemas).

**API Hooks (`packages/client/src/hooks/api`):**
`use-projects-api.ts`, `use-chat-api.ts`, `use-prompts-api.ts`, `use-keys-api.ts`, `use-tickets-api.ts`, `use-gen-ai-api.ts`, `use-agent-coder-api.ts`, `use-admin-api.ts`, `use-ai-chat.ts`, `use-ai-file-changes-api.ts`, `common-mutation-error-handler.ts`.

**Modern API Hook Pattern (Example `useCreateChat`):**
```typescript
import type { CreateChatBody } from 'shared/src/schemas/chat.schemas'; // Import types directly
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
import type { Prompt } from 'shared/src/schemas/prompt.schemas'; // Import types
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
TypeScript/Bun backend: AI-powered project management, layered architecture, file-based JSON storage, service-oriented logic, OpenAPI-compliant REST APIs.

### Architecture Layers
- **Storage Layer (`src/utils/storage/`)**: JSON file storage with CRUD and Zod validation.
  Example: `projectStorage.readProjects()`, `projectStorage.writeProjectFiles()`.
  Files: `project-storage.ts`, `chat-storage.ts`, `prompt-storage.ts`, `ticket-storage.ts`, `provider-key-storage.ts`.
  Patterns: Unix ms IDs, `Record<string, Entity>` data structure, Zod validation, atomic file ops.

- **Services Layer (`src/services/`)**: Business logic orchestrating storage.
  Example: `projectService.createProject(data)`.
  Services: `project-service.ts`, `chat-service.ts`, `gen-ai-services.ts`, `file-services/`.

- **API Layer (`src/routes/`)**: Hono-based routes with OpenAPI specs.
  Example: `createRoute()` for OpenAPI definitions, `OpenAPIHono().openapi(route, handler)`.

### Core Systems
- **File Synchronization**: `syncProject()` uses `getTextFiles`, `loadIgnoreRules`, `syncFileSet`. `createFileChangeWatcher()` for live updates, triggering sync and summarization.
- **AI Integration**: Multi-provider AI via Vercel AI SDK. `getProviderLanguageModelInterface()` (handles OpenAI, Anthropic, OpenRouter), `generateStructuredData()` (uses `generateObject` from AI SDK).

---
## Complete Feature Example: Todo System
Illustrates schema, storage, service, and API route implementation.

### 1. Schemas (`shared/src/schemas/todo.schemas.ts`)
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

### 2. Storage (`src/utils/storage/todo-storage.ts`)
Implements `readTodos`, `writeTodos`, `readTodoCategories`, `writeTodoCategories`, `generateId` using `readJson`, `writeJson` from `json-scribe.ts`. Data validated with Zod schemas.
```typescript
import { z } from 'zod'; // Assuming path
import { TodoSchema, TodoCategorySchema } from '../../../shared/src/schemas/todo.schemas';
import { readJson, writeJson } from '../json-scribe'; // Assuming path
import { normalizeToUnixMs } from '../../../shared/src/utils/unix-ts-utils'; // Assuming path

export const TodoStorageSchema = z.record(z.string(), TodoSchema);
// ... (TodoCategoryStorageSchema defined similarly)
const getTodosPath = (projectId: number): string[] => ['data', 'projects', projectId.toString(), 'todos.json'];

export const todoStorage = {
  async readTodos(projectId: number): Promise<z.infer<typeof TodoStorageSchema>> { /* ... */ },
  async writeTodos(projectId: number, todos: z.infer<typeof TodoStorageSchema>): Promise<z.infer<typeof TodoStorageSchema>> { /* ... */ },
  // ... (category methods and generateId)
};
```

### 3. Service (`src/services/todo-service.ts`)
Business logic: `createTodo`, `updateTodoStatus`, `getTodosByProject`, `deleteTodo`, `generateTodoSuggestions` (uses `generateStructuredData`). Handles ID conflicts, validation, and error wrapping (`ApiError`).
```typescript
import { Todo, CreateTodoBody, TodoSchema } from 'shared/src/schemas/todo.schemas'; // Assuming path
import { todoStorage } from '@/utils/storage/todo-storage'; // Assuming path
import { ApiError } from 'shared'; // Assuming path
// ... (other imports like generateStructuredData, getProjectById)

export async function createTodo(data: CreateTodoBody): Promise<Todo> {
  let todoId = todoStorage.generateId(); const now = Date.now();
  const newTodoData: Todo = { id: todoId, ...data, status: 'pending', created: now, updated: now };
  // try-catch for error handling, ID conflict resolution, validation, and writing
  // ...
}
// ... (updateTodoStatus, getTodosByProject, deleteTodo, generateTodoSuggestions)
```

### 4. Routes (`src/routes/todo-routes.ts`)
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

### 5. Register Routes (`src/app.ts`)
Todo routes are registered with the main Hono app instance.
```typescript
// import { todoRoutes } from './routes/todo-routes'; // Assuming path
// export const app = new OpenAPIHono().route('/', todoRoutes); // Example
```
(Actual registration may vary based on full `app.ts` structure)

### 6. Tests (`src/services/todo-service.test.ts`)
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
## Functional API Testing (`packages/api-tests/`)
End-to-end tests verifying complete request/response cycles against a running server.
Uses a helper like `apiFetch` to make requests and validate responses against Zod schemas.
Ensures proper cleanup of test data.
```typescript
// Example: todo-api.test.ts
// describe('Todo API Tests', () => {
//   beforeAll(() => { /* ... */ });
//   afterAll(async () => { /* Cleanup test data */ });
//   test('POST /api/todos - Create todos', async () => {
//     // const result = await apiFetch(createTodoEndpoint, todoData, TodoResponseSchema);
//     // expect(result.success).toBe(true);
//   });
//   // ... (tests for GET, PATCH, DELETE, error scenarios)
// });
```
Examples: `chat-api.test.ts`, `projects-api.test.ts` cover CRUD, error handling, and complex workflows.

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
```