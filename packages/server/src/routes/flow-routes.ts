/**
 * Flow Routes - Unified ticket and queue management API
 *
 * Provides a unified interface for managing tickets, tasks, and queues
 * as a single flow system.
 */

import { OpenAPIHono, z, createRoute } from '@hono/zod-openapi'
import { flowService } from '@promptliano/services'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../utils/route-helpers'
import {
  TicketSchema,
  TicketTaskSchema,
  CreateTicketBodySchema,
  UpdateTicketBodySchema,
  CreateTaskBodySchema,
  UpdateTaskBodySchema,
  TaskQueueSchema,
  entityIdSchema
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'

const app = new OpenAPIHono()

// === Flow Data Schemas ===

const FlowItemSchema = z.object({
  id: z.string(),
  type: z.enum(['ticket', 'task']),
  title: z.string(),
  description: z.string().optional(),
  ticket: TicketSchema.optional(),
  task: TicketTaskSchema.optional(),
  queueId: z.number().nullable().optional(),
  queuePosition: z.number().nullable().optional(),
  queueStatus: z.string().nullable().optional(),
  queuePriority: z.number().optional(),
  created: z.number(),
  updated: z.number()
})

const FlowDataSchema = z.object({
  unqueued: z.object({
    tickets: z.array(TicketSchema),
    tasks: z.array(TicketTaskSchema)
  }),
  queues: z.record(
    z.string(),
    z.object({
      queue: TaskQueueSchema,
      tickets: z.array(TicketSchema),
      tasks: z.array(TicketTaskSchema)
    })
  )
})

// === Flow Data Endpoints ===

// Get complete flow data for a project
const getFlowDataRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/flow',
  request: {
    params: z.object({
      projectId: z.coerce.number()
    })
  },
  responses: createStandardResponses(FlowDataSchema),
  tags: ['Flow'],
  summary: 'Get complete flow data for a project'
})

app.openapi(getFlowDataRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const flowData = await flowService.getFlowData(projectId)
  return c.json(flowData)
})

// Get flow items as a flat list
const getFlowItemsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/flow/items',
  request: {
    params: z.object({
      projectId: z.coerce.number()
    })
  },
  responses: createStandardResponses(z.array(FlowItemSchema)),
  tags: ['Flow'],
  summary: 'Get all flow items as a flat list'
})

app.openapi(getFlowItemsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const items = await flowService.getFlowItems(projectId)
  return c.json(items)
})

// Get unqueued items
const getUnqueuedItemsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/flow/unqueued',
  request: {
    params: z.object({
      projectId: z.coerce.number()
    })
  },
  responses: createStandardResponses(z.object({
    tickets: z.array(TicketSchema),
    tasks: z.array(TicketTaskSchema)
  })),
  tags: ['Flow'],
  summary: 'Get all unqueued tickets and tasks'
})

app.openapi(getUnqueuedItemsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const items = await flowService.getUnqueuedItems(projectId)
  return c.json(items)
})

// === Queue Operations ===

// Enqueue a ticket
const enqueueTicketRoute = createRoute({
  method: 'post',
  path: '/api/flow/tickets/{ticketId}/enqueue',
  request: {
    params: z.object({
      ticketId: z.coerce.number()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            queueId: z.coerce.number(),
            priority: z.number().default(0),
            includeTasks: z.boolean().default(false)
          })
        }
      }
    }
  },
  responses: createStandardResponses(TicketSchema),
  tags: ['Flow'],
  summary: 'Enqueue a ticket to a queue'
})

app.openapi(enqueueTicketRoute, async (c) => {
  const { ticketId } = c.req.valid('param')
  const { queueId, priority, includeTasks } = c.req.valid('json')

  if (includeTasks) {
    await flowService.enqueueTicketWithTasks(ticketId, queueId, priority)
    const ticket = await flowService.getTicketById(ticketId)
    return c.json(ticket)
  } else {
    const ticket = await flowService.enqueueTicket(ticketId, queueId, priority)
    return c.json(ticket)
  }
})

// Enqueue a task
const enqueueTaskRoute = createRoute({
  method: 'post',
  path: '/api/flow/tasks/{taskId}/enqueue',
  request: {
    params: z.object({
      taskId: z.coerce.number()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            queueId: z.coerce.number(),
            priority: z.number().default(0)
          })
        }
      }
    }
  },
  responses: createStandardResponses(TicketTaskSchema),
  tags: ['Flow'],
  summary: 'Enqueue a task to a queue'
})

app.openapi(enqueueTaskRoute, async (c) => {
  const { taskId } = c.req.valid('param')
  const { queueId, priority } = c.req.valid('json')

  const task = await flowService.enqueueTask(taskId, queueId, priority)
  return c.json(task)
})

// Dequeue a ticket
const dequeueTicketRoute = createRoute({
  method: 'post',
  path: '/api/flow/tickets/{ticketId}/dequeue',
  request: {
    params: z.object({
      ticketId: z.coerce.number()
    }),
    query: z.object({
      includeTasks: z
        .string()
        .optional()
        .transform((val) => val === 'true')
    })
  },
  responses: createStandardResponses(TicketSchema),
  tags: ['Flow'],
  summary: 'Remove a ticket from its queue'
})

