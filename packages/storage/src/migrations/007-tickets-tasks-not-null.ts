import type { Database } from 'bun:sqlite'

/**
 * Migration to add NOT NULL constraints to JSON array fields in tickets and ticket_tasks tables
 * This ensures data integrity by preventing null values in fields that should always have at least an empty array
 */
export const ticketsTasksNotNullMigration = {
  version: 7,
  description: 'Add NOT NULL constraints to JSON array fields in tickets and ticket_tasks tables',

  up: (db: Database) => {
    console.log('[Migration] Adding NOT NULL constraints to tickets and tasks JSON fields...')

    // SQLite doesn't support ALTER COLUMN directly, so we need to recreate tables
    // This is safe since we're in beta and already did a clean break in migration 006

    // Create new tables with NOT NULL constraints
    db.exec(`
      CREATE TABLE tickets_temp (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        overview TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
        suggested_file_ids TEXT NOT NULL DEFAULT '[]',
        suggested_agent_ids TEXT NOT NULL DEFAULT '[]',
        suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE TABLE ticket_tasks_temp (
        id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        description TEXT DEFAULT '',
        suggested_file_ids TEXT NOT NULL DEFAULT '[]',
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
        order_index INTEGER NOT NULL DEFAULT 0,
        estimated_hours REAL,
        dependencies TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        agent_id INTEGER,
        suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets_temp(id) ON DELETE CASCADE
      )
    `)

    // Copy existing data, ensuring JSON fields are never null
    db.exec(`
      INSERT INTO tickets_temp 
      SELECT 
        id, project_id, title, overview, status, priority,
        COALESCE(suggested_file_ids, '[]'),
        COALESCE(suggested_agent_ids, '[]'),
        COALESCE(suggested_prompt_ids, '[]'),
        created_at, updated_at
      FROM tickets
    `)

    db.exec(`
      INSERT INTO ticket_tasks_temp 
      SELECT 
        id, ticket_id, content, description,
        COALESCE(suggested_file_ids, '[]'),
        done, order_index, estimated_hours,
        COALESCE(dependencies, '[]'),
        COALESCE(tags, '[]'),
        agent_id,
        COALESCE(suggested_prompt_ids, '[]'),
        created_at, updated_at
      FROM ticket_tasks
    `)

    // Drop old tables
    db.exec(`DROP TABLE ticket_tasks`)
    db.exec(`DROP TABLE tickets`)

    // Rename new tables
    db.exec(`ALTER TABLE tickets_temp RENAME TO tickets`)
    db.exec(`ALTER TABLE ticket_tasks_temp RENAME TO ticket_tasks`)

    // Recreate all indexes
    db.exec(`CREATE INDEX idx_tickets_project_id ON tickets(project_id)`)
    db.exec(`CREATE INDEX idx_tickets_status ON tickets(status)`)
    db.exec(`CREATE INDEX idx_tickets_priority ON tickets(priority)`)
    db.exec(`CREATE INDEX idx_tickets_created_at ON tickets(created_at)`)
    db.exec(`CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)`)
    db.exec(`CREATE INDEX idx_tickets_project_status ON tickets(project_id, status)`)

    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_done ON ticket_tasks(done)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_order_index ON ticket_tasks(order_index)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_created_at ON ticket_tasks(created_at)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_done ON ticket_tasks(ticket_id, done)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_order ON ticket_tasks(ticket_id, order_index)`)

    console.log('[Migration] NOT NULL constraints added successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting NOT NULL constraints...')

    // Create tables without NOT NULL on JSON fields
    db.exec(`
      CREATE TABLE tickets_temp (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        overview TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
        suggested_file_ids TEXT DEFAULT '[]',
        suggested_agent_ids TEXT DEFAULT '[]',
        suggested_prompt_ids TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE TABLE ticket_tasks_temp (
        id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        description TEXT DEFAULT '',
        suggested_file_ids TEXT DEFAULT '[]',
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
        order_index INTEGER NOT NULL DEFAULT 0,
        estimated_hours REAL,
        dependencies TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        agent_id INTEGER,
        suggested_prompt_ids TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets_temp(id) ON DELETE CASCADE
      )
    `)

    // Copy data back
    db.exec(`INSERT INTO tickets_temp SELECT * FROM tickets`)
    db.exec(`INSERT INTO ticket_tasks_temp SELECT * FROM ticket_tasks`)

    // Drop and rename
    db.exec(`DROP TABLE ticket_tasks`)
    db.exec(`DROP TABLE tickets`)
    db.exec(`ALTER TABLE tickets_temp RENAME TO tickets`)
    db.exec(`ALTER TABLE ticket_tasks_temp RENAME TO ticket_tasks`)

    // Recreate indexes
    db.exec(`CREATE INDEX idx_tickets_project_id ON tickets(project_id)`)
    db.exec(`CREATE INDEX idx_tickets_status ON tickets(status)`)
    db.exec(`CREATE INDEX idx_tickets_priority ON tickets(priority)`)
    db.exec(`CREATE INDEX idx_tickets_created_at ON tickets(created_at)`)
    db.exec(`CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)`)
    db.exec(`CREATE INDEX idx_tickets_project_status ON tickets(project_id, status)`)

    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_done ON ticket_tasks(done)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_order_index ON ticket_tasks(order_index)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_created_at ON ticket_tasks(created_at)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_done ON ticket_tasks(ticket_id, done)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_order ON ticket_tasks(ticket_id, order_index)`)

    console.log('[Migration] Reverted NOT NULL constraints')
  }
}