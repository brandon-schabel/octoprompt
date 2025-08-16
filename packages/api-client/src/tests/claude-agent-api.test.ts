import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient } from '@promptliano/api-client'
import type { PromptlianoClient, CreateClaudeAgentBody, UpdateClaudeAgentBody, ClaudeAgent } from '@promptliano/api-client'
import type { TestEnvironment } from './test-environment'
import { withTestEnvironment } from './test-environment'
import { assertions, factories, TestDataManager, withTestData, retryOperation, waitFor } from './utils/test-helpers'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Comprehensive API tests for Claude Agent operations
 * Tests agent CRUD, suggestions, project associations, file detection, and management
 */
describe('Claude Agent API Tests', () => {
  
  /**
   * Test helper to create agent files in a test directory
   */
  async function setupAgentFiles(testProjectPath: string) {
    const agentsDir = join(testProjectPath, '.claude', 'agents')
    if (!existsSync(agentsDir)) {
      mkdirSync(agentsDir, { recursive: true })
    }

    // Create sample agent files
    const agentFiles = [
      {
        name: 'frontend-expert.md',
        content: `# Frontend Expert

You are a specialist in modern frontend development with React, TypeScript, and CSS.

## Expertise
- React components and hooks
- TypeScript type definitions
- Modern CSS and styling
- Frontend testing strategies
`
      },
      {
        name: 'backend-architect.md',
        content: `# Backend Architect

You are an expert in backend systems, API design, and database architecture.

## Expertise
- REST and GraphQL APIs
- Database design and optimization
- Microservices architecture
- Performance optimization
`
      },
      {
        name: 'testing-specialist.md',
        content: `# Testing Specialist

You specialize in comprehensive testing strategies and automation.

## Expertise
- Unit and integration testing
- Test automation frameworks
- Performance testing
- Test-driven development
`
      }
    ]

    for (const file of agentFiles) {
      writeFileSync(join(agentsDir, file.name), file.content)
    }

    return agentsDir
  }

  /**
   * Test helper to clean up agent files
   */
  function cleanupAgentFiles(agentsDir: string) {
    if (existsSync(agentsDir)) {
      rmSync(agentsDir, { recursive: true, force: true })
    }
  }

  /**
   * Factory for creating test agent data
   */
  const createTestAgentData = (overrides: Partial<CreateClaudeAgentBody> = {}): CreateClaudeAgentBody => ({
    name: 'Test Agent',
    description: 'A test agent for automated testing',
    color: 'blue',
    content: '# Test Agent\n\nThis is a test agent for validation purposes.',
    filePath: 'agents/test-agent.md',
    ...overrides
  })

  /**
   * Helper to assert valid agent structure
   */
  function assertValidAgent(agent: any): asserts agent is ClaudeAgent {
    expect(agent).toBeDefined()
    expect(agent.id).toBeTypeOf('string')
    expect(agent.name).toBeTypeOf('string')
    expect(agent.description).toBeTypeOf('string')
    expect(agent.color).toBeTypeOf('string')
    expect(agent.filePath).toBeTypeOf('string')
    expect(agent.content).toBeTypeOf('string')
    assertions.assertValidTimestamp(agent.created)
    assertions.assertValidTimestamp(agent.updated)
  }

  /**
   * Helper to assert valid agent suggestion
   */
  function assertValidAgentSuggestion(suggestion: any) {
    expect(suggestion).toBeDefined()
    expect(suggestion.name).toBeTypeOf('string')
    expect(suggestion.description).toBeTypeOf('string')
    expect(suggestion.reasoning).toBeTypeOf('string')
    expect(suggestion.relevanceScore).toBeTypeOf('number')
    expect(suggestion.relevanceScore).toBeGreaterThanOrEqual(0)
    expect(suggestion.relevanceScore).toBeLessThanOrEqual(1)
  }

  /**
   * Core CRUD Operations Test Suite
   */
  describe('Claude Agent CRUD Operations', () => {
    withTestEnvironment('claude-agent-crud', (getEnv) => {
      let client: PromptlianoClient
      let dataManager: TestDataManager
      let testProjectId: number

      beforeAll(async () => {
        const env = getEnv()
        client = createPromptlianoClient({ baseUrl: env.baseUrl })
        dataManager = new TestDataManager(client)
        
        // Create a test project
        const project = await dataManager.createProject({
          name: 'Agent Test Project',
          path: '/tmp/agent-test-project'
        })
        testProjectId = project.id
      })

      afterAll(async () => {
        await dataManager.cleanup()
      })

      test('should create a new agent successfully', async () => {
        const agentData = createTestAgentData({
          name: 'Create Test Agent',
          description: 'Testing agent creation'
        })

        const response = await client.claudeAgents.createAgent(agentData)
        
        assertions.assertSuccessResponse(response)
        assertValidAgent(response.data)
        expect(response.data.name).toBe(agentData.name)
        expect(response.data.description).toBe(agentData.description)
        expect(response.data.color).toBe(agentData.color)
        expect(response.data.content).toBe(agentData.content)
        expect(response.data.filePath).toBe(agentData.filePath)

        // Track for cleanup
        dataManager.trackAgent(response.data.id)
      })

      test('should create agent with project association', async () => {
        const agentData = createTestAgentData({
          name: 'Project Agent',
          description: 'Agent associated with project',
          projectId: testProjectId
        })

        const response = await client.claudeAgents.createAgent(agentData, testProjectId)
        
        assertions.assertSuccessResponse(response)
        assertValidAgent(response.data)
        expect(response.data.projectId).toBe(testProjectId)

        dataManager.trackAgent(response.data.id)
      })

      test('should list all agents', async () => {
        // Create multiple agents first
        const agents = await Promise.all([
          client.claudeAgents.createAgent(createTestAgentData({ name: 'List Agent 1' })),
          client.claudeAgents.createAgent(createTestAgentData({ name: 'List Agent 2' })),
          client.claudeAgents.createAgent(createTestAgentData({ name: 'List Agent 3' }))
        ])

        agents.forEach(agent => dataManager.trackAgent(agent.data.id))

        const response = await client.claudeAgents.listAgents()
        
        assertions.assertSuccessResponse(response)
        assertions.assertArrayOfItems(response.data, 3)
        
        response.data.forEach(agent => {
          assertValidAgent(agent)
        })

        // Verify our created agents are in the list
        const agentNames = response.data.map(a => a.name)
        expect(agentNames).toContain('List Agent 1')
        expect(agentNames).toContain('List Agent 2')
        expect(agentNames).toContain('List Agent 3')
      })

      test('should list agents filtered by project', async () => {
        // Create agents with and without project association
        const projectAgent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Project Filtered Agent' }), 
          testProjectId
        )
        const globalAgent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Global Agent' })
        )

        dataManager.trackAgent(projectAgent.data.id)
        dataManager.trackAgent(globalAgent.data.id)

        const response = await client.claudeAgents.listAgents(testProjectId)
        
        assertions.assertSuccessResponse(response)
        
        // Should include project-specific agents
        const agentNames = response.data.map(a => a.name)
        expect(agentNames).toContain('Project Filtered Agent')
        
        // Verify all returned agents are either global or associated with the project
        response.data.forEach(agent => {
          expect(agent.projectId === undefined || agent.projectId === testProjectId).toBe(true)
        })
      })

      test('should get single agent by ID', async () => {
        const createdAgent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Get Single Agent' })
        )
        dataManager.trackAgent(createdAgent.data.id)

        const response = await client.claudeAgents.getAgent(createdAgent.data.id)
        
        assertions.assertSuccessResponse(response)
        assertValidAgent(response.data)
        expect(response.data.id).toBe(createdAgent.data.id)
        expect(response.data.name).toBe('Get Single Agent')
      })

      test('should update agent successfully', async () => {
        const createdAgent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Update Agent Original' })
        )
        dataManager.trackAgent(createdAgent.data.id)

        const updateData: UpdateClaudeAgentBody = {
          name: 'Update Agent Modified',
          description: 'Updated description',
          color: 'green',
          content: '# Updated Agent\n\nThis agent has been updated.'
        }

        const response = await client.claudeAgents.updateAgent(createdAgent.data.id, updateData)
        
        assertions.assertSuccessResponse(response)
        assertValidAgent(response.data)
        expect(response.data.id).toBe(createdAgent.data.id)
        expect(response.data.name).toBe(updateData.name)
        expect(response.data.description).toBe(updateData.description)
        expect(response.data.color).toBe(updateData.color)
        expect(response.data.content).toBe(updateData.content)
        expect(response.data.updated).toBeGreaterThan(createdAgent.data.updated)
      })

      test('should partially update agent', async () => {
        const createdAgent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Partial Update Agent' })
        )
        dataManager.trackAgent(createdAgent.data.id)

        const partialUpdate: UpdateClaudeAgentBody = {
          name: 'Partially Updated Name'
        }

        const response = await client.claudeAgents.updateAgent(createdAgent.data.id, partialUpdate)
        
        assertions.assertSuccessResponse(response)
        expect(response.data.name).toBe(partialUpdate.name)
        // Other fields should remain unchanged
        expect(response.data.description).toBe(createdAgent.data.description)
        expect(response.data.color).toBe(createdAgent.data.color)
        expect(response.data.content).toBe(createdAgent.data.content)
      })

      test('should delete agent successfully', async () => {
        const createdAgent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Delete Test Agent' })
        )

        const deleteResult = await client.claudeAgents.deleteAgent(createdAgent.data.id)
        expect(deleteResult).toBe(true)

        // Verify agent is deleted by trying to get it
        try {
          await client.claudeAgents.getAgent(createdAgent.data.id)
          expect.unreachable('Should have thrown an error for deleted agent')
        } catch (error: any) {
          expect(error.status).toBe(404)
        }
      })
    })
  })

  /**
   * Agent Suggestions Test Suite
   */
  describe('Claude Agent Suggestions', () => {
    withTestEnvironment('claude-agent-suggestions', (getEnv) => {
      let client: PromptlianoClient
      let dataManager: TestDataManager
      let testProjectId: number

      beforeAll(async () => {
        const env = getEnv()
        client = createPromptlianoClient({ baseUrl: env.baseUrl })
        dataManager = new TestDataManager(client)
        
        const project = await dataManager.createProject({
          name: 'Suggestions Test Project',
          path: '/tmp/suggestions-test-project'
        })
        testProjectId = project.id

        // Create some agents to suggest
        await Promise.all([
          client.claudeAgents.createAgent(createTestAgentData({
            name: 'Frontend Developer',
            description: 'Expert in React, Vue, and Angular development',
            content: 'Specializes in modern frontend frameworks and UI/UX design'
          })),
          client.claudeAgents.createAgent(createTestAgentData({
            name: 'Backend Engineer', 
            description: 'Expert in Node.js, Python, and database design',
            content: 'Focuses on API development and server architecture'
          })),
          client.claudeAgents.createAgent(createTestAgentData({
            name: 'DevOps Specialist',
            description: 'Expert in CI/CD, Docker, and cloud infrastructure',
            content: 'Specializes in deployment automation and monitoring'
          }))
        ]).then(agents => {
          agents.forEach(agent => dataManager.trackAgent(agent.data.id))
        })
      })

      afterAll(async () => {
        await dataManager.cleanup()
      })

      test('should suggest relevant agents for frontend work', async () => {
        const response = await client.claudeAgents.suggestAgents(
          testProjectId,
          'I need help building a React component with TypeScript'
        )
        
        assertions.assertSuccessResponse(response)
        expect(Array.isArray(response.data.agents)).toBe(true)
        expect(response.data.agents.length).toBeGreaterThan(0)
        
        response.data.agents.forEach(suggestion => {
          assertValidAgentSuggestion(suggestion)
        })

        // Should prioritize frontend-related agents
        const topSuggestion = response.data.agents[0]
        expect(topSuggestion.name.toLowerCase()).toContain('frontend')
      })

      test('should suggest agents for backend work', async () => {
        const response = await client.claudeAgents.suggestAgents(
          testProjectId,
          'I need to design an API and set up a database'
        )
        
        assertions.assertSuccessResponse(response)
        expect(response.data.agents.length).toBeGreaterThan(0)
        
        const topSuggestion = response.data.agents[0]
        expect(topSuggestion.name.toLowerCase()).toContain('backend')
      })

      test('should suggest agents for DevOps work', async () => {
        const response = await client.claudeAgents.suggestAgents(
          testProjectId,
          'I need to set up CI/CD pipeline and deploy to AWS'
        )
        
        assertions.assertSuccessResponse(response)
        expect(response.data.agents.length).toBeGreaterThan(0)
        
        const topSuggestion = response.data.agents[0]
        expect(topSuggestion.name.toLowerCase()).toContain('devops')
      })

      test('should respect suggestion limit', async () => {
        const limit = 2
        const response = await client.claudeAgents.suggestAgents(
          testProjectId,
          'I need help with development',
          limit
        )
        
        assertions.assertSuccessResponse(response)
        expect(response.data.agents.length).toBeLessThanOrEqual(limit)
      })

      test.skipIf(process.env.CI)('should handle empty context gracefully', async () => {
        const response = await client.claudeAgents.suggestAgents(testProjectId, '')
        
        assertions.assertSuccessResponse(response)
        expect(Array.isArray(response.data.agents)).toBe(true)
        // Should still return some suggestions, possibly ranked by general relevance
      })
    })
  })

  /**
   * Agent-Project Association Test Suite
   */
  describe('Agent-Project Associations', () => {
    withTestEnvironment('claude-agent-associations', (getEnv) => {
      let client: PromptlianoClient
      let dataManager: TestDataManager
      let testProjectId: number
      let globalAgentId: string

      beforeAll(async () => {
        const env = getEnv()
        client = createPromptlianoClient({ baseUrl: env.baseUrl })
        dataManager = new TestDataManager(client)
        
        const project = await dataManager.createProject({
          name: 'Association Test Project',
          path: '/tmp/association-test-project'
        })
        testProjectId = project.id

        // Create a global agent for association testing
        const globalAgent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Global Association Agent' })
        )
        globalAgentId = globalAgent.data.id
        dataManager.trackAgent(globalAgentId)
      })

      afterAll(async () => {
        await dataManager.cleanup()
      })

      test('should list project agents', async () => {
        // First associate the global agent with the project
        await client.claudeAgents.addAgentToProject(testProjectId, globalAgentId)

        const response = await client.claudeAgents.listProjectAgents(testProjectId)
        
        assertions.assertSuccessResponse(response)
        assertions.assertArrayOfItems(response.data, 1)
        
        const agentIds = response.data.map(a => a.id)
        expect(agentIds).toContain(globalAgentId)
      })

      test('should add agent to project', async () => {
        // Create another agent for testing
        const newAgent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'New Association Agent' })
        )
        dataManager.trackAgent(newAgent.data.id)

        const result = await client.claudeAgents.addAgentToProject(testProjectId, newAgent.data.id)
        expect(result).toBe(true)

        // Verify it's now associated
        const projectAgents = await client.claudeAgents.listProjectAgents(testProjectId)
        const agentIds = projectAgents.data.map(a => a.id)
        expect(agentIds).toContain(newAgent.data.id)
      })

      test('should remove agent from project', async () => {
        // Add an agent first
        const agentToRemove = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Remove Association Agent' })
        )
        dataManager.trackAgent(agentToRemove.data.id)

        await client.claudeAgents.addAgentToProject(testProjectId, agentToRemove.data.id)

        // Now remove it
        const result = await client.claudeAgents.removeAgentFromProject(testProjectId, agentToRemove.data.id)
        expect(result).toBe(true)

        // Verify it's no longer associated
        const projectAgents = await client.claudeAgents.listProjectAgents(testProjectId)
        const agentIds = projectAgents.data.map(a => a.id)
        expect(agentIds).not.toContain(agentToRemove.data.id)
      })

      test('should handle duplicate association gracefully', async () => {
        // Try to add the same agent twice
        await client.claudeAgents.addAgentToProject(testProjectId, globalAgentId)
        const result = await client.claudeAgents.addAgentToProject(testProjectId, globalAgentId)
        
        expect(result).toBe(true) // Should not error
        
        // Should still only appear once in the list
        const projectAgents = await client.claudeAgents.listProjectAgents(testProjectId)
        const matchingAgents = projectAgents.data.filter(a => a.id === globalAgentId)
        expect(matchingAgents.length).toBe(1)
      })
    })
  })

  /**
   * Agent Files Service Test Suite
   */
  describe('Agent Files Service', () => {
    withTestEnvironment('claude-agent-files', (getEnv) => {
      let client: PromptlianoClient
      let dataManager: TestDataManager
      let testProjectId: number
      let testProjectPath: string
      let agentsDir: string

      beforeAll(async () => {
        const env = getEnv()
        client = createPromptlianoClient({ baseUrl: env.baseUrl })
        dataManager = new TestDataManager(client)
        
        testProjectPath = '/tmp/agent-files-test-project'
        const project = await dataManager.createProject({
          name: 'Agent Files Test Project',
          path: testProjectPath
        })
        testProjectId = project.id

        // Set up agent files
        agentsDir = await setupAgentFiles(testProjectPath)
      })

      afterAll(async () => {
        await dataManager.cleanup()
        cleanupAgentFiles(agentsDir)
      })

      test('should detect agent files in project', async () => {
        const response = await client.agentFiles.detectFiles(testProjectId)
        
        assertions.assertSuccessResponse(response)
        expect(response.data).toBeDefined()
        expect(response.data.projectFiles).toBeDefined()
        expect(Array.isArray(response.data.projectFiles)).toBe(true)
        expect(Array.isArray(response.data.globalFiles)).toBe(true)
        expect(Array.isArray(response.data.suggestedFiles)).toBe(true)

        // Should detect our created agent files
        const projectFileNames = response.data.projectFiles.map(f => f.name)
        expect(projectFileNames).toContain('frontend-expert.md')
        expect(projectFileNames).toContain('backend-architect.md')
        expect(projectFileNames).toContain('testing-specialist.md')

        // Verify file structure
        response.data.projectFiles.forEach(file => {
          expect(file.type).toBeTypeOf('string')
          expect(file.name).toBeTypeOf('string')
          expect(file.path).toBeTypeOf('string')
          expect(['global', 'project']).toContain(file.scope)
          expect(file.exists).toBeTypeOf('boolean')
          expect(file.writable).toBeTypeOf('boolean')
        })
      })

      test('should detect file details correctly', async () => {
        const response = await client.agentFiles.detectFiles(testProjectId)
        
        const frontendAgent = response.data.projectFiles.find(f => f.name === 'frontend-expert.md')
        expect(frontendAgent).toBeDefined()
        expect(frontendAgent!.exists).toBe(true)
        expect(frontendAgent!.scope).toBe('project')
        expect(frontendAgent!.path).toContain('.claude/agents/frontend-expert.md')
      })

      test('should handle project without agent files', async () => {
        // Create a new project without agent files
        const emptyProject = await dataManager.createProject({
          name: 'Empty Agent Project',
          path: '/tmp/empty-agent-project'
        })

        const response = await client.agentFiles.detectFiles(emptyProject.id)
        
        assertions.assertSuccessResponse(response)
        expect(response.data.projectFiles).toEqual([])
        expect(Array.isArray(response.data.globalFiles)).toBe(true)
        expect(Array.isArray(response.data.suggestedFiles)).toBe(true)
      })
    })
  })

  /**
   * Error Handling and Edge Cases Test Suite
   */
  describe('Error Handling and Edge Cases', () => {
    withTestEnvironment('claude-agent-errors', (getEnv) => {
      let client: PromptlianoClient
      let dataManager: TestDataManager

      beforeAll(async () => {
        const env = getEnv()
        client = createPromptlianoClient({ baseUrl: env.baseUrl })
        dataManager = new TestDataManager(client)
      })

      afterAll(async () => {
        await dataManager.cleanup()
      })

      test('should handle invalid agent ID gracefully', async () => {
        try {
          await client.claudeAgents.getAgent('non-existent-agent-id')
          expect.unreachable('Should have thrown an error')
        } catch (error: any) {
          expect(error.status).toBe(404)
        }
      })

      test('should validate required fields in create agent', async () => {
        try {
          await client.claudeAgents.createAgent({
            name: '', // Invalid - empty name
            description: 'Valid description',
            color: 'blue',
            content: 'Valid content'
          } as CreateClaudeAgentBody)
          expect.unreachable('Should have thrown validation error')
        } catch (error: any) {
          expect(error.status).toBe(400)
        }
      })

      test('should validate agent color values', async () => {
        try {
          await client.claudeAgents.createAgent({
            name: 'Test Agent',
            description: 'Test description',
            color: 'invalid-color' as any,
            content: 'Test content'
          } as CreateClaudeAgentBody)
          expect.unreachable('Should have thrown validation error')
        } catch (error: any) {
          expect(error.status).toBe(400)
        }
      })

      test('should handle empty update gracefully', async () => {
        const agent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Empty Update Test' })
        )
        dataManager.trackAgent(agent.data.id)

        try {
          await client.claudeAgents.updateAgent(agent.data.id, {} as UpdateClaudeAgentBody)
          expect.unreachable('Should have thrown validation error for empty update')
        } catch (error: any) {
          expect(error.status).toBe(400)
        }
      })

      test('should handle non-existent project in suggestions', async () => {
        try {
          await client.claudeAgents.suggestAgents(999999, 'test context')
          expect.unreachable('Should have thrown error for non-existent project')
        } catch (error: any) {
          expect(error.status).toBe(404)
        }
      })

      test('should handle malformed suggestion request', async () => {
        const project = await dataManager.createProject({
          name: 'Malformed Request Test',
          path: '/tmp/malformed-test'
        })

        try {
          await client.claudeAgents.suggestAgents(project.id, '')
          // Empty context might be allowed - check if it returns empty results or handles gracefully
        } catch (error: any) {
          // If it throws, should be a reasonable error
          expect(error.status).toBeOneOf([400, 422])
        }
      })

      test('should handle file detection on non-existent project', async () => {
        try {
          await client.agentFiles.detectFiles(999999)
          expect.unreachable('Should have thrown error for non-existent project')
        } catch (error: any) {
          expect(error.status).toBe(404)
        }
      })
    })
  })

  /**
   * Performance and Concurrency Test Suite
   */
  describe('Performance and Concurrency', () => {
    withTestEnvironment('claude-agent-performance', (getEnv) => {
      let client: PromptlianoClient
      let dataManager: TestDataManager

      beforeAll(async () => {
        const env = getEnv()
        client = createPromptlianoClient({ baseUrl: env.baseUrl })
        dataManager = new TestDataManager(client)
      })

      afterAll(async () => {
        await dataManager.cleanup()
      })

      test('should handle multiple concurrent agent creations', async () => {
        const agentPromises = Array.from({ length: 5 }, (_, i) =>
          client.claudeAgents.createAgent(createTestAgentData({
            name: `Concurrent Agent ${i}`,
            description: `Concurrent test agent ${i}`
          }))
        )

        const results = await Promise.all(agentPromises)
        
        // Track all for cleanup
        results.forEach(agent => dataManager.trackAgent(agent.data.id))

        // All should succeed
        results.forEach(result => {
          assertions.assertSuccessResponse(result)
          assertValidAgent(result.data)
        })

        // All should have unique IDs
        const ids = results.map(r => r.data.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
      })

      test('should handle concurrent reads efficiently', async () => {
        // Create some agents first
        const agents = await Promise.all([
          client.claudeAgents.createAgent(createTestAgentData({ name: 'Read Test 1' })),
          client.claudeAgents.createAgent(createTestAgentData({ name: 'Read Test 2' })),
          client.claudeAgents.createAgent(createTestAgentData({ name: 'Read Test 3' }))
        ])

        agents.forEach(agent => dataManager.trackAgent(agent.data.id))

        // Perform concurrent reads
        const startTime = Date.now()
        const readPromises = agents.map(agent =>
          client.claudeAgents.getAgent(agent.data.id)
        )

        const results = await Promise.all(readPromises)
        const endTime = Date.now()
        const totalTime = endTime - startTime

        // All should succeed
        results.forEach(result => {
          assertions.assertSuccessResponse(result)
          assertValidAgent(result.data)
        })

        // Should be reasonably fast (less than 2 seconds for 3 concurrent reads)
        expect(totalTime).toBeLessThan(2000)
      })

      test('should handle bulk operations efficiently', async () => {
        const startTime = Date.now()

        // Create multiple agents
        const agentPromises = Array.from({ length: 10 }, (_, i) =>
          client.claudeAgents.createAgent(createTestAgentData({
            name: `Bulk Agent ${i}`,
            color: (i % 2 === 0) ? 'blue' : 'green'
          }))
        )

        const agents = await Promise.all(agentPromises)
        agents.forEach(agent => dataManager.trackAgent(agent.data.id))

        // List all agents
        const listResponse = await client.claudeAgents.listAgents()
        
        const endTime = Date.now()
        const totalTime = endTime - startTime

        assertions.assertSuccessResponse(listResponse)
        expect(listResponse.data.length).toBeGreaterThanOrEqual(10)

        // Should handle bulk operations reasonably fast
        expect(totalTime).toBeLessThan(5000)
      })

      test('should maintain data consistency under concurrent updates', async () => {
        const agent = await client.claudeAgents.createAgent(
          createTestAgentData({ name: 'Concurrent Update Test' })
        )
        dataManager.trackAgent(agent.data.id)

        // Perform concurrent updates
        const updatePromises = [
          client.claudeAgents.updateAgent(agent.data.id, { name: 'Update 1' }),
          client.claudeAgents.updateAgent(agent.data.id, { description: 'Update 2' }),
          client.claudeAgents.updateAgent(agent.data.id, { color: 'red' })
        ]

        const results = await Promise.all(updatePromises)

        // All updates should succeed
        results.forEach(result => {
          assertions.assertSuccessResponse(result)
          assertValidAgent(result.data)
        })

        // Final state should be consistent
        const finalAgent = await client.claudeAgents.getAgent(agent.data.id)
        assertions.assertSuccessResponse(finalAgent)
        
        // Should have the latest timestamp
        const latestUpdate = Math.max(...results.map(r => r.data.updated))
        expect(finalAgent.data.updated).toBe(latestUpdate)
      })
    })
  })

  /**
   * Integration Test Suite
   */
  describe('Integration Scenarios', () => {
    withTestEnvironment('claude-agent-integration', (getEnv) => {
      let client: PromptlianoClient
      let dataManager: TestDataManager
      let testProjectId: number

      beforeAll(async () => {
        const env = getEnv()
        client = createPromptlianoClient({ baseUrl: env.baseUrl })
        dataManager = new TestDataManager(client)
        
        const project = await dataManager.createProject({
          name: 'Integration Test Project',
          path: '/tmp/integration-test-project'
        })
        testProjectId = project.id
      })

      afterAll(async () => {
        await dataManager.cleanup()
      })

      test('should support full agent lifecycle workflow', async () => {
        // 1. Create agent
        const createResponse = await client.claudeAgents.createAgent(createTestAgentData({
          name: 'Lifecycle Agent',
          description: 'Testing full lifecycle'
        }))
        
        assertions.assertSuccessResponse(createResponse)
        const agentId = createResponse.data.id
        dataManager.trackAgent(agentId)

        // 2. Associate with project
        await client.claudeAgents.addAgentToProject(testProjectId, agentId)

        // 3. Verify in project list
        const projectAgents = await client.claudeAgents.listProjectAgents(testProjectId)
        expect(projectAgents.data.some(a => a.id === agentId)).toBe(true)

        // 4. Update agent
        const updateResponse = await client.claudeAgents.updateAgent(agentId, {
          name: 'Updated Lifecycle Agent',
          description: 'Updated for lifecycle testing'
        })
        assertions.assertSuccessResponse(updateResponse)

        // 5. Use in suggestions
        const suggestionsResponse = await client.claudeAgents.suggestAgents(
          testProjectId, 
          'lifecycle testing'
        )
        assertions.assertSuccessResponse(suggestionsResponse)
        // Should include our agent in suggestions (if relevant)

        // 6. Remove from project
        await client.claudeAgents.removeAgentFromProject(testProjectId, agentId)

        // 7. Verify removal
        const updatedProjectAgents = await client.claudeAgents.listProjectAgents(testProjectId)
        expect(updatedProjectAgents.data.some(a => a.id === agentId)).toBe(false)

        // 8. Agent should still exist globally
        const globalAgents = await client.claudeAgents.listAgents()
        expect(globalAgents.data.some(a => a.id === agentId)).toBe(true)

        // 9. Delete agent
        await client.claudeAgents.deleteAgent(agentId)

        // 10. Verify deletion
        try {
          await client.claudeAgents.getAgent(agentId)
          expect.unreachable('Agent should be deleted')
        } catch (error: any) {
          expect(error.status).toBe(404)
        }
      })

      test('should handle complex agent ecosystem', async () => {
        // Create multiple agents with different specializations
        const specialists = await Promise.all([
          client.claudeAgents.createAgent(createTestAgentData({
            name: 'React Specialist',
            description: 'Expert in React development and hooks',
            color: 'blue'
          })),
          client.claudeAgents.createAgent(createTestAgentData({
            name: 'Node.js Expert',
            description: 'Backend development with Node.js and Express',
            color: 'green'
          })),
          client.claudeAgents.createAgent(createTestAgentData({
            name: 'Database Designer',
            description: 'Database architecture and optimization',
            color: 'purple'
          })),
          client.claudeAgents.createAgent(createTestAgentData({
            name: 'Testing Engineer',
            description: 'Automated testing and quality assurance',
            color: 'orange'
          }))
        ])

        specialists.forEach(agent => dataManager.trackAgent(agent.data.id))

        // Associate different agents with project
        await Promise.all([
          client.claudeAgents.addAgentToProject(testProjectId, specialists[0].data.id),
          client.claudeAgents.addAgentToProject(testProjectId, specialists[1].data.id)
        ])

        // Test various suggestion scenarios
        const scenarioTests = [
          {
            context: 'I need to build a React component with state management',
            expected: 'React Specialist'
          },
          {
            context: 'Setting up Express API endpoints and middleware',
            expected: 'Node.js Expert'
          },
          {
            context: 'Designing efficient database schemas and queries',
            expected: 'Database Designer'
          },
          {
            context: 'Writing unit tests and integration tests',
            expected: 'Testing Engineer'
          }
        ]

        for (const scenario of scenarioTests) {
          const suggestions = await client.claudeAgents.suggestAgents(
            testProjectId,
            scenario.context
          )
          
          assertions.assertSuccessResponse(suggestions)
          expect(suggestions.data.agents.length).toBeGreaterThan(0)
          
          // Top suggestion should be relevant to the context
          const topSuggestion = suggestions.data.agents[0]
          expect(topSuggestion.name).toContain(scenario.expected.split(' ')[0])
        }

        // Verify project associations
        const projectAgents = await client.claudeAgents.listProjectAgents(testProjectId)
        expect(projectAgents.data.length).toBe(2) // Only 2 were associated
        
        const projectAgentNames = projectAgents.data.map(a => a.name)
        expect(projectAgentNames).toContain('React Specialist')
        expect(projectAgentNames).toContain('Node.js Expert')
      })
    })
  })
})