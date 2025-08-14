import type { Database } from 'bun:sqlite'

export const queueImprovementsMigration = {
  version: 18,
  description: 'Add queue improvements: duplicate prevention, retry mechanism, timeout handling, and pause/resume',

  up: (db: Database) => {
    console.log('[Migration 018] Starting queue improvements migration...')

    // Step 1: Add new columns to task_queues table for pause/resume
    console.log('[Migration 018] Adding status column for pause/resume to task_queues...')
    db.exec(`
      -- Drop any existing backup tables from previous incomplete runs
      DROP TABLE IF EXISTS task_queues_backup;
      
      -- Backup existing data
      CREATE TABLE task_queues_backup AS SELECT * FROM task_queues;
      
      -- Drop and recreate with new columns
      DROP TABLE task_queues;
      
      CREATE TABLE task_queues (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
        max_parallel_items INTEGER NOT NULL DEFAULT 1,
        average_processing_time INTEGER,
        total_completed_items INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, name)
      );
      
      -- Restore data
      INSERT INTO task_queues 
      SELECT * FROM task_queues_backup;
      
      DROP TABLE task_queues_backup;
    `)

    // Step 2: Add new columns to queue_items for retry mechanism and timeout
    console.log('[Migration 018] Adding retry and timeout columns to queue_items...')
    db.exec(`
      -- Drop any existing backup tables from previous incomplete runs
      DROP TABLE IF EXISTS queue_items_backup;
      
      -- Backup existing data
      CREATE TABLE queue_items_backup AS SELECT * FROM queue_items;
      
      -- Drop and recreate with new columns
      DROP TABLE queue_items;
      
      CREATE TABLE queue_items (
        id INTEGER PRIMARY KEY,
        queue_id INTEGER NOT NULL,
        ticket_id INTEGER,
        task_id INTEGER,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled', 'timeout')),
        priority INTEGER NOT NULL DEFAULT 0,
        position INTEGER,
        agent_id TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        timeout_at INTEGER,
        estimated_processing_time INTEGER,
        actual_processing_time INTEGER,
        started_at INTEGER,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES ticket_tasks(id) ON DELETE CASCADE,
        -- Ensure either ticket_id or task_id is set, but not both
        CHECK ((ticket_id IS NOT NULL AND task_id IS NULL) OR (ticket_id IS NULL AND task_id IS NOT NULL))
      );
      
      -- Restore data with new defaults
      INSERT INTO queue_items (
        id, queue_id, ticket_id, task_id, status, priority, position,
        agent_id, error_message, started_at, completed_at, created_at, updated_at
      )
      SELECT 
        id, queue_id, ticket_id, task_id, status, priority, position,
        agent_id, error_message, started_at, completed_at, created_at, updated_at
      FROM queue_items_backup;
      
      DROP TABLE queue_items_backup;
    `)

    // Step 3: Create unique index for duplicate prevention
    console.log('[Migration 018] Creating indexes for duplicate prevention...')
    db.exec(`
      -- Unique index to prevent duplicates (only for non-completed items)
      CREATE UNIQUE INDEX idx_queue_items_unique_active 
      ON queue_items(queue_id, ticket_id, task_id) 
      WHERE status NOT IN ('completed', 'failed', 'cancelled', 'timeout');
      
      -- Regular indexes for performance
      CREATE INDEX idx_queue_items_queue_id ON queue_items(queue_id);
      CREATE INDEX idx_queue_items_ticket_id ON queue_items(ticket_id);
      CREATE INDEX idx_queue_items_task_id ON queue_items(task_id);
      CREATE INDEX idx_queue_items_status ON queue_items(status);
      CREATE INDEX idx_queue_items_priority ON queue_items(priority DESC);
      CREATE INDEX idx_queue_items_agent_id ON queue_items(agent_id);
      CREATE INDEX idx_queue_items_created_at ON queue_items(created_at);
      CREATE INDEX idx_queue_items_queue_status ON queue_items(queue_id, status);
      CREATE INDEX idx_queue_items_queue_priority ON queue_items(queue_id, status, priority DESC, position, created_at);
      CREATE INDEX idx_queue_items_timeout ON queue_items(timeout_at) WHERE timeout_at IS NOT NULL;
      CREATE INDEX idx_queue_items_retry ON queue_items(retry_count, max_retries) WHERE status = 'failed';
    `)

    // Step 4: Create dead letter queue table
    console.log('[Migration 018] Creating dead letter queue table...')
    db.exec(`
      CREATE TABLE queue_dead_letter (
        id INTEGER PRIMARY KEY,
        original_queue_id INTEGER NOT NULL,
        original_item_id INTEGER NOT NULL,
        ticket_id INTEGER,
        task_id INTEGER,
        final_status TEXT NOT NULL,
        error_message TEXT,
        retry_count INTEGER NOT NULL,
        agent_id TEXT,
        moved_at INTEGER NOT NULL,
        original_created_at INTEGER NOT NULL,
        FOREIGN KEY (original_queue_id) REFERENCES task_queues(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES ticket_tasks(id) ON DELETE CASCADE
      );
      
      CREATE INDEX idx_dead_letter_queue_id ON queue_dead_letter(original_queue_id);
      CREATE INDEX idx_dead_letter_moved_at ON queue_dead_letter(moved_at);
    `)

    // Step 5: Create queue history table for analytics
    console.log('[Migration 018] Creating queue history table...')
    db.exec(`
      CREATE TABLE queue_history (
        id INTEGER PRIMARY KEY,
        queue_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        ticket_id INTEGER,
        task_id INTEGER,
        status TEXT NOT NULL,
        processing_time INTEGER,
        agent_id TEXT,
        completed_at INTEGER NOT NULL,
        FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE
      );
      
      CREATE INDEX idx_queue_history_queue_id ON queue_history(queue_id);
      CREATE INDEX idx_queue_history_completed_at ON queue_history(completed_at);
      CREATE INDEX idx_queue_history_agent ON queue_history(agent_id);
    `)

    // Step 6: Update queue indexes on task_queues
    console.log('[Migration 018] Updating task_queues indexes...')
    db.exec(`
      CREATE INDEX idx_task_queues_project_id ON task_queues(project_id);
      CREATE INDEX idx_task_queues_status ON task_queues(status);
      CREATE INDEX idx_task_queues_created_at ON task_queues(created_at);
    `)

    console.log('[Migration 018] Queue improvements migration completed successfully')
  },

  down: (db: Database) => {
    console.log('[Migration 018] Rolling back queue improvements...')

    // Restore original queue_items structure
    db.exec(`
      CREATE TABLE queue_items_original AS 
      SELECT id, queue_id, ticket_id, task_id, status, priority, position,
             agent_id, error_message, started_at, completed_at, created_at, updated_at
      FROM queue_items;
      
      DROP TABLE queue_items;
      
      CREATE TABLE queue_items (
        id INTEGER PRIMARY KEY,
        queue_id INTEGER NOT NULL,
        ticket_id INTEGER,
        task_id INTEGER,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
        priority INTEGER NOT NULL DEFAULT 0,
        position INTEGER,
        agent_id TEXT,
        error_message TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES ticket_tasks(id) ON DELETE CASCADE,
        CHECK ((ticket_id IS NOT NULL AND task_id IS NULL) OR (ticket_id IS NULL AND task_id IS NOT NULL))
      );
      
      INSERT INTO queue_items 
      SELECT * FROM queue_items_original;
      
      DROP TABLE queue_items_original;
    `)

    // Restore original task_queues structure
    db.exec(`
      CREATE TABLE task_queues_original AS 
      SELECT id, project_id, name, description, 
             CASE WHEN status = 'paused' THEN 'inactive' ELSE status END as status,
             max_parallel_items, average_processing_time, total_completed_items,
             created_at, updated_at
      FROM task_queues;
      
      DROP TABLE task_queues;
      
      CREATE TABLE task_queues (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        max_parallel_items INTEGER NOT NULL DEFAULT 1,
        average_processing_time INTEGER,
        total_completed_items INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, name)
      );
      
      INSERT INTO task_queues 
      SELECT * FROM task_queues_original;
      
      DROP TABLE task_queues_original;
    `)

    // Drop new tables
    db.exec(`
      DROP TABLE IF EXISTS queue_dead_letter;
      DROP TABLE IF EXISTS queue_history;
    `)

    // Recreate original indexes
    db.exec(`
      CREATE INDEX idx_queue_items_queue_id ON queue_items(queue_id);
      CREATE INDEX idx_queue_items_ticket_id ON queue_items(ticket_id);
      CREATE INDEX idx_queue_items_task_id ON queue_items(task_id);
      CREATE INDEX idx_queue_items_status ON queue_items(status);
      CREATE INDEX idx_queue_items_priority ON queue_items(priority DESC);
      CREATE INDEX idx_queue_items_agent_id ON queue_items(agent_id);
      CREATE INDEX idx_queue_items_created_at ON queue_items(created_at);
      CREATE INDEX idx_queue_items_queue_status ON queue_items(queue_id, status);
      CREATE INDEX idx_queue_items_queue_priority ON queue_items(queue_id, status, priority DESC, created_at);
      
      CREATE INDEX idx_task_queues_project_id ON task_queues(project_id);
      CREATE INDEX idx_task_queues_created_at ON task_queues(created_at);
    `)

    console.log('[Migration 018] Rollback completed')
  }
}
