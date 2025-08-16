# Services Package Architecture Guide

The services package is the **business logic layer** of Promptliano, implementing domain-specific operations and orchestrating interactions between the storage layer and API endpoints. This package follows clean architecture principles with a focus on functional programming, composability, and robust error handling.

## Architecture Overview

### Layer Responsibilities

```
┌─────────────────────┐
│     API Routes      │ ← Hono routes with validation
├─────────────────────┤
│    Services Layer   │ ← **THIS PACKAGE** - Business logic
├─────────────────────┤
│   Storage Layer     │ ← Data persistence and storage
├─────────────────────┤
│   External APIs     │ ← File system, AI providers, Git
└─────────────────────┘
```

### Core Design Principles

1. **Single Responsibility Principle** - Each service handles one domain
2. **Functional Composition** - Services can be composed together
3. **Error Boundary Pattern** - Consistent error handling across all services
4. **Dependency Injection** - Services receive their dependencies
5. **Testability** - Pure functions and mockable dependencies

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze implementation quality and suggest improvements
   - Ensure proper error handling, service composition, and business logic

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on functional composition and service abstraction

3. **Package-Specific Agents**
   - Use `promptliano-service-architect` for business logic implementation
   - Use `zod-schema-architect` for data validation and transformation
   - Use `simple-git-integration-expert` for Git-related services
   - Use `promptliano-sqlite-expert` when services require database changes

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about what was implemented/changed
- Use multiple agents concurrently for maximum efficiency
- Document service contracts and dependencies clearly

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define data structure (source of truth)
2. **Storage layer** - Create tables with validation
3. **Services** - Implement business logic (this package)
4. **MCP tools** - Enable AI access
5. **API routes** - Create endpoints with OpenAPI
6. **API client** - Add to single api-client.ts file
7. **React hooks** - Setup with TanStack Query
8. **UI components** - Build with shadcn/ui
9. **Page integration** - Wire everything together
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles step 3: Implementing business logic and orchestrating operations between storage and API layers.

See main `/CLAUDE.md` for complete flow documentation.

## Service Categories

### 1. Base Service Infrastructure

#### BaseService Class (`src/core/base-service.ts`)

Abstract base class providing CRUD operations with consistent error handling:

```typescript
export abstract class BaseService<TEntity, TCreate, TUpdate> {
  protected abstract entityName: string
  protected abstract storage: BaseStorage<TEntity, any>

  async create(data: TCreate): Promise<TEntity>
  async getById(id: number): Promise<TEntity>
  async getByIdOrNull(id: number): Promise<TEntity | null>
  async update(id: number, data: TUpdate): Promise<TEntity>
  async delete(id: number): Promise<boolean>
  async exists(id: number): Promise<boolean>
  async validateExists(id: number): Promise<TEntity>
}
```

**Usage Pattern:**

```typescript
class MyDomainService extends BaseService<MyEntity, CreateMyEntity, UpdateMyEntity> {
  protected entityName = 'MyEntity'
  protected storage = myEntityStorage

  // Add domain-specific methods
  async customOperation(id: number): Promise<MyEntity> {
    const entity = await this.validateExists(id)
    // Business logic here
    return this.update(id, transformedData)
  }
}
```

### 2. Domain Services

#### Project Service (`src/project-service.ts`)

- **Core Domain**: Project management and file synchronization
- **Key Operations**: Create, sync, summarize, import/export projects
- **Integration**: File system, AI summarization, Git operations

#### Chat Service (`src/chat-service.ts`)

- **Functional Pattern**: Returns object with service functions
- **Key Operations**: Message management, chat lifecycle, copying
- **Storage Pattern**: JSON-based with message separation

```typescript
export function createChatService() {
  return {
    async createChat(title: string, options?: CreateChatOptions): Promise<Chat>,
    async saveMessage(message: CreateChatMessage): Promise<ChatMessage>,
    async getChatMessages(chatId: number): Promise<ExtendedChatMessage[]>,
    async updateMessageContent(chatId: number, messageId: number, content: string),
    // ... more operations
  }
}
```

#### Ticket Service (`src/ticket-service.ts`)

- **Domain**: Project task and ticket management
- **AI Integration**: Task suggestion generation
- **Key Features**: Task breakdown, file associations, agent assignments

