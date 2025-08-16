import { DatabaseManager } from '../database-manager'
import { addFTS5SearchMigration } from './002-add-fts5-search'
import { addMCPTrackingMigration } from './003-mcp-tracking'
import { addJobQueueMigration } from './004-job-queue'
import { addClaudeAgentsMigration } from './005-claude-agents'
import { ticketsTasksColumnsMigration } from './006-tickets-tasks-columns'
import { ticketsTasksNotNullMigration } from './007-tickets-tasks-not-null'
import { projectsColumnsMigration } from './008-projects-columns'
import { providerKeysColumnsMigration } from './009-provider-keys-columns'
import { promptsColumnsMigration } from './010-prompts-columns'
import { promptProjectsColumnsMigration } from './011-prompt-projects-columns'
import { projectFilesColumnsMigration } from './012-project-files-columns'
import { removeAgentProjectsTableMigration } from './013-remove-agent-projects'
import { chatTablesColumnsMigration } from './014-chat-tables-columns'
import { taskQueueSystemMigration } from './015-task-queue-system'
import { kanbanBoardEnhancementsMigration } from './016-kanban-board-enhancements'
import { unifiedFlowSystemMigration } from './017-unified-flow-system'
import { queueImprovementsMigration } from './018-queue-improvements'
import { queueActualProcessingTimeMigration } from './019-queue-actual-processing-time'
import { queuePerformanceIndexesMigration } from './020-queue-performance-indexes'
import { fixQueueStatusValuesMigration } from './021-fix-queue-status-values'
import { fixPriorityOrderingMigration } from './022-fix-priority-ordering'
import { dropQueueItemsTableMigration } from './023-drop-queue-items-table'
import { providerKeysCustomFieldsMigration } from './025-provider-keys-custom-fields'
import { dropJobTablesMigration } from './026-drop-job-tables'
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
  addMCPTrackingMigration,
  addJobQueueMigration,
  addClaudeAgentsMigration,
  ticketsTasksColumnsMigration,
  ticketsTasksNotNullMigration,
  projectsColumnsMigration,
  providerKeysColumnsMigration,
  promptsColumnsMigration,
  promptProjectsColumnsMigration,
  projectFilesColumnsMigration,
  removeAgentProjectsTableMigration,
  chatTablesColumnsMigration,
  taskQueueSystemMigration,
  kanbanBoardEnhancementsMigration,
  unifiedFlowSystemMigration,
  queueImprovementsMigration,
  queueActualProcessingTimeMigration,
  queuePerformanceIndexesMigration,
  fixQueueStatusValuesMigration,
  fixPriorityOrderingMigration,
  dropQueueItemsTableMigration,
  providerKeysCustomFieldsMigration,
  dropJobTablesMigration
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
  const appliedMigrations = db.prepare('SELECT version FROM migrations ORDER BY version').all() as { version: number }[]

  const appliedVersions = new Set(appliedMigrations.map((m) => m.version))

  // Run pending migrations
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[Migration] Running migration ${migration.version}: ${migration.description}`)

      try {
        // Run the migration
        migration.up(db)

        // Record it as applied
        db.prepare('INSERT INTO migrations (version, description, applied_at) VALUES (?, ?, ?)').run(
          migration.version,
          migration.description,
          Date.now()
        )

        console.log(`[Migration] Migration ${migration.version} completed successfully`)
      } catch (error) {
        console.error(`[Migration] Migration ${migration.version} failed:`, error)
        throw error
      }
    }
  }
}
