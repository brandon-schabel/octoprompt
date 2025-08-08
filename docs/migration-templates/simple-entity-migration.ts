// Template for migrating a simple entity with no foreign keys
import type { Database } from 'bun:sqlite'

/**
 * Migration template for simple entities
 * Replace:
 * - ENTITY_NAME with your entity name (e.g., "agents")
 * - VERSION with the next migration version number
 * - Add your specific columns based on the entity structure
 */
export const ENTITY_NAMEColumnsMigration = {
  version: VERSION,
  description: 'Convert ENTITY_NAME from JSON storage to column-based table',

  up: (db: Database) => {
    console.log('[Migration] Starting ENTITY_NAME column migration...')

    // Create new table with proper columns
    db.exec(`
      CREATE TABLE ENTITY_NAME_new (
        id INTEGER PRIMARY KEY,
        -- Add your columns here
        -- Example columns:
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        -- For JSON arrays, use TEXT with NOT NULL DEFAULT '[]'
        tags TEXT NOT NULL DEFAULT '[]',
        -- For JSON objects, use TEXT with NOT NULL DEFAULT '{}'
        settings TEXT NOT NULL DEFAULT '{}',
        -- Always include timestamps
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Optional: Migrate existing data (for production)
    // Remove this section for clean break migrations
    /*
    db.exec(`
      INSERT INTO ENTITY_NAME_new 
      SELECT 
        CAST(id AS INTEGER),
        JSON_EXTRACT(data, '$.name'),
        COALESCE(JSON_EXTRACT(data, '$.description'), ''),
        COALESCE(JSON_EXTRACT(data, '$.tags'), '[]'),
        COALESCE(JSON_EXTRACT(data, '$.settings'), '{}'),
        created_at,
        updated_at
      FROM ENTITY_NAME
    `)
    */

    // Drop old table
    db.exec(`DROP TABLE IF EXISTS ENTITY_NAME`)

    // Rename new table
    db.exec(`ALTER TABLE ENTITY_NAME_new RENAME TO ENTITY_NAME`)

    // Create indexes for commonly queried fields
    db.exec(`CREATE INDEX idx_ENTITY_NAME_name ON ENTITY_NAME(name)`)
    db.exec(`CREATE INDEX idx_ENTITY_NAME_created_at ON ENTITY_NAME(created_at)`)
    db.exec(`CREATE INDEX idx_ENTITY_NAME_updated_at ON ENTITY_NAME(updated_at)`)

    console.log('[Migration] ENTITY_NAME table converted to column-based storage successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting ENTITY_NAME to JSON storage...')

    // Create old JSON-based table
    db.exec(`
      CREATE TABLE ENTITY_NAME_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Optional: Migrate data back (for production)
    /*
    db.exec(`
      INSERT INTO ENTITY_NAME_old 
      SELECT 
        CAST(id AS TEXT),
        JSON_OBJECT(
          'id', id,
          'name', name,
          'description', description,
          'tags', JSON(tags),
          'settings', JSON(settings),
          'created', created_at,
          'updated', updated_at
        ),
        created_at,
        updated_at
      FROM ENTITY_NAME
    `)
    */

    // Drop column-based table
    db.exec(`DROP TABLE IF EXISTS ENTITY_NAME`)

    // Rename old table back
    db.exec(`ALTER TABLE ENTITY_NAME_old RENAME TO ENTITY_NAME`)

    // Recreate old indexes
    db.exec(`CREATE INDEX idx_ENTITY_NAME_created_at ON ENTITY_NAME(created_at)`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}