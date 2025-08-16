import { z } from '@hono/zod-openapi'
import {
  unixTSSchemaSpec,
  unixTSOptionalSchemaSpec,
  entityIdSchema,
  entityIdOptionalSchema,
  entityIdNullableOptionalSchema
} from './schema-utils'
import { createEntitySchemas } from './schema-factories'

// Queue status enum
export const QueueStatusEnum = z.enum(['active', 'paused', 'inactive'])
export type QueueStatus = z.infer<typeof QueueStatusEnum>

// Item queue status enum for tickets/tasks in Flow System
export const ItemQueueStatusEnum = z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled', 'timeout'])
export type ItemQueueStatus = z.infer<typeof ItemQueueStatusEnum>

// Task queue schemas using factory pattern
const queueSchemas = createEntitySchemas('TaskQueue', {
  projectId: entityIdSchema,
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  status: QueueStatusEnum.default('active'),
  maxParallelItems: z.number().min(1).max(10).default(1),
  averageProcessingTime: z.number().nullable().optional(), // in milliseconds
  totalCompletedItems: z.number().default(0)
}, {
  // Don't exclude status from updates - we want it to remain required
  updateExcludes: []
})

// Create a custom update schema that keeps status required while making other fields optional
export const UpdateTaskQueueSchema = queueSchemas.base
  .omit({ id: true, created: true, updated: true })
  .partial()
  .merge(z.object({
    status: QueueStatusEnum // Keep status required
  }))
  .openapi('UpdateTaskQueue')

export const TaskQueueSchema = queueSchemas.base

// Queue item schemas using factory pattern
const queueItemSchemas = createEntitySchemas('QueueItem', {
  queueId: entityIdSchema,
  ticketId: entityIdNullableOptionalSchema,
  taskId: entityIdNullableOptionalSchema,
  status: ItemQueueStatusEnum.default('queued'),
  priority: z.number().default(0),
  position: z.number().nullable().optional(),
  estimatedProcessingTime: z.number().nullable().optional(), // in milliseconds
  actualProcessingTime: z.number().nullable().optional(), // in milliseconds
  agentId: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  retryCount: z.number().default(0).optional(),
  maxRetries: z.number().default(3).optional(),
  timeoutAt: z.number().nullable().optional(), // Unix timestamp for timeout
  startedAt: unixTSOptionalSchemaSpec,
  completedAt: unixTSOptionalSchemaSpec
})

export const QueueItemSchema = queueItemSchemas.base
  .refine(
    (data) => {
      // Ensure either ticketId or taskId is set, but not both
      const hasTicket = data.ticketId != null // Check for both null and undefined
      const hasTask = data.taskId != null // Check for both null and undefined
      return (hasTicket && !hasTask) || (!hasTicket && hasTask)
    },
    {
      message: 'Either ticketId or taskId must be set, but not both'
    }
  )
  .openapi('QueueItem')

// Queue statistics schema
export const QueueStatsSchema = z
  .object({
    queueId: entityIdSchema,
    queueName: z.string(),
    totalItems: z.number(),
    queuedItems: z.number(),
    inProgressItems: z.number(),
    completedItems: z.number(),
    failedItems: z.number(),
    cancelledItems: z.number(),
    averageProcessingTime: z.number().nullable(), // in milliseconds
    currentAgents: z.array(z.string()), // list of agent IDs currently processing
    // Enhanced stats fields (optional for backward compatibility)
    ticketCount: z.number().optional(),
    taskCount: z.number().optional(),
    uniqueTickets: z.number().optional()
  })
  .openapi('QueueStats')

// Create and update schemas - manually define to avoid complex omit operations
export const CreateQueueBodySchema = z
  .object({
    projectId: entityIdSchema,
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    maxParallelItems: z.number().min(1).max(10).optional()
  })
  .openapi('CreateQueueBody')

export const UpdateQueueBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    status: QueueStatusEnum.optional(),
    maxParallelItems: z.number().min(1).max(10).optional()
  })
  .openapi('UpdateQueueBody')

// Enqueue item body schema
export const EnqueueItemBodySchema = z
  .object({
    ticketId: entityIdOptionalSchema,
    taskId: entityIdOptionalSchema,
    priority: z.number().optional(),
    agentId: z.string().optional()
  })
  .refine(
    (data) => {
      // Ensure either ticketId or taskId is set, but not both
      return (
        (data.ticketId !== undefined && data.taskId === undefined) ||
        (data.ticketId === undefined && data.taskId !== undefined)
      )
    },
    {
      message: 'Either ticketId or taskId must be set, but not both'
    }
  )
  .openapi('EnqueueItemBody')

