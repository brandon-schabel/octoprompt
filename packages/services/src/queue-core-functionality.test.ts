import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import {
  createQueue,
  getQueueById,
  updateQueue,
  deleteQueue,
  pauseQueue,
  resumeQueue,
  enqueueTicket,
  dequeueTicket,
  enqueueTask,
  dequeueTask,
  getQueueStats,
  completeQueueItem,
  getNextTaskFromQueue
} from './queue-service'
import { createProject } from './project-service'
import { createTicket, createTask, getTicketById, updateTicket, updateTask, getTasks } from './ticket-service'
import { clearAllData, resetTestDatabase } from '@promptliano/storage/src/test-utils'
import { ticketStorage } from '@promptliano/storage'

describe('Queue Core Functionality', () => {
  let testProjectId: number

  beforeEach(async () => {
    await resetTestDatabase()

    const project = await createProject({
      name: 'Core Test Project',
      path: '/test/core-' + Date.now(),
      created: Date.now(),
      updated: Date.now()
    })
    testProjectId = project.id
  })

  afterAll(async () => {
    await clearAllData()
  })

  describe('Queue CRUD Operations', () => {
    test('should create queue with defaults', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Default Queue',
        description: 'Testing defaults'
      })

      expect(queue.id).toBeDefined()
      expect(queue.name).toBe('Default Queue')
      expect(queue.description).toBe('Testing defaults')
      expect(queue.status).toBe('active')
      expect(queue.maxParallelItems).toBe(1)
      expect(queue.created).toBeDefined()
      expect(queue.updated).toBeDefined()
    })

    test('should update queue properties', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Original Name',
        description: 'Original'
      })

      const updated = await updateQueue(queue.id, {
        name: 'Updated Name',
        description: 'Updated description',
        maxParallelItems: 5
      })

      expect(updated.id).toBe(queue.id)
      expect(updated.name).toBe('Updated Name')
      expect(updated.description).toBe('Updated description')
      expect(updated.maxParallelItems).toBe(5)
    })

    test('should pause and resume queue', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Pausable Queue'
      })

      expect(queue.status).toBe('active')

      const paused = await pauseQueue(queue.id)
      expect(paused.status).toBe('paused')

      const resumed = await resumeQueue(queue.id)
      expect(resumed.status).toBe('active')
    })

    test('should delete queue', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Deletable Queue'
      })

      await deleteQueue(queue.id)

      await expect(getQueueById(queue.id)).rejects.toThrow(ApiError)
    })
  })

  describe('Ticket Operations', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await createQueue({
        projectId: testProjectId,
        name: 'Ticket Queue'
      })
    })

    test('should enqueue single ticket', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Test Ticket',
        status: 'open',
        priority: 'high'
      })

      const enqueued = await enqueueTicket(ticket.id, testQueue.id, 10)

      expect(enqueued.id).toBe(ticket.id)
      expect(enqueued.queueId).toBe(testQueue.id)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queuePriority).toBe(10)
      expect(enqueued.queuedAt).toBeDefined()
    })

    test('should dequeue ticket', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Dequeue Test',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket.id, testQueue.id, 5)
      const dequeued = await dequeueTicket(ticket.id)

      expect(dequeued.queueId).toBeUndefined()
      expect(dequeued.queueStatus).toBeUndefined()
      expect(dequeued.queuePriority).toBe(0)
      expect(dequeued.queuedAt).toBeUndefined()
    })

    test('should get ticket queue status', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Status Test',
        status: 'open',
        priority: 'low'
      })

      // Before enqueueing
      let fetchedTicket = await getTicketById(ticket.id)
      expect(fetchedTicket.queueStatus).toBeUndefined()

      // After enqueueing
      await enqueueTicket(ticket.id, testQueue.id, 3)
      fetchedTicket = await getTicketById(ticket.id)
      expect(fetchedTicket.queueStatus).toBe('queued')
    })

    test('should complete ticket in queue', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Complete Test',
        status: 'in_progress',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueue.id, 10)

      // Mark as in_progress (simulating processing)
      await ticketStorage.updateTicket(ticket.id, { queueStatus: 'in_progress' })

      // Complete the ticket
      await completeQueueItem('ticket', ticket.id)

      const completed = await getTicketById(ticket.id)
      expect(completed.queueStatus).toBe('completed')
    })
  })

  describe('Task Operations', () => {
    let testQueue: any
    let testTicket: any

    beforeEach(async () => {
      testQueue = await createQueue({
        projectId: testProjectId,
        name: 'Task Queue'
      })

      testTicket = await createTicket({
        projectId: testProjectId,
        title: 'Parent Ticket',
        status: 'open',
        priority: 'normal'
      })
    })

    test('should enqueue task with ticket', async () => {
      const task = await createTask(testTicket.id, {
        content: 'Test Task',
        description: 'A test task'
      })

      const enqueued = await enqueueTask(testTicket.id, task.id, testQueue.id, 7)

      expect(enqueued.id).toBe(task.id)
      expect(enqueued.queueId).toBe(testQueue.id)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queuePriority).toBe(7)
    })

    test('should process task from queue', async () => {
      const task = await createTask(testTicket.id, {
        content: 'Process Task',
        description: 'Task to process'
      })

      await enqueueTask(testTicket.id, task.id, testQueue.id, 5)

      // Get task from queue (simulating agent processing)
      const result = await getNextTaskFromQueue(testQueue.id, 'test-agent')

      expect(result.type).toBe('task')
      expect(result.item).toBeDefined()
      expect(result.item?.id).toBe(task.id)
      expect((result.item as any)?.queueStatus).toBe('in_progress')
    })

    test('should complete task', async () => {
      const task = await createTask(testTicket.id, {
        content: 'Complete Task',
        description: 'Task to complete'
      })

      await enqueueTask(testTicket.id, task.id, testQueue.id, 8)

      // Mark as in_progress
      await updateTask(testTicket.id, task.id, { queueStatus: 'in_progress' })

      // Complete the task (tasks require ticketId)
      await completeQueueItem('task', task.id, testTicket.id)

      const tasks = await getTasks(testTicket.id)
      const completed = tasks.find((t) => t.id === task.id)

      expect(completed?.queueStatus).toBe('completed')
      expect(completed?.done).toBe(true)
    })
  })

  describe('Basic Statistics', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await createQueue({
        projectId: testProjectId,
        name: 'Stats Queue'
      })
    })

    test('should get queue item counts', async () => {
      // Create and enqueue 3 tickets
      for (let i = 0; i < 3; i++) {
        const ticket = await createTicket({
          projectId: testProjectId,
          title: `Ticket ${i + 1}`,
          status: 'open',
          priority: 'normal'
        })
        await enqueueTicket(ticket.id, testQueue.id, 5)
      }

      const stats = await getQueueStats(testQueue.id)

      expect(stats.totalItems).toBe(3)
      expect(stats.queuedItems).toBe(3)
      expect(stats.inProgressItems).toBe(0)
      expect(stats.completedItems).toBe(0)
      expect(stats.ticketCount).toBe(3)
      expect(stats.taskCount).toBe(0)
    })

    test('should get queue status breakdown', async () => {
      // Create tickets with different statuses
      const ticket1 = await createTicket({
        projectId: testProjectId,
        title: 'Queued',
        status: 'open',
        priority: 'high'
      })
      const ticket2 = await createTicket({
        projectId: testProjectId,
        title: 'Processing',
        status: 'in_progress',
        priority: 'normal'
      })
      const ticket3 = await createTicket({
        projectId: testProjectId,
        title: 'Done',
        status: 'closed',
        priority: 'low'
      })

      // Enqueue all
      await enqueueTicket(ticket1.id, testQueue.id, 10)
      await enqueueTicket(ticket2.id, testQueue.id, 5)
      await enqueueTicket(ticket3.id, testQueue.id, 1)

      // Update statuses
      await ticketStorage.updateTicket(ticket2.id, { queueStatus: 'in_progress' })
      await ticketStorage.updateTicket(ticket3.id, { queueStatus: 'completed' })

      const stats = await getQueueStats(testQueue.id)

      expect(stats.queuedItems).toBe(1)
      expect(stats.inProgressItems).toBe(1)
      expect(stats.completedItems).toBe(1)
      expect(stats.failedItems).toBe(0)
    })
  })
})
