# API Client Testing Strategy

## Test Isolation & Environment Strategy

### Core Principles

1. **Isolated Test Servers**: Every test suite runs with its own dedicated server instance and database
2. **Environment Detection**: Automatic CI/local detection with optimized configurations
3. **AI Test Gating**: AI-dependent tests only run when LMStudio is available and configured
4. **Clean State Guarantee**: Each test starts with a clean database and server state
5. **Parallel Safety**: Tests can run concurrently without conflicts using dynamic ports

### Test Environment Architecture

```typescript
// Test Environment Structure
interface TestEnvironment {
  server?: TestServerInstance     // Isolated server (when useIsolatedServer: true)
  baseUrl: string                // API base URL for requests
  config: TestEnvironmentConfig  // Complete test configuration
  isCI: boolean                  // Environment detection
  isLocal: boolean               // Environment detection
  cleanup: () => Promise<void>   // Cleanup function
}
```

### Environment Configuration Matrix

| Environment | Database | AI Tests | Rate Limit | Log Level | Timeout |
|-------------|----------|----------|------------|-----------|----------|
| **Local Dev** | File/Memory | ✅ LMStudio | Disabled | warn | 30s |
| **CI/CD** | Memory Only | ❌ Skipped | Disabled | error | 15s |
| **Debug** | File | ✅ LMStudio | Disabled | debug | 60s |

## AI Test Isolation Strategy

### Local-Only AI Testing

AI tests are designed to **only run in local development environments** where LMStudio can be properly configured:

```typescript
// AI Test Gating Pattern
const { isCI, isLocal } = detectEnvironment()
const skipAITests = process.env.SKIP_AI_TESTS === 'true' || (isCI && !lmstudioAvailable)

test.skipIf(skipAITests)('AI endpoint test', async () => {
  // Test only runs when:
  // 1. Not in CI environment (unless explicitly configured)
  // 2. LMStudio is available and responding
  // 3. SKIP_AI_TESTS is not set to 'true'
})
```

### AI Test Prerequisites Check

```typescript
beforeAll(async () => {
  // 1. Check LMStudio availability
  const lmstudioStatus = await checkLMStudioAvailability(testEnv.config.ai.lmstudio)
  
  // 2. Skip tests if unavailable
  if (!lmstudioStatus.available) {
    console.warn('⚠️  LMStudio not available:', lmstudioStatus.message)
    skipAITests = true
    return
  }
  
  // 3. Verify target model is loaded
  const hasTargetModel = lmstudioStatus.models.some(model => 
    model === 'openai/gpt-oss-20b' || model.includes('gpt-oss')
  )
  
  if (!hasTargetModel) {
    console.warn('⚠️  Target model not loaded in LMStudio')
    skipAITests = true
  }
})
```

### AI Test Environment Variables

```bash
# Enable/disable AI testing
SKIP_AI_TESTS=true                    # Skip all AI tests
AI_FAIL_WHEN_UNAVAILABLE=false        # Skip instead of fail when LMStudio unavailable

# LMStudio configuration
LMSTUDIO_BASE_URL=http://localhost:1234
LMSTUDIO_MODEL=openai/gpt-oss-20b
AI_TEST_TIMEOUT=30000                  # 30 second timeout for AI operations

# Test behavior
AI_USE_MOCKS=true                      # Use mocks when LMStudio unavailable
TEST_AI_ENDPOINTS_ONLY=true            # Run only AI endpoint tests
```

## API Integration Test Best Practices

### 1. Test Structure Pattern

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createTestEnvironment, withTestEnvironment } from './test-environment'
import { createPromptlianoClient } from '@promptliano/api-client'
import { assertions, factories, TestDataManager } from './utils/test-helpers'

