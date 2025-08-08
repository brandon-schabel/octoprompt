import type { Database } from 'bun:sqlite'

/**
 * Migration to add task queue system tables
 *
 * This migration creates tables for managing AI task queues:
 * - task_queues: Defines different queue lanes for parallel processing
 * - queue_items: Individual items (tickets/tasks) in the queues
 *
 * Features:
 * - Multiple queue lanes for parallel AI processing
 * - Priority-based task ordering
 * - Status tracking (queued, in_progress, completed)
 * - Agent assignment tracking
 * - Comprehensive indexes for performance
 */
export const taskQueueSystemMigration = {
  version: 15,
  description: 'Add task queue system for AI agent processing',

  up: (db: Database) => {
    console.log('[Migration] Creating task queue system tables...')

    // Create task_queues table
    db.exec(`
      CREATE TABLE task_queues (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
        max_parallel_items INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, name)
      )
    `)

    // Create queue_items table
    db.exec(`
      CREATE TABLE queue_items (
        id INTEGER PRIMARY KEY,
        queue_id INTEGER NOT NULL,
        ticket_id INTEGER,
        task_id INTEGER,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
        priority INTEGER NOT NULL DEFAULT 0,
        agent_id TEXT,
        error_message TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES ticket_tasks(id) ON DELETE CASCADE,
        -- Ensure either ticket_id or task_id is set, but not both
        CHECK ((ticket_id IS NOT NULL AND task_id IS NULL) OR (ticket_id IS NULL AND task_id IS NOT NULL))
      )
    `)

    // Add queue-related columns to existing tables
    db.exec(`ALTER TABLE tickets ADD COLUMN queue_id INTEGER REFERENCES task_queues(id) ON DELETE SET NULL`)
    db.exec(
      `ALTER TABLE tickets ADD COLUMN queue_status TEXT CHECK (queue_status IN ('not_queued', 'queued', 'processing', 'completed'))`
    )
    db.exec(`ALTER TABLE tickets ADD COLUMN queued_at INTEGER`)

    db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queue_id INTEGER REFERENCES task_queues(id) ON DELETE SET NULL`)
    db.exec(
      `ALTER TABLE ticket_tasks ADD COLUMN queue_status TEXT CHECK (queue_status IN ('not_queued', 'queued', 'processing', 'completed'))`
    )
    db.exec(`ALTER TABLE ticket_tasks ADD COLUMN queued_at INTEGER`)

    // Create indexes for task_queues
    db.exec(`CREATE INDEX idx_task_queues_project_id ON task_queues(project_id)`)
    db.exec(`CREATE INDEX idx_task_queues_status ON task_queues(status)`)
    db.exec(`CREATE INDEX idx_task_queues_created_at ON task_queues(created_at)`)

    // Create indexes for queue_items
    db.exec(`CREATE INDEX idx_queue_items_queue_id ON queue_items(queue_id)`)
    db.exec(`CREATE INDEX idx_queue_items_ticket_id ON queue_items(ticket_id)`)
    db.exec(`CREATE INDEX idx_queue_items_task_id ON queue_items(task_id)`)
    db.exec(`CREATE INDEX idx_queue_items_status ON queue_items(status)`)
    db.exec(`CREATE INDEX idx_queue_items_priority ON queue_items(priority DESC)`)
    db.exec(`CREATE INDEX idx_queue_items_agent_id ON queue_items(agent_id)`)
    db.exec(`CREATE INDEX idx_queue_items_created_at ON queue_items(created_at)`)

    // Composite indexes for common queries
    db.exec(`CREATE INDEX idx_queue_items_queue_status ON queue_items(queue_id, status)`)
    db.exec(`CREATE INDEX idx_queue_items_queue_priority ON queue_items(queue_id, status, priority DESC, created_at)`)

    // Indexes for new columns in tickets and ticket_tasks
    db.exec(`CREATE INDEX idx_tickets_queue_id ON tickets(queue_id)`)
    db.exec(`CREATE INDEX idx_tickets_queue_status ON tickets(queue_status)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_queue_id ON ticket_tasks(queue_id)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_queue_status ON ticket_tasks(queue_status)`)

    console.log('[Migration] Task queue system tables created successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting task queue system...')

    // Drop indexes on tickets and ticket_tasks
    db.exec(`DROP INDEX IF EXISTS idx_tickets_queue_id`)
    db.exec(`DROP INDEX IF EXISTS idx_tickets_queue_status`)
    db.exec(`DROP INDEX IF EXISTS idx_ticket_tasks_queue_id`)
    db.exec(`DROP INDEX IF EXISTS idx_ticket_tasks_queue_status`)

    // Remove columns from existing tables
    // SQLite doesn't support DROP COLUMN, so we need to recreate the tables
    // For tickets
    db.exec(`
      CREATE TABLE tickets_temp AS 
      SELECT id, project_id, title, overview, status, priority, 
             suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
             created_at, updated_at
      FROM tickets
    `)
    db.exec(`DROP TABLE tickets`)
    db.exec(`ALTER TABLE tickets_temp RENAME TO tickets`)

    // Recreate tickets indexes
    db.exec(`CREATE INDEX idx_tickets_project_id ON tickets(project_id)`)
    db.exec(`CREATE INDEX idx_tickets_status ON tickets(status)`)
    db.exec(`CREATE INDEX idx_tickets_created_at ON tickets(created_at)`)
    db.exec(`CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)`)

    // For ticket_tasks
    db.exec(`
      CREATE TABLE ticket_tasks_temp AS 
      SELECT id, ticket_id, content, description, suggested_file_ids, done, 
             order_index, estimated_hours, dependencies, tags, agent_id, 
             suggested_prompt_ids, created_at, updated_at
      FROM ticket_tasks
    `)
    db.exec(`DROP TABLE ticket_tasks`)
    db.exec(`ALTER TABLE ticket_tasks_temp RENAME TO ticket_tasks`)

    // Recreate ticket_tasks indexes
    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_done ON ticket_tasks(done)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_order_index ON ticket_tasks(order_index)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_created_at ON ticket_tasks(created_at)`)

    // Drop queue tables
    db.exec(`DROP TABLE IF EXISTS queue_items`)
    db.exec(`DROP TABLE IF EXISTS task_queues`)

    console.log('[Migration] Task queue system reverted successfully')
  }
}
