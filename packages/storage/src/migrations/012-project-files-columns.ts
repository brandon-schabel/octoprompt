import type { Database } from 'bun:sqlite'

/**
 * Migration to convert project_files from JSON storage to proper columns
 * 
 * ⚠️ WARNING: CLEAN BREAK MIGRATION - DATA LOSS ⚠️
 * This migration will DELETE ALL existing project files data!
 * It converts from JSON column storage to proper database columns.
 * There is NO data migration - all project files will be lost.
 * 
 * This is intentional for beta software. In production, you would
 * need to implement data migration from JSON to columns.
 */
export const projectFilesColumnsMigration = {
  version: 12,
  description: 'Convert project_files from JSON storage to proper column-based table (DATA LOSS)',

  up: (db: Database) => {
    console.log('[Migration] Starting project_files column migration...')

    // Create new project_files table with proper columns
    db.exec(`
      CREATE TABLE project_files_new (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        extension TEXT NOT NULL,
        size INTEGER NOT NULL,
        content TEXT,
        summary TEXT,
        summary_last_updated INTEGER,
        meta TEXT,
        checksum TEXT,
        imports TEXT NOT NULL DEFAULT '[]',
        exports TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE (project_id, path)
      )
    `)

    // Drop old JSON-based table
    db.exec(`DROP TABLE IF EXISTS project_files`)

    // Rename new table to original name
    db.exec(`ALTER TABLE project_files_new RENAME TO project_files`)

    // Create indexes for project_files table
    db.exec(`CREATE INDEX idx_project_files_project_id ON project_files(project_id)`)
    db.exec(`CREATE INDEX idx_project_files_path ON project_files(path)`)
    db.exec(`CREATE INDEX idx_project_files_extension ON project_files(extension)`)
    db.exec(`CREATE INDEX idx_project_files_created_at ON project_files(created_at)`)
    db.exec(`CREATE INDEX idx_project_files_updated_at ON project_files(updated_at)`)
    // Composite indexes for common query patterns
    db.exec(`CREATE INDEX idx_project_files_project_path ON project_files(project_id, path)`)
    db.exec(`CREATE INDEX idx_project_files_project_extension ON project_files(project_id, extension)`)
    // Additional indexes for specific use cases
    db.exec(`CREATE INDEX idx_project_files_checksum ON project_files(checksum)`)
    db.exec(`CREATE INDEX idx_project_files_summary_updated ON project_files(summary_last_updated)`)

    console.log('[Migration] Project files table converted to column-based storage successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting project_files to JSON storage...')

    // Create old JSON-based table
    db.exec(`
      CREATE TABLE project_files_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop column-based table
    db.exec(`DROP TABLE IF EXISTS project_files`)

    // Rename old table back
    db.exec(`ALTER TABLE project_files_old RENAME TO project_files`)

    // Recreate old indexes
    db.exec(`CREATE INDEX idx_project_files_projectId ON project_files(JSON_EXTRACT(data, '$.projectId'))`)
    db.exec(`CREATE INDEX idx_project_files_created_at ON project_files(created_at)`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}