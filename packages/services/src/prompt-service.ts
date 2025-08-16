import { promptStorage } from '@promptliano/storage'
import {
  type CreatePromptBody,
  type UpdatePromptBody,
  type Prompt,
  PromptSchema,
  type PromptProject,
  PromptProjectSchema,
  PromptSuggestionsZodSchema
} from '@promptliano/schemas'

import { ApiError, promptsMap } from '@promptliano/shared'
import { ZodError } from 'zod'
import { generateStructuredData } from './gen-ai-services'
import { getCompactProjectSummary } from './utils/project-summary-service'

// Utility function to populate projectId on prompts from associations
async function populatePromptProjectId(prompt: Prompt): Promise<Prompt> {
  const promptProjects = await promptStorage.readPromptProjectAssociations()
  const association = promptProjects.find((link) => link.promptId === prompt.id)
  return {
    ...prompt,
    projectId: association?.projectId
  }
}

// Utility function to populate projectId on multiple prompts
async function populatePromptsProjectIds(prompts: Prompt[]): Promise<Prompt[]> {
  const promptProjects = await promptStorage.readPromptProjectAssociations()
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

  let promptProjects = await promptStorage.readPromptProjectAssociations()

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
  await promptStorage.writePromptProjectAssociations(promptProjects)
}

export async function removePromptFromProject(promptId: number, projectId: number): Promise<void> {
  let promptProjects = await promptStorage.readPromptProjectAssociations()
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

  await promptStorage.writePromptProjectAssociations(promptProjects)
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
  const promptProjects = await promptStorage.readPromptProjectAssociations()
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
  let promptProjects = await promptStorage.readPromptProjectAssociations()
  const initialLinkCount = promptProjects.length
  promptProjects = promptProjects.filter((link) => link.promptId !== promptId)

  if (promptProjects.length < initialLinkCount) {
    await promptStorage.writePromptProjectAssociations(promptProjects)
  }

  return true
}

export async function getPromptProjects(promptId: number): Promise<PromptProject[]> {
  const promptProjects = await promptStorage.readPromptProjectAssociations()
  return promptProjects.filter((link) => link.promptId === promptId)
}

