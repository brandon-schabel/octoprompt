import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse
} from '../shared'
import { getNextTaskFromQueue, updateQueueItem, getQueueStats, type UpdateQueueItemBody } from '@promptliano/services'
import { ApiError } from '@promptliano/shared'

// Define action types
export enum QueueProcessorAction {
  GET_NEXT_TASK = 'get_next_task',
  UPDATE_STATUS = 'update_status',
  COMPLETE_TASK = 'complete_task',
  FAIL_TASK = 'fail_task',
  CHECK_QUEUE_STATUS = 'check_queue_status'
}

// Schema for the tool
export const QueueProcessorSchema = z.object({
  action: z.nativeEnum(QueueProcessorAction),
  queueId: z.number().optional(),
  data: z.any().optional()
})

export const queueProcessorTool: MCPToolDefinition = {
  name: 'queue_processor',
  description:
    'Process tasks from the queue system. Actions: get_next_task (pull next task to work on), update_status (update task progress), complete_task (mark as done), fail_task (mark as failed), check_queue_status (check if queue has work)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(QueueProcessorAction)
      },
      queueId: {
        type: 'number',
        description: 'The queue ID to process from (required for get_next_task and check_queue_status)'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For get_next_task: { agentId: "frontend-shadcn-expert" }. For update_status/complete_task/fail_task: { itemId: 123, errorMessage: "Error details" (for fail_task) }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'queue_processor',
    async (args: z.infer<typeof QueueProcessorSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, queueId, data } = args

        switch (action) {
          case QueueProcessorAction.GET_NEXT_TASK: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const agentId = data?.agentId as string | undefined

            const response = await getNextTaskFromQueue(validQueueId, agentId)

            if (!response.queueItem) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'No tasks available in the queue'
                  }
                ]
              }
            }

            let taskDetails = `Next task from queue:
Queue Item ID: ${response.queueItem.id}
Status: ${response.queueItem.status}
Priority: ${response.queueItem.priority}
${response.queueItem.agentId ? `Assigned to: ${response.queueItem.agentId}` : ''}\n`

            if (response.ticket && response.task) {
              // Task within a ticket
              taskDetails += `
Ticket #${response.ticket.id}: ${response.ticket.title}
Task #${response.task.id}: ${response.task.content}
${response.task.description ? `Description: ${response.task.description}` : ''}
${response.task.suggestedFileIds.length > 0 ? `Suggested Files: ${response.task.suggestedFileIds.join(', ')}` : ''}
${response.task.agentId ? `Recommended Agent: ${response.task.agentId}` : ''}
${response.task.estimatedHours ? `Estimated Hours: ${response.task.estimatedHours}` : ''}
${response.task.tags.length > 0 ? `Tags: ${response.task.tags.join(', ')}` : ''}`
            } else if (response.ticket) {
              // Entire ticket
              taskDetails += `
Ticket #${response.ticket.id}: ${response.ticket.title}
Overview: ${response.ticket.overview}
Status: ${response.ticket.status}
Priority: ${response.ticket.priority}
${response.ticket.suggestedFileIds.length > 0 ? `Suggested Files: ${response.ticket.suggestedFileIds.join(', ')}` : ''}
${response.ticket.suggestedAgentIds.length > 0 ? `Suggested Agents: ${response.ticket.suggestedAgentIds.join(', ')}` : ''}`
            }

            return {
              content: [
                {
                  type: 'text',
                  text: taskDetails
                }
              ]
            }
          }

          case QueueProcessorAction.UPDATE_STATUS: {
            const itemId = validateDataField<number>(data, 'itemId', 'number', '123')

            const updateData: UpdateQueueItemBody = {
              status: 'in_progress'
            }

            const item = await updateQueueItem(itemId, updateData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Queue item ${item.id} marked as in progress`
                }
              ]
            }
          }

          case QueueProcessorAction.COMPLETE_TASK: {
            const itemId = validateDataField<number>(data, 'itemId', 'number', '123')

            const updateData: UpdateQueueItemBody = {
              status: 'completed'
            }

            const item = await updateQueueItem(itemId, updateData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Queue item ${item.id} marked as completed`
                }
              ]
            }
          }

          case QueueProcessorAction.FAIL_TASK: {
            const itemId = validateDataField<number>(data, 'itemId', 'number', '123')
            const errorMessage = data?.errorMessage as string | undefined

            const updateData: UpdateQueueItemBody = {
              status: 'failed',
              errorMessage
            }

            const item = await updateQueueItem(itemId, updateData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Queue item ${item.id} marked as failed${errorMessage ? ` with error: ${errorMessage}` : ''}`
                }
              ]
            }
          }

          case QueueProcessorAction.CHECK_QUEUE_STATUS: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const stats = await getQueueStats(validQueueId)

            const hasWork = stats.queuedItems > 0
            const workload = hasWork
              ? `${stats.queuedItems} task${stats.queuedItems > 1 ? 's' : ''} waiting`
              : 'No tasks waiting'

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue "${stats.queueName}" status:
${workload}
${stats.inProgressItems} in progress
${stats.completedItems} completed
${hasWork ? '\nTasks are available for processing!' : '\nQueue is empty - no tasks to process.'}`
                }
              ]
            }
          }

          default:
            throw new MCPError(MCPErrorCode.INVALID_REQUEST, `Unknown action: ${action}`)
        }
      } catch (error) {
        if (error instanceof MCPError) {
          return formatMCPErrorResponse(error)
        }
        if (error instanceof ApiError) {
          return formatMCPErrorResponse(
            createMCPError(MCPErrorCode.INTERNAL_ERROR, error.message, { details: error.details })
          )
        }
        return formatMCPErrorResponse(
          createMCPError(MCPErrorCode.INTERNAL_ERROR, 'An unexpected error occurred', { error: String(error) })
        )
      }
    }
  )
}
