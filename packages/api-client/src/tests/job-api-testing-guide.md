# Job Management API Testing Guide

This document provides comprehensive guidance for testing the Job Management API endpoints in Promptliano.

## Overview

The Job Management API provides functionality for managing background tasks and long-running operations. The test suite covers:

- **CRUD Operations**: Create, read, update, delete jobs
- **Lifecycle Management**: Job state transitions (pending → running → completed/failed)
- **Queue Operations**: Job prioritization and worker coordination
- **Retry Mechanisms**: Failed job retry with configurable limits
- **Cleanup Operations**: Archive/delete old completed jobs
- **Statistics**: Job monitoring and analytics
- **Performance**: High-volume and concurrent job processing
- **Error Handling**: Validation and edge case scenarios

## Test Architecture

### Isolated Test Environment

Each test suite runs with:
- **Dedicated server instance** per test suite
- **In-memory or temporary database** for data isolation
- **Dynamic port allocation** for parallel execution safety
- **Automatic cleanup** of all test data

### Test Data Management

The `TestDataManager` class provides:
- **Automatic tracking** of created entities
- **Cleanup on test completion** with error handling
- **Factory functions** for consistent test data
- **Assertion helpers** for response validation

### Environment Configuration

Tests adapt to different environments:

| Environment | Database | AI Tests | Timeouts | Logging |
|-------------|----------|----------|----------|---------|
| **Local**   | File DB  | Enabled  | 30s      | Debug   |
| **CI**      | Memory   | Skipped  | 15s      | Error   |
| **Debug**   | File DB  | Enabled  | 60s      | Verbose |

## Test Structure

### 1. Basic CRUD Operations

```typescript
describe('Job CRUD Operations', () => {
  test('should create a job with minimal required fields', async () => {
    const jobData: CreateJobRequest = {
      type: 'test-job',
      input: { action: 'simple-test', value: 42 }
    }
    
    const result = await client.jobs.createJob(jobData)
    assertions.assertSuccessResponse(result)
    assertions.assertValidJob(result.data)
  })
})
```

### 2. Job Lifecycle Management

```typescript
describe('Job Lifecycle Management', () => {
  test('should handle complete job lifecycle', async () => {
    // Create → Start → Update Progress → Complete
    let job = await createJob()
    job = await client.jobs.startJob(job.id)
    job = await client.jobs.updateJobProgress(job.id, { current: 50, total: 100 })
    job = await client.jobs.completeJob(job.id, { result: 'success' })
  })
})
```

### 3. Error Scenarios

```typescript
describe('Error Handling', () => {
  test('should handle retry limits correctly', async () => {
    const job = await createJobWithRetries(maxRetries: 2)
    
    // Fail and retry up to limit
    for (let attempt = 0; attempt <= job.maxRetries; attempt++) {
      await failJob(job.id)
      if (attempt < job.maxRetries) {
        job = await client.jobs.retryJob(job.id)
      }
    }
    
    // Should fail after max retries
    await expect(client.jobs.retryJob(job.id)).rejects.toThrow()
  })
})
```

### 4. Performance Testing

```typescript
describe('Performance Testing', () => {
  test.skipIf(testEnv.isCI)('should handle high job creation volume', async () => {
    const batchSize = 50
    const jobs = await Promise.all(
      Array.from({ length: batchSize }, () => createJob())
    )
    
    expect(jobs).toHaveLength(batchSize)
    // Verify performance metrics
  })
})
```

## Running Tests

### Command Line

```bash
# Run all job API tests
bun test packages/api-client/src/tests/job-api.test.ts

# Run with custom timeout
bun test packages/api-client/src/tests/job-api.test.ts --timeout=60000

# Run specific test group
bun test packages/api-client/src/tests/job-api.test.ts --grep="CRUD Operations"

# Run with verbose output
bun test packages/api-client/src/tests/job-api.test.ts --verbose
```

### Test Runner Script

```bash
# Use the provided test runner
bun run packages/api-client/src/tests/run-job-tests.ts

# With environment variables
TEST_PERFORMANCE=true bun run packages/api-client/src/tests/run-job-tests.ts
```

### Environment Variables

```bash
# Required
export NODE_ENV=test

# Optional configuration
export TEST_SERVER_URL=http://localhost:3147    # External server
export TEST_DB_PATH=/tmp/job-test.db            # Custom DB path
export TEST_ISOLATED_SERVER=true                # Use isolated server
export TEST_PERFORMANCE=true                    # Run performance tests
export TEST_TIMEOUT=60000                       # Timeout in milliseconds
export TEST_VERBOSE=true                        # Verbose output
```