export async function suggestPrompts(projectId: number, userInput: string, limit: number = 5): Promise<Prompt[]> {
  // Validate input
  if (!userInput || userInput.trim().length === 0) {
    throw new ApiError(400, 'User input is required for prompt suggestions', 'USER_INPUT_REQUIRED')
  }

  // Get all prompts for the project - moved outside try block for scope
  let prompts = await listPromptsByProject(projectId)

  try {
    // If no project-specific prompts, fall back to all prompts
    if (prompts.length === 0) {
      console.log(`No prompts associated with project ${projectId}, using all prompts as fallback`)
      prompts = await listAllPrompts()
      // If still no prompts exist at all, return empty
      if (prompts.length === 0) {
        console.log('No prompts exist in the system')
        return []
      }
    }

    // Get compact project summary for context
    let projectSummary = ''
    try {
      projectSummary = await getCompactProjectSummary(projectId)
    } catch (error) {
      // If project summary fails (e.g., no files), continue with empty summary
      console.log(
        `Warning: Could not get project summary for prompt suggestions: ${error instanceof Error ? error.message : String(error)}`
      )
      projectSummary = 'No project context available'
    }

    // Build prompt summaries with id, name, and content preview
    const promptSummaries = prompts.map((prompt) => ({
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
    const result = await generateStructuredData({
      prompt: userPrompt,
      schema: PromptSuggestionsZodSchema,
      systemMessage: systemPrompt
    })

    // Extract the suggestions from the result object
    const suggestions = result.object

    // Filter and order prompts based on AI suggestions
    const suggestedPromptIds = (suggestions.promptIds || []).slice(0, limit)
    let suggestedPrompts: Prompt[] = []

    // Maintain the order suggested by AI
    for (const promptId of suggestedPromptIds) {
      const prompt = prompts.find((p) => p.id === promptId)
      if (prompt) {
        suggestedPrompts.push(prompt)
      }
    }

    // If AI suggestions are insufficient, enhance with keyword-based matching
    if (suggestedPrompts.length < Math.min(3, limit)) {
      console.log(`AI only suggested ${suggestedPrompts.length} prompts, enhancing with keyword matching`)

      // Calculate relevance scores for remaining prompts
      const remainingPrompts = prompts.filter((p: Prompt) => !suggestedPrompts.find((sp: Prompt) => sp.id === p.id))
      const scoredPrompts = remainingPrompts.map((prompt: Prompt) => ({
        prompt,
        score: calculatePromptRelevance(userInput, prompt)
      }))

      // Add high-scoring prompts
      const additionalPrompts = scoredPrompts
        .filter((item: { prompt: Prompt; score: number }) => item.score > 0)
        .sort((a: { prompt: Prompt; score: number }, b: { prompt: Prompt; score: number }) => b.score - a.score)
        .slice(0, limit - suggestedPrompts.length)
        .map((item: { prompt: Prompt; score: number }) => item.prompt)

      suggestedPrompts = [...suggestedPrompts, ...additionalPrompts]
    }

    return suggestedPrompts
  } catch (error) {
    // If AI fails, fall back to keyword-based matching
    if (error instanceof Error && error.message.includes('generate')) {
      console.log('AI prompt suggestion failed, using keyword-based fallback')

      const scoredPrompts = prompts.map((prompt: Prompt) => ({
        prompt,
        score: calculatePromptRelevance(userInput, prompt)
      }))

      return scoredPrompts
        .filter((item: { prompt: Prompt; score: number }) => item.score > 0)
        .sort((a: { prompt: Prompt; score: number }, b: { prompt: Prompt; score: number }) => b.score - a.score)
        .slice(0, limit)
        .map((item: { prompt: Prompt; score: number }) => item.prompt)
    }

    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to suggest prompts: ${error instanceof Error ? error.message : String(error)}`,
      'SUGGEST_PROMPTS_FAILED'
    )
  }
}

/**
 * Calculate relevance score between user input and prompt
 */
function calculatePromptRelevance(userInput: string, prompt: Prompt): number {
  const userWords = userInput
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2)
  const promptText = `${prompt.name} ${prompt.content}`.toLowerCase()

  let score = 0

  // Direct word matches
  for (const word of userWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    const matches = promptText.match(regex)
    if (matches) {
      score += matches.length * 10
    }
  }
  // Boost for name matches
  const nameLower = prompt.name.toLowerCase()
  for (const word of userWords) {
    if (nameLower.includes(word)) {
      score += 20
    }
  }

  // Check for common programming concepts with enhanced MCP-specific terms
  const concepts = {
    debug: ['error', 'fix', 'troubleshoot', 'issue', 'problem', 'bug', 'resolve', 'trace', 'diagnose'],
    implement: ['create', 'build', 'develop', 'add', 'feature', 'code', 'write', 'construct', 'design'],
    optimize: ['performance', 'speed', 'improve', 'enhance', 'refactor', 'efficiency', 'fast', 'slow'],
    test: ['testing', 'unit', 'integration', 'e2e', 'spec', 'jest', 'playwright', 'mock', 'assertion'],
    document: ['docs', 'documentation', 'readme', 'guide', 'comment', 'explain', 'describe'],
    mcp: [
      'model context protocol',
      'tool',
      'integration',
      'consolidated-tools',
      'mcp-server',
      'mcp-client',
      'promptliano'
    ],
    api: ['endpoint', 'route', 'rest', 'graphql', 'http', 'request', 'response', 'hono'],
    database: ['sql', 'query', 'schema', 'migration', 'storage', 'sqlite', 'table', 'index'],
    ai: ['llm', 'model', 'prompt', 'generate', 'claude', 'openai', 'anthropic', 'gpt'],
    file: ['filesystem', 'directory', 'path', 'read', 'write', 'sync', 'summarize'],
    ticket: ['issue', 'task', 'todo', 'project', 'priority', 'status'],
    error: ['exception', 'failure', 'crash', 'broken', 'fail', 'retry', 'recovery'],
    config: ['configuration', 'settings', 'environment', 'setup', 'initialize'],
    auth: ['authentication', 'authorization', 'permission', 'security', 'token', 'key']
  }

  for (const [concept, related] of Object.entries(concepts)) {
    const userHasConcept =
      userInput.toLowerCase().includes(concept) || related.some((r) => userInput.toLowerCase().includes(r))
    const promptHasConcept = promptText.includes(concept) || related.some((r) => promptText.includes(r))

    if (userHasConcept && promptHasConcept) {
      score += 15
    }
  }

  // Slightly penalize generic prompts when user has specific request
  const genericTerms = ['general', 'overview', 'introduction', 'basic']
  const hasSpecificRequest = userWords.length > 3 || userWords.some((w) => w.length > 6)
  if (hasSpecificRequest && genericTerms.some((term) => nameLower.includes(term))) {
    // Only penalize if the prompt has no other matching concepts
    if (score < 15) {
      score = Math.max(0, score - 5) // Reduced penalty from 10 to 5
    }
  }
  // Bonus for exact phrase matches
  const twoWordPhrases = []
  for (let i = 0; i < userWords.length - 1; i++) {
    twoWordPhrases.push(`${userWords[i]} ${userWords[i + 1]}`)
  }
  for (const phrase of twoWordPhrases) {
    if (promptText.includes(phrase)) {
      score += 25 // Strong bonus for exact phrase matches
    }
  }
  return score
}
