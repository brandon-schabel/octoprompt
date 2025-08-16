#!/usr/bin/env bun

/**
 * Test runner for Job Management API tests
 * 
 * This script runs the comprehensive job API test suite with proper
 * environment setup and error handling.
 * 
 * Usage:
 *   bun run packages/api-client/src/tests/run-job-tests.ts
 *   
 * Environment Variables:
 *   NODE_ENV=test                    - Required for test execution
 *   TEST_SERVER_URL                  - Optional external server URL
 *   TEST_DB_PATH                     - Optional test database path
 *   TEST_ISOLATED_SERVER=true        - Use isolated test server (default)
 *   TEST_PERFORMANCE=true            - Run performance tests (skipped in CI)
 *   TEST_TIMEOUT=60000               - Test timeout in milliseconds
 */

import { $ } from 'bun'

// Ensure test environment
process.env.NODE_ENV = 'test'

// Configuration
const config = {
  testFile: './job-api.test.ts',
  timeout: parseInt(process.env.TEST_TIMEOUT || '60000'),
  isolated: process.env.TEST_ISOLATED_SERVER !== 'false',
  performance: process.env.TEST_PERFORMANCE === 'true',
  verbose: process.env.TEST_VERBOSE === 'true'
}

console.log('🚀 Job Management API Test Runner')
console.log('==================================')
console.log(`Test File: ${config.testFile}`)
console.log(`Timeout: ${config.timeout}ms`)
console.log(`Isolated Server: ${config.isolated}`)
console.log(`Performance Tests: ${config.performance}`)
console.log(`Verbose Output: ${config.verbose}`)
console.log('')

async function runTests() {
  try {
    console.log('📋 Running Job Management API Tests...')
    
    const testArgs = [
      'test',
      config.testFile,
      `--timeout=${config.timeout}`
    ]
    
    if (config.verbose) {
      testArgs.push('--verbose')
    }
    
    // Run the tests
    const result = await $`bun ${testArgs}`.cwd(import.meta.dir)
    
    if (result.exitCode === 0) {
      console.log('✅ All Job Management API tests passed!')
    } else {
      console.log('❌ Some tests failed')
      process.exit(result.exitCode)
    }
    
  } catch (error) {
    console.error('💥 Test execution failed:', error)
    process.exit(1)
  }
}

async function main() {
  console.log('🔍 Pre-flight checks...')
  
  // Check if Bun is available
  try {
    await $`bun --version`
    console.log('✅ Bun runtime available')
  } catch (error) {
    console.error('❌ Bun runtime not found. Please install Bun first.')
    process.exit(1)
  }
  
  // Check if test file exists
  const testFilePath = new URL(config.testFile, import.meta.url).pathname
  try {
    await Bun.file(testFilePath).exists()
    console.log('✅ Test file found')
  } catch (error) {
    console.error(`❌ Test file not found: ${testFilePath}`)
    process.exit(1)
  }
  
  // Environment warnings
  if (!config.isolated && !process.env.TEST_SERVER_URL) {
    console.warn('⚠️  No external server URL provided, falling back to isolated server')
    config.isolated = true
  }
  
  if (process.env.CI && config.performance) {
    console.log('🏃 CI environment detected, performance tests will be skipped')
  }
  
  console.log('')
  
  // Run tests
  await runTests()
}

// Handle process signals for cleanup
process.on('SIGINT', () => {
  console.log('\n👋 Test execution interrupted')
  process.exit(130)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Test execution terminated')
  process.exit(143)
})

// Run if this script is executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })
}

export { runTests, config }