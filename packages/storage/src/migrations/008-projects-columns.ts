import type { Database } from 'bun:sqlite'

/**
 * Migration to convert projects from JSON storage to proper columns
 * 
 * ⚠️ WARNING: CLEAN BREAK MIGRATION - DATA LOSS ⚠️
 * This migration will DELETE ALL existing projects data!
 * It converts from JSON column storage to proper database columns.
 * There is NO data migration - all projects will be lost.
 * 
 * This is intentional for beta software. In production, you would
 * need to implement data migration from JSON to columns.
 */
export const projectsColumnsMigration = {
  version: 8,
  description: 'Convert projects from JSON storage to proper column-based table (DATA LOSS)',

  up: (db: Database) => {
    console.log('[Migration] Starting projects column migration...')

    // Create new projects table with proper columns
    db.exec(`
      CREATE TABLE projects_new (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        path TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop old JSON-based table
    db.exec(`DROP TABLE IF EXISTS projects`)

    // Rename new table to original name
    db.exec(`ALTER TABLE projects_new RENAME TO projects`)

    // Create indexes for projects table
    db.exec(`CREATE UNIQUE INDEX idx_projects_path ON projects(path)`)
    db.exec(`CREATE INDEX idx_projects_created_at ON projects(created_at)`)
    db.exec(`CREATE INDEX idx_projects_updated_at ON projects(updated_at)`)

    console.log('[Migration] Projects table converted to column-based storage successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting projects to JSON storage...')
    console.warn('[Migration] WARNING: This will DELETE all data in the projects table!')

    // Create old JSON-based table
    db.exec(`
      CREATE TABLE projects_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop column-based table
    db.exec(`DROP TABLE IF EXISTS projects`)

    // Rename old table back
    db.exec(`ALTER TABLE projects_old RENAME TO projects`)

    // Recreate old indexes
    db.exec(`CREATE INDEX idx_projects_created_at ON projects(created_at)`)
    db.exec(`CREATE INDEX idx_projects_updated_at ON projects(updated_at)`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}