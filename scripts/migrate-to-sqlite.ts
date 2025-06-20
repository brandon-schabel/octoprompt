#!/usr/bin/env bun

import { Database } from 'bun:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import { z } from 'zod'
import { parseArgs } from 'node:util'
import {
  ProviderKeySchema,
  ProjectSchema,
  ProjectFileSchema,
  ChatSchema,
  ChatMessageSchema,
  PromptSchema,
  PromptProjectSchema,
  MCPServerConfigSchema,
  MCPServerStateSchema,
  MCPToolSchema,
  MCPResourceSchema,
  MCPToolExecutionResultSchema,
} from '@octoprompt/schemas'
import { DatabaseManager } from '@octoprompt/storage/src/database-manager'

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'dry-run': {
      type: 'boolean',
      short: 'd',
      default: false,
    },
    'no-backup': {
      type: 'boolean',
      default: false,
    },
    'verbose': {
      type: 'boolean',
      short: 'v',
      default: false,
    },
    'resume': {
      type: 'boolean',
      short: 'r',
      default: false,
    },
    'help': {
      type: 'boolean',
      short: 'h',
      default: false,
    },
  },
})

const DRY_RUN = values['dry-run'] ?? false
const NO_BACKUP = values['no-backup'] ?? false
const VERBOSE = values['verbose'] ?? false
const RESUME = values['resume'] ?? false
const HELP = values['help'] ?? false

// Show help if requested
if (HELP) {
  console.log(`
OctoPrompt SQLite Migration Script

Usage: bun run scripts/migrate-to-sqlite.ts [options]

Options:
  -h, --help        Show this help message
  -d, --dry-run     Test migration without making changes
  -v, --verbose     Show detailed logging
  -r, --resume      Resume from previous migration state
  --no-backup       Skip creating backup (not recommended)

Examples:
  # Test migration without making changes
  bun run scripts/migrate-to-sqlite.ts --dry-run

  # Run full migration with verbose logging
  bun run scripts/migrate-to-sqlite.ts --verbose

  # Resume interrupted migration
  bun run scripts/migrate-to-sqlite.ts --resume
`)
  process.exit(0)
}

// Migration state tracking
interface MigrationState {
  startedAt: number
  completedTables: string[]
  errors: Array<{ table: string; id: string; error: string }>
  stats: Record<string, { attempted: number; succeeded: number; failed: number }>
}

const STATE_FILE = path.join(process.cwd(), 'data', '.migration-state.json')

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logProgress(current: number, total: number, entity: string) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  process.stdout.write(
    `\r${colors.cyan}Migrating ${entity}... ${current}/${total} (${percentage}%)${colors.reset}`
  )
  if (current === total) {
    process.stdout.write('\n')
  }
}

// Load or initialize migration state
function loadMigrationState(): MigrationState {
  if (RESUME && fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
      log('Resuming from previous migration state', 'yellow')
      return state
    } catch (e) {
      log('Failed to load migration state, starting fresh', 'yellow')
    }
  }
  
  return {
    startedAt: Date.now(),
    completedTables: [],
    errors: [],
    stats: {},
  }
}

// Save migration state
function saveMigrationState(state: MigrationState) {
  if (!DRY_RUN) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  }
}

// Backup data directory
async function backupData() {
  if (NO_BACKUP || DRY_RUN) return
  
  const dataDir = path.join(process.cwd(), 'packages', 'server', 'data')
  const backupDir = path.join(process.cwd(), 'data', `backup-${Date.now()}`)
  
  log(`Creating backup at ${backupDir}...`, 'blue')
  
  try {
    await fs.promises.cp(dataDir, backupDir, { recursive: true })
    log('Backup created successfully', 'green')
  } catch (e) {
    log(`Failed to create backup: ${e}`, 'red')
    throw e
  }
}

// Read JSON file safely
async function readJsonFile<T>(filePath: string, schema: z.ZodSchema<T>): Promise<T[]> {
  try {
    if (!fs.existsSync(filePath)) {
      if (VERBOSE) log(`File not found: ${filePath}`, 'yellow')
      return []
    }
    
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    
    // Handle both array and map formats
    let items: T[] = []
    if (Array.isArray(data)) {
      items = data
    } else if (typeof data === 'object') {
      // Convert map/object to array
      items = Object.values(data)
    }
    
    // Validate each item
    const validItems: T[] = []
    for (const item of items) {
      try {
        const validated = schema.parse(item)
        validItems.push(validated)
      } catch (e) {
        if (VERBOSE) {
          log(`Validation error for item: ${e}`, 'yellow')
        }
      }
    }
    
    return validItems
  } catch (e) {
    log(`Error reading ${filePath}: ${e}`, 'red')
    return []
  }
}