#### Queue Service (`src/queue-service.ts`)

- **Domain**: Task queue management for AI processing
- **Key Operations**: Queue lifecycle, item processing, statistics
- **Pattern**: State machine integration for queue processing

### 3. File Services

#### File Sync Service (`src/file-services/file-sync-service-unified.ts`)

- **Domain**: File system synchronization and watching
- **Key Features**: Real-time file watching, bulk operations, cleanup
- **Integration**: File system events, project storage

#### Parser Service (`src/parser-service.ts`)

- **Domain**: File content parsing with caching
- **Registry Pattern**: Pluggable parser system
- **Features**: Content extraction, frontmatter parsing, caching

#### File Search Service (`src/file-search-service.ts`)

- **Domain**: Content-based file searching
- **Features**: Full-text search, relevance scoring, filtering

### 4. AI and Generation Services

#### GenAI Services (`src/gen-ai-services.ts`)

- **Domain**: AI provider abstraction and chat handling
- **Key Features**: Multi-provider support, streaming, structured generation
- **Providers**: OpenAI, Anthropic, Google, Groq, OpenRouter

```typescript
export async function generateStructuredData<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: AiSdkOptions
): Promise<T>

export async function handleChatMessage(request: AiChatStreamRequest): Promise<StreamTextResult>
```

#### Agent Services

- **Claude Agent Service**: Claude-specific integrations
- **Agent Logger**: Structured logging for AI operations
- **Agent Instruction Service**: Agent prompt management

### 5. Utility Services

#### Error Handlers (`src/utils/error-handlers.ts`)

Standardized error handling patterns:

```typescript
// Consistent validation error handling
export function handleValidationError(error: unknown, entityName: string, action: string): never

// Safe async operations with context
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorContext: { entityName: string; action: string; details?: any }
): Promise<T>

// CRUD error handler factory
export function createCrudErrorHandlers(entityName: string)
```

#### Bulk Operations (`src/utils/bulk-operations.ts`)

- **Pattern**: Batch processing with error handling
- **Operations**: Bulk create, update, delete with rollback support
- **Features**: Concurrency control, retry logic, partial success handling

#### Logger (`src/utils/logger.ts`)

- **Pattern**: Structured logging with context
- **Features**: Log levels, colored output, child loggers

```typescript
const logger = createLogger('ServiceName')
logger.info('Operation completed', { entityId: 123 })
logger.error('Operation failed', error)

// Child logger with context
const childLogger = logger.child('SubOperation')
```

## Parser System Architecture

### Base Parser Pattern

All parsers extend `BaseParser` with consistent interface:

```typescript
export abstract class BaseParser<TFrontmatter = any> {
  abstract parse(content: string, filePath?: string): Promise<ParseResult<TFrontmatter>>

  protected validateFrontmatter(data: any): TFrontmatter
  protected createParseResult(frontmatter, body, htmlBody?, filePath?): ParseResult
}
```

### Parser Registry

Automatic parser registration and selection:

```typescript
// Usage
const parser = parserRegistry.getParser(fileType, editorType)
const result = await parser.parse(content, filePath)

// Available parsers
const availableParsers = parserService.getAvailableParsers()
const supportedTypes = parserService.getSupportedFileTypes()
```

## Service Composition Patterns

### 1. Service Factory Pattern

```typescript
// Chat service factory
export function createChatService() {
  return {
    // Service methods
  }
}

// Usage
const chatService = createChatService()
await chatService.createChat('New Chat')
```

### 2. Singleton Service Pattern

```typescript
// Parser service singleton
export const parserService = new ParserService()

// Factory for consistency
export function createParserService(): ParserService {
  return parserService
}
```

### 3. Service Composition

```typescript
// Compose multiple services
export async function createTicketWithTasks(
  projectId: number,
  ticketData: CreateTicketBody
): Promise<{ ticket: Ticket; tasks: TicketTask[] }> {
  // Use multiple services together
  const ticket = await createTicket(ticketData)
  const suggestions = await fetchTaskSuggestionsForTicket(ticket)
  const tasks = await Promise.all(suggestions.tasks.map((task) => createTask(ticket.id, task)))

  return { ticket, tasks }
}
```

## Error Handling Strategy ⭐ **UPDATED WITH ERRORFACTORY**