## Test Coverage

### Job Operations Tested

| Operation | Description | Test Coverage |
|-----------|-------------|---------------|
| `createJob` | Create new job | ✅ Minimal + Full data |
| `getJob` | Retrieve job by ID | ✅ Success + 404 error |
| `listJobs` | List with filtering | ✅ Pagination + Filters |
| `updateJob` | Update job status/data | ✅ Status + Progress + Metadata |
| `deleteJob` | Hard delete job | ✅ Success + Verification |
| `startJob` | Mark job as running | ✅ Status transition |
| `completeJob` | Mark job completed | ✅ With result data |
| `failJob` | Mark job failed | ✅ With error details |
| `cancelJob` | Cancel running job | ✅ Status transition |
| `retryJob` | Retry failed job | ✅ Retry limits + Reset |
| `getNextJob` | Get job for worker | ✅ Priority ordering |
| `updateJobProgress` | Update progress | ✅ Progress tracking |
| `getJobStats` | Get statistics | ✅ All stat fields |
| `cleanupJobs` | Archive/delete old jobs | ✅ Dry run + Actual |
| `bulkCancelJobs` | Cancel multiple jobs | ✅ Criteria matching |

### Error Scenarios Tested

- **Validation Errors**: Invalid job data, status transitions
- **Not Found Errors**: Invalid job IDs, deleted jobs
- **Concurrency Issues**: Multiple workers, race conditions
- **Retry Limits**: Maximum retry exceeded
- **State Conflicts**: Invalid status transitions
- **Permission Errors**: Access control violations

### Performance Scenarios

- **High Volume**: 50+ job creation in batch
- **Concurrent Processing**: Multiple workers processing jobs
- **Load Testing**: Sustained job throughput
- **Memory Usage**: Large job payloads and results

## Best Practices

### Test Isolation

```typescript
describe('Feature Tests', () => {
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
})
```

### Error Testing

```typescript
// Always test both success and error paths
test('should handle invalid job ID', async () => {
  await expect(client.jobs.getJob(999999)).rejects.toThrow(/404/)
})
```

### Performance Considerations

```typescript
// Skip performance tests in CI
test.skipIf(testEnv.isCI)('performance test', async () => {
  // Heavy test logic
})

// Use performance tracking
const duration = await perfTracker.measure('operation', async () => {
  return await client.jobs.createJob(data)
})
```

### Assertion Patterns

```typescript
// Use structured assertions
assertions.assertSuccessResponse(result)
assertions.assertValidJob(result.data)

// Validate business logic
expect(job.status).toBe('pending')
expect(job.retryCount).toBe(0)
assertions.assertValidTimestamp(job.createdAt)
```

## Debugging

### Test Failures

1. **Check test environment setup**
   ```bash
   echo $NODE_ENV  # Should be 'test'
   ```

2. **Verify server availability**
   ```bash
   curl http://localhost:3147/health
   ```

3. **Check database state**
   ```bash
   ls -la /tmp/promptliano-job-test.db
   ```

4. **Review test logs**
   ```bash
   TEST_VERBOSE=true bun test job-api.test.ts
   ```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Port conflicts | Multiple test runs | Use isolated servers |
| Database locks | Unclean shutdown | Delete test DB files |
| Timeout errors | Slow operations | Increase test timeout |
| Memory issues | Large test data | Use memory database |
| CI failures | Environment differences | Check CI configuration |

## Contributing

### Adding New Tests

1. **Follow existing patterns** for test structure
2. **Use TestDataManager** for cleanup tracking
3. **Add appropriate assertions** for response validation
4. **Include error scenarios** for robustness
5. **Consider performance impact** and use skipIf when needed

### Test Utilities

When adding new job-related test utilities:

1. **Add to assertions object** for validation helpers
2. **Add to factories object** for data generation
3. **Add to TestDataManager** for cleanup tracking
4. **Document usage patterns** in this guide

### Performance Guidelines

- **Keep tests under 30 seconds** total execution time
- **Use in-memory databases** for speed when possible
- **Skip heavy tests in CI** using `test.skipIf(testEnv.isCI)`
- **Track performance metrics** for regression detection
- **Clean up resources promptly** to avoid memory leaks

This comprehensive test suite ensures the Job Management API is robust, performant, and reliable across all supported scenarios.