// Migrate a single table
async function migrateTable<T extends { id: string | number }>(
  tableName: string,
  items: T[],
  db: DatabaseManager,
  state: MigrationState
): Promise<void> {
  if (state.completedTables.includes(tableName)) {
    log(`Skipping ${tableName} (already completed)`, 'yellow')
    return
  }
  
  const stats = { attempted: 0, succeeded: 0, failed: 0 }
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    stats.attempted++
    
    try {
      const id = String(item.id)
      
      if (!DRY_RUN) {
        // Check if already exists (for resume functionality)
        const exists = await db.exists(tableName, id)
        if (exists && RESUME) {
          stats.succeeded++
          continue
        }
        
        await db.create(tableName, id, item)
      }
      
      stats.succeeded++
      
      if ((i + 1) % 10 === 0 || i === items.length - 1) {
        logProgress(i + 1, items.length, tableName)
      }
    } catch (e) {
      stats.failed++
      state.errors.push({
        table: tableName,
        id: String(item.id),
        error: String(e),
      })
      
      if (VERBOSE) {
        log(`\nError migrating ${tableName} ID ${item.id}: ${e}`, 'red')
      }
    }
  }
  
  state.stats[tableName] = stats
  state.completedTables.push(tableName)
  saveMigrationState(state)
}

