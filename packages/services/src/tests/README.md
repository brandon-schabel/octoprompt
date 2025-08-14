# Local AI Model Testing Guide

This directory contains comprehensive tests for API endpoints that use local AI models (LOW_MODEL_CONFIG) with LMStudio.

## Overview

The test suite validates:

- File summarization with LMStudio (gpt-oss:20b model)
- Smart truncation for large files
- Batch processing capabilities
- Caching effectiveness
- Error handling and recovery
- End-to-end workflows

## Prerequisites

### 1. Install and Configure LMStudio

1. Download LMStudio from [https://lmstudio.ai/](https://lmstudio.ai/)
2. Start LMStudio and configure it to run on `http://192.168.1.38:1234` (or update the URL in tests)
3. Load the `gpt-oss:20b` model (or any compatible model)

### 2. Environment Setup

```bash
# Set LMStudio URL (if different from default)
export LMSTUDIO_BASE_URL=http://192.168.1.38:1234

# Optional: Skip LMStudio tests in CI
export SKIP_LMSTUDIO_TESTS=true
```

## Running Tests

### Quick Start

```bash
# Check if LMStudio is available
bun run test-local-models.ts --check-only

# Run all AI model tests
bun run test:local-models

# Run with mock responses (no LMStudio needed)
bun run test-local-models.ts --mock
```

### Individual Test Suites

```bash
# File summarization tests only
bun run test:summarization

# End-to-end workflow tests
bun run test:ai-e2e

# Run with custom timeout
bun test packages/services/src/tests/file-summarization.test.ts --timeout 60000
```

### NPM Scripts

```bash
# Run all local model tests
npm run test:local-models

# Run summarization tests
npm run test:summarization

# Run AI integration tests
npm run test:ai-integration

# Run end-to-end tests
npm run test:ai-e2e
```

## Test Structure

```
tests/
├── local-model-test-config.ts      # Configuration and setup
├── file-summarization.test.ts      # Main summarization tests
├── utils/
│   └── ai-test-helpers.ts          # Helper utilities
├── fixtures/
│   └── test-files.ts               # Mock files for testing
├── validators/
│   └── summary-quality.ts          # Quality validation
└── e2e/
    └── summarization-workflow.test.ts # End-to-end tests
```

## Test Configuration

### Timeouts

Default timeouts for different operations:

- Single file: 30 seconds
- Batch files: 60 seconds
- Project summary: 90 seconds

### Quality Thresholds

- Minimum summary length: 50 characters
- Maximum summary length: 500 characters
- Required elements: PURPOSE, TYPE
- Minimum quality score: 60/100

### Performance Benchmarks

- Single file: < 10 seconds
- Batch (10 files): < 30 seconds
- Token usage: < 2000 per file

## Test Cases

### Core Test Scenarios

1. **Happy Path**: Standard TypeScript file → Valid summary
2. **Large Files**: 100KB+ files → Truncated summaries
3. **Empty Files**: No content → Appropriate message
4. **Edge Cases**: Comments only, syntax errors, binary files
5. **Multi-language**: TypeScript, JavaScript, Python, Rust
6. **Batch Processing**: Multiple files in parallel
7. **Caching**: Repeated requests use cache
8. **Force Refresh**: Override cache when needed
9. **Error Recovery**: Network failures, model errors
10. **E2E Workflow**: Create → Sync → Summarize → Validate

## Writing New Tests

### Basic Test Template

```typescript
import { describe, test, expect } from 'bun:test'
import { LOCAL_MODEL_TEST_CONFIG, isLMStudioAvailable } from './local-model-test-config'
import { validateAIResponse } from './utils/ai-test-helpers'

describe('My AI Feature', () => {
  let lmstudioAvailable = false

  beforeAll(async () => {
    lmstudioAvailable = await isLMStudioAvailable()
  })

  test(
    'should process with AI',
    async () => {
      if (lmstudioAvailable) {
        // Real AI call
        const result = await myAIFunction()
        const validation = validateAIResponse(result)
        expect(validation.isValid).toBe(true)
      } else {
        // Mock response
        const result = generateMockResponse()
        expect(result).toBeDefined()
      }
    },
    LOCAL_MODEL_TEST_CONFIG.timeouts.default
  )
})
```

### Adding Test Fixtures

```typescript
// In fixtures/test-files.ts
export const myTestFile = {
  id: 100,
  projectId: 1,
  path: 'src/my-file.ts',
  name: 'my-file.ts',
  content: '// Your test content',
  type: 'file',
  extension: '.ts',
  created: Date.now(),
  updated: Date.now(),
  size: 100,
  checksum: 'mock-checksum'
} as ProjectFile
```

### Custom Validators

```typescript
// In validators/my-validator.ts
export function validateMyFeature(response: string): ValidationResult {
  const issues: Issue[] = []

  // Your validation logic
  if (!response.includes('required-element')) {
    issues.push({
      type: 'error',
      message: 'Missing required element'
    })
  }

  return {
    valid: issues.length === 0,
    issues
  }
}
```

## Troubleshooting

### LMStudio Connection Issues

```bash
# Test connection
curl http://192.168.1.38:1234/v1/models

# Expected response
{
  "data": [
    {"id": "gpt-oss:20b", "object": "model", ...}
  ]
}
```

### Common Issues

1. **"LMStudio not available"**
   - Ensure LMStudio is running
   - Check the URL matches your configuration
   - Verify firewall allows connections

2. **"Model not found"**
   - Load the gpt-oss:20b model in LMStudio
   - Or update tests to use your loaded model

3. **Timeouts**
   - Increase timeout values in test config
   - Check model performance settings
   - Consider using smaller test files

4. **Quality validation failures**
   - Review the summary requirements
   - Check model temperature settings
   - Ensure proper prompt formatting

## CI/CD Integration

### GitHub Actions Example

```yaml
name: AI Model Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests with mocks
        run: bun run test-local-models.ts --mock
        env:
          SKIP_LMSTUDIO_TESTS: true
```

### Local CI Testing

```bash
# Run tests as they would in CI
SKIP_LMSTUDIO_TESTS=true bun run test:local-models
```

## Performance Monitoring

Track test performance over time:

```bash
# Generate performance report
bun test --coverage packages/services/src/tests/

# View metrics
cat coverage/lcov-report/index.html
```

## Contributing

When adding new AI-powered features:

1. Create appropriate test files in this directory
2. Add fixtures for test data
3. Implement validators for response quality
4. Document expected behavior
5. Add to CI pipeline if applicable

## Support

For issues or questions:

- Check the troubleshooting section above
- Review existing test implementations
- Consult the main project documentation
- Open an issue with test logs and configuration
