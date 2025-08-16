# API Client Testing Suite

This directory contains the comprehensive testing suite for the Promptliano API client, featuring isolated test servers, AI endpoint testing with LMStudio integration, and extensive configuration options.

## Overview

The testing suite provides:

- **🏗️ Isolated Test Servers**: Each test suite runs with its own server and database
- **🤖 AI Integration Testing**: LMStudio integration with automatic fallbacks
- **⚙️ Flexible Configuration**: Environment-based configuration with extensive customization
- **🧹 Automatic Cleanup**: Test data is automatically tracked and cleaned up
- **🚀 Parallel Execution**: Tests can run concurrently without conflicts
- **📊 Performance Tracking**: Built-in performance measurement tools

## Quick Start

### Basic Testing

```bash
# Run all tests with isolated servers
npm run test:isolated

# Run individual test suites
npm run test:projects
npm run test:chat
npm run test:prompt
npm run test:provider-key
```

### AI Endpoint Testing

```bash
# Check LMStudio availability
npm run test:env:check

# Run AI tests (auto-detects LMStudio)
npm run test:ai

# Run AI tests with specific LMStudio URL
npm run test:ai:local

# Skip AI tests entirely
npm run test:ai:skip
```

### Configuration Options

```bash
# Use in-memory database for faster tests
npm run test:memory

# Use external server instead of isolated
npm run test:external

# Debug mode with verbose logging
npm run test:debug

# Print current test configuration
npm run test:config:print
```

## Architecture

### Test Server Infrastructure

The `test-server.ts` module provides isolated test servers:

```typescript
import { createTestServer, withTestServer } from './test-server'

// Create isolated test server
const testServer = await createTestServer({
  databasePath: ':memory:', // In-memory for speed
  enableRateLimit: false,   // Disable for testing
  logLevel: 'silent'        // Quiet during tests
})

// Use with automatic cleanup
await withTestServer(async (server) => {
  const client = createPromptlianoClient({ baseUrl: server.baseUrl })
  // Run tests...
}, { port: 0 }) // Dynamic port assignment
```

### Test Environment Configuration

The `test-environment.ts` module manages environment detection and configuration:

```typescript
import { createTestEnvironment, checkLMStudioAvailability } from './test-environment'

// Create environment with AI support
const testEnv = await createTestEnvironment({
  ai: {
    lmstudio: {
      enabled: true,
      baseUrl: 'http://192.168.1.38:1234',
      model: 'openai/gpt-oss-20b'
    }
  }
})

// Check if LMStudio is available
const status = await checkLMStudioAvailability(testEnv.config.ai.lmstudio)
if (!status.available) {
  console.warn('LMStudio not available:', status.message)
}
```

### Test Utilities and Helpers

The `utils/test-helpers.ts` module provides testing utilities:

```typescript
import { assertions, factories, TestDataManager, patterns } from './utils/test-helpers'

// Use assertions for consistent validation
assertions.assertSuccessResponse(response, { id: expect.any(Number) })
assertions.assertValidTimestamp(entity.created)
assertions.assertArrayOfItems(results, 1)

// Create test data with factories
const projectData = factories.createProjectData({
  name: 'Custom Project Name'
})

// Manage test data lifecycle
const dataManager = new TestDataManager(client)
const project = await dataManager.createProject() // Auto-tracked for cleanup
await dataManager.cleanup() // Cleanup all tracked entities

// Test common patterns
await patterns.testCrudOperations('Project', {
  create: client.projects.createProject,
  read: client.projects.getProject,
  update: client.projects.updateProject,
  delete: client.projects.deleteProject,
  list: client.projects.listProjects
}, {
  create: factories.createProjectData(),
  update: { name: 'Updated Name' }
})
```

## LMStudio Integration

### Setup Instructions

