#!/usr/bin/env bun
import { runMigrations } from './packages/storage/src/migrations/run-migrations'
import { DatabaseManager } from './packages/storage/src/database-manager'

async function main() {
  try {
    console.log('🔧 Starting manual migration run...')
    
    // Get database manager to check current state
    const dbManager = DatabaseManager.getInstance()
    const db = dbManager.getDatabase()
    
    console.log(`📍 Database path: ${dbManager.getDatabasePath()}`)
    
    // Check if migrations table exists
    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as { count: number }
      console.log(`📊 Found ${result.count} existing migrations`)
    } catch (error) {
      console.log('📝 No migrations table found - will be created')
    }
    
    // Run migrations
    await runMigrations()
    
    // Check final state
    const finalResult = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as { count: number }
    console.log(`✅ Migration complete! Total migrations: ${finalResult.count}`)
    
    // Check if key tables exist now
    const tables = ['chats', 'provider_keys', 'projects', 'tickets']
    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
        console.log(`✓ Table '${table}' exists with ${count.count} records`)
      } catch (error) {
        console.log(`✗ Table '${table}' does not exist`)
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

main()