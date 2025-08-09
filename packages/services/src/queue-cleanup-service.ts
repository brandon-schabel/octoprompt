import { ApiError } from '@promptliano/shared'
import { DatabaseManager } from '@promptliano/storage/src/database-manager'
import { queueStorage } from '@promptliano/storage'

export interface CleanupResult {
  orphanedItemsRemoved: number
  oldCompletedItemsRemoved: number
  invalidTasksRemoved: number
  invalidTicketsRemoved: number
  totalRemoved: number
  errors: string[]
}

/**
 * Clean up orphaned and invalid queue items
 * @param projectId - Optional project ID to limit cleanup scope
 * @param maxAgeMs - Maximum age for completed items (default: 7 days)
 */
export async function cleanupQueueData(
  projectId?: number,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): Promise<CleanupResult> {
  const result: CleanupResult = {
    orphanedItemsRemoved: 0,
    oldCompletedItemsRemoved: 0,
    invalidTasksRemoved: 0,
    invalidTicketsRemoved: 0,
    totalRemoved: 0,
    errors: []
  }

  try {
    const db = DatabaseManager.getInstance().getDatabase()
    const now = Date.now()
    const cutoffTime = now - maxAgeMs

    // Start transaction for atomic cleanup
    db.exec('BEGIN TRANSACTION')

    try {
      // 1. Remove orphaned queue items (queue doesn't exist)
      const orphanedResult = db
        .prepare(
          `
        DELETE FROM queue_items 
        WHERE queue_id NOT IN (SELECT id FROM task_queues)
      `
        )
        .run()
      result.orphanedItemsRemoved = orphanedResult.changes

      // 2. Remove old completed items
      const oldCompletedResult = db
        .prepare(
          `
        DELETE FROM queue_items 
        WHERE status IN ('completed', 'failed', 'cancelled', 'timeout')
        AND created_at < ?
        ${projectId ? 'AND queue_id IN (SELECT id FROM task_queues WHERE project_id = ?)' : ''}
      `
        )
        .run(...(projectId ? [cutoffTime, projectId] : [cutoffTime]))
      result.oldCompletedItemsRemoved = oldCompletedResult.changes

      // 3. Remove items with invalid task IDs
      const invalidTasksResult = db
        .prepare(
          `
        DELETE FROM queue_items 
        WHERE task_id IS NOT NULL 
        AND task_id NOT IN (SELECT id FROM ticket_tasks)
      `
        )
        .run()
      result.invalidTasksRemoved = invalidTasksResult.changes

      // 4. Remove items with invalid ticket IDs
      const invalidTicketsResult = db
        .prepare(
          `
        DELETE FROM queue_items 
        WHERE ticket_id IS NOT NULL 
        AND ticket_id NOT IN (SELECT id FROM tickets)
      `
        )
        .run()
      result.invalidTicketsRemoved = invalidTicketsResult.changes

      // 5. Update queue statistics after cleanup (using direct SQL within transaction)
      if (projectId) {
        // Get all queues for this project
        const queuesQuery = db.prepare(`
          SELECT id FROM task_queues WHERE project_id = ?
        `)
        const queues = queuesQuery.all(projectId) as any[]

        // Update statistics for each queue using direct SQL
        for (const queue of queues) {
          // Calculate statistics directly in SQL
          const statsQuery = db.prepare(`
            SELECT 
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_items,
              AVG(CASE 
                WHEN status = 'completed' AND actual_processing_time IS NOT NULL 
                THEN actual_processing_time 
                ELSE NULL 
              END) as avg_processing_time
            FROM queue_items
            WHERE queue_id = ?
          `)
          const stats = statsQuery.get(queue.id) as any

          // Update queue statistics directly
          const updateQuery = db.prepare(`
            UPDATE task_queues 
            SET 
              average_processing_time = ?,
              total_completed_items = ?,
              updated_at = ?
            WHERE id = ?
          `)
          updateQuery.run(stats.avg_processing_time, stats.completed_items || 0, Date.now(), queue.id)
        }
      }

      // Commit transaction
      db.exec('COMMIT')

      result.totalRemoved =
        result.orphanedItemsRemoved +
        result.oldCompletedItemsRemoved +
        result.invalidTasksRemoved +
        result.invalidTicketsRemoved

      console.log('[Queue Cleanup] Cleanup completed:', result)
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('[Queue Cleanup] Error during cleanup:', error)
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

/**
 * Reset a queue by removing all its items
 * @param queueId - The queue to reset
 */
export async function resetQueue(queueId: number): Promise<number> {
  try {
    const db = DatabaseManager.getInstance().getDatabase()

    // Start transaction for atomic reset
    db.exec('BEGIN TRANSACTION')

    try {
      // Verify queue exists
      const queueCheck = db.prepare('SELECT id FROM task_queues WHERE id = ?').get(queueId)
      if (!queueCheck) {
        db.exec('ROLLBACK')
        throw new ApiError(404, `Queue ${queueId} not found`, 'QUEUE_NOT_FOUND')
      }

      // Delete all items in the queue
      const result = db
        .prepare(
          `
        DELETE FROM queue_items WHERE queue_id = ?
      `
        )
        .run(queueId)

      // Reset queue statistics directly
      db.prepare(
        `
        UPDATE task_queues 
        SET 
          average_processing_time = NULL,
          total_completed_items = 0,
          updated_at = ?
        WHERE id = ?
      `
      ).run(Date.now(), queueId)

      db.exec('COMMIT')

      console.log(`[Queue Cleanup] Reset queue ${queueId}, removed ${result.changes} items`)
      return result.changes
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(`[Queue Cleanup] Error resetting queue ${queueId}:`, error)
    throw new ApiError(500, 'Failed to reset queue', 'QUEUE_RESET_ERROR')
  }
}

/**
 * Move failed items to dead letter queue
 * @param queueId - Optional queue ID to limit scope
 */
export async function moveFailedToDeadLetter(queueId?: number): Promise<number> {
  try {
    const db = DatabaseManager.getInstance().getDatabase()
    let movedCount = 0

    const whereClause = queueId
      ? 'WHERE queue_id = ? AND status = "failed" AND retry_count >= max_retries'
      : 'WHERE status = "failed" AND retry_count >= max_retries'

    const failedItems = db
      .prepare(
        `
      SELECT * FROM queue_items ${whereClause}
    `
      )
      .all(...(queueId ? [queueId] : [])) as any[]

    for (const item of failedItems) {
      // Insert into dead letter queue
      db.prepare(
        `
        INSERT INTO queue_dead_letter (
          original_queue_id, original_item_id, ticket_id, task_id,
          final_status, error_message, retry_count, agent_id,
          moved_at, original_created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        item.queue_id,
        item.id,
        item.ticket_id,
        item.task_id,
        item.status,
        item.error_message,
        item.retry_count,
        item.agent_id,
        Date.now(),
        item.created_at
      )

      // Delete from main queue
      db.prepare('DELETE FROM queue_items WHERE id = ?').run(item.id)
      movedCount++
    }

    console.log(`[Queue Cleanup] Moved ${movedCount} failed items to dead letter queue`)
    return movedCount
  } catch (error) {
    console.error('[Queue Cleanup] Error moving items to dead letter queue:', error)
    throw new ApiError(500, 'Failed to move items to dead letter queue', 'DEAD_LETTER_ERROR')
  }
}

/**
 * Get queue health status
 */
export async function getQueueHealth(projectId: number): Promise<{
  healthy: boolean
  issues: string[]
  stats: {
    totalQueues: number
    activeQueues: number
    totalItems: number
    orphanedItems: number
    stuckItems: number
  }
}> {
  const issues: string[] = []
  const db = DatabaseManager.getInstance().getDatabase()

  try {
    // Get queue stats
    const queues = await queueStorage.readQueues(projectId)
    const queueArray = Object.values(queues)
    const activeQueues = queueArray.filter((q) => q.status === 'active')

    // Count total items
    const totalItemsResult = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM queue_items 
      WHERE queue_id IN (SELECT id FROM task_queues WHERE project_id = ?)
    `
      )
      .get(projectId) as any

    // Count orphaned items
    const orphanedResult = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM queue_items 
      WHERE queue_id NOT IN (SELECT id FROM task_queues)
    `
      )
      .get() as any

    // Count stuck items (in_progress for > 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const stuckResult = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM queue_items 
      WHERE status = 'in_progress' AND started_at < ?
    `
      )
      .get(oneHourAgo) as any

    const stats = {
      totalQueues: queueArray.length,
      activeQueues: activeQueues.length,
      totalItems: totalItemsResult?.count || 0,
      orphanedItems: orphanedResult?.count || 0,
      stuckItems: stuckResult?.count || 0
    }

    // Check for issues
    if (stats.orphanedItems > 0) {
      issues.push(`${stats.orphanedItems} orphaned queue items found`)
    }
    if (stats.stuckItems > 0) {
      issues.push(`${stats.stuckItems} items stuck in processing`)
    }
    if (stats.totalQueues === 0) {
      issues.push('No queues exist for this project')
    }
    if (stats.activeQueues === 0 && stats.totalQueues > 0) {
      issues.push('All queues are paused or inactive')
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    }
  } catch (error) {
    console.error('[Queue Health] Error checking queue health:', error)
    issues.push('Failed to check queue health')
    return {
      healthy: false,
      issues,
      stats: {
        totalQueues: 0,
        activeQueues: 0,
        totalItems: 0,
        orphanedItems: 0,
        stuckItems: 0
      }
    }
  }
}
