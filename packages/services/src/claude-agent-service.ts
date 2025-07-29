import { claudeAgentStorage } from '@promptliano/storage'
import {
  type CreateClaudeAgentBody,
  type UpdateClaudeAgentBody,
  type ClaudeAgent,
  ClaudeAgentSchema,
  type ClaudeAgentProject,
  ClaudeAgentProjectSchema,
  type AgentSuggestions,
  AgentSuggestionsSchema
} from '@promptliano/schemas'

import { ApiError, promptsMap } from '@promptliano/shared'
import { ZodError } from 'zod'
import { generateStructuredData } from './gen-ai-services'
import { getCompactProjectSummary } from './utils/project-summary-service'
import * as path from 'path'
import * as fs from 'fs/promises'
import { relativePosix, toPosixPath, toOSPath } from './utils/path-utils'

// Utility function to populate projectId on agents from associations
async function populateAgentProjectId(projectPath: string, agent: ClaudeAgent): Promise<ClaudeAgent> {
  const agentProjects = await claudeAgentStorage.readAgentProjects()
  const association = agentProjects.find((link) => link.agentId === agent.id)
  return {
    ...agent,
    projectId: association?.projectId
  }
}

// Utility function to populate projectId on multiple agents
async function populateAgentsProjectIds(projectPath: string, agents: ClaudeAgent[]): Promise<ClaudeAgent[]> {
  const agentProjects = await claudeAgentStorage.readAgentProjects()
  const associationMap = new Map(agentProjects.map((link) => [link.agentId, link.projectId]))

  return agents.map((agent) => ({
    ...agent,
    projectId: associationMap.get(agent.id)
  }))
}

