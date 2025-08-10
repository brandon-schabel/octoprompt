// Queue storage layer using proper database columns
import { z } from 'zod'
import { TaskQueueSchema, type TaskQueue, type QueueStatus } from '@promptliano/schemas'
import { normalizeToUnixMs } from '@promptliano/shared/src/utils/parse-timestamp'
import { DatabaseManager, getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'

// Table names
const TASK_QUEUES_TABLE = 'task_queues'

// Storage schemas for validation
export const TaskQueuesStorageSchema = z.record(z.string(), TaskQueueSchema)
export type TaskQueuesStorage = z.infer<typeof TaskQueuesStorageSchema>

// Helper functions
async function validateData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): Promise<T> {
  const validationResult = await schema.safeParseAsync(data)
  if (!validationResult.success) {
    console.error(`Zod validation failed for ${context}:`, validationResult.error.errors)
    throw new ApiError(400, `Validation failed for ${context}`, 'VALIDATION_ERROR')
  }
  return validationResult.data
}

class QueueStorage {
  private getDb(): DatabaseManager {
    return getDb()
  }

  // === Task Queues ===

  async readQueues(projectId: number): Promise<TaskQueuesStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, project_id, name, description, status, max_parallel_items,
          average_processing_time, total_completed_items,
          created_at, updated_at
        FROM ${TASK_QUEUES_TABLE}
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)

      const rows = query.all(projectId) as any[]
      const queuesStorage: TaskQueuesStorage = {}

      for (const row of rows) {
        const queue: any = {
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          description: row.description || '',
          status: (row.status as QueueStatus) || 'active',
          maxParallelItems: row.max_parallel_items || 1,
          averageProcessingTime: row.average_processing_time ?? null,
          totalCompletedItems: row.total_completed_items || 0,
          created: Number(row.created_at) || Date.now(),
          updated: Number(row.updated_at) || Date.now()
        }

        const validatedQueue = await validateData<TaskQueue>(queue, TaskQueueSchema as any, `queue ${queue.id}`)
        queuesStorage[String(validatedQueue.id)] = validatedQueue
      }

      return queuesStorage
    } catch (error: any) {
      console.error(`Error reading queues for project ${projectId}:`, error)
      throw new ApiError(500, `Failed to read queues for project ${projectId}`, 'DB_READ_ERROR')
    }
  }

  async readQueue(queueId: number): Promise<TaskQueue | null> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, project_id, name, description, status, max_parallel_items,
          average_processing_time, total_completed_items,
          created_at, updated_at
        FROM ${TASK_QUEUES_TABLE}
        WHERE id = ?
      `)

      const row = query.get(queueId) as any
      if (!row) return null

      const queue: any = {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description || '',
        status: (row.status as QueueStatus) || 'active',
        maxParallelItems: row.max_parallel_items || 1,
        averageProcessingTime: row.average_processing_time ?? null,
        totalCompletedItems: row.total_completed_items || 0,
        created: Number(row.created_at) || Date.now(),
        updated: Number(row.updated_at) || Date.now()
      }

      return await validateData<TaskQueue>(queue, TaskQueueSchema as any, `queue ${queue.id}`)
    } catch (error: any) {
      console.error(`Error reading queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to read queue ${queueId}`, 'DB_READ_ERROR')
    }
  }

  async createQueue(queue: Omit<TaskQueue, 'id' | 'created' | 'updated'>): Promise<TaskQueue> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      const insertQuery = database.prepare(`
        INSERT INTO ${TASK_QUEUES_TABLE} (
          project_id, name, description, status, max_parallel_items,
          average_processing_time, total_completed_items,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = insertQuery.run(
        queue.projectId,
        queue.name,
        queue.description || '',
        queue.status || 'active',
        queue.maxParallelItems || 1,
        null, // average_processing_time
        queue.totalCompletedItems || 0, // total_completed_items
        now,
        now
      )

      const newQueue: any = {
        id: result.lastInsertRowid as number,
        ...queue,
        totalCompletedItems: queue.totalCompletedItems || 0,
        created: now,
        updated: now
      }

      return await validateData<TaskQueue>(newQueue, TaskQueueSchema as any, 'new queue')
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new ApiError(
          409,
          `Queue with name "${queue.name}" already exists in this project`,
          'DUPLICATE_QUEUE_NAME'
        )
      }
      console.error('Error creating queue:', error)
      throw new ApiError(500, 'Failed to create queue', 'DB_WRITE_ERROR')
    }
  }

  async updateQueue(
    queueId: number,
    updates: Partial<Omit<TaskQueue, 'id' | 'projectId' | 'created' | 'updated'>>
  ): Promise<TaskQueue> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      // Build dynamic update query
      const updateFields: string[] = ['updated_at = ?']
      const updateValues: any[] = [now]

      if (updates.name !== undefined) {
        updateFields.push('name = ?')
        updateValues.push(updates.name)
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(updates.description)
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?')
        updateValues.push(updates.status)
      }
      if (updates.maxParallelItems !== undefined) {
        updateFields.push('max_parallel_items = ?')
        updateValues.push(updates.maxParallelItems)
      }

      updateValues.push(queueId)

      const updateQuery = database.prepare(`
        UPDATE ${TASK_QUEUES_TABLE}
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `)

      updateQuery.run(...updateValues)

      const updatedQueue = await this.readQueue(queueId)
      if (!updatedQueue) {
        throw new ApiError(404, `Queue ${queueId} not found`, 'QUEUE_NOT_FOUND')
      }

      return updatedQueue
    } catch (error: any) {
      if (error instanceof ApiError) throw error
      console.error(`Error updating queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to update queue ${queueId}`, 'DB_WRITE_ERROR')
    }
  }

  async deleteQueue(queueId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const deleteQuery = database.prepare(`
        DELETE FROM ${TASK_QUEUES_TABLE}
        WHERE id = ?
      `)

      const result = deleteQuery.run(queueId)
      return result.changes > 0
    } catch (error: any) {
      console.error(`Error deleting queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to delete queue ${queueId}`, 'DB_DELETE_ERROR')
    }
  }

  // === Queue Items Methods Removed ===
  // All queue_items table operations have been removed.
  // Queue state is now managed directly in tickets and tasks tables using queue fields.

  // === Queue Statistics ===

  // Note: getQueueStats method removed - statistics are now computed from tickets/tasks tables directly

  // Get queue statistics from tickets and tasks tables
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
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Get stats from the tickets table
      const ticketStatsQuery = database.prepare(`
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
      `)

      const ticketStats = ticketStatsQuery.get(queueId) as any

      // Get stats from the tasks table
      const taskStatsQuery = database.prepare(`
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
      `)

      const taskStats = taskStatsQuery.get(queueId) as any

      // Combine stats from tickets and tasks
      const totalTickets = ticketStats?.total_tickets || 0
      const totalTasks = taskStats?.total_tasks || 0

      // Calculate average processing time from both sources
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
    } catch (error: any) {
      console.error(`Error getting enhanced queue stats for queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to get enhanced queue stats for queue ${queueId}`, 'DB_READ_ERROR')
    }
  }

  // === Utility Methods ===
  // Note: getNextQueueItem and getCurrentAgents methods removed - operations now handled through tickets/tasks directly

  // === Kanban Operations ===
  // Note: Kanban operations removed - now handled through tickets/tasks tables directly
}

// Export singleton instance
export const queueStorage = new QueueStorage()
