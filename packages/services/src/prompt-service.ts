import { promptStorage } from '@octoprompt/storage'
import {
  type CreatePromptBody,
  type UpdatePromptBody,
  type Prompt,
  PromptSchema,
  type PromptProject,
  PromptProjectSchema,
  PromptSuggestionsZodSchema
} from '@octoprompt/schemas'

import { ApiError, promptsMap } from '@octoprompt/shared'
import { ZodError } from 'zod'
import { generateStructuredData } from './gen-ai-services'
import { getCompactProjectSummary } from './utils/get-full-project-summary'

// Utility function to populate projectId on prompts from associations
async function populatePromptProjectId(prompt: Prompt): Promise<Prompt> {
  const promptProjects = await promptStorage.readPromptProjects()
  const association = promptProjects.find((link) => link.promptId === prompt.id)
  return {
    ...prompt,
    projectId: association?.projectId
  }
}

// Utility function to populate projectId on multiple prompts
async function populatePromptsProjectIds(prompts: Prompt[]): Promise<Prompt[]> {
  const promptProjects = await promptStorage.readPromptProjects()
  const associationMap = new Map(promptProjects.map((link) => [link.promptId, link.projectId]))

  return prompts.map((prompt) => ({
    ...prompt,
    projectId: associationMap.get(prompt.id)
  }))
}

export async function createPrompt(data: CreatePromptBody): Promise<Prompt> {
  const now = Date.now()

  try {
    const promptId = promptStorage.generateId()

    const newPromptData: Prompt = {
      id: promptId,
      name: data.name,
      content: data.content,
      projectId: data.projectId,
      created: now,
      updated: now
    }

    PromptSchema.parse(newPromptData) // Validate before adding to storage

    const allPrompts = await promptStorage.readPrompts()
    allPrompts[promptId] = newPromptData
    await promptStorage.writePrompts(allPrompts)

    if (data.projectId) {
      await addPromptToProject(newPromptData.id, data.projectId)
    }

    // Return the prompt with populated projectId
    return await populatePromptProjectId(newPromptData)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed for new prompt data: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(
        500,
        `Internal validation error creating prompt.`,
        'PROMPT_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    throw error
  }
}

export async function addPromptToProject(promptId: number, projectId: number): Promise<void> {
  const allPrompts = await promptStorage.readPrompts()
  if (!allPrompts[promptId]) {
    throw new ApiError(404, `Prompt with ID ${promptId} not found.`, 'PROMPT_NOT_FOUND')
  }

  let promptProjects = await promptStorage.readPromptProjects()

  // Check if association already exists
  const existingLink = promptProjects.find((link) => link.promptId === promptId && link.projectId === projectId)
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
  promptProjects = promptProjects.filter((link) => link.promptId !== promptId)

  const associationId = promptStorage.generateId()

  const newLink: PromptProject = {
    id: associationId, // ID for the association itself
    promptId: promptId,
    projectId: projectId
  }

  try {
    PromptProjectSchema.parse(newLink)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed for new prompt-project link: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(
        500,
        `Internal validation error linking prompt to project.`,
        'PROMPT_LINK_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    throw error
  }

  promptProjects.push(newLink)
  await promptStorage.writePromptProjects(promptProjects)
}

export async function removePromptFromProject(promptId: number, projectId: number): Promise<void> {
  let promptProjects = await promptStorage.readPromptProjects()
  const initialLinkCount = promptProjects.length

  promptProjects = promptProjects.filter((link) => !(link.promptId === promptId && link.projectId === projectId))

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
  return await populatePromptProjectId(found)
}

export async function listAllPrompts(): Promise<Prompt[]> {
  const allPromptsData = await promptStorage.readPrompts()
  const promptList = Object.values(allPromptsData)
  // Optional: sort if needed, e.g., by upated or name
  promptList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return await populatePromptsProjectIds(promptList)
}

export const getPromptsByIds = async (promptIds: number[]): Promise<Prompt[]> => {
  const allPrompts = await promptStorage.readPrompts()
  const prompts = promptIds.map((id) => allPrompts[id]).filter(Boolean) as Prompt[]
  return await populatePromptsProjectIds(prompts)
}

export async function listPromptsByProject(projectId: number): Promise<Prompt[]> {
  const promptProjects = await promptStorage.readPromptProjects()
  const relevantPromptIds = promptProjects.filter((link) => link.projectId === projectId).map((link) => link.promptId)

  if (relevantPromptIds.length === 0) {
    return []
  }
  const allPrompts = await promptStorage.readPrompts()
  const prompts = relevantPromptIds.map((promptId) => allPrompts[promptId]).filter(Boolean) as Prompt[]
  // For prompts retrieved by project, we already know the projectId, so we can set it directly
  return prompts.map((prompt) => ({ ...prompt, projectId }))
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
    updated: Date.now()
  }

  try {
    PromptSchema.parse(updatedPromptData)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed updating prompt ${promptId}: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(
        500,
        `Internal validation error updating prompt.`,
        'PROMPT_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    throw error
  }

  allPrompts[promptId] = updatedPromptData
  await promptStorage.writePrompts(allPrompts)
  return await populatePromptProjectId(updatedPromptData)
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
  promptProjects = promptProjects.filter((link) => link.promptId !== promptId)

  if (promptProjects.length < initialLinkCount) {
    await promptStorage.writePromptProjects(promptProjects)
  }

  return true
}

export async function getPromptProjects(promptId: number): Promise<PromptProject[]> {
  const promptProjects = await promptStorage.readPromptProjects()
  return promptProjects.filter((link) => link.promptId === promptId)
}

export async function suggestPrompts(projectId: number, userInput: string, limit: number = 5): Promise<Prompt[]> {
  try {
    // Get all prompts for the project
    const projectPrompts = await listPromptsByProject(projectId)

    if (projectPrompts.length === 0) {
      return []
    }

    // Get compact project summary for context
    const projectSummary = await getCompactProjectSummary(projectId)

    // Build prompt summaries with id, name, and content preview
    const promptSummaries = projectPrompts.map((prompt) => ({
      id: prompt.id,
      name: prompt.name,
      contentPreview: prompt.content.slice(0, 200) + (prompt.content.length > 200 ? '...' : '')
    }))

    const systemPrompt = promptsMap.suggestPrompts

    const userPrompt = `
<user_input>
${userInput}
</user_input>

<project_summary>
${projectSummary}
</project_summary>

<available_prompts>
${JSON.stringify(promptSummaries, null, 2)}
</available_prompts>

Based on the user's input and project context, suggest the most relevant prompts that would help them accomplish their task. Return only the prompt IDs.
`

    // Use AI to get suggested prompt IDs
    const suggestions = await generateStructuredData(systemPrompt, userPrompt, PromptSuggestionsZodSchema)

    // Filter and order prompts based on AI suggestions
    const suggestedPromptIds = suggestions.promptIds.slice(0, limit)
    const suggestedPrompts: Prompt[] = []

    // Maintain the order suggested by AI
    for (const promptId of suggestedPromptIds) {
      const prompt = projectPrompts.find((p) => p.id === promptId)
      if (prompt) {
        suggestedPrompts.push(prompt)
      }
    }

    return suggestedPrompts
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to suggest prompts: ${error instanceof Error ? error.message : String(error)}`,
      'SUGGEST_PROMPTS_FAILED'
    )
  }
}
