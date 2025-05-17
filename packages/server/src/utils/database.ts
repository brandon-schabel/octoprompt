import { Database } from 'bun:sqlite'
import path from 'path'

// Define our database instance with correct typing
export let db: Database
const defaultDbPath = '../sqlite.db'

function createTables(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title TEXT,
      created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      description TEXT DEFAULT "",
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      extension TEXT NOT NULL,
      size INTEGER NOT NULL,
      content TEXT,
      summary TEXT,
      summary_last_updated_at INTEGER,
      meta TEXT,
      checksum TEXT,
      created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_projects (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      prompt_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_keys (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      provider TEXT NOT NULL,
      key TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      overview TEXT DEFAULT "",
      status TEXT DEFAULT "open",
      priority TEXT DEFAULT "normal",
      suggested_file_ids TEXT DEFAULT "[]",
      created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_files (
      ticket_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      PRIMARY KEY (ticket_id, file_id),
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_tasks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      ticket_id TEXT NOT NULL,
      content TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS file_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      original_content TEXT NOT NULL,
      suggested_diff TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `)
}

type SetupDatabaseOptions = {
  dbPath?: string
}

export function setupDatabase(options: SetupDatabaseOptions = {}): Database {
  let dbPath = options.dbPath ?? defaultDbPath

  // Resolve dbPath relative to the current module's directory
  if (!options.dbPath) {
    const moduleDir = path.dirname(import.meta.dir) // Get directory of current module
    dbPath = path.resolve(moduleDir, dbPath) // Resolve path relative to module directory
  }

  if (process.env.NODE_ENV === 'test') {
    db = new Database(':memory:')
  } else {
    db = new Database(dbPath)
  }

  // Check if tables already exist before creating them - simplified logic, tables are created with IF NOT EXISTS
  createTables(db)
  console.log(`All tables created or verified at ${dbPath}.`)
  return db
}

// Initialize database at module load time
setupDatabase()

// Added resetDatabase function that resets the in-memory test database
export function resetDatabase(): void {
  if (process.env.NODE_ENV !== 'test') {
    console.log('resetDatabase: Not in test environment. No reset performed.')
    return
  }
  try {
    // Drop tables in order considering dependencies
    db.exec('DROP TABLE IF EXISTS ticket_tasks;')
    db.exec('DROP TABLE IF EXISTS ticket_files;')
    db.exec('DROP TABLE IF EXISTS tickets;')
    db.exec('DROP TABLE IF EXISTS prompt_projects;')
    db.exec('DROP TABLE IF EXISTS chat_messages;')
    db.exec('DROP TABLE IF EXISTS chats;')
    db.exec('DROP TABLE IF EXISTS files;')
    db.exec('DROP TABLE IF EXISTS projects;')
    db.exec('DROP TABLE IF EXISTS prompts;')
    db.exec('DROP TABLE IF EXISTS provider_keys;')
    db.exec('DROP TABLE IF EXISTS file_changes;')

    // Recreate tables after dropping
    createTables(db)
    console.log('resetDatabase: In-memory test database reset successfully.')
  } catch (error) {
    console.error('resetDatabase: Error resetting the database.', error)
    throw error
  }
}
