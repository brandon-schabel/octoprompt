import type { Database } from 'bun:sqlite'

/**
 * Migration to add Kanban board enhancements to the queue system
 *
 * This migration adds:
 * - position field for manual ordering within queues
 * - estimated_processing_time for time estimates
 * - actual_processing_time for historical data
 * - Better indexes for Kanban queries
 */
export const kanbanBoardEnhancementsMigration = {
  version: 16,
  description: 'Add Kanban board enhancements to queue system',

  up: (db: Database) => {
    console.log('[Migration] Adding Kanban board enhancements...')

    // Add new columns to queue_items table
    db.exec(`ALTER TABLE queue_items ADD COLUMN position INTEGER`)
    db.exec(`ALTER TABLE queue_items ADD COLUMN estimated_processing_time INTEGER`)
    db.exec(`ALTER TABLE queue_items ADD COLUMN actual_processing_time INTEGER`)

    // Add new columns to tickets table for time estimates
    db.exec(`ALTER TABLE tickets ADD COLUMN estimated_hours REAL`)

    // Add new columns to task_queues for statistics
    db.exec(`ALTER TABLE task_queues ADD COLUMN average_processing_time INTEGER`)
    db.exec(`ALTER TABLE task_queues ADD COLUMN total_completed_items INTEGER NOT NULL DEFAULT 0`)

    // Create index for position-based queries
    db.exec(`CREATE INDEX idx_queue_items_position ON queue_items(queue_id, position)`)

    // Create index for timeline queries
    db.exec(
      `CREATE INDEX idx_queue_items_timeline ON queue_items(queue_id, status, position, estimated_processing_time)`
    )

    // Update existing queue items with default positions
    db.exec(`
      UPDATE queue_items 
      SET position = (
        SELECT COUNT(*) 
        FROM queue_items qi2 
        WHERE qi2.queue_id = queue_items.queue_id 
        AND qi2.created_at <= queue_items.created_at
      )
      WHERE position IS NULL
    `)

    console.log('[Migration] Kanban board enhancements added successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting Kanban board enhancements...')

    // Drop new indexes
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_position`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_timeline`)

    // Remove columns from queue_items
    // SQLite doesn't support DROP COLUMN, so we need to recreate the table
    db.exec(`
      CREATE TABLE queue_items_temp AS 
      SELECT id, queue_id, ticket_id, task_id, status, priority, agent_id, 
             error_message, started_at, completed_at, created_at, updated_at
      FROM queue_items
    `)
    db.exec(`DROP TABLE queue_items`)
    db.exec(`ALTER TABLE queue_items_temp RENAME TO queue_items`)

    // Recreate queue_items indexes
    db.exec(`CREATE INDEX idx_queue_items_queue_id ON queue_items(queue_id)`)
    db.exec(`CREATE INDEX idx_queue_items_ticket_id ON queue_items(ticket_id)`)
    db.exec(`CREATE INDEX idx_queue_items_task_id ON queue_items(task_id)`)
    db.exec(`CREATE INDEX idx_queue_items_status ON queue_items(status)`)
    db.exec(`CREATE INDEX idx_queue_items_priority ON queue_items(priority DESC)`)
    db.exec(`CREATE INDEX idx_queue_items_agent_id ON queue_items(agent_id)`)
    db.exec(`CREATE INDEX idx_queue_items_created_at ON queue_items(created_at)`)
    db.exec(`CREATE INDEX idx_queue_items_queue_status ON queue_items(queue_id, status)`)
    db.exec(`CREATE INDEX idx_queue_items_queue_priority ON queue_items(queue_id, status, priority DESC, created_at)`)

    // Remove columns from tickets
    db.exec(`
      CREATE TABLE tickets_temp AS 
      SELECT id, project_id, title, overview, status, priority, 
             suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
             queue_id, queue_status, queued_at, created_at, updated_at
      FROM tickets
    `)
    db.exec(`DROP TABLE tickets`)
    db.exec(`ALTER TABLE tickets_temp RENAME TO tickets`)

    // Recreate tickets indexes
    db.exec(`CREATE INDEX idx_tickets_project_id ON tickets(project_id)`)
    db.exec(`CREATE INDEX idx_tickets_status ON tickets(status)`)
    db.exec(`CREATE INDEX idx_tickets_created_at ON tickets(created_at)`)
    db.exec(`CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)`)
    db.exec(`CREATE INDEX idx_tickets_queue_id ON tickets(queue_id)`)
    db.exec(`CREATE INDEX idx_tickets_queue_status ON tickets(queue_status)`)

    // Remove columns from task_queues
    db.exec(`
      CREATE TABLE task_queues_temp AS 
      SELECT id, project_id, name, description, status, max_parallel_items,
             created_at, updated_at
      FROM task_queues
    `)
    db.exec(`DROP TABLE task_queues`)
    db.exec(`ALTER TABLE task_queues_temp RENAME TO task_queues`)

    // Recreate task_queues indexes
    db.exec(`CREATE INDEX idx_task_queues_project_id ON task_queues(project_id)`)
    db.exec(`CREATE INDEX idx_task_queues_status ON task_queues(status)`)
    db.exec(`CREATE INDEX idx_task_queues_created_at ON task_queues(created_at)`)

    console.log('[Migration] Kanban board enhancements reverted successfully')
  }
}