// Note: UpdateQueueItemBodySchema removed - use ticket/task update endpoints directly

// Get next task response schema
// Note: Import cycle prevents direct import of TicketSchema and TicketTaskSchema
// These will be properly typed when used in services
export const GetNextTaskResponseSchema = z
  .object({
    queueItem: QueueItemSchema.nullable(),
    ticket: z.any().nullable(), // TicketSchema when used
    task: z.any().nullable() // TicketTaskSchema when used
  })
  .openapi('GetNextTaskResponse')

// Standardized batch enqueue result schema
export const BatchEnqueueResultSchema = z
  .object({
    items: z.array(QueueItemSchema), // Successfully enqueued items
    skipped: z.number().default(0), // Count of skipped duplicates
    errors: z.array(z.string()).optional() // Optional error messages
  })
  .openapi('BatchEnqueueResult')

// Queue with stats schema
export const QueueWithStatsSchema = z
  .object({
    queue: TaskQueueSchema,
    stats: QueueStatsSchema
  })
  .openapi('QueueWithStats')

// Type exports
export type TaskQueue = z.infer<typeof TaskQueueSchema>
export type UpdateTaskQueue = z.infer<typeof UpdateTaskQueueSchema>
export type QueueItem = z.infer<typeof QueueItemSchema>
export type QueueStats = z.infer<typeof QueueStatsSchema>
export type CreateQueueBody = z.infer<typeof CreateQueueBodySchema>
export type UpdateQueueBody = z.infer<typeof UpdateQueueBodySchema>
export type EnqueueItemBody = z.infer<typeof EnqueueItemBodySchema>
export type GetNextTaskResponse = z.infer<typeof GetNextTaskResponseSchema>
export type BatchEnqueueResult = z.infer<typeof BatchEnqueueResultSchema>
export type QueueWithStats = z.infer<typeof QueueWithStatsSchema>

// API validation schemas
export const queueApiValidation = {
  create: {
    body: CreateQueueBodySchema
  },
  update: {
    body: UpdateQueueBodySchema,
    params: z.object({
      queueId: z.string()
    })
  },
  getOrDelete: {
    params: z.object({
      queueId: z.string()
    })
  },
  enqueue: {
    body: EnqueueItemBodySchema,
    params: z.object({
      queueId: z.string()
    })
  },
  // Note: updateItem removed - use ticket/task update endpoints
  getNextTask: {
    params: z.object({
      queueId: z.string()
    }),
    query: z.object({
      agentId: z.string().optional()
    })
  }
}

// Batch operation schemas
export const BatchEnqueueBodySchema = z
  .object({
    items: z.array(EnqueueItemBodySchema).min(1).max(100)
  })
  .openapi('BatchEnqueueBody')

// Note: BatchUpdateItemsBodySchema removed - use ticket/task batch update endpoints

export type BatchEnqueueBody = z.infer<typeof BatchEnqueueBodySchema>
// Note: BatchUpdateItemsBody type removed

// Kanban operation schemas
export const BulkMoveItemsBodySchema = z
  .object({
    itemIds: z.array(entityIdSchema).min(1),
    targetQueueId: entityIdSchema,
    positions: z.array(z.number()).optional() // Optional array of positions for each item
  })
  .openapi('BulkMoveItemsBody')

export const ReorderQueueItemsBodySchema = z
  .object({
    queueId: entityIdSchema,
    itemIds: z.array(entityIdSchema).min(1) // Items in their new order
  })
  .openapi('ReorderQueueItemsBody')

export const QueueTimelineSchema = z
  .object({
    queueId: entityIdSchema,
    currentTime: z.number(),
    items: z.array(
      z.object({
        itemId: entityIdSchema,
        ticketId: entityIdNullableOptionalSchema,
        taskId: entityIdNullableOptionalSchema,
        title: z.string(),
        estimatedStartTime: z.number(),
        estimatedEndTime: z.number(),
        estimatedProcessingTime: z.number(),
        status: ItemQueueStatusEnum
      })
    ),
    totalEstimatedTime: z.number(),
    estimatedCompletionTime: z.number()
  })
  .openapi('QueueTimeline')

export type BulkMoveItemsBody = z.infer<typeof BulkMoveItemsBodySchema>
export type ReorderQueueItemsBody = z.infer<typeof ReorderQueueItemsBodySchema>
export type QueueTimeline = z.infer<typeof QueueTimelineSchema>
