import type { Database } from 'bun:sqlite'

/**
 * Migration to fix queue item priority ordering.
 *
 * Changes priority ordering from DESC to ASC so that lower numbers = higher priority.
 * This aligns with standard priority queue conventions where priority 1 is processed
 * before priority 10.
 */
export const fixPriorityOrderingMigration = {
  version: 22,
  description: 'Fix queue item priority ordering to use ASC (lower number = higher priority)',

  up: (db: Database) => {
    console.log('[Migration 022] Fixing queue item priority ordering...')

    try {
      // Drop the existing priority index that uses DESC ordering
      console.log('[Migration 022] Dropping old priority index...')
      db.exec(`DROP INDEX IF EXISTS idx_queue_items_priority`)

      // Create new index with ASC ordering for correct priority handling
      console.log('[Migration 022] Creating new priority index with ASC ordering...')
      db.exec(`CREATE INDEX idx_queue_items_priority ON queue_items(priority ASC)`)

      // Also update the composite index used for queue item retrieval
      console.log('[Migration 022] Updating composite retrieval index...')
      db.exec(`DROP INDEX IF EXISTS idx_queue_items_retrieval`)
      db.exec(`
        CREATE INDEX idx_queue_items_retrieval 
        ON queue_items(queue_id, status, position, priority ASC, created_at)
      `)

      console.log('[Migration 022] Priority ordering fixed successfully')
      console.log('[Migration 022] Queue items will now process with priority 1 before priority 10')
    } catch (error) {
      console.error('[Migration 022] Error fixing priority ordering:', error)
      throw error
    }
  },

  down: (db: Database) => {
    console.log('[Migration 022] Reverting priority ordering fix...')

    try {
      // Restore the old DESC ordering (not recommended)
      db.exec(`DROP INDEX IF EXISTS idx_queue_items_priority`)
      db.exec(`CREATE INDEX idx_queue_items_priority ON queue_items(priority DESC)`)

      // Restore the old composite index
      db.exec(`DROP INDEX IF EXISTS idx_queue_items_retrieval`)
      db.exec(`
        CREATE INDEX idx_queue_items_retrieval 
        ON queue_items(queue_id, status, position, priority DESC, created_at)
      `)

      console.log('[Migration 022] Reverted to DESC priority ordering')
    } catch (error) {
      console.error('[Migration 022] Error reverting priority ordering:', error)
      throw error
    }
  }
}
