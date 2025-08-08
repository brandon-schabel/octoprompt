# API Client Architecture Guide

This document outlines the API client architecture and patterns used in the Promptliano API client package.

## Overview

The API client is built around a centralized architecture with all service classes contained in a single file (`api-client.ts`). This approach provides:

- Single source of truth for all API interactions
- Consistent error handling across all services
- Type safety with Zod schema validation
- Standardized request/response patterns
- Easy maintenance and debugging

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze implementation quality and suggest improvements
   - Ensure proper error handling, type safety, and request/response patterns

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on service class organization and method consistency

3. **Package-Specific Agents**
   - Use `hono-bun-api-architect` for API integration patterns
   - Use `zod-schema-architect` for request/response validation
   - Use `tanstack-router-expert` when integrating with React hooks

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about what was implemented/changed
- Use multiple agents concurrently for maximum efficiency
- Document new service methods and their usage

### Critical Requirement

**ALL API client code MUST be added to the single `api-client.ts` file as service classes extending BaseApiClient. DO NOT create separate client files.**

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define data structure (source of truth)
2. **Storage layer** - Create tables with validation
3. **Services** - Implement business logic
4. **MCP tools** - Enable AI access
5. **API routes** - Create endpoints with OpenAPI
6. **API client** - Add to single api-client.ts file (this package)
7. **React hooks** - Setup with TanStack Query
8. **UI components** - Build with shadcn/ui
9. **Page integration** - Wire everything together
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles step 6: Adding API client methods to the single `api-client.ts` file, following the established service class pattern.

See main `/CLAUDE.md` for complete flow documentation.

## Core Components

### BaseApiClient Class

The `BaseApiClient` class provides common functionality for all API services:

```typescript
class BaseApiClient {
  protected baseUrl: string
  protected timeout: number
  protected headers: Record<string, string>
  protected customFetch: typeof fetch

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.timeout = config.timeout || 30000
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
    this.customFetch = config.customFetch || fetch
  }
}
```

### Key Features

1. **Configurable base URL and headers**
2. **Timeout handling with AbortController**
3. **Custom fetch function support (for testing)**
4. **Automatic JSON parsing**
5. **Built-in error handling**
6. **Response validation with Zod schemas**

## Service Class Pattern

All API services extend `BaseApiClient` and are defined in the single `api-client.ts` file. This centralized approach ensures consistency and makes it easy to maintain all API interactions.

### Creating a New Service Class

When adding a new service, follow this pattern:

```typescript
export class MyNewService extends BaseApiClient {
  async listItems() {
    const result = await this.request('GET', '/my-items', {
      responseSchema: MyItemListResponseSchema
    })
    return result as DataResponseSchema<MyItem[]>
  }

  async createItem(data: CreateMyItemBody) {
    const validatedData = this.validateBody(CreateMyItemBodySchema, data)
    const result = await this.request('POST', '/my-items', {
      body: validatedData,
      responseSchema: MyItemResponseSchema
    })
    return result as DataResponseSchema<MyItem>
  }

  async getItem(itemId: number) {
    const result = await this.request('GET', `/my-items/${itemId}`, {
      responseSchema: MyItemResponseSchema
    })
    return result as DataResponseSchema<MyItem>
  }

  async updateItem(itemId: number, data: UpdateMyItemBody) {
    const validatedData = this.validateBody(UpdateMyItemBodySchema, data)
    const result = await this.request('PATCH', `/my-items/${itemId}`, {
      body: validatedData,
      responseSchema: MyItemResponseSchema
    })
    return result as DataResponseSchema<MyItem>
  }

  async deleteItem(itemId: number): Promise<boolean> {
    await this.request('DELETE', `/my-items/${itemId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }
}
```

### Add Service to Main Client

After creating the service class, add it to the `PromptlianoClient`:

```typescript
export class PromptlianoClient {
  // ... existing services
  public readonly myNewService: MyNewService

  constructor(config: ApiConfig) {
    // ... existing service initialization
    this.myNewService = new MyNewService(config)
  }
}
```

## Request Method Pattern

The `BaseApiClient.request()` method handles all HTTP operations:

```typescript
protected async request<TResponse>(
  method: string,
  endpoint: string,
  options?: {
    body?: unknown
    params?: Record<string, string | number | boolean>
    responseSchema?: z.ZodType<TResponse>
    skipValidation?: boolean
    timeout?: number
  }
): Promise<TResponse>
```

### Key Features

- **Automatic URL construction** with base URL handling
- **Query parameter support** via `params` option
- **Request body validation** before sending
- **Response schema validation** with Zod
- **Timeout handling** with AbortController
- **Error transformation** to `PromptlianoError`

### Usage Examples

```typescript
// Simple GET request
const result = await this.request('GET', '/items')

// GET with query parameters
const result = await this.request('GET', '/items', {
  params: { page: 1, limit: 10 }
})

// POST with body validation and response schema
const result = await this.request('POST', '/items', {
  body: itemData,
  responseSchema: ItemResponseSchema
})

// Custom timeout
const result = await this.request('GET', '/slow-endpoint', {
  timeout: 60000
})
```

## Error Handling

### PromptlianoError Class

All API errors are wrapped in the `PromptlianoError` class:

```typescript
export class PromptlianoError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
    public readonly details?: any
  )
}
```

### Error Types

1. **HTTP Errors**: Status code-based errors from the server
2. **Validation Errors**: Request/response validation failures
3. **Timeout Errors**: Request timeout with AbortController
4. **Network Errors**: Connection failures
5. **Parse Errors**: Invalid JSON responses

### Error Handling in Services

```typescript
try {
  const result = await client.items.getItem(123)
  return result.data
} catch (error) {
  if (error instanceof PromptlianoError) {
    if (error.statusCode === 404) {
      // Handle not found
    } else if (error.errorCode === 'VALIDATION_ERROR') {
      // Handle validation error
    }
  }
  throw error
}
```

## Type Safety with Zod

### Schema Validation

All requests and responses are validated using Zod schemas:

```typescript
// Request validation
const validatedData = this.validateBody(CreateItemBodySchema, data)