describe('Feature API Tests', () => {
  let testEnv: TestEnvironment
  let client: PromptlianoClient
  let dataManager: TestDataManager

  beforeAll(async () => {
    // Create isolated test environment
    testEnv = await createTestEnvironment({
      database: { useMemory: true }, // Fast in-memory DB
      execution: { logLevel: 'silent' } // Quiet during tests
    })
    
    client = createPromptlianoClient({ 
      baseUrl: testEnv.baseUrl,
      timeout: testEnv.config.execution.apiTimeout
    })
    
    // Auto-cleanup manager
    dataManager = new TestDataManager(client)
  })

  afterAll(async () => {
    await dataManager.cleanup() // Clean up test data
    await testEnv.cleanup()     // Clean up server
  })

  test('should handle CRUD operations', async () => {
    // Use factories for consistent test data
    const entityData = factories.createEntityData({ name: 'Test Entity' })
    
    // Create
    const created = await dataManager.createEntity(entityData)
    assertions.assertSuccessResponse(created)
    
    // Read
    const retrieved = await client.entities.getEntity(created.data.id)
    assertions.assertSuccessResponse(retrieved)
    expect(retrieved.data.name).toBe('Test Entity')
    
    // Update
    const updated = await client.entities.updateEntity(created.data.id, {
      name: 'Updated Entity'
    })
    assertions.assertSuccessResponse(updated)
    
    // Delete (handled by dataManager.cleanup())
  })
})
```

### 2. Error Handling Testing

```typescript
describe('Error Handling', () => {
  test('should return proper error for invalid input', async () => {
    const response = await client.entities.createEntity({
      // Invalid data - missing required fields
    })
    
    assertions.assertErrorResponse(response, {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR'
    })
  })
  
  test('should handle not found scenarios', async () => {
    const response = await client.entities.getEntity(999999)
    assertions.assertErrorResponse(response, {
      statusCode: 404,
      errorCode: 'ENTITY_NOT_FOUND'
    })
  })
  
  test('should handle timeout scenarios', async () => {
    const shortTimeoutClient = createPromptlianoClient({
      baseUrl: testEnv.baseUrl,
      timeout: 100 // Very short timeout
    })
    
    try {
      await shortTimeoutClient.longRunningOperation()
      expect.unreachable('Should have timed out')
    } catch (error) {
      expect(error.message).toContain('timeout')
    }
  })
})
```

### 3. AI Endpoint Testing Pattern

```typescript
describe('AI Endpoints', () => {
  let skipAITests = false
  
  beforeAll(async () => {
    // Check LMStudio availability
    const status = await checkLMStudioAvailability(testEnv.config.ai.lmstudio)
    skipAITests = !status.available || testEnv.isCI
    
    if (skipAITests) {
      console.warn('⚠️  Skipping AI tests:', status.message)
    }
  })
  
  test.skipIf(skipAITests)('should generate completion', async () => {
    try {
      const response = await client.ai.generateCompletion({
        prompt: 'Write a hello world function:',
        maxTokens: 100,
        temperature: 0.3
      })
      
      assertions.assertSuccessResponse(response)
      expect(response.data.content).toBeDefined()
      expect(response.data.content.length).toBeGreaterThan(0)
      
    } catch (error) {
      if (error.message.includes('ECONNREFUSED')) {
        // LMStudio connection failed during test
        console.warn('LMStudio connection lost during test')
        expect(testEnv.config.ai.useMockWhenUnavailable).toBe(true)
      } else {
        throw error
      }
    }
  }, 30000) // Longer timeout for AI operations
  
  test.skipIf(skipAITests)('should handle streaming responses', async () => {
    const stream = await client.ai.generateStreamingCompletion({
      prompt: 'Count to 5:',
      maxTokens: 50
    })
    
    const chunks: string[] = []
    for await (const chunk of stream) {
      chunks.push(chunk.content)
    }
    
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('').length).toBeGreaterThan(0)
  }, 30000)
})
```

## Scaling API Test Coverage

### Service-by-Service Test Expansion

```typescript
// 1. Start with core services
packages/api-client/src/tests/
├── core-api.test.ts          # ✅ Basic CRUD operations
├── projects-api.test.ts      # ✅ Project management
├── tickets-api.test.ts       # 🔄 Ticket/task management
├── prompts-api.test.ts       # ✅ Prompt management
├── chat-api.test.ts          # ✅ Chat functionality
├── provider-key-api.test.ts  # ✅ Provider key management
└── ai-endpoints.test.ts      # ✅ AI integrations