### 1. ErrorFactory Pattern **NEW STANDARD**

All services now use the standardized ErrorFactory for consistent error handling:

```typescript
import { 
  ErrorFactory, 
  assertExists, 
  assertUpdateSucceeded, 
  assertDeleteSucceeded,
  assertDatabaseOperation,
  handleZodError 
} from './utils/error-factory'

// Standard error patterns
export class TicketService {
  async updateTicket(id: number, data: UpdateTicketBody): Promise<Ticket> {
    // Validate entity exists (throws standardized 404)
    const existingTicket = await this.getByIdOrThrow(id)
    
    try {
      const result = await ticketStorage.update(id, data)
      
      // Assert operation succeeded (throws standardized error if failed)
      assertUpdateSucceeded(result, 'Ticket', id)
      
      return result
    } catch (error: any) {
      // Handle Zod validation errors consistently
      if (error.name === 'ZodError') {
        handleZodError(error, 'Ticket', 'updating')
      }
      
      // Handle database errors
      throw ErrorFactory.operationFailed('update ticket', error.message)
    }
  }

  async deleteTicket(id: number): Promise<boolean> {
    // Ensure entity exists before deletion
    await this.validateExists(id)
    
    const result = await ticketStorage.delete(id)
    assertDeleteSucceeded(result, 'Ticket', id)
    
    return true
  }

  async createTicketWithValidation(data: CreateTicketBody): Promise<Ticket> {
    try {
      // Validation happens automatically via Zod, but we can catch issues
      const ticket = await ticketStorage.create(data)
      return ticket
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw ErrorFactory.conflict('Ticket', 'name', data.title)
      }
      throw ErrorFactory.createFailed('Ticket', error.message)
    }
  }
}
```

### 2. ErrorFactory Methods Available

**Core Error Types:**

```typescript
// Entity not found errors
ErrorFactory.notFound(entityType: string, id: number | string): ApiError

// Validation errors  
ErrorFactory.validation(field: string, details: any): ApiError
ErrorFactory.internalValidation(entity: string, operation: string, details?: any): ApiError

// Database operation errors
ErrorFactory.databaseError(operation: string, details?: string): ApiError
ErrorFactory.operationFailed(operation: string, details?: any): ApiError

// CRUD operation failures
ErrorFactory.createFailed(entity: string, reason?: string): ApiError
ErrorFactory.updateFailed(entity: string, id: number | string, reason?: string): ApiError
ErrorFactory.deleteFailed(entity: string, id: number | string, reason?: string): ApiError

// File system errors
ErrorFactory.fileSystemError(operation: string, path: string, details?: string): ApiError

// Relationship validation
ErrorFactory.invalidRelationship(childEntity: string, childId: number | string, parentEntity: string, parentId: number | string): ApiError

// Conflict errors (duplicate keys, etc.)
ErrorFactory.conflict(entity: string, field: string, value: any): ApiError
```

**Helper Functions:**

```typescript
// Assertion helpers that throw standardized errors
assertExists<T>(entity: T | null | undefined, entityType: string, id: number | string): asserts entity is T
assertUpdateSucceeded(result: boolean | number, entityType: string, id: number | string): void
assertDeleteSucceeded(result: boolean | number, entityType: string, id: number | string): void
assertDatabaseOperation<T>(result: T | null | undefined, operation: string, details?: string): asserts result is T

// Zod error handler
handleZodError(error: any, entity: string, operation: string): never
```

### 3. Migration from Old Error Patterns

**Before (Old Pattern):**

```typescript
// Manual error creation - inconsistent messages and codes
if (!project) {
  throw new ApiError(404, `Project with ID ${id} not found`, 'PROJECT_NOT_FOUND')
}

if (updateResult.changes === 0) {
  throw new ApiError(400, `Failed to update project ${id}`, 'UPDATE_FAILED') 
}

try {
  const data = schema.parse(input)
} catch (error) {
  throw new ApiError(400, `Validation failed: ${error.message}`, 'VALIDATION_ERROR')
}
```

**After (ErrorFactory Pattern):**

