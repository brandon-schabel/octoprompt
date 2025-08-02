import type { Database } from 'bun:sqlite'

/**
 * Migration to convert prompts from JSON storage to proper columns
 * 
 * ⚠️ WARNING: CLEAN BREAK MIGRATION - DATA LOSS ⚠️
 * This migration will DELETE ALL existing prompts data!
 * It converts from JSON column storage to proper database columns.
 * There is NO data migration - all prompts will be lost.
 * 
 * This is intentional for beta software. In production, you would
 * need to implement data migration from JSON to columns.
 */
export const promptsColumnsMigration = {
  version: 10,
  description: 'Convert prompts from JSON storage to proper column-based table (DATA LOSS)',

  up: (db: Database) => {
    console.log('[Migration] Starting prompts column migration...')

    // Create new prompts table with proper columns
    db.exec(`
      CREATE TABLE prompts_new (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        project_id INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    // Drop old JSON-based table
    db.exec(`DROP TABLE IF EXISTS prompts`)

    // Rename new table to original name
    db.exec(`ALTER TABLE prompts_new RENAME TO prompts`)

    // Create indexes for prompts table
    db.exec(`CREATE INDEX idx_prompts_project_id ON prompts(project_id)`)
    db.exec(`CREATE INDEX idx_prompts_created_at ON prompts(created_at)`)
    db.exec(`CREATE INDEX idx_prompts_updated_at ON prompts(updated_at)`)
    // Additional index for search functionality
    db.exec(`CREATE INDEX idx_prompts_name ON prompts(name)`)

    console.log('[Migration] Prompts table converted to column-based storage successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting prompts to JSON storage...')

    // Create old JSON-based table
    db.exec(`
      CREATE TABLE prompts_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop column-based table
    db.exec(`DROP TABLE IF EXISTS prompts`)

    // Rename old table back
    db.exec(`ALTER TABLE prompts_old RENAME TO prompts`)

    // Recreate old indexes
    db.exec(`CREATE INDEX idx_prompts_created_at ON prompts(created_at)`)
    db.exec(`CREATE INDEX idx_prompts_updated_at ON prompts(updated_at)`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}