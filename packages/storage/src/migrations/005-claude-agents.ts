import type { Database } from 'bun:sqlite'

/**
 * Migration to add Claude agent support - associations and ticket/task fields
 */
export const addClaudeAgentsMigration = {
  version: 5,
  description: 'Add Claude agent associations and update tickets/tasks with agent/prompt fields',

  up: (db: Database) => {
    // Create agent_projects association table (agents are stored as files)
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_projects (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Create indexes for agent_projects
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_projects_created 
      ON agent_projects(created_at)
    `)

    // Since we're using JSON storage pattern, we need to check if tickets/tasks tables exist
    // and have the JSON structure before attempting to modify
    const ticketsTableInfo = db.prepare('PRAGMA table_info(tickets)').all()
    const tasksTableInfo = db.prepare('PRAGMA table_info(tasks)').all()

    // Check if tables exist and use JSON storage
    const ticketsHasDataColumn = ticketsTableInfo.some((col: any) => col.name === 'data')
    const tasksHasDataColumn = tasksTableInfo.some((col: any) => col.name === 'data')

    if (ticketsHasDataColumn) {
      console.log('[Migration] Tickets table uses JSON storage - agent/prompt fields will be stored in JSON data')
    } else {
      console.log('[Migration] Warning: Tickets table does not use expected JSON storage pattern')
    }

    if (tasksHasDataColumn) {
      console.log('[Migration] Tasks table uses JSON storage - agent/prompt fields will be stored in JSON data')
    } else {
      console.log('[Migration] Warning: Tasks table does not use expected JSON storage pattern')
    }

    // Create table for tracking agent usage statistics (optional)
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

    // Create indexes for agent usage stats
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_usage_stats_agent_id 
      ON agent_usage_stats(agent_id)
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_usage_stats_project_id 
      ON agent_usage_stats(project_id)
    `)

    console.log('[Migration] Claude agents tables and indexes created successfully')
  },

  down: (db: Database) => {
    // Drop created tables
    db.exec(`DROP TABLE IF EXISTS agent_usage_stats`)
    db.exec(`DROP TABLE IF EXISTS agent_projects`)

    // Note: We don't modify the tickets/tasks tables in down migration
    // since the fields are stored in JSON and removing them would require
    // parsing and modifying all existing records

    console.log('[Migration] Claude agents tables removed')
  }
}
