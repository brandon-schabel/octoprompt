// packages/server/src/services/prompt-service.test.ts
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
  createPrompt,
  addPromptToProject,
  removePromptFromProject,
  getPromptById,
  listAllPrompts,
  listPromptsByProject,
  updatePrompt,
  deletePrompt,
  getPromptProjects
} from '@/services/prompt-service'
import type { Prompt, PromptProject, CreatePromptBody, UpdatePromptBody } from 'shared/src/schemas/prompt.schemas'
import type { PromptsStorage, PromptProjectsStorage } from '@/utils/storage/prompt-storage'
import { ApiError } from 'shared'
import { randomUUID } from 'crypto' // For mocking generateId if not mocking the whole module's function
import { normalizeToUnixMs } from '@/utils/parse-timestamp'

// In-memory stores for our mocks
let mockPromptsDb: PromptsStorage = {}
let mockPromptProjectsDb: PromptProjectsStorage = []

// Base for mock ID generation
let nextTestPromptIdBase = normalizeToUnixMs(new Date());

// Mock the promptStorage utility
mock.module('@/utils/storage/prompt-storage', () => ({
  promptStorage: {
    readPrompts: async () => JSON.parse(JSON.stringify(mockPromptsDb)),
    writePrompts: async (data: PromptsStorage) => {
      mockPromptsDb = JSON.parse(JSON.stringify(data))
      return mockPromptsDb
    },
    readPromptProjects: async () => JSON.parse(JSON.stringify(mockPromptProjectsDb)),
    writePromptProjects: async (data: PromptProjectsStorage) => {
      mockPromptProjectsDb = JSON.parse(JSON.stringify(data))
      return mockPromptProjectsDb
    },
    generateId: () => {
      nextTestPromptIdBase += 1; // Increment for unique IDs
      return nextTestPromptIdBase;
    }
  }
}))

// Helper to generate random strings for test data
const randomString = (length = 8) => Math.random().toString(36).substring(2, 2 + length)
// Helper to generate mock numeric IDs (timestamps)
const generateMockId = () => { // Renaming to avoid confusion, and use the new strategy
  nextTestPromptIdBase += 1;
  return nextTestPromptIdBase;
}

