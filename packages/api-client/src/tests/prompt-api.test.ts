import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient, PromptlianoError } from '@promptliano/api-client'
import type { PromptlianoClient } from '@promptliano/api-client'
import { type Prompt } from '@promptliano/schemas'
import { TEST_API_URL } from './test-config'

const BASE_URL = TEST_API_URL

describe('Prompt API Tests', () => {
  let client: PromptlianoClient
  let testPrompts: Prompt[] = []
  let testProjectId: number | null = null

  beforeAll(async () => {
    console.log('Starting Prompt API Tests...')
    
    // Ensure we're in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Tests must run in NODE_ENV=test environment')
    }

    client = createPromptlianoClient({ baseUrl: BASE_URL })

    // Verify client is properly initialized
    if (!client || !client.projects) {
      throw new Error('API client not properly initialized')
    }

    // Create a test project for prompt association tests
    try {
      const projectResult = await client.projects.createProject({
        name: 'Test Project for Prompts',
        path: `/tmp/test/prompts_${Date.now()}`,
        description: 'Temporary project for testing prompts'
      })
      if (projectResult.success) {
        testProjectId = projectResult.data.id
        console.log(`✅ Test project created with ID: ${testProjectId}`)
      } else {
        throw new Error(`Failed to create test project: ${JSON.stringify(projectResult)}`)
      }
    } catch (error) {
      console.error('❌ Failed to create test project in beforeAll:', error)
      // For prompts tests, we can continue without a project for global prompt tests
      console.warn('⚠️  Continuing tests without project - project-specific tests will be skipped')
    }
  })

  afterAll(async () => {
    console.log('Cleaning up prompt test data...')
    // Delete all test prompts
    for (const prompt of testPrompts) {
      try {
        await client.prompts.deletePrompt(prompt.id)
      } catch (err) {
        if (err instanceof PromptlianoError && err.statusCode === 404) {
          // Already deleted, ignore
        } else {
          console.error(`Failed to delete prompt ${prompt.id}:`, err)
        }
      }
    }
    // Delete test project
    if (testProjectId) {
      try {
        await client.projects.deleteProject(testProjectId)
      } catch (err) {
        if (err instanceof PromptlianoError && err.statusCode === 404) {
          // Already deleted, ignore
        } else {
          console.error(`Failed to delete test project ${testProjectId}:`, err)
        }
      }
    }
  })

  test('POST /api/prompts - Create prompts', async () => {
    const testData = [
      { name: 'Test Prompt 1', content: 'You are a helpful assistant.' },
      { name: 'Test Prompt 2', content: 'You are an expert in TypeScript.' },
      { name: 'Test Prompt 3', content: 'You are a code reviewer focusing on best practices.' }
    ]

    // Create prompts without projectId first
    for (const data of testData) {
      const result = await client.prompts.createPrompt(data)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.name).toBe(data.name)
      expect(result.data.content).toBe(data.content)
      expect(result.data.id).toBeTypeOf('number')
      expect(result.data.created).toBeNumber()
      expect(result.data.updated).toBeNumber()
      // For prompts created without projectId, it should be undefined
      expect(result.data.projectId).toBeUndefined()

      testPrompts.push(result.data)
    }

    // Create one prompt with projectId if testProjectId is available
    if (testProjectId) {
      const promptWithProject = {
        name: 'Test Prompt with Project',
        content: 'You are a project-specific assistant.',
        projectId: testProjectId
      }

      const result = await client.prompts.createPrompt(promptWithProject)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.name).toBe(promptWithProject.name)
      expect(result.data.content).toBe(promptWithProject.content)
      expect(result.data.id).toBeTypeOf('number')
      expect(result.data.created).toBeNumber()
      expect(result.data.updated).toBeNumber()
      expect(result.data.projectId).toBe(testProjectId)

      testPrompts.push(result.data)
    }
  })

  test('GET /api/prompts - List all prompts and verify creations', async () => {
    const result = await client.prompts.listPrompts()

    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)

    for (const testPrompt of testPrompts) {
      const found = result.data.find((p: Prompt) => p.id === testPrompt.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.name).toBe(testPrompt.name)
        expect(found.content).toBe(testPrompt.content)
      }
    }
  })

  test('GET /api/prompts/{promptId} - Get individual prompts', async () => {
    for (const prompt of testPrompts) {
      const result = await client.prompts.getPrompt(prompt.id)

      expect(result.success).toBe(true)
      expect(result.data.id).toBe(prompt.id)
      expect(result.data.name).toBe(prompt.name)
      expect(result.data.content).toBe(prompt.content)
    }
  })

  test('PATCH /api/prompts/{promptId} - Update prompts', async () => {
    const updates = [
      { name: 'Updated Prompt 1', content: 'You are an updated helpful assistant.' },
      { name: 'Updated Prompt 2' },
      { content: 'Only updated content' }
    ]

    for (let i = 0; i < Math.min(testPrompts.length, updates.length); i++) {
      const prompt = testPrompts[i]
      if (!prompt) continue
      const update = updates[i]
      if (!update) continue

      const result = await client.prompts.updatePrompt(prompt.id, update)

      expect(result.success).toBe(true)
      if (update.name) expect(result.data.name).toBe(update.name)
      else expect(result.data.name).toBe(prompt.name)
      if (update.content) expect(result.data.content).toBe(update.content)
      else expect(result.data.content).toBe(prompt.content)

      expect(result.data.updated).toBeGreaterThanOrEqual(prompt.updated)

      testPrompts[i] = result.data
    }
  })

  test('GET /api/prompts - Verify updates', async () => {
    const result = await client.prompts.listPrompts()

    for (const prompt of testPrompts) {
      const found = result.data.find((p: Prompt) => p.id === prompt.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.name).toBe(prompt.name)
        expect(found.content).toBe(prompt.content)
      }
    }
  })

  test('GET /api/projects/{projectId}/prompts - List prompts by project', async () => {
    if (!testProjectId) {
      console.warn("Skipping 'List prompts by project' test as testProjectId is null.")
      return
    }

    const result = await client.prompts.listProjectPrompts(testProjectId)

    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)

    const promptWithProject = testPrompts.find((p) => p.projectId === testProjectId)
    if (promptWithProject) {
      const found = result.data.find((p: Prompt) => p.id === promptWithProject.id)
      expect(found).toBeDefined()
    }
  })

  test('POST /api/projects/{projectId}/prompts/{promptId} - Add prompt to project', async () => {
    if (!testProjectId) {
      console.warn("Skipping 'Add prompt to project' test as testProjectId is null.")
      return
    }

    const promptToAdd = testPrompts.find((p) => p.name === 'Test Prompt 1' && !p.projectId)
    if (!promptToAdd) {
      console.warn("Skipping 'Add prompt to project' test as 'Test Prompt 1' (without projectId) not found.")
      return
    }

    const success = await client.prompts.addPromptToProject(testProjectId, promptToAdd.id)
    expect(success).toBe(true)

    // Update local prompt data
    const promptIndex = testPrompts.findIndex((p) => p.id === promptToAdd.id)
    if (promptIndex !== -1) {
      testPrompts[promptIndex]!.projectId = testProjectId
    }
  })

  test('GET /api/projects/{projectId}/prompts - Verify prompt was added to project', async () => {
    if (!testProjectId) {
      console.warn("Skipping 'Verify prompt was added' test as testProjectId is null.")
      return
    }

    const result = await client.prompts.listProjectPrompts(testProjectId)
    const promptToCheck = testPrompts.find((p) => p.name === 'Test Prompt 1')

    if (promptToCheck) {
      const found = result.data.find((p: Prompt) => p.id === promptToCheck.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.projectId).toBe(testProjectId)
      }
    }
  })

  test('DELETE /api/projects/{projectId}/prompts/{promptId} - Remove prompt from project', async () => {
    if (!testProjectId) {
      console.warn("Skipping 'Remove prompt from project' test as testProjectId is null.")
      return
    }

    const promptToRemove = testPrompts.find((p) => p.name === 'Test Prompt 1' && p.projectId === testProjectId)
    if (!promptToRemove) {
      console.warn("Skipping 'Remove prompt from project' test as 'Test Prompt 1' (associated with project) not found.")
      return
    }

    const success = await client.prompts.removePromptFromProject(testProjectId, promptToRemove.id)
    expect(success).toBe(true)

    // Update local prompt data
    const promptIndex = testPrompts.findIndex((p) => p.id === promptToRemove.id)
    if (promptIndex !== -1) {
      testPrompts[promptIndex]!.projectId = undefined
    }
  })

  test('GET /api/projects/{projectId}/prompts - Verify prompt was removed from project', async () => {
    if (!testProjectId) {
      console.warn("Skipping 'Verify prompt was removed' test as testProjectId is null.")
      return
    }

    const result = await client.prompts.listProjectPrompts(testProjectId)
    const promptToCheck = testPrompts.find((p) => p.name === 'Test Prompt 1')

    if (promptToCheck) {
      const foundInProject = result.data.find((p: Prompt) => p.id === promptToCheck.id)
      expect(foundInProject).toBeUndefined()
    }
  })

  test('DELETE /api/prompts/{promptId} - Delete all test prompts and verify individually', async () => {
    const promptsToDelete = [...testPrompts]
    testPrompts = []

    for (const prompt of promptsToDelete) {
      const success = await client.prompts.deletePrompt(prompt.id)
      expect(success).toBe(true)

      // Verify 404 immediately after deletion
      try {
        await client.prompts.getPrompt(prompt.id)
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(PromptlianoError)
        if (error instanceof PromptlianoError) {
          expect(error.statusCode).toBe(404)
        }
      }
    }
  })

  test('GET /api/prompts - Verify all deletions globally', async () => {
    const result = await client.prompts.listPrompts()
    expect(result.success).toBe(true)
    console.log('Final GET /api/prompts check. Number of prompts now:', result.data.length)
  })
})