1. **Install LMStudio**:
   - Download from [lmstudio.ai](https://lmstudio.ai)
   - Install and start the application

2. **Load a Model**:
   - Download a compatible model (recommended: `openai/gpt-oss-20b` or similar)
   - Load the model in LMStudio
   - Start the server (usually on port 1234)

3. **Configure Network Access**:
   - If LMStudio is on a different machine, ensure network access
   - Default configuration expects LMStudio at `http://192.168.1.38:1234`
   - Update via environment variable: `LMSTUDIO_BASE_URL=http://your-ip:1234`

### Environment Variables

```bash
# LMStudio configuration
export LMSTUDIO_BASE_URL=\"http://192.168.1.38:1234\"
export LMSTUDIO_MODEL=\"openai/gpt-oss-20b\"
export AI_TEST_TIMEOUT=\"30000\"

# Test behavior
export SKIP_AI_TESTS=\"true\"                    # Skip all AI tests
export AI_FAIL_WHEN_UNAVAILABLE=\"true\"         # Fail instead of skip when unavailable
export AI_USE_MOCKS=\"true\"                     # Use mocks when LMStudio unavailable
```

### AI Test Examples

The AI endpoint tests cover:

```typescript
// Text completion
const response = await fetch(`${baseUrl}/api/gen-ai/completion`, {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Write a hello world function in TypeScript:',
    maxTokens: 100,
    temperature: 0.3
  })
})

// Streaming chat
const response = await fetch(`${baseUrl}/api/gen-ai/chat/stream`, {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Say hello' }]
  })
})

// Structured data generation
const response = await fetch(`${baseUrl}/api/gen-ai/structured`, {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Generate a todo item',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' }
      }
    }
  })
})

// File summarization
const response = await fetch(`${baseUrl}/api/gen-ai/summarize-file`, {
  method: 'POST',
  body: JSON.stringify({
    content: codeContent,
    fileName: 'example.ts',
    fileType: 'typescript'
  })
})
```

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| **Server Configuration** |
| `TEST_USE_EXTERNAL_SERVER` | Use external server instead of isolated | `false` |
| `TEST_API_URL` | External server URL | `http://localhost:3147` |
| `TEST_FIXED_PORT` | Use fixed port instead of dynamic | `false` |
| `TEST_PORT` | Fixed port number | `3147` |
| **Database Configuration** |
| `TEST_USE_MEMORY_DB` | Force in-memory database | `false` (true in CI) |
| `TEST_DB_PATH` | Database file path | `/tmp/promptliano-test.db` |
| `TEST_KEEP_DB` | Preserve database between suites | `false` |
| **AI Configuration** |
| `SKIP_AI_TESTS` | Skip all AI endpoint tests | `false` (true in CI) |
| `LMSTUDIO_BASE_URL` | LMStudio server URL | `http://192.168.1.38:1234` |
| `LMSTUDIO_MODEL` | Target model name | `openai/gpt-oss-20b` |
| `AI_TEST_TIMEOUT` | AI operation timeout (ms) | `30000` |
| `AI_FAIL_WHEN_UNAVAILABLE` | Fail when AI unavailable | `false` |
| `AI_USE_MOCKS` | Use mocks when AI unavailable | `true` |
| **Execution Configuration** |
| `TEST_API_TIMEOUT` | API request timeout (ms) | `30000` (local), `15000` (CI) |
| `TEST_ENABLE_RATE_LIMIT` | Enable rate limiting | `false` |
| `TEST_PARALLEL` | Enable parallel execution | `true` (local), `false` (CI) |
| `TEST_LOG_LEVEL` | Log level | `warn` (local), `error` (CI) |
| `TEST_RETRIES` | Max retry attempts | `3` |
| **Environment Control** |
| `FORCE_CI_MODE` | Force CI configuration | `false` |
| `FORCE_LOCAL_MODE` | Force local configuration | `false` |
| `TEST_DEBUG` | Enable debug output | `false` |

### Configuration Examples

```bash
# Local development with LMStudio
export LMSTUDIO_BASE_URL=\"http://localhost:1234\"
npm run test:ai

# CI environment (auto-detected)
export CI=\"true\"
npm run test:isolated  # Uses memory DB, skips AI tests

# Custom configuration
export TEST_USE_MEMORY_DB=\"true\"
export TEST_LOG_LEVEL=\"debug\"
export AI_USE_MOCKS=\"false\"
npm run test:debug

# External server testing
export TEST_USE_EXTERNAL_SERVER=\"true\"
export TEST_API_URL=\"http://staging.example.com\"
npm run test:external
```

## Test Scripts Reference

### Core Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Legacy functional tests (external server) |
| `npm run test:isolated` | Modern isolated tests (recommended) |
| `npm run test:isolated:parallel` | All tests in parallel |

### Individual Test Suites

| Command | Description |
|---------|-------------|
| `npm run test:projects` | Project management API tests |
| `npm run test:chat` | Chat API tests |
| `npm run test:prompt` | Prompt management API tests |
| `npm run test:provider-key` | Provider key API tests |

### AI Endpoint Tests

| Command | Description |
|---------|-------------|
| `npm run test:ai` | AI endpoints with auto-detection |
| `npm run test:ai:local` | AI tests with local LMStudio URL |
| `npm run test:ai:skip` | Skip AI tests entirely |

### Configuration and Debugging

| Command | Description |
|---------|-------------|
| `npm run test:config:print` | Print current configuration |
| `npm run test:env:check` | Check LMStudio availability |
| `npm run test:memory` | Use in-memory database |
| `npm run test:external` | Use external server |
| `npm run test:debug` | Debug mode with verbose logging |

## Writing Tests

### Basic Test Structure

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createTestEnvironment, withTestEnvironment } from './test-environment'
import { createPromptlianoClient } from '@promptliano/api-client'
import { assertions, factories, TestDataManager } from './utils/test-helpers'