// 2. Add specialized services
├── queue-api.test.ts         # 📋 Queue management
├── git-api.test.ts           # 🔄 Git operations
├── mcp-api.test.ts           # 🔄 MCP tool integration
├── auth-api.test.ts          # 🔄 Authentication
└── file-api.test.ts          # 🔄 File operations

// 3. Add integration tests
├── workflows/
│   ├── ticket-to-completion.test.ts  # End-to-end ticket workflow
│   ├── ai-assisted-coding.test.ts    # AI + Git + File operations
│   └── project-setup.test.ts         # Complete project setup flow
└── performance/
    ├── load-testing.test.ts          # API load testing
    └── concurrent-access.test.ts     # Concurrent user simulation
```

### Test Creation Template

```typescript
// packages/api-client/src/tests/new-service-api.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createTestEnvironment } from './test-environment'
import { createPromptlianoClient } from '@promptliano/api-client'
import { assertions, factories, TestDataManager } from './utils/test-helpers'

describe('New Service API Tests', () => {
  let testEnv: TestEnvironment
  let client: PromptlianoClient
  let dataManager: TestDataManager

  beforeAll(async () => {
    testEnv = await createTestEnvironment()
    client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
    dataManager = new TestDataManager(client)
  })

  afterAll(async () => {
    await dataManager.cleanup()
    await testEnv.cleanup()
  })

  describe('CRUD Operations', () => {
    test('should create new entity', async () => {
      const data = factories.createNewServiceData()
      const response = await client.newService.create(data)
      assertions.assertSuccessResponse(response)
    })

    test('should retrieve entity', async () => {
      const entity = await dataManager.createNewServiceEntity()
      const response = await client.newService.get(entity.id)
      assertions.assertSuccessResponse(response)
    })

    test('should update entity', async () => {
      const entity = await dataManager.createNewServiceEntity()
      const response = await client.newService.update(entity.id, { /* updates */ })
      assertions.assertSuccessResponse(response)
    })

    test('should delete entity', async () => {
      const entity = await dataManager.createNewServiceEntity()
      const response = await client.newService.delete(entity.id)
      assertions.assertSuccessResponse(response)
    })

    test('should list entities', async () => {
      await dataManager.createNewServiceEntity()
      await dataManager.createNewServiceEntity()
      
      const response = await client.newService.list()
      assertions.assertSuccessResponse(response)
      assertions.assertArrayOfItems(response.data, 2)
    })
  })

  describe('Error Handling', () => {
    test('should handle validation errors', async () => {
      const response = await client.newService.create({})
      assertions.assertErrorResponse(response, {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR'
      })
    })

    test('should handle not found errors', async () => {
      const response = await client.newService.get(999999)
      assertions.assertErrorResponse(response, {
        statusCode: 404,
        errorCode: 'NOT_FOUND'
      })
    })
  })

  describe('Business Logic', () => {
    test('should handle service-specific operations', async () => {
      // Test service-specific functionality
    })
  })
})
```

### Test Data Factories

```typescript
// utils/test-helpers.ts - Expand factories
export const factories = {
  // Existing factories
  createProjectData: (overrides = {}) => ({
    name: `Test Project ${Date.now()}`,
    path: `/tmp/test-${Date.now()}`,
    ...overrides
  }),
  
  // Add new service factories
  createTicketData: (overrides = {}) => ({
    title: `Test Ticket ${Date.now()}`,
    description: 'Test ticket description',
    priority: 'normal',
    status: 'open',
    ...overrides
  }),
  
  createTaskData: (overrides = {}) => ({
    content: `Test task ${Date.now()}`,
    description: 'Test task description',
    done: false,
    ...overrides
  }),
  
  createQueueData: (overrides = {}) => ({
    name: `Test Queue ${Date.now()}`,
    description: 'Test queue description',
    maxParallelItems: 3,
    ...overrides
  }),
  
  // AI-specific factories
  createCompletionRequest: (overrides = {}) => ({
    prompt: 'Write a hello world function:',
    maxTokens: 100,
    temperature: 0.3,
    ...overrides
  }),
  
  createChatRequest: (overrides = {}) => ({
    messages: [{ role: 'user', content: 'Hello' }],
    maxTokens: 50,
    temperature: 0.3,
    ...overrides
  })
}
```

### Test Assertions Library

```typescript
// utils/test-helpers.ts - Expand assertions
export const assertions = {
  // Response assertions
  assertSuccessResponse: (response: any, expectedData?: any) => {
    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    if (expectedData) {
      expect(response.data).toMatchObject(expectedData)
    }
  },
  
  assertErrorResponse: (response: any, expected: {
    statusCode?: number
    errorCode?: string
    message?: string
  }) => {
    expect(response.success).toBe(false)
    expect(response.error).toBeDefined()
    if (expected.statusCode) {
      expect(response.error.statusCode).toBe(expected.statusCode)
    }
    if (expected.errorCode) {
      expect(response.error.code).toBe(expected.errorCode)
    }
  },
  
  // Data assertions
  assertValidEntity: (entity: any, requiredFields: string[]) => {
    expect(entity).toBeDefined()
    expect(entity.id).toBeDefined()
    expect(entity.created).toBeDefined()
    expect(entity.updated).toBeDefined()
    
    requiredFields.forEach(field => {
      expect(entity[field]).toBeDefined()
    })
  },
  
  assertArrayOfItems: (array: any[], expectedLength?: number) => {
    expect(Array.isArray(array)).toBe(true)
    if (expectedLength !== undefined) {
      expect(array.length).toBe(expectedLength)
    }
  },
  
  // AI-specific assertions
  assertValidAIResponse: (response: any) => {
    expect(response.content).toBeDefined()
    expect(typeof response.content).toBe('string')
    expect(response.content.length).toBeGreaterThan(0)
  },
  
  assertValidStreamingResponse: (chunks: string[]) => {
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('').length).toBeGreaterThan(0)
  }
}
```

## Running Tests

### Local Development

```bash
# Run all API tests
bun run test:isolated

