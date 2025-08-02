import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from './tools-registry'
import { MCPError, MCPErrorCode, createMCPError, formatMCPErrorResponse } from './mcp-errors'
import { trackMCPToolExecution } from '@promptliano/services'
import {
  listCommands,
  getCommandByName,
  createCommand,
  updateCommand,
  deleteCommand,
  executeCommand,
  suggestCommands,
  getProjectById,
  type CreateClaudeCommandBody,
  type UpdateClaudeCommandBody,
  type SearchCommandsQuery
} from '@promptliano/services'

// Action enum
export enum CommandManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  SEARCH = 'search',
  SUGGEST = 'suggest'
}

// Command Manager schema
export const CommandManagerSchema = z.object({
  action: z.nativeEnum(CommandManagerAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})

// Helper to validate required parameters
function validateRequiredParam<T>(value: T | undefined, name: string, type: string, example: string): T {
  if (value === undefined || value === null) {
    throw createMCPError(MCPErrorCode.INVALID_PARAMS, `Missing required parameter: ${name}`, {
      field: name,
      expected: type,
      example,
      suggestion: `Please provide '${name}' parameter`
    })
  }
  return value
}

// Helper to validate data fields
function validateDataField<T>(data: any, field: string, type: string, example: string): T {
  if (!data || data[field] === undefined) {
    throw createMCPError(MCPErrorCode.INVALID_PARAMS, `Missing required field in data: ${field}`, {
      field,
      expected: type,
      example,
      suggestion: `Include '${field}' in the data object`
    })
  }
  return data[field]
}

// Create tracked handler wrapper
function createTrackedHandler(toolName: string, handler: (args: any) => Promise<MCPToolResponse>) {
  return async (args: any, projectId?: number) => {
    const startTime = Date.now()
    let success = true
    let errorMessage: string | undefined

    try {
      return await handler(args)
    } catch (error) {
      success = false
      errorMessage = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      // Track execution
      try {
        await trackMCPToolExecution({
          toolName,
          projectId: projectId || args.projectId,
          executionTime: Date.now() - startTime,
          success,
          errorMessage,
          inputSize: JSON.stringify(args).length,
          outputSize: 0 // Will be updated if we have access to response
        })
      } catch (trackError) {
        console.error('Failed to track MCP tool execution:', trackError)
      }
    }
  }
}

export const commandManagerTool: MCPToolDefinition = {
  name: 'command_manager',
  description:
    'Manage Claude Code slash commands. Actions: list (list all commands), get (get command details), create (create new command), update (update command), delete (delete command), execute (execute command with arguments), search (search commands), suggest (AI-powered suggestions)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(CommandManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for all actions). Example: 1750564533014'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For get/update/delete/execute: { commandName: "review-code", namespace: "analysis" }. For create: { name: "test-runner", content: "Run tests for: $ARGUMENTS", frontmatter: { description: "Run tests" } }. For search: { query: "security", scope: "project", includeGlobal: true }. For suggest: { context: "I need help with testing", limit: 5 }. For execute: { commandName: "review", arguments: "src/auth" }'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'command_manager',
    async (args: z.infer<typeof CommandManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args
        const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')

        // Get project to validate and get path
        const project = await getProjectById(validProjectId)

        switch (action) {
          case CommandManagerAction.LIST: {
            const query: SearchCommandsQuery = data || {}
            const commands = await listCommands(project.path, query)
            const commandList = commands
              .map((cmd) => {
                const prefix = cmd.scope === 'user' ? '[USER] ' : ''
                const ns = cmd.namespace ? `${cmd.namespace}:` : ''
                return `${prefix}${ns}${cmd.name} - ${cmd.description || 'No description'}`
              })
              .join('\n')
            return {
              content: [{ type: 'text', text: commandList || 'No commands found' }]
            }
          }

          case CommandManagerAction.GET: {
            const commandName = validateDataField<string>(data, 'commandName', 'string', 'review-code')
            const namespace = data?.namespace as string | undefined
            const command = await getCommandByName(project.path, commandName, namespace)
            const details = `Command: ${command.name}
Scope: ${command.scope}
Namespace: ${command.namespace || 'root'}
Description: ${command.description || 'No description'}
File: ${command.filePath}

Frontmatter:
${JSON.stringify(command.frontmatter, null, 2)}

Content:
${command.content}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case CommandManagerAction.CREATE: {
            const name = validateDataField<string>(data, 'name', 'string', 'test-runner')
            const content = validateDataField<string>(data, 'content', 'string', 'Run tests for: $ARGUMENTS')

            const createData: CreateClaudeCommandBody = {
              name,
              content,
              namespace: data.namespace,
              scope: data.scope || 'project',
              frontmatter: data.frontmatter || {}
            }

            const command = await createCommand(project.path, createData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Command created successfully: ${command.name} (Scope: ${command.scope}, Namespace: ${command.namespace || 'root'})`
                }
              ]
            }
          }

          case CommandManagerAction.UPDATE: {
            const commandName = validateDataField<string>(data, 'commandName', 'string', 'review-code')
            const namespace = data?.namespace as string | undefined

            const updateData: UpdateClaudeCommandBody = {}
            if (data.content !== undefined) updateData.content = data.content
            if (data.frontmatter !== undefined) updateData.frontmatter = data.frontmatter
            if (data.newNamespace !== undefined) updateData.namespace = data.newNamespace

            const command = await updateCommand(project.path, commandName, updateData, namespace)
            return {
              content: [{ type: 'text', text: `Command updated successfully: ${command.name}` }]
            }
          }

          case CommandManagerAction.DELETE: {
            const commandName = validateDataField<string>(data, 'commandName', 'string', 'review-code')
            const namespace = data?.namespace as string | undefined

            await deleteCommand(project.path, commandName, namespace)
            return {
              content: [{ type: 'text', text: `Command '${commandName}' deleted successfully` }]
            }
          }

          case CommandManagerAction.EXECUTE: {
            const commandName = validateDataField<string>(data, 'commandName', 'string', 'review-code')
            const namespace = data?.namespace as string | undefined
            const args = data?.arguments as string | undefined

            const result = await executeCommand(project.path, commandName, args, namespace)
            return {
              content: [{ type: 'text', text: result.result }]
            }
          }

          case CommandManagerAction.SEARCH: {
            const query: SearchCommandsQuery = data || {}
            const commands = await listCommands(project.path, query)
            const results = commands
              .map((cmd) => {
                const prefix = cmd.scope === 'user' ? '[USER] ' : ''
                const ns = cmd.namespace ? `${cmd.namespace}:` : ''
                return `${prefix}${ns}${cmd.name} - ${cmd.description || 'No description'}`
              })
              .join('\n')
            return {
              content: [{ type: 'text', text: results || 'No commands found matching search criteria' }]
            }
          }

          case CommandManagerAction.SUGGEST: {
            const context = data?.context || ''
            const limit = data?.limit || 5
            const suggestions = await suggestCommands(validProjectId, context, limit)
            const suggestionList = suggestions.commands
              .map(
                (cmd, idx) =>
                  `${idx + 1}. ${cmd.name} (${cmd.namespace || 'root'})\n   Description: ${cmd.description}\n   Relevance: ${cmd.relevanceScore.toFixed(2)}\n   Rationale: ${cmd.rationale}`
              )
              .join('\n\n')
            return {
              content: [{ type: 'text', text: suggestionList || 'No command suggestions generated' }]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(CommandManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'command_manager',
                action: args.action,
                projectId: args.projectId
              })
        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