describe('My API Tests', () => {
  test('should create and retrieve entity', async () => {
    await withTestEnvironment(async (testEnv) => {
      const client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      const dataManager = new TestDataManager(client)

      // Create test data
      const project = await dataManager.createProject(
        factories.createProjectData({ name: 'Test Project' })
      )

      // Test retrieval
      const result = await client.projects.getProject(project.id)
      assertions.assertSuccessResponse(result)
      expect(result.data.name).toBe('Test Project')

      // Cleanup is automatic
    })
  })
})
```

### AI Endpoint Test Structure

```typescript
import { describe, test, expect, beforeAll } from 'bun:test'
import { createTestEnvironment, checkLMStudioAvailability } from './test-environment'

describe('AI API Tests', () => {
  let testEnv: TestEnvironment
  let skipAITests = false

  beforeAll(async () => {
    testEnv = await createTestEnvironment({
      ai: { lmstudio: { enabled: true } }
    })

    const status = await checkLMStudioAvailability(testEnv.config.ai.lmstudio)
    skipAITests = !status.available

    if (skipAITests) {
      console.warn('⚠️ LMStudio not available:', status.message)
    }
  })

  test.skipIf(skipAITests)('should generate text', async () => {
    // AI test implementation
  })
})
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Install dependencies
        run: bun install --frozen-lockfile
        
      - name: Run API tests
        run: |
          # CI environment auto-detected
          cd packages/api-client
          bun run test:isolated
        env:
          CI: true
          # AI tests automatically skipped in CI
          
      - name: Run AI tests (if LMStudio available)
        run: |
          cd packages/api-client
          bun run test:ai:skip  # Explicitly skip in CI
        continue-on-error: true  # Don't fail build if AI unavailable
```

### Local Development Workflow

```bash
# 1. Start LMStudio (optional)
# - Open LMStudio
# - Load a model
# - Start server

# 2. Check environment
npm run test:env:check

# 3. Run tests
npm run test:isolated        # Basic API tests
npm run test:ai             # AI tests (if LMStudio available)

# 4. Debug if needed
npm run test:debug          # Verbose logging
npm run test:config:print   # Check configuration
```

## Troubleshooting

### Common Issues

**1. "Test server failed to start"**
```bash
# Check for port conflicts
lsof -i :3147

# Use dynamic ports
export TEST_FIXED_PORT=\"false\"
npm run test:isolated
```

**2. "LMStudio not available"**
```bash
# Check LMStudio status
npm run test:env:check

# Use custom URL
export LMSTUDIO_BASE_URL=\"http://localhost:1234\"
npm run test:ai:local

# Skip AI tests
npm run test:ai:skip
```

**3. "Database locked" errors**
```bash
# Use memory database
npm run test:memory

# Clean up test files
rm -f /tmp/promptliano-test*
```

**4. Tests hanging or timing out**
```bash
# Increase timeouts
export TEST_API_TIMEOUT=\"60000\"
export AI_TEST_TIMEOUT=\"60000\"

# Disable parallel execution
export TEST_PARALLEL=\"false\"
```

**5. "Permission denied" errors**
```bash
# Check file permissions
ls -la /tmp/promptliano-test*

# Use different temp directory
export TEST_DB_PATH=\"/home/user/test.db\"
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
export TEST_DEBUG=\"true\"
export TEST_LOG_LEVEL=\"debug\"
npm run test:debug
```

This will show:
- Test environment configuration
- Server startup details
- Database initialization
- AI service availability
- Request/response details
- Cleanup operations

### Performance Issues

Monitor test performance:

```typescript
import { PerformanceTracker } from './utils/test-helpers'

const tracker = new PerformanceTracker()

await tracker.measure('api-call', async () => {
  await client.projects.listProjects()
})

tracker.printSummary()
```

Optimize test execution:
- Use memory database: `npm run test:memory`
- Enable parallel execution: `export TEST_PARALLEL=\"true\"`
- Reduce timeouts: `export TEST_API_TIMEOUT=\"10000\"`
- Skip AI tests: `export SKIP_AI_TESTS=\"true\"`

## Contributing

When adding new tests:

1. **Use the isolated test infrastructure** for new test suites
2. **Follow the naming convention**: `feature-name.test.ts`
3. **Include proper cleanup** using `TestDataManager`
4. **Add environment variable documentation** if introducing new config
5. **Update this README** with new test commands or features
6. **Test both local and CI environments** before submitting

### Test File Template

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createTestEnvironment, type TestEnvironment } from './test-environment'
import { createPromptlianoClient } from '@promptliano/api-client'
import { assertions, factories, TestDataManager } from './utils/test-helpers'

describe('Feature Name API Tests', () => {
  let testEnv: TestEnvironment
  let client: ReturnType<typeof createPromptlianoClient>
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

  test('should do something', async () => {
    // Test implementation
  })
})
```

## Resources

- **[Bun Test Runner](https://bun.sh/docs/cli/test)** - Testing framework documentation
- **[LMStudio](https://lmstudio.ai)** - Local AI model server
- **[Hono Testing](https://hono.dev/guides/testing)** - Server testing patterns
- **[API Client Source](../api-client.ts)** - Main API client implementation

For questions or issues, please check the [main project documentation](../../../README.md) or open an issue.