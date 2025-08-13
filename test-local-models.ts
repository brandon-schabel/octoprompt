#!/usr/bin/env bun

/**
 * Test runner for local AI model endpoints
 * 
 * Usage:
 *   bun run test-local-models.ts                    # Run all tests
 *   bun run test-local-models.ts --check-only       # Just check if LMStudio is available
 *   bun run test-local-models.ts --mock             # Run with mock responses (no LMStudio needed)
 */

import { $ } from 'bun'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check-only')
const useMock = args.includes('--mock')

const LMSTUDIO_URL = process.env.LMSTUDIO_BASE_URL || 'http://192.168.1.38:1234'

async function checkLMStudioConnection(): Promise<boolean> {
  console.log(`\n🔍 Checking LMStudio connection at ${LMSTUDIO_URL}...`)
  
  try {
    const response = await fetch(`${LMSTUDIO_URL}/v1/models`)
    if (!response.ok) {
      console.error(`❌ LMStudio returned status ${response.status}`)
      return false
    }
    
    const data = await response.json()
    const models = data.data || []
    
    console.log(`✅ LMStudio is running with ${models.length} model(s) loaded:`)
    models.forEach((model: any) => {
      console.log(`   - ${model.id}`)
    })
    
    // Check for gpt-oss:20b specifically
    const hasTargetModel = models.some((m: any) => 
      m.id === 'gpt-oss:20b' || m.id.includes('gpt-oss')
    )
    
    if (!hasTargetModel) {
      console.warn(`\n⚠️  Warning: gpt-oss:20b model not found in LMStudio`)
      console.warn(`   Please load the model in LMStudio for best results`)
    }
    
    return true
  } catch (error) {
    console.error(`❌ Failed to connect to LMStudio:`, error)
    return false
  }
}

async function runTests() {
  console.log('\n🧪 Running Local AI Model Tests')
  console.log('================================\n')
  
  const env = {
    LMSTUDIO_BASE_URL: LMSTUDIO_URL,
    NODE_ENV: 'test',
    ...(useMock ? { SKIP_LMSTUDIO_TESTS: 'true' } : {})
  }
  
  const tests = [
    {
      name: 'File Summarization Tests',
      command: 'bun test packages/services/src/tests/file-summarization.test.ts --timeout 30000'
    },
    {
      name: 'E2E Workflow Tests',
      command: 'bun test packages/services/src/tests/e2e/summarization-workflow.test.ts --timeout 90000'
    }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    console.log(`\n📋 ${test.name}`)
    console.log('─'.repeat(40))
    
    try {
      await $`${test.command}`.env(env)
      console.log(`✅ ${test.name} passed`)
      passed++
    } catch (error) {
      console.error(`❌ ${test.name} failed`)
      failed++
    }
  }
  
  console.log('\n' + '='.repeat(40))
  console.log('📊 Test Results Summary')
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📈 Total: ${passed + failed}`)
  
  return failed === 0
}

async function main() {
  try {
    // Check LMStudio connection
    const isConnected = await checkLMStudioConnection()
    
    if (checkOnly) {
      process.exit(isConnected ? 0 : 1)
    }
    
    if (!isConnected && !useMock) {
      console.log('\n⚠️  LMStudio is not available')
      console.log('   Options:')
      console.log('   1. Start LMStudio and load the gpt-oss:20b model')
      console.log('   2. Run with mock responses: bun run test-local-models.ts --mock')
      console.log('   3. Set LMSTUDIO_BASE_URL to a different address')
      process.exit(1)
    }
    
    if (useMock) {
      console.log('\n🎭 Running tests with mock responses (no LMStudio required)')
    }
    
    // Run the tests
    const success = await runTests()
    
    if (success) {
      console.log('\n✨ All tests passed!')
    } else {
      console.log('\n💥 Some tests failed')
    }
    
    process.exit(success ? 0 : 1)
    
  } catch (error) {
    console.error('\n🔥 Unexpected error:', error)
    process.exit(1)
  }
}

// Run the script
main()