```typescript
// Standardized error creation - consistent messages, codes, and structure
const project = await projectStorage.getById(id)
assertExists(project, 'Project', id)

const updateResult = await projectStorage.update(id, data)  
assertUpdateSucceeded(updateResult, 'Project', id)

try {
  const data = schema.parse(input)
} catch (error) {
  handleZodError(error, 'Project', 'creating')
}
```

### 4. Service-Specific Error Patterns

**Project Service Patterns:**

```typescript
// File system operations
try {
  const files = await fs.readdir(projectPath)
} catch (error: any) {
  throw ErrorFactory.fileSystemError('read directory', projectPath, error.message)
}

// AI provider integration
try {
  const summary = await generateSummary(content)
} catch (error: any) {
  throw ErrorFactory.operationFailed('generate project summary', error.message)
}
```

**Queue Service Patterns:**

```typescript
// Queue state validation
if (queue.status !== 'active') {
  throw ErrorFactory.operationFailed('enqueue item', `Queue ${queueId} is not active`)
}

// Task relationship validation  
const task = await taskStorage.getById(taskId)
assertExists(task, 'Task', taskId)

if (task.ticketId !== ticketId) {
  throw ErrorFactory.invalidRelationship('Task', taskId, 'Ticket', ticketId)
}
```

### 5. Error Boundary Pattern (Enhanced)

```typescript
// Enhanced error boundary with ErrorFactory
export function withErrorHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  entityName: string,
  action: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await operation(...args)
    } catch (error) {
      // ErrorFactory errors are already well-formed - re-throw
      if (error instanceof ApiError) {
        throw error
      }
      
      // Wrap unexpected errors consistently
      throw ErrorFactory.operationFailed(`${action} ${entityName}`, error instanceof Error ? error.message : String(error))
    }
  }
}
```

### 6. Validation Error Mapping (Enhanced)

```typescript
// Enhanced Zod error mapping with context
export function handleZodError(error: any, entity: string, operation: string): never {
  if (error.name === 'ZodError') {
    const details = error.errors.map((err: any) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
    
    throw ErrorFactory.internalValidation(entity, operation, details)
  }
  
  // Fallback for non-Zod validation errors
  throw ErrorFactory.validation(entity, error.message || 'Unknown validation error')
}

## Service Integration Patterns

### 1. Storage Layer Integration

```typescript
// Services use storage layer
import { projectStorage, ProjectFilesStorage } from '@promptliano/storage'

export async function getProjectFiles(projectId: number): Promise<ProjectFile[]> {
  return safeAsync(() => projectStorage.getFiles(projectId), {
    entityName: 'ProjectFiles',
    action: 'retrieving',
    details: { projectId }
  })
}
```

### 2. AI Provider Integration

```typescript
// Generate structured data with AI
export async function generateTaskSuggestions(prompt: string, projectContext: string): Promise<TaskSuggestions> {
  return generateStructuredData(
    `${prompt}\n\nProject Context:\n${projectContext}`,
    TaskSuggestionsSchema,
    MEDIUM_MODEL_CONFIG
  )
}
```

### 3. File System Integration

```typescript
// File operations with retry
async function readProjectFiles(projectPath: string): Promise<ProjectFile[]> {
  return retryFileOperation(async () => {
    const files = await fs.readdir(projectPath, { recursive: true })
    return files.map(processFile)
  })
}
```

## Testing Service Logic

### 1. Unit Testing Services

```typescript
// Test service logic with mocks
describe('ChatService', () => {
  it('should create chat with valid data', async () => {
    const chatService = createChatService()
    const chat = await chatService.createChat('Test Chat')

    expect(chat.title).toBe('Test Chat')
    expect(chat.id).toBeDefined()
  })
})
```

### 2. Error Testing

```typescript
// Test error handling
it('should throw ApiError for invalid data', async () => {
  await expect(createProject(invalidData)).rejects.toThrow(ApiError)
})
```

### 3. Integration Testing

```typescript
// Test service composition
it('should create ticket with tasks', async () => {
  const result = await createTicketWithTasks(projectId, ticketData)

  expect(result.ticket).toBeDefined()
  expect(result.tasks).toHaveLength(3)
})
```

## Performance Considerations

### 1. Caching Strategies

```typescript
// Parser service with caching
class ParserService {
  private fileCache: FileCache = new FileCache()

