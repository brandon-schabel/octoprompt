import type { Database } from 'bun:sqlite'

/**
 * Migration to convert chats and chat_messages from JSON storage to proper columns
 * 
 * ⚠️ WARNING: CLEAN BREAK MIGRATION - DATA LOSS ⚠️
 * This migration will DELETE ALL existing chats and messages data!
 * It converts from JSON column storage to proper database columns.
 * There is NO data migration - all chats and messages will be lost.
 * 
 * This is intentional for beta software. In production, you would
 * need to implement data migration from JSON to columns.
 */
export const chatTablesColumnsMigration = {
  version: 14,
  description: 'Convert chats and chat_messages from JSON storage to column-based tables (DATA LOSS)',

  up: (db: Database) => {
    console.log('[Migration] Starting chats and chat_messages column migration...')

    // Create new chats table with proper columns
    db.exec(`
      CREATE TABLE chats_new (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        project_id INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    // Create new chat_messages table with proper columns
    db.exec(`
      CREATE TABLE chat_messages_new (
        id INTEGER PRIMARY KEY,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        type TEXT,
        attachments TEXT NOT NULL DEFAULT '[]', -- JSON array stored as text
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats_new(id) ON DELETE CASCADE
      )
    `)

    // Drop old JSON-based tables
    db.exec(`DROP TABLE IF EXISTS chat_messages`) // Drop first due to potential foreign key
    db.exec(`DROP TABLE IF EXISTS chats`)

    // Rename new tables to original names
    db.exec(`ALTER TABLE chats_new RENAME TO chats`)
    db.exec(`ALTER TABLE chat_messages_new RENAME TO chat_messages`)

    // Create indexes for chats table
    db.exec(`CREATE INDEX idx_chats_project_id ON chats(project_id)`)
    db.exec(`CREATE INDEX idx_chats_created_at ON chats(created_at)`)
    db.exec(`CREATE INDEX idx_chats_updated_at ON chats(updated_at)`)

    // Create indexes for chat_messages table
    db.exec(`CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id)`)
    db.exec(`CREATE INDEX idx_chat_messages_role ON chat_messages(role)`)
    db.exec(`CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at)`)
    // Composite index for common query pattern
    db.exec(`CREATE INDEX idx_chat_messages_chat_id_created_at ON chat_messages(chat_id, created_at)`)

    console.log('[Migration] Chats and chat_messages tables converted to column-based storage successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting chats and chat_messages to JSON storage...')
    console.warn('[Migration] WARNING: This will DELETE all data in the chats and chat_messages tables!')

    // Create old JSON-based tables
    db.exec(`
      CREATE TABLE chats_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE TABLE chat_messages_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop column-based tables
    db.exec(`DROP TABLE IF EXISTS chat_messages`) // Drop first due to foreign key
    db.exec(`DROP TABLE IF EXISTS chats`)

    // Rename old tables back
    db.exec(`ALTER TABLE chats_old RENAME TO chats`)
    db.exec(`ALTER TABLE chat_messages_old RENAME TO chat_messages`)

    // Recreate old indexes
    db.exec(`CREATE INDEX idx_chats_created_at ON chats(created_at)`)
    db.exec(`CREATE INDEX idx_chats_updated_at ON chats(updated_at)`)
    
    db.exec(`CREATE INDEX idx_chat_messages_chatId ON chat_messages(JSON_EXTRACT(data, '$.chatId'))`)
    db.exec(`CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at)`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}