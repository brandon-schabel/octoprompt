import type { Database } from 'better-sqlite3'

export const queueActualProcessingTimeMigration = {
  version: 19,
  description: 'Add actual_processing_time column to queue_items table',

  up: (db: Database) => {
    console.log('[Migration 019] Starting queue actual processing time migration...')

    // Step 1: Add actual_processing_time column to queue_items
    console.log('[Migration 019] Adding actual_processing_time column to queue_items...')
    db.exec(`
      ALTER TABLE queue_items 
      ADD COLUMN actual_processing_time INTEGER
    `)

    // Step 2: Add actual_processing_time to queue_history table for consistency
    console.log('[Migration 019] Adding actual_processing_time column to queue_history...')
    db.exec(`
      ALTER TABLE queue_history 
      ADD COLUMN actual_processing_time INTEGER
    `)

    // Step 3: Calculate actual_processing_time for completed items
    console.log('[Migration 019] Calculating actual processing time for completed items...')
    db.exec(`
      UPDATE queue_items 
      SET actual_processing_time = completed_at - started_at
      WHERE status = 'completed' 
        AND started_at IS NOT NULL 
        AND completed_at IS NOT NULL
    `)

    console.log('[Migration 019] Queue actual processing time migration completed successfully')
  },

  down: (db: Database) => {
    console.log('[Migration 019] Rolling back queue actual processing time migration...')
    console.warn(
      '[Migration 019] WARNING: SQLite does not support DROP COLUMN. ' +
        'The actual_processing_time column will remain in the table but will be ignored by the application. ' +
        'This is a safe operation that preserves all data and foreign key constraints.'
    )

    // Note: In SQLite, we cannot drop columns directly. The safest approach for a rollback
    // is to leave the column in place and handle it at the application layer.
    //
    // Alternative approach (not recommended for production):
    // If you absolutely need to remove the column, you would need to:
    // 1. Create a new table without the column
    // 2. Copy all data except the column
    // 3. Drop the old table
    // 4. Rename the new table
    // 5. Recreate all indexes and foreign keys
    //
    // This approach risks data loss and constraint violations, so we opt for the safer
    // approach of leaving the column in place.

    // Mark in a migration metadata table that this column should be ignored
    // This is a safer approach than trying to recreate tables
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS migration_metadata (
          id INTEGER PRIMARY KEY,
          table_name TEXT NOT NULL,
          column_name TEXT NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL,
          UNIQUE(table_name, column_name)
        )
      `)

      const now = Date.now()
      db.prepare(
        `
        INSERT OR REPLACE INTO migration_metadata (table_name, column_name, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(
        'queue_items',
        'actual_processing_time',
        'deprecated',
        'Column added in migration 019, marked as deprecated during rollback. Safe to ignore.',
        now
      )

      db.prepare(
        `
        INSERT OR REPLACE INTO migration_metadata (table_name, column_name, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(
        'queue_history',
        'actual_processing_time',
        'deprecated',
        'Column added in migration 019, marked as deprecated during rollback. Safe to ignore.',
        now
      )
    } catch (error) {
      console.warn('[Migration 019] Could not create migration metadata table:', error)
    }

    console.log(
      '[Migration 019] Rollback completed safely. Columns remain but are marked as deprecated. ' +
        'Application code should ignore these columns.'
    )
  }
}
