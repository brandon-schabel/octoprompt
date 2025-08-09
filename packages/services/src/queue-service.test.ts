import { describe, test, expect, beforeEach, jest, mock } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import * as queueService from './queue-service'
import {
  createMockQueue,
  createMockQueueItem,
  createMockTicket,
  createMockTask,
  createMockQueueStorage,
  createMockTicketStorage
} from './test-utils/queue-mocks'
import {
  assertQueueState,
  assertQueueItemStatus,
  assertPriorityOrder,
  assertQueueStats,
  assertValidStatusTransition,
  assertBatchResult
} from './test-utils/queue-assertions'

// Mock the storage modules
jest.mock('@promptliano/storage', () => ({
  queueStorage: createMockQueueStorage(),
  ticketStorage: createMockTicketStorage()
}))

const mockQueueStorage = require('@promptliano/storage').queueStorage
const mockTicketStorage = require('@promptliano/storage').ticketStorage

describe('Queue Service', () => {
  beforeEach(() => {
    // Clear all mock data before each test
    mockQueueStorage.clear()
    mockTicketStorage.clear()
    jest.clearAllMocks()
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
      assertQueueState(queue, { status: 'active', maxParallelItems: 1 })
    })

    test('should create a queue with custom maxParallelItems', async () => {
      const queue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Parallel Queue',
        description: 'Queue with parallel processing',
        maxParallelItems: 5
      })

      expect(queue.maxParallelItems).toBe(5)
      assertQueueState(queue, { maxParallelItems: 5 })
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
      await expect(queueService.getQueueById(999999)).rejects.toThrow(ApiError)
      await expect(queueService.getQueueById(999999)).rejects.toThrow('Queue 999999 not found')
    })

    test('should list queues by project', async () => {
      const projectId = 1754713756748

      await queueService.createQueue({
        projectId,
        name: 'Queue 1',
        description: 'First queue'
      })

      await queueService.createQueue({
        projectId,
        name: 'Queue 2',
        description: 'Second queue'
      })

      const queues = await queueService.listQueuesByProject(projectId)
      expect(queues).toHaveLength(2)
      expect(queues.map((q) => q.name)).toContain('Queue 1')
      expect(queues.map((q) => q.name)).toContain('Queue 2')
    })

    test('should update queue properties', async () => {
      const queue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Update Test',
        description: 'Original description'
      })

      const updated = await queueService.updateQueue(queue.id, {
        description: 'Updated description',
        maxParallelItems: 3
      })

      expect(updated.description).toBe('Updated description')
      expect(updated.maxParallelItems).toBe(3)
      assertQueueState(updated, { maxParallelItems: 3 })
    })

    test('should pause and resume queue', async () => {
      const queue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Pause Test',
        description: 'Queue to pause'
      })

      // Pause the queue
      const paused = await queueService.pauseQueue(queue.id)
      assertQueueState(paused, { status: 'paused' })

      // Try to pause again - should throw error
      await expect(queueService.pauseQueue(queue.id)).rejects.toThrow('already paused')

      // Resume the queue
      const resumed = await queueService.resumeQueue(queue.id)
      assertQueueState(resumed, { status: 'active' })

      // Try to resume again - should throw error
      await expect(queueService.resumeQueue(queue.id)).rejects.toThrow('already active')
    })

    test('should delete queue and all its items', async () => {
      const queue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Delete Test',
        description: 'Queue to delete'
      })

      // Add some items to the queue
      await queueService.enqueueItem(queue.id, {
        taskId: 1,
        priority: 5
      })

      await queueService.enqueueItem(queue.id, {
        taskId: 2,
        priority: 3
      })

      // Delete the queue
      await queueService.deleteQueue(queue.id)

      // Verify queue is deleted
      await expect(queueService.getQueueById(queue.id)).rejects.toThrow('not found')
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
      assertQueueItemStatus(item, 'queued')
    })

    test('should enqueue a ticket item', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      const item = await queueService.enqueueItem(testQueue.id, {
        ticketId: ticket.id,
        priority: 3
      })

      expect(item).toBeDefined()
      expect(item.ticketId).toBe(ticket.id)
      expect(item.priority).toBe(3)
      assertQueueItemStatus(item, 'queued')
    })

    test('should prevent duplicate items by default', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      // First enqueue should succeed
      const item1 = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      // Mock the checkExistingQueueItem to return the existing item
      mockQueueStorage.checkExistingQueueItem.mockResolvedValueOnce(item1)

      // Second enqueue should fail with duplicate error
      await expect(
        queueService.enqueueItem(testQueue.id, {
          taskId: task.id,
          priority: 5
        })
      ).rejects.toThrow('Item already exists in queue')
    })

    test('should return existing item when returnExisting is true', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      const item1 = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      // Mock the checkExistingQueueItem to return the existing item
      mockQueueStorage.checkExistingQueueItem.mockResolvedValueOnce(item1)

      const item2 = await queueService.enqueueItem(
        testQueue.id,
        { taskId: task.id, priority: 5 },
        { returnExisting: true }
      )

      expect(item2.id).toBe(item1.id)
    })

    test('should respect priority ordering', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      // Create tasks with different priorities
      const priorities = [10, 1, 5, 3, 8]
      const items = []

      for (let i = 0; i < priorities.length; i++) {
        const task = createMockTask(ticket.id, { id: i + 100 })
        mockTicketStorage.addTask(task)

        const item = await queueService.enqueueItem(testQueue.id, {
          taskId: task.id,
          priority: priorities[i]
        })
        items.push(item)
      }

      const queueItems = await queueService.getQueueItems(testQueue.id)
      const sorted = Object.values(queueItems).sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.created - b.created
      })

      assertPriorityOrder(sorted)
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

      assertQueueItemStatus(inProgress, 'in_progress', {
        hasAgent: true,
        isStarted: true
      })

      // Update to completed
      const completed = await queueService.updateQueueItem(item.id, {
        status: 'completed',
        completedAt: Date.now()
      })

      assertQueueItemStatus(completed, 'completed', {
        isCompleted: true
      })
    })

    test('should delete queue item', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      const item = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      await queueService.deleteQueueItem(item.id)

      const items = await queueService.getQueueItems(testQueue.id)
      expect(Object.values(items)).toHaveLength(0)
    })

    test('should get queue items filtered by status', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      // Create items with different statuses
      const task1 = createMockTask(ticket.id, { id: 101 })
      const task2 = createMockTask(ticket.id, { id: 102 })
      const task3 = createMockTask(ticket.id, { id: 103 })
      mockTicketStorage.addTask(task1)
      mockTicketStorage.addTask(task2)
      mockTicketStorage.addTask(task3)

      const item1 = await queueService.enqueueItem(testQueue.id, { taskId: task1.id })
      const item2 = await queueService.enqueueItem(testQueue.id, { taskId: task2.id })
      const item3 = await queueService.enqueueItem(testQueue.id, { taskId: task3.id })

      // Update statuses
      await queueService.updateQueueItem(item2.id, { status: 'in_progress' })
      await queueService.updateQueueItem(item3.id, { status: 'completed' })

      const queuedItems = await queueService.getQueueItems(testQueue.id, 'queued')
      const inProgressItems = await queueService.getQueueItems(testQueue.id, 'in_progress')
      const completedItems = await queueService.getQueueItems(testQueue.id, 'completed')

      expect(Object.values(queuedItems)).toHaveLength(1)
      expect(Object.values(inProgressItems)).toHaveLength(1)
      expect(Object.values(completedItems)).toHaveLength(1)
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
      assertQueueItemStatus(result.queueItem!, 'in_progress', {
        hasAgent: true,
        isStarted: true
      })
    })

    test('should respect maxParallelItems limit', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      // Create and enqueue 5 tasks
      for (let i = 0; i < 5; i++) {
        const task = createMockTask(ticket.id, { id: 200 + i })
        mockTicketStorage.addTask(task)
        await queueService.enqueueItem(testQueue.id, {
          taskId: task.id,
          priority: 5
        })
      }

      // Get tasks for 2 agents (up to maxParallelItems)
      const result1 = await queueService.getNextTaskFromQueue(testQueue.id, 'agent-1')
      const result2 = await queueService.getNextTaskFromQueue(testQueue.id, 'agent-2')

      expect(result1.queueItem).toBeDefined()
      expect(result2.queueItem).toBeDefined()

      // Mock getCurrentAgents to return the two agents
      mockQueueStorage.getCurrentAgents.mockResolvedValueOnce(['agent-1', 'agent-2'])

      // Third agent should not get a task (maxParallelItems = 2)
      const result3 = await queueService.getNextTaskFromQueue(testQueue.id, 'agent-1')
      expect(result3.queueItem).toBeNull()
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
      expect(result.message).toContain('paused')
    })

    test('should update ticket/task status when processing', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      const item = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      // Process the task
      const result = await queueService.getNextTaskFromQueue(testQueue.id, 'agent-1')
      expect(result.queueItem).toBeDefined()

      // Verify task status was updated
      expect(mockTicketStorage.updateTask).toHaveBeenCalledWith(
        ticket.id,
        task.id,
        expect.objectContaining({ queue_status: 'in_progress' })
      )

      // Complete the task
      await queueService.updateQueueItem(result.queueItem!.id, {
        status: 'completed'
      })

      // Verify task was marked as done
      expect(mockTicketStorage.updateTask).toHaveBeenCalledWith(
        ticket.id,
        task.id,
        expect.objectContaining({
          queue_status: 'completed',
          done: true
        })
      )
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

      assertQueueStats(stats, {
        totalItems: 5,
        queuedItems: 2,
        inProgressItems: 1,
        completedItems: 1,
        failedItems: 1
      })
    })

    test('should get queues with stats for project', async () => {
      const projectId = 1754713756748

      // Create multiple queues
      const queue1 = await queueService.createQueue({
        projectId,
        name: 'Queue 1',
        description: 'First queue'
      })

      const queue2 = await queueService.createQueue({
        projectId,
        name: 'Queue 2',
        description: 'Second queue'
      })

      // Add items to queues
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      for (let i = 0; i < 3; i++) {
        const task = createMockTask(ticket.id, { id: 400 + i })
        mockTicketStorage.addTask(task)
        await queueService.enqueueItem(queue1.id, { taskId: task.id })
      }

      for (let i = 0; i < 2; i++) {
        const task = createMockTask(ticket.id, { id: 500 + i })
        mockTicketStorage.addTask(task)
        await queueService.enqueueItem(queue2.id, { taskId: task.id })
      }

      const queuesWithStats = await queueService.getQueuesWithStats(projectId)

      expect(queuesWithStats).toHaveLength(2)
      expect(queuesWithStats[0].stats.totalItems).toBe(3)
      expect(queuesWithStats[1].stats.totalItems).toBe(2)
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

      assertBatchResult(result, {
        enqueuedCount: 5,
        skippedCount: 0
      })
    })

    test('should skip duplicates in batch enqueue', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      // Enqueue the same task twice
      const firstItem = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      // Mock checkExistingQueueItem to return the existing item
      mockQueueStorage.checkExistingQueueItem.mockResolvedValueOnce(firstItem)

      const items = [
        { taskId: task.id, priority: 5 } // Duplicate
      ]

      const result = await queueService.batchEnqueueItems(testQueue.id, items)

      assertBatchResult(result, {
        enqueuedCount: 1, // Returns existing item
        skippedCount: 0
      })
    })

    test('should batch update queue items', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      const itemIds = []
      for (let i = 0; i < 3; i++) {
        const task = createMockTask(ticket.id, { id: 700 + i })
        mockTicketStorage.addTask(task)
        const item = await queueService.enqueueItem(testQueue.id, {
          taskId: task.id,
          priority: 5
        })
        itemIds.push(item.id)
      }

      const updates = itemIds.map((id) => ({
        itemId: id,
        data: { status: 'in_progress' as const }
      }))

      const results = await queueService.batchUpdateQueueItems(updates)

      expect(results).toHaveLength(3)
      results.forEach((item) => {
        assertQueueItemStatus(item, 'in_progress')
      })
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

      expect(result.queueItems).toHaveLength(5)
      expect(result.skippedCount).toBe(0)

      // Verify priorities are set correctly (earlier tasks have higher priority)
      const priorities = result.queueItems.map((item) => item.priority)
      expect(priorities).toEqual([15, 14, 13, 12, 11]) // Base 10 + (5-i)
    })

    test('should skip completed tasks when enqueueing ticket', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      // Create tasks with some completed
      const tasks = []
      for (let i = 0; i < 5; i++) {
        const task = createMockTask(ticket.id, {
          id: 900 + i,
          orderIndex: i,
          done: i < 2 // First 2 tasks are done
        })
        mockTicketStorage.addTask(task)
        tasks.push(task)
      }

      const result = await queueService.enqueueTicketWithAllTasks(testQueue.id, ticket.id, 5)

      expect(result.queueItems).toHaveLength(3) // Only incomplete tasks
      expect(result.skippedCount).toBe(0)
    })

    test('should update ticket queue status when enqueuing', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      const task = createMockTask(ticket.id)
      mockTicketStorage.addTask(task)

      await queueService.enqueueTicketWithAllTasks(testQueue.id, ticket.id)

      expect(mockTicketStorage.updateTicket).toHaveBeenCalledWith(
        ticket.id,
        expect.objectContaining({
          queue_id: testQueue.id,
          queue_status: 'queued',
          queued_at: expect.any(Number)
        })
      )
    })
  })

  describe('Error Handling and Retry', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await queueService.createQueue({
        projectId: 1754713756748,
        name: 'Error Queue',
        description: 'Queue for error tests'
      })
    })

    test('should retry failed item', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      const item = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      // Mark as failed
      await queueService.updateQueueItem(item.id, {
        status: 'failed',
        errorMessage: 'Test failure'
      })

      // Retry the item
      const retried = await queueService.retryFailedItem(item.id)

      assertQueueItemStatus(retried, 'queued', {
        hasError: false,
        isStarted: false,
        isCompleted: false
      })
    })

    test('should not retry non-failed items', async () => {
      const ticket = createMockTicket()
      const task = createMockTask(ticket.id)
      mockTicketStorage.addTicket(ticket)
      mockTicketStorage.addTask(task)

      const item = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 5
      })

      // Item is still queued
      await expect(queueService.retryFailedItem(item.id)).rejects.toThrow('Cannot retry')
    })

    test('should retry all failed items in queue', async () => {
      const ticket = createMockTicket()
      mockTicketStorage.addTicket(ticket)

      // Create some items and mark them as failed
      const failedIds = []
      for (let i = 0; i < 3; i++) {
        const task = createMockTask(ticket.id, { id: 1000 + i })
        mockTicketStorage.addTask(task)

        const item = await queueService.enqueueItem(testQueue.id, {
          taskId: task.id,
          priority: 5
        })

        await queueService.updateQueueItem(item.id, {
          status: 'failed',
          errorMessage: `Failure ${i}`
        })

        failedIds.push(item.id)
      }

      const result = await queueService.retryAllFailedItems(testQueue.id)

      expect(result.retried).toBe(3)
      expect(result.failed).toBe(0)
    })
  })
})
