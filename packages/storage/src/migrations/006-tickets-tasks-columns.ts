import type { Database } from 'bun:sqlite'

/**
 * Migration to convert tickets and ticket_tasks from JSON storage to proper columns
 * 
 * ⚠️ WARNING: CLEAN BREAK MIGRATION - DATA LOSS ⚠️
 * This migration will DELETE ALL existing tickets and tasks data!
 * It converts from JSON column storage to proper database columns.
 * There is NO data migration - all tickets and tasks will be lost.
 * 
 * This is intentional for beta software. In production, you would
 * need to implement data migration from JSON to columns.
 */
export const ticketsTasksColumnsMigration = {
  version: 6,
  description: 'Convert tickets and ticket_tasks from JSON storage to proper column-based tables (DATA LOSS)',

  up: (db: Database) => {
    console.log('[Migration] Starting tickets and tasks column migration...')

    // Create new tickets table with proper columns
    db.exec(`
      CREATE TABLE tickets_new (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        overview TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
        suggested_file_ids TEXT DEFAULT '[]', -- JSON array stored as text
        suggested_agent_ids TEXT DEFAULT '[]', -- JSON array stored as text
        suggested_prompt_ids TEXT DEFAULT '[]', -- JSON array stored as text
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Create new ticket_tasks table with proper columns
    db.exec(`
      CREATE TABLE ticket_tasks_new (
        id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        description TEXT DEFAULT '',
        suggested_file_ids TEXT DEFAULT '[]', -- JSON array stored as text
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
        order_index INTEGER NOT NULL DEFAULT 0,
        estimated_hours REAL,
        dependencies TEXT DEFAULT '[]', -- JSON array stored as text
        tags TEXT DEFAULT '[]', -- JSON array stored as text
        agent_id INTEGER,
        suggested_prompt_ids TEXT DEFAULT '[]', -- JSON array stored as text
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets_new(id) ON DELETE CASCADE
      )
    `)

    // Drop old JSON-based tables
    db.exec(`DROP TABLE IF EXISTS tickets`)
    db.exec(`DROP TABLE IF EXISTS ticket_tasks`)

    // Rename new tables to original names
    db.exec(`ALTER TABLE tickets_new RENAME TO tickets`)
    db.exec(`ALTER TABLE ticket_tasks_new RENAME TO ticket_tasks`)

    // Create indexes for tickets table
    db.exec(`CREATE INDEX idx_tickets_project_id ON tickets(project_id)`)
    db.exec(`CREATE INDEX idx_tickets_status ON tickets(status)`)
    db.exec(`CREATE INDEX idx_tickets_priority ON tickets(priority)`)
    db.exec(`CREATE INDEX idx_tickets_created_at ON tickets(created_at)`)
    db.exec(`CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)`)
    db.exec(`CREATE INDEX idx_tickets_project_status ON tickets(project_id, status)`)

    // Create indexes for ticket_tasks table
    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_done ON ticket_tasks(done)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_order_index ON ticket_tasks(order_index)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_created_at ON ticket_tasks(created_at)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_done ON ticket_tasks(ticket_id, done)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_ticket_order ON ticket_tasks(ticket_id, order_index)`)

    console.log('[Migration] Tickets and tasks tables converted to column-based storage successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting tickets and tasks to JSON storage...')

    // Create old JSON-based tables
    db.exec(`
      CREATE TABLE tickets_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE TABLE ticket_tasks_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop column-based tables
    db.exec(`DROP TABLE IF EXISTS ticket_tasks`) // Drop first due to foreign key
    db.exec(`DROP TABLE IF EXISTS tickets`)

    // Rename old tables back
    db.exec(`ALTER TABLE tickets_old RENAME TO tickets`)
    db.exec(`ALTER TABLE ticket_tasks_old RENAME TO ticket_tasks`)

    // Recreate old indexes
    db.exec(`CREATE INDEX idx_tickets_projectId ON tickets(JSON_EXTRACT(data, '$.projectId'))`)
    db.exec(`CREATE INDEX idx_tickets_created_at ON tickets(created_at)`)
    db.exec(`CREATE INDEX idx_tickets_status ON tickets(JSON_EXTRACT(data, '$.status'))`)
    db.exec(`CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)`)

    db.exec(`CREATE INDEX idx_ticket_tasks_ticketId ON ticket_tasks(JSON_EXTRACT(data, '$.ticketId'))`)
    db.exec(`CREATE INDEX idx_ticket_tasks_orderIndex ON ticket_tasks(JSON_EXTRACT(data, '$.orderIndex'))`)
    db.exec(`CREATE INDEX idx_ticket_tasks_created_at ON ticket_tasks(created_at)`)
    db.exec(`CREATE INDEX idx_ticket_tasks_done ON ticket_tasks(JSON_EXTRACT(data, '$.done'))`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}