app.openapi(dequeueTicketRoute, async (c) => {
  const { ticketId } = c.req.valid('param')
  const { includeTasks = false } = c.req.valid('query')

  if (includeTasks) {
    const ticket = await flowService.dequeueTicketWithTasks(ticketId)
    return c.json(ticket)
  } else {
    const ticket = await flowService.dequeueTicket(ticketId)
    return c.json(ticket)
  }
})

// Dequeue a task
const dequeueTaskRoute = createRoute({
  method: 'post',
  path: '/api/flow/tasks/{taskId}/dequeue',
  request: {
    params: z.object({
      taskId: z.coerce.number()
    })
  },
  responses: createStandardResponses(TicketTaskSchema),
  tags: ['Flow'],
  summary: 'Remove a task from its queue'
})

app.openapi(dequeueTaskRoute, async (c) => {
  const { taskId } = c.req.valid('param')
  const task = await flowService.dequeueTask(taskId)
  return c.json(task)
})

// Move an item between queues or to unqueued
const moveItemRoute = createRoute({
  method: 'post',
  path: '/api/flow/move',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            itemType: z.enum(['ticket', 'task']),
            itemId: z.coerce.number(),
            targetQueueId: z.coerce.number().nullable(),
            priority: z.number().default(0),
            includeTasks: z.boolean().default(false)
          })
        }
      }
    }
  },
  responses: createStandardResponses(FlowItemSchema),
  tags: ['Flow'],
  summary: 'Move an item between queues or to unqueued'
})

app.openapi(moveItemRoute, async (c) => {
  const { itemType, itemId, targetQueueId, priority, includeTasks } = c.req.valid('json')
  const item = await flowService.moveItem(itemType, itemId, targetQueueId, priority, includeTasks)
  return c.json(item)
})

// Reorder items within a queue
const reorderRoute = createRoute({
  method: 'post',
  path: '/api/flow/reorder',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            queueId: z.coerce.number(),
            items: z.array(
              z.object({
                itemType: z.enum(['ticket', 'task']),
                itemId: z.coerce.number(),
                ticketId: z.coerce.number().optional()
              })
            )
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({ success: z.boolean() })),
  tags: ['Flow'],
  summary: 'Persist new order for items in a queue'
})

app.openapi(reorderRoute, async (c) => {
  const { queueId, items } = c.req.valid('json')
  await flowService.reorderWithinQueue(queueId, items)
  return c.json({ success: true })
})

// === Processing Operations ===

// Start processing an item
const startProcessingRoute = createRoute({
  method: 'post',
  path: '/api/flow/process/start',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            itemType: z.enum(['ticket', 'task']),
            itemId: z.coerce.number(),
            agentId: z.string()
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({ success: z.boolean() })),
  tags: ['Flow'],
  summary: 'Mark an item as being processed'
})

app.openapi(startProcessingRoute, async (c) => {
  const { itemType, itemId, agentId } = c.req.valid('json')
  await flowService.startProcessingItem(itemType, itemId, agentId)
  return c.json({ success: true })
})

// Complete processing an item
const completeProcessingRoute = createRoute({
  method: 'post',
  path: '/api/flow/process/complete',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            itemType: z.enum(['ticket', 'task']),
            itemId: z.coerce.number(),
            processingTime: z.number().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({ success: z.boolean() })),
  tags: ['Flow'],
  summary: 'Mark an item as completed'
})

app.openapi(completeProcessingRoute, async (c) => {
  const { itemType, itemId, processingTime } = c.req.valid('json')
  await flowService.completeProcessingItem(itemType, itemId, processingTime)
  return c.json({ success: true })
})

// Fail processing an item
const failProcessingRoute = createRoute({
  method: 'post',
  path: '/api/flow/process/fail',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            itemType: z.enum(['ticket', 'task']),
            itemId: z.coerce.number(),
            errorMessage: z.string()
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({ success: z.boolean() })),
  tags: ['Flow'],
  summary: 'Mark an item as failed'
})

app.openapi(failProcessingRoute, async (c) => {
  const { itemType, itemId, errorMessage } = c.req.valid('json')
  await flowService.failProcessingItem(itemType, itemId, errorMessage)
  return c.json({ success: true })
})

// === Batch Operations ===

// Bulk move items
const bulkMoveRoute = createRoute({
  method: 'post',
  path: '/api/flow/bulk-move',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(
              z.object({
                itemType: z.enum(['ticket', 'task']),
                itemId: z.coerce.number()
              })
            ),
            targetQueueId: z.coerce.number().nullable(),
            priority: z.number().default(0)
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({
    success: z.boolean(),
    movedCount: z.number()
  })),
  tags: ['Flow'],
  summary: 'Move multiple items to a queue or unqueued'
})

app.openapi(bulkMoveRoute, async (c) => {
  const { items, targetQueueId, priority } = c.req.valid('json')

  let movedCount = 0
  for (const item of items) {
    try {
      await flowService.moveItem(item.itemType, item.itemId, targetQueueId, priority)
      movedCount++
    } catch (error) {
      console.error(`Failed to move ${item.itemType} ${item.itemId}:`, error)
    }
  }

  return c.json({ success: true, movedCount })
})

// Export the app
export const flowRoutes = app
