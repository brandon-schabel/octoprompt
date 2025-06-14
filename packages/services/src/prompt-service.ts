import { promptStorage } from '@octoprompt/storage'
import {
  type CreatePromptBody,
  type UpdatePromptBody,
  type Prompt,
  PromptSchema,
  type PromptProject,
  PromptProjectSchema
} from '@octoprompt/schemas'

import { ApiError } from '@octoprompt/shared'
import { safeAsync, throwNotFound } from './utils/error-handlers'

// Utility function to populate projectId on prompts from associations
async function populatePromptProjectId(prompt: Prompt): Promise<Prompt> {
  const projectIds = await promptStorage.getPromptProjects(prompt.id)
  return {
    ...prompt,
    projectId: projectIds[0] // Take first project if multiple
  }
}

// Utility function to populate projectId on multiple prompts
async function populatePromptsProjectIds(prompts: Prompt[]): Promise<Prompt[]> {
  // Get all associations for all prompts in parallel
  const associations = await Promise.all(
    prompts.map(async (prompt) => ({
      promptId: prompt.id,
      projectIds: await promptStorage.getPromptProjects(prompt.id)
    }))
  )
  
  const associationMap = new Map(
    associations.map(({ promptId, projectIds }) => [promptId, projectIds[0]])
  )

  return prompts.map((prompt) => ({
    ...prompt,
    projectId: associationMap.get(prompt.id)
  }))
}

export async function createPrompt(data: CreatePromptBody): Promise<Prompt> {
  return safeAsync(
    async () => {
      // Create the prompt using V2 API
      const newPrompt = await promptStorage.create({
        name: data.name,
        content: data.content
      })

      // Add to project if specified
      if (data.projectId) {
        await promptStorage.addToProject(newPrompt.id, data.projectId)
      }

      // Return the prompt with populated projectId
      return {
        ...newPrompt,
        projectId: data.projectId
      }
    },
    {
      entityName: 'prompt',
      action: 'creating',
      details: { data }
    }
  )
}

export async function addPromptToProject(promptId: number, projectId: number): Promise<void> {
  return safeAsync(
    async () => {
      // Check if prompt exists
      const prompt = await promptStorage.getPrompt(promptId)
      if (!prompt) {
        throwNotFound('Prompt', promptId)
      }

      // First remove prompt from all projects (to maintain single project association behavior)
      const existingProjects = await promptStorage.getPromptProjects(promptId)
      for (const existingProjectId of existingProjects) {
        await promptStorage.removeFromProject(promptId, existingProjectId)
      }

      // Add to the new project
      await promptStorage.addToProject(promptId, projectId)
    },
    {
      entityName: 'prompt-project link',
      action: 'creating',
      details: { promptId, projectId }
    }
  )
}

export async function removePromptFromProject(promptId: number, projectId: number): Promise<void> {
  // Check if prompt exists
  const prompt = await promptStorage.getPrompt(promptId)
  if (!prompt) {
    throwNotFound('Prompt', promptId)
  }

  // Try to remove the association
  const removed = await promptStorage.removeFromProject(promptId, projectId)
  if (!removed) {
    throw new ApiError(
      404,
      `Association between prompt ${promptId} and project ${projectId} not found.`,
      'PROMPT_PROJECT_LINK_NOT_FOUND'
    )
  }
}

export async function getPromptById(promptId: number): Promise<Prompt> {
  const prompt = await promptStorage.getPrompt(promptId)
  if (!prompt) {
    throwNotFound('Prompt', promptId)
  }
  return await populatePromptProjectId(prompt)
}

export async function listAllPrompts(): Promise<Prompt[]> {
  const prompts = await promptStorage.getAllPrompts()
  // Sort by name
  prompts.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return await populatePromptsProjectIds(prompts)
}

export const getPromptsByIds = async (promptIds: number[]): Promise<Prompt[]> => {
  const prompts: Prompt[] = []
  for (const id of promptIds) {
    const prompt = await promptStorage.getPrompt(id)
    if (prompt) {
      prompts.push(prompt)
    }
  }
  return await populatePromptsProjectIds(prompts)
}

export async function listPromptsByProject(projectId: number): Promise<Prompt[]> {
  const prompts = await promptStorage.getProjectPrompts(projectId)
  // For prompts retrieved by project, we already know the projectId, so we can set it directly
  return prompts.map((prompt) => ({ ...prompt, projectId }))
}

export async function updatePrompt(promptId: number, data: UpdatePromptBody): Promise<Prompt> {
  return safeAsync(
    async () => {
      const updatedPrompt = await promptStorage.update(promptId, {
        name: data.name,
        content: data.content
      })

      if (!updatedPrompt) {
        throwNotFound('Prompt', promptId)
      }

      return await populatePromptProjectId(updatedPrompt)
    },
    {
      entityName: 'prompt',
      action: 'updating',
      details: { promptId, data }
    }
  )
}

export async function deletePrompt(promptId: number): Promise<boolean> {
  // The V2 delete method handles removing associations automatically
  return await promptStorage.delete(promptId)
}

export async function getPromptProjects(promptId: number): Promise<PromptProject[]> {
  const projectIds = await promptStorage.getPromptProjects(promptId)
  // Convert project IDs to PromptProject format
  return projectIds.map(projectId => ({
    promptId,
    projectId,
    created: Date.now() // This is a limitation of the V2 API - we don't store creation time
  }))
}
