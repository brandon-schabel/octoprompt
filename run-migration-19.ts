import { DatabaseManager } from './packages/storage/src/database-manager'
import { queueActualProcessingTimeMigration } from './packages/storage/src/migrations/019-queue-actual-processing-time'

async function runMigration19() {
  console.log('[Migration Runner] Running migration 019...')

  const db = DatabaseManager.getInstance().getDatabase()

  // Check if migration already applied
  const existing = db.prepare('SELECT * FROM migrations WHERE version = ?').get(19) as any
  if (existing) {
    console.log('[Migration Runner] Migration 019 already applied')
    return
  }

  try {
    // Run the migration
    queueActualProcessingTimeMigration.up(db)

    // Record it as applied
    db.prepare('INSERT INTO migrations (version, description, applied_at) VALUES (?, ?, ?)').run(
      19,
      queueActualProcessingTimeMigration.description,
      Date.now()
    )

    console.log('[Migration Runner] Migration 019 completed successfully')

    // Verify the column exists
    const tableInfo = db.prepare("PRAGMA table_info('queue_items')").all() as any[]
    const hasColumn = tableInfo.some((col: any) => col.name === 'actual_processing_time')
    console.log('[Migration Runner] Verification: actual_processing_time column exists =', hasColumn)
  } catch (error) {
    console.error('[Migration Runner] Migration 019 failed:', error)
    throw error
  }
}

runMigration19().catch(console.error)
