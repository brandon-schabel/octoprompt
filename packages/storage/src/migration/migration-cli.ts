#!/usr/bin/env bun

import { StorageV2Migrator, type MigrationOptions } from './v2-migrations'

interface CLIOptions {
  storage?: string
  dryRun?: boolean
  backup?: boolean
  validate?: boolean
  help?: boolean
  all?: boolean
}

const STORAGE_TYPES = ['chats', 'prompts', 'provider-keys', 'claude-code', 'projects', 'all']

function printHelp() {
  console.log(`
OctoPrompt Storage V2 Migration CLI

Usage: bun migration-cli.ts [options]

Options:
  --storage <type>    Migrate specific storage type (${STORAGE_TYPES.join(', ')})
  --all              Migrate all storage types
  --dry-run          Preview migration without making changes
  --backup           Create backup of original data before migration
  --validate         Validate migrated data after migration
  --help             Show this help message

Examples:
  # Dry run migration of all storage
  bun migration-cli.ts --all --dry-run

  # Migrate chats with backup
  bun migration-cli.ts --storage chats --backup

  # Migrate all with backup and validation
  bun migration-cli.ts --all --backup --validate

Storage Types:
  chats          - Chat sessions and messages
  prompts        - User prompts and templates
  provider-keys  - AI provider API keys
  claude-code    - Claude Code sessions
  projects       - Projects and files
  all            - All storage types
`)
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2)
  const options: CLIOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--storage':
        options.storage = args[++i]
        break
      case '--all':
        options.all = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--backup':
        options.backup = true
        break
      case '--validate':
        options.validate = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        console.error(`Unknown option: ${arg}`)
        process.exit(1)
    }
  }

  return options
}

function validateOptions(options: CLIOptions): boolean {
  if (options.help) {
    return true
  }

  if (!options.all && !options.storage) {
    console.error('Error: Must specify either --all or --storage <type>')
    return false
  }

  if (options.storage && !STORAGE_TYPES.includes(options.storage)) {
    console.error(`Error: Invalid storage type "${options.storage}". Valid types: ${STORAGE_TYPES.join(', ')}`)
    return false
  }

  if (options.all && options.storage) {
    console.error('Error: Cannot specify both --all and --storage')
    return false
  }

  return true
}

async function runMigration() {
  const options = parseArgs()

  if (!validateOptions(options)) {
    printHelp()
    process.exit(1)
  }

  if (options.help) {
    printHelp()
    process.exit(0)
  }

  const migrationOptions: MigrationOptions = {
    dryRun: options.dryRun,
    backupOriginal: options.backup,
    validateData: options.validate,
    onProgress: (progress) => {
      const percent = Math.round((progress.current / progress.total) * 100)
      process.stdout.write(`\r${progress.entity}: ${progress.current}/${progress.total} (${percent}%)`)
    }
  }

  console.log('🚀 OctoPrompt Storage V2 Migration')
  console.log('=====================================')

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made')
  }

  if (options.backup) {
    console.log('💾 Backup enabled - Original data will be preserved')
  }

  if (options.validate) {
    console.log('✅ Validation enabled - Data will be verified after migration')
  }

  console.log('')

  try {
    if (options.all) {
      // Migrate all storage types
      console.log('🔄 Migrating all storage types...\n')
      const results = await StorageV2Migrator.migrateAll(migrationOptions)

      // Print detailed results
      let hasErrors = false
      console.log('\n📊 Migration Results:')
      console.log('====================')

      Object.entries(results).forEach(([storageType, result]) => {
        const status = result.success ? '✅' : '❌'
        const duration = (result.duration / 1000).toFixed(2)

        console.log(`${status} ${storageType}: ${result.migrated} migrated in ${duration}s`)

        if (result.errors.length > 0) {
          hasErrors = true
          console.log(`   Errors: ${result.errors.length}`)
          result.errors.forEach((error) => console.log(`   - ${error}`))
        }

        if (result.backupPath) {
          console.log(`   Backup: ${result.backupPath}`)
        }
      })

      if (hasErrors) {
        console.log('\n⚠️  Migration completed with errors')
        process.exit(1)
      } else {
        console.log('\n🎉 All migrations completed successfully!')
      }
    } else if (options.storage) {
      // Migrate specific storage type
      console.log(`🔄 Migrating ${options.storage} storage...\n`)

      let result
      switch (options.storage) {
        case 'chats':
          result = await StorageV2Migrator.migrateChatStorage(migrationOptions)
          break
        case 'prompts':
          result = await StorageV2Migrator.migratePromptStorage(migrationOptions)
          break
        case 'provider-keys':
          result = await StorageV2Migrator.migrateProviderKeyStorage(migrationOptions)
          break
        case 'claude-code':
          result = await StorageV2Migrator.migrateClaudeCodeStorage(migrationOptions)
          break
        case 'projects':
          result = await StorageV2Migrator.migrateProjectStorage(migrationOptions)
          break
        default:
          throw new Error(`Unknown storage type: ${options.storage}`)
      }

      // Print results
      console.log('\n📊 Migration Results:')
      console.log('====================')

      const status = result.success ? '✅' : '❌'
      const duration = (result.duration / 1000).toFixed(2)

      console.log(`${status} ${options.storage}: ${result.migrated} migrated in ${duration}s`)

      if (result.errors.length > 0) {
        console.log(`Errors: ${result.errors.length}`)
        result.errors.forEach((error) => console.log(`- ${error}`))
      }

      if (result.backupPath) {
        console.log(`Backup: ${result.backupPath}`)
      }

      if (!result.success) {
        console.log('\n⚠️  Migration completed with errors')
        process.exit(1)
      } else {
        console.log('\n🎉 Migration completed successfully!')
      }
    }

    // Run validation if requested
    if (options.validate && !options.dryRun) {
      console.log('\n🔍 Validating migrated data...')

      const storageTypes = options.all
        ? ['chats', 'prompts', 'provider-keys', 'claude-code', 'projects']
        : [options.storage!]

      for (const storageType of storageTypes) {
        const validation = await StorageV2Migrator.validateMigration(storageType)

        if (validation.valid) {
          console.log(`✅ ${storageType}: Validation passed`)
        } else {
          console.log(`❌ ${storageType}: Validation failed`)
          validation.issues.forEach((issue) => console.log(`   - ${issue}`))
        }
      }
    }
  } catch (error: any) {
    console.error('\n💥 Migration failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the migration
if (import.meta.main) {
  runMigration().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { runMigration }