// Main migration function
async function migrate() {
  log('\n🚀 Starting SQLite Migration', 'bright')
  log('================================\n', 'bright')
  
  if (DRY_RUN) {
    log('🔍 DRY RUN MODE - No changes will be made', 'yellow')
  }
  
  const state = loadMigrationState()
  
  try {
    // Create backup
    if (!state.completedTables.length) {
      await backupData()
    }
    
    // Initialize database
    if (!DRY_RUN) {
      log('Initializing SQLite database...', 'blue')
    }
    
    const db = DatabaseManager.getInstance()
    
    const dataDir = path.join(process.cwd(), 'packages', 'server', 'data')
    
    // Define migration order and paths
    const migrations = [
      {
        name: 'provider_keys',
        path: path.join(dataDir, 'provider_key_storage', 'provider_keys.json'),
        schema: ProviderKeySchema,
        table: 'provider_keys',
      },
      {
        name: 'projects',
        path: path.join(dataDir, 'project_storage', 'projects.json'),
        schema: ProjectSchema,
        table: 'projects',
      },
      {
        name: 'chats',
        path: path.join(dataDir, 'chat_storage', 'chats.json'),
        schema: ChatSchema,
        table: 'chats',
      },
      {
        name: 'prompts',
        path: path.join(dataDir, 'prompt_storage', 'prompts.json'),
        schema: PromptSchema,
        table: 'prompts',
      },
      {
        name: 'prompt_projects',
        path: path.join(dataDir, 'prompt_storage', 'prompt_projects.json'),
        schema: PromptProjectSchema,
        table: 'prompt_projects',
      },
      {
        name: 'mcp_server_configs',
        path: path.join(dataDir, 'mcp_storage', 'server_configs.json'),
        schema: MCPServerConfigSchema,
        table: 'mcp_server_configs',
      },
      {
        name: 'mcp_server_states',
        path: path.join(dataDir, 'mcp_storage', 'server_states.json'),
        schema: MCPServerStateSchema,
        table: 'mcp_server_states',
      },
      {
        name: 'mcp_tools',
        path: path.join(dataDir, 'mcp_storage', 'tools.json'),
        schema: MCPToolSchema,
        table: 'mcp_tools',
      },
      {
        name: 'mcp_resources',
        path: path.join(dataDir, 'mcp_storage', 'resources.json'),
        schema: MCPResourceSchema,
        table: 'mcp_resources',
      },
      {
        name: 'mcp_tool_executions',
        path: path.join(dataDir, 'mcp_storage', 'tool_executions.json'),
        schema: MCPToolExecutionResultSchema,
        table: 'mcp_tool_executions',
      },
    ].filter(m => {
      // Check if file exists before including in migration
      const exists = fs.existsSync(m.path)
      if (!exists && VERBOSE) {
        log(`Skipping ${m.name} - file not found: ${m.path}`, 'yellow')
      }
      return exists
    })
    
    // Migrate each table
    for (const migration of migrations) {
      log(`\n📋 Migrating ${migration.name}...`, 'blue')
      
      const items = await readJsonFile(migration.path, migration.schema)
      log(`Found ${items.length} ${migration.name} to migrate`, 'cyan')
      
      if (items.length > 0) {
        await migrateTable(migration.table, items, db, state)
      }
    }
    
    // Migrate project files
    log('\n📋 Migrating project files...', 'blue')
    const projectsPath = path.join(dataDir, 'project_storage', 'projects.json')
    const projects = await readJsonFile(projectsPath, ProjectSchema)
    
    let totalFiles = 0
    let migratedFiles = 0
    
    for (const project of projects) {
      const filesPath = path.join(dataDir, 'project_storage', 'project_data', String(project.id), 'files.json')
      const files = await readJsonFile(filesPath, ProjectFileSchema)
      
      if (files.length > 0) {
        totalFiles += files.length
        await migrateTable('project_files', files, db, state)
        migratedFiles += files.length
      }
    }
    
    if (totalFiles > 0) {
      log(`Migrated ${migratedFiles} project files`, 'green')
    }
    
    // Migrate chat messages
    log('\n📋 Migrating chat messages...', 'blue')
    const chatsPath = path.join(dataDir, 'chat_storage', 'chats.json')
    const chats = await readJsonFile(chatsPath, ChatSchema)
    
    let totalMessages = 0
    let migratedMessages = 0
    
    for (const chat of chats) {
      const messagesPath = path.join(dataDir, 'chat_storage', 'chat_data', String(chat.id), 'messages.json')
      const messages = await readJsonFile(messagesPath, ChatMessageSchema)
      
      if (messages.length > 0) {
        totalMessages += messages.length
        await migrateTable('chat_messages', messages, db, state)
        migratedMessages += messages.length
      }
    }
    
    if (totalMessages > 0) {
      log(`Migrated ${migratedMessages} chat messages`, 'green')
    }
    
    // Print summary
    log('\n\n📊 Migration Summary', 'bright')
    log('==================', 'bright')
    
    let totalAttempted = 0
    let totalSucceeded = 0
    let totalFailed = 0
    
    for (const [table, stats] of Object.entries(state.stats)) {
      totalAttempted += stats.attempted
      totalSucceeded += stats.succeeded
      totalFailed += stats.failed
      
      const status = stats.failed === 0 ? 'green' : 'yellow'
      log(
        `${table}: ${stats.succeeded}/${stats.attempted} succeeded${
          stats.failed > 0 ? ` (${stats.failed} failed)` : ''
        }`,
        status
      )
    }
    
    log('\n📈 Total Statistics', 'bright')
    log(`Total Records: ${totalAttempted}`, 'cyan')
    log(`Succeeded: ${totalSucceeded}`, 'green')
    log(`Failed: ${totalFailed}`, totalFailed > 0 ? 'red' : 'green')
    
    if (state.errors.length > 0) {
      log('\n❌ Errors:', 'red')
      for (const error of state.errors.slice(0, 10)) {
        log(`  ${error.table} (ID: ${error.id}): ${error.error}`, 'red')
      }
      if (state.errors.length > 10) {
        log(`  ... and ${state.errors.length - 10} more errors`, 'red')
      }
    }
    
    const duration = Date.now() - state.startedAt
    log(`\n⏱️  Migration completed in ${Math.round(duration / 1000)}s`, 'green')
    
    if (!DRY_RUN) {
      // Clean up migration state file
      if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE)
      }
      
      // Run database optimization
      log('\nOptimizing database...', 'blue')
      await db.vacuum()
      await db.analyze()
      log('Database optimized', 'green')
    }
    
    log('\n✅ Migration completed successfully!', 'bright')
    
  } catch (error) {
    log(`\n❌ Migration failed: ${error}`, 'red')
    log('Migration state has been saved. You can resume with --resume flag', 'yellow')
    process.exit(1)
  }
}

// Run migration
if (import.meta.main) {
  migrate().catch((e) => {
    log(`Fatal error: ${e}`, 'red')
    process.exit(1)
  })
}