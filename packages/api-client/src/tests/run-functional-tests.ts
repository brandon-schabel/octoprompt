#!/usr/bin/env bun

// Script to run all API functional tests with proper environment setup

import { $ } from 'bun'
import { TEST_API_URL } from './test-config'

// const API_URL = process.env.API_URL || 'http://localhost:3000'

console.log('🧪 Running API Functional Tests')
console.log(`📍 API URL: ${TEST_API_URL}`) // This is informational; API_URL in test files is what matters.
console.log('─'.repeat(50))

const testFiles = ['projects-api.test.ts', 'chat-api.test.ts', 'prompt-api.test.ts', 'provider-key-api.test.ts']

try {
  // Run the tests. Bun test can take multiple file arguments.
  // The timeout is applied to each file individually.
  await $`bun test ${testFiles} --timeout 30000`

  console.log('\n✅ All API tests completed successfully!')
} catch (error) {
  console.error('\n❌ API tests failed:', error)
  process.exit(1)
}