// Response validation
const result = await this.request('POST', '/items', {
  body: validatedData,
  responseSchema: ItemResponseSchema
})
```

### Response Type Pattern

All API responses follow the `DataResponseSchema` pattern which is defined in schemas:

```typescript
// Import the response schema from @promptliano/schemas
import { DataResponseSchema } from '@promptliano/schemas'

// The type is inferred from the Zod schema (never manually defined):
// export type DataResponseSchema<T> = z.infer<typeof DataResponseSchemaZ<T>>
// Which resolves to: { success: boolean, data: T }
```

### Schema Imports

Import schemas from `@promptliano/schemas` with consistent naming:

```typescript
import {
  ItemResponseSchema as ItemResponseSchemaZ,
  ItemListResponseSchema as ItemListResponseSchemaZ,
  CreateItemBodySchema,
  UpdateItemBodySchema
} from '@promptliano/schemas'
```

## Streaming Support

For streaming endpoints, use a custom implementation:

```typescript
async streamData(data: StreamRequest): Promise<ReadableStream> {
  const validatedData = this.validateBody(StreamRequestSchema, data)
  const url = new URL('/api/stream', this.baseUrl)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), this.timeout)

  try {
    const response = await this.customFetch(url.toString(), {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(validatedData),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new PromptlianoError(`HTTP ${response.status}`, response.status)
    }

    return response.body!
  } catch (error) {
    // Handle errors...
  }
}
```

## Testing API Clients

### Test Structure

API client tests are located in `src/tests/` and follow this pattern:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient, PromptlianoError } from '@promptliano/api-client'
import { TEST_API_URL } from './test-config'

describe('MyService API Tests', () => {
  let client: PromptlianoClient
  let testData: any[] = []

  beforeAll(() => {
    client = createPromptlianoClient({ baseUrl: TEST_API_URL })
  })

  afterAll(async () => {
    // Cleanup test data
    for (const item of testData) {
      try {
        await client.myService.deleteItem(item.id)
      } catch (err) {
        // Handle cleanup errors
      }
    }
  })

  test('should create item', async () => {
    const data = { name: 'Test Item' }
    const result = await client.myService.createItem(data)

    expect(result.success).toBe(true)
    expect(result.data.name).toBe(data.name)

    testData.push(result.data)
  })
})
```

### Running Tests

```bash
# Run all API client tests
bun run test

# Run specific service tests
bun run test:chat
bun run test:projects
```

## Integration with React Hooks

API clients integrate with React through custom hooks in `packages/client/src/hooks/api/`:

```typescript
// In React hook file
import { useMutation, useQuery } from '@tanstack/react-query'
import { promptlianoClient } from '@/hooks/promptliano-client'

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: () => promptlianoClient.items.listItems().then((r) => r.data)
  })
}

export function useCreateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateItemBody) => promptlianoClient.items.createItem(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
    }
  })
}
```

## Client Factory Pattern

The main client is created using the factory function:

```typescript
export function createPromptlianoClient(config: ApiConfig): PromptlianoClient {
  return new PromptlianoClient(config)
}

// Usage
const client = createPromptlianoClient({
  baseUrl: 'http://localhost:3579',
  timeout: 30000,
  headers: { 'Custom-Header': 'value' }
})
```

## Best Practices

### 1. Service Organization

- Keep all services in the single `api-client.ts` file
- Follow consistent naming: `<Entity>Service`
- Use clear, descriptive method names

### 2. Error Handling

- Always catch and handle `PromptlianoError`
- Provide meaningful error messages
- Use appropriate HTTP status codes

### 3. Type Safety

- Always validate requests with Zod schemas
- Use response schemas for validation
- Import types from `@promptliano/schemas`

### 4. Testing

- Write comprehensive integration tests
- Clean up test data in `afterAll`
- Test error conditions and edge cases

### 5. Performance

- Use appropriate timeouts
- Handle AbortController properly
- Implement retry logic where appropriate

### 6. Maintenance

- Keep schema imports consistent
- Update both service and client when adding new services
- Document complex endpoints

## Common Patterns

### CRUD Operations

```typescript
// List with optional filtering
async listItems(filters?: ItemFilters) {
  const result = await this.request('GET', '/items', {
    params: filters,
    responseSchema: ItemListResponseSchema
  })
  return result as DataResponseSchema<Item[]>
}

// Create with validation
async createItem(data: CreateItemBody) {
  const validatedData = this.validateBody(CreateItemBodySchema, data)
  const result = await this.request('POST', '/items', {
    body: validatedData,
    responseSchema: ItemResponseSchema
  })
  return result as DataResponseSchema<Item>
}
```

### Bulk Operations

```typescript
async bulkUpdateItems(data: BulkUpdateItemsBody) {
  const validatedData = this.validateBody(BulkUpdateItemsBodySchema, data)
  const result = await this.request('PATCH', '/items/bulk', {
    body: validatedData,
    responseSchema: BulkOperationResponseSchema
  })
  return result
}
```

### Nested Resources

```typescript
async getItemComments(itemId: number) {
  const result = await this.request('GET', `/items/${itemId}/comments`, {
    responseSchema: CommentListResponseSchema
  })
  return result as DataResponseSchema<Comment[]>
}
```

This architecture ensures consistent, type-safe, and maintainable API interactions across the entire Promptliano application.
