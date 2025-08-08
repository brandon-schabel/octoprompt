import type { Database } from 'bun:sqlite'

/**
 * Migration to convert provider_keys from JSON storage to proper columns
 * 
 * ⚠️ WARNING: CLEAN BREAK MIGRATION - DATA LOSS ⚠️
 * This migration will DELETE ALL existing provider keys data!
 * It converts from JSON column storage to proper database columns.
 * There is NO data migration - all provider keys will be lost.
 * 
 * This is intentional for beta software. In production, you would
 * need to implement data migration from JSON to columns.
 */
export const providerKeysColumnsMigration = {
  version: 9,
  description: 'Convert provider_keys from JSON storage to proper column-based table (DATA LOSS)',

  up: (db: Database) => {
    console.log('[Migration] Starting provider_keys column migration...')

    // Create new provider_keys table with proper columns
    db.exec(`
      CREATE TABLE provider_keys_new (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        key TEXT NOT NULL,
        encrypted INTEGER NOT NULL DEFAULT 0 CHECK (encrypted IN (0, 1)),
        iv TEXT,
        tag TEXT,
        salt TEXT,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        environment TEXT NOT NULL DEFAULT 'production',
        description TEXT,
        expires_at INTEGER,
        last_used INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop old JSON-based table
    db.exec(`DROP TABLE IF EXISTS provider_keys`)

    // Rename new table to original name
    db.exec(`ALTER TABLE provider_keys_new RENAME TO provider_keys`)

    // Create indexes for provider_keys table
    db.exec(`CREATE INDEX idx_provider_keys_provider ON provider_keys(provider)`)
    db.exec(`CREATE INDEX idx_provider_keys_is_active ON provider_keys(is_active)`)
    db.exec(`CREATE INDEX idx_provider_keys_created_at ON provider_keys(created_at)`)
    db.exec(`CREATE INDEX idx_provider_keys_updated_at ON provider_keys(updated_at)`)
    db.exec(`CREATE INDEX idx_provider_keys_provider_active ON provider_keys(provider, is_active)`)
    // Additional composite index for common query pattern
    db.exec(`CREATE INDEX idx_provider_keys_provider_active_default ON provider_keys(provider, is_active, is_default)`)

    console.log('[Migration] Provider keys table converted to column-based storage successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting provider_keys to JSON storage...')

    // Create old JSON-based table
    db.exec(`
      CREATE TABLE provider_keys_old (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Drop column-based table
    db.exec(`DROP TABLE IF EXISTS provider_keys`)

    // Rename old table back
    db.exec(`ALTER TABLE provider_keys_old RENAME TO provider_keys`)

    // Recreate old indexes
    db.exec(`CREATE INDEX idx_provider_keys_created_at ON provider_keys(created_at)`)

    console.log('[Migration] Reverted to JSON-based storage')
  }
}