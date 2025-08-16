import { claudeCommandStorage } from '@promptliano/storage'
import {
  type CreateClaudeCommandBody,
  type UpdateClaudeCommandBody,
  type ClaudeCommand,
  type CommandScope,
  type CommandSuggestions,
  CommandSuggestionsSchema,
  type SearchCommandsQuery,
  type CommandGenerationRequest,
  type CommandGenerationResponse,
  CommandGenerationResponseSchema
} from '@promptliano/schemas'
import { ValidationError, NotFoundError, ConflictError, ServiceError, ErrorHandler } from '@promptliano/shared'
import { ZodError } from 'zod'
import { generateStructuredData } from './gen-ai-services'
import { getCompactProjectSummary } from './utils/project-summary-service'
import { ClaudeCommandParser } from '@promptliano/shared'
import { HIGH_MODEL_CONFIG } from '@promptliano/config'

export async function createCommand(projectPath: string, data: CreateClaudeCommandBody): Promise<ClaudeCommand> {
  try {
    // Validate command name
    if (!/^[a-z0-9-]+$/.test(data.name)) {
      throw new ValidationError('Invalid command name. Use lowercase letters, numbers, and hyphens only.', {
        field: 'name',
        value: data.name
      })
    }

    // Check if command already exists
    const existing = await claudeCommandStorage.getCommandByName(projectPath, data.name, data.namespace, data.scope)
    if (existing) {
      throw new ConflictError(`Command '${data.name}' already exists in namespace '${data.namespace || 'root'}'`, {
        commandName: data.name,
        namespace: data.namespace
      })
    }

    // Write command to filesystem
    const command = await claudeCommandStorage.writeCommand(
      projectPath,
      data.name,
      data.content,
      data.frontmatter || {},
      data.namespace,
      data.scope
    )

    return command
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ConflictError) throw error
    throw new ServiceError(
      `Failed to create command: ${error instanceof Error ? error.message : String(error)}`,
      'CREATE_COMMAND_FAILED'
    )
  }
}

export async function listCommands(
  projectPath: string,
  query: SearchCommandsQuery = {
    includeGlobal: true,
    limit: 20,
    offset: 0
  }
): Promise<ClaudeCommand[]> {
  try {
    const allCommands = await claudeCommandStorage.readCommands(projectPath, query.includeGlobal !== false)

    let commands = Object.values(allCommands)

    // Apply filters
    if (query.scope) {
      commands = commands.filter((cmd) => cmd.scope === query.scope)
    }

    if (query.namespace !== undefined) {
      commands = commands.filter((cmd) => cmd.namespace === query.namespace)
    }

    if (query.query) {
      const searchLower = query.query.toLowerCase()
      commands = commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.content.toLowerCase().includes(searchLower)
      )
    }

    // Sort by name
    commands.sort((a, b) => {
      if (a.namespace !== b.namespace) {
        return (a.namespace || '').localeCompare(b.namespace || '')
      }
      return a.name.localeCompare(b.name)
    })

    // Apply pagination
    const offset = query.offset || 0
    const limit = query.limit || 20
    commands = commands.slice(offset, offset + limit)

    return commands
  } catch (error) {
    throw new ServiceError(
      `Failed to list commands: ${error instanceof Error ? error.message : String(error)}`,
      'LIST_COMMANDS_FAILED'
    )
  }
}

export async function getCommandByName(
  projectPath: string,
  commandName: string,
  namespace?: string
): Promise<ClaudeCommand> {
  const command = await claudeCommandStorage.getCommandByName(projectPath, commandName, namespace)

  if (!command) {
    throw new NotFoundError('Command', namespace ? `${namespace}/${commandName}` : commandName)
  }

  return command
}

