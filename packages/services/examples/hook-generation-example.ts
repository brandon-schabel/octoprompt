/**
 * Example usage of the AI-powered hook generation feature
 */

import { claudeHookService } from '../src/claude-hook-service'
import type { HookGenerationContext } from '../src/claude-hook-service'

async function generateHookExamples() {
  console.log('🎯 Generating Claude Code hooks from natural language descriptions...\n')

  // Example 1: Auto-save hook
  try {
    console.log('1. Creating auto-save hook...')
    const autoSaveHook = await claudeHookService.generateHookFromDescription(
      'automatically save and commit changes after editing files'
    )

    console.log('Generated hook:')
    console.log(`  Event: ${autoSaveHook.event}`)
    console.log(`  Matcher: ${autoSaveHook.matcher}`)
    console.log(`  Command: ${autoSaveHook.hookConfig.command}`)
    console.log(`  Description: ${autoSaveHook.description}`)
    console.log(`  Background: ${autoSaveHook.hookConfig.run_in_background}`)
    console.log()
  } catch (error) {
    console.error('Failed to generate auto-save hook:', error)
  }

  // Example 2: Test runner hook with context
  try {
    console.log('2. Creating test runner hook with context...')
    const context: HookGenerationContext = {
      projectPath: '/my/typescript/project',
      suggestedEvent: 'PreToolUse',
      examples: ['npm test', 'npm run test:unit', 'git commit -m "feat: add feature"']
    }

    const testHook = await claudeHookService.generateHookFromDescription(
      'run unit tests before allowing git commits',
      context
    )

    console.log('Generated hook:')
    console.log(`  Event: ${testHook.event}`)
    console.log(`  Matcher: ${testHook.matcher}`)
    console.log(`  Command: ${testHook.hookConfig.command}`)
    console.log(`  Description: ${testHook.description}`)
    console.log(`  Timeout: ${testHook.hookConfig.timeout}s`)
    if (testHook.security_warnings?.length) {
      console.log(`  ⚠️  Warnings: ${testHook.security_warnings.join(', ')}`)
    }
    console.log()
  } catch (error) {
    console.error('Failed to generate test runner hook:', error)
  }

  // Example 3: Session logging hook
  try {
    console.log('3. Creating session logging hook...')
    const loggingHook = await claudeHookService.generateHookFromDescription(
      'log all Claude Code sessions with timestamp and duration to a file'
    )

    console.log('Generated hook:')
    console.log(`  Event: ${loggingHook.event}`)
    console.log(`  Matcher: ${loggingHook.matcher}`)
    console.log(`  Command: ${loggingHook.hookConfig.command}`)
    console.log(`  Description: ${loggingHook.description}`)
    console.log()
  } catch (error) {
    console.error('Failed to generate logging hook:', error)
  }

  // Example 4: Linting hook
  try {
    console.log('4. Creating linting hook...')
    const lintHook = await claudeHookService.generateHookFromDescription(
      'automatically fix eslint issues after editing JavaScript or TypeScript files'
    )

    console.log('Generated hook:')
    console.log(`  Event: ${lintHook.event}`)
    console.log(`  Matcher: ${lintHook.matcher}`)
    console.log(`  Command: ${lintHook.hookConfig.command}`)
    console.log(`  Description: ${lintHook.description}`)
    console.log(`  Background: ${lintHook.hookConfig.run_in_background}`)
    console.log()
  } catch (error) {
    console.error('Failed to generate linting hook:', error)
  }

  // Example 5: Security check hook
  try {
    console.log('5. Creating security check hook...')
    const securityHook = await claudeHookService.generateHookFromDescription(
      'prevent deletion of important system files or directories'
    )

    console.log('Generated hook:')
    console.log(`  Event: ${securityHook.event}`)
    console.log(`  Matcher: ${securityHook.matcher}`)
    console.log(`  Command: ${securityHook.hookConfig.command}`)
    console.log(`  Description: ${securityHook.description}`)
    if (securityHook.security_warnings?.length) {
      console.log(`  ⚠️  Warnings: ${securityHook.security_warnings.join(', ')}`)
    }
    console.log()
  } catch (error) {
    console.error('Failed to generate security hook:', error)
  }
}

// Run examples if this file is executed directly
if (import.meta.main) {
  generateHookExamples()
}
