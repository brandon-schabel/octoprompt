import { claudeAgentStorage } from '@promptliano/storage'
import {
  type CreateClaudeAgentBody,
  type UpdateClaudeAgentBody,
  type ClaudeAgent,
  ClaudeAgentSchema,
  type AgentSuggestions,
  AgentSuggestionsSchema
} from '@promptliano/schemas'

import { ApiError, promptsMap } from '@promptliano/shared'
import { ZodError } from 'zod'
import { ErrorFactory, assertExists, handleZodError } from './utils/error-factory'
import { generateStructuredData } from './gen-ai-services'
import { getCompactProjectSummary } from './utils/project-summary-service'
import * as path from 'path'
import * as fs from 'fs/promises'
import { relativePosix, toPosixPath, toOSPath } from '@promptliano/shared'

export async function createAgent(projectPath: string, data: CreateClaudeAgentBody): Promise<ClaudeAgent> {
  const now = Date.now()

  try {
    // Generate agent ID based on name
    const agentId = claudeAgentStorage.generateAgentId(data.name)

    // Check if agent with this ID already exists
    const existingAgent = await claudeAgentStorage.getAgentById(projectPath, agentId)
    if (existingAgent) {
      throw ErrorFactory.duplicate('Agent', 'ID', agentId)
    }

    // Prepare file path
    const filePath = data.filePath || `${agentId}.md`
    const fullFilePath = path.join(claudeAgentStorage.getAgentsDir(projectPath), filePath)

    const newAgentData: ClaudeAgent = {
      id: agentId,
      name: data.name,
      description: data.description,
      color: data.color,
      filePath: relativePosix(projectPath, fullFilePath),
      content: data.content,
      projectId: data.projectId,
      created: now,
      updated: now
    }

    try {
      ClaudeAgentSchema.parse(newAgentData) // Validate before saving
    } catch (error) {
      handleZodError(error, 'Agent', 'creating')
    }

    // Write agent to filesystem
    const savedAgent = await claudeAgentStorage.writeAgent(projectPath, agentId, newAgentData)

    // Return the agent with projectId if specified
    return {
      ...savedAgent,
      projectId: data.projectId
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw ErrorFactory.createFailed('Agent', error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function getAgentById(projectPath: string, agentId: string): Promise<ClaudeAgent> {
  const agent = await claudeAgentStorage.getAgentById(projectPath, agentId)
  assertExists(agent, 'Agent', agentId)
  return agent
}

export async function listAgents(projectPath: string): Promise<ClaudeAgent[]> {
  const agentsData = await claudeAgentStorage.readAgents(projectPath)
  const agentList = Object.values(agentsData)
  // Sort by name
  agentList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return agentList
}

export async function getAgentsByProjectId(projectPath: string, projectId: number): Promise<ClaudeAgent[]> {
  // Since we no longer have database associations, we return all agents
  // and let the frontend filter by project if needed
  const agents = await listAgents(projectPath)
  return agents
}

export async function updateAgent(
  projectPath: string,
  agentId: string,
  data: UpdateClaudeAgentBody
): Promise<ClaudeAgent> {
  const existingAgent = await claudeAgentStorage.getAgentById(projectPath, agentId)
  assertExists(existingAgent, 'Agent', agentId)

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
    handleZodError(error, 'Agent', 'updating')
  }

  const savedAgent = await claudeAgentStorage.writeAgent(projectPath, agentId, updatedAgentData)
  return savedAgent
}

export async function deleteAgent(projectPath: string, agentId: string): Promise<boolean> {
  const agent = await claudeAgentStorage.getAgentById(projectPath, agentId)
  if (!agent) {
    return false // Agent not found
  }

  // Delete file
  const deleted = await claudeAgentStorage.deleteAgent(projectPath, agentId)
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
    throw ErrorFactory.operationFailed('suggest agents', error instanceof Error ? error.message : String(error))
  }
}

export async function getAgentContentById(projectPath: string, agentId: string): Promise<string | null> {
  try {
    const agent = await getAgentById(projectPath, agentId)
    return agent.content
  } catch (error) {
    console.log(
      `Warning: Could not get agent content for ${agentId}: ${error instanceof Error ? error.message : String(error)}`
    )
    return null
  }
}

export async function formatAgentContext(projectPath: string, agentId: string): Promise<string> {
  try {
    const agent = await getAgentById(projectPath, agentId)
    return `## Agent: ${agent.name}

${agent.content}

---
Agent ID: ${agent.id}
Specialization: ${agent.description}
`
  } catch (error) {
    console.log(
      `Warning: Could not format agent context for ${agentId}: ${error instanceof Error ? error.message : String(error)}`
    )
    return `## Agent: ${agentId} (not found)

This agent could not be loaded. Please proceed with general knowledge.
`
  }
}

export async function getAgentsByIds(projectPath: string, agentIds: string[]): Promise<ClaudeAgent[]> {
  const agents: ClaudeAgent[] = []
  for (const agentId of agentIds) {
    try {
      const agent = await getAgentById(projectPath, agentId)
      agents.push(agent)
    } catch (error) {
      console.log(`Warning: Could not get agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return agents
}

export async function suggestAgentForTask(
  taskTitle: string,
  taskDescription: string = '',
  availableAgents: ClaudeAgent[]
): Promise<string | null> {
  if (availableAgents.length === 0) return null

  // Simple heuristic-based matching
  const taskContent = `${taskTitle} ${taskDescription}`.toLowerCase()

  // Priority mappings for common task types
  const agentPriorities: Record<string, string[]> = {
    'zod-schema-architect': ['schema', 'zod', 'validation', 'data model', 'type'],
    'promptliano-ui-architect': ['ui', 'component', 'frontend', 'react', 'shadcn', 'button', 'form', 'page'],
    'hono-bun-api-architect': ['api', 'endpoint', 'route', 'hono', 'rest', 'http'],
    'promptliano-service-architect': ['service', 'business logic', 'storage'],
    'promptliano-mcp-tool-creator': ['mcp', 'tool', 'claude'],
    'staff-engineer-code-reviewer': ['review', 'quality', 'refactor', 'improve'],
    'code-modularization-expert': ['modularize', 'split', 'refactor', 'organize'],
    'promptliano-sqlite-expert': ['migration', 'database', 'sqlite', 'table'],
    'tanstack-router-expert': ['route', 'router', 'navigation', 'tanstack'],
    'vercel-ai-sdk-expert': ['ai', 'llm', 'vercel', 'streaming', 'chat'],
    'simple-git-integration-expert': ['git', 'version', 'commit', 'branch'],
    'promptliano-planning-architect': ['plan', 'architect', 'design', 'breakdown']
  }

  // Find best match
  let bestMatch: string | null = null
  let highestScore = 0

  for (const agent of availableAgents) {
    const keywords = agentPriorities[agent.id] || []
    let score = 0

    for (const keyword of keywords) {
      if (taskContent.includes(keyword)) {
        score += 1
      }
    }

    // Also check agent description
    const descWords = agent.description.toLowerCase().split(' ')
    for (const word of descWords) {
      if (taskContent.includes(word) && word.length > 3) {
        score += 0.5
      }
    }

    if (score > highestScore) {
      highestScore = score
      bestMatch = agent.id
    }
  }

  return bestMatch
}

// Create singleton service instance
class ClaudeAgentService {
  listAgents = listAgents
  getAgentById = getAgentById
  createAgent = createAgent
  updateAgent = updateAgent
  deleteAgent = deleteAgent
  getAgentsByProjectId = getAgentsByProjectId
  suggestAgents = suggestAgents
  getAgentContentById = getAgentContentById
  formatAgentContext = formatAgentContext
  getAgentsByIds = getAgentsByIds
  suggestAgentForTask = suggestAgentForTask
}

// Export singleton instance
export const claudeAgentService = new ClaudeAgentService()

// Export factory function for consistency with other services
export function createClaudeAgentService(): ClaudeAgentService {
  return claudeAgentService
}