  async parseFile(request: ParseFileRequest): Promise<ParseResult> {
    const cached = await this.fileCache.get(request.filePath)
    if (cached) return cached.parsedResult

    // Parse and cache
    const result = await parser.parse(content)
    this.fileCache.set(filePath, content, result, stats)
    return result
  }
}
```

### 2. Bulk Operations

```typescript
// Process items in batches
export async function bulkUpdateProjects(
  updates: Array<{ id: number; data: UpdateProjectBody }>
): Promise<BulkOperationResult<Project>> {
  return bulkUpdate(updates, updateProject, {
    validateExists: (id) => projectExists(id),
    continueOnError: true
  })
}
```

### 3. Retry Logic

```typescript
// Retry with backoff
async function syncProjectFiles(projectId: number): Promise<void> {
  return retryOperation(() => performSync(projectId), {
    maxRetries: 3,
    shouldRetry: (error) => error.code === 'EBUSY'
  })
}
```

## Creating New Services

### 1. Domain Service Template

```typescript
import { BaseService } from './core/base-service'
import { myEntityStorage } from '@promptliano/storage'
// IMPORTANT: Always import types from schemas - they use z.infer internally
// Never manually define entity types - all types come from Zod schemas
import type { MyEntity, CreateMyEntity, UpdateMyEntity } from '@promptliano/schemas'

export class MyDomainService extends BaseService<MyEntity, CreateMyEntity, UpdateMyEntity> {
  protected entityName = 'MyEntity'
  protected storage = myEntityStorage

  // Add domain-specific methods
  async customOperation(id: number, params: CustomParams): Promise<MyEntity> {
    const entity = await this.validateExists(id)

    // Business logic here
    const transformed = await this.transformEntity(entity, params)

    return this.update(id, transformed)
  }

  private async transformEntity(entity: MyEntity, params: CustomParams): Promise<UpdateMyEntity> {
    // Domain-specific transformation
    return {
      // transformed data
    }
  }
}

// Export singleton
export const myDomainService = new MyDomainService()
```

### 2. Functional Service Template

```typescript
// All types are imported from schemas (using z.infer internally)
import type { MyEntity, CreateMyEntity } from '@promptliano/schemas'
import { myEntityStorage } from '@promptliano/storage'
import { safeAsync, createCrudErrorHandlers } from './utils/error-handlers'

const errorHandlers = createCrudErrorHandlers('MyEntity')

export function createMyService() {
  return {
    async create(data: CreateMyEntity): Promise<MyEntity> {
      return safeAsync(() => myEntityStorage.create(data), {
        entityName: 'MyEntity',
        action: 'creating',
        details: { data }
      })
    },

    async customOperation(id: number): Promise<MyEntity> {
      const entity = await this.getById(id)
      // Business logic
      return entity
    }
  }
}

// Export factory
export const myService = createMyService()
```

### 3. Parser Service Template

```typescript
import { BaseParser, type ParseResult } from './parsers/base-parser'

export class MyFileParser extends BaseParser<MyFrontmatter> {
  async parse(content: string, filePath?: string): Promise<ParseResult<MyFrontmatter>> {
    // Extract frontmatter and body
    const { frontmatter, body } = this.extractContent(content)

    // Validate frontmatter
    const validatedFrontmatter = this.validateFrontmatter(frontmatter)

    // Process content
    const htmlBody = this.options.renderHtml ? this.renderHtml(body) : undefined

    return this.createParseResult(validatedFrontmatter, body, htmlBody, filePath)
  }

  private extractContent(content: string): { frontmatter: any; body: string } {
    // Parser-specific logic
  }
}

// Register parser
parserRegistry.register(new MyFileParser())
```

## Integration Guidelines

### With Storage Layer

- Use storage layer for all data persistence
- Wrap storage operations in `safeAsync`
- Handle not found cases consistently

### With API Layer

- Services are called from API routes
- Return business objects, not HTTP responses
- Let API layer handle HTTP status codes

### With External Services

- Use retry logic for external calls
- Implement circuit breaker patterns
- Cache responses when appropriate

## Testing Service Logic

### Unit Testing Strategy

Services should be tested in isolation with mocked dependencies:

```typescript
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { createMyService } from '../my-service'
import { myEntityStorage } from '@promptliano/storage'

