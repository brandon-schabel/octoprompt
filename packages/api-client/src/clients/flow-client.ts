import { z } from 'zod'
import { BaseApiClient } from '../base-client'

// Import schemas from the shared schemas package
import {
  TicketSchema,
  TicketTaskSchema,
  TaskQueueSchema
} from '@promptliano/schemas'

// Response schemas for validation
const FlowDataResponseSchema = z.object({
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

const FlowItemsResponseSchema = z.array(FlowItemSchema)

const UnqueuedItemsResponseSchema = z.object({
  tickets: z.array(TicketSchema),
  tasks: z.array(TicketTaskSchema)
})

const BulkMoveResponseSchema = z.object({
  success: z.boolean(),
  movedCount: z.number()
})

const OperationSuccessResponseSchema = z.object({
  success: z.boolean()
})

const EnqueueTicketBodySchema = z.object({
  queueId: z.number(),
  priority: z.number().optional(),
  includeTasks: z.boolean().optional()
})

const EnqueueTaskBodySchema = z.object({
  queueId: z.number(),
  priority: z.number().optional()
})

const DequeueTicketBodySchema = z.object({
  includeTasks: z.boolean().optional()
})

const MoveItemBodySchema = z.object({
  itemType: z.enum(['ticket', 'task']),
  itemId: z.number(),
  targetQueueId: z.number().nullable(),
  priority: z.number().optional(),
  includeTasks: z.boolean().optional()
})

const ReorderItemsBodySchema = z.object({
  queueId: z.number(),
  items: z.array(z.object({
    itemType: z.enum(['ticket', 'task']),
    itemId: z.number(),
    ticketId: z.number().optional()
  }))
})

const BulkMoveItemsBodySchema = z.object({
  items: z.array(z.object({
    itemType: z.enum(['ticket', 'task']),
    itemId: z.number()
  })),
  targetQueueId: z.number().nullable(),
  priority: z.number().optional()
})

const ProcessItemBodySchema = z.object({
  itemType: z.enum(['ticket', 'task']),
  itemId: z.number(),
  agentId: z.string()
})

const CompleteItemBodySchema = z.object({
  itemType: z.enum(['ticket', 'task']),
  itemId: z.number(),
  processingTime: z.number().optional()
})

const FailItemBodySchema = z.object({
  itemType: z.enum(['ticket', 'task']),
  itemId: z.number(),
  errorMessage: z.string()
})

/**
 * Flow API client for managing tickets, tasks, and queues in a unified system
 */
export class FlowClient extends BaseApiClient {
  /**
   * Get complete flow data for a project
   */
  async getFlowData(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/flow`, {
      responseSchema: FlowDataResponseSchema
    })
    return result
  }

  /**
   * Get flow items as a flat list
   */
  async getFlowItems(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/flow/items`, {
      responseSchema: FlowItemsResponseSchema
    })
    return result
  }

  /**
   * Get unqueued items for a project
   */
  async getUnqueuedItems(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/flow/unqueued`, {
      responseSchema: UnqueuedItemsResponseSchema
    })
    return result
  }

  /**
   * Enqueue a ticket to a specific queue
   */
  async enqueueTicket(ticketId: number, data: { queueId: number; priority?: number; includeTasks?: boolean }) {
    const validatedData = this.validateBody(EnqueueTicketBodySchema, data)
    const result = await this.request('POST', `/flow/tickets/${ticketId}/enqueue`, {
      body: validatedData,
      responseSchema: TicketSchema
    })
    return result
  }

  /**
   * Enqueue a task to a specific queue
   */
  async enqueueTask(taskId: number, data: { queueId: number; priority?: number }) {
    const validatedData = this.validateBody(EnqueueTaskBodySchema, data)
    const result = await this.request('POST', `/flow/tasks/${taskId}/enqueue`, {
      body: validatedData,
      responseSchema: TicketTaskSchema
    })
    return result
  }

  /**
   * Remove a ticket from its queue
   */
  async dequeueTicket(ticketId: number, options?: { includeTasks?: boolean }) {
    const validatedData = options
      ? this.validateBody(DequeueTicketBodySchema, options)
      : undefined
    const result = await this.request('POST', `/flow/tickets/${ticketId}/dequeue`, {
      body: validatedData,
      responseSchema: TicketSchema
    })
    return result
  }

  /**
   * Remove a task from its queue
   */
  async dequeueTask(taskId: number) {
    const result = await this.request('POST', `/flow/tasks/${taskId}/dequeue`, {
      responseSchema: TicketTaskSchema
    })
    return result
  }

  /**
   * Move an item to a different queue
   */
  async moveItem(data: {
    itemType: 'ticket' | 'task'
    itemId: number
    targetQueueId: number | null
    priority?: number
    includeTasks?: boolean
  }) {
    const validatedData = this.validateBody(MoveItemBodySchema, data)
    const result = await this.request('POST', '/flow/move', {
      body: validatedData,
      responseSchema: FlowItemSchema
    })
    return result
  }

  /**
   * Reorder items within a queue
   */
  async reorderQueueItems(data: {
    queueId: number
    items: Array<{ itemType: 'ticket' | 'task'; itemId: number; ticketId?: number }>
  }) {
    const validatedData = this.validateBody(ReorderItemsBodySchema, data)
    const result = await this.request('POST', '/flow/reorder', {
      body: validatedData,
      responseSchema: OperationSuccessResponseSchema
    })
    return result
  }

  /**
   * Move multiple items to a target queue
   */
  async bulkMoveItems(data: {
    items: Array<{ itemType: 'ticket' | 'task'; itemId: number }>
    targetQueueId: number | null
    priority?: number
  }) {
    const validatedData = this.validateBody(BulkMoveItemsBodySchema, data)
    const result = await this.request('POST', '/flow/bulk-move', {
      body: validatedData,
      responseSchema: BulkMoveResponseSchema
    })
    return result
  }

  /**
   * Start processing an item
   */
  async startProcessingItem(data: { itemType: 'ticket' | 'task'; itemId: number; agentId: string }) {
    const validatedData = this.validateBody(ProcessItemBodySchema, data)
    const result = await this.request('POST', '/flow/process/start', {
      body: validatedData,
      responseSchema: OperationSuccessResponseSchema
    })
    return result
  }

  /**
   * Complete processing an item
   */
  async completeProcessingItem(data: { itemType: 'ticket' | 'task'; itemId: number; processingTime?: number }) {
    const validatedData = this.validateBody(CompleteItemBodySchema, data)
    const result = await this.request('POST', '/flow/process/complete', {
      body: validatedData,
      responseSchema: OperationSuccessResponseSchema
    })
    return result
  }

  /**
   * Mark processing of an item as failed
   */
  async failProcessingItem(data: { itemType: 'ticket' | 'task'; itemId: number; errorMessage: string }) {
    const validatedData = this.validateBody(FailItemBodySchema, data)
    const result = await this.request('POST', '/flow/process/fail', {
      body: validatedData,
      responseSchema: OperationSuccessResponseSchema
    })
    return result
  }
}