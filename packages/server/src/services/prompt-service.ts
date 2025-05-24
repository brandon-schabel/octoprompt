import { promptStorage, type PromptsStorage, type PromptProjectsStorage } from '@/utils/storage/prompt-storage'
import {
  CreatePromptBody,
  UpdatePromptBody,
  Prompt,
  PromptSchema,
  PromptProject,
  PromptProjectSchema
} from 'shared/src/schemas/prompt.schemas'

import { normalizeToUnixMs } from '@/utils/parse-timestamp'
import { ApiError } from 'shared'
import { ZodError } from 'zod'

export async function createPrompt(data: CreatePromptBody): Promise<Prompt> {
  const promptId = promptStorage.generateId()
  const now = normalizeToUnixMs(new Date())

  const newPromptData: Prompt = {
    id: promptId,
    name: data.name,
    content: data.content,
    created: now,
    updated: now
    // projectId is not part of the core Prompt schema, handled by associations
  }

  try {
    PromptSchema.parse(newPromptData) // Validate before adding to storage
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed for new prompt data: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(500, `Internal validation error creating prompt.`, 'PROMPT_VALIDATION_ERROR', error.flatten().fieldErrors)
    }
    throw error // Should not happen if data is constructed correctly
  }

  const allPrompts = await promptStorage.readPrompts()

  if (allPrompts[promptId]) {
    throw new ApiError(500, `Prompt ID conflict for ${promptId}`, 'PROMPT_ID_CONFLICT')
  }

  allPrompts[promptId] = newPromptData
  await promptStorage.writePrompts(allPrompts)

  if (data.projectId) {
    await addPromptToProject(newPromptData.id, data.projectId)
  }

  return newPromptData
}

export async function addPromptToProject(promptId: number, projectId: number): Promise<void> {
  const allPrompts = await promptStorage.readPrompts()
  if (!allPrompts[promptId]) {
    throw new ApiError(404, `Prompt with ID ${promptId} not found.`, 'PROMPT_NOT_FOUND')
  }

  let promptProjects = await promptStorage.readPromptProjects()

  // Check if association already exists
  const existingLink = promptProjects.find(link => link.promptId === promptId && link.projectId === projectId)
  if (existingLink) {
    return // Association already exists, do nothing
  }

  // In the previous DB version, this was effectively an "set project for prompt"
  // For a file-based many-to-many, we usually add.
  // The old code `db.prepare('DELETE FROM prompt_projects WHERE prompt_id = ?').run(promptId)`
  // would remove the prompt from ALL projects before adding to one.
  // This is a change in behavior if we simply add.
  // Let's stick to the previous behavior for now: a prompt is associated with one project via this call.
  // If multiple projects are desired, a different method or logic modification is needed.
  // The schema `CreatePromptBodySchema` implies one project association at creation.
  // The `listPromptsByProject` and `removePromptFromProject` suggest many-to-many is possible.

  // Re-evaluating: The original DB `addPromptToProject` did NOT remove all other associations.
  // It only added a new one. The `DELETE FROM prompt_projects WHERE prompt_id = ?` was in `createPrompt` if a `projectId` was given.
  // Let's look at the `createPrompt`'s use of `addPromptToProject`.
  // The DB `addPromptToProject`:
  // `db.prepare('DELETE FROM prompt_projects WHERE prompt_id = ?').run(promptId)` THIS IS THE LINE.
  // So yes, it first removes all project associations for that prompt, then adds the new one.
  // This means a prompt is assigned to at most one project via the `createPrompt` or direct `addPromptToProject` flow.

  // To replicate: filter out existing links for this promptId, then add the new one.
  promptProjects = promptProjects.filter(link => link.promptId !== promptId)

  const newLink: PromptProject = {
    id: promptStorage.generateId(), // ID for the association itself
    promptId: promptId,
    projectId: projectId
  }

  try {
    PromptProjectSchema.parse(newLink)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed for new prompt-project link: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(500, `Internal validation error linking prompt to project.`, 'PROMPT_LINK_VALIDATION_ERROR', error.flatten().fieldErrors)
    }
    throw error
  }

  promptProjects.push(newLink)
  await promptStorage.writePromptProjects(promptProjects)
}

