import type { Database } from 'bun:sqlite'

/**
 * Migration 023: Drop queue_items table
 *
 * This migration removes the queue_items table as part of consolidating
 * the queue system to use the Flow System (queue fields directly on tickets/tasks).
 *
 * The queue_items table was part of a dual tracking system that caused
 * inconsistencies. All queue state is now managed through queue fields
 * on the tickets and ticket_tasks tables.
 */
export const dropQueueItemsTableMigration = {
  version: 23,
  description: 'Drop obsolete queue_items table - queue state now managed in tickets/tasks',

  up: (db: Database) => {
    console.log('[Migration 023] Dropping queue_items table...')

    // Drop the queue_items table
    db.exec(`DROP TABLE IF EXISTS queue_items`)

    // Drop any indexes that may exist for queue_items
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_queue_id`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_item_type_id`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_status`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_priority`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_queued_at`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_started_at`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_completed_at`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_queue_priority`)
    db.exec(`DROP INDEX IF EXISTS idx_queue_items_queue_status`)

    console.log('[Migration 023] Successfully dropped queue_items table and indexes')
  },

  down: (db: Database) => {
    console.log('[Migration 023] Recreating queue_items table...')

    // Recreate the queue_items table (for rollback capability)
    db.exec(`
      CREATE TABLE IF NOT EXISTS queue_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue_id INTEGER NOT NULL,
        item_type TEXT NOT NULL CHECK(item_type IN ('ticket', 'task')),
        item_id INTEGER NOT NULL,
        ticket_id INTEGER,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
        priority INTEGER NOT NULL DEFAULT 0,
        agent_id TEXT,
        queued_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        failed_at INTEGER,
        cancelled_at INTEGER,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        processing_time_ms INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE,
        UNIQUE(queue_id, item_type, item_id)
      )
    `)

    // Recreate indexes
    db.exec(`CREATE INDEX idx_queue_items_queue_id ON queue_items(queue_id)`)
    db.exec(`CREATE INDEX idx_queue_items_item_type_id ON queue_items(item_type, item_id)`)
    db.exec(`CREATE INDEX idx_queue_items_status ON queue_items(status)`)
    db.exec(`CREATE INDEX idx_queue_items_priority ON queue_items(priority DESC)`)
    db.exec(`CREATE INDEX idx_queue_items_queued_at ON queue_items(queued_at)`)
    db.exec(`CREATE INDEX idx_queue_items_queue_priority ON queue_items(queue_id, priority DESC, queued_at)`)
    db.exec(`CREATE INDEX idx_queue_items_queue_status ON queue_items(queue_id, status)`)

    console.log('[Migration 023] Successfully recreated queue_items table')
  }
}
