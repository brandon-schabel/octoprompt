import { Database } from 'bun:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

export interface TableSchema {
  name: string
  indexes?: string[]
}

// Get platform-appropriate data directory
function getDataDirectory(): string {
  const platform = os.platform()
  const homeDir = os.homedir()

  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'OctoPrompt')
    case 'win32': // Windows
      return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'OctoPrompt')
    case 'linux': // Linux
      return path.join(process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share'), 'octoprompt')
    default:
      // Fallback to home directory
      return path.join(homeDir, '.octoprompt')
  }
}

export class DatabaseManager {
  private static instance: DatabaseManager | null = null
  private db: Database
  private lastGeneratedId: number = 0

  private readonly tables: TableSchema[] = [
    {
      name: 'provider_keys',
      indexes: ['created_at']
    },
    {
      name: 'chats',
      indexes: ['created_at', 'updated_at']
    },
    {
      name: 'chat_messages',
      indexes: ['JSON_EXTRACT(data, "$.chatId")', 'created_at']
    },
    {
      name: 'projects',
      indexes: ['created_at', 'updated_at']
    },
    {
      name: 'project_files',
      indexes: ['JSON_EXTRACT(data, "$.projectId")', 'created_at']
    },
    {
      name: 'prompts',
      indexes: ['created_at', 'updated_at']
    },
    {
      name: 'prompt_projects',
      indexes: ['JSON_EXTRACT(data, "$.promptId")', 'JSON_EXTRACT(data, "$.projectId")']
    },
    {
      name: 'mcp_server_configs',
      indexes: ['created_at']
    },
    {
      name: 'mcp_server_states',
      indexes: ['JSON_EXTRACT(data, "$.serverId")', 'updated_at']
    },
    {
      name: 'mcp_tools',
      indexes: ['JSON_EXTRACT(data, "$.serverId")', 'created_at']
    },
    {
      name: 'mcp_resources',
      indexes: ['JSON_EXTRACT(data, "$.serverId")', 'created_at']
    },
    {
      name: 'mcp_tool_executions',
      indexes: ['JSON_EXTRACT(data, "$.toolId")', 'created_at']
    },
    {
      name: 'tickets',
      indexes: ['JSON_EXTRACT(data, "$.projectId")', 'created_at', 'JSON_EXTRACT(data, "$.status")', 'updated_at']
    },
    {
      name: 'ticket_tasks',
      indexes: [
        'JSON_EXTRACT(data, "$.ticketId")',
        'JSON_EXTRACT(data, "$.orderIndex")',
        'created_at',
        'JSON_EXTRACT(data, "$.done")'
      ]
    },
    {
      name: 'selected_files',
      indexes: ['JSON_EXTRACT(data, "$.projectId")', 'JSON_EXTRACT(data, "$.tabId")', 'updated_at']
    }
  ]

  private constructor() {
    const isTest = process.env.NODE_ENV === 'test'

    if (isTest) {
      // Use in-memory database for tests
      this.db = new Database(':memory:')
      console.error('OctoPrompt database initialized in memory for testing')
    } else {
      // Use platform-appropriate data directory for production
      this.db = this.createProductionDatabase()
    }

    this.initializeDatabase()
  }

