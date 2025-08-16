import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  TaskManagerAction,
  TaskManagerSchema
} from '../shared'
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  suggestFilesForTask,
  getTaskWithContext,
  analyzeTaskComplexity,
  filterTasks,
  batchCreateTasks,
  batchUpdateTasks,
  batchDeleteTasks,
  batchMoveTasks
} from '@promptliano/services'
import type { UpdateTaskBody } from '@promptliano/schemas'

export const taskManagerTool: MCPToolDefinition = {
  name: 'task_manager',
  description:
    'Manage tasks within tickets. Actions: list, create, update, delete, reorder, suggest_files, update_context, get_with_context, analyze_complexity, filter, batch_create, batch_update, batch_delete, batch_move',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(TaskManagerAction)
      },
      ticketId: {
        type: 'number',
        description: 'The ticket ID (required for all actions). Example: 456'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For create: { content: "Task description", description: "Detailed steps", suggestedFileIds: ["123"], estimatedHours: 4, tags: ["frontend"], agentId: "promptliano-ui-architect" }. For update: { taskId: 789, done: true, content: "Updated text", description: "New description", agentId: "staff-engineer-code-reviewer" }. For filter: { projectId: 1754713756748, status: "pending", tags: ["backend"], query: "auth" }. For batch_create: { tasks: [{content: "Task 1"}, {content: "Task 2"}] }. For batch_update: { updates: [{ticketId: 456, taskId: 789, data: {done: true}}] }. For batch_delete: { deletes: [{ticketId: 456, taskId: 789}] }. For batch_move: { moves: [{taskId: 789, fromTicketId: 456, toTicketId: 123}] }'
      }
    },
    required: ['action', 'ticketId']
  },
  handler: createTrackedHandler(
    'task_manager',
    async (args: z.infer<typeof TaskManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, ticketId, data } = args
        const validTicketId = validateRequiredParam(ticketId, 'ticketId', 'number', '456')

        switch (action) {
          case TaskManagerAction.LIST: {
            const tasks = await getTasks(validTicketId)
            const taskList = tasks
              .map(
                (t) =>
                  `${t.id}: [${t.done ? 'x' : ' '}] ${t.content} (order: ${t.orderIndex})${t.agentId ? ` [Agent: ${t.agentId}]` : ''}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: taskList || 'No tasks found for this ticket' }]
            }
          }

          case TaskManagerAction.CREATE: {
            const content = validateDataField<string>(data, 'content', 'string', '"Implement login validation"')
            // Support enhanced task creation
            const taskData = {
              content,
              description: data.description,
              suggestedFileIds: data.suggestedFileIds,
              estimatedHours: data.estimatedHours,
              dependencies: data.dependencies,
              tags: data.tags,
              agentId: data.agentId
            }
            const task = await createTask(validTicketId, taskData)
            return {
              content: [{ type: 'text', text: `Task created successfully: ${task.content} (ID: ${task.id})` }]
            }
          }

          case TaskManagerAction.UPDATE: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            const updateData: UpdateTaskBody = {}
            if (data.content !== undefined) updateData.content = data.content
            if (data.description !== undefined) updateData.description = data.description
            if (data.suggestedFileIds !== undefined) updateData.suggestedFileIds = data.suggestedFileIds
            if (data.done !== undefined) updateData.done = data.done
            if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours
            if (data.dependencies !== undefined) updateData.dependencies = data.dependencies
            if (data.tags !== undefined) updateData.tags = data.tags
            if (data.agentId !== undefined) updateData.agentId = data.agentId
            const task = await updateTask(validTicketId, taskId, updateData)
            return {
              content: [{ type: 'text', text: `Task updated successfully: ${task.content} (ID: ${taskId})` }]
            }
          }

          case TaskManagerAction.DELETE: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            await deleteTask(validTicketId, taskId)
            return {
              content: [{ type: 'text', text: `Task ${taskId} deleted successfully` }]
            }
          }

          case TaskManagerAction.REORDER: {
            const tasks = validateDataField<Array<{ taskId: number; orderIndex: number }>>(
              data,
              'tasks',
              'array',
              '[{"taskId": 789, "orderIndex": 0}]'
            )
            const reorderedTasks = await reorderTasks(validTicketId, tasks)
            const taskList = reorderedTasks.map((t) => `${t.id}: ${t.content} (order: ${t.orderIndex})`).join('\n')
            return {
              content: [{ type: 'text', text: `Tasks reordered successfully:\n${taskList}` }]
            }
          }

          case TaskManagerAction.SUGGEST_FILES: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            const context = data.context as string | undefined
            const suggestedFiles = await suggestFilesForTask(taskId, context)
            return {
              content: [
                {
                  type: 'text',
                  text:
                    suggestedFiles.length > 0
                      ? `Suggested files for task: ${suggestedFiles.join(', ')}`
                      : 'No files suggested for this task'
                }
              ]
            }
          }

          case TaskManagerAction.UPDATE_CONTEXT: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            const updateData: UpdateTaskBody = {
              description: data.description,
              suggestedFileIds: data.suggestedFileIds,
              estimatedHours: data.estimatedHours,
              tags: data.tags
            }
            const task = await updateTask(validTicketId, taskId, updateData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Task context updated: ${task.content} (Est: ${task.estimatedHours || 'N/A'} hours)`
                }
              ]
            }
          }

          case TaskManagerAction.GET_WITH_CONTEXT: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            const taskWithContext = await getTaskWithContext(taskId)
            const contextInfo = {
              task: taskWithContext.content,
              description: taskWithContext.description,
              estimatedHours: taskWithContext.estimatedHours,
              tags: taskWithContext.tags,
              agentId: taskWithContext.agentId,
              fileCount: taskWithContext.suggestedFileIds?.length || 0,
              files: taskWithContext.files
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(contextInfo, null, 2)
                }
              ]
            }
          }

          case TaskManagerAction.ANALYZE_COMPLEXITY: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            const analysis = await analyzeTaskComplexity(taskId)
            return {
              content: [
                {
                  type: 'text',
                  text: `Task Complexity Analysis:
- Complexity: ${analysis.complexity}
- Estimated Hours: ${analysis.estimatedHours}
- Required Skills: ${analysis.requiredSkills.join(', ')}
- Suggested Approach: ${analysis.suggestedApproach}`
                }
              ]
            }
          }

          case TaskManagerAction.FILTER: {
            const projectId = validateRequiredParam(data?.projectId, 'projectId', 'number', '1754713756748')
            const filterOptions = data || {}

            const result = await filterTasks(projectId, filterOptions)

            if (result.tasks.length === 0) {
              throw createMCPError(MCPErrorCode.NO_SEARCH_RESULTS, 'No tasks found matching your filter criteria', {
                filterOptions
              })
            }

            const taskList = result.tasks
              .map(
                (t) =>
                  `${t.id}: [${t.done ? 'x' : ' '}] ${t.content} (${t.ticketTitle}) ${t.estimatedHours ? `- ${t.estimatedHours}h` : ''}`
              )
              .join('\n')

            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${result.total} tasks (showing ${result.tasks.length}):\n${taskList}`
                }
              ]
            }
          }

          case TaskManagerAction.BATCH_CREATE: {
            const validTicketId = validateRequiredParam(ticketId, 'ticketId', 'number', '456')
            const tasks = validateDataField<any[]>(data, 'tasks', 'array', '[{content: "Task 1"}, {content: "Task 2"}]')

            if (tasks.length > 100) {
              throw createMCPError(
                MCPErrorCode.BATCH_SIZE_EXCEEDED,
                `Batch size ${tasks.length} exceeds maximum of 100`
              )
            }

            const result = await batchCreateTasks(validTicketId, tasks)

            if (result.failureCount > 0 && result.successCount === 0) {
              throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                failures: result.failed
              })
            }

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Batch create completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                    (result.failed.length > 0
                      ? `Failures:\n${result.failed.map((f) => `- ${f.item.content}: ${f.error}`).join('\n')}`
                      : '')
                }
              ]
            }
          }

          case TaskManagerAction.BATCH_UPDATE: {
            const updates = validateDataField<any[]>(
              data,
              'updates',
              'array',
              '[{ticketId: 456, taskId: 789, data: {done: true}}]'
            )

            if (updates.length > 100) {
              throw createMCPError(
                MCPErrorCode.BATCH_SIZE_EXCEEDED,
                `Batch size ${updates.length} exceeds maximum of 100`
              )
            }

            const result = await batchUpdateTasks(updates)

            if (result.failureCount > 0 && result.successCount === 0) {
              throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                failures: result.failed
              })
            }

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Batch update completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                    (result.failed.length > 0
                      ? `Failures:\n${result.failed.map((f) => `- Task ${f.item.taskId}: ${f.error}`).join('\n')}`
                      : '')
                }
              ]
            }
          }

          case TaskManagerAction.BATCH_DELETE: {
            const deletes = validateDataField<any[]>(data, 'deletes', 'array', '[{ticketId: 456, taskId: 789}]')

            if (deletes.length > 100) {
              throw createMCPError(
                MCPErrorCode.BATCH_SIZE_EXCEEDED,
                `Batch size ${deletes.length} exceeds maximum of 100`
              )
            }

            const result = await batchDeleteTasks(deletes)

            if (result.failureCount > 0 && result.successCount === 0) {
              throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                failures: result.failed
              })
            }

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Batch delete completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                    (result.failed.length > 0
                      ? `Failed task IDs: ${result.failed.map((f) => f.item.taskId).join(', ')}`
                      : '')
                }
              ]
            }
          }

          case TaskManagerAction.BATCH_MOVE: {
            const moves = validateDataField<any[]>(
              data,
              'moves',
              'array',
              '[{taskId: 789, fromTicketId: 456, toTicketId: 123}]'
            )

            if (moves.length > 100) {
              throw createMCPError(
                MCPErrorCode.BATCH_SIZE_EXCEEDED,
                `Batch size ${moves.length} exceeds maximum of 100`
              )
            }

            const result = await batchMoveTasks(moves)

            if (result.failureCount > 0 && result.successCount === 0) {
              throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                failures: result.failed
              })
            }

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Batch move completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                    (result.failed.length > 0
                      ? `Failures:\n${result.failed.map((f) => `- Task ${f.item.taskId}: ${f.error}`).join('\n')}`
                      : '')
                }
              ]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(TaskManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
              tool: 'task_manager',
              action: args.action,
              ticketId: args.ticketId
            })

        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
