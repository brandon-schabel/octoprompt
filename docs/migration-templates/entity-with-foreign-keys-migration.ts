// Template for migrating entities with foreign key relationships
import type { Database } from 'bun:sqlite'

/**
 * Migration template for entities with foreign keys
 * Replace:
 * - ENTITY_NAME with your entity name (e.g., "project_files")
 * - PARENT_ENTITY with the parent entity name (e.g., "projects")
 * - VERSION with the next migration version number
 */
export const ENTITY_NAMEColumnsMigration = {
  version: VERSION,
  description: 'Convert ENTITY_NAME from JSON storage to column-based table with foreign keys',

  up: (db: Database) => {
    console.log('[Migration] Starting ENTITY_NAME column migration...')

    // Create new table with proper columns and foreign keys
    db.exec(`
      CREATE TABLE ENTITY_NAME_new (
        id INTEGER PRIMARY KEY,
        -- Foreign key column
        PARENT_ENTITY_id INTEGER NOT NULL,
        -- Other columns
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        -- For enum fields, use CHECK constraints
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
        -- JSON fields for flexible data
        metadata TEXT NOT NULL DEFAULT '{}',
        -- Timestamps
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        -- Foreign key constraint with cascade behavior
        FOREIGN KEY (PARENT_ENTITY_id) REFERENCES PARENT_ENTITY(id) ON DELETE CASCADE
      )
    `)

    // Optional: Migrate existing data with validation
    /*
    db.exec(`
      INSERT INTO ENTITY_NAME_new 
      SELECT 
        CAST(e.id AS INTEGER),
        CAST(JSON_EXTRACT(e.data, '$.PARENT_ENTITYId') AS INTEGER),
        JSON_EXTRACT(e.data, '$.name'),
        COALESCE(JSON_EXTRACT(e.data, '$.description'), ''),
        COALESCE(JSON_EXTRACT(e.data, '$.status'), 'active'),
        COALESCE(JSON_EXTRACT(e.data, '$.metadata'), '{}'),
        e.created_at,
        e.updated_at
      FROM ENTITY_NAME e
      -- Only migrate records with valid parent references
      WHERE EXISTS (
        SELECT 1 FROM PARENT_ENTITY p 
        WHERE p.id = CAST(JSON_EXTRACT(e.data, '$.PARENT_ENTITYId') AS INTEGER)
      )
    `)
    */

    // Drop old table
    db.exec(`DROP TABLE IF EXISTS ENTITY_NAME`)

    // Rename new table
    db.exec(`ALTER TABLE ENTITY_NAME_new RENAME TO ENTITY_NAME`)

    // Create indexes
    // IMPORTANT: Always index foreign key columns
    db.exec(`CREATE INDEX idx_ENTITY_NAME_PARENT_ENTITY_id ON ENTITY_NAME(PARENT_ENTITY_id)`)
    db.exec(`CREATE INDEX idx_ENTITY_NAME_status ON ENTITY_NAME(status)`)
    db.exec(`CREATE INDEX idx_ENTITY_NAME_created_at ON ENTITY_NAME(created_at)`)
    // Composite index for common query patterns
    db.exec(`CREATE INDEX idx_ENTITY_NAME_PARENT_ENTITY_status ON ENTITY_NAME(PARENT_ENTITY_id, status)`)

    console.log('[Migration] ENTITY_NAME table converted successfully with foreign keys')
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

    // Optional: Migrate data back
    /*
    db.exec(`
      INSERT INTO ENTITY_NAME_old 
      SELECT 
        CAST(id AS TEXT),
        JSON_OBJECT(
          'id', id,
          'PARENT_ENTITYId', PARENT_ENTITY_id,
          'name', name,
          'description', description,
          'status', status,
          'metadata', JSON(metadata),
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

    // Recreate old JSON-based indexes
    db.exec(`CREATE INDEX idx_ENTITY_NAME_PARENT_ENTITYId ON ENTITY_NAME(JSON_EXTRACT(data, '$.PARENT_ENTITYId'))`)
    db.exec(`CREATE INDEX idx_ENTITY_NAME_created_at ON ENTITY_NAME(created_at)`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}