export async function createAgent(projectPath: string, data: CreateClaudeAgentBody): Promise<ClaudeAgent> {
  const now = Date.now()

  try {
    // Generate agent ID based on name
    const agentId = claudeAgentStorage.generateAgentId(data.name)

    // Prepare file path
    const filePath = data.filePath || `${agentId}.md`
    const fullFilePath = path.join(claudeAgentStorage.getAgentsDir(projectPath), filePath)

    const newAgentData: ClaudeAgent = {
      id: now,
      name: data.name,
      description: data.description,
      color: data.color,
      filePath: relativePosix(projectPath, fullFilePath),
      content: data.content,
      projectId: data.projectId,
      created: now,
      updated: now
    }

    ClaudeAgentSchema.parse(newAgentData) // Validate before saving

    // Write agent to filesystem
    const savedAgent = await claudeAgentStorage.writeAgent(projectPath, agentId, newAgentData)

    // Add project association if specified
    if (data.projectId) {
      await associateAgentWithProject(savedAgent.id, data.projectId)
    }

    // Return the agent with populated projectId
    return await populateAgentProjectId(projectPath, savedAgent)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed for new agent data: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(
        500,
        'Internal validation error creating agent.',
        'AGENT_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    throw error
  }
}

export async function associateAgentWithProject(agentId: number, projectId: number): Promise<void> {
  try {
    // Check if association already exists
    const agentProjects = await claudeAgentStorage.readAgentProjects()
    const existingLink = agentProjects.find((link) => link.agentId === agentId && link.projectId === projectId)

    if (existingLink) {
      return // Association already exists
    }

    // Following the prompt service pattern - one agent per project association
    // Remove existing associations for this agent first
    const filteredProjects = agentProjects.filter((link) => link.agentId !== agentId)

    // Add new association
    await claudeAgentStorage.addAgentProjectAssociation(agentId, projectId)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed for agent-project link: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(
        500,
        'Internal validation error linking agent to project.',
        'AGENT_LINK_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    throw error
  }
}

export async function getAgentById(projectPath: string, agentId: string): Promise<ClaudeAgent> {
  const agent = await claudeAgentStorage.getAgentById(projectPath, agentId)
  if (!agent) {
    throw new ApiError(404, `Agent with ID ${agentId} not found.`, 'AGENT_NOT_FOUND')
  }
  return await populateAgentProjectId(projectPath, agent)
}

export async function listAgents(projectPath: string): Promise<ClaudeAgent[]> {
  const agentsData = await claudeAgentStorage.readAgents(projectPath)
  const agentList = Object.values(agentsData)
  // Sort by name
  agentList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return await populateAgentsProjectIds(projectPath, agentList)
}

export async function getAgentsByProjectId(projectPath: string, projectId: number): Promise<ClaudeAgent[]> {
  const agents = await claudeAgentStorage.getAgentsByProjectId(projectPath, projectId)
  // Agents from this method already have projectId populated
  return agents.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export async function updateAgent(
  projectPath: string,
  agentId: string,
  data: UpdateClaudeAgentBody
): Promise<ClaudeAgent> {
  const existingAgent = await claudeAgentStorage.getAgentById(projectPath, agentId)

  if (!existingAgent) {
    throw new ApiError(404, `Agent with ID ${agentId} not found for update.`, 'AGENT_NOT_FOUND')
  }

  const updatedAgentData: ClaudeAgent = {
    ...existingAgent,
    name: data.name ?? existingAgent.name,
    description: data.description ?? existingAgent.description,
    color: data.color ?? existingAgent.color,
    content: data.content ?? existingAgent.content,
    updated: Date.now()
  }

  // Handle file path change if specified
  if (data.filePath && data.filePath !== existingAgent.filePath) {
    // Delete old file
    const oldFullPath = path.join(projectPath, toOSPath(existingAgent.filePath))
    try {
      await fs.unlink(oldFullPath)
    } catch (error) {
      console.warn(`Could not delete old agent file: ${oldFullPath}`, error)
    }

    updatedAgentData.filePath = toPosixPath(data.filePath)
  }

  try {
    ClaudeAgentSchema.parse(updatedAgentData)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed updating agent ${agentId}: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(
        500,
        'Internal validation error updating agent.',
        'AGENT_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    throw error
  }

  const savedAgent = await claudeAgentStorage.writeAgent(projectPath, agentId, updatedAgentData)
  return await populateAgentProjectId(projectPath, savedAgent)
}

export async function deleteAgent(projectPath: string, agentId: string): Promise<boolean> {
  const agent = await claudeAgentStorage.getAgentById(projectPath, agentId)
  if (!agent) {
    return false // Agent not found
  }

  // Delete file
  const deleted = await claudeAgentStorage.deleteAgent(projectPath, agentId)

  if (deleted) {
    // Remove any project associations
    const agentProjects = await claudeAgentStorage.readAgentProjects()
    for (const link of agentProjects) {
      if (link.agentId === agent.id) {
        await claudeAgentStorage.removeAgentProjectAssociation(agent.id, link.projectId)
      }
    }
  }

  return deleted
}

export async function suggestAgents(
  projectId: number,
  context: string = '',
  limit: number = 5
): Promise<AgentSuggestions> {
  try {
    // Get project summary for context
    let projectSummary = ''
    try {
      projectSummary = await getCompactProjectSummary(projectId)
    } catch (error) {
      console.log(
        `Warning: Could not get project summary for agent suggestions: ${error instanceof Error ? error.message : String(error)}`
      )
      projectSummary = 'No project context available'
    }

    // Create a system prompt for agent suggestions
    const systemPrompt = `
You are an expert at analyzing project codebases and suggesting specialized AI agents that would be most helpful for development tasks.

## Your Task:
Based on the project structure, technologies used, and any user context provided, suggest AI agents that would provide the most value for this specific project.

## Agent Creation Guidelines:
1. Each agent should have a specific, well-defined purpose
2. Agents should complement each other without overlapping responsibilities
3. Consider the project's tech stack, architecture patterns, and coding style
4. Suggest agents that address common pain points in the type of project analyzed
5. Each agent should have a clear specialty (e.g., "Frontend Performance Expert", "Database Query Optimizer", "Test Coverage Specialist")

## Output Requirements:
- Provide practical, actionable agent suggestions
- Each agent's content should be a complete markdown instruction set
- Include specific technologies and patterns relevant to this project
- Make agents that would genuinely help with real development tasks
`

    const userPrompt = `
<project_summary>
${projectSummary}
</project_summary>

<user_context>
${context || 'General development assistance needed'}
</user_context>

Based on this project's structure and the user's context, suggest ${limit} specialized AI agents that would be most valuable for this project. Focus on agents that address the specific technologies, patterns, and potential challenges visible in this codebase.
`

    // Use AI to generate agent suggestions
    const result = await generateStructuredData({
      prompt: userPrompt,
      schema: AgentSuggestionsSchema,
      systemMessage: systemPrompt
    })

    return result.object
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to suggest agents: ${error instanceof Error ? error.message : String(error)}`,
      'SUGGEST_AGENTS_FAILED'
    )
  }
}

// Create singleton service instance
class ClaudeAgentService {
  listAgents = listAgents
  getAgentById = getAgentById
  createAgent = createAgent
  updateAgent = updateAgent
  deleteAgent = deleteAgent
  associateAgentWithProject = associateAgentWithProject
  getAgentsByProjectId = getAgentsByProjectId
  suggestAgents = suggestAgents
}

// Export singleton instance
export const claudeAgentService = new ClaudeAgentService()

// Export factory function for consistency with other services
export function createClaudeAgentService(): ClaudeAgentService {
  return claudeAgentService
}
