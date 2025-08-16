import type { Database } from 'bun:sqlite'

/**
 * Migration to remove job queue tables and related infrastructure
 * Removes unused job processing system to reduce code complexity
 */
export const dropJobTablesMigration = {
  version: 26,
  description: 'Remove job queue tables and infrastructure (unused job system cleanup)',

  up: (db: Database) => {
    console.log('[Migration] Dropping job queue tables...')

    // Drop indexes first (order matters for foreign key constraints)
    db.exec(`
      DROP INDEX IF EXISTS idx_job_locks_job_id;
      DROP INDEX IF EXISTS idx_job_locks_expires_at;
    `)

    db.exec(`
      DROP INDEX IF EXISTS idx_job_history_created_at;
      DROP INDEX IF EXISTS idx_job_history_project_id;
      DROP INDEX IF EXISTS idx_job_history_type;
    `)

    db.exec(`
      DROP INDEX IF EXISTS idx_jobs_status_created;
      DROP INDEX IF EXISTS idx_jobs_created_at;
      DROP INDEX IF EXISTS idx_jobs_project_id;
      DROP INDEX IF EXISTS idx_jobs_priority_status;
      DROP INDEX IF EXISTS idx_jobs_status;
      DROP INDEX IF EXISTS idx_jobs_type;
    `)

    // Drop tables (order matters due to foreign key constraints)
    db.exec(`DROP TABLE IF EXISTS job_locks`)
    db.exec(`DROP TABLE IF EXISTS job_history`)
    db.exec(`DROP TABLE IF EXISTS jobs`)

    console.log('[Migration] Job queue tables dropped successfully')
  },

  down: (db: Database) => {
    console.log('[Migration] Recreating job queue tables...')

    // Recreate main jobs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
        
        -- Context
        project_id INTEGER,
        user_id TEXT,
        
        -- Job data
        input TEXT NOT NULL, -- JSON string
        result TEXT, -- JSON string
        error TEXT, -- JSON string with message, code, details
        
        -- Progress tracking
        progress TEXT, -- JSON string with current, total, message
        
        -- Metadata
        metadata TEXT, -- JSON string for additional data
        
        -- Timestamps
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        updated_at INTEGER NOT NULL,
        
        -- Execution options
        timeout_ms INTEGER,
        max_retries INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        retry_delay_ms INTEGER DEFAULT 1000
      )
    `)

    // Recreate job history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_history (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        project_id INTEGER,
        user_id TEXT,
        input TEXT NOT NULL,
        result TEXT,
        error TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        duration_ms INTEGER,
        archived_at INTEGER NOT NULL
      )
    `)

    // Recreate job locks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_locks (
        lock_key TEXT PRIMARY KEY,
        job_id INTEGER NOT NULL,
        locked_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      )
    `)

    // Recreate indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_priority_status ON jobs(priority, status);
      CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
      
      CREATE INDEX IF NOT EXISTS idx_job_history_type ON job_history(type);
      CREATE INDEX IF NOT EXISTS idx_job_history_project_id ON job_history(project_id);
      CREATE INDEX IF NOT EXISTS idx_job_history_created_at ON job_history(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_job_locks_expires_at ON job_locks(expires_at);
      CREATE INDEX IF NOT EXISTS idx_job_locks_job_id ON job_locks(job_id);
    `)

    console.log('[Migration] Job queue tables recreated successfully')
  }
}