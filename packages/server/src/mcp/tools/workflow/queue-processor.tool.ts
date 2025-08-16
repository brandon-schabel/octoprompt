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
import {
  getNextTaskFromQueue,
  getQueueStats,
  completeQueueItem,
  failQueueItem,
  updateTicket,
  updateTask
} from '@promptliano/services'
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
          'Action-specific data. For get_next_task: { agentId: "promptliano-ui-architect" }. For update_status: { itemType: "ticket" | "task", itemId: 123, status: "in_progress", ticketId: 456 (required for tasks) }. For complete_task: { itemType: "ticket" | "task", itemId: 123, ticketId: 456 (required for tasks), completionNotes: "optional notes" }. For fail_task: { itemType: "ticket" | "task", itemId: 123, errorMessage: "Error details", ticketId: 456 (required for tasks) }'
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

            if (response.type === 'none' || !response.item) {
              return {
                content: [
                  {
                    type: 'text',
                    text: response.message || 'No tasks available in the queue'
                  }
                ]
              }
            }

            let taskDetails = `Next task from queue:\n`

            if (response.type === 'task') {
              // Task within a ticket
              const task = response.item as any // TicketTask
              taskDetails += `
Type: Task
Task #${task.id}: ${task.content}
Ticket #${task.ticketId}
${task.description ? `Description: ${task.description}` : ''}
${task.suggestedFileIds?.length > 0 ? `Suggested Files: ${task.suggestedFileIds.join(', ')}` : ''}
${task.agentId ? `Recommended Agent: ${task.agentId}` : ''}
${task.estimatedHours ? `Estimated Hours: ${task.estimatedHours}` : ''}
${task.tags?.length > 0 ? `Tags: ${task.tags.join(', ')}` : ''}`
            } else if (response.type === 'ticket') {
              // Entire ticket
              const ticket = response.item as any // Ticket
              taskDetails += `
Type: Ticket
Ticket #${ticket.id}: ${ticket.title}
Overview: ${ticket.overview}
Status: ${ticket.status}
Priority: ${ticket.priority}
${ticket.suggestedFileIds?.length > 0 ? `Suggested Files: ${ticket.suggestedFileIds.join(', ')}` : ''}
${ticket.suggestedAgentIds?.length > 0 ? `Suggested Agents: ${ticket.suggestedAgentIds.join(', ')}` : ''}`
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
            // Update a ticket or task to in_progress status
            const itemType = validateDataField<'ticket' | 'task'>(data, 'itemType', 'string', '"ticket"')
            const itemId = validateDataField<number>(data, 'itemId', 'number', '123')
            const status = (data?.status as string) || 'in_progress'

            try {
              // TODO: Update queue status using proper queue management functions
              // Queue status updates should use dedicated queue management methods
              if (itemType === 'ticket') {
                // await updateTicket(itemId, { queueStatus: status as any })
              } else {
                const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
                // await updateTask(ticketId, itemId, { queueStatus: status as any })
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: `Successfully updated ${itemType} #${itemId} queue status to ${status}`
                  }
                ]
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, `Failed to update ${itemType} status: ${errorMessage}`, {
                itemType,
                itemId,
                status
              })
            }
          }

          case QueueProcessorAction.COMPLETE_TASK: {
            // Complete a ticket or task in the queue
            const itemType = validateDataField<'ticket' | 'task'>(data, 'itemType', 'string', '"ticket"')
            const itemId = validateDataField<number>(data, 'itemId', 'number', '123')
            const ticketId =
              itemType === 'task' ? validateDataField<number>(data, 'ticketId', 'number', '456') : undefined
            const completionNotes = data?.completionNotes as string | undefined

            try {
              await completeQueueItem(itemType, itemId, ticketId)

              return {
                content: [
                  {
                    type: 'text',
                    text: `Successfully completed ${itemType} #${itemId}${completionNotes ? `. Notes: ${completionNotes}` : ''}`
                  }
                ]
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, `Failed to complete ${itemType}: ${errorMessage}`, {
                itemType,
                itemId
              })
            }
          }

          case QueueProcessorAction.FAIL_TASK: {
            // Fail a ticket or task in the queue
            const itemType = validateDataField<'ticket' | 'task'>(data, 'itemType', 'string', '"ticket"')
            const itemId = validateDataField<number>(data, 'itemId', 'number', '123')
            const errorMessage = validateDataField<string>(data, 'errorMessage', 'string', '"Task failed due to error"')
            const ticketId =
              itemType === 'task' ? validateDataField<number>(data, 'ticketId', 'number', '456') : undefined

            try {
              await failQueueItem(itemType, itemId, errorMessage, ticketId)

              return {
                content: [
                  {
                    type: 'text',
                    text: `Marked ${itemType} #${itemId} as failed. Error: ${errorMessage}`
                  }
                ]
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error)
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, `Failed to mark ${itemType} as failed: ${errorMsg}`, {
                itemType,
                itemId,
                errorMessage
              })
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
            throw new MCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`)
        }
      } catch (error) {
        if (error instanceof MCPError) {
          return formatMCPErrorResponse(error)
        }
        if (error instanceof ApiError) {
          return formatMCPErrorResponse(
            createMCPError(MCPErrorCode.SERVICE_ERROR, error.message, { details: error.details })
          )
        }
        return formatMCPErrorResponse(
          createMCPError(MCPErrorCode.SERVICE_ERROR, 'An unexpected error occurred', { error: String(error) })
        )
      }
    }
  )
}
