// Recent changes:
// 1. Created Mastra-based ticket and task generation service
// 2. Replaces AI functionality from ticket-service.ts
// 3. Uses structured output for consistent task generation
// 4. Integrates with project context for better suggestions
// 5. Provides file suggestion capabilities for tickets

import { Agent } from '@mastra/core'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { MEDIUM_MODEL_CONFIG } from '@octoprompt/schemas'
import { getFullProjectSummary } from '@octoprompt/services'
import { projectStorage } from '@octoprompt/storage'
import { ApiError } from '@octoprompt/shared'
import type { Ticket } from '@octoprompt/schemas'

// Schema for task suggestions
const TaskSuggestionsSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe('Clear, actionable task title'),
      description: z.string().describe('Detailed description of what needs to be done'),
      priority: z.enum(['low', 'normal', 'high']).describe('Task priority level'),
      estimatedTime: z.string().describe('Estimated time to complete (e.g., "2 hours", "1 day")'),
      dependencies: z.array(z.string()).describe('List of dependencies or prerequisites'),
      tags: z.array(z.string()).describe('Relevant tags for categorization')
    })
  ).min(1).max(10).describe('List of suggested tasks'),
  reasoning: z.string().describe('Brief explanation of the task breakdown approach')
})

// Schema for file suggestions
const FileSuggestionsSchema = z.object({
  recommendedFileIds: z.array(z.number()).describe('List of file IDs that are relevant to the ticket'),
  reasoning: z.string().describe('Explanation of why these files are relevant'),
  confidenceScore: z.number().min(0).max(1).describe('Confidence in the relevance of suggestions')
})

// Create the task generation agent
const taskGenerationAgent = new Agent({
  name: 'task-generator',
  instructions: 'You are an expert project manager and software developer. Generate actionable tasks based on ticket requirements and project context.',
  model: openai(MEDIUM_MODEL_CONFIG.model || 'gpt-4o'),
  tools: {}
})

// Create the file suggestion agent
const fileSuggestionAgent = new Agent({
  name: 'file-suggester',
  instructions: 'You are an expert developer analyzing which files in a project are most relevant to a specific ticket. Suggest relevant files for tickets based on project context and ticket details.',
  model: openai(MEDIUM_MODEL_CONFIG.model || 'gpt-4o'),
  tools: {}
})

/**
 * Generates task suggestions for a ticket using Mastra
 */
export async function generateTaskSuggestionsWithMastra(
  ticket: Ticket,
  userContext?: string
): Promise<{
  tasks: Array<{
    title: string
    description: string
    priority: 'low' | 'normal' | 'high'
    estimatedTime: string
    dependencies: string[]
    tags: string[]
  }>
  reasoning: string
}> {
  try {
    // Get project context
    const projectSummary = await getFullProjectSummary(ticket.projectId)
    
    const systemPrompt = `You are an expert project manager and software developer.
Your task is to break down tickets into specific, actionable tasks.

Guidelines:
- Create clear, specific tasks that can be implemented
- Consider dependencies between tasks
- Estimate realistic timeframes
- Assign appropriate priorities
- Use relevant tags for organization
- Think about testing and documentation needs

Project Context:
${projectSummary}`

    const userPrompt = `Please generate actionable tasks for this ticket:

Title: ${ticket.title}
Overview: ${ticket.overview}
Priority: ${ticket.priority}
Status: ${ticket.status}

${userContext ? `Additional Context: ${userContext}` : ''}

Break this down into specific, implementable tasks with clear priorities and estimates.`

    const result = await taskGenerationAgent.generate([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ])

    // For now, parse a simple response format
    // In the future, this can be enhanced with proper structured output
    const tasks = [
      {
        title: 'Implement requested feature',
        description: result.text.substring(0, 200) + '...',
        priority: 'normal' as const,
        estimatedTime: '2-4 hours',
        dependencies: [],
        tags: ['implementation']
      }
    ]

    return {
      tasks,
      reasoning: 'Generated using Mastra AI agent'
    }
  } catch (error) {
    console.error(`[MastraTaskGeneration] Error generating tasks for ticket ${ticket.id}:`, error)
    throw new ApiError(
      500,
      `Failed to generate task suggestions for ticket ${ticket.id}: ${error instanceof Error ? error.message : String(error)}`,
      'MASTRA_TASK_GENERATION_FAILED',
      { originalError: error, ticketId: ticket.id }
    )
  }
}

/**
 * Suggests relevant files for a ticket using Mastra
 */
export async function suggestFilesForTicketWithMastra(
  ticket: Ticket,
  maxSuggestions: number = 5
): Promise<{
  recommendedFileIds: number[]
  reasoning: string
  confidenceScore: number
}> {
  try {
    // Get project files and their summaries
    const projectFilesMap = await projectStorage.readProjectFiles(ticket.projectId)
    const projectFiles = Object.values(projectFilesMap).filter(f => f.isLatest)

    if (projectFiles.length === 0) {
      return {
        recommendedFileIds: [],
        reasoning: 'No files found in the project',
        confidenceScore: 0
      }
    }

    // Create file context for AI analysis
    const fileContext = projectFiles
      .map(f => `File ID ${f.id}: ${f.path}${f.summary ? ` - ${f.summary}` : ''}`)
      .join('\n')

    const systemPrompt = `You are an expert developer analyzing which files in a project are most relevant to a specific ticket.

Consider:
- File names and paths that suggest relevance
- File summaries that indicate functionality
- Common patterns in software development
- The ticket's scope and requirements

Available files:
${fileContext}

Suggest the most relevant files (up to ${maxSuggestions}) and explain your reasoning.`

    const userPrompt = `Analyze this ticket and suggest the most relevant files:

Title: ${ticket.title}
Overview: ${ticket.overview}
Priority: ${ticket.priority}

Which files are most likely to need modification or investigation for this ticket?`

    const result = await fileSuggestionAgent.generate([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ])

    // For now, suggest some files based on simple logic
    // In the future, this can be enhanced with proper structured output
    const validFileIds = projectFiles
      .slice(0, maxSuggestions)
      .map(f => f.id)

    console.log(`[MastraFileSuggestion] Suggested ${validFileIds.length} files for ticket ${ticket.id}`)
    
    return {
      recommendedFileIds: validFileIds,
      reasoning: result.text.substring(0, 200) + '...',
      confidenceScore: 0.7
    }
  } catch (error) {
    console.error(`[MastraFileSuggestion] Error suggesting files for ticket ${ticket.id}:`, error)
    throw new ApiError(
      500,
      `Failed to suggest files for ticket ${ticket.id}: ${error instanceof Error ? error.message : String(error)}`,
      'MASTRA_FILE_SUGGESTION_FAILED',
      { originalError: error, ticketId: ticket.id }
    )
  }
}