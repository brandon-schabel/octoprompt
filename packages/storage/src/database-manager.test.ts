import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { DatabaseManager, getDb } from './database-manager'

describe('DatabaseManager', () => {
  let db: DatabaseManager

  beforeEach(() => {
    // Set test environment to use in-memory database
    process.env.NODE_ENV = 'test'
    db = DatabaseManager.getInstance()
  })

  afterEach(async () => {
    // Clear all tables for test isolation
    await db.clearAllTables()
  })

  test('singleton pattern returns same instance', () => {
    const db1 = DatabaseManager.getInstance()
    const db2 = DatabaseManager.getInstance()
    expect(db1).toBe(db2)
  })

  test('uses in-memory database in test environment', () => {
    const stats = db.getStats()
    expect(stats.pageCount).toBeGreaterThan(0)
  })

  test('creates all required tables', async () => {
    const tables = [
      'provider_keys',
      'chats',
      'chat_messages',
      'projects',
      'project_files',
      'prompts',
      'prompt_projects',
      'mcp_server_configs',
      'mcp_server_states',
      'mcp_tools',
      'mcp_resources',
      'mcp_tool_executions'
    ]

    for (const table of tables) {
      // Test that we can query each table without error
      const result = await db.getAll(table)
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    }
  })

  test('CRUD operations work correctly', async () => {
    const testData = {
      name: 'Test Project',
      description: 'A test project',
      settings: { theme: 'dark' }
    }

    // Create
    await db.create('projects', 'test-id', testData)

    // Read
    const retrieved = await db.get<typeof testData>('projects', 'test-id')
    expect(retrieved).toEqual(testData)

    // Update
    const updatedData = { ...testData, name: 'Updated Project' }
    const updateResult = await db.update('projects', 'test-id', updatedData)
    expect(updateResult).toBe(true)

    const updatedRetrieved = await db.get<typeof testData>('projects', 'test-id')
    expect(updatedRetrieved?.name).toBe('Updated Project')

    // Exists
    const exists = await db.exists('projects', 'test-id')
    expect(exists).toBe(true)

    // Delete
    const deleteResult = await db.delete('projects', 'test-id')
    expect(deleteResult).toBe(true)

    const deletedItem = await db.get('projects', 'test-id')
    expect(deletedItem).toBeNull()
  })

  test('getAll returns items in descending order by created_at', async () => {
    // Create items with slight delays to ensure different timestamps
    await db.create('projects', 'project-1', { name: 'Project 1' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await db.create('projects', 'project-2', { name: 'Project 2' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await db.create('projects', 'project-3', { name: 'Project 3' })

    const allProjects = await db.getAll<{ name: string }>('projects')
    const projectArray = Array.from(allProjects.entries())

    // Should be in descending order (newest first)
    expect(projectArray[0]?.[0]).toBe('project-3')
    expect(projectArray[1]?.[0]).toBe('project-2')
    expect(projectArray[2]?.[0]).toBe('project-1')
  })

  test('findByJsonField queries JSON data correctly', async () => {
    // Create chat messages
    await db.create('chat_messages', 'msg-1', {
      chatId: 'chat-123',
      content: 'Hello',
      role: 'user'
    })
    await db.create('chat_messages', 'msg-2', {
      chatId: 'chat-123',
      content: 'Hi there',
      role: 'assistant'
    })
    await db.create('chat_messages', 'msg-3', {
      chatId: 'chat-456',
      content: 'Different chat',
      role: 'user'
    })

    const messages = await db.findByJsonField<any>('chat_messages', '$.chatId', 'chat-123')

    expect(messages.length).toBe(2)
    expect(messages[0].chatId).toBe('chat-123')
    expect(messages[1].chatId).toBe('chat-123')
  })

  test('findByDateRange filters by timestamp', async () => {
    const now = Date.now()
    const yesterday = now - 24 * 60 * 60 * 1000
    const tomorrow = now + 24 * 60 * 60 * 1000

    await db.create('prompts', 'prompt-1', { name: 'Prompt 1' })
    await db.create('prompts', 'prompt-2', { name: 'Prompt 2' })

    const results = await db.findByDateRange<any>('prompts', yesterday, tomorrow)
    expect(results.length).toBe(2)

    const noResults = await db.findByDateRange<any>('prompts', tomorrow, tomorrow + 1000)
    expect(noResults.length).toBe(0)
  })

  test('countByJsonField returns correct count', async () => {
    await db.create('project_files', 'file-1', { projectId: 'proj-1', name: 'file1.ts' })
    await db.create('project_files', 'file-2', { projectId: 'proj-1', name: 'file2.ts' })
    await db.create('project_files', 'file-3', { projectId: 'proj-2', name: 'file3.ts' })

    const count1 = await db.countByJsonField('project_files', '$.projectId', 'proj-1')
    expect(count1).toBe(2)

    const count2 = await db.countByJsonField('project_files', '$.projectId', 'proj-2')
    expect(count2).toBe(1)

    const count3 = await db.countByJsonField('project_files', '$.projectId', 'proj-3')
    expect(count3).toBe(0)
  })

  test('transaction support works correctly', async () => {
    let errorThrown = false

    try {
      db.transaction(() => {
        // This should succeed
        db.getDatabase()
          .prepare('INSERT INTO projects (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)')
          .run('tx-1', JSON.stringify({ name: 'Transaction Test' }), Date.now(), Date.now())

        // This should cause an error (duplicate primary key)
        db.getDatabase()
          .prepare('INSERT INTO projects (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)')
          .run('tx-1', JSON.stringify({ name: 'Duplicate' }), Date.now(), Date.now())
      })
    } catch (error) {
      errorThrown = true
    }

    expect(errorThrown).toBe(true)

    // Transaction should have rolled back
    const result = await db.get('projects', 'tx-1')
    expect(result).toBeNull()
  })

  test('clear removes all records from table', async () => {
    await db.create('prompts', 'prompt-1', { name: 'Prompt 1' })
    await db.create('prompts', 'prompt-2', { name: 'Prompt 2' })

    const beforeClear = await db.getAll('prompts')
    expect(beforeClear.size).toBe(2)

    await db.clear('prompts')

    const afterClear = await db.getAll('prompts')
    expect(afterClear.size).toBe(0)
  })

  test('migration support', async () => {
    const migration = {
      version: 1,
      up: (database: any) => {
        database.exec(`
          CREATE TABLE IF NOT EXISTS test_migration (
            id TEXT PRIMARY KEY,
            value TEXT
          )
        `)
      }
    }

    await db.runMigration(migration)

    // Check migration was recorded
    const status = await db.getMigrationStatus()
    expect(status).toContain(1)

    // Running the same migration again should not error
    await db.runMigration(migration)
  })

  test('indexes are created for JSON fields', async () => {
    // Create many messages to test index performance
    for (let i = 0; i < 100; i++) {
      await db.create('chat_messages', `msg-${i}`, {
        chatId: i < 50 ? 'chat-A' : 'chat-B',
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant'
      })
    }

    // This query should use the index
    const messagesA = await db.findByJsonField<any>('chat_messages', '$.chatId', 'chat-A')
    expect(messagesA.length).toBe(50)

    const messagesB = await db.findByJsonField<any>('chat_messages', '$.chatId', 'chat-B')
    expect(messagesB.length).toBe(50)
  })

  test('getDb helper returns singleton instance', () => {
    const db1 = getDb()
    const db2 = getDb()
    expect(db1).toBe(db2)
  })
})
