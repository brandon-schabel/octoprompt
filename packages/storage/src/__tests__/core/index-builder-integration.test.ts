/**
 * Integration tests for IndexBuilder with IndexedStorage
 * 
 * Recent changes:
 * 1. Created integration tests showing IndexBuilder usage with IndexedStorage
 * 2. Demonstrated real-world scenarios with custom storage classes
 * 3. Verified index definitions work with actual storage operations
 * 4. Tested convenience builders in storage context
 * 5. Ensured type safety between IndexBuilder and IndexedStorage
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { IndexBuilder, IndexBuilders } from '../../core/index-builder'
import { IndexedStorage } from '../../core/indexed-storage'
import type { BaseEntity } from '../../core/base-storage'

// Test entity schemas
const TaskSchema = z.object({
  id: z.number(),
  projectId: z.number(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
  assignedTo: z.string().optional(),
  tags: z.array(z.string()).default([]),
  created: z.number(),
  updated: z.number(),
  deletedAt: z.number().optional()
})

const TaskStorageSchema = z.record(z.string(), TaskSchema)

type Task = z.infer<typeof TaskSchema> & BaseEntity

// Test storage implementation using IndexBuilder
class TaskStorage extends IndexedStorage<Task, z.infer<typeof TaskStorageSchema>> {
  constructor(dataDir: string) {
    super(TaskStorageSchema, TaskSchema, dataDir, {
      enableCache: false,
      enableLocking: false,
      enableFileWatcher: false
    })

    // Define indexes using IndexBuilder
    this.indexDefinitions = new IndexBuilder()
      .addHashIndex('id')
      .addHashIndex('projectId')
      .addHashIndex('status')
      .addHashIndex('priority')
      .addTextIndex('title')
      .addTextIndex('description')
      .addDateIndex('created')
      .addDateIndex('updated')
      .addSparseIndex('deletedAt', 'btree')
      .addSparseIndex('assignedTo')
      .addCompoundIndex(['projectId', 'status'])
      .addCompoundIndex(['projectId', 'priority'])
      .build()
  }

  async initialize(): Promise<void> {
    await this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'tasks.json')
  }

  // Custom query methods using the indexes
  async getTasksByProject(projectId: number): Promise<Task[]> {
    return this.queryByIndex('idx_hash_projectId', projectId)
  }

  async getTasksByStatus(status: Task['status']): Promise<Task[]> {
    return this.queryByIndex('idx_hash_status', status)
  }

  async getTasksByProjectAndStatus(projectId: number, status: Task['status']): Promise<Task[]> {
    return this.queryByIndex('idx_hash_projectId_status', `${projectId}:${status}`)
  }

  async searchTasks(query: string): Promise<Task[]> {
    const titleResults = await this.searchByIndex('idx_text_title', query)
    const descResults = await this.searchByIndex('idx_text_description', query)
    
    // Combine and deduplicate results
    const allResults = [...titleResults, ...descResults]
    const uniqueResults = allResults.filter((task, index, array) => 
      array.findIndex(t => t.id === task.id) === index
    )
    
    return uniqueResults
  }

  async getRecentTasks(limit: number = 10): Promise<Task[]> {
    return this.queryByDateRange('idx_btree_updated', new Date(0), new Date(), 
      (a, b) => b.updated - a.updated).then(tasks => tasks.slice(0, limit))
  }

  async getDeletedTasks(): Promise<Task[]> {
    // This will only return tasks that have a non-null deletedAt value
    const entities = await this.list()
    return entities.filter(task => task.deletedAt != null)
  }
}

// Test storage using convenience builders
class ProjectStorage extends IndexedStorage<Task, z.infer<typeof TaskStorageSchema>> {
  constructor(dataDir: string) {
    super(TaskStorageSchema, TaskSchema, dataDir, {
      enableCache: false,
      enableLocking: false,
      enableFileWatcher: false
    })

    // Use convenience builder
    this.indexDefinitions = IndexBuilders.project()
      .addTextIndex('title')
      .addHashIndex('status')
      .build()
  }

  async initialize(): Promise<void> {
    await this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'projects.json')
  }
}

describe('IndexBuilder Integration', () => {
  let tempDir: string
  let taskStorage: TaskStorage
  let projectStorage: ProjectStorage

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'index-builder-test-'))
    taskStorage = new TaskStorage(tempDir)
    projectStorage = new ProjectStorage(path.join(tempDir, 'projects'))
    
    await taskStorage.initialize()
    await projectStorage.initialize()
  })

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('Index Definition Integration', () => {
    test('should create indexes from builder definitions', async () => {
      const stats = await taskStorage.getIndexStats()
      
      // Should have all the indexes we defined
      expect(stats.length).toBeGreaterThan(0)
      
      const indexNames = stats.map(stat => stat.config.name)
      expect(indexNames).toContain('idx_hash_id')
      expect(indexNames).toContain('idx_hash_projectId')
      expect(indexNames).toContain('idx_text_title')
      expect(indexNames).toContain('idx_btree_created')
      expect(indexNames).toContain('idx_btree_deletedAt_sparse')
    })

    test('should support different index types', async () => {
      const stats = await taskStorage.getIndexStats()
      
      const hashIndexes = stats.filter(s => s.config.type === 'hash')
      const btreeIndexes = stats.filter(s => s.config.type === 'btree')
      const invertedIndexes = stats.filter(s => s.config.type === 'inverted')
      
      expect(hashIndexes.length).toBeGreaterThan(0)
      expect(btreeIndexes.length).toBeGreaterThan(0)
      expect(invertedIndexes.length).toBeGreaterThan(0)
    })

    test('should handle sparse indexes correctly', async () => {
      const stats = await taskStorage.getIndexStats()
      
      const sparseIndexes = stats.filter(s => s.config.sparse === true)
      expect(sparseIndexes.length).toBeGreaterThan(0)
      
      // Check that deletedAt index is sparse
      const deletedAtIndex = stats.find(s => s.config.fields.includes('deletedAt'))
      expect(deletedAtIndex?.config.sparse).toBe(true)
    })
  })

  describe('Storage Operations with Indexes', () => {
    test('should query by project using hash index', async () => {
      // Create test tasks
      const task1 = await taskStorage.create({
        projectId: 1,
        title: 'Task 1',
        status: 'pending',
        priority: 'high'
      })

      const task2 = await taskStorage.create({
        projectId: 1,
        title: 'Task 2',
        status: 'in_progress',
        priority: 'medium'
      })

      const task3 = await taskStorage.create({
        projectId: 2,
        title: 'Task 3',
        status: 'pending',
        priority: 'low'
      })

      // Query by project
      const project1Tasks = await taskStorage.getTasksByProject(1)
      expect(project1Tasks).toHaveLength(2)
      expect(project1Tasks.map(t => t.id).sort()).toEqual([task1.id, task2.id].sort())

      const project2Tasks = await taskStorage.getTasksByProject(2)
      expect(project2Tasks).toHaveLength(1)
      expect(project2Tasks[0].id).toBe(task3.id)
    })

    test('should search using text indexes', async () => {
      await taskStorage.create({
        projectId: 1,
        title: 'Fix user authentication bug',
        description: 'Users cannot login properly',
        status: 'pending',
        priority: 'high'
      })

      await taskStorage.create({
        projectId: 1,
        title: 'Add user profile page',
        description: 'Create a page for user settings',
        status: 'pending',
        priority: 'medium'
      })

      await taskStorage.create({
        projectId: 1,
        title: 'Database optimization',
        description: 'Improve query performance',
        status: 'pending',
        priority: 'low'
      })

      // Search by title
      const userTasks = await taskStorage.searchTasks('user')
      expect(userTasks).toHaveLength(2)

      // Search by description
      const queryTasks = await taskStorage.searchTasks('query')
      expect(queryTasks).toHaveLength(1)
      expect(queryTasks[0].title).toBe('Database optimization')
    })

    test('should query by compound index', async () => {
      await taskStorage.create({
        projectId: 1,
        title: 'Task 1',
        status: 'pending',
        priority: 'high'
      })

      await taskStorage.create({
        projectId: 1,
        title: 'Task 2',
        status: 'pending',
        priority: 'medium'
      })

      await taskStorage.create({
        projectId: 1,
        title: 'Task 3',
        status: 'completed',
        priority: 'high'
      })

      const pendingProject1Tasks = await taskStorage.getTasksByProjectAndStatus(1, 'pending')
      expect(pendingProject1Tasks).toHaveLength(2)

      const completedProject1Tasks = await taskStorage.getTasksByProjectAndStatus(1, 'completed')
      expect(completedProject1Tasks).toHaveLength(1)
    })

    test('should handle date range queries', async () => {
      const baseTime = Date.now()
      
      const task1 = await taskStorage.create({
        projectId: 1,
        title: 'Old task',
        status: 'pending',
        priority: 'low'
      })

      // Manually set older timestamp
      await taskStorage.update(task1.id, {})
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const task2 = await taskStorage.create({
        projectId: 1,
        title: 'New task',
        status: 'pending',
        priority: 'high'
      })

      const recentTasks = await taskStorage.getRecentTasks(1)
      expect(recentTasks).toHaveLength(1)
      expect(recentTasks[0].id).toBe(task2.id)
    })

    test('should handle sparse indexes correctly', async () => {
      // Create task without deletedAt
      await taskStorage.create({
        projectId: 1,
        title: 'Active task',
        status: 'pending',
        priority: 'medium'
      })

      // Create task with deletedAt
      const deletedTask = await taskStorage.create({
        projectId: 1,
        title: 'Deleted task',
        status: 'pending',
        priority: 'low'
      })

      // Update to set deletedAt
      await taskStorage.update(deletedTask.id, {
        deletedAt: Date.now()
      })

      const deletedTasks = await taskStorage.getDeletedTasks()
      expect(deletedTasks).toHaveLength(1)
      expect(deletedTasks[0].id).toBe(deletedTask.id)
    })
  })

  describe('Convenience Builders Integration', () => {
    test('should work with standard convenience builder', async () => {
      const stats = await projectStorage.getIndexStats()
      
      const indexNames = stats.map(s => s.config.name)
      
      // Should have standard indexes
      expect(indexNames).toContain('idx_hash_id')
      expect(indexNames).toContain('idx_hash_projectId')
      expect(indexNames).toContain('idx_btree_created')
      expect(indexNames).toContain('idx_btree_updated')
      
      // Plus custom ones we added
      expect(indexNames).toContain('idx_text_title')
      expect(indexNames).toContain('idx_hash_status')
    })

    test('should support chaining with convenience builders', async () => {
      // Create a new storage with chained convenience builder
      class ChainedStorage extends IndexedStorage<Task, z.infer<typeof TaskStorageSchema>> {
        constructor(dataDir: string) {
          super(TaskStorageSchema, TaskSchema, dataDir, {
            enableCache: false,
            enableLocking: false,
            enableFileWatcher: false
          })

          this.indexDefinitions = IndexBuilders.searchable(['title'])
            .addHashIndex('priority')
            .addSparseIndex('assignedTo')
            .build()
        }

        protected getIndexPath(): string {
          return path.join(this.basePath, this.dataDir, 'chained.json')
        }
      }

      const chainedStorage = new ChainedStorage(path.join(tempDir, 'chained'))
      await chainedStorage.initializeIndexes()

      const stats = await chainedStorage.getIndexStats()
      const indexNames = stats.map(s => s.config.name)

      // Should have searchable indexes
      expect(indexNames).toContain('idx_hash_id')
      expect(indexNames).toContain('idx_text_title')
      
      // Plus chained ones
      expect(indexNames).toContain('idx_hash_priority')
      expect(indexNames).toContain('idx_hash_assignedTo_sparse')
    })
  })

  describe('Error Handling', () => {
    test('should handle index rebuilding after corruption', async () => {
      // Create some data
      await taskStorage.create({
        projectId: 1,
        title: 'Test task',
        status: 'pending',
        priority: 'medium'
      })

      // Rebuild indexes
      await taskStorage.rebuildIndexes()

      // Should still work
      const tasks = await taskStorage.getTasksByProject(1)
      expect(tasks).toHaveLength(1)
    })

    test('should handle queries on non-existent index gracefully', async () => {
      // This should not crash, but return empty results
      const results = await taskStorage.queryByIndex('non_existent_index', 'test')
      expect(results).toEqual([])
    })
  })
})