describe('Prompt Service (File Storage)', () => {
  let defaultProjectId: number
  let anotherProjectId: number

  beforeEach(async () => {
    // Reset in-memory stores before each test
    mockPromptsDb = {}
    mockPromptProjectsDb = []
    nextTestPromptIdBase = normalizeToUnixMs(new Date()); // Reset base for each test

    // Define some project IDs for testing (these don't need to exist in a project store for these tests)
    defaultProjectId = 1
    anotherProjectId = 2
  })

  test('createPrompt creates a new prompt and optionally links to a project', async () => {
    const input: CreatePromptBody = {
      name: `TestPrompt_${randomString()}`,
      content: 'Some prompt content',
      projectId: defaultProjectId
    }
    const created = await createPrompt(input)

    expect(created.id).toBeDefined()
    expect(created.name).toBe(input.name)
    expect(created.content).toBe(input.content)
    expect(mockPromptsDb[created.id]).toEqual(created)

    // Check if linked to project
    const links = mockPromptProjectsDb.filter(link => link.promptId === created.id)
    expect(links.length).toBe(1)
    expect(links[0].projectId).toBe(defaultProjectId)

    // Create without projectId
    const inputNoProject: CreatePromptBody = {
      name: `TestPromptNoProj_${randomString()}`,
      content: 'No project content'
    }
    const createdNoProject = await createPrompt(inputNoProject)
    expect(createdNoProject.id).toBeDefined()
    expect(mockPromptsDb[createdNoProject.id]).toEqual(createdNoProject)
    const linksNoProject = mockPromptProjectsDb.filter(link => link.promptId === createdNoProject.id)
    expect(linksNoProject.length).toBe(0)
  })

  test('createPrompt throws ApiError on ID conflict', async () => {
    const id = generateMockId() // Use numeric ID
    mockPromptsDb[id] = { id, name: 'Preexisting', content: '...', created: normalizeToUnixMs(new Date()), updated: normalizeToUnixMs(new Date()) }

    const input: CreatePromptBody = { name: 'New Prompt', content: 'Content' }
    // Temporarily mock generateId to force a collision for this test
    const { promptStorage } = await import('@/utils/storage/prompt-storage')
    const originalGenerateId = promptStorage.generateId
    // To force a collision, we need to make generateId return the *same* ID as a pre-existing one.
    // The `id` variable below is set to what generateMockId() *would* return next.
    // Then we pre-populate mockPromptsDb with it. Then make generateId return it again.
    const collidingId = nextTestPromptIdBase + 1; // Predict next ID from our strategy
    mockPromptsDb[collidingId] = { id: collidingId, name: 'Preexisting', content: '...', created: normalizeToUnixMs(new Date()), updated: normalizeToUnixMs(new Date()) };
    nextTestPromptIdBase++; // Consume this ID from our sequence so generateMockId() doesn't also create it later in the test

    promptStorage.generateId = () => collidingId; // Force collision

    await expect(createPrompt(input)).rejects.toThrow(new ApiError(500, `Prompt ID conflict for ${collidingId}`, 'PROMPT_ID_CONFLICT'))

    promptStorage.generateId = originalGenerateId // Restore
  })


  test('addPromptToProject associates a prompt with a project, replacing existing associations for that prompt', async () => {
    const prompt1_created = await createPrompt({ name: 'P1', content: 'C1' })

    // Associate with defaultProjectId
    await addPromptToProject(prompt1_created.id, defaultProjectId)
    let links = mockPromptProjectsDb.filter(link => link.promptId === prompt1_created.id)
    expect(links.length).toBe(1)
    expect(links[0].projectId).toBe(defaultProjectId)

    // Associate with anotherProjectId (should replace the first one)
    await addPromptToProject(prompt1_created.id, anotherProjectId)
    links = mockPromptProjectsDb.filter(link => link.promptId === prompt1_created.id)
    expect(links.length).toBe(1)
    expect(links[0].projectId).toBe(anotherProjectId) // Now associated with the new project

    // Add same association again (should do nothing)
    await addPromptToProject(prompt1_created.id, anotherProjectId)
    links = mockPromptProjectsDb.filter(link => link.promptId === prompt1_created.id)
    expect(links.length).toBe(1)

    const nonExistentPromptTestId = generateMockId();
    await expect(addPromptToProject(nonExistentPromptTestId, defaultProjectId))
      .rejects.toThrow(new ApiError(404, `Prompt with ID ${nonExistentPromptTestId} not found.`, 'PROMPT_NOT_FOUND'))
  })

  test('removePromptFromProject disassociates a prompt from a project', async () => {
    const prompt_created = await createPrompt({ name: 'AssocTest', content: 'Content' })
    await addPromptToProject(prompt_created.id, defaultProjectId) // Link it first

    let links = mockPromptProjectsDb.filter(link => link.promptId === prompt_created.id && link.projectId === defaultProjectId)
    expect(links.length).toBe(1)

    await removePromptFromProject(prompt_created.id, defaultProjectId)
    links = mockPromptProjectsDb.filter(link => link.promptId === prompt_created.id && link.projectId === defaultProjectId)
    expect(links.length).toBe(0)

    // Try to remove non-existent link
    await expect(removePromptFromProject(prompt_created.id, defaultProjectId))
      .rejects.toThrow(new ApiError(404, `Association between prompt ${prompt_created.id} and project ${defaultProjectId} not found.`, 'PROMPT_PROJECT_LINK_NOT_FOUND'))

    // Try to remove link for non-existent prompt
    const nonExistentPromptId = generateMockId()
    await expect(removePromptFromProject(nonExistentPromptId, defaultProjectId))
      .rejects.toThrow(new ApiError(404, `Prompt with ID ${nonExistentPromptId} not found.`, 'PROMPT_NOT_FOUND'))
  })

  test('getPromptById returns prompt if found, throws ApiError if not', async () => {
    const created = await createPrompt({ name: 'GetMe', content: 'Get me content' })
    const found = await getPromptById(created.id)
    expect(found).toEqual(created)
    const nonExistentId = generateMockId()
    await expect(getPromptById(nonExistentId)).rejects.toThrow(new ApiError(404, `Prompt with ID ${nonExistentId} not found.`, 'PROMPT_NOT_FOUND'))
  })

  test('listAllPrompts returns all prompts', async () => {
    let all = await listAllPrompts()
    expect(all.length).toBe(0)

    const p1 = await createPrompt({ name: 'P1', content: 'C1' })
    const p2 = await createPrompt({ name: 'P2', content: 'C2' })
    all = await listAllPrompts()
    expect(all.length).toBe(2)
    expect(all).toEqual(expect.arrayContaining([p1, p2]))
  })

  test('listPromptsByProject returns only prompts linked to that project', async () => {
    const p1 = await createPrompt({ name: 'P1 for ProjA', content: 'C1' })
    const p2 = await createPrompt({ name: 'P2 for ProjB', content: 'C2' })
    const p3 = await createPrompt({ name: 'P3 for ProjA', content: 'C3' })
    const p4Unlinked = await createPrompt({ name: 'P4 Unlinked', content: 'C4' })


    await addPromptToProject(p1.id, defaultProjectId)
    await addPromptToProject(p2.id, anotherProjectId)
    await addPromptToProject(p3.id, defaultProjectId)


    const fromA = await listPromptsByProject(defaultProjectId)
    expect(fromA.length).toBe(2)
    expect(fromA).toEqual(expect.arrayContaining([p1, p3]))
    expect(fromA).not.toEqual(expect.arrayContaining([p2, p4Unlinked]))


    const fromB = await listPromptsByProject(anotherProjectId)
    expect(fromB.length).toBe(1)
    expect(fromB[0]).toEqual(p2)

    const fromUnlinked = await listPromptsByProject(generateMockId() /* Use a mock numeric ID */)
    expect(fromUnlinked.length).toBe(0)
  })

  test('updatePrompt updates fields and returns updated prompt', async () => {
    const created = await createPrompt({ name: 'Before', content: 'Old' })
    const updates: UpdatePromptBody = { name: 'After', content: 'New content' }
    // required to add a very small delay
    await new Promise(resolve => setTimeout(resolve, 1))
    const updated = await updatePrompt(created.id, updates)

    expect(updated.name).toBe('After')
    expect(updated.content).toBe('New content')
    expect(updated.updated).not.toBe(created.updated)
    expect(mockPromptsDb[created.id]).toEqual(updated)
  })

  test('updatePrompt throws ApiError if prompt does not exist', async () => {
    const fakeId = generateMockId()
    await expect(updatePrompt(fakeId, { name: 'X' })).rejects.toThrow(new ApiError(404, `Prompt with ID ${fakeId} not found for update.`, 'PROMPT_NOT_FOUND'))
  })

  test('deletePrompt returns true if deleted, false if nonexistent, and removes links', async () => {
    const prompt = await createPrompt({ name: 'DelMe', content: 'ToDelete' })
    await addPromptToProject(prompt.id, defaultProjectId) // Link it

    expect(mockPromptsDb[prompt.id]).toBeDefined()
    expect(mockPromptProjectsDb.some(link => link.promptId === prompt.id)).toBe(true)

    const success = await deletePrompt(prompt.id)
    expect(success).toBe(true)
    expect(mockPromptsDb[prompt.id]).toBeUndefined()
    expect(mockPromptProjectsDb.some(link => link.promptId === prompt.id)).toBe(false)


    const nonExistentDeleteId = generateMockId()
    const nonExistentDelete = await deletePrompt(nonExistentDeleteId)
    expect(nonExistentDelete).toBe(false)

    // Deleting an already deleted prompt
    const again = await deletePrompt(prompt.id)
    expect(again).toBe(false) // Should return false as it's no longer in mockPromptsDb
  })

  test('getPromptProjects returns all project associations for a prompt', async () => {
    const prompt1 = await createPrompt({ name: 'P1', content: 'C1' })

    // Add to default project (replaces any previous for prompt1)
    await addPromptToProject(prompt1.id, defaultProjectId)
    // To test multiple projects, we'd need a different add mechanism or manual mockPromptProjectsDb setup
    // For current addPromptToProject, it only allows one project link.
    // So, getPromptProjects will return at most one.

    // If we want to test multiple, we have to manually add to mockPromptProjectsDb after the createPrompt logic:
    const link1Id = generateMockId();
    await new Promise(resolve => setTimeout(resolve, 1)); // ensure unique ID
    const link2Id = generateMockId();

    mockPromptProjectsDb = [
      { id: link1Id, promptId: prompt1.id, projectId: defaultProjectId },
      { id: link2Id, promptId: prompt1.id, projectId: anotherProjectId }
    ];


    const projectsForP1 = await getPromptProjects(prompt1.id)
    expect(projectsForP1.length).toBe(2) // Based on manual mock setup
    expect(projectsForP1.map(p => p.projectId)).toEqual(expect.arrayContaining([defaultProjectId, anotherProjectId]))

    const prompt2 = await createPrompt({ name: 'P2', content: 'C2' })
    const projectsForP2 = await getPromptProjects(prompt2.id)
    expect(projectsForP2.length).toBe(0)
  })
})