  private createProductionDatabase(): Database {
    const dataDir = getDataDirectory()
    const dbPath = path.join(dataDir, 'octoprompt.db')

    try {
      this.ensureDataDirectory(dbPath)
      const db = new Database(dbPath)
      console.error(`OctoPrompt database initialized at: ${dbPath}`)
      return db
    } catch (error) {
      console.error(`Failed to create database at ${dbPath}:`, error)

      // Fallback to current working directory
      const fallbackDir = path.join(process.cwd(), 'data')
      const fallbackDbPath = path.join(fallbackDir, 'octoprompt.db')

      try {
        this.ensureDataDirectory(fallbackDbPath)
        const db = new Database(fallbackDbPath)
        console.error(`Using fallback database path: ${fallbackDbPath}`)
        return db
      } catch (fallbackError) {
        console.error('Failed to create fallback database:', fallbackError)

        // Last resort: use temp directory
        const tempDir = os.tmpdir()
        const tempDbPath = path.join(tempDir, 'octoprompt', 'octoprompt.db')
        const tempDbDir = path.dirname(tempDbPath)

        try {
          if (!fs.existsSync(tempDbDir)) {
            fs.mkdirSync(tempDbDir, { recursive: true })
          }
          const db = new Database(tempDbPath)
          console.error(`Using temporary database path: ${tempDbPath}`)
          return db
        } catch (tempError) {
          console.error('Failed to create temp database:', tempError)
          throw new Error('Unable to create database in any location')
        }
      }
    }
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  private ensureDataDirectory(dbPath: string): void {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  // Get the current database path for debugging
  getDatabasePath(): string {
    if (process.env.NODE_ENV === 'test') {
      return ':memory:'
    }

    // Try to get the filename from the database if possible
    try {
      const result = this.db.prepare('PRAGMA database_list').get() as { file: string } | undefined
      return result?.file || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  private initializeDatabase(): void {
    // Enable performance optimizations
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.db.exec('PRAGMA cache_size = -64000') // 64MB cache
    this.db.exec('PRAGMA temp_store = MEMORY')
    this.db.exec('PRAGMA mmap_size = 268435456') // 256MB memory-mapped I/O

    // Create tables
    this.createTables()

    // Create indexes
    this.createIndexes()
  }

  private createTables(): void {
    for (const table of this.tables) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${table.name} (
          id TEXT PRIMARY KEY,
          data JSON NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)
    }
  }

  private createIndexes(): void {
    for (const table of this.tables) {
      if (table.indexes) {
        for (const indexField of table.indexes) {
          const indexName = this.getIndexName(table.name, indexField)
          const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table.name} (${indexField})`
          this.db.exec(sql)
        }
      }
    }
  }

  private getIndexName(tableName: string, indexField: string): string {
    // Clean up the index field for naming
    const cleanField = indexField.replace(/JSON_EXTRACT\(data, "\$\.(\w+)"\)/g, '$1').replace(/[^a-zA-Z0-9_]/g, '_')
    return `idx_${tableName}_${cleanField}`
  }

  private ensureTable(tableName: string): void {
    // Create table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  }

  // --- ID Generation ---

  generateUniqueId(tableName: string): number {
    this.ensureTable(tableName)

    try {
      // Get the maximum ID from the table
      const maxIdQuery = this.db.prepare(`
        SELECT MAX(CAST(id AS INTEGER)) as maxId 
        FROM ${tableName} 
        WHERE id NOT LIKE '%-%' AND id GLOB '[0-9]*'
      `)
      const result = maxIdQuery.get() as { maxId: number | null } | undefined
      const maxId = result?.maxId || 0

      // Generate new ID based on timestamp and max existing ID
      const timestamp = Date.now()
      let newId = Math.max(timestamp, maxId + 1, this.lastGeneratedId + 1)

      // Quick uniqueness check
      const checkQuery = this.db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ? LIMIT 1`)
      let attempts = 0
      const maxAttempts = 100

      while (attempts < maxAttempts && checkQuery.get(newId.toString())) {
        // Increment by 1-10 ms to avoid collisions but stay within valid range
        newId += Math.floor(Math.random() * 10) + 1
        attempts++
      }

      if (attempts >= maxAttempts) {
        // Fall back to adding random milliseconds
        newId = Date.now() + Math.floor(Math.random() * 1000)
      }

      this.lastGeneratedId = newId
      return newId
    } catch (error) {
      console.error(`Error generating ID for table ${tableName}:`, error)
      // Fallback: use timestamp with small random component
      const fallbackId = Date.now() + Math.floor(Math.random() * 100)
      this.lastGeneratedId = fallbackId
      return fallbackId
    }
  }

  generateBulkIds(tableName: string, count: number): number[] {
    this.ensureTable(tableName)

    try {
      const ids: number[] = []

      // Get the maximum ID from the table
      const maxIdQuery = this.db.prepare(`
        SELECT MAX(CAST(id AS INTEGER)) as maxId 
        FROM ${tableName} 
        WHERE id NOT LIKE '%-%' AND id GLOB '[0-9]*'
      `)
      const result = maxIdQuery.get() as { maxId: number | null } | undefined
      const maxId = result?.maxId || 0

      // Start from a safe point
      const timestamp = Date.now()
      let currentId = Math.max(timestamp, maxId + 1, this.lastGeneratedId + 1)

      const checkQuery = this.db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ? LIMIT 1`)

      for (let i = 0; i < count; i++) {
        // Add small increments to avoid collisions
        currentId += Math.floor(Math.random() * 10) + 1

        // Quick check for uniqueness
        let attempts = 0
        while (attempts < 50 && (checkQuery.get(currentId.toString()) || ids.includes(currentId))) {
          currentId += Math.floor(Math.random() * 5) + 1
          attempts++
        }

        if (attempts >= 50) {
          // Use a new base with offset
          currentId = Date.now() + i * 10 + Math.floor(Math.random() * 10)
        }

        ids.push(currentId)
      }

      this.lastGeneratedId = Math.max(...ids)
      return ids
    } catch (error) {
      console.error(`Error generating bulk IDs for table ${tableName}:`, error)
      // Fallback: generate simple sequential IDs
      const baseId = Date.now()
      return Array.from({ length: count }, (_, i) => baseId + i)
    }
  }

  // --- Public API ---

  getDatabase(): Database {
    return this.db
  }

  async get<T>(tableName: string, id: string): Promise<T | null> {
    this.ensureTable(tableName)
    const query = this.db.prepare(`SELECT data FROM ${tableName} WHERE id = ?`)
    const row = query.get(id) as { data: string } | undefined
    return row ? JSON.parse(row.data) : null
  }

  async getAll<T>(tableName: string): Promise<Map<string, T>> {
    this.ensureTable(tableName)
    const query = this.db.prepare(`SELECT id, data FROM ${tableName} ORDER BY created_at DESC`)
    const rows = query.all() as Array<{ id: string; data: string }>

    const map = new Map<string, T>()
    for (const row of rows) {
      map.set(row.id, JSON.parse(row.data))
    }
    return map
  }

  async create<T>(tableName: string, id: string, data: T): Promise<void> {
    this.ensureTable(tableName)
    const now = Date.now()

    // Extract timestamps from data if available
    const dataObj = data as any
    const createdAt = dataObj.created || now
    const updatedAt = dataObj.updated || dataObj.created || now

    const query = this.db.prepare(`
      INSERT INTO ${tableName} (id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `)
    query.run(id, JSON.stringify(data), createdAt, updatedAt)
  }

  async update<T>(tableName: string, id: string, data: T): Promise<boolean> {
    this.ensureTable(tableName)
    const now = Date.now()

    // Extract updated timestamp from data if available
    const dataObj = data as any
    const updatedAt = dataObj.updated || now

    const query = this.db.prepare(`
      UPDATE ${tableName}
      SET data = ?, updated_at = ?
      WHERE id = ?
    `)
    const result = query.run(JSON.stringify(data), updatedAt, id)
    return result.changes > 0
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    this.ensureTable(tableName)
    const query = this.db.prepare(`DELETE FROM ${tableName} WHERE id = ?`)
    const result = query.run(id)
    return result.changes > 0
  }

  async exists(tableName: string, id: string): Promise<boolean> {
    this.ensureTable(tableName)
    const query = this.db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ? LIMIT 1`)
    const row = query.get(id)
    return row != null // Use != to check for both null and undefined
  }

  async clear(tableName: string): Promise<void> {
    this.ensureTable(tableName)
    this.db.exec(`DELETE FROM ${tableName}`)
  }

  // --- Utility Methods ---

  async findByJsonField<T>(tableName: string, jsonPath: string, value: any): Promise<T[]> {
    this.ensureTable(tableName)
    const query = this.db.prepare(`
      SELECT data FROM ${tableName}
      WHERE JSON_EXTRACT(data, ?) = ?
      ORDER BY created_at DESC
    `)
    const rows = query.all(jsonPath, value) as Array<{ data: string }>
    return rows.map((row) => JSON.parse(row.data))
  }

  async findByDateRange<T>(tableName: string, startTime: number, endTime: number): Promise<T[]> {
    this.ensureTable(tableName)
    const query = this.db.prepare(`
      SELECT data FROM ${tableName}
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `)
    const rows = query.all(startTime, endTime) as Array<{ data: string }>
    return rows.map((row) => JSON.parse(row.data))
  }

  async countByJsonField(tableName: string, jsonPath: string, value: any): Promise<number> {
    this.ensureTable(tableName)
    const query = this.db.prepare(`
      SELECT COUNT(*) as count FROM ${tableName}
      WHERE JSON_EXTRACT(data, ?) = ?
    `)
    const row = query.get(jsonPath, value) as { count: number }
    return row.count
  }

  // --- Migration Support ---

  async runMigration(migration: {
    version: number
    up: (db: Database) => void
    down?: (db: Database) => void
  }): Promise<void> {
    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `)

    // Check if migration has been applied
    const query = this.db.prepare('SELECT 1 FROM migrations WHERE version = ?')
    const applied = query.get(migration.version)

    if (!applied) {
      // Run migration in a transaction
      this.db.transaction(() => {
        migration.up(this.db)
        const insertQuery = this.db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)')
        insertQuery.run(migration.version, Date.now())
      })()
    }
  }

  async getMigrationStatus(): Promise<number[]> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `)

    const query = this.db.prepare('SELECT version FROM migrations ORDER BY version')
    const rows = query.all() as Array<{ version: number }>
    return rows.map((row) => row.version)
  }

  // --- Transaction Support ---

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  // --- Cleanup ---

  close(): void {
    if (this.db) {
      this.db.close()
    }
    DatabaseManager.instance = null
  }

  static reset(): void {
    if (DatabaseManager.instance) {
      // In test mode, just clear tables instead of closing the database
      if (process.env.NODE_ENV === 'test') {
        // Don't actually reset the instance in test mode
        // This prevents issues when tests run in parallel
        return
      }
      DatabaseManager.instance.close()
    }
    DatabaseManager.instance = null
  }

  // Clear all data from all tables (useful for tests)
  async clearAllTables(): Promise<void> {
    const transaction = this.db.transaction(() => {
      for (const table of this.tables) {
        this.db.exec(`DELETE FROM ${table.name}`)
      }
      // Reset the last generated ID
      this.lastGeneratedId = 0
    })
    transaction()
  }

  // --- Development Utilities ---

  async vacuum(): Promise<void> {
    this.db.exec('VACUUM')
  }

  async analyze(): Promise<void> {
    this.db.exec('ANALYZE')
  }

  getStats(): {
    pageCount: number
    pageSize: number
    cacheHits: number
    cacheMisses: number
  } {
    const pageCount = this.db.prepare('PRAGMA page_count').get() as { page_count: number }
    const pageSize = this.db.prepare('PRAGMA page_size').get() as { page_size: number }
    const cacheStats = this.db.prepare('PRAGMA cache_stats').all() as Array<{
      cache_hits: number
      cache_misses: number
    }>

    return {
      pageCount: pageCount.page_count,
      pageSize: pageSize.page_size,
      cacheHits: cacheStats[0]?.cache_hits || 0,
      cacheMisses: cacheStats[0]?.cache_misses || 0
    }
  }
}

// Export singleton instance getter
export const getDb = () => DatabaseManager.getInstance()
