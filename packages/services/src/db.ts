// Database utilities for services package
import { DatabaseManager } from '@octoprompt/storage'
import type { Database } from 'bun:sqlite'

// Get database instance
const dbManager = DatabaseManager.getInstance()

// Export database instance for direct queries in tests
export const db: Database = dbManager.getDatabase()

// Reset database function for tests
export async function resetDatabase(): Promise<void> {
    await dbManager.clearAllTables()
}

// Export database manager for advanced operations
export { dbManager } 