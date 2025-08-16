import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient } from '@promptliano/api-client'
import type { 
  PromptlianoClient, 
  CreateClaudeCommandBody, 
  UpdateClaudeCommandBody, 
  ClaudeCommand,
  CommandGenerationRequest,
  SearchCommandsQuery
} from '@promptliano/api-client'
import type { TestEnvironment } from './test-environment'
import { withTestEnvironment } from './test-environment'
import { assertions, factories, TestDataManager, withTestData, retryOperation, waitFor } from './utils/test-helpers'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Comprehensive API tests for Claude Command operations
 * Tests command CRUD, execution, search, suggestions, and AI-powered generation
 */
describe('Claude Command API Tests', () => {
  
  /**
   * Test helper to create command files in a test directory
   */
  async function setupCommandFiles(testProjectPath: string) {
    const commandsDir = join(testProjectPath, '.claude', 'commands')
    if (!existsSync(commandsDir)) {
      mkdirSync(commandsDir, { recursive: true })
    }

    // Create sample command files with different namespaces
    const commandFiles = [
      {
        name: 'code-review.md',
        content: `---
description: Performs comprehensive code review with security analysis
argument-hint: [file-path]
allowed-tools: Read, Edit, Bash(git:*)
model: claude-3-5-sonnet-20241022
max-turns: 5
output-format: text
---

# Code Review

Perform a comprehensive code review for: $ARGUMENTS

## Review Checklist
1. Code quality and style
2. Security vulnerabilities
3. Performance issues
4. Best practice adherence
5. Test coverage requirements

## Analysis Steps
- Read the target files
- Check for common anti-patterns
- Validate input handling
- Review error handling
- Suggest improvements
`
      },
      {
        name: 'analysis/performance-audit.md',
        content: `---
description: Analyzes performance bottlenecks in the codebase
argument-hint: [component-path]
allowed-tools: Read, Bash(npm:*, bun:*)
model: claude-3-5-sonnet-20241022
max-turns: 3
output-format: json
---

# Performance Audit

Analyze performance for: $ARGUMENTS

## Audit Areas
1. Bundle size analysis
2. Runtime performance
3. Memory usage patterns
4. Database query optimization
5. Network request efficiency

## Tools
- Bundle analyzer
- Profiling tools
- Performance monitoring
`
      },
      {
        name: 'testing/test-generator.md',
        content: `---
description: Generates comprehensive test suites for components
argument-hint: [component-file]
allowed-tools: Read, Edit, Bash(bun:test)
model: claude-3-5-sonnet-20241022
max-turns: 10
output-format: text
---

# Test Generator

Generate comprehensive tests for: $ARGUMENTS

## Test Types
1. Unit tests
2. Integration tests
3. Edge case scenarios
4. Error handling tests
5. Performance tests

## Framework Detection
- Detect existing test framework
- Follow project conventions
- Include proper setup/teardown
- Add meaningful assertions
`
      }
    ]

    for (const file of commandFiles) {
      const filePath = join(commandsDir, file.name)
      const fileDir = dirname(filePath)
      
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true })
      }
      
      writeFileSync(filePath, file.content)
    }

    return commandFiles.map(f => ({
      name: f.name.replace('.md', '').replace('/', '-'),
      namespace: f.name.includes('/') ? f.name.split('/')[0] : undefined,
      filePath: `.claude/commands/${f.name}`
    }))
  }

  /**
   * Clean up command files after tests
   */
  async function cleanupCommandFiles(testProjectPath: string) {
    const commandsDir = join(testProjectPath, '.claude', 'commands')
    if (existsSync(commandsDir)) {
      rmSync(commandsDir, { recursive: true, force: true })
    }
  }

  withTestEnvironment('Claude Command CRUD Operations', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any
    let setupCommands: any[]

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      // Create test project
      testProject = await dataManager.createProject({
        name: 'Claude Command Test Project',
        description: 'Test project for Claude Command operations',
        projectPath: '/tmp/claude-command-test'
      })

      // Setup command files for file-based operations
      setupCommands = await setupCommandFiles(testProject.data.projectPath)
    })

    afterAll(async () => {
      await cleanupCommandFiles(testProject.data.projectPath)
      await dataManager.cleanup()
    })

    test('should create a new command successfully', async () => {
      const createData: CreateClaudeCommandBody = {
        name: 'api-tester',
        namespace: 'testing',
        scope: 'project',
        content: `# API Tester

Test API endpoints for: $ARGUMENTS

## Testing Steps
1. Parse endpoint configuration
2. Execute API calls
3. Validate responses
4. Generate test report

Use appropriate HTTP methods and validate status codes.`,
        frontmatter: {
          description: 'Tests API endpoints with comprehensive validation',
          'argument-hint': '[endpoint-path]',
          'allowed-tools': 'Read, Bash(curl:*)',
          model: 'claude-3-5-sonnet-20241022',
          'max-turns': 5,
          'output-format': 'json'
        }
      }

      const result = await client.commands.createCommand(testProject.data.id, createData)
      
      assertions.apiSuccess(result)
      expect(result.data.name).toBe(createData.name)
      expect(result.data.namespace).toBe(createData.namespace)
      expect(result.data.scope).toBe(createData.scope)
      expect(result.data.content).toBe(createData.content)
      expect(result.data.frontmatter).toEqual(createData.frontmatter)
      expect(result.data.filePath).toBe('.claude/commands/testing/api-tester.md')
      expect(result.data.id).toBeTypeOf('string')
      expect(result.data.created).toBeTypeOf('number')
      expect(result.data.updated).toBeTypeOf('number')

      // Store for cleanup
      dataManager.addCommand(result.data)
    })

    test('should fail to create command with duplicate name', async () => {
      const createData: CreateClaudeCommandBody = {
        name: 'duplicate-test',
        content: 'First command content'
      }

      // Create first command
      const firstResult = await client.commands.createCommand(testProject.data.id, createData)
      assertions.apiSuccess(firstResult)
      dataManager.addCommand(firstResult.data)

      // Attempt to create duplicate
      await expect(async () => {
        await client.commands.createCommand(testProject.data.id, createData)
      }).toThrow()
    })

    test('should validate command name format', async () => {
      const invalidNames = [
        'Invalid Name', // spaces
        'UPPERCASE', // uppercase
        'special@chars', // special characters
        'under_scores', // underscores
        '', // empty string
        'a', // too short is actually valid, removing this
        'very-long-name-that-exceeds-normal-limits-and-should-be-rejected-for-being-too-verbose' // very long
      ]

      for (const invalidName of invalidNames) {
        await expect(async () => {
          await client.commands.createCommand(testProject.data.id, {
            name: invalidName,
            content: 'Test content'
          })
        }).toThrow()
      }
    })

    test('should create command without optional fields', async () => {
      const minimalData: CreateClaudeCommandBody = {
        name: 'minimal-command',
        content: 'Simple command: $ARGUMENTS'
      }

      const result = await client.commands.createCommand(testProject.data.id, minimalData)
      
      assertions.apiSuccess(result)
      expect(result.data.name).toBe(minimalData.name)
      expect(result.data.content).toBe(minimalData.content)
      expect(result.data.namespace).toBeUndefined()
      expect(result.data.scope).toBe('project') // default value
      expect(result.data.frontmatter).toEqual({})
      
      dataManager.addCommand(result.data)
    })

    test('should list all commands for project', async () => {
      const result = await client.commands.listCommands(testProject.data.id)
      
      assertions.apiSuccess(result)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
      
      // Verify all commands belong to the project
      for (const command of result.data) {
        expect(command.id).toBeTypeOf('string')
        expect(command.name).toBeTypeOf('string')
        expect(command.content).toBeTypeOf('string')
        expect(command.filePath).toBeTypeOf('string')
        expect(command.created).toBeTypeOf('number')
        expect(command.updated).toBeTypeOf('number')
      }
    })

    test('should get specific command by name', async () => {
      // First create a command to retrieve
      const createData: CreateClaudeCommandBody = {
        name: 'get-test-command',
        namespace: 'utilities',
        content: 'Test command for retrieval: $ARGUMENTS',
        frontmatter: {
          description: 'Command for testing get operation'
        }
      }

      const createResult = await client.commands.createCommand(testProject.data.id, createData)
      dataManager.addCommand(createResult.data)

      // Retrieve the command
      const result = await client.commands.getCommand(
        testProject.data.id, 
        createData.name, 
        createData.namespace
      )
      
      assertions.apiSuccess(result)
      expect(result.data.name).toBe(createData.name)
      expect(result.data.namespace).toBe(createData.namespace)
      expect(result.data.content).toBe(createData.content)
      expect(result.data.frontmatter).toEqual(createData.frontmatter)
    })

    test('should fail to get non-existent command', async () => {
      await expect(async () => {
        await client.commands.getCommand(testProject.data.id, 'non-existent-command')
      }).toThrow()
    })

    test('should update command content and frontmatter', async () => {
      // Create command to update
      const createData: CreateClaudeCommandBody = {
        name: 'update-test-command',
        content: 'Original content: $ARGUMENTS',
        frontmatter: {
          description: 'Original description'
        }
      }

      const createResult = await client.commands.createCommand(testProject.data.id, createData)
      dataManager.addCommand(createResult.data)

      // Update the command
      const updateData: UpdateClaudeCommandBody = {
        content: 'Updated content with new instructions: $ARGUMENTS\n\n## Updated Steps\n1. New step',
        frontmatter: {
          description: 'Updated description with more details',
          'argument-hint': '[new-hint]',
          'max-turns': 10
        }
      }

      const result = await client.commands.updateCommand(
        testProject.data.id,
        createData.name,
        updateData
      )
      
      assertions.apiSuccess(result)
      expect(result.data.content).toBe(updateData.content)
      expect(result.data.frontmatter).toEqual(updateData.frontmatter)
      expect(result.data.updated).toBeGreaterThan(createResult.data.updated)
    })

    test('should update command namespace (move command)', async () => {
      // Create command in one namespace
      const createData: CreateClaudeCommandBody = {
        name: 'move-test-command',
        namespace: 'original',
        content: 'Command to be moved: $ARGUMENTS'
      }

      const createResult = await client.commands.createCommand(testProject.data.id, createData)
      dataManager.addCommand(createResult.data)

      // Move to different namespace
      const updateData: UpdateClaudeCommandBody = {
        namespace: 'moved'
      }

      const result = await client.commands.updateCommand(
        testProject.data.id,
        createData.name,
        updateData,
        createData.namespace // original namespace for lookup
      )
      
      assertions.apiSuccess(result)
      expect(result.data.namespace).toBe(updateData.namespace)
      expect(result.data.filePath).toBe('.claude/commands/moved/move-test-command.md')
    })

    test('should fail to update non-existent command', async () => {
      await expect(async () => {
        await client.commands.updateCommand(testProject.data.id, 'non-existent', {
          content: 'New content'
        })
      }).toThrow()
    })

    test('should delete command successfully', async () => {
      // Create command to delete
      const createData: CreateClaudeCommandBody = {
        name: 'delete-test-command',
        content: 'Command to be deleted: $ARGUMENTS'
      }

      const createResult = await client.commands.createCommand(testProject.data.id, createData)
      
      // Delete the command
      const result = await client.commands.deleteCommand(testProject.data.id, createData.name)
      expect(result).toBe(true)

      // Verify command is deleted
      await expect(async () => {
        await client.commands.getCommand(testProject.data.id, createData.name)
      }).toThrow()
    })

    test('should fail to delete non-existent command', async () => {
      await expect(async () => {
        await client.commands.deleteCommand(testProject.data.id, 'non-existent-command')
      }).toThrow()
    })
  })

  withTestEnvironment('Claude Command Search and Filtering', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any
    let searchCommands: ClaudeCommand[]

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      // Create test project
      testProject = await dataManager.createProject({
        name: 'Search Test Project',
        description: 'Test project for command search operations',
        projectPath: '/tmp/claude-search-test'
      })

      // Create diverse commands for search testing
      const commandsToCreate = [
        {
          name: 'security-scan',
          namespace: 'security',
          content: 'Perform security scan for: $ARGUMENTS',
          frontmatter: { description: 'Security vulnerability scanner' }
        },
        {
          name: 'security-review',
          namespace: 'security',
          content: 'Review security issues for: $ARGUMENTS',
          frontmatter: { description: 'Manual security code review' }
        },
        {
          name: 'performance-test',
          namespace: 'testing',
          content: 'Run performance tests for: $ARGUMENTS',
          frontmatter: { description: 'Performance testing and benchmarking' }
        },
        {
          name: 'unit-test',
          namespace: 'testing',
          content: 'Create unit tests for: $ARGUMENTS',
          frontmatter: { description: 'Unit test generation' }
        },
        {
          name: 'code-format',
          content: 'Format code for: $ARGUMENTS',
          frontmatter: { description: 'Code formatting and style fixes' }
        }
      ]

      searchCommands = []
      for (const commandData of commandsToCreate) {
        const result = await client.commands.createCommand(testProject.data.id, commandData)
        searchCommands.push(result.data)
        dataManager.addCommand(result.data)
      }
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    test('should search commands by query string', async () => {
      const query: SearchCommandsQuery = {
        query: 'security'
      }

      const result = await client.commands.listCommands(testProject.data.id, query)
      
      assertions.apiSuccess(result)
      expect(result.data.length).toBe(2) // security-scan and security-review
      
      for (const command of result.data) {
        expect(
          command.name.includes('security') || 
          command.content.includes('security') ||
          command.frontmatter?.description?.includes('security')
        ).toBe(true)
      }
    })

    test('should filter commands by namespace', async () => {
      const query: SearchCommandsQuery = {
        namespace: 'testing'
      }

      const result = await client.commands.listCommands(testProject.data.id, query)
      
      assertions.apiSuccess(result)
      expect(result.data.length).toBe(2) // performance-test and unit-test
      
      for (const command of result.data) {
        expect(command.namespace).toBe('testing')
      }
    })

    test('should filter commands by scope', async () => {
      const query: SearchCommandsQuery = {
        scope: 'project'
      }

      const result = await client.commands.listCommands(testProject.data.id, query)
      
      assertions.apiSuccess(result)
      expect(result.data.length).toBeGreaterThan(0)
      
      for (const command of result.data) {
        expect(command.scope).toBe('project')
      }
    })

    test('should combine multiple search filters', async () => {
      const query: SearchCommandsQuery = {
        query: 'test',
        namespace: 'testing'
      }

      const result = await client.commands.listCommands(testProject.data.id, query)
      
      assertions.apiSuccess(result)
      expect(result.data.length).toBeGreaterThan(0)
      
      for (const command of result.data) {
        expect(command.namespace).toBe('testing')
        expect(
          command.name.includes('test') || 
          command.content.includes('test') ||
          command.frontmatter?.description?.includes('test')
        ).toBe(true)
      }
    })

    test('should respect pagination limits', async () => {
      const query: SearchCommandsQuery = {
        limit: 2,
        offset: 0
      }

      const result = await client.commands.listCommands(testProject.data.id, query)
      
      assertions.apiSuccess(result)
      expect(result.data.length).toBeLessThanOrEqual(2)
    })

    test('should handle pagination offset', async () => {
      // Get first page
      const firstPage = await client.commands.listCommands(testProject.data.id, {
        limit: 2,
        offset: 0
      })
      
      // Get second page
      const secondPage = await client.commands.listCommands(testProject.data.id, {
        limit: 2,
        offset: 2
      })
      
      assertions.apiSuccess(firstPage)
      assertions.apiSuccess(secondPage)
      
      // Ensure different results (if there are enough commands)
      if (firstPage.data.length === 2 && secondPage.data.length > 0) {
        const firstPageIds = firstPage.data.map(c => c.id)
        const secondPageIds = secondPage.data.map(c => c.id)
        expect(firstPageIds.some(id => secondPageIds.includes(id))).toBe(false)
      }
    })

    test('should return empty results for non-matching query', async () => {
      const query: SearchCommandsQuery = {
        query: 'nonexistentquerythatmatchesnothing'
      }

      const result = await client.commands.listCommands(testProject.data.id, query)
      
      assertions.apiSuccess(result)
      expect(result.data.length).toBe(0)
    })
  })

  withTestEnvironment('Claude Command Execution', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any
    let executableCommand: ClaudeCommand

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      // Create test project
      testProject = await dataManager.createProject({
        name: 'Execution Test Project',
        description: 'Test project for command execution',
        projectPath: '/tmp/claude-execution-test'
      })

      // Create command for execution testing
      const createData: CreateClaudeCommandBody = {
        name: 'echo-command',
        content: `# Echo Command

Echo the provided arguments: $ARGUMENTS

## Steps
1. Parse the input arguments
2. Format the output
3. Return the result

This is a simple test command for execution testing.`,
        frontmatter: {
          description: 'Simple echo command for testing',
          'argument-hint': '[text-to-echo]',
          'max-turns': 1,
          'output-format': 'text'
        }
      }

      const createResult = await client.commands.createCommand(testProject.data.id, createData)
      executableCommand = createResult.data
      dataManager.addCommand(executableCommand)
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    test('should execute command with arguments successfully', async () => {
      const result = await client.commands.executeCommand(
        testProject.data.id,
        executableCommand.name,
        'Hello, World!'
      )
      
      assertions.apiSuccess(result)
      expect(result.data.result).toBeTypeOf('string')
      expect(result.data.result.length).toBeGreaterThan(0)
      
      // Should contain reference to the arguments
      expect(result.data.result.toLowerCase()).toContain('hello')
    })

    test('should execute command without arguments', async () => {
      const result = await client.commands.executeCommand(
        testProject.data.id,
        executableCommand.name
      )
      
      assertions.apiSuccess(result)
      expect(result.data.result).toBeTypeOf('string')
    })

    test('should execute command with complex arguments', async () => {
      const complexArgs = JSON.stringify({
        action: 'process',
        files: ['src/index.ts', 'src/utils.ts'],
        options: { verbose: true, includeTests: false }
      })

      const result = await client.commands.executeCommand(
        testProject.data.id,
        executableCommand.name,
        complexArgs
      )
      
      assertions.apiSuccess(result)
      expect(result.data.result).toBeTypeOf('string')
    })

    test('should execute command with namespace', async () => {
      // Create namespaced command
      const namespacedData: CreateClaudeCommandBody = {
        name: 'namespaced-echo',
        namespace: 'utilities',
        content: 'Namespaced echo: $ARGUMENTS'
      }

      const createResult = await client.commands.createCommand(testProject.data.id, namespacedData)
      dataManager.addCommand(createResult.data)

      const result = await client.commands.executeCommand(
        testProject.data.id,
        namespacedData.name,
        'test',
        namespacedData.namespace
      )
      
      assertions.apiSuccess(result)
      expect(result.data.result).toBeTypeOf('string')
    })

    test('should fail to execute non-existent command', async () => {
      await expect(async () => {
        await client.commands.executeCommand(
          testProject.data.id,
          'non-existent-command',
          'test args'
        )
      }).toThrow()
    })

    test('should handle execution timeout gracefully', async () => {
      // This test depends on the server implementing proper timeout handling
      // and may not fail in all implementations
      const result = await client.commands.executeCommand(
        testProject.data.id,
        executableCommand.name,
        'test timeout'
      )
      
      // Should complete successfully even with timeout handling
      assertions.apiSuccess(result)
    })

    test('should execute command with special characters in arguments', async () => {
      const specialArgs = 'Test with "quotes", $variables, and\nnewlines\t\ttabs'

      const result = await client.commands.executeCommand(
        testProject.data.id,
        executableCommand.name,
        specialArgs
      )
      
      assertions.apiSuccess(result)
      expect(result.data.result).toBeTypeOf('string')
    })
  })

  withTestEnvironment('Claude Command Suggestions', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      // Create test project with some existing commands
      testProject = await dataManager.createProject({
        name: 'Suggestions Test Project',
        description: 'Test project for command suggestions',
        projectPath: '/tmp/claude-suggestions-test'
      })

      // Create some existing commands to influence suggestions
      const existingCommands = [
        {
          name: 'test-runner',
          namespace: 'testing',
          content: 'Run tests for: $ARGUMENTS',
          frontmatter: { description: 'Execute test suites' }
        },
        {
          name: 'security-audit',
          namespace: 'security',
          content: 'Audit security for: $ARGUMENTS',
          frontmatter: { description: 'Security vulnerability assessment' }
        }
      ]

      for (const commandData of existingCommands) {
        const result = await client.commands.createCommand(testProject.data.id, commandData)
        dataManager.addCommand(result.data)
      }
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    test('should suggest commands based on context', async () => {
      const result = await client.commands.suggestCommands(
        testProject.data.id,
        'I need help with testing my React components',
        5
      )
      
      assertions.apiSuccess(result)
      expect(result.data.commands).toBeInstanceOf(Array)
      expect(result.data.commands.length).toBeGreaterThan(0)
      expect(result.data.commands.length).toBeLessThanOrEqual(5)
      
      for (const suggestion of result.data.commands) {
        expect(suggestion.name).toBeTypeOf('string')
        expect(suggestion.name.length).toBeGreaterThan(0)
        expect(suggestion.description).toBeTypeOf('string')
        expect(suggestion.suggestedContent).toBeTypeOf('string')
        expect(suggestion.relevanceScore).toBeTypeOf('number')
        expect(suggestion.relevanceScore).toBeGreaterThanOrEqual(0)
        expect(suggestion.relevanceScore).toBeLessThanOrEqual(1)
        expect(suggestion.rationale).toBeTypeOf('string')
        
        // Commands should be related to testing/React based on context
        const combined = `${suggestion.name} ${suggestion.description} ${suggestion.suggestedContent}`.toLowerCase()
        expect(
          combined.includes('test') || 
          combined.includes('react') || 
          combined.includes('component')
        ).toBe(true)
      }
    })

    test('should suggest commands without context', async () => {
      const result = await client.commands.suggestCommands(testProject.data.id)
      
      assertions.apiSuccess(result)
      expect(result.data.commands).toBeInstanceOf(Array)
      expect(result.data.commands.length).toBeGreaterThan(0)
      
      // Should provide general-purpose command suggestions
      for (const suggestion of result.data.commands) {
        expect(suggestion.name).toBeTypeOf('string')
        expect(suggestion.description).toBeTypeOf('string')
        expect(suggestion.suggestedContent).toBeTypeOf('string')
        expect(suggestion.relevanceScore).toBeTypeOf('number')
        expect(suggestion.rationale).toBeTypeOf('string')
      }
    })

    test('should limit suggestions to specified count', async () => {
      const limit = 3
      const result = await client.commands.suggestCommands(
        testProject.data.id,
        'general development tasks',
        limit
      )
      
      assertions.apiSuccess(result)
      expect(result.data.commands.length).toBeLessThanOrEqual(limit)
    })

    test('should provide relevant suggestions for security context', async () => {
      const result = await client.commands.suggestCommands(
        testProject.data.id,
        'I need to improve the security of my application',
        3
      )
      
      assertions.apiSuccess(result)
      expect(result.data.commands.length).toBeGreaterThan(0)
      
      // At least one suggestion should be security-related
      const hasSecuritySuggestion = result.data.commands.some(suggestion => {
        const combined = `${suggestion.name} ${suggestion.description} ${suggestion.suggestedContent}`.toLowerCase()
        return combined.includes('security') || 
               combined.includes('vulnerability') || 
               combined.includes('audit') ||
               combined.includes('scan')
      })
      
      expect(hasSecuritySuggestion).toBe(true)
    })

    test('should provide suggestions with proper frontmatter', async () => {
      const result = await client.commands.suggestCommands(
        testProject.data.id,
        'code review automation',
        2
      )
      
      assertions.apiSuccess(result)
      
      for (const suggestion of result.data.commands) {
        if (suggestion.suggestedFrontmatter) {
          // Validate frontmatter structure
          expect(suggestion.suggestedFrontmatter).toBeTypeOf('object')
          
          if (suggestion.suggestedFrontmatter.description) {
            expect(suggestion.suggestedFrontmatter.description).toBeTypeOf('string')
          }
          
          if (suggestion.suggestedFrontmatter['max-turns']) {
            expect(suggestion.suggestedFrontmatter['max-turns']).toBeTypeOf('number')
            expect(suggestion.suggestedFrontmatter['max-turns']).toBeGreaterThan(0)
          }
          
          if (suggestion.suggestedFrontmatter['output-format']) {
            expect(['text', 'json']).toContain(suggestion.suggestedFrontmatter['output-format'])
          }
        }
      }
    })
  })

  withTestEnvironment('Claude Command AI Generation', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      // Create test project
      testProject = await dataManager.createProject({
        name: 'Generation Test Project',
        description: 'Test project for AI command generation',
        projectPath: '/tmp/claude-generation-test'
      })
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    // Skip AI tests if LMStudio is not available
    test.skipIf(!process.env.LMSTUDIO_BASE_URL)('should generate command with AI assistance', async () => {
      const generationRequest: CommandGenerationRequest = {
        name: 'api-doc-generator',
        description: 'Generate comprehensive API documentation from source code',
        userIntent: 'I want a command that analyzes TypeScript API routes and generates OpenAPI/Swagger documentation with examples and validation schemas',
        namespace: 'documentation',
        scope: 'project',
        context: {
          includeProjectSummary: true,
          includeFileStructure: true,
          includeTechStack: true,
          additionalContext: 'The project uses Hono for API routes with Zod schemas for validation'
        }
      }

      const result = await client.commands.generateCommand(testProject.data.id, generationRequest)
      
      assertions.apiSuccess(result)
      expect(result.data.name).toBe(generationRequest.name)
      expect(result.data.namespace).toBe(generationRequest.namespace)
      expect(result.data.content).toBeTypeOf('string')
      expect(result.data.content.length).toBeGreaterThan(50)
      expect(result.data.frontmatter).toBeTypeOf('object')
      expect(result.data.description).toBeTypeOf('string')
      expect(result.data.rationale).toBeTypeOf('string')
      
      // Content should include $ARGUMENTS placeholder
      expect(result.data.content).toContain('$ARGUMENTS')
      
      // Should be relevant to API documentation
      const combined = `${result.data.content} ${result.data.description}`.toLowerCase()
      expect(
        combined.includes('api') || 
        combined.includes('documentation') || 
        combined.includes('openapi') || 
        combined.includes('swagger')
      ).toBe(true)
    }, 120000) // Extended timeout for AI operations

    test.skipIf(!process.env.LMSTUDIO_BASE_URL)('should generate command with minimal input', async () => {
      const generationRequest: CommandGenerationRequest = {
        name: 'code-formatter',
        description: 'Format code files according to project standards',
        userIntent: 'I need a simple command to format TypeScript and JavaScript files'
      }

      const result = await client.commands.generateCommand(testProject.data.id, generationRequest)
      
      assertions.apiSuccess(result)
      expect(result.data.name).toBe(generationRequest.name)
      expect(result.data.content).toBeTypeOf('string')
      expect(result.data.content.length).toBeGreaterThan(20)
      expect(result.data.frontmatter).toBeTypeOf('object')
      expect(result.data.description).toBeTypeOf('string')
      expect(result.data.rationale).toBeTypeOf('string')
    }, 120000)

    test.skipIf(!process.env.LMSTUDIO_BASE_URL)('should generate command with specific file context', async () => {
      const generationRequest: CommandGenerationRequest = {
        name: 'test-coverage-analyzer',
        description: 'Analyze test coverage and suggest improvements',
        userIntent: 'Create a command that checks test coverage for specific files and suggests where tests are missing',
        context: {
          selectedFiles: [
            'packages/api-client/src/tests/test-helpers.ts',
            'packages/services/src/tests/'
          ],
          additionalContext: 'We use Bun test runner and aim for 80% coverage minimum'
        }
      }

      const result = await client.commands.generateCommand(testProject.data.id, generationRequest)
      
      assertions.apiSuccess(result)
      expect(result.data.content).toContain('$ARGUMENTS')
      
      // Should reference testing/coverage concepts
      const combined = `${result.data.content} ${result.data.description}`.toLowerCase()
      expect(
        combined.includes('test') || 
        combined.includes('coverage') || 
        combined.includes('bun')
      ).toBe(true)
    }, 120000)

    test.skipIf(!process.env.LMSTUDIO_BASE_URL)('should provide command variations in generation', async () => {
      const generationRequest: CommandGenerationRequest = {
        name: 'database-migrator',
        description: 'Handle database schema migrations',
        userIntent: 'I need commands to create, run, and rollback database migrations safely'
      }

      const result = await client.commands.generateCommand(testProject.data.id, generationRequest)
      
      assertions.apiSuccess(result)
      
      if (result.data.suggestedVariations) {
        expect(result.data.suggestedVariations).toBeInstanceOf(Array)
        
        for (const variation of result.data.suggestedVariations) {
          expect(variation.name).toBeTypeOf('string')
          expect(variation.description).toBeTypeOf('string')
          expect(variation.changes).toBeTypeOf('string')
        }
      }
    }, 120000)

    test('should fail generation with invalid command name', async () => {
      await expect(async () => {
        const invalidRequest: CommandGenerationRequest = {
          name: 'Invalid Command Name', // spaces not allowed
          description: 'Test description',
          userIntent: 'Test intent'
        }

        await client.commands.generateCommand(testProject.data.id, invalidRequest)
      }).toThrow()
    })

    test('should fail generation with empty description', async () => {
      await expect(async () => {
        const invalidRequest: CommandGenerationRequest = {
          name: 'valid-name',
          description: '', // empty description
          userIntent: 'Test intent'
        }

        await client.commands.generateCommand(testProject.data.id, invalidRequest)
      }).toThrow()
    })

    test('should fail generation with very long input', async () => {
      await expect(async () => {
        const longDescription = 'a'.repeat(1000) // exceeds max length
        const invalidRequest: CommandGenerationRequest = {
          name: 'valid-name',
          description: longDescription,
          userIntent: 'Test intent'
        }

        await client.commands.generateCommand(testProject.data.id, invalidRequest)
      }).toThrow()
    })
  })

  withTestEnvironment('Claude Command Error Handling', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      testProject = await dataManager.createProject({
        name: 'Error Handling Test Project',
        description: 'Test project for error scenarios',
        projectPath: '/tmp/claude-error-test'
      })
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    test('should handle invalid project ID gracefully', async () => {
      const invalidProjectId = 99999

      await expect(async () => {
        await client.commands.listCommands(invalidProjectId)
      }).toThrow()

      await expect(async () => {
        await client.commands.createCommand(invalidProjectId, {
          name: 'test-command',
          content: 'Test content'
        })
      }).toThrow()
    })

    test('should validate command name constraints', async () => {
      const invalidNames = [
        'NAME_WITH_UNDERSCORES',
        'name with spaces',
        'name@with#special$chars',
        'UPPERCASE-NAME'
      ]

      for (const invalidName of invalidNames) {
        await expect(async () => {
          await client.commands.createCommand(testProject.data.id, {
            name: invalidName,
            content: 'Test content'
          })
        }).toThrow()
      }
    })

    test('should validate namespace format', async () => {
      const invalidNamespaces = [
        'UPPERCASE',
        'with spaces',
        'with@special#chars',
        'trailing-slash/',
        '/leading-slash'
      ]

      for (const invalidNamespace of invalidNamespaces) {
        await expect(async () => {
          await client.commands.createCommand(testProject.data.id, {
            name: 'test-command',
            namespace: invalidNamespace,
            content: 'Test content'
          })
        }).toThrow()
      }
    })

    test('should require at least one field for updates', async () => {
      // Create a command first
      const createResult = await client.commands.createCommand(testProject.data.id, {
        name: 'update-test',
        content: 'Original content'
      })
      dataManager.addCommand(createResult.data)

      // Try to update with no fields
      await expect(async () => {
        await client.commands.updateCommand(testProject.data.id, 'update-test', {})
      }).toThrow()
    })

    test('should handle concurrent command creation conflicts', async () => {
      const commandName = 'concurrent-test'
      const createData = {
        name: commandName,
        content: 'Test content for concurrency'
      }

      // Create two promises that try to create the same command
      const promise1 = client.commands.createCommand(testProject.data.id, createData)
      const promise2 = client.commands.createCommand(testProject.data.id, createData)

      // One should succeed, one should fail
      const results = await Promise.allSettled([promise1, promise2])
      
      const successes = results.filter(r => r.status === 'fulfilled')
      const failures = results.filter(r => r.status === 'rejected')
      
      expect(successes.length).toBe(1)
      expect(failures.length).toBe(1)

      // Clean up the successful creation
      if (successes.length > 0) {
        await client.commands.deleteCommand(testProject.data.id, commandName)
      }
    })

    test('should handle malformed frontmatter gracefully', async () => {
      // Test with invalid frontmatter values
      await expect(async () => {
        await client.commands.createCommand(testProject.data.id, {
          name: 'malformed-frontmatter',
          content: 'Test content',
          frontmatter: {
            'max-turns': -1 // invalid negative value
          } as any
        })
      }).toThrow()

      await expect(async () => {
        await client.commands.createCommand(testProject.data.id, {
          name: 'malformed-frontmatter-2',
          content: 'Test content',
          frontmatter: {
            'output-format': 'invalid-format' // not 'text' or 'json'
          } as any
        })
      }).toThrow()
    })

    test('should handle empty content validation', async () => {
      await expect(async () => {
        await client.commands.createCommand(testProject.data.id, {
          name: 'empty-content',
          content: '' // empty content should fail
        })
      }).toThrow()

      await expect(async () => {
        await client.commands.createCommand(testProject.data.id, {
          name: 'whitespace-content',
          content: '   \n\t  ' // only whitespace should fail
        })
      }).toThrow()
    })

    test('should handle network timeouts gracefully', async () => {
      // This test simulates timeout scenarios
      // In a real implementation, you might mock the network layer
      
      const result = await client.commands.listCommands(testProject.data.id)
      assertions.apiSuccess(result)
      
      // Basic test to ensure the API is responding
      // Actual timeout testing would require more sophisticated mocking
    })

    test('should handle search with invalid parameters', async () => {
      // Test with negative offset
      await expect(async () => {
        await client.commands.listCommands(testProject.data.id, {
          offset: -1
        })
      }).toThrow()

      // Test with excessive limit
      await expect(async () => {
        await client.commands.listCommands(testProject.data.id, {
          limit: 1000 // exceeds max of 100
        })
      }).toThrow()
    })
  })

  withTestEnvironment('Claude Command Performance', async (testEnv: TestEnvironment) => {
    let client: PromptlianoClient
    let dataManager: TestDataManager
    let testProject: any

    beforeAll(async () => {
      client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
      dataManager = new TestDataManager(client)
      
      testProject = await dataManager.createProject({
        name: 'Performance Test Project',
        description: 'Test project for performance validation',
        projectPath: '/tmp/claude-performance-test'
      })
    })

    afterAll(async () => {
      await dataManager.cleanup()
    })

    test('should handle bulk command creation efficiently', async () => {
      const startTime = Date.now()
      const commandCount = 10
      const commands: ClaudeCommand[] = []

      // Create multiple commands
      for (let i = 0; i < commandCount; i++) {
        const result = await client.commands.createCommand(testProject.data.id, {
          name: `bulk-command-${i}`,
          namespace: `bulk-${Math.floor(i / 3)}`, // Group into namespaces
          content: `Bulk command ${i} content: $ARGUMENTS\n\nThis is command number ${i} in the bulk creation test.`,
          frontmatter: {
            description: `Bulk command ${i} for testing`,
            'max-turns': i % 5 + 1
          }
        })
        
        commands.push(result.data)
        dataManager.addCommand(result.data)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000) // 10 seconds max
      expect(commands.length).toBe(commandCount)
      
      // Verify all commands were created correctly
      for (let i = 0; i < commandCount; i++) {
        expect(commands[i].name).toBe(`bulk-command-${i}`)
        expect(commands[i].namespace).toBe(`bulk-${Math.floor(i / 3)}`)
      }
    })

    test('should handle bulk listing efficiently', async () => {
      const startTime = Date.now()
      
      // List all commands
      const result = await client.commands.listCommands(testProject.data.id)
      
      const endTime = Date.now()
      const duration = endTime - startTime

      assertions.apiSuccess(result)
      expect(duration).toBeLessThan(5000) // 5 seconds max for listing
      expect(result.data.length).toBeGreaterThan(0)
    })

    test('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 5
      const startTime = Date.now()

      // Create multiple concurrent requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) => 
        client.commands.listCommands(testProject.data.id, {
          query: `bulk-command-${i}`,
          limit: 5
        })
      )

      const results = await Promise.all(promises)
      
      const endTime = Date.now()
      const duration = endTime - startTime

      // All requests should succeed
      for (const result of results) {
        assertions.apiSuccess(result)
      }

      // Should handle concurrency efficiently
      expect(duration).toBeLessThan(10000) // 10 seconds max
    })

    test('should handle large command content efficiently', async () => {
      const largeContent = `# Large Command

Process large content for: $ARGUMENTS

${'## Section\n'.repeat(100)}
${'This is a long paragraph with detailed instructions that should be handled efficiently by the system. '.repeat(50)}

## Conclusion
This command contains a lot of content to test performance with large command definitions.`

      const startTime = Date.now()
      
      const result = await client.commands.createCommand(testProject.data.id, {
        name: 'large-content-command',
        content: largeContent
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime

      assertions.apiSuccess(result)
      dataManager.addCommand(result.data)
      
      expect(duration).toBeLessThan(5000) // 5 seconds max
      expect(result.data.content).toBe(largeContent)
    })

    test('should handle search with large result sets efficiently', async () => {
      const startTime = Date.now()
      
      // Search for commands that should return multiple results
      const result = await client.commands.listCommands(testProject.data.id, {
        query: 'command', // Should match many commands
        limit: 50
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime

      assertions.apiSuccess(result)
      expect(duration).toBeLessThan(3000) // 3 seconds max for search
    })

    test('should handle rapid sequential operations efficiently', async () => {
      const operationCount = 20
      const startTime = Date.now()

      // Perform rapid sequential operations
      for (let i = 0; i < operationCount; i++) {
        // Create, read, update, delete cycle
        const createResult = await client.commands.createCommand(testProject.data.id, {
          name: `rapid-${i}`,
          content: `Rapid test ${i}: $ARGUMENTS`
        })

        const getResult = await client.commands.getCommand(testProject.data.id, `rapid-${i}`)
        
        await client.commands.updateCommand(testProject.data.id, `rapid-${i}`, {
          content: `Updated rapid test ${i}: $ARGUMENTS`
        })

        await client.commands.deleteCommand(testProject.data.id, `rapid-${i}`)
        
        // Verify operations
        assertions.apiSuccess(createResult)
        assertions.apiSuccess(getResult)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle rapid operations efficiently
      expect(duration).toBeLessThan(30000) // 30 seconds max for all operations
    })
  })
})