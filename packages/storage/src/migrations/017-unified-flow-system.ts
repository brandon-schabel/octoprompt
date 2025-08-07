import type { Database } from 'bun:sqlite'

/**
 * Migration to unify the Flow system by moving queue state directly onto tickets and tasks.
 * This eliminates the queue_items table duplication and creates a single source of truth.
 *
 * Key changes:
 * - Adds queue-related columns to tickets and ticket_tasks tables
 * - Migrates existing queue_items data to the new structure
 * - Preserves queue_items table temporarily for rollback safety
 * - Adds proper indexes and foreign key constraints
 */
export const unifiedFlowSystemMigration = {
  version: 17,
  description: 'Unify Flow system - move queue state to tickets/tasks',

  up: (db: Database) => {
    console.log('[Migration] Starting unified Flow system migration...')

    try {
      // Step 1: Add queue columns to tickets table
      console.log('[Migration] Adding queue columns to tickets table...')

      // Check if columns already exist (for idempotency)
      const ticketColumns = db.prepare('PRAGMA table_info(tickets)').all() as any[]
      const ticketColumnNames = new Set(ticketColumns.map((col: any) => col.name))

      // Add each column only if it doesn't exist
      if (!ticketColumnNames.has('queue_id')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN queue_id INTEGER REFERENCES task_queues(id) ON DELETE SET NULL`)
      }
      if (!ticketColumnNames.has('queue_position')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN queue_position INTEGER`)
      }
      if (!ticketColumnNames.has('queue_status')) {
        db.exec(
          `ALTER TABLE tickets ADD COLUMN queue_status TEXT CHECK (queue_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled'))`
        )
      }
      if (!ticketColumnNames.has('queue_priority')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN queue_priority INTEGER DEFAULT 0`)
      }
      if (!ticketColumnNames.has('queued_at')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN queued_at INTEGER`)
      }
      if (!ticketColumnNames.has('queue_started_at')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN queue_started_at INTEGER`)
      }
      if (!ticketColumnNames.has('queue_completed_at')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN queue_completed_at INTEGER`)
      }
      if (!ticketColumnNames.has('queue_agent_id')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN queue_agent_id TEXT`)
      }
      if (!ticketColumnNames.has('queue_error_message')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN queue_error_message TEXT`)
      }
      if (!ticketColumnNames.has('estimated_processing_time')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN estimated_processing_time INTEGER`)
      }
      if (!ticketColumnNames.has('actual_processing_time')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN actual_processing_time INTEGER`)
      }

      // Step 2: Add queue columns to ticket_tasks table
      console.log('[Migration] Adding queue columns to ticket_tasks table...')

      const taskColumns = db.prepare('PRAGMA table_info(ticket_tasks)').all() as any[]
      const taskColumnNames = new Set(taskColumns.map((col: any) => col.name))

      // Add each column only if it doesn't exist
      if (!taskColumnNames.has('queue_id')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queue_id INTEGER REFERENCES task_queues(id) ON DELETE SET NULL`)
      }
      if (!taskColumnNames.has('queue_position')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queue_position INTEGER`)
      }
      if (!taskColumnNames.has('queue_status')) {
        db.exec(
          `ALTER TABLE ticket_tasks ADD COLUMN queue_status TEXT CHECK (queue_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled'))`
        )
      }
      if (!taskColumnNames.has('queue_priority')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queue_priority INTEGER DEFAULT 0`)
      }
      if (!taskColumnNames.has('queued_at')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queued_at INTEGER`)
      }
      if (!taskColumnNames.has('queue_started_at')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queue_started_at INTEGER`)
      }
      if (!taskColumnNames.has('queue_completed_at')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queue_completed_at INTEGER`)
      }
      if (!taskColumnNames.has('queue_agent_id')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queue_agent_id TEXT`)
      }
      if (!taskColumnNames.has('queue_error_message')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queue_error_message TEXT`)
      }
      if (!taskColumnNames.has('estimated_processing_time')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN estimated_processing_time INTEGER`)
      }
      if (!taskColumnNames.has('actual_processing_time')) {
        db.exec(`ALTER TABLE ticket_tasks ADD COLUMN actual_processing_time INTEGER`)
      }

      // Step 3: Check if queue_items table exists before trying to migrate
      console.log('[Migration] Checking for queue_items table...')

      const queueItemsExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='queue_items'")
        .get()

      if (queueItemsExists) {
        console.log('[Migration] Migrating queue_items data to tickets...')

        // Migrate ticket queue items
        const ticketQueueItems = db
          .prepare(
            `
          SELECT * FROM queue_items WHERE ticket_id IS NOT NULL
        `
          )
          .all() as any[]

        for (const item of ticketQueueItems) {
          db.prepare(
            `
            UPDATE tickets 
            SET 
              queue_id = ?,
              queue_position = ?,
              queue_status = ?,
              queue_priority = ?,
              queued_at = ?,
              queue_started_at = ?,
              queue_completed_at = ?,
              queue_agent_id = ?,
              queue_error_message = ?,
              estimated_processing_time = ?,
              actual_processing_time = ?
            WHERE id = ?
          `
          ).run(
            item.queue_id,
            item.position,
            item.status,
            item.priority,
            item.created_at,
            item.started_at,
            item.completed_at,
            item.agent_id,
            item.error_message,
            item.estimated_processing_time,
            item.actual_processing_time,
            item.ticket_id
          )
        }

        console.log(`[Migration] Migrated ${ticketQueueItems.length} ticket queue items`)
      } else {
        console.log('[Migration] No queue_items table found, skipping data migration')
      }

      // Step 4: Migrate existing queue_items data to tasks
      if (queueItemsExists) {
        console.log('[Migration] Migrating queue_items data to tasks...')

        // Migrate task queue items
        const taskQueueItems = db
          .prepare(
            `
          SELECT * FROM queue_items WHERE task_id IS NOT NULL
        `
          )
          .all() as any[]

        for (const item of taskQueueItems) {
          db.prepare(
            `
            UPDATE ticket_tasks 
            SET 
              queue_id = ?,
              queue_position = ?,
              queue_status = ?,
              queue_priority = ?,
              queued_at = ?,
              queue_started_at = ?,
              queue_completed_at = ?,
              queue_agent_id = ?,
              queue_error_message = ?,
              estimated_processing_time = ?,
              actual_processing_time = ?
            WHERE id = ?
          `
          ).run(
            item.queue_id,
            item.position,
            item.status,
            item.priority,
            item.created_at,
            item.started_at,
            item.completed_at,
            item.agent_id,
            item.error_message,
            item.estimated_processing_time,
            item.actual_processing_time,
            item.task_id
          )
        }

        console.log(`[Migration] Migrated ${taskQueueItems.length} task queue items`)
      }

      // Step 5: Add indexes for efficient querying
      console.log('[Migration] Adding indexes...')

      // Indexes for tickets
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_queue ON tickets(queue_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_queue_status ON tickets(queue_status)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_queue_position ON tickets(queue_id, queue_position)`)
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_tickets_queue_priority ON tickets(queue_id, queue_status, queue_priority DESC, queued_at)`
      )

      // Indexes for tasks
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_queue ON ticket_tasks(queue_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_queue_status ON ticket_tasks(queue_status)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_queue_position ON ticket_tasks(queue_id, queue_position)`)
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_tasks_queue_priority ON ticket_tasks(queue_id, queue_status, queue_priority DESC, queued_at)`
      )

      // Step 6: Create a backup table for queue_items (for rollback safety)
      console.log('[Migration] Creating backup of queue_items table...')

      db.exec(`
        CREATE TABLE IF NOT EXISTS queue_items_backup AS 
        SELECT * FROM queue_items
      `)

      // Step 7: Add migration metadata
      db.exec(`
        CREATE TABLE IF NOT EXISTS flow_migration_metadata (
          id INTEGER PRIMARY KEY,
          migration_version INTEGER NOT NULL,
          migrated_at INTEGER NOT NULL,
          tickets_migrated INTEGER,
          tasks_migrated INTEGER,
          queue_items_count INTEGER
        )
      `)

      const ticketsMigrated = db
        .prepare('SELECT COUNT(*) as count FROM tickets WHERE queue_id IS NOT NULL')
        .get() as any
      const tasksMigrated = db
        .prepare('SELECT COUNT(*) as count FROM ticket_tasks WHERE queue_id IS NOT NULL')
        .get() as any
      const queueItemsCount = db.prepare('SELECT COUNT(*) as count FROM queue_items').get() as any

      db.prepare(
        `
        INSERT INTO flow_migration_metadata (migration_version, migrated_at, tickets_migrated, tasks_migrated, queue_items_count)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(17, Date.now(), ticketsMigrated.count, tasksMigrated.count, queueItemsCount.count)

      console.log(`[Migration] Unified Flow system migration completed successfully!`)
      console.log(
        `[Migration] Migrated ${ticketsMigrated.count} tickets and ${tasksMigrated.count} tasks from ${queueItemsCount.count} queue items`
      )
      console.log(`[Migration] Note: queue_items table preserved for rollback safety - can be dropped after validation`)
    } catch (error) {
      console.error('[Migration] Failed to complete unified Flow system migration:', error)
      throw error
    }
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting unified Flow system migration...')

    db.exec('BEGIN TRANSACTION')

    try {
      // Step 1: Restore queue_items from backup if it exists
      const backupExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='queue_items_backup'")
        .get()

      if (backupExists) {
        console.log('[Migration] Restoring queue_items from backup...')
        db.exec(`DROP TABLE IF EXISTS queue_items`)
        db.exec(`ALTER TABLE queue_items_backup RENAME TO queue_items`)
      }

      // Step 2: Drop indexes
      console.log('[Migration] Dropping indexes...')
      db.exec(`DROP INDEX IF EXISTS idx_tickets_queue`)
      db.exec(`DROP INDEX IF EXISTS idx_tickets_queue_status`)
      db.exec(`DROP INDEX IF EXISTS idx_tickets_queue_position`)
      db.exec(`DROP INDEX IF EXISTS idx_tickets_queue_priority`)
      db.exec(`DROP INDEX IF EXISTS idx_tasks_queue`)
      db.exec(`DROP INDEX IF EXISTS idx_tasks_queue_status`)
      db.exec(`DROP INDEX IF EXISTS idx_tasks_queue_position`)
      db.exec(`DROP INDEX IF EXISTS idx_tasks_queue_priority`)

      // Step 3: Remove columns from tickets (requires table recreation in SQLite)
      console.log('[Migration] Removing queue columns from tickets...')
      db.exec(`
        CREATE TABLE tickets_temp AS 
        SELECT id, project_id, title, overview, status, priority,
               suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
               created_at, updated_at, estimated_hours
        FROM tickets
      `)
      db.exec(`DROP TABLE tickets`)
      db.exec(`ALTER TABLE tickets_temp RENAME TO tickets`)

      // Recreate original indexes
      db.exec(`CREATE INDEX idx_tickets_project_id ON tickets(project_id)`)
      db.exec(`CREATE INDEX idx_tickets_status ON tickets(status)`)
      db.exec(`CREATE INDEX idx_tickets_created_at ON tickets(created_at)`)
      db.exec(`CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)`)

      // Step 4: Remove columns from ticket_tasks
      console.log('[Migration] Removing queue columns from ticket_tasks...')
      db.exec(`
        CREATE TABLE ticket_tasks_temp AS 
        SELECT id, ticket_id, content, description, suggested_file_ids,
               done, order_index, estimated_hours, dependencies, tags,
               agent_id, suggested_prompt_ids, created_at, updated_at
        FROM ticket_tasks
      `)
      db.exec(`DROP TABLE ticket_tasks`)
      db.exec(`ALTER TABLE ticket_tasks_temp RENAME TO ticket_tasks`)

      // Recreate original indexes
      db.exec(`CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id)`)
      db.exec(`CREATE INDEX idx_ticket_tasks_order ON ticket_tasks(ticket_id, order_index)`)

      // Step 5: Clean up metadata
      db.exec(`DROP TABLE IF EXISTS flow_migration_metadata`)

      db.exec('COMMIT')
      console.log('[Migration] Unified Flow system migration reverted successfully')
    } catch (error) {
      db.exec('ROLLBACK')
      console.error('[Migration] Failed to revert unified Flow system migration:', error)
      throw error
    }
  }
}
