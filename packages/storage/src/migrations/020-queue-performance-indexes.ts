import type { Database } from 'better-sqlite3'

export const queuePerformanceIndexesMigration = {
  version: 20,
  description: 'Add optimized composite indexes for queue item queries',

  up: (db: Database) => {
    console.log('[Migration 020] Starting queue performance indexes migration...')

    // Drop existing indexes that will be replaced by composite ones
    console.log('[Migration 020] Dropping redundant indexes...')
    db.exec(`
      DROP INDEX IF EXISTS idx_queue_items_queue_priority;
      DROP INDEX IF EXISTS idx_queue_items_queue_status;
    `)

    // Create optimized composite index for getNextQueueItem query
    // This matches the exact ORDER BY clause: position ASC, priority DESC, created_at ASC
    console.log('[Migration 020] Creating composite index for queue item retrieval...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_items_retrieval 
      ON queue_items(queue_id, status, position ASC, priority DESC, created_at ASC)
      WHERE status = 'queued';
    `)

    // Create index for in-progress items (used in getQueueStats and getCurrentAgents)
    console.log('[Migration 020] Creating index for in-progress tracking...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_items_in_progress 
      ON queue_items(queue_id, status, agent_id)
      WHERE status = 'in_progress';
    `)

    // Create index for completed items (used in statistics calculations)
    console.log('[Migration 020] Creating index for completed items statistics...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_items_completed 
      ON queue_items(queue_id, status, actual_processing_time)
      WHERE status = 'completed' AND actual_processing_time IS NOT NULL;
    `)

    // Create index for timeout monitoring
    console.log('[Migration 020] Creating index for timeout monitoring...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_items_timeout_monitoring 
      ON queue_items(timeout_at, status)
      WHERE timeout_at IS NOT NULL AND status = 'in_progress';
    `)

    // Create index for stuck items detection (items in progress for too long)
    console.log('[Migration 020] Creating index for stuck items detection...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_items_stuck_detection 
      ON queue_items(status, started_at)
      WHERE status = 'in_progress' AND started_at IS NOT NULL;
    `)

    // Create index for orphaned items cleanup
    console.log('[Migration 020] Creating index for orphaned items cleanup...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_items_cleanup 
      ON queue_items(created_at, status)
      WHERE status IN ('completed', 'failed', 'cancelled', 'timeout');
    `)

    // Optimize queue_history table indexes
    console.log('[Migration 020] Optimizing queue_history indexes...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_history_stats 
      ON queue_history(queue_id, completed_at, processing_time)
      WHERE processing_time IS NOT NULL;
    `)

    // Analyze tables to update query planner statistics
    console.log('[Migration 020] Analyzing tables for query optimization...')
    db.exec(`
      ANALYZE queue_items;
      ANALYZE task_queues;
      ANALYZE queue_history;
    `)

    console.log('[Migration 020] Queue performance indexes migration completed successfully')
  },

  down: (db: Database) => {
    console.log('[Migration 020] Rolling back queue performance indexes...')

    // Remove the new composite indexes
    db.exec(`
      DROP INDEX IF EXISTS idx_queue_items_retrieval;
      DROP INDEX IF EXISTS idx_queue_items_in_progress;
      DROP INDEX IF EXISTS idx_queue_items_completed;
      DROP INDEX IF EXISTS idx_queue_items_timeout_monitoring;
      DROP INDEX IF EXISTS idx_queue_items_stuck_detection;
      DROP INDEX IF EXISTS idx_queue_items_cleanup;
      DROP INDEX IF EXISTS idx_queue_history_stats;
    `)

    // Restore original simpler indexes from migration 018
    console.log('[Migration 020] Restoring original indexes...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_items_queue_status 
      ON queue_items(queue_id, status);
      
      CREATE INDEX IF NOT EXISTS idx_queue_items_queue_priority 
      ON queue_items(queue_id, status, priority DESC, position, created_at);
    `)

    console.log('[Migration 020] Rollback completed')
  }
}
