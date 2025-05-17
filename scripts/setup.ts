import { $ } from 'bun'
import { setupDatabase } from '../packages/server/src/utils/database'
import path from 'path' // Import path module

type SetupOptions = {
  force?: boolean
  verbose?: boolean
}

async function setupDatabaseScript(options: SetupOptions = {}) {
  const { force = false, verbose = false } = options

  try {
    const log = verbose ? console.log : (..._: unknown[]) => {}

    log('📦 Setting up database...')

    // Check if database already exists - using resolved path
    const dbPath = path.resolve('packages/server', 'sqlite.db') // Resolve path here
    const dbExists = await Bun.file(dbPath).exists()

    if (dbExists && !force) {
      console.log('⚠️ Database already exists. Use --force to recreate.')
      return
    }

    // Use the setupDatabase function from database.ts to handle database creation and migrations
    setupDatabase({ dbPath: dbPath }) // Pass the resolved dbPath

    console.log('✅ Database setup completed successfully!')
  } catch (error) {
    console.error('❌ Error setting up database:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
await setupDatabaseScript({
  force: args.includes('--force'),
  verbose: args.includes('--verbose')
})