export async function removePromptFromProject(promptId: number, projectId: number): Promise<void> {
  let promptProjects = await promptStorage.readPromptProjects()
  const initialLinkCount = promptProjects.length

  promptProjects = promptProjects.filter(link => !(link.promptId === promptId && link.projectId === projectId))

  if (promptProjects.length === initialLinkCount) {
    const allPrompts = await promptStorage.readPrompts()
    if (!allPrompts[promptId]) {
      throw new ApiError(404, `Prompt with ID ${promptId} not found.`, 'PROMPT_NOT_FOUND')
    }
    // If prompt exists, but link didn't, then the association was not found.
    throw new ApiError(
      404,
      `Association between prompt ${promptId} and project ${projectId} not found.`,
      'PROMPT_PROJECT_LINK_NOT_FOUND'
    )
  }

  await promptStorage.writePromptProjects(promptProjects)
}

export async function getPromptById(promptId: number): Promise<Prompt> {
  const allPrompts = await promptStorage.readPrompts()
  const found = allPrompts[promptId]
  if (!found) {
    throw new ApiError(404, `Prompt with ID ${promptId} not found.`, 'PROMPT_NOT_FOUND')
  }
  return found
}

export async function listAllPrompts(): Promise<Prompt[]> {
  const allPromptsData = await promptStorage.readPrompts()
  const promptList = Object.values(allPromptsData)
  // Optional: sort if needed, e.g., by upated or name
  promptList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return promptList
}

export const getPromptsByIds = async (promptIds: string[]): Promise<Prompt[]> => {
  const allPrompts = await promptStorage.readPrompts()
  return promptIds.map(id => allPrompts[id]).filter(Boolean) as Prompt[]
}

export async function listPromptsByProject(projectId: number): Promise<Prompt[]> {
  const promptProjects = await promptStorage.readPromptProjects()
  const relevantPromptIds = promptProjects
    .filter(link => link.projectId === projectId)
    .map(link => link.promptId)

  if (relevantPromptIds.length === 0) {
    return []
  }
  const allPrompts = await promptStorage.readPrompts()
  return relevantPromptIds.map(promptId => allPrompts[promptId]).filter(Boolean) as Prompt[] // filter(Boolean) to remove undefined if a link exists for a deleted prompt
}

export async function updatePrompt(promptId: number, data: UpdatePromptBody): Promise<Prompt> {
  const allPrompts = await promptStorage.readPrompts()
  const existingPrompt = allPrompts[promptId]

  if (!existingPrompt) {
    throw new ApiError(404, `Prompt with ID ${promptId} not found for update.`, 'PROMPT_NOT_FOUND')
  }

  const updatedPromptData: Prompt = {
    ...existingPrompt,
    name: data.name ?? existingPrompt.name,
    content: data.content ?? existingPrompt.content,
    updated: normalizeToUnixMs(new Date())
  }

  try {
    PromptSchema.parse(updatedPromptData)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed updating prompt ${promptId}: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(500, `Internal validation error updating prompt.`, 'PROMPT_VALIDATION_ERROR', error.flatten().fieldErrors)
    }
    throw error
  }

  allPrompts[promptId] = updatedPromptData
  await promptStorage.writePrompts(allPrompts)
  return updatedPromptData
}

export async function deletePrompt(promptId: number): Promise<boolean> {
  const allPrompts = await promptStorage.readPrompts()
  if (!allPrompts[promptId]) {
    return false // Prompt not found, nothing to delete
  }

  delete allPrompts[promptId]
  await promptStorage.writePrompts(allPrompts)

  // Also remove any associations for this prompt
  let promptProjects = await promptStorage.readPromptProjects()
  const initialLinkCount = promptProjects.length
  promptProjects = promptProjects.filter(link => link.promptId !== promptId)

  if (promptProjects.length < initialLinkCount) {
    await promptStorage.writePromptProjects(promptProjects)
  }

  return true
}

export async function getPromptProjects(promptId: number): Promise<PromptProject[]> {
  const promptProjects = await promptStorage.readPromptProjects()
  return promptProjects.filter(link => link.promptId === promptId)
}

