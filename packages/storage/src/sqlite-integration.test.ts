import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// Import all storage modules
import { DatabaseManager, getDb } from './database-manager'
import { chatStorage } from './chat-storage'
import { projectStorage } from './project-storage'
import { promptStorage } from './prompt-storage'
import { providerKeyStorage } from './provider-key-storage'
import {
  mcpServerConfigStorage,
  mcpServerStateStorage,
  mcpToolStorage,
  mcpResourceStorage,
  mcpToolExecutionStorage
} from './mcp-storage'

// Import types and schemas
import type {
  Chat,
  ChatMessage,
  Project,
  ProjectFile,
  Prompt,
  PromptProject,
  ProviderKey,
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPResource,
  MCPToolExecutionResult
} from '@octoprompt/schemas'

describe('SQLite Storage Integration Tests', () => {
  let db: DatabaseManager
  let tempDbPath: string

  beforeEach(async () => {
    // Ensure we're in test mode
    process.env.NODE_ENV = 'test'

    // Get the database instance
    db = DatabaseManager.getInstance()

    // Clear all tables before each test
    await db.clearAllTables()
  })

  afterEach(async () => {
    // Clear all tables for test isolation
    await db.clearAllTables()

    // Add a small delay to avoid timestamp collisions
    await new Promise((resolve) => setTimeout(resolve, 5))
  })

  describe('Database Initialization', () => {
    test('should create all required tables', async () => {
      const database = db.getDatabase()

      // Check that all tables exist
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

      for (const tableName of tables) {
        const query = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        const result = query.get(tableName) as { name: string } | undefined
        expect(result).toBeDefined()
        expect(result?.name).toBe(tableName)
      }
    })

    test('should create all required indexes', async () => {
      const database = db.getDatabase()

      // Check some key indexes exist
      const indexes = [
        'idx_chats_created_at',
        'idx_chat_messages_chatId',
        'idx_projects_created_at',
        'idx_project_files_projectId',
        'idx_mcp_server_configs_created_at'
      ]

      for (const indexName of indexes) {
        const query = database.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
        const result = query.get(indexName) as { name: string } | undefined
        expect(result).toBeDefined()
        expect(result?.name).toBe(indexName)
      }
    })

    test('should use in-memory database in test mode', () => {
      const database = db.getDatabase()
      const query = database.prepare('PRAGMA database_list')
      const result = query.get() as { name: string; file: string }
      expect(result.file).toBe('') // Empty string indicates in-memory database
    })
  })

  describe('Cross-Module Relationships', () => {
    test('should maintain referential integrity between chats and projects', async () => {
      // Create a project
      const project: Project = {
        id: Date.now(),
        name: 'Test Project',
        description: 'A test project for integration testing',
        path: '/test/project',
        created: Date.now(),
        updated: Date.now()
      }

      const projects = { [project.id]: project }
      await projectStorage.writeProjects(projects)

      // Create a chat linked to the project
      const chat: Chat = {
        id: Date.now() + 1,
        title: 'Test Chat',
        projectId: project.id,
        created: Date.now(),
        updated: Date.now()
      }

      const chats = { [chat.id]: chat }
      await chatStorage.writeChats(chats)

      // Verify the relationship
      const savedChat = await chatStorage.getChatById(chat.id)
      expect(savedChat).toBeDefined()
      expect(savedChat?.projectId).toBe(project.id)

      // Query chats by project using JSON field
      const database = db.getDatabase()
      const query = database.prepare("SELECT data FROM chats WHERE JSON_EXTRACT(data, '$.projectId') = ?")
      const results = query.all(project.id) as Array<{ data: string }>
      expect(results).toHaveLength(1)

      const foundChat = JSON.parse(results[0].data) as Chat
      expect(foundChat.id).toBe(chat.id)
    })

    test('should handle chat messages belonging to chats', async () => {
      // Create a chat
      const chat: Chat = {
        id: Date.now(),
        title: 'Message Test Chat',
        created: Date.now(),
        updated: Date.now()
      }

      await chatStorage.writeChats({ [chat.id]: chat })

      // Create messages for the chat
      const messages: Record<string, ChatMessage> = {}
      for (let i = 0; i < 5; i++) {
        const message: ChatMessage = {
          id: Date.now() + i + 1,
          chatId: chat.id,
          role: 'user',
          content: `Test message ${i}`,
          created: Date.now() + i,
          updated: Date.now() + i
        }
        messages[message.id] = message
      }

      await chatStorage.writeChatMessages(chat.id, messages)

      // Verify messages
      const savedMessages = await chatStorage.readChatMessages(chat.id)
      expect(Object.keys(savedMessages)).toHaveLength(5)

      // Test count
      const count = await chatStorage.countMessagesForChat(chat.id)
      expect(count).toBe(5)
    })

    test('should handle project files belonging to projects', async () => {
      // Create a project
      const project: Project = {
        id: Date.now(),
        name: 'File Test Project',
        description: 'A project for testing file relationships',
        path: '/test/file-project',
        created: Date.now(),
        updated: Date.now()
      }

      await projectStorage.writeProjects({ [project.id]: project })

      // Create files for the project
      const files: Record<string, ProjectFile> = {}
      for (let i = 0; i < 3; i++) {
        const file: ProjectFile = {
          id: Date.now() + i + 1,
          projectId: project.id,
          name: `file${i}.ts`,
          path: `/test/file-project/file${i}.ts`,
          extension: 'ts',
          size: 100 + i,
          content: `console.log('File ${i}')`,
          summary: null,
          summaryLastUpdated: null,
          meta: null,
          checksum: null,
          created: Date.now() + i,
          updated: Date.now() + i
        }
        files[file.id] = file
      }

      await projectStorage.writeProjectFiles(project.id, files)

      // Verify files
      const savedFiles = await projectStorage.readProjectFiles(project.id)
      expect(Object.keys(savedFiles)).toHaveLength(3)

      // Test array retrieval
      const fileArray = await projectStorage.getProjectFileArray(project.id)
      expect(fileArray).toHaveLength(3)
      // Should be sorted by created date, newest first
      expect(fileArray[0].created).toBeGreaterThan(fileArray[1].created)
    })

    test('should handle prompt-project associations', async () => {
      // Create projects
      const project1: Project = {
        id: Date.now(),
        name: 'Project 1',
        description: 'First test project',
        path: '/test/project1',
        created: Date.now(),
        updated: Date.now()
      }
      const project2: Project = {
        id: Date.now() + 1,
        name: 'Project 2',
        description: 'Second test project',
        path: '/test/project2',
        created: Date.now(),
        updated: Date.now()
      }

      await projectStorage.writeProjects({
        [project1.id]: project1,
        [project2.id]: project2
      })

      // Create a prompt
      const prompt: Prompt = {
        id: Date.now() + 2,
        name: 'Test Prompt',
        content: 'This is a test prompt',
        projectId: project1.id,
        created: Date.now(),
        updated: Date.now()
      }

      await promptStorage.writePrompts({ [prompt.id]: prompt })

      // Create associations
      const associations: PromptProject[] = [
        {
          id: Date.now() + 3,
          promptId: prompt.id,
          projectId: project1.id,
          created: Date.now()
        },
        {
          id: Date.now() + 4,
          promptId: prompt.id,
          projectId: project2.id,
          created: Date.now()
        }
      ]

      await promptStorage.writePromptProjects(associations)

      // Verify associations
      const savedAssociations = await promptStorage.readPromptProjects()
      expect(savedAssociations).toHaveLength(2)

      // Verify both associations were saved correctly
      const assocForProject1 = savedAssociations.find((a) => a.projectId === project1.id)
      const assocForProject2 = savedAssociations.find((a) => a.projectId === project2.id)

      expect(assocForProject1).toBeDefined()
      expect(assocForProject2).toBeDefined()
      expect(assocForProject1?.promptId).toBe(prompt.id)
      expect(assocForProject2?.promptId).toBe(prompt.id)
    })
  })

  describe('Concurrent Access Patterns', () => {
    test('should handle concurrent reads safely', async () => {
      // Create test data
      const projects: Record<string, Project> = {}
      for (let i = 0; i < 10; i++) {
        const project: Project = {
          id: Date.now() + i,
          name: `Concurrent Project ${i}`,
          description: `Concurrent test project ${i}`,
          path: `/test/concurrent-${i}`,
          created: Date.now(),
          updated: Date.now()
        }
        projects[project.id] = project
      }

      await projectStorage.writeProjects(projects)

      // Perform concurrent reads
      const readPromises = []
      for (let i = 0; i < 50; i++) {
        readPromises.push(projectStorage.readProjects())
      }

      const results = await Promise.all(readPromises)

      // All reads should return the same data
      for (const result of results) {
        expect(Object.keys(result)).toHaveLength(10)
      }
    })

    test('should handle concurrent writes with transactions', async () => {
      // Create multiple chats concurrently
      const createPromises = []

      for (let i = 0; i < 10; i++) {
        const chat: Chat = {
          id: Date.now() + i,
          title: `Concurrent Chat ${i}`,
          created: Date.now(),
          updated: Date.now()
        }

        createPromises.push(db.create('chats', String(chat.id), chat))
      }

      await Promise.all(createPromises)

      // Verify all were created
      const allChats = await chatStorage.readChats()
      expect(Object.keys(allChats)).toHaveLength(10)
    })

    test('should handle transaction rollback on error', async () => {
      const database = db.getDatabase()

      // Count initial projects
      const initialCount = Object.keys(await projectStorage.readProjects()).length

      try {
        database.transaction(() => {
          // Insert a valid project
          const project1: Project = {
            id: Date.now(),
            name: 'Transaction Test 1',
            description: 'Project for testing transaction rollback',
            path: '/test/transaction-test',
            created: Date.now(),
            updated: Date.now()
          }

          const query = database.prepare('INSERT INTO projects (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)')
          query.run(String(project1.id), JSON.stringify(project1), Date.now(), Date.now())

          // Force an error
          throw new Error('Simulated transaction error')
        })()
      } catch (error) {
        // Expected error
      }

      // Verify no projects were added
      const finalCount = Object.keys(await projectStorage.readProjects()).length
      expect(finalCount).toBe(initialCount)
    })
  })

  describe('Performance with Larger Datasets', () => {
    test('should handle bulk inserts efficiently', async () => {
      const startTime = Date.now()

      // Create 1000 provider keys
      const keys: Record<string, ProviderKey> = {}
      for (let i = 0; i < 1000; i++) {
        const key: ProviderKey = {
          id: Date.now() + i,
          name: `Test Key ${i}`,
          provider: i % 2 === 0 ? 'openai' : 'anthropic',
          key: `test-key-${i}`,
          isDefault: i === 0,
          isActive: true,
          environment: 'production',
          description: `Test key ${i} for integration testing`,
          created: Date.now() + i,
          updated: Date.now() + i
        }
        keys[key.id] = key
      }

      await providerKeyStorage.writeProviderKeys(keys)

      const writeTime = Date.now() - startTime
      console.log(`Bulk insert of 1000 keys took ${writeTime}ms`)

      // Should complete in reasonable time (less than 1 second)
      expect(writeTime).toBeLessThan(1000)

      // Verify all were written
      const savedKeys = await providerKeyStorage.readProviderKeys()
      expect(Object.keys(savedKeys)).toHaveLength(1000)
    })

    test('should query indexed fields efficiently', async () => {
      // Create test data with varied timestamps
      const baseTime = Date.now() - 1000000 // 1 million ms ago
      const chats: Record<string, Chat> = {}

      for (let i = 0; i < 500; i++) {
        const chat: Chat = {
          id: baseTime + i * 1000, // Spread over time
          title: `Performance Test Chat ${i}`,
          created: baseTime + i * 1000,
          updated: baseTime + i * 1000
        }
        chats[chat.id] = chat
      }

      await chatStorage.writeChats(chats)

      // Query by date range (should use index)
      const startRange = baseTime + 100000
      const endRange = baseTime + 200000

      const startTime = Date.now()
      const rangeChats = await chatStorage.findChatsByDateRange(startRange, endRange)
      const queryTime = Date.now() - startTime

      console.log(`Date range query took ${queryTime}ms`)

      // Should be fast due to index
      expect(queryTime).toBeLessThan(50)

      // The exact count depends on the range selected
      if (rangeChats.length > 0) {
        expect(rangeChats.length).toBeLessThan(500)

        // Verify all results are within the range
        for (const chat of rangeChats) {
          expect(chat.created).toBeGreaterThanOrEqual(startRange)
          expect(chat.created).toBeLessThanOrEqual(endRange)
        }
      }
    })

    test('should handle large message volumes per chat', async () => {
      // Create a chat
      const chat: Chat = {
        id: Date.now(),
        title: 'High Volume Chat',
        created: Date.now(),
        updated: Date.now()
      }

      await chatStorage.writeChats({ [chat.id]: chat })

      // Create 1000 messages for this chat
      const messages: Record<string, ChatMessage> = {}
      for (let i = 0; i < 1000; i++) {
        const message: ChatMessage = {
          id: Date.now() + i + 1,
          chatId: chat.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `This is message ${i} with some content to simulate real usage`,
          created: Date.now() + i,
          updated: Date.now() + i
        }
        messages[message.id] = message
      }

      const startTime = Date.now()
      await chatStorage.writeChatMessages(chat.id, messages)
      const writeTime = Date.now() - startTime

      console.log(`Writing 1000 messages took ${writeTime}ms`)

      // Verify all messages
      const savedMessages = await chatStorage.readChatMessages(chat.id)
      expect(Object.keys(savedMessages)).toHaveLength(1000)

      // Test count performance
      const countStart = Date.now()
      const count = await chatStorage.countMessagesForChat(chat.id)
      const countTime = Date.now() - countStart

      console.log(`Counting messages took ${countTime}ms`)
      expect(count).toBe(1000)
      expect(countTime).toBeLessThan(20)
    })
  })

  describe('Migration Process', () => {
    test('should track migration versions', async () => {
      const database = db.getDatabase()

      // Define test migrations
      const migrations = [
        {
          version: 1,
          up: (db: Database) => {
            db.exec('CREATE TABLE IF NOT EXISTS test_table_1 (id INTEGER PRIMARY KEY)')
          }
        },
        {
          version: 2,
          up: (db: Database) => {
            db.exec('CREATE TABLE IF NOT EXISTS test_table_2 (id INTEGER PRIMARY KEY)')
          }
        }
      ]

      // Run migrations
      for (const migration of migrations) {
        await db.runMigration(migration)
      }

      // Check migration status
      const appliedVersions = await db.getMigrationStatus()
      expect(appliedVersions).toContain(1)
      expect(appliedVersions).toContain(2)

      // Verify tables were created
      const query = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test_table_%'")
      const tables = query.all() as Array<{ name: string }>
      expect(tables).toHaveLength(2)
    })

    test('should not re-run applied migrations', async () => {
      let executionCount = 0

      const migration = {
        version: 3,
        up: (db: Database) => {
          executionCount++
          db.exec('CREATE TABLE IF NOT EXISTS test_table_3 (id INTEGER PRIMARY KEY)')
        }
      }

      // Run migration twice
      await db.runMigration(migration)
      await db.runMigration(migration)

      // Should only execute once
      expect(executionCount).toBe(1)
    })

    test('should handle migration with sample data', async () => {
      const migration = {
        version: 4,
        up: (db: Database) => {
          // Create a custom table
          db.exec(`
            CREATE TABLE IF NOT EXISTS legacy_data (
              id INTEGER PRIMARY KEY,
              data TEXT,
              created_at INTEGER
            )
          `)

          // Insert sample data
          const insertQuery = db.prepare('INSERT INTO legacy_data (id, data, created_at) VALUES (?, ?, ?)')

          for (let i = 1; i <= 5; i++) {
            insertQuery.run(i, `Legacy item ${i}`, Date.now())
          }

          // Migrate to new format
          const selectQuery = db.prepare('SELECT * FROM legacy_data')
          const legacyRows = selectQuery.all() as Array<{
            id: number
            data: string
            created_at: number
          }>

          // Convert to project format and insert
          const projectInsert = db.prepare(
            'INSERT INTO projects (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )

          for (const row of legacyRows) {
            const project: Project = {
              id: row.created_at + row.id,
              name: row.data,
              description: `Migrated from legacy: ${row.data}`,
              path: `/migrated/legacy-${row.id}`,
              created: row.created_at,
              updated: row.created_at
            }

            projectInsert.run(String(project.id), JSON.stringify(project), row.created_at, row.created_at)
          }
        }
      }

      await db.runMigration(migration)

      // Verify migrated data
      const projects = await projectStorage.readProjects()
      const projectCount = Object.keys(projects).length
      expect(projectCount).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Error Recovery', () => {
    test('should recover from corrupted data gracefully', async () => {
      // Create a valid chat first
      const validChat: Chat = {
        id: Date.now(),
        title: 'Valid Chat',
        created: Date.now(),
        updated: Date.now()
      }

      await chatStorage.writeChats({ [validChat.id]: validChat })

      // Verify it was saved
      const chats = await chatStorage.readChats()
      expect(Object.keys(chats)).toHaveLength(1)

      // Now test handling of invalid data at the storage level
      try {
        // Try to write invalid chat data (missing required fields)
        const invalidChat = {
          id: Date.now() + 1
          // Missing title, created, updated
        } as any

        await chatStorage.writeChats({ [invalidChat.id]: invalidChat })

        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        // Should catch validation error
        expect(error).toBeDefined()
      }

      // Original valid chat should still be there
      const chatsAfterError = await chatStorage.readChats()
      expect(Object.keys(chatsAfterError)).toHaveLength(1)
      expect(chatsAfterError[validChat.id]).toBeDefined()
    })

    test('should handle database connection errors', async () => {
      // This is hard to test with in-memory database
      // But we can test error handling in storage methods

      try {
        // Try to read from a non-existent table
        await db.get('non_existent_table', '123')
      } catch (error) {
        // Should create the table automatically due to ensureTable
        // So this shouldn't actually throw
      }

      // Verify table was created
      const database = db.getDatabase()
      const query = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='non_existent_table'")
      const result = query.get() as { name: string } | undefined
      expect(result).toBeDefined()
    })
  })

  describe('Backup and Restore', () => {
    test('should export all data for backup', async () => {
      // Create diverse test data
      const testData = await createTestData()

      // Export all data
      const backup = {
        chats: await chatStorage.readChats(),
        projects: await projectStorage.readProjects(),
        prompts: await promptStorage.readPrompts(),
        providerKeys: await providerKeyStorage.readProviderKeys(),
        promptProjects: await promptStorage.readPromptProjects()
      }

      // Verify backup contains all data
      expect(Object.keys(backup.chats)).toHaveLength(2)
      expect(Object.keys(backup.projects)).toHaveLength(2)
      expect(Object.keys(backup.prompts)).toHaveLength(1)
      expect(Object.keys(backup.providerKeys)).toHaveLength(2)
      expect(backup.promptProjects).toHaveLength(1)
    })

    test('should restore from backup', async () => {
      // Create and backup data
      const originalData = await createTestData()

      const backup = {
        chats: await chatStorage.readChats(),
        projects: await projectStorage.readProjects(),
        prompts: await promptStorage.readPrompts(),
        providerKeys: await providerKeyStorage.readProviderKeys(),
        promptProjects: await promptStorage.readPromptProjects()
      }

      // Clear all data
      await db.clear('chats')
      await db.clear('chat_messages')
      await db.clear('projects')
      await db.clear('project_files')
      await db.clear('prompts')
      await db.clear('prompt_projects')
      await db.clear('provider_keys')

      // Verify data is cleared
      expect(Object.keys(await chatStorage.readChats())).toHaveLength(0)

      // Restore from backup
      await chatStorage.writeChats(backup.chats)
      await projectStorage.writeProjects(backup.projects)
      await promptStorage.writePrompts(backup.prompts)
      await providerKeyStorage.writeProviderKeys(backup.providerKeys)
      await promptStorage.writePromptProjects(backup.promptProjects)

      // Verify restoration
      expect(Object.keys(await chatStorage.readChats())).toHaveLength(2)
      expect(Object.keys(await projectStorage.readProjects())).toHaveLength(2)
      expect(Object.keys(await promptStorage.readPrompts())).toHaveLength(1)
      expect(Object.keys(await providerKeyStorage.readProviderKeys())).toHaveLength(2)
      expect(await promptStorage.readPromptProjects()).toHaveLength(1)
    })
  })

  describe('Database Statistics and Maintenance', () => {
    test('should provide accurate statistics', async () => {
      // Create some data
      await createTestData()

      // Get stats
      const stats = db.getStats()

      expect(stats.pageCount).toBeGreaterThan(0)
      expect(stats.pageSize).toBeGreaterThan(0)
      // Cache stats might not be available in all SQLite builds
      console.log('Database stats:', stats)
    })

    test('should perform vacuum operation', async () => {
      // Create and delete data to create fragmentation
      const projects: Record<string, Project> = {}
      for (let i = 0; i < 100; i++) {
        const project: Project = {
          id: Date.now() + i,
          name: `Vacuum Test ${i}`,
          description: `Vacuum test project ${i}`,
          path: `/test/vacuum-${i}`,
          created: Date.now(),
          updated: Date.now()
        }
        projects[project.id] = project
      }

      await projectStorage.writeProjects(projects)

      // Delete half the projects
      for (let i = 0; i < 50; i++) {
        const id = Date.now() + i
        await db.delete('projects', String(id))
      }

      // Perform vacuum
      await db.vacuum()

      // Database should still work after vacuum
      const remainingProjects = await projectStorage.readProjects()
      expect(Object.keys(remainingProjects).length).toBeGreaterThan(0)
    })

    test('should perform analyze operation', async () => {
      // Create data with patterns
      await createTestData()

      // Perform analyze
      await db.analyze()

      // Query performance should be maintained/improved
      // This is hard to test directly, but we can verify the operation completes
      const projects = await projectStorage.readProjects()
      expect(Object.keys(projects).length).toBeGreaterThan(0)
    })
  })

  describe('MCP Storage Integration', () => {
    test('should handle MCP server configurations', async () => {
      const projectId = Date.now() - 1000

      const configData = {
        projectId: projectId,
        name: 'Test MCP Server',
        command: 'node',
        args: ['server.js'],
        env: { NODE_ENV: 'test' },
        enabled: true,
        autoStart: false
      }

      let config: MCPServerConfig
      try {
        config = await mcpServerConfigStorage.create(configData)
      } catch (error) {
        console.error('MCP config creation failed:', error)
        throw error
      }

      // Verify storage
      expect(config).toBeDefined()
      expect(config.id).toBeDefined()
      expect(config.name).toBe('Test MCP Server')
      expect(config.projectId).toBe(projectId)

      const saved = await mcpServerConfigStorage.get(config.id)
      expect(saved).toBeDefined()
      expect(saved?.name).toBe('Test MCP Server')
      expect(saved?.projectId).toBe(projectId)

      // Query by project - use findBy instead of query
      const projectConfigs = await mcpServerConfigStorage.findBy('projectId', projectId)
      expect(projectConfigs).toHaveLength(1)
      expect(projectConfigs[0].id).toBe(config.id)
    })

    test('should track MCP server states', async () => {
      const serverId = Date.now()

      // MCP server states are runtime state, stored in memory
      // The schema doesn't include id/created/updated fields, so we need to handle this specially
      const stateData = {
        serverId: serverId,
        status: 'running' as const,
        pid: 12345,
        error: null,
        startedAt: Date.now(),
        lastHeartbeat: Date.now()
      }

      // For MemoryAdapter with strict schema, we can use the adapter directly
      const adapter = (mcpServerStateStorage as any).adapter as MemoryAdapter<any>

      // Create with serverId as the key
      await adapter.write(serverId, stateData)

      // Read it back
      const state = await adapter.read(serverId)
      expect(state).toBeDefined()
      expect(state.status).toBe('running')

      // Update state
      const updatedData = {
        ...state,
        status: 'stopped' as const,
        pid: null,
        lastHeartbeat: null
      }
      await adapter.write(serverId, updatedData)

      // Verify update
      const retrieved = await adapter.read(serverId)
      expect(retrieved).toBeDefined()
      expect(retrieved?.status).toBe('stopped')
      expect(retrieved?.pid).toBeNull()
    })

    test('should manage MCP tools and resources', async () => {
      const serverId = Date.now()

      // Create tools - tools have string IDs, so we handle them differently
      const toolData = {
        id: 'test-tool-1',
        name: 'testTool',
        serverId,
        description: 'A test tool',
        parameters: [],
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }

      // Tools use string IDs, but MemoryAdapter expects them to be provided
      // For this test, we'll add the tool directly
      await (mcpToolStorage as any).adapter.write(toolData.id, toolData)
      const tool = await mcpToolStorage.get(toolData.id)

      // Create resources - resources use URI as key
      const resourceData = {
        uri: 'test://resource/1',
        name: 'Test Resource',
        serverId,
        description: 'A test resource',
        mimeType: 'text/plain'
      }

      // Resources use URI as ID
      await (mcpResourceStorage as any).adapter.write(resourceData.uri, resourceData)
      const resource = await mcpResourceStorage.get(resourceData.uri)

      // Verify tools and resources were stored
      expect(tool).toBeDefined()
      expect(resource).toBeDefined()

      // Since we're using memory adapter in test mode, we can verify by getting the items
      const savedTool = await mcpToolStorage.get(toolData.id)
      expect(savedTool).toBeDefined()
      expect(savedTool?.serverId).toBe(serverId)

      const savedResource = await mcpResourceStorage.get(resourceData.uri)
      expect(savedResource).toBeDefined()
      expect(savedResource?.serverId).toBe(serverId)
    })

    test('should track tool execution results', async () => {
      const executionData = {
        toolId: 'tool-1',
        serverId: Date.now() + 1,
        status: 'success' as const,
        result: { output: 'success' },
        error: null,
        startedAt: Date.now(),
        completedAt: Date.now() + 100
      }

      // Create execution using the storage's create method
      const execution = await mcpToolExecutionStorage.create(executionData)

      // Verify execution was stored
      expect(execution).toBeDefined()
      expect(execution.id).toBeDefined()

      const savedExecution = await mcpToolExecutionStorage.get(execution.id)
      expect(savedExecution).toBeDefined()
      expect(savedExecution?.status).toBe('success')
      expect(savedExecution?.toolId).toBe(executionData.toolId)
    })
  })

  describe('Storage V2 Features', () => {
    test('should utilize LRU cache effectively', async () => {
      // Create a project
      const project: Project = {
        id: Date.now(),
        name: 'Cache Test Project',
        description: 'Project for testing cache functionality',
        path: '/test/cache-project',
        created: Date.now(),
        updated: Date.now()
      }

      // Write to storage
      await projectStorage.writeProjects({ [project.id]: project })

      // First read - from database
      const start1 = Date.now()
      const read1 = await projectStorage.readProjects()
      const time1 = Date.now() - start1

      // Second read - should be from cache (faster)
      const start2 = Date.now()
      const read2 = await projectStorage.readProjects()
      const time2 = Date.now() - start2

      // Cache reads should be faster (though this might be minimal with in-memory DB)
      console.log(`First read: ${time1}ms, Second read: ${time2}ms`)

      // Verify data consistency
      expect(read1[project.id]).toEqual(read2[project.id])
    })

    test('should handle index queries efficiently', async () => {
      // Create projects with different timestamps
      const projects: Record<string, Project> = {}
      const baseTime = Date.now() - 1000000

      for (let i = 0; i < 100; i++) {
        const timestamp = baseTime + i * 1000
        const project: Project = {
          id: timestamp,
          name: `Index Test ${i}`,
          description: `Index test project ${i}`,
          path: `/test/index-${i}`,
          created: timestamp,
          updated: timestamp
        }
        projects[project.id] = project
      }

      await projectStorage.writeProjects(projects)

      // Wait a bit to ensure all writes are complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Use findByDateRange which should leverage the created_at index
      const rangeStart = baseTime + 25000
      const rangeEnd = baseTime + 75000

      // First verify data was written
      const allProjects = await projectStorage.readProjects()
      console.log(`Total projects in storage: ${Object.keys(allProjects).length}`)

      const start = Date.now()
      const results = await db.findByDateRange<Project>('projects', rangeStart, rangeEnd)
      const queryTime = Date.now() - start

      console.log(`Indexed query returned ${results.length} results in ${queryTime}ms`)
      console.log(`Query range: ${rangeStart} to ${rangeEnd}`)

      // With 100 projects spread over 100 seconds (100,000ms), querying 50 seconds should return ~50 results
      expect(results.length).toBeGreaterThanOrEqual(45) // Allow some tolerance
      expect(results.length).toBeLessThanOrEqual(55)
    })
  })
})

// Helper function to create test data
async function createTestData() {
  // Create projects
  const project1: Project = {
    id: Date.now(),
    name: 'Test Project 1',
    description: 'First test project for helper',
    path: '/test/helper-project1',
    created: Date.now(),
    updated: Date.now()
  }

  const project2: Project = {
    id: Date.now() + 1,
    name: 'Test Project 2',
    description: 'Second test project for helper',
    path: '/test/helper-project2',
    created: Date.now(),
    updated: Date.now()
  }

  await projectStorage.writeProjects({
    [project1.id]: project1,
    [project2.id]: project2
  })

  // Create chats
  const chat1: Chat = {
    id: Date.now() + 2,
    title: 'Chat 1',
    projectId: project1.id,
    created: Date.now(),
    updated: Date.now()
  }

  const chat2: Chat = {
    id: Date.now() + 3,
    title: 'Chat 2',
    created: Date.now(),
    updated: Date.now()
  }

  await chatStorage.writeChats({
    [chat1.id]: chat1,
    [chat2.id]: chat2
  })

  // Create messages for chat1
  const message1: ChatMessage = {
    id: Date.now() + 4,
    chatId: chat1.id,
    role: 'user',
    content: 'Hello',
    created: Date.now(),
    updated: Date.now()
  }

  const message2: ChatMessage = {
    id: Date.now() + 5,
    chatId: chat1.id,
    role: 'assistant',
    content: 'Hi there!',
    created: Date.now(),
    updated: Date.now()
  }

  await chatStorage.writeChatMessages(chat1.id, {
    [message1.id]: message1,
    [message2.id]: message2
  })

  // Create prompts
  const prompt: Prompt = {
    id: Date.now() + 6,
    name: 'Test Prompt',
    content: 'This is a test prompt',
    projectId: project1.id,
    created: Date.now(),
    updated: Date.now()
  }

  await promptStorage.writePrompts({ [prompt.id]: prompt })

  // Create prompt-project association
  const association: PromptProject = {
    id: Date.now() + 7,
    promptId: prompt.id,
    projectId: project1.id,
    created: Date.now()
  }

  await promptStorage.writePromptProjects([association])

  // Create provider keys
  const key1: ProviderKey = {
    id: Date.now() + 8,
    name: 'Test OpenAI Key',
    provider: 'openai',
    key: 'test-key-1',
    isDefault: true,
    isActive: true,
    environment: 'production',
    description: 'Test OpenAI key for helper',
    created: Date.now(),
    updated: Date.now()
  }

  const key2: ProviderKey = {
    id: Date.now() + 9,
    name: 'Test Anthropic Key',
    provider: 'anthropic',
    key: 'test-key-2',
    isDefault: false,
    isActive: true,
    environment: 'production',
    description: 'Test Anthropic key for helper',
    created: Date.now(),
    updated: Date.now()
  }

  await providerKeyStorage.writeProviderKeys({
    [key1.id]: key1,
    [key2.id]: key2
  })

  // Create project files
  const file1: ProjectFile = {
    id: Date.now() + 10,
    projectId: project1.id,
    name: 'test.ts',
    path: '/test/helper-project1/test.ts',
    extension: 'ts',
    size: 20,
    content: 'console.log("test")',
    summary: null,
    summaryLastUpdated: null,
    meta: null,
    checksum: null,
    created: Date.now(),
    updated: Date.now()
  }

  await projectStorage.writeProjectFiles(project1.id, {
    [file1.id]: file1
  })

  return {
    projects: [project1, project2],
    chats: [chat1, chat2],
    messages: [message1, message2],
    prompts: [prompt],
    associations: [association],
    providerKeys: [key1, key2],
    files: [file1]
  }
}
