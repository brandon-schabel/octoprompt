#!/usr/bin/env bun

// Script to run all API functional tests with proper environment setup

import { $ } from 'bun'
import { TEST_API_URL, TEST_ENCRYPTION_KEY, TEST_DB_PATH } from './test-config'
import { setupTestSuite, teardownTestSuite, waitForServer } from './test-setup'

console.log('🧪 Running API Functional Tests')
console.log(`📍 API URL: ${TEST_API_URL}`)
console.log(`🗄️  Test DB: ${TEST_DB_PATH}`)
console.log('─'.repeat(50))

const testFiles = ['projects-api.test.ts', 'chat-api.test.ts', 'prompt-api.test.ts', 'provider-key-api.test.ts']

let serverProcess: any = null

try {
  // Setup test environment
  await setupTestSuite()

  // Start test server with proper configuration
  console.log('🚀 Starting test server...')
  serverProcess = Bun.spawn([
    'bun', 'run', 'packages/server/server.ts'
  ], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_DB_PATH: TEST_DB_PATH,
      PROMPTLIANO_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
      PORT: '3147'  // Use test port instead of default
    },
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd() // Ensure correct working directory
  })

  // Log server output for debugging
  if (serverProcess.stdout) {
    serverProcess.stdout.pipeTo(new WritableStream({
      write(chunk) {
        console.log('[SERVER]', new TextDecoder().decode(chunk))
      }
    }))
  }
  
  if (serverProcess.stderr) {
    serverProcess.stderr.pipeTo(new WritableStream({
      write(chunk) {
        console.error('[SERVER ERROR]', new TextDecoder().decode(chunk))
      }
    }))
  }

  // Wait for server to be ready (increased timeout for migrations)
  const serverReady = await waitForServer(TEST_API_URL, 30)
  if (!serverReady) {
    throw new Error('Server is not ready after waiting')
  }

  // Set environment variables for tests
  process.env.NODE_ENV = 'test'
  process.env.TEST_DB_PATH = TEST_DB_PATH
  process.env.PROMPTLIANO_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY

  // Run the tests with increased timeout
  await $`bun test ${testFiles} --timeout 60000 --bail`

  console.log('\n✅ All API tests completed successfully!')
} catch (error) {
  console.error('\n❌ API tests failed:', error)
  
  // Show more details about the error
  if (error instanceof Error) {
    console.error('Error details:', error.message)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }
  
  process.exit(1)
} finally {
  // Kill test server
  if (serverProcess) {
    console.log('🛑 Stopping test server...')
    try {
      serverProcess.kill()
      // Wait a moment for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.warn('Warning: Failed to stop server process:', error)
    }
  }

  // Always cleanup test environment
  try {
    await teardownTestSuite()
  } catch (cleanupError) {
    console.warn('Warning: Cleanup failed:', cleanupError)
  }
}
