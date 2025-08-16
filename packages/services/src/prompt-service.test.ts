import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
  createPrompt,
  getPromptById,
  listAllPrompts,
  listPromptsByProject,
  updatePrompt,
  deletePrompt,
  addPromptToProject,
  removePromptFromProject,
  getPromptProjects,
  getPromptsByIds
} from './prompt-service'
import type { Prompt, PromptProject, CreatePromptBody, UpdatePromptBody } from '@promptliano/schemas'
import type { PromptsStorage } from '@promptliano/storage'
import { ApiError } from '@promptliano/shared'

// In-memory stores for our mocks
let mockPromptsDb: PromptsStorage = {}
let mockPromptProjectsDb: PromptProject[] = []

// Initialize a base for mock IDs
const BASE_TIMESTAMP = 1700000000000
let mockIdCounter = BASE_TIMESTAMP

const generateTestId = () => {
  mockIdCounter += 1000
  return mockIdCounter
}

// --- Mocking promptStorage ---
const mockPromptStorage = {
  readPrompts: async () => JSON.parse(JSON.stringify(mockPromptsDb)),
  writePrompts: async (data: PromptsStorage) => {
    mockPromptsDb = JSON.parse(JSON.stringify(data))
    return mockPromptsDb
  },
  readPromptProjectAssociations: async () => JSON.parse(JSON.stringify(mockPromptProjectsDb)),
  writePromptProjects: async (data: PromptProject[]) => {
    mockPromptProjectsDb = JSON.parse(JSON.stringify(data))
    return mockPromptProjectsDb
  },
  generateId: () => generateTestId()
}

mock.module('@promptliano/storage', () => ({
  promptStorage: mockPromptStorage
}))

