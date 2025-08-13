import type { Database } from 'bun:sqlite'

export const queueActualProcessingTimeMigration = {
  version: 19,
  description: 'Add actual_processing_time column to queue_items table',

  up: (db: Database) => {
    console.log('[Migration 019] Starting queue actual processing time migration...')

    // Check if the column already exists
    const queueItemsColumns = db.prepare("PRAGMA table_info('queue_items')").all() as any[]
    const hasActualProcessingTime = queueItemsColumns.some((col: any) => col.name === 'actual_processing_time')

    if (!hasActualProcessingTime) {
      // Step 1: Add actual_processing_time column to queue_items
      console.log('[Migration 019] Adding actual_processing_time column to queue_items...')
      db.exec(`
        ALTER TABLE queue_items 
        ADD COLUMN actual_processing_time INTEGER
      `)
    } else {
      console.log('[Migration 019] actual_processing_time column already exists in queue_items, skipping...')
    }

    // Check if queue_history table exists before trying to alter it
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='queue_history'").all()
    if (tables.length > 0) {
      const queueHistoryColumns = db.prepare("PRAGMA table_info('queue_history')").all() as any[]
      const historyHasActualProcessingTime = queueHistoryColumns.some(
        (col: any) => col.name === 'actual_processing_time'
      )

      if (!historyHasActualProcessingTime) {
        // Step 2: Add actual_processing_time to queue_history table for consistency
        console.log('[Migration 019] Adding actual_processing_time column to queue_history...')
        db.exec(`
          ALTER TABLE queue_history 
          ADD COLUMN actual_processing_time INTEGER
        `)
      } else {
        console.log('[Migration 019] actual_processing_time column already exists in queue_history, skipping...')
      }

      // Step 3: Calculate actual_processing_time for completed items
      console.log('[Migration 019] Calculating actual processing time for completed items...')
      db.exec(`
        UPDATE queue_items 
        SET actual_processing_time = completed_at - started_at
        WHERE status = 'completed' 
          AND started_at IS NOT NULL 
          AND completed_at IS NOT NULL
          AND actual_processing_time IS NULL
      `)
    }

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
    // 2. Copy data from the old table
    // 3. Drop the old table
    // 4. Rename the new table

    console.log('[Migration 019] Rollback completed')
  }
}
