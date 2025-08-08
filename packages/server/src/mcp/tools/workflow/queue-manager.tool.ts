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
  createQueue,
  getQueueById,
  listQueuesByProject,
  updateQueue,
  deleteQueue,
  enqueueItem,
  updateQueueItem,
  deleteQueueItem,
  getQueueItems,
  getQueueStats,
  getQueuesWithStats,
  batchEnqueueItems,
  enqueueTicketWithAllTasks,
  type CreateQueueBody,
  type UpdateQueueBody,
  type EnqueueItemBody
} from '@promptliano/services'
import { ApiError } from '@promptliano/shared'

// Define action types
export enum QueueManagerAction {
  CREATE_QUEUE = 'create_queue',
  LIST_QUEUES = 'list_queues',
  GET_QUEUE = 'get_queue',
  UPDATE_QUEUE = 'update_queue',
  DELETE_QUEUE = 'delete_queue',
  ENQUEUE_ITEM = 'enqueue_item',
  ENQUEUE_TICKET = 'enqueue_ticket',
  BATCH_ENQUEUE = 'batch_enqueue',
  UPDATE_ITEM = 'update_item',
  DELETE_ITEM = 'delete_item',
  GET_ITEMS = 'get_items',
  GET_STATS = 'get_stats',
  GET_ALL_STATS = 'get_all_stats'
}

// Schema for the tool
export const QueueManagerSchema = z.object({
  action: z.nativeEnum(QueueManagerAction),
  projectId: z.number().optional(),
  queueId: z.number().optional(),
  data: z.any().optional()
})

