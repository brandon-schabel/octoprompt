// Queue storage layer using BaseStorage pattern
import { z } from 'zod'
import { TaskQueueSchema, type TaskQueue, type QueueStatus } from '@promptliano/schemas'
import { BaseStorage } from './base-storage'
import { 
  createEntityConverter,
  createStandardMappings,
  getInsertColumnsFromMappings,
  getInsertValuesFromEntity
} from './utils/storage-helpers'
import { SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'
import { QueueErrors } from '@promptliano/shared/src/error/entity-errors'

// Storage schemas for validation
export const TaskQueuesStorageSchema = z.record(z.string(), TaskQueueSchema)
export type TaskQueuesStorage = z.infer<typeof TaskQueuesStorageSchema>

/**
 * Queue storage implementation using BaseStorage
 * Reduced from 335 lines to ~180 lines
 */
class QueueStorage extends BaseStorage<TaskQueue, TaskQueuesStorage> {
  protected readonly tableName = 'task_queues'
  protected readonly entitySchema = TaskQueueSchema as any
  protected readonly storageSchema = TaskQueuesStorageSchema as any

  private readonly fieldMappings = {
    // Core fields
    id: { dbColumn: 'id', converter: (v: any) => SqliteConverters.toNumber(v) },
    projectId: { dbColumn: 'project_id', converter: (v: any) => SqliteConverters.toNumber(v) },
    name: { dbColumn: 'name', converter: (v: any) => SqliteConverters.toString(v) },
    description: { dbColumn: 'description', converter: (v: any) => SqliteConverters.toString(v), defaultValue: '' },
    status: { dbColumn: 'status', converter: (v: any) => v },
    maxParallelItems: { dbColumn: 'max_parallel_items', converter: (v: any) => SqliteConverters.toNumber(v) },
    averageProcessingTime: { 
      dbColumn: 'average_processing_time', 
      converter: (v: any) => v === null || v === undefined ? null : SqliteConverters.toNumber(v) 
    },
    totalCompletedItems: { 
      dbColumn: 'total_completed_items', 
      converter: (v: any) => SqliteConverters.toNumber(v) 
    },
    // Timestamps
    created: { dbColumn: 'created_at', converter: (v: any) => SqliteConverters.toTimestamp(v) },
    updated: { dbColumn: 'updated_at', converter: (v: any) => SqliteConverters.toTimestamp(v) }
  } as const

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  protected rowToEntity(row: any): TaskQueue {
    return this.converter(row) as TaskQueue
  }

  protected getSelectColumns(): string[] {
    return [
      'id', 'project_id', 'name', 'description', 'status', 
      'max_parallel_items', 'average_processing_time', 
      'total_completed_items', 'created_at', 'updated_at'
    ]
  }

  protected getInsertColumns(): string[] {
    return getInsertColumnsFromMappings(this.fieldMappings)
  }

  protected getInsertValues(entity: TaskQueue): any[] {
    return getInsertValuesFromEntity(entity, this.fieldMappings)
  }

  // === Custom Methods ===

  async readQueues(projectId: number): Promise<TaskQueuesStorage> {
    return this.readAll('project_id = ?', [projectId])
  }

  async readQueue(queueId: number): Promise<TaskQueue | null> {
    return this.getById(queueId)
  }

  async createQueue(queue: Omit<TaskQueue, 'id' | 'created' | 'updated'>): Promise<TaskQueue> {
    const newQueue: TaskQueue = {
      ...queue,
      id: await this.generateId(),
      status: queue.status || 'active',
      maxParallelItems: queue.maxParallelItems || 1,
      totalCompletedItems: queue.totalCompletedItems || 0,
      averageProcessingTime: queue.averageProcessingTime ?? null,
      created: Date.now(),
      updated: Date.now()
    }

    try {
      return await this.add(newQueue)
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw QueueErrors.duplicate('name', queue.name)
      }
      throw error
    }
  }

  async updateQueue(
    queueId: number,
    updates: Partial<Omit<TaskQueue, 'id' | 'projectId' | 'created' | 'updated'>>
  ): Promise<TaskQueue> {
    const result = await this.update(queueId, updates)
    if (!result) {
      throw QueueErrors.notFound(queueId)
    }
    return result
  }

  async deleteQueue(queueId: number): Promise<boolean> {
    return this.delete(queueId)
  }

  // === Enhanced Queue Statistics ===
  async getEnhancedQueueStats(queueId: number): Promise<{
    totalItems: number
    queuedItems: number
    inProgressItems: number
    completedItems: number
    failedItems: number
    cancelledItems: number
    averageProcessingTime: number | null
    ticketCount: number
    taskCount: number
    uniqueTickets: number
  }> {
    const db = this.getDb()
    const database = db.getDatabase()

    // Get ticket stats
    const ticketStats = database.prepare(`
      SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN queue_status = 'queued' OR queue_status IS NULL THEN 1 ELSE 0 END) as queued_tickets,
        SUM(CASE WHEN queue_status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tickets,
        SUM(CASE WHEN queue_status = 'completed' THEN 1 ELSE 0 END) as completed_tickets,
        SUM(CASE WHEN queue_status = 'failed' THEN 1 ELSE 0 END) as failed_tickets,
        SUM(CASE WHEN queue_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_tickets,
        AVG(CASE 
          WHEN queue_status = 'completed' AND queue_started_at IS NOT NULL AND queue_completed_at IS NOT NULL 
          THEN queue_completed_at - queue_started_at 
          ELSE NULL 
        END) as avg_processing_time
      FROM tickets
      WHERE queue_id = ?
    `).get(queueId) as any

    // Get task stats
    const taskStats = database.prepare(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN queue_status = 'queued' OR queue_status IS NULL THEN 1 ELSE 0 END) as queued_tasks,
        SUM(CASE WHEN queue_status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN queue_status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN queue_status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
        SUM(CASE WHEN queue_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_tasks,
        AVG(CASE 
          WHEN queue_status = 'completed' AND queue_started_at IS NOT NULL AND queue_completed_at IS NOT NULL 
          THEN queue_completed_at - queue_started_at 
          ELSE NULL 
        END) as avg_task_processing_time
      FROM ticket_tasks
      WHERE queue_id = ?
    `).get(queueId) as any

    // Combine stats
    const totalTickets = ticketStats?.total_tickets || 0
    const totalTasks = taskStats?.total_tasks || 0
    
    let avgProcessingTime = null
    if (ticketStats?.avg_processing_time || taskStats?.avg_task_processing_time) {
      const times = [ticketStats?.avg_processing_time, taskStats?.avg_task_processing_time].filter(Boolean)
      avgProcessingTime = times.reduce((a, b) => a + b, 0) / times.length
    }

    return {
      totalItems: totalTickets + totalTasks,
      queuedItems: (ticketStats?.queued_tickets || 0) + (taskStats?.queued_tasks || 0),
      inProgressItems: (ticketStats?.in_progress_tickets || 0) + (taskStats?.in_progress_tasks || 0),
      completedItems: (ticketStats?.completed_tickets || 0) + (taskStats?.completed_tasks || 0),
      failedItems: (ticketStats?.failed_tickets || 0) + (taskStats?.failed_tasks || 0),
      cancelledItems: (ticketStats?.cancelled_tickets || 0) + (taskStats?.cancelled_tasks || 0),
      averageProcessingTime: avgProcessingTime,
      ticketCount: totalTickets,
      taskCount: totalTasks,
      uniqueTickets: totalTickets
    }
  }
}

// Export singleton instance
const queueStorageInstance = new QueueStorage()

// Export the storage object for backward compatibility
export const queueStorage = {
  readQueues: (projectId: number) => queueStorageInstance.readQueues(projectId),
  readQueue: (queueId: number) => queueStorageInstance.readQueue(queueId),
  createQueue: (queue: Omit<TaskQueue, 'id' | 'created' | 'updated'>) => 
    queueStorageInstance.createQueue(queue),
  updateQueue: (queueId: number, updates: Partial<Omit<TaskQueue, 'id' | 'projectId' | 'created' | 'updated'>>) => 
    queueStorageInstance.updateQueue(queueId, updates),
  deleteQueue: (queueId: number) => queueStorageInstance.deleteQueue(queueId),
  getEnhancedQueueStats: (queueId: number) => queueStorageInstance.getEnhancedQueueStats(queueId)
}