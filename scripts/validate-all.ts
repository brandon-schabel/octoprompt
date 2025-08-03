#!/usr/bin/env bun
/**
 * Comprehensive validation script for CI/CD
 * Runs all tests and type checks across the codebase
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface ValidationResult {
  name: string
  command: string
  success: boolean
  duration: number
  output?: string
  error?: string
}

const validations: { name: string; command: string }[] = [
  // Type checking
  { name: 'TypeCheck: API Client', command: 'bun run typecheck:api-client' },
  { name: 'TypeCheck: Config', command: 'bun run typecheck:config' },
  { name: 'TypeCheck: Schemas', command: 'bun run typecheck:schemas' },
  { name: 'TypeCheck: Shared', command: 'bun run typecheck:shared' },
  { name: 'TypeCheck: Services', command: 'bun run typecheck:services' },
  { name: 'TypeCheck: Storage', command: 'bun run typecheck:storage' },
  { name: 'TypeCheck: Server', command: 'bun run typecheck:server' },
  { name: 'TypeCheck: Client', command: 'bun run typecheck:client' },
  { name: 'TypeCheck: Website', command: 'bun run typecheck:website' },

  // Unit tests
  { name: 'Test: Config', command: 'bun run test:config' },
  { name: 'Test: Shared', command: 'bun run test:shared' },
  { name: 'Test: Schemas', command: 'bun run test:schemas' },
  { name: 'Test: Services', command: 'bun run test:services' },
  { name: 'Test: Storage', command: 'bun run test:storage' },
  { name: 'Test: API Client', command: 'bun run test:api-client' },
  // Note: Server has no tests yet
  // { name: 'Test: Server', command: 'bun run test:server' },

  // Formatting check
  { name: 'Format Check', command: 'prettier --check .' }
]

async function runValidation(validation: { name: string; command: string }): Promise<ValidationResult> {
  const startTime = Date.now()
  try {
    const { stdout } = await execAsync(validation.command)
    return {
      name: validation.name,
      command: validation.command,
      success: true,
      duration: Date.now() - startTime,
      output: stdout
    }
  } catch (error: any) {
    return {
      name: validation.name,
      command: validation.command,
      success: false,
      duration: Date.now() - startTime,
      error: error.message || error.toString()
    }
  }
}

async function main() {
  console.log('🔍 Running comprehensive validation...\n')

  const results: ValidationResult[] = []

  // Run validations sequentially to avoid resource conflicts
  for (const validation of validations) {
    process.stdout.write(`Running ${validation.name}... `)
    const result = await runValidation(validation)
    results.push(result)

    if (result.success) {
      console.log(`✅ (${result.duration}ms)`)
    } else {
      console.log(`❌ (${result.duration}ms)`)
    }
  }

  // Summary
  console.log('\n📊 Validation Summary')
  console.log('='.repeat(50))

  const passed = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log(`Total: ${results.length}`)
  console.log(`Passed: ${passed.length} ✅`)
  console.log(`Failed: ${failed.length} ❌`)

  if (failed.length > 0) {
    console.log('\n❌ Failed validations:')
    failed.forEach((result) => {
      console.log(`\n${result.name} (${result.command})`)
      if (result.error) {
        console.log(result.error.substring(0, 500) + '...')
      }
    })
  }

  // Exit with appropriate code
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Validation script failed:', error)
  process.exit(1)
})