export async function updateCommand(
  projectPath: string,
  commandName: string,
  data: UpdateClaudeCommandBody,
  namespace?: string
): Promise<ClaudeCommand> {
  try {
    // Get existing command
    const existing = await getCommandByName(projectPath, commandName, namespace)

    // Delete old command if namespace is changing
    if (data.namespace !== undefined && data.namespace !== existing.namespace) {
      await claudeCommandStorage.deleteCommand(projectPath, commandName, existing.namespace, existing.scope)
    }

    // Merge frontmatter
    const updatedFrontmatter = {
      ...existing.frontmatter,
      ...(data.frontmatter || {})
    }

    // Write updated command
    const command = await claudeCommandStorage.writeCommand(
      projectPath,
      commandName,
      data.content || existing.content,
      updatedFrontmatter,
      data.namespace !== undefined ? data.namespace : existing.namespace,
      existing.scope
    )

    return command
  } catch (error) {
    if (error instanceof NotFoundError) throw error
    throw new ServiceError(
      `Failed to update command: ${error instanceof Error ? error.message : String(error)}`,
      'UPDATE_COMMAND_FAILED'
    )
  }
}

export async function deleteCommand(projectPath: string, commandName: string, namespace?: string): Promise<boolean> {
  try {
    // Get command to find its scope
    const command = await getCommandByName(projectPath, commandName, namespace)

    const deleted = await claudeCommandStorage.deleteCommand(projectPath, commandName, command.namespace, command.scope)

    if (!deleted) {
      throw new ServiceError('Failed to delete command file', 'DELETE_COMMAND_FAILED')
    }

    return true
  } catch (error) {
    if (error instanceof NotFoundError) throw error
    throw new ServiceError(
      `Failed to delete command: ${error instanceof Error ? error.message : String(error)}`,
      'DELETE_COMMAND_FAILED'
    )
  }
}

export async function executeCommand(
  projectPath: string,
  commandName: string,
  args?: string,
  namespace?: string
): Promise<{ result: string; metadata?: any }> {
  try {
    const command = await getCommandByName(projectPath, commandName, namespace)

    // Parse command to substitute arguments
    const parser = new ClaudeCommandParser()
    let content = command.content

    if (args) {
      content = parser.substituteArguments(content, args)
    }

    // In a real implementation, this would execute the command
    // through Claude API with the specified tools and settings
    return {
      result: `Would execute command '${commandName}' with content:\n${content}`,
      metadata: {
        frontmatter: command.frontmatter,
        scope: command.scope,
        namespace: command.namespace
      }
    }
  } catch (error) {
    if (error instanceof NotFoundError) throw error
    throw new ServiceError(
      `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`,
      'EXECUTE_COMMAND_FAILED'
    )
  }
}

export async function generateCommand(
  projectId: number,
  data: CommandGenerationRequest
): Promise<CommandGenerationResponse['data']> {
  try {
    // Get project context if requested
    let projectContext = ''
    const contextOptions = data.context || {
      includeProjectSummary: true,
      includeFileStructure: true,
      includeTechStack: true
    }

    if (contextOptions.includeProjectSummary !== false) {
      try {
        projectContext = await getCompactProjectSummary(projectId)
      } catch (error) {
        console.log(`Warning: Could not get project summary: ${error instanceof Error ? error.message : String(error)}`)
        projectContext = 'Project summary unavailable'
      }
    }

    // Build system prompt for command generation
    const systemPrompt = `You are an expert at creating Claude Code slash commands that automate development tasks.

## Your Task:
Generate a Claude Code slash command based on the user's requirements and project context.

## Command Requirements:
1. The command name should be: ${data.name}
2. The command should accomplish: ${data.description}
3. Detailed user intent: ${data.userIntent}
${data.namespace ? `4. Place the command in namespace: ${data.namespace}` : ''}
${data.scope ? `5. Command scope: ${data.scope}` : ''}

## Command Creation Guidelines:
- Use appropriate Claude tools (Edit, Read, Bash, WebSearch, etc.)
- Include the $ARGUMENTS placeholder where user input is expected
- Write clear, step-by-step instructions in the command content
- Include error handling and validation where appropriate
- Follow the project's coding conventions and tech stack
- Make the command efficient and reliable

## Frontmatter Guidelines:
- Set allowed-tools to only the tools actually needed
- Include a clear description
- Add argument-hint if $ARGUMENTS is used
- Specify model preference if the task is complex
- Set max-turns appropriately for the task complexity

## Output Requirements:
- The command content should be complete and ready to use
- Provide a clear rationale explaining your design choices
- Suggest variations only if there are meaningful alternatives`

    // Build user prompt with context
    let userPrompt = ''

    if (projectContext) {
      userPrompt += `<project_context>\n${projectContext}\n</project_context>\n\n`
    }

    if (contextOptions.selectedFiles && contextOptions.selectedFiles.length > 0) {
      userPrompt += `<relevant_files>\n${contextOptions.selectedFiles.join(', ')}\n</relevant_files>\n\n`
    }

    if (contextOptions.additionalContext) {
      userPrompt += `<additional_context>\n${contextOptions.additionalContext}\n</additional_context>\n\n`
    }

    userPrompt += `Generate a Claude Code slash command that meets the requirements above. Focus on making it practical, efficient, and tailored to this specific project.`

    // Generate the command using AI
    const result = await generateStructuredData({
      prompt: userPrompt,
      schema: CommandGenerationResponseSchema.shape.data,
      systemMessage: systemPrompt,
      // model: 'claude-3-5-sonnet-20241022
      options: HIGH_MODEL_CONFIG
    })

    // Ensure the generated name matches the requested name
    result.object.name = data.name

    // Apply namespace if specified
    if (data.namespace !== undefined) {
      result.object.namespace = data.namespace
    }

    return result.object
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Failed to generate valid command structure', error.errors)
    }
    throw new ServiceError(
      `Failed to generate command: ${error instanceof Error ? error.message : String(error)}`,
      'GENERATE_COMMAND_FAILED'
    )
  }
}

