import type { Database } from 'bun:sqlite'

/**
 * Migration to remove agent_projects table since agents are now fully file-based
 * and dynamically loaded like claude commands
 */
export const removeAgentProjectsTableMigration = {
  version: 13,
  description: 'Remove agent_projects table - agents are now dynamically loaded from files',

  up: (db: Database) => {
    // Drop the agent_projects table
    db.exec(`DROP TABLE IF EXISTS agent_projects`)

    // Also drop agent_usage_stats as it's no longer needed
    db.exec(`DROP TABLE IF EXISTS agent_usage_stats`)

    console.log('[Migration] Removed agent_projects and agent_usage_stats tables - agents are now file-based only')
  },

  down: (db: Database) => {
    // Recreate the tables if rolling back
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_projects (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_projects_created 
      ON agent_projects(created_at)
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_usage_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        task_count INTEGER NOT NULL DEFAULT 0,
        last_used INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        metadata TEXT
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_usage_stats_agent_id 
      ON agent_usage_stats(agent_id)
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_usage_stats_project_id 
      ON agent_usage_stats(project_id)
    `)

    console.log('[Migration] Recreated agent_projects and agent_usage_stats tables')
  }
}