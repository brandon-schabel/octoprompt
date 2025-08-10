import type { Database } from 'bun:sqlite'

/**
 * Migration to fix queue_status values to match Zod schema
 *
 * The original migration used 'processing' but the Zod schema expects 'in_progress'.
 * This migration:
 * 1. Updates existing 'processing' values to 'in_progress'
 * 2. Recreates the CHECK constraints to use the correct values
 */
export const fixQueueStatusValuesMigration = {
  version: 21,
  description: 'Fix queue_status values to match Zod schema (processing -> in_progress)',

  up: (db: Database) => {
    console.log('[Migration] Fixing queue_status values...')

    // Start a transaction to ensure atomicity
    db.exec('BEGIN TRANSACTION')

    try {
      // SQLite doesn't allow us to update with CHECK constraint in place,
      // so we need to recreate the tables directly without trying to update first

      // SQLite doesn't support altering CHECK constraints directly, so we need to recreate the tables
      // For tickets table
      console.log('[Migration] Recreating tickets table with updated CHECK constraint...')

      // Create new table with correct constraint
      db.exec(`
        CREATE TABLE tickets_new (
          id INTEGER PRIMARY KEY,
          project_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          overview TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'open',
          priority TEXT NOT NULL DEFAULT 'normal',
          suggested_file_ids TEXT NOT NULL DEFAULT '[]',
          suggested_agent_ids TEXT NOT NULL DEFAULT '[]',
          suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
          queue_id INTEGER REFERENCES task_queues(id) ON DELETE SET NULL,
          queue_position INTEGER,
          queue_status TEXT CHECK (queue_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
          queue_priority INTEGER DEFAULT 0,
          queued_at INTEGER,
          queue_started_at INTEGER,
          queue_completed_at INTEGER,
          queue_agent_id TEXT,
          queue_error_message TEXT,
          estimated_processing_time INTEGER,
          actual_processing_time INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `)

      // Copy data from old table to new table, converting 'processing' to 'in_progress'
      db.exec(`
        INSERT INTO tickets_new 
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          queue_id, queue_position,
          CASE 
            WHEN queue_status = 'processing' THEN 'in_progress'
            ELSE queue_status 
          END as queue_status,
          queue_priority, queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM tickets
      `)

      // Drop old table and rename new table
      db.exec('DROP TABLE tickets')
      db.exec('ALTER TABLE tickets_new RENAME TO tickets')

      // Recreate indexes for tickets
      db.exec('CREATE INDEX idx_tickets_project_id ON tickets(project_id)')
      db.exec('CREATE INDEX idx_tickets_status ON tickets(status)')
      db.exec('CREATE INDEX idx_tickets_priority ON tickets(priority)')
      db.exec('CREATE INDEX idx_tickets_created_at ON tickets(created_at)')
      db.exec('CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)')
      db.exec('CREATE INDEX idx_tickets_queue_id ON tickets(queue_id)')
      db.exec('CREATE INDEX idx_tickets_queue_status ON tickets(queue_status)')

      // For ticket_tasks table
      console.log('[Migration] Recreating ticket_tasks table with updated CHECK constraint...')

      // Create new table with correct constraint
      db.exec(`
        CREATE TABLE ticket_tasks_new (
          id INTEGER PRIMARY KEY,
          ticket_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          suggested_file_ids TEXT NOT NULL DEFAULT '[]',
          done INTEGER NOT NULL DEFAULT 0,
          order_index INTEGER NOT NULL DEFAULT 0,
          estimated_hours REAL,
          dependencies TEXT NOT NULL DEFAULT '[]',
          tags TEXT NOT NULL DEFAULT '[]',
          agent_id TEXT,
          suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
          queue_id INTEGER REFERENCES task_queues(id) ON DELETE SET NULL,
          queue_position INTEGER,
          queue_status TEXT CHECK (queue_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
          queue_priority INTEGER DEFAULT 0,
          queued_at INTEGER,
          queue_started_at INTEGER,
          queue_completed_at INTEGER,
          queue_agent_id TEXT,
          queue_error_message TEXT,
          estimated_processing_time INTEGER,
          actual_processing_time INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
        )
      `)

      // Copy data from old table to new table, converting 'processing' to 'in_progress'
      db.exec(`
        INSERT INTO ticket_tasks_new 
        SELECT 
          id, ticket_id, content, description, suggested_file_ids,
          done, order_index, estimated_hours, dependencies, tags,
          agent_id, suggested_prompt_ids,
          queue_id, queue_position,
          CASE 
            WHEN queue_status = 'processing' THEN 'in_progress'
            ELSE queue_status 
          END as queue_status,
          queue_priority, queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM ticket_tasks
      `)

      // Drop old table and rename new table
      db.exec('DROP TABLE ticket_tasks')
      db.exec('ALTER TABLE ticket_tasks_new RENAME TO ticket_tasks')

      // Recreate indexes for ticket_tasks
      db.exec('CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id)')
      db.exec('CREATE INDEX idx_ticket_tasks_done ON ticket_tasks(done)')
      db.exec('CREATE INDEX idx_ticket_tasks_order_index ON ticket_tasks(order_index)')
      db.exec('CREATE INDEX idx_ticket_tasks_created_at ON ticket_tasks(created_at)')
      db.exec('CREATE INDEX idx_ticket_tasks_queue_id ON ticket_tasks(queue_id)')
      db.exec('CREATE INDEX idx_ticket_tasks_queue_status ON ticket_tasks(queue_status)')

      // Commit the transaction
      db.exec('COMMIT')
      console.log('[Migration] Queue status values fixed successfully')
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK')
      throw error
    }
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting queue status value fix...')

    // This would revert back to 'processing' but we don't really want to do that
    // as it would break the Zod schema validation
    console.log('[Migration] Note: Down migration not implemented as it would reintroduce the schema mismatch')
  }
}