export async function suggestCommands(
  projectId: number,
  context: string = '',
  limit: number = 5
): Promise<CommandSuggestions> {
  try {
    // Get project summary for context
    let projectSummary = ''
    try {
      projectSummary = await getCompactProjectSummary(projectId)
    } catch (error) {
      console.log(
        `Warning: Could not get project summary for command suggestions: ${error instanceof Error ? error.message : String(error)}`
      )
      projectSummary = 'No project context available'
    }

    // Create a system prompt for command suggestions
    const systemPrompt = `
You are an expert at analyzing project codebases and suggesting useful Claude Code slash commands.

## Your Task:
Based on the project structure, technologies used, and any user context provided, suggest Claude Code slash commands that would provide the most value for this specific project.

## Command Creation Guidelines:
1. Each command should automate a specific, repetitive task
2. Commands should leverage Claude's tools (Edit, Read, Bash, WebSearch, etc.)
3. Consider the project's tech stack and common workflows
4. Suggest commands that save significant time or reduce errors
5. Each command should use the $ARGUMENTS placeholder where appropriate

## Output Requirements:
- Provide practical, actionable command suggestions
- Each command's content should be complete and ready to use
- Include appropriate frontmatter settings (allowed-tools, description, etc.)
- Make commands that address real development pain points
`

    const userPrompt = `
<project_summary>
${projectSummary}
</project_summary>

<user_context>
${context || 'General development automation needed'}
</user_context>

Based on this project's structure and the user's context, suggest ${limit} Claude Code slash commands that would be most valuable. Focus on commands that automate common tasks, improve code quality, or speed up development workflows.
`

    // Use AI to generate command suggestions
    const result = await generateStructuredData({
      prompt: userPrompt,
      schema: CommandSuggestionsSchema,
      systemMessage: systemPrompt
    })

    return result.object
  } catch (error) {
    throw new ServiceError(
      `Failed to suggest commands: ${error instanceof Error ? error.message : String(error)}`,
      'SUGGEST_COMMANDS_FAILED'
    )
  }
}

// Create singleton service instance
class ClaudeCommandService {
  listCommands = listCommands
  getCommandByName = getCommandByName
  createCommand = createCommand
  updateCommand = updateCommand
  deleteCommand = deleteCommand
  executeCommand = executeCommand
  suggestCommands = suggestCommands
  generateCommand = generateCommand
}

// Export singleton instance
export const claudeCommandService = new ClaudeCommandService()

// Export factory function for consistency
export function createClaudeCommandService(): ClaudeCommandService {
  return claudeCommandService
}