export const queueManagerTool: MCPToolDefinition = {
  name: 'queue_manager',
  description:
    'Manage task queues for AI agent processing. Actions: create_queue, list_queues, get_queue, update_queue, delete_queue, enqueue_item, enqueue_ticket, batch_enqueue, update_item, delete_item, get_items, get_stats, get_all_stats',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(QueueManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for: create_queue, list_queues, get_all_stats). Example: 1754111018844'
      },
      queueId: {
        type: 'number',
        description: 'The queue ID (required for most actions except create/list)'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For create_queue: { name: "Main Queue", description: "Primary processing queue", maxParallelItems: 3 }. For enqueue_item: { ticketId: 456 } or { taskId: 789, priority: 10 }. For enqueue_ticket: { ticketId: 456, priority: 5 }. For batch_enqueue: { items: [{ticketId: 456}, {taskId: 789}] }. For update_item: { itemId: 123, status: "completed" }. For get_items: { status: "queued" }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'queue_manager',
    async (args: z.infer<typeof QueueManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, queueId, data } = args

        switch (action) {
          case QueueManagerAction.CREATE_QUEUE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')
            const name = validateDataField<string>(data, 'name', 'string', 'Main Queue')

            const createData: CreateQueueBody = {
              projectId: validProjectId,
              name,
              description: data?.description,
              maxParallelItems: data?.maxParallelItems
            }

            const queue = await createQueue(createData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Queue created successfully:
ID: ${queue.id}
Name: ${queue.name}
Description: ${queue.description}
Status: ${queue.status}
Max Parallel Items: ${queue.maxParallelItems}`
                }
              ]
            }
          }

          case QueueManagerAction.LIST_QUEUES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')
            const queues = await listQueuesByProject(validProjectId)

            if (queues.length === 0) {
              return {
                content: [{ type: 'text', text: 'No queues found for this project' }]
              }
            }

            const queueList = queues
              .map((q) => `${q.id}: ${q.name} [${q.status}] - ${q.description || 'No description'}`)
              .join('\n')

            return {
              content: [{ type: 'text', text: queueList }]
            }
          }

          case QueueManagerAction.GET_QUEUE: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const queue = await getQueueById(validQueueId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue Details:
ID: ${queue.id}
Name: ${queue.name}
Description: ${queue.description}
Status: ${queue.status}
Max Parallel Items: ${queue.maxParallelItems}
Project ID: ${queue.projectId}
Created: ${new Date(queue.created).toLocaleString()}
Updated: ${new Date(queue.updated).toLocaleString()}`
                }
              ]
            }
          }

          case QueueManagerAction.UPDATE_QUEUE: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')

            const updateData: UpdateQueueBody = {
              name: data?.name,
              description: data?.description,
              status: data?.status,
              maxParallelItems: data?.maxParallelItems
            }

            const queue = await updateQueue(validQueueId, updateData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Queue ${queue.id} updated successfully`
                }
              ]
            }
          }

          case QueueManagerAction.DELETE_QUEUE: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            await deleteQueue(validQueueId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue ${validQueueId} deleted successfully`
                }
              ]
            }
          }

          case QueueManagerAction.ENQUEUE_ITEM: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')

            const enqueueData: EnqueueItemBody = {
              ticketId: data?.ticketId,
              taskId: data?.taskId,
              priority: data?.priority,
              agentId: data?.agentId
            }

            const item = await enqueueItem(validQueueId, enqueueData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Item enqueued successfully:
ID: ${item.id}
Queue ID: ${item.queueId}
${item.ticketId ? `Ticket ID: ${item.ticketId}` : `Task ID: ${item.taskId}`}
Status: ${item.status}
Priority: ${item.priority}
${item.agentId ? `Assigned Agent: ${item.agentId}` : ''}`
                }
              ]
            }
          }

          case QueueManagerAction.ENQUEUE_TICKET: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')

            const items = await enqueueTicketWithAllTasks(validQueueId, ticketId, data?.priority)
            return {
              content: [
                {
                  type: 'text',
                  text: `Enqueued ${items.length} tasks from ticket ${ticketId} to queue ${validQueueId}`
                }
              ]
            }
          }

          case QueueManagerAction.BATCH_ENQUEUE: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const items = validateDataField<EnqueueItemBody[]>(data, 'items', 'array', '[]')

            const results = await batchEnqueueItems(validQueueId, items)
            return {
              content: [
                {
                  type: 'text',
                  text: `Batch enqueued ${results.length} items to queue ${validQueueId}`
                }
              ]
            }
          }

          case QueueManagerAction.UPDATE_ITEM: {
            const itemId = validateDataField<number>(data, 'itemId', 'number', '123')

            const updateData = {
              status: data?.status,
              agentId: data?.agentId,
              errorMessage: data?.errorMessage
            }

            const item = await updateQueueItem(itemId, updateData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Queue item ${item.id} updated successfully`
                }
              ]
            }
          }

          case QueueManagerAction.DELETE_ITEM: {
            const itemId = validateDataField<number>(data, 'itemId', 'number', '123')
            await deleteQueueItem(itemId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue item ${itemId} deleted successfully`
                }
              ]
            }
          }

          case QueueManagerAction.GET_ITEMS: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const status = data?.status as string | undefined

            const items = await getQueueItems(validQueueId, status)

            if (items.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No items found in queue ${validQueueId}${status ? ` with status '${status}'` : ''}`
                  }
                ]
              }
            }

            const itemList = items
              .map(
                (item) =>
                  `${item.id}: ${item.ticketId ? `Ticket ${item.ticketId}` : `Task ${item.taskId}`} ` +
                  `[${item.status}] Priority: ${item.priority}` +
                  `${item.agentId ? ` (Agent: ${item.agentId})` : ''}`
              )
              .join('\n')

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue items:\n${itemList}`
                }
              ]
            }
          }

          case QueueManagerAction.GET_STATS: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const stats = await getQueueStats(validQueueId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue Statistics for "${stats.queueName}":
Total Items: ${stats.totalItems}
Queued: ${stats.queuedItems}
In Progress: ${stats.inProgressItems}
Completed: ${stats.completedItems}
Failed: ${stats.failedItems}
Cancelled: ${stats.cancelledItems}
Average Processing Time: ${stats.averageProcessingTime ? `${Math.round(stats.averageProcessingTime / 1000)}s` : 'N/A'}
Current Agents: ${stats.currentAgents.length > 0 ? stats.currentAgents.join(', ') : 'None'}`
                }
              ]
            }
          }

          case QueueManagerAction.GET_ALL_STATS: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')
            const allStats = await getQueuesWithStats(validProjectId)

            if (allStats.length === 0) {
              return {
                content: [{ type: 'text', text: 'No queues found for this project' }]
              }
            }

            const statsSummary = allStats
              .map(
                ({ queue, stats }) =>
                  `${queue.name} [${queue.status}]:\n` +
                  `  Total: ${stats.totalItems} | Queued: ${stats.queuedItems} | ` +
                  `In Progress: ${stats.inProgressItems} | Completed: ${stats.completedItems}`
              )
              .join('\n\n')

            return {
              content: [
                {
                  type: 'text',
                  text: `All Queue Statistics:\n\n${statsSummary}`
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
