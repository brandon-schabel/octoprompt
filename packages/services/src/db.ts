// Database utilities for services package
import { DatabaseManager } from '@octoprompt/storage'
import type { Database } from 'bun:sqlite'
import { runMigrations } from '@octoprompt/storage/src/migrations/run-migrations'

// Get database instance
const dbManager = DatabaseManager.getInstance()

// Export database instance for direct queries in tests
export const db: Database = dbManager.getDatabase()

// Initialize migrations for tests
if (process.env.NODE_ENV === 'test') {
  await runMigrations()
}

// Reset database function for tests
export async function resetDatabase(): Promise<void> {
  await dbManager.clearAllTables()
  // Re-run migrations after clearing tables
  if (process.env.NODE_ENV === 'test') {
    await runMigrations()
  }
}

// Export database manager for advanced operations
export { dbManager }
