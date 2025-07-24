import { DatabaseManager } from '../database-manager'
import { addFTS5SearchMigration } from './002-add-fts5-search'
import { addMCPTrackingMigration } from './003-mcp-tracking'
import type { Database } from 'bun:sqlite'

interface Migration {
  version: number
  description: string
  up: (db: Database) => void
  down?: (db: Database) => void
}

// All migrations in order
const migrations: Migration[] = [
  // Initial migration is implicit in table creation
  addFTS5SearchMigration,
  addMCPTrackingMigration
]

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  const db = DatabaseManager.getInstance().getDatabase()
  
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)
  
  // Get applied migrations
  const appliedMigrations = db.prepare(
    'SELECT version FROM migrations ORDER BY version'
  ).all() as { version: number }[]
  
  const appliedVersions = new Set(appliedMigrations.map(m => m.version))
  
  // Run pending migrations
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[Migration] Running migration ${migration.version}: ${migration.description}`)
      
      try {
        // Run the migration
        migration.up(db)
        
        // Record it as applied
        db.prepare(
          'INSERT INTO migrations (version, description, applied_at) VALUES (?, ?, ?)'
        ).run(migration.version, migration.description, Date.now())
        
        console.log(`[Migration] Migration ${migration.version} completed successfully`)
      } catch (error) {
        console.error(`[Migration] Migration ${migration.version} failed:`, error)
        throw error
      }
    }
  }
}