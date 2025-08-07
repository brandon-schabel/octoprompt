import type { Database } from 'bun:sqlite'

/**
 * Migration to add atomic queue position tracking
 * Prevents race conditions in concurrent queue operations
 */
export const queuePositionAtomicityMigration = {
  version: 18,
  description: 'Add atomic queue position tracking to prevent race conditions',

  up: (db: Database) => {
    console.log('[Migration] Adding atomic queue position tracking...')

    try {
      // Create queue position tracking table
      db.exec(`
        CREATE TABLE IF NOT EXISTS queue_position_counters (
          queue_id INTEGER PRIMARY KEY,
          max_position INTEGER NOT NULL DEFAULT 0,
          last_updated INTEGER NOT NULL,
          FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE
        )
      `)

      // Create unique constraint on queue positions to prevent duplicates
      // First check if the constraint already exists
      const ticketConstraints = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tickets'")
        .get() as any

      if (!ticketConstraints?.sql?.includes('uniq_ticket_queue_position')) {
        // Need to recreate table with constraint (SQLite limitation)
        db.exec(`
          CREATE TABLE tickets_new AS SELECT * FROM tickets;
          DROP TABLE tickets;
          CREATE TABLE tickets (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            overview TEXT,
            status TEXT,
            priority TEXT,
            suggested_file_ids TEXT,
            suggested_agent_ids TEXT,
            suggested_prompt_ids TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            estimated_hours REAL,
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
            CONSTRAINT uniq_ticket_queue_position UNIQUE (queue_id, queue_position)
          );
          INSERT INTO tickets SELECT * FROM tickets_new;
          DROP TABLE tickets_new;
          
          -- Recreate indexes
          CREATE INDEX idx_tickets_project_id ON tickets(project_id);
          CREATE INDEX idx_tickets_status ON tickets(status);
          CREATE INDEX idx_tickets_created_at ON tickets(created_at);
          CREATE INDEX idx_tickets_updated_at ON tickets(updated_at);
          CREATE INDEX idx_tickets_queue ON tickets(queue_id);
          CREATE INDEX idx_tickets_queue_status ON tickets(queue_status);
          CREATE INDEX idx_tickets_queue_priority ON tickets(queue_id, queue_status, queue_priority DESC, queued_at);
        `)
      }

      // Similar for ticket_tasks
      const taskConstraints = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ticket_tasks'")
        .get() as any

      if (!taskConstraints?.sql?.includes('uniq_task_queue_position')) {
        db.exec(`
          CREATE TABLE ticket_tasks_new AS SELECT * FROM ticket_tasks;
          DROP TABLE ticket_tasks;
          CREATE TABLE ticket_tasks (
            id INTEGER PRIMARY KEY,
            ticket_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            description TEXT,
            suggested_file_ids TEXT,
            done BOOLEAN DEFAULT 0,
            order_index INTEGER,
            estimated_hours REAL,
            dependencies TEXT,
            tags TEXT,
            agent_id TEXT,
            suggested_prompt_ids TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
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
            CONSTRAINT uniq_task_queue_position UNIQUE (queue_id, queue_position),
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
          );
          INSERT INTO ticket_tasks SELECT * FROM ticket_tasks_new;
          DROP TABLE ticket_tasks_new;
          
          -- Recreate indexes
          CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id);
          CREATE INDEX idx_ticket_tasks_order ON ticket_tasks(ticket_id, order_index);
          CREATE INDEX idx_tasks_queue ON ticket_tasks(queue_id);
          CREATE INDEX idx_tasks_queue_status ON ticket_tasks(queue_status);
          CREATE INDEX idx_tasks_queue_priority ON ticket_tasks(queue_id, queue_status, queue_priority DESC, queued_at);
        `)
      }

      // Initialize position counters for existing queues
      db.exec(`
        INSERT INTO queue_position_counters (queue_id, max_position, last_updated)
        SELECT 
          q.id,
          COALESCE(MAX(COALESCE(t.queue_position, 0)), 0) as max_pos,
          ${Date.now()}
        FROM task_queues q
        LEFT JOIN (
          SELECT queue_id, queue_position FROM tickets WHERE queue_id IS NOT NULL
          UNION ALL
          SELECT queue_id, queue_position FROM ticket_tasks WHERE queue_id IS NOT NULL
        ) t ON q.id = t.queue_id
        GROUP BY q.id
      `)

      // Create triggers to clean queue fields when queue_id becomes NULL
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS clean_ticket_queue_fields
        AFTER UPDATE OF queue_id ON tickets
        WHEN NEW.queue_id IS NULL AND OLD.queue_id IS NOT NULL
        BEGIN
          UPDATE tickets 
          SET queue_position = NULL,
              queue_status = NULL,
              queue_priority = NULL,
              queued_at = NULL,
              queue_started_at = NULL,
              queue_completed_at = NULL,
              queue_agent_id = NULL,
              queue_error_message = NULL,
              estimated_processing_time = NULL,
              actual_processing_time = NULL
          WHERE id = NEW.id;
        END;
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS clean_task_queue_fields
        AFTER UPDATE OF queue_id ON ticket_tasks
        WHEN NEW.queue_id IS NULL AND OLD.queue_id IS NOT NULL
        BEGIN
          UPDATE ticket_tasks 
          SET queue_position = NULL,
              queue_status = NULL,
              queue_priority = NULL,
              queued_at = NULL,
              queue_started_at = NULL,
              queue_completed_at = NULL,
              queue_agent_id = NULL,
              queue_error_message = NULL,
              estimated_processing_time = NULL,
              actual_processing_time = NULL
          WHERE id = NEW.id;
        END;
      `)

      // Create trigger to maintain position counter
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_queue_position_counter
        AFTER INSERT ON task_queues
        BEGIN
          INSERT INTO queue_position_counters (queue_id, max_position, last_updated)
          VALUES (NEW.id, 0, ${Date.now()});
        END;
      `)

      console.log('[Migration] Successfully added atomic queue position tracking')
    } catch (error) {
      console.error('[Migration] Failed to add queue position atomicity:', error)
      throw error
    }
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting queue position atomicity...')

    try {
      // Drop triggers
      db.exec(`DROP TRIGGER IF EXISTS clean_ticket_queue_fields`)
      db.exec(`DROP TRIGGER IF EXISTS clean_task_queue_fields`)
      db.exec(`DROP TRIGGER IF EXISTS update_queue_position_counter`)

      // Drop position counter table
      db.exec(`DROP TABLE IF EXISTS queue_position_counters`)

      // Note: We can't easily remove the UNIQUE constraints without recreating tables
      // Since this is a safety feature, we'll leave them in place

      console.log('[Migration] Queue position atomicity reverted')
    } catch (error) {
      console.error('[Migration] Failed to revert queue position atomicity:', error)
      throw error
    }
  }
}
