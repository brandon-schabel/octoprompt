import type { Database } from 'bun:sqlite'

/**
 * Migration to add MCP tool execution tracking tables
 */
export const addMCPTrackingMigration = {
  version: 3,
  description: 'Add MCP tool execution tracking tables for analytics and monitoring',
  
  up: (db: Database) => {
    // Check if mcp_tool_executions_v2 table already exists with the wrong schema
    const tableInfo = db.prepare("PRAGMA table_info(mcp_tool_executions_v2)").all()
    
    if (tableInfo.length > 0) {
      // Table exists, check if it's the JSON schema (wrong schema)
      const hasDataColumn = tableInfo.some((col: any) => col.name === 'data')
      
      if (hasDataColumn) {
        console.log('[Migration] mcp_tool_executions_v2 table exists with incorrect JSON schema, dropping and recreating')
        // Drop the incorrectly created table
        db.exec('DROP TABLE IF EXISTS mcp_tool_executions_v2')
      }
    }
    
    // Create main tracking table for MCP tool executions
    db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_tool_executions_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        project_id INTEGER,
        user_id TEXT,
        session_id TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
        error_message TEXT,
        error_code TEXT,
        input_params TEXT,
        output_size INTEGER,
        metadata TEXT
      )
    `)

    // Create indexes for efficient querying
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_v2_tool_name 
      ON mcp_tool_executions_v2(tool_name)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_v2_project_id 
      ON mcp_tool_executions_v2(project_id)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_v2_started_at 
      ON mcp_tool_executions_v2(started_at)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_v2_status 
      ON mcp_tool_executions_v2(status)
    `)

    // Create aggregated statistics table for performance
    db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_tool_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        project_id INTEGER,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        period_type TEXT NOT NULL CHECK (period_type IN ('hour', 'day', 'week', 'month')),
        execution_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        timeout_count INTEGER NOT NULL DEFAULT 0,
        total_duration_ms INTEGER NOT NULL DEFAULT 0,
        avg_duration_ms INTEGER NOT NULL DEFAULT 0,
        min_duration_ms INTEGER,
        max_duration_ms INTEGER,
        total_output_size INTEGER NOT NULL DEFAULT 0,
        metadata TEXT,
        UNIQUE(tool_name, project_id, period_start, period_type)
      )
    `)

    // Create indexes for statistics table
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_statistics_tool_name 
      ON mcp_tool_statistics(tool_name)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_statistics_project_id 
      ON mcp_tool_statistics(project_id)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_statistics_period 
      ON mcp_tool_statistics(period_start, period_end, period_type)
    `)

    // Create table for tracking tool execution chains/transactions
    db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_tool_chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id TEXT NOT NULL,
        execution_id INTEGER NOT NULL,
        parent_execution_id INTEGER,
        position INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (execution_id) REFERENCES mcp_tool_executions_v2(id),
        FOREIGN KEY (parent_execution_id) REFERENCES mcp_tool_executions_v2(id)
      )
    `)

    // Create index for chain lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_chains_chain_id 
      ON mcp_tool_chains(chain_id)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_chains_execution_id 
      ON mcp_tool_chains(execution_id)
    `)

    // Create table for tracking tool usage patterns
    db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_tool_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        pattern_type TEXT NOT NULL CHECK (pattern_type IN ('sequence', 'frequency', 'error')),
        pattern_data TEXT NOT NULL,
        occurrence_count INTEGER NOT NULL DEFAULT 1,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        metadata TEXT
      )
    `)

    // Create indexes for pattern analysis
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_patterns_project_id 
      ON mcp_tool_patterns(project_id)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_patterns_type 
      ON mcp_tool_patterns(pattern_type)
    `)

    console.log('[Migration] MCP tracking tables and indexes created successfully')
  },

  down: (db: Database) => {
    // Drop all created tables
    db.exec(`DROP TABLE IF EXISTS mcp_tool_patterns`)
    db.exec(`DROP TABLE IF EXISTS mcp_tool_chains`)
    db.exec(`DROP TABLE IF EXISTS mcp_tool_statistics`)
    db.exec(`DROP TABLE IF EXISTS mcp_tool_executions_v2`)
    
    console.log('[Migration] MCP tracking tables removed')
  }
}