// Mock storage layer
mock.module('@promptliano/storage', () => ({
  myEntityStorage: {
    create: mock(),
    readById: mock(),
    update: mock(),
    delete: mock()
  }
}))

describe('MyService', () => {
  let service: ReturnType<typeof createMyService>

  beforeEach(() => {
    service = createMyService()
    mock.clearAll()
  })

  test('should create entity with valid data', async () => {
    const mockEntity = { id: 1, name: 'Test', created: Date.now() }
    myEntityStorage.create.mockResolvedValue(mockEntity)

    const result = await service.create({ name: 'Test' })

    expect(result).toEqual(mockEntity)
    expect(myEntityStorage.create).toHaveBeenCalledWith({ name: 'Test' })
  })

  test('should handle storage errors gracefully', async () => {
    myEntityStorage.create.mockRejectedValue(new Error('DB Error'))

    await expect(service.create({ name: 'Test' })).rejects.toThrow(ApiError)
  })
})
```

### Integration Testing

Test service interactions with real storage:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { resetTestDatabase, clearAllData } from '@promptliano/storage/test-utils'
import { createTicketService } from '../ticket-service'
import { createProjectService } from '../project-service'

describe('Ticket Service Integration', () => {
  let ticketService: ReturnType<typeof createTicketService>
  let projectService: ReturnType<typeof createProjectService>
  let testProjectId: number

  beforeAll(async () => {
    await resetTestDatabase()
    ticketService = createTicketService()
    projectService = createProjectService()

    // Create test project
    const project = await projectService.create({
      name: 'Test Project',
      path: '/test'
    })
    testProjectId = project.id
  })

  afterAll(async () => {
    await clearAllData()
  })

  test('should create ticket with tasks', async () => {
    const ticket = await ticketService.createWithTasks(testProjectId, {
      title: 'Test Ticket',
      description: 'Test Description',
      suggestTasks: true
    })

    expect(ticket.title).toBe('Test Ticket')
    expect(ticket.tasks).toBeDefined()
    expect(ticket.tasks.length).toBeGreaterThan(0)
  })
})
```

### Testing Async Operations

Test retry logic and error handling:

```typescript
describe('Service Retry Logic', () => {
  test('should retry failed operations', async () => {
    let attempts = 0
    const mockOperation = mock(() => {
      attempts++
      if (attempts < 3) throw new Error('Temporary failure')
      return { success: true }
    })

    const result = await retryOperation(mockOperation, {
      maxRetries: 3,
      shouldRetry: (error) => error.message.includes('Temporary')
    })

    expect(result).toEqual({ success: true })
    expect(attempts).toBe(3)
  })

  test('should fail after max retries', async () => {
    const mockOperation = mock(() => {
      throw new Error('Persistent failure')
    })

    await expect(retryOperation(mockOperation, { maxRetries: 3 })).rejects.toThrow('Persistent failure')

    expect(mockOperation).toHaveBeenCalledTimes(4) // Initial + 3 retries
  })
})
```

### Testing Bulk Operations

```typescript
describe('Bulk Operations', () => {
  test('should handle partial failures', async () => {
    const updates = [
      { id: 1, data: { name: 'Update 1' } },
      { id: 2, data: { name: 'Update 2' } }, // This will fail
      { id: 3, data: { name: 'Update 3' } }
    ]

    // Mock storage to fail on id=2
    myEntityStorage.update.mockImplementation((id, data) => {
      if (id === 2) throw new Error('Update failed')
      return Promise.resolve({ id, ...data })
    })

    const result = await bulkUpdate(updates, updateEntity, {
      continueOnError: true
    })

    expect(result.successful).toHaveLength(2)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].id).toBe(2)
  })
})
```

### Testing AI Service Integrations

```typescript
describe('AI Service Integration', () => {
  test('should generate structured data with schema validation', async () => {
    const result = await generateStructuredData('Generate a task list', TaskListSchema, { temperature: 0.7 })

    // Result is guaranteed to match schema
    expect(result.tasks).toBeDefined()
    expect(Array.isArray(result.tasks)).toBe(true)

    // Validate each task
    result.tasks.forEach((task) => {
      expect(task.title).toBeDefined()
      expect(typeof task.title).toBe('string')
    })
  })

  test('should handle AI provider errors', async () => {
    // Mock provider failure
    const mockProvider = {
      generateObject: mock().mockRejectedValue(new Error('API limit reached'))
    }

    await expect(generateWithProvider(mockProvider, prompt, schema)).rejects.toThrow(ApiError)
  })
})
```

