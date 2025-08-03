import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from './tools-registry'
import { MCPError, MCPErrorCode, createMCPError, formatMCPErrorResponse } from './mcp-errors'
import { trackMCPToolExecution } from '@promptliano/services'
import {
  claudeHookService,
  getProjectById,
  type HookEvent,
  type HookConfigurationLevel,
  type CreateHookConfigBody,
  type UpdateHookConfigBody,
  type HookGenerationRequest,
  type HookTestRequest
} from '@promptliano/services'

// Action enum
export enum HookManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  GENERATE = 'generate',
  TEST = 'test',
  SEARCH = 'search'
}

// Hook Manager schema
export const HookManagerSchema = z.object({
  action: z.nativeEnum(HookManagerAction),
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

export const hookManagerTool: MCPToolDefinition = {
  name: 'hook_manager',
  description:
    'Manage Claude Code hooks. Actions: list (list all hooks), get (get hook details), create (create new hook), update (update hook), delete (delete hook), generate (AI-powered generation from description), test (test hook execution), search (search hooks by query)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(HookManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for all actions). Example: 1750564533014'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For get/update/delete: { level: "project", eventName: "PreToolUse", matcherIndex: 0 }. For create: { level: "project", eventName: "PreToolUse", matcher: "^Bash", command: "echo $TOOL_NAME", matcherType: "tool_name_regex" }. For generate: { description: "Block rm -rf commands", context: { eventName: "PreToolUse" } }. For test: { event: "PreToolUse", matcher: "^Bash", command: "echo test", testData: { toolName: "Bash" } }. For search: { query: "bash" }'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'hook_manager',
    async (args: z.infer<typeof HookManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args
        const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')

        // Get project to validate and get path
        const project = await getProjectById(validProjectId)

        switch (action) {
          case HookManagerAction.LIST: {
            const hooks = await claudeHookService.listAllHooks(project.path)
            const hookList = hooks
              .map((hook) => {
                const eventHooks = hook.matchers
                  .map((matcher, idx) => `  [${idx}] ${matcher} → ${hook.command}`)
                  .join('\n')
                return `[${hook.level.toUpperCase()}] ${hook.event}:\n${eventHooks}`
              })
              .join('\n\n')
            return {
              content: [{ type: 'text', text: hookList || 'No hooks found' }]
            }
          }

          case HookManagerAction.GET: {
            const level = validateDataField<HookConfigurationLevel>(data, 'level', 'string', 'project')
            const eventName = validateDataField<HookEvent>(data, 'eventName', 'string', 'PreToolUse')
            const matcherIndex = validateDataField<number>(data, 'matcherIndex', 'number', '0')

            const hook = await claudeHookService.getHook(project.path, level, eventName, matcherIndex)
            const details = `Hook Details:
Level: ${hook.level}
Event: ${hook.event}
Matcher Index: ${hook.matcherIndex}
Matcher: ${hook.matcher}
Command: ${hook.command}
Message: ${hook.message || 'None'}
Allow: ${hook.allow !== undefined ? hook.allow : 'Not specified'}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case HookManagerAction.CREATE: {
            const hookData = validateDataField<CreateHookConfigBody>(
              data,
              'level',
              'object',
              '{ level: "project", eventName: "PreToolUse", matcher: "^rm", command: "echo Blocked" }'
            )

            const createdHook = await claudeHookService.createHook(project.path, hookData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Hook created successfully: ${createdHook.event} at ${createdHook.level} level with matcher "${createdHook.matcher}"`
                }
              ]
            }
          }

          case HookManagerAction.UPDATE: {
            const level = validateDataField<HookConfigurationLevel>(data, 'level', 'string', 'project')
            const eventName = validateDataField<HookEvent>(data, 'eventName', 'string', 'PreToolUse')
            const matcherIndex = validateDataField<number>(data, 'matcherIndex', 'number', '0')

            const updateData: UpdateHookConfigBody = {}
            if (data.matcher !== undefined) updateData.matcher = data.matcher
            if (data.command !== undefined) updateData.command = data.command
            if (data.message !== undefined) updateData.message = data.message
            if (data.allow !== undefined) updateData.allow = data.allow

            const updatedHook = await claudeHookService.updateHook(
              project.path,
              level,
              eventName,
              matcherIndex,
              updateData
            )
            return {
              content: [
                { type: 'text', text: `Hook updated successfully: ${updatedHook.event} at index ${matcherIndex}` }
              ]
            }
          }

          case HookManagerAction.DELETE: {
            const level = validateDataField<HookConfigurationLevel>(data, 'level', 'string', 'project')
            const eventName = validateDataField<HookEvent>(data, 'eventName', 'string', 'PreToolUse')
            const matcherIndex = validateDataField<number>(data, 'matcherIndex', 'number', '0')

            await claudeHookService.deleteHook(project.path, level, eventName, matcherIndex)
            return {
              content: [{ type: 'text', text: `Hook deleted successfully: ${eventName} at index ${matcherIndex}` }]
            }
          }

          case HookManagerAction.GENERATE: {
            const description = validateDataField<string>(data, 'description', 'string', 'Block all rm -rf commands')
            const context = data.context as HookGenerationRequest['context']

            const generatedHook = await claudeHookService.generateHookFromDescription(description, context)
            const details = `Generated Hook:
Event: ${generatedHook.event}
Matcher Type: ${generatedHook.matcherType || 'Not specified'}
Matcher: ${generatedHook.matcher}
Command: ${generatedHook.command}
Message: ${generatedHook.message || 'None'}
Allow: ${generatedHook.allow !== undefined ? generatedHook.allow : 'Not specified'}

To create this hook, use:
action: "create"
data: ${JSON.stringify({ level: 'project', ...generatedHook }, null, 2)}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case HookManagerAction.TEST: {
            const event = validateDataField<HookEvent>(data, 'event', 'string', 'PreToolUse')
            const matcher = validateDataField<string>(data, 'matcher', 'string', '^Bash')
            const command = validateDataField<string>(data, 'command', 'string', 'echo test')
            const testData = data.testData || {}

            const testRequest: HookTestRequest = {
              event,
              hookConfig: {
                matcher,
                command,
                message: data.message,
                allow: data.allow
              },
              testData
            }

            const result = await claudeHookService.testHook(project.path, testRequest)
            const resultText = `Hook Test Results:
Executed: ${result.executed ? 'Yes' : 'No'}
Matched: ${result.matched ? 'Yes' : 'No'}
Allowed: ${result.allowed !== undefined ? (result.allowed ? 'Yes' : 'No') : 'Not applicable'}
Output: ${result.output || 'None'}
Error: ${result.error || 'None'}
Message: ${result.message || 'None'}`
            return {
              content: [{ type: 'text', text: resultText }]
            }
          }

          case HookManagerAction.SEARCH: {
            const query = data?.query || ''
            const hooks = await claudeHookService.searchHooks(project.path, query)
            const results = hooks
              .map((hook) => {
                const eventHooks = hook.matchers
                  .map((matcher, idx) => `  [${idx}] ${matcher} → ${hook.command}`)
                  .join('\n')
                return `[${hook.level.toUpperCase()}] ${hook.event}:\n${eventHooks}`
              })
              .join('\n\n')
            return {
              content: [{ type: 'text', text: results || 'No hooks found matching search criteria' }]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(HookManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'hook_manager',
                action: args.action,
                projectId: args.projectId
              })
        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
