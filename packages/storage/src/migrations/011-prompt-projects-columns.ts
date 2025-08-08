import type { Database } from 'bun:sqlite'

/**
 * Migration to convert prompt_projects from JSON storage to proper columns
 * 
 * ⚠️ WARNING: CLEAN BREAK MIGRATION - DATA LOSS ⚠️
 * This migration will DELETE ALL existing prompt-project associations!
 * It converts from JSON column storage to proper database columns.
 * There is NO data migration - all associations will be lost.
 * 
 * This is intentional for beta software. In production, you would
 * need to implement data migration from JSON to columns.
 */
export const promptProjectsColumnsMigration = {
  version: 11,
  description: 'Convert prompt_projects from JSON storage to proper column-based table (DATA LOSS)',

  up: (db: Database) => {
    console.log('[Migration] Starting prompt_projects column migration...')

    // Create new prompt_projects table with proper columns
    db.exec(`
      CREATE TABLE prompt_projects_new (
        id INTEGER PRIMARY KEY,
        prompt_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE (prompt_id, project_id)
      )
    `)

    // Drop old JSON-based table
    db.exec(`DROP TABLE IF EXISTS prompt_projects`)

    // Rename new table to original name
    db.exec(`ALTER TABLE prompt_projects_new RENAME TO prompt_projects`)

    // Create indexes for prompt_projects table
    db.exec(`CREATE INDEX idx_prompt_projects_prompt_id ON prompt_projects(prompt_id)`)
    db.exec(`CREATE INDEX idx_prompt_projects_project_id ON prompt_projects(project_id)`)

    console.log('[Migration] Prompt projects table converted to column-based storage successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting prompt_projects to JSON storage...')

    // Create old JSON-based table
    db.exec(`
      CREATE TABLE prompt_projects_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop column-based table
    db.exec(`DROP TABLE IF EXISTS prompt_projects`)

    // Rename old table back
    db.exec(`ALTER TABLE prompt_projects_old RENAME TO prompt_projects`)

    // Recreate old indexes
    db.exec(`CREATE INDEX idx_prompt_projects_promptId ON prompt_projects(JSON_EXTRACT(data, '$.promptId'))`)
    db.exec(`CREATE INDEX idx_prompt_projects_projectId ON prompt_projects(JSON_EXTRACT(data, '$.projectId'))`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}