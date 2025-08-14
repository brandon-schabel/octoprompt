import { DatabaseManager, getDb } from './database-manager'

/**
 * Utility functions for tests to ensure proper database isolation
 */

/**
 * Clear all data from all tables including migration-managed tables
 * This ensures proper test isolation
 */
export async function clearAllData(): Promise<void> {
  const db = getDb()
  const database = db.getDatabase()

  // List of all tables that need to be cleared during tests
  const tablesToClear = [
    // Migration-managed tables
    'projects',
    'project_files',
    'tickets',
    'ticket_tasks',
    'prompts',
    'prompt_projects',
    'provider_keys',
    'chats',
    'chat_messages',
    'mcp_tool_executions_v2',
    'mcp_tool_statistics',
    'mcp_tool_chains',
    'mcp_tool_patterns',
    'claude_agents',
    'claude_agent_projects',
    'claude_hooks',
    'claude_commands',
    'claude_sessions',
    'claude_session_messages',
    'claude_session_tools',

    // Legacy JSON tables
    'mcp_server_configs',
    'mcp_server_states',
    'mcp_tools',
    'mcp_resources',
    'mcp_tool_executions',
    'selected_files'
  ]

  // Clear all tables in a transaction
  database.transaction(() => {
    for (const table of tablesToClear) {
      try {
        database.exec(`DELETE FROM ${table}`)
      } catch (error) {
        // Table might not exist yet if migrations haven't run
        // This is fine for tests
      }
    }
  })()

  // Also clear the legacy tables using the built-in method
  await db.clearAllTables()
}

/**
 * Reset database for tests - ensures a clean state
 */
export async function resetTestDatabase(): Promise<void> {
  // Clear all data
  await clearAllData()

  // Ensure migrations are run
  const { runMigrations } = await import('./migrations/run-migrations')
  await runMigrations()
}

/**
 * Reset database instance - ensures complete isolation between test suites
 * Call this in afterAll() hooks to prevent state leakage between test files
 */
export function resetDatabaseInstance(): void {
  DatabaseManager.resetInstance()
}

/**
 * Create a test database transaction that automatically rolls back
 * Useful for tests that need to verify behavior without persisting data
 */
export function withTestTransaction<T>(fn: () => T): T {
  const db = getDb()
  const database = db.getDatabase()

  // Start a savepoint
  database.exec('SAVEPOINT test_transaction')

  try {
    const result = fn()
    // Always rollback for tests
    database.exec('ROLLBACK TO SAVEPOINT test_transaction')
    return result
  } catch (error) {
    database.exec('ROLLBACK TO SAVEPOINT test_transaction')
    throw error
  } finally {
    database.exec('RELEASE SAVEPOINT test_transaction')
  }
}
