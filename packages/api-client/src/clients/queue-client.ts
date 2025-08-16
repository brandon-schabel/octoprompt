import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { 
  Queue,
  CreateQueueBody,
  UpdateQueueBody,
  QueueItem,
  QueueStats,
  EnqueueItemBody,
  CompleteTaskBody,
  FailTaskBody,
  DataResponseSchema,
  GetNextTaskResponse,
  QueueTimeline
} from '../types'
import type { BatchEnqueueBody } from '@promptliano/schemas'

// Import schemas
import {
  TaskQueueSchema,
  QueueItemSchema,
  CreateQueueBodySchema,
  UpdateQueueBodySchema,
  EnqueueItemBodySchema,
  QueueStatsSchema,
  QueueWithStatsSchema,
  GetNextTaskResponseSchema,
  BatchEnqueueBodySchema,
  QueueTimelineSchema
} from '@promptliano/schemas'
import type {
  QueueWithStats as SchemaQueueWithStats
} from '@promptliano/schemas'

// Additional types for queue operations
type TaskQueue = Queue
type QueueWithStats = SchemaQueueWithStats

/**
 * Queue API client for managing task queues, items, and workflow processing
 */
export class QueueClient extends BaseApiClient {
  /**
   * Create a new queue for a project
   */
  async createQueue(projectId: number, data: Omit<CreateQueueBody, 'projectId'>): Promise<DataResponseSchema<TaskQueue>> {
    const validatedData = this.validateBody(CreateQueueBodySchema.omit({ projectId: true }), data)
    return this.post(`/projects/${projectId}/queues`, validatedData)
  }

  /**
   * List all queues for a project
   */
  async listQueues(projectId: number): Promise<DataResponseSchema<TaskQueue[]>> {
    return this.get(`/projects/${projectId}/queues`)
  }

  /**
   * Get a queue by ID
   */
  async getQueue(queueId: number): Promise<DataResponseSchema<TaskQueue>> {
    return this.get(`/queues/${queueId}`)
  }

  /**
   * Update a queue
   */
  async updateQueue(queueId: number, data: UpdateQueueBody): Promise<DataResponseSchema<TaskQueue>> {
    const validatedData = this.validateBody(UpdateQueueBodySchema, data)
    return this.patch(`/queues/${queueId}`, validatedData)
  }

  /**
   * Delete a queue
   */
  async deleteQueue(queueId: number): Promise<DataResponseSchema<{ deleted: boolean }>> {
    return this.delete(`/queues/${queueId}`)
  }

  /**
   * Add an item to a queue
   */
  async enqueueItem(queueId: number, data: EnqueueItemBody): Promise<DataResponseSchema<QueueItem>> {
    const validatedData = this.validateBody(EnqueueItemBodySchema, data)
    return this.post(`/queues/${queueId}/items`, validatedData)
  }

  /**
   * Add a ticket and all its tasks to a queue
   */
  async enqueueTicket(queueId: number, ticketId: number, priority?: number): Promise<DataResponseSchema<QueueItem[]>> {
    return this.post(`/queues/${queueId}/enqueue-ticket`, { ticketId, priority })
  }

  /**
   * Add multiple items to a queue in a single operation
   */
  async batchEnqueue(queueId: number, data: BatchEnqueueBody): Promise<DataResponseSchema<QueueItem[]>> {
    const validatedData = this.validateBody(BatchEnqueueBodySchema, data)
    const result = await this.request('POST', `/queues/${queueId}/batch-enqueue`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(QueueItemSchema)
      })
    })
    return result as DataResponseSchema<QueueItem[]>
  }

  /**
   * Get all items in a queue with optional status filter
   */
  async getQueueItems(queueId: number, status?: string): Promise<DataResponseSchema<Array<{
    queueItem: QueueItem
    ticket?: any
    task?: any
  }>>> {
    const params: Record<string, any> = {}
    if (status) params.status = status

    const result = await this.request('GET', `/queues/${queueId}/items`, {
      params,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(
          z.object({
            queueItem: QueueItemSchema,
            ticket: z.any().optional(),
            task: z.any().optional()
          })
        )
      })
    })
    return result as DataResponseSchema<
      Array<{
        queueItem: QueueItem
        ticket?: any
        task?: any
      }>
    >
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueId: number): Promise<DataResponseSchema<QueueStats>> {
    const result = await this.request('GET', `/queues/${queueId}/stats`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: QueueStatsSchema
      })
    })
    return result as DataResponseSchema<QueueStats>
  }

  /**
   * Get all queues with their statistics for a project
   */
  async getQueuesWithStats(projectId: number): Promise<DataResponseSchema<QueueWithStats[]>> {
    const result = await this.request('GET', `/projects/${projectId}/queues-with-stats`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(QueueWithStatsSchema)
      })
    })
    return result as DataResponseSchema<QueueWithStats[]>
  }

  /**
   * Get the next task from a queue for processing
   */
  async getNextTask(queueId: number, agentId?: string): Promise<DataResponseSchema<GetNextTaskResponse>> {
    const result = await this.request('POST', `/queues/${queueId}/next-task`, {
      body: { agentId },
      responseSchema: z.object({
        success: z.boolean(),
        data: GetNextTaskResponseSchema
      })
    })
    return result as DataResponseSchema<GetNextTaskResponse>
  }

  /**
   * Get queue timeline showing processing history
   */
  async getQueueTimeline(queueId: number): Promise<DataResponseSchema<QueueTimeline>> {
    const result = await this.request('GET', `/queues/${queueId}/timeline`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: QueueTimelineSchema
      })
    })
    return result as DataResponseSchema<QueueTimeline>
  }

  /**
   * Get unqueued tickets and tasks for a project
   */
  async getUnqueuedItems(projectId: number): Promise<DataResponseSchema<{
    tickets: Array<{
      id: number
      title: string
      priority?: string
      created_at: number
      estimated_hours?: number | null
    }>
    tasks: Array<{
      id: number
      title: string
      ticket_id: number
      estimated_hours?: number | null
      ticket_title: string
    }>
  }>> {
    const result = await this.request('GET', `/projects/${projectId}/unqueued-items`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          tickets: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              priority: z.string().optional(),
              created_at: z.number(),
              estimated_hours: z.number().nullable().optional()
            })
          ),
          tasks: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              ticket_id: z.number(),
              estimated_hours: z.number().nullable().optional(),
              ticket_title: z.string()
            })
          )
        })
      })
    })
    return result as DataResponseSchema<{
      tickets: Array<{
        id: number
        title: string
        priority?: string
        created_at: number
        estimated_hours?: number | null
      }>
      tasks: Array<{
        id: number
        title: string
        ticket_id: number
        estimated_hours?: number | null
        ticket_title: string
      }>
    }>
  }

  /**
   * Mark a queue item as completed
   */
  async completeQueueItem(itemType: 'ticket' | 'task', itemId: number, ticketId?: number): Promise<DataResponseSchema<{ completed: boolean }>> {
    const result = await this.request('POST', `/queue/${itemType}/${itemId}/complete`, {
      body: ticketId ? { ticketId } : {},
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          completed: z.boolean()
        })
      })
    })
    return result as DataResponseSchema<{ completed: boolean }>
  }
}