### Testing Parser Services

```typescript
describe('Parser Service', () => {
  test('should parse markdown with frontmatter', async () => {
    const content = `---
title: Test Document
tags: [test, markdown]
---

# Content

This is the body content.`

    const result = await parserService.parseFile({
      filePath: 'test.md',
      content,
      fileType: 'markdown'
    })

    expect(result.frontmatter.title).toBe('Test Document')
    expect(result.frontmatter.tags).toEqual(['test', 'markdown'])
    expect(result.body).toContain('# Content')
    expect(result.htmlBody).toContain('<h1>Content</h1>')
  })

  test('should use cached results', async () => {
    const spy = mock.spyOn(parser, 'parse')

    // First call - not cached
    await parserService.parseFile(request)
    expect(spy).toHaveBeenCalledTimes(1)

    // Second call - should use cache
    await parserService.parseFile(request)
    expect(spy).toHaveBeenCalledTimes(1) // Still 1, used cache
  })
})
```

### Performance Testing

```typescript
describe('Service Performance', () => {
  test('bulk operations should complete within time limit', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`
    }))

    const start = performance.now()
    await service.bulkCreate(items)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(5000) // Should complete in < 5 seconds
  })

  test('should handle concurrent operations', async () => {
    const operations = Array.from({ length: 100 }, (_, i) => service.create({ name: `Concurrent ${i}` }))

    const start = performance.now()
    const results = await Promise.all(operations)
    const duration = performance.now() - start

    expect(results).toHaveLength(100)
    expect(duration).toBeLessThan(2000) // Concurrent should be fast
  })
})
```

### Testing Error Handlers

```typescript
describe('Error Handler Utils', () => {
  test('handleValidationError should format Zod errors', () => {
    const zodError = new ZodError([
      {
        path: ['name'],
        message: 'Required',
        code: 'invalid_type'
      }
    ])

    expect(() => handleValidationError(zodError, 'Entity', 'creating'))
      .toThrow(ApiError)
      .toThrow(/Validation failed for Entity/)
  })

  test('safeAsync should provide context on error', async () => {
    const operation = () => Promise.reject(new Error('Operation failed'))

    try {
      await safeAsync(operation, {
        entityName: 'TestEntity',
        action: 'testing',
        details: { id: 123 }
      })
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect(error.message).toContain('TestEntity')
      expect(error.message).toContain('testing')
      expect(error.details).toEqual({ id: 123 })
    }
  })
})
```

### Test Utilities

Create shared test utilities for services:

```typescript
// packages/services/src/test-utils.ts
export function createMockStorage<T>() {
  return {
    create: mock<(data: any) => Promise<T>>(),
    readById: mock<(id: number) => Promise<T | null>>(),
    update: mock<(id: number, data: any) => Promise<T>>(),
    delete: mock<(id: number) => Promise<boolean>>(),
    list: mock<() => Promise<T[]>>()
  }
}

export function createTestService() {
  const storage = createMockStorage()
  const service = new MyService(storage)
  return { service, storage }
}

export async function withServiceTest(fn: (context: TestContext) => Promise<void>) {
  await resetTestDatabase()
  const context = createTestContext()

  try {
    await fn(context)
  } finally {
    await clearAllData()
  }
}
```

### Running Tests

```bash
# Run all service tests
bun run test

# Run specific service tests
bun run test ticket-service

# Run with coverage
bun test --coverage

# Run in watch mode
bun test --watch
```

## Common Patterns Summary

1. **BaseService** - For CRUD-heavy domains
2. **Factory Functions** - For stateless service collections
3. **Singletons** - For shared resources (parser service)
4. **Registry Pattern** - For pluggable components (parsers)
5. **State Machine** - For complex workflows (queues)
6. **Bulk Operations** - For batch processing
7. **Error Boundaries** - For consistent error handling
8. **Safe Async** - For operation context tracking

The services package provides the business logic foundation for Promptliano, with patterns that promote maintainability, testability, and consistent error handling across the entire application.
