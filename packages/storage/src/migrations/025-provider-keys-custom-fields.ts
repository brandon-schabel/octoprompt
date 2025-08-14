import type { Database } from 'bun:sqlite'

/**
 * Migration to add custom provider fields to provider_keys table
 * 
 * This migration adds support for custom OpenAI-compatible providers
 * by adding base_url and custom_headers columns to the provider_keys table.
 */
export const providerKeysCustomFieldsMigration = {
  version: 25,
  description: 'Add base_url and custom_headers columns for custom provider support',

  up: (db: Database) => {
    console.log('[Migration] Adding custom provider fields to provider_keys table...')

    // Add base_url column for custom provider endpoints
    db.exec(`
      ALTER TABLE provider_keys 
      ADD COLUMN base_url TEXT
    `)

    // Add custom_headers column for custom headers (stored as JSON string)
    db.exec(`
      ALTER TABLE provider_keys 
      ADD COLUMN custom_headers TEXT
    `)

    // Create index for custom providers (provider = 'custom' and base_url is not null)
    db.exec(`
      CREATE INDEX idx_provider_keys_custom 
      ON provider_keys(provider, base_url) 
      WHERE provider = 'custom' AND base_url IS NOT NULL
    `)

    console.log('[Migration] Custom provider fields added successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Reverting custom provider fields...')

    // Drop the custom provider index
    db.exec(`DROP INDEX IF EXISTS idx_provider_keys_custom`)

    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    // Create temporary table without the new columns
    db.exec(`
      CREATE TABLE provider_keys_temp (
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

    // Copy data from existing table (excluding new columns)
    db.exec(`
      INSERT INTO provider_keys_temp (
        id, name, provider, key, encrypted, iv, tag, salt,
        is_default, is_active, environment, description,
        expires_at, last_used, created_at, updated_at
      )
      SELECT 
        id, name, provider, key, encrypted, iv, tag, salt,
        is_default, is_active, environment, description,
        expires_at, last_used, created_at, updated_at
      FROM provider_keys
    `)

    // Drop the current table
    db.exec(`DROP TABLE provider_keys`)

    // Rename temp table to original name
    db.exec(`ALTER TABLE provider_keys_temp RENAME TO provider_keys`)

    // Recreate original indexes
    db.exec(`CREATE INDEX idx_provider_keys_provider ON provider_keys(provider)`)
    db.exec(`CREATE INDEX idx_provider_keys_is_active ON provider_keys(is_active)`)
    db.exec(`CREATE INDEX idx_provider_keys_created_at ON provider_keys(created_at)`)
    db.exec(`CREATE INDEX idx_provider_keys_updated_at ON provider_keys(updated_at)`)
    db.exec(`CREATE INDEX idx_provider_keys_provider_active ON provider_keys(provider, is_active)`)
    db.exec(`CREATE INDEX idx_provider_keys_provider_active_default ON provider_keys(provider, is_active, is_default)`)

    console.log('[Migration] Custom provider fields reverted successfully')
  }
}