# Run specific service tests
bun run test:projects
bun run test:tickets
bun run test:ai

# Run with debug output
TEST_DEBUG=true bun run test:isolated

# Skip AI tests
SKIP_AI_TESTS=true bun run test:isolated
```

### CI/CD Environment

```bash
# CI automatically detected, uses optimized settings:
# - Memory database
# - Skipped AI tests
# - Shorter timeouts
# - Error-level logging only
bun run test:isolated
```

### LMStudio Setup for AI Tests

```bash
# 1. Start LMStudio
# 2. Load a model (openai/gpt-oss-20b recommended)
# 3. Start server (usually port 1234)
# 4. Run tests
LMSTUDIO_BASE_URL=http://localhost:1234 bun run test:ai
```

## Next Steps

1. **Expand Test Coverage**: Add tests for remaining services (tickets, queues, git, mcp)
2. **Integration Tests**: Create end-to-end workflow tests
3. **Performance Tests**: Add load testing and benchmarking
4. **Mock System**: Improve AI mocking for CI environments
5. **Test Reporting**: Add test coverage and performance reporting

## References

- [Test Environment Setup](./test-environment.ts)
- [Test Server Infrastructure](./test-server.ts)
- [Test Utilities](./utils/test-helpers.ts)
- [Existing AI Tests](./ai-endpoints.test.ts)
- [Bun Test Documentation](https://bun.sh/docs/cli/test)
