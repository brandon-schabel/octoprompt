import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import * as queueService from './queue-service'
import {
  createMockQueue,
  createMockQueueItem,
  createMockTicket,
  createMockTask,
  createMockQueueStorage,
  createMockTicketStorage
} from './test-utils/queue-mocks-bun'
import {
  assertQueueState,
  assertQueueItemStatus,
  assertPriorityOrder,
  assertQueueStats,
  assertBatchResult
} from './test-utils/queue-assertions'

// Mock the storage modules
const mockQueueStorage = createMockQueueStorage()
const mockTicketStorage = createMockTicketStorage()

// Override the imports
mock.module('@promptliano/storage', () => ({
  queueStorage: mockQueueStorage,
  ticketStorage: mockTicketStorage
}))

describe('Queue Service (Bun)', () => {
  beforeEach(() => {
    // Clear all mock data before each test
    mockQueueStorage.clear()
    mockTicketStorage.clear()
  })

  describe('Queue Management', () => {
    test('should create a new queue with default values', async () => {
      const queue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Test Queue',
        description: 'A test queue'
      })

      expect(queue).toBeDefined()
      expect(queue.name).toBe('Test Queue')
      expect(queue.description).toBe('A test queue')
      expect(queue.status).toBe('active')
      expect(queue.maxParallelItems).toBe(1)
    })

    test('should retrieve queue by ID', async () => {
      const created = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Retrieve Test',
        description: 'Queue to retrieve'
      })

      const retrieved = await queueService.getQueueById(created.id)
      expect(retrieved).toEqual(created)
    })

    test('should throw error for non-existent queue', async () => {
      try {
        await queueService.getQueueById(999999)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).message).toContain('not found')
      }
    })

    test('should pause and resume queue', async () => {
      const queue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Pause Test',
        description: 'Queue to pause'
      })

      // Pause the queue
      const paused = await queueService.pauseQueue(queue.id)
      expect(paused.status).toBe('paused')

      // Resume the queue
      const resumed = await queueService.resumeQueue(queue.id)
      expect(resumed.status).toBe('active')
    })
  })

  describe('Queue Item Operations', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Item Test Queue',
        description: 'Queue for item tests'
      })
    })

    test('should enqueue a task item', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      const item = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      expect(item).toBeDefined()
      expect(item.taskId).toBe(task.id)
      expect(item.priority).toBe(5)
      expect(item.status).toBe('queued')
    })

    test('should update queue item status', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      const item = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      // Update to in_progress
      const inProgress = await queueService.updateQueueItem(item.id, {
        status: 'in_progress',
        agentId: 'test-agent',
        startedAt: Date.now()
      })

      expect(inProgress.status).toBe('in_progress')
      expect(inProgress.agentId).toBe('test-agent')

      // Update to completed
      const completed = await queueService.updateQueueItem(item.id, {
        status: 'completed',
        completedAt: Date.now()
      })

      expect(completed.status).toBe('completed')
    })
  })

  describe('Queue Processing', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Processing Queue',
        description: 'Queue for processing tests',
        maxParallelItems: 2
      })
    })

    test('should get next task from queue', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      const result = await queueService.getNextTaskFromQueue(testQueue.id, 'agent-1')

      expect(result.queueItem).toBeDefined()
      expect(result.task).toBeDefined()
      expect(result.ticket).toBeDefined()
      expect(result.queueItem?.status).toBe('in_progress')
    })

    test('should not return tasks from paused queue', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      // Pause the queue
      await queueService.pauseQueue(testQueue.id)

      const result = await queueService.getNextTaskFromQueue(testQueue.id, 'agent-1')
      expect(result.queueItem).toBeNull()
      expect(result.ticket).toBeNull()
      expect(result.task).toBeNull()
    })
  })

  describe('Queue Statistics', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Stats Queue',
        description: 'Queue for statistics tests'
      })
    })

    test('should calculate queue statistics correctly', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      // Create items with different statuses
      const statuses = ['queued', 'queued', 'in_progress', 'completed', 'failed']
      for (let i = 0; i < statuses.length; i++) {
        const task = createMockTask(ticket.id, { id: 300 + i })
        mockTicketStorage.addTask(task)

        const item = await queueService.enqueueItem(testQueue.id, {
          taskId: task.id,
          priority: 5
        })

        if (statuses[i] !== 'queued') {
          await queueService.updateQueueItem(item.id, {
            status: statuses[i] as any
          })
        }
      }

      const stats = await queueService.getQueueStats(testQueue.id)

      expect(stats.totalItems).toBe(5)
      expect(stats.queuedItems).toBe(2)
      expect(stats.inProgressItems).toBe(1)
      expect(stats.completedItems).toBe(1)
      expect(stats.failedItems).toBe(1)
    })
  })

  describe('Batch Operations', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Batch Queue',
        description: 'Queue for batch tests'
      })
    })

    test('should batch enqueue multiple items', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      const items = []
      for (let i = 0; i < 5; i++) {
        const task = createMockTask(ticket.id, { id: 600 + i })
        mockTicketStorage.addTask(task)
        items.push({
          taskId: task.id,
          priority: i + 1
        })
      }

      const result = await queueService.batchEnqueueItems(testQueue.id, items)

      expect(result.items).toHaveLength(5)
      expect(result.skipped).toBe(0)
    })
  })

  describe('Ticket with Tasks Enqueue', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Ticket Queue',
        description: 'Queue for ticket tests'
      })
    })

    test('should enqueue ticket with all tasks', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      // Create 5 tasks for the ticket
      const tasks = []
      for (let i = 0; i < 5; i++) {
        const task = createMockTask(ticket.id, {
          id: 800 + i,
          orderIndex: i,
          done: false
        })
        mockTicketStorage.addTask(task)
        tasks.push(task)
      }

      const result = await queueService.enqueueTicketWithAllTasks(
        testQueue.id,
        ticket.id,
        10 // Base priority
      )

      expect(result.items).toHaveLength(5)
      expect(result.skipped).toBe(0)

      // Verify priorities are set correctly (earlier tasks have higher priority)
      const priorities = result.items.map((item) => item.priority)
      expect(priorities).toEqual([15, 14, 13, 12, 11]) // Base 10 + (5-i)
    })
  })
})