describe('Prompt Service', () => {
  beforeEach(() => {
    mockPromptsDb = {}
    mockPromptProjectsDb = []
    mockIdCounter = BASE_TIMESTAMP
  })

  describe('Prompt CRUD', () => {
    test('createPrompt creates a new prompt', async () => {
      const input: CreatePromptBody = {
        name: 'Test Prompt',
        content: 'This is a test prompt content',
        projectId: 12345
      }

      const prompt = await createPrompt(input)

      expect(prompt.id).toBeDefined()
      expect(prompt.name).toBe(input.name)
      expect(prompt.content).toBe(input.content)
      expect(prompt.projectId).toBe(input.projectId)
      expect(prompt.created).toBeDefined()
      expect(prompt.updated).toBeDefined()
      expect(mockPromptsDb[prompt.id]).toBeDefined()

      // Check that prompt-project association was created
      expect(mockPromptProjectsDb.length).toBe(1)
      expect(mockPromptProjectsDb[0].promptId).toBe(prompt.id)
      expect(mockPromptProjectsDb[0].projectId).toBe(input.projectId)
    })

    test('createPrompt creates prompt without project', async () => {
      const input: CreatePromptBody = {
        name: 'Standalone Prompt',
        content: 'No project association'
      }

      const prompt = await createPrompt(input)

      expect(prompt.id).toBeDefined()
      expect(prompt.projectId).toBeUndefined()
      expect(mockPromptProjectsDb.length).toBe(0)
    })

    test('getPromptById returns prompt if found', async () => {
      const created = await createPrompt({
        name: 'Find Me',
        content: 'Content to find'
      })

      const found = await getPromptById(created.id)
      expect(found).toEqual(created)
    })

    test('getPromptById throws if not found', async () => {
      const nonExistentId = generateTestId()
      await expect(getPromptById(nonExistentId)).rejects.toThrow(
        new ApiError(404, `Prompt with ID ${nonExistentId} not found.`, 'PROMPT_NOT_FOUND')
      )
    })

    test('listAllPrompts returns all prompts sorted by name', async () => {
      const prompt1 = await createPrompt({ name: 'Zebra', content: 'Last alphabetically' })
      const prompt2 = await createPrompt({ name: 'Apple', content: 'First alphabetically' })
      const prompt3 = await createPrompt({ name: 'Middle', content: 'Middle alphabetically' })

      const all = await listAllPrompts()

      expect(all.length).toBe(3)
      expect(all[0].name).toBe('Apple')
      expect(all[1].name).toBe('Middle')
      expect(all[2].name).toBe('Zebra')
    })

    test('updatePrompt updates fields', async () => {
      const created = await createPrompt({
        name: 'Original',
        content: 'Original content'
      })

      const updates: UpdatePromptBody = {
        name: 'Updated',
        content: 'Updated content'
      }

      await new Promise((resolve) => setTimeout(resolve, 10))
      const updated = await updatePrompt(created.id, updates)

      expect(updated.name).toBe('Updated')
      expect(updated.content).toBe('Updated content')
      expect(updated.updated).toBeGreaterThan(created.updated)
      expect(mockPromptsDb[created.id].name).toBe('Updated')
    })

    test('updatePrompt throws if prompt not found', async () => {
      const nonExistentId = generateTestId()
      await expect(updatePrompt(nonExistentId, { name: 'X' })).rejects.toThrow(
        new ApiError(404, `Prompt with ID ${nonExistentId} not found for update.`, 'PROMPT_NOT_FOUND')
      )
    })

    test('deletePrompt removes prompt and associations', async () => {
      const prompt = await createPrompt({
        name: 'To Delete',
        content: 'Delete me',
        projectId: 9999
      })

      expect(mockPromptsDb[prompt.id]).toBeDefined()
      expect(mockPromptProjectsDb.length).toBe(1)

      const result = await deletePrompt(prompt.id)

      expect(result).toBe(true)
      expect(mockPromptsDb[prompt.id]).toBeUndefined()
      expect(mockPromptProjectsDb.length).toBe(0)
    })

    test('deletePrompt returns false if not found', async () => {
      const result = await deletePrompt(generateTestId())
      expect(result).toBe(false)
    })
  })

  describe('Prompt-Project Associations', () => {
    let promptId: number
    let projectId: number

    beforeEach(async () => {
      const prompt = await createPrompt({
        name: 'Association Test',
        content: 'For testing associations'
      })
      promptId = prompt.id
      projectId = 5555
    })

    test('addPromptToProject creates association', async () => {
      await addPromptToProject(promptId, projectId)

      const associations = mockPromptProjectsDb.filter(
        (link) => link.promptId === promptId && link.projectId === projectId
      )
      expect(associations.length).toBe(1)
    })

    test('addPromptToProject replaces existing associations', async () => {
      // Add to first project
      await addPromptToProject(promptId, projectId)
      expect(mockPromptProjectsDb.length).toBe(1)

      // Add to second project - should replace first
      const newProjectId = 6666
      await addPromptToProject(promptId, newProjectId)

      expect(mockPromptProjectsDb.length).toBe(1)
      expect(mockPromptProjectsDb[0].projectId).toBe(newProjectId)
    })

    test('addPromptToProject throws if prompt not found', async () => {
      const nonExistentId = generateTestId()
      await expect(addPromptToProject(nonExistentId, projectId)).rejects.toThrow(
        new ApiError(404, `Prompt with ID ${nonExistentId} not found.`, 'PROMPT_NOT_FOUND')
      )
    })

    test('removePromptFromProject removes association', async () => {
      await addPromptToProject(promptId, projectId)
      expect(mockPromptProjectsDb.length).toBe(1)

      await removePromptFromProject(promptId, projectId)
      expect(mockPromptProjectsDb.length).toBe(0)
    })

    test('removePromptFromProject throws if association not found', async () => {
      await expect(removePromptFromProject(promptId, projectId)).rejects.toThrow(
        new ApiError(
          404,
          `Association between prompt ${promptId} and project ${projectId} not found.`,
          'PROMPT_PROJECT_LINK_NOT_FOUND'
        )
      )
    })

    test('listPromptsByProject returns prompts for project', async () => {
      const prompt1 = await createPrompt({
        name: 'Project Prompt 1',
        content: 'Content 1',
        projectId: projectId
      })

      const prompt2 = await createPrompt({
        name: 'Project Prompt 2',
        content: 'Content 2',
        projectId: projectId
      })

      // Create a prompt for different project
      await createPrompt({
        name: 'Other Project',
        content: 'Other content',
        projectId: 7777
      })

      const prompts = await listPromptsByProject(projectId)

      expect(prompts.length).toBe(2)
      expect(prompts.map((p) => p.id)).toContain(prompt1.id)
      expect(prompts.map((p) => p.id)).toContain(prompt2.id)
      // All returned prompts should have the projectId set
      expect(prompts.every((p) => p.projectId === projectId)).toBe(true)
    })

    test('getPromptProjects returns all associations for a prompt', async () => {
      // Add prompt to multiple projects
      await addPromptToProject(promptId, projectId)

      // Since addPromptToProject replaces, we need to manually add to test multiple
      mockPromptProjectsDb.push({
        id: generateTestId(),
        promptId: promptId,
        projectId: 8888
      })

      const associations = await getPromptProjects(promptId)

      expect(associations.length).toBe(2)
      expect(associations.map((a) => a.projectId)).toContain(projectId)
      expect(associations.map((a) => a.projectId)).toContain(8888)
    })

    test('getPromptsByIds returns requested prompts', async () => {
      const prompt1 = await createPrompt({ name: 'Prompt 1', content: 'Content 1' })
      const prompt2 = await createPrompt({ name: 'Prompt 2', content: 'Content 2' })
      const prompt3 = await createPrompt({ name: 'Prompt 3', content: 'Content 3' })

      const prompts = await getPromptsByIds([prompt1.id, prompt3.id, generateTestId()])

      expect(prompts.length).toBe(2)
      expect(prompts.map((p) => p.id)).toContain(prompt1.id)
      expect(prompts.map((p) => p.id)).toContain(prompt3.id)
      expect(prompts.map((p) => p.id)).not.toContain(prompt2.id)
    })
  })
})
