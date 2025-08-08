// Queue storage layer using proper database columns
import { z } from 'zod'
import {
  TaskQueueSchema,
  QueueItemSchema,
  type TaskQueue,
  type QueueItem,
  type QueueStatus,
  type QueueItemStatus
} from '@promptliano/schemas'
import { normalizeToUnixMs } from '@promptliano/shared/src/utils/parse-timestamp'
import { DatabaseManager, getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'

// Table names
const TASK_QUEUES_TABLE = 'task_queues'
const QUEUE_ITEMS_TABLE = 'queue_items'

// Storage schemas for validation
export const TaskQueuesStorageSchema = z.record(z.string(), TaskQueueSchema)
export type TaskQueuesStorage = z.infer<typeof TaskQueuesStorageSchema>

export const QueueItemsStorageSchema = z.record(z.string(), QueueItemSchema)
export type QueueItemsStorage = z.infer<typeof QueueItemsStorageSchema>

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
        const queue: TaskQueue = {
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          description: row.description,
          status: row.status as QueueStatus,
          maxParallelItems: row.max_parallel_items,
          averageProcessingTime: row.average_processing_time,
          totalCompletedItems: row.total_completed_items,
          created: row.created_at,
          updated: row.updated_at
        }

        const validatedQueue = await validateData(queue, TaskQueueSchema, `queue ${queue.id}`)
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

      const queue: TaskQueue = {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        status: row.status as QueueStatus,
        maxParallelItems: row.max_parallel_items,
        averageProcessingTime: row.average_processing_time,
        totalCompletedItems: row.total_completed_items,
        created: row.created_at,
        updated: row.updated_at
      }

      return await validateData(queue, TaskQueueSchema, `queue ${queue.id}`)
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
        0, // total_completed_items
        now,
        now
      )

      const newQueue: TaskQueue = {
        id: result.lastInsertRowid as number,
        ...queue,
        created: now,
        updated: now
      }

      return await validateData(newQueue, TaskQueueSchema, 'new queue')
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

  // === Queue Items ===

  async readQueueItems(queueId: number, status?: QueueItemStatus): Promise<QueueItemsStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      let query
      if (status) {
        query = database.prepare(`
          SELECT 
            id, queue_id, ticket_id, task_id, status, priority, position,
            estimated_processing_time, actual_processing_time, agent_id,
            error_message, started_at, completed_at, created_at, updated_at
          FROM ${QUEUE_ITEMS_TABLE}
          WHERE queue_id = ? AND status = ?
          ORDER BY position ASC, priority DESC, created_at ASC
        `)
        var rows = query.all(queueId, status) as any[]
      } else {
        query = database.prepare(`
          SELECT 
            id, queue_id, ticket_id, task_id, status, priority, position,
            estimated_processing_time, actual_processing_time, agent_id,
            error_message, started_at, completed_at, created_at, updated_at
          FROM ${QUEUE_ITEMS_TABLE}
          WHERE queue_id = ?
          ORDER BY position ASC, priority DESC, created_at ASC
        `)
        var rows = query.all(queueId) as any[]
      }

      const itemsStorage: QueueItemsStorage = {}

      for (const row of rows) {
        const item: any = {
          id: row.id,
          queueId: row.queue_id,
          ticketId: row.ticket_id,
          taskId: row.task_id,
          status: row.status as QueueItemStatus,
          priority: row.priority,
          position: row.position,
          estimatedProcessingTime: row.estimated_processing_time,
          actualProcessingTime: row.actual_processing_time,
          agentId: row.agent_id,
          errorMessage: row.error_message,
          created: row.created_at,
          updated: row.updated_at
        }

        // Only add optional timestamp fields if they have values
        if (row.started_at !== null) item.startedAt = row.started_at
        if (row.completed_at !== null) item.completedAt = row.completed_at

        const validatedItem = await validateData(item, QueueItemSchema, `queue item ${item.id}`)
        itemsStorage[String(validatedItem.id)] = validatedItem
      }

      return itemsStorage
    } catch (error: any) {
      console.error(`Error reading queue items for queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to read queue items for queue ${queueId}`, 'DB_READ_ERROR')
    }
  }

  async readQueueItem(itemId: number): Promise<QueueItem | null> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, queue_id, ticket_id, task_id, status, priority, position,
          estimated_processing_time, actual_processing_time, agent_id,
          error_message, started_at, completed_at, created_at, updated_at
        FROM ${QUEUE_ITEMS_TABLE}
        WHERE id = ?
      `)

      const row = query.get(itemId) as any
      if (!row) return null

      const item: any = {
        id: row.id,
        queueId: row.queue_id,
        ticketId: row.ticket_id,
        taskId: row.task_id,
        status: row.status as QueueItemStatus,
        priority: row.priority,
        position: row.position,
        estimatedProcessingTime: row.estimated_processing_time,
        actualProcessingTime: row.actual_processing_time,
        agentId: row.agent_id,
        errorMessage: row.error_message,
        created: row.created_at,
        updated: row.updated_at
      }

      // Only add optional timestamp fields if they have values
      if (row.started_at !== null) item.startedAt = row.started_at
      if (row.completed_at !== null) item.completedAt = row.completed_at

      return await validateData(item, QueueItemSchema, `queue item ${item.id}`)
    } catch (error: any) {
      console.error(`Error reading queue item ${itemId}:`, error)
      throw new ApiError(500, `Failed to read queue item ${itemId}`, 'DB_READ_ERROR')
    }
  }

  async createQueueItem(item: Omit<QueueItem, 'id' | 'created' | 'updated'>): Promise<QueueItem> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      const insertQuery = database.prepare(`
        INSERT INTO ${QUEUE_ITEMS_TABLE} (
          queue_id, ticket_id, task_id, status, priority, position,
          estimated_processing_time, actual_processing_time, agent_id,
          error_message, started_at, completed_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      // Get next position if not provided
      let position = item.position
      if (position === null || position === undefined) {
        const maxPositionQuery = database.prepare(`
          SELECT MAX(position) as maxPos FROM ${QUEUE_ITEMS_TABLE} WHERE queue_id = ?
        `)
        const maxPosResult = maxPositionQuery.get(item.queueId) as any
        position = (maxPosResult?.maxPos || 0) + 1
      }

      const result = insertQuery.run(
        item.queueId,
        item.ticketId || null,
        item.taskId || null,
        item.status || 'queued',
        item.priority || 0,
        position,
        item.estimatedProcessingTime || null,
        item.actualProcessingTime || null,
        item.agentId || null,
        item.errorMessage || null,
        item.startedAt || null,
        item.completedAt || null,
        now,
        now
      )

      const newItem: any = {
        id: result.lastInsertRowid as number,
        queueId: item.queueId,
        ticketId: item.ticketId || null,
        taskId: item.taskId || null,
        status: item.status || 'queued',
        priority: item.priority || 0,
        position: position,
        estimatedProcessingTime: item.estimatedProcessingTime || null,
        actualProcessingTime: item.actualProcessingTime || null,
        agentId: item.agentId || null,
        errorMessage: item.errorMessage || null,
        created: now,
        updated: now
      }

      // Only add optional fields if they have values
      if (item.startedAt) newItem.startedAt = item.startedAt
      if (item.completedAt) newItem.completedAt = item.completedAt

      return await validateData(newItem, QueueItemSchema, 'new queue item')
    } catch (error: any) {
      console.error('Error creating queue item:', error)
      throw new ApiError(500, 'Failed to create queue item', 'DB_WRITE_ERROR')
    }
  }

  async updateQueueItem(
    itemId: number,
    updates: Partial<Omit<QueueItem, 'id' | 'queueId' | 'ticketId' | 'taskId' | 'created' | 'updated'>>
  ): Promise<QueueItem> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      // Build dynamic update query
      const updateFields: string[] = ['updated_at = ?']
      const updateValues: any[] = [now]

      if (updates.status !== undefined) {
        updateFields.push('status = ?')
        updateValues.push(updates.status)

        // Auto-set timestamps based on status
        if (updates.status === 'in_progress' && !updates.startedAt) {
          updateFields.push('started_at = ?')
          updateValues.push(now)
        }
        if (
          (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') &&
          !updates.completedAt
        ) {
          updateFields.push('completed_at = ?')
          updateValues.push(now)
        }
      }
      if (updates.priority !== undefined) {
        updateFields.push('priority = ?')
        updateValues.push(updates.priority)
      }
      if (updates.agentId !== undefined) {
        updateFields.push('agent_id = ?')
        updateValues.push(updates.agentId)
      }
      if (updates.errorMessage !== undefined) {
        updateFields.push('error_message = ?')
        updateValues.push(updates.errorMessage)
      }
      if (updates.startedAt !== undefined) {
        updateFields.push('started_at = ?')
        updateValues.push(updates.startedAt)
      }
      if (updates.completedAt !== undefined) {
        updateFields.push('completed_at = ?')
        updateValues.push(updates.completedAt)
      }

      updateValues.push(itemId)

      const updateQuery = database.prepare(`
        UPDATE ${QUEUE_ITEMS_TABLE}
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `)

      updateQuery.run(...updateValues)

      const updatedItem = await this.readQueueItem(itemId)
      if (!updatedItem) {
        throw new ApiError(404, `Queue item ${itemId} not found`, 'QUEUE_ITEM_NOT_FOUND')
      }

      return updatedItem
    } catch (error: any) {
      if (error instanceof ApiError) throw error
      console.error(`Error updating queue item ${itemId}:`, error)
      throw new ApiError(500, `Failed to update queue item ${itemId}`, 'DB_WRITE_ERROR')
    }
  }

  async deleteQueueItem(itemId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const deleteQuery = database.prepare(`
        DELETE FROM ${QUEUE_ITEMS_TABLE}
        WHERE id = ?
      `)

      const result = deleteQuery.run(itemId)
      return result.changes > 0
    } catch (error: any) {
      console.error(`Error deleting queue item ${itemId}:`, error)
      throw new ApiError(500, `Failed to delete queue item ${itemId}`, 'DB_DELETE_ERROR')
    }
  }

  // === Queue Statistics ===

  async getQueueStats(queueId: number): Promise<{
    totalItems: number
    queuedItems: number
    inProgressItems: number
    completedItems: number
    failedItems: number
    cancelledItems: number
    averageProcessingTime: number | null
  }> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const statsQuery = database.prepare(`
        SELECT 
          COUNT(*) as total_items,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued_items,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_items,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_items,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_items,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_items,
          AVG(CASE 
            WHEN status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL 
            THEN completed_at - started_at 
            ELSE NULL 
          END) as avg_processing_time
        FROM ${QUEUE_ITEMS_TABLE}
        WHERE queue_id = ?
      `)

      const stats = statsQuery.get(queueId) as any

      return {
        totalItems: stats.total_items || 0,
        queuedItems: stats.queued_items || 0,
        inProgressItems: stats.in_progress_items || 0,
        completedItems: stats.completed_items || 0,
        failedItems: stats.failed_items || 0,
        cancelledItems: stats.cancelled_items || 0,
        averageProcessingTime: stats.avg_processing_time
      }
    } catch (error: any) {
      console.error(`Error getting queue stats for queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to get queue stats for queue ${queueId}`, 'DB_READ_ERROR')
    }
  }

  // === Utility Methods ===

  async getNextQueueItem(queueId: number, agentId?: string): Promise<QueueItem | null> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Get the next queued item with highest priority
      const query = database.prepare(`
        SELECT 
          id, queue_id, ticket_id, task_id, status, priority, position,
          estimated_processing_time, actual_processing_time, agent_id,
          error_message, started_at, completed_at, created_at, updated_at
        FROM ${QUEUE_ITEMS_TABLE}
        WHERE queue_id = ? AND status = 'queued'
        ORDER BY position ASC, priority DESC, created_at ASC
        LIMIT 1
      `)

      const row = query.get(queueId) as any
      if (!row) return null

      // Mark it as in_progress with the agent
      await this.updateQueueItem(row.id, {
        status: 'in_progress',
        agentId: agentId || null
      })

      return await this.readQueueItem(row.id)
    } catch (error: any) {
      console.error(`Error getting next queue item for queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to get next queue item for queue ${queueId}`, 'DB_READ_ERROR')
    }
  }

  async getCurrentAgents(queueId: number): Promise<string[]> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT DISTINCT agent_id
        FROM ${QUEUE_ITEMS_TABLE}
        WHERE queue_id = ? AND status = 'in_progress' AND agent_id IS NOT NULL
      `)

      const rows = query.all(queueId) as any[]
      return rows.map((row) => row.agent_id)
    } catch (error: any) {
      console.error(`Error getting current agents for queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to get current agents for queue ${queueId}`, 'DB_READ_ERROR')
    }
  }

  // === Kanban Operations ===

  async bulkMoveItems(itemIds: number[], targetQueueId: number, positions?: number[]): Promise<void> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      // Use a transaction for bulk operations
      const transaction = database.transaction(() => {
        for (let i = 0; i < itemIds.length; i++) {
          const itemId = itemIds[i]
          const position = positions?.[i]

          if (position !== undefined) {
            // Update with specific position
            const updateQuery = database.prepare(`
              UPDATE ${QUEUE_ITEMS_TABLE}
              SET queue_id = ?, position = ?, updated_at = ?
              WHERE id = ?
            `)
            updateQuery.run(targetQueueId, position, now, itemId)
          } else {
            // Get next position
            const maxPositionQuery = database.prepare(`
              SELECT MAX(position) as maxPos FROM ${QUEUE_ITEMS_TABLE} WHERE queue_id = ?
            `)
            const maxPosResult = maxPositionQuery.get(targetQueueId) as any
            const nextPosition = (maxPosResult?.maxPos || 0) + 1

            const updateQuery = database.prepare(`
              UPDATE ${QUEUE_ITEMS_TABLE}
              SET queue_id = ?, position = ?, updated_at = ?
              WHERE id = ?
            `)
            updateQuery.run(targetQueueId, nextPosition, now, itemId)
          }

          // No need to update ticket/task tables - queue relationship is tracked in queue_items table only
        }
      })

      transaction()
    } catch (error: any) {
      console.error('Error bulk moving items:', error)
      throw new ApiError(500, 'Failed to bulk move items', 'DB_WRITE_ERROR')
    }
  }

  async reorderQueueItems(queueId: number, itemIds: number[]): Promise<void> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      // Use a transaction for bulk operations
      const transaction = database.transaction(() => {
        for (let i = 0; i < itemIds.length; i++) {
          const updateQuery = database.prepare(`
            UPDATE ${QUEUE_ITEMS_TABLE}
            SET position = ?, updated_at = ?
            WHERE id = ? AND queue_id = ?
          `)
          updateQuery.run(i + 1, now, itemIds[i], queueId)
        }
      })

      transaction()
    } catch (error: any) {
      console.error(`Error reordering queue ${queueId} items:`, error)
      throw new ApiError(500, `Failed to reorder queue ${queueId} items`, 'DB_WRITE_ERROR')
    }
  }

  async getUnqueuedItems(projectId: number): Promise<{ tickets: any[]; tasks: any[] }> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Get unqueued tickets - tickets that are not in any queue or have completed/failed status
      const ticketsQuery = database.prepare(`
        SELECT id, title, priority, created_at, estimated_hours
        FROM tickets
        WHERE project_id = ? 
        AND NOT EXISTS (
          SELECT 1 FROM ${QUEUE_ITEMS_TABLE} qi 
          WHERE qi.ticket_id = tickets.id 
          AND qi.status IN ('queued', 'in_progress')
        )
        ORDER BY priority DESC, created_at DESC
      `)
      const tickets = ticketsQuery.all(projectId) as any[]

      // Get unqueued tasks - tasks that are not in any queue or have completed/failed status
      const tasksQuery = database.prepare(`
        SELECT tt.id, tt.content as title, tt.ticket_id, tt.estimated_hours, t.title as ticket_title
        FROM ticket_tasks tt
        JOIN tickets t ON tt.ticket_id = t.id
        WHERE t.project_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM ${QUEUE_ITEMS_TABLE} qi 
          WHERE qi.task_id = tt.id 
          AND qi.status IN ('queued', 'in_progress')
        )
        ORDER BY tt.created_at DESC
      `)
      const tasks = tasksQuery.all(projectId) as any[]

      return { tickets, tasks }
    } catch (error: any) {
      console.error(`Error getting unqueued items for project ${projectId}:`, error)
      throw new ApiError(500, `Failed to get unqueued items for project ${projectId}`, 'DB_READ_ERROR')
    }
  }

  async updateQueueItemPosition(itemId: number, position: number): Promise<void> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      const updateQuery = database.prepare(`
        UPDATE ${QUEUE_ITEMS_TABLE}
        SET position = ?, updated_at = ?
        WHERE id = ?
      `)

      updateQuery.run(position, now, itemId)
    } catch (error: any) {
      console.error(`Error updating queue item ${itemId} position:`, error)
      throw new ApiError(500, `Failed to update queue item ${itemId} position`, 'DB_WRITE_ERROR')
    }
  }
}

// Export singleton instance
export const queueStorage = new QueueStorage()
