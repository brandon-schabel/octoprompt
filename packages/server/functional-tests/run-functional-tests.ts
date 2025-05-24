#!/usr/bin/env bun

// Script to run the project API tests with proper environment setup

import { $ } from 'bun'

// const API_URL = process.env.API_URL || 'http://localhost:3000'
const API_URL = 'http://localhost:3000'

console.log('🧪 Running Project API Tests')
console.log(`📍 API URL: ${API_URL}`)
console.log('─'.repeat(50))

try {
    // Run the tests
    await $`bun test projects-api.test.ts --timeout 30000`

    console.log('\n✅ All tests completed successfully!')
} catch (error) {
    console.error('\n❌ Tests failed:', error)
    process.exit(1)
}