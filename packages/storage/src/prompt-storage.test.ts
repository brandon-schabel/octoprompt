import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { promptStorage } from './prompt-storage'
import { type Prompt, type PromptProject } from '@promptliano/schemas'
import { DatabaseManager } from './database-manager'

describe('Prompt Storage (SQLite)', () => {
  let testPromptId: number

  beforeEach(async () => {
    // Get database instance and clear tables
    const db = DatabaseManager.getInstance()
    await db.clearAllTables()

    testPromptId = Date.now()
  })

  afterEach(async () => {
    // Clear all tables for next test
    const db = DatabaseManager.getInstance()
    await db.clearAllTables()
  })

  it('should create and read prompts', async () => {
    const testPrompt: Prompt = {
      id: testPromptId,
      name: 'Test Prompt',
      content: 'This is a test prompt',
      created: testPromptId,
      updated: testPromptId
    }

    // Write prompt
    const prompts = await promptStorage.readPrompts()
    prompts[String(testPromptId)] = testPrompt
    await promptStorage.writePrompts(prompts)

    // Read prompts
    const retrievedPrompts = await promptStorage.readPrompts()
    expect(retrievedPrompts[String(testPromptId)]).toEqual(testPrompt)
  })

  it('should handle prompt-project associations', async () => {
    const promptId = testPromptId
    const projectId = testPromptId + 1

    const association: PromptProject = {
      id: testPromptId + 2,
      promptId: promptId,
      projectId: projectId
    }

    // Write association
    await promptStorage.writePromptProjects([association])

    // Read associations
    const retrievedAssociations = await promptStorage.readPromptProjects()
    expect(retrievedAssociations).toHaveLength(1)
    expect(retrievedAssociations[0]).toEqual(association)
  })

  it('should update prompts', async () => {
    const testPrompt: Prompt = {
      id: testPromptId,
      name: 'Original Name',
      content: 'Original content',
      created: testPromptId,
      updated: testPromptId
    }

    // Create prompt
    const prompts = { [String(testPromptId)]: testPrompt }
    await promptStorage.writePrompts(prompts)

    // Update prompt
    const updatedPrompt: Prompt = {
      ...testPrompt,
      name: 'Updated Name',
      content: 'Updated content',
      updated: Date.now()
    }

    const updatedPrompts = { [String(testPromptId)]: updatedPrompt }
    await promptStorage.writePrompts(updatedPrompts)

    // Verify update
    const retrievedPrompts = await promptStorage.readPrompts()
    expect(retrievedPrompts[String(testPromptId)].name).toBe('Updated Name')
    expect(retrievedPrompts[String(testPromptId)].content).toBe('Updated content')
  })

  it('should delete prompts', async () => {
    const prompt1: Prompt = {
      id: testPromptId,
      name: 'Prompt 1',
      content: 'Content 1',
      created: testPromptId,
      updated: testPromptId
    }

    const prompt2: Prompt = {
      id: testPromptId + 1,
      name: 'Prompt 2',
      content: 'Content 2',
      created: testPromptId + 1,
      updated: testPromptId + 1
    }

    // Create prompts
    const prompts = {
      [String(prompt1.id)]: prompt1,
      [String(prompt2.id)]: prompt2
    }
    await promptStorage.writePrompts(prompts)

    // Delete one prompt
    delete prompts[String(prompt1.id)]
    await promptStorage.writePrompts(prompts)

    // Verify deletion
    const retrievedPrompts = await promptStorage.readPrompts()
    expect(retrievedPrompts[String(prompt1.id)]).toBeUndefined()
    expect(retrievedPrompts[String(prompt2.id)]).toEqual(prompt2)
  })

  it('should handle multiple prompt-project associations', async () => {
    const promptId1 = testPromptId
    const promptId2 = testPromptId + 1
    const projectId1 = testPromptId + 100
    const projectId2 = testPromptId + 101

    const associations: PromptProject[] = [
      {
        id: testPromptId + 200,
        promptId: promptId1,
        projectId: projectId1
      },
      {
        id: testPromptId + 201,
        promptId: promptId1,
        projectId: projectId2
      },
      {
        id: testPromptId + 202,
        promptId: promptId2,
        projectId: projectId1
      }
    ]

    // Write associations
    await promptStorage.writePromptProjects(associations)

    // Read and verify
    const retrievedAssociations = await promptStorage.readPromptProjects()
    expect(retrievedAssociations).toHaveLength(3)

    // Check that all associations are preserved
    const prompt1Associations = retrievedAssociations.filter((a) => a.promptId === promptId1)
    expect(prompt1Associations).toHaveLength(2)

    const project1Associations = retrievedAssociations.filter((a) => a.projectId === projectId1)
    expect(project1Associations).toHaveLength(2)
  })

  it('should generate unique IDs', () => {
    const id1 = promptStorage.generateId()
    const id2 = promptStorage.generateId()

    expect(id1).toBeDefined()
    expect(id2).toBeDefined()
    expect(id1).not.toBe(id2)
    expect(id2).toBeGreaterThan(id1)
  })
})
