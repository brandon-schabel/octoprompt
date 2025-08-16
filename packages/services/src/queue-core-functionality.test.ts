import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test'
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
import { createProject, deleteProject } from './project-service'
import { createTicket, createTask, getTicketById, updateTicket, updateTask, getTasks } from './ticket-service'
import { clearAllData, resetTestDatabase, resetDatabaseInstance } from '@promptliano/storage/src/test-utils'
import { ticketStorage } from '@promptliano/storage'
import { randomBytes } from 'crypto'

describe('Queue Core Functionality', () => {
  let testProjectId: number
  let testResources: Array<{ type: 'project' | 'ticket' | 'task' | 'queue', id: number }> = []
  
  // Generate unique suffix for this test suite
  const suiteId = randomBytes(6).toString('hex')
  const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test'
  const testTimeout = isCI ? 15000 : 10000
  const asyncWaitTime = isCI ? 100 : 50

  beforeEach(async () => {
    // Reset test resources tracking
    testResources = []
    
    // Complete database reset for isolation
    await resetTestDatabase()

    // Add small delay in CI to prevent race conditions
    if (isCI) {
      await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
    }

    const projectSuffix = randomBytes(4).toString('hex')
    const project = await createProject({
      name: `Core Test Project ${suiteId}-${projectSuffix}`,
      path: `/test/core-${suiteId}-${projectSuffix}`
    })
    testProjectId = project.id
    testResources.push({ type: 'project', id: project.id })
  })

  afterEach(async () => {
    // Clean up test resources in reverse order to avoid foreign key constraints
    for (const resource of testResources.reverse()) {
      try {
        switch (resource.type) {
          case 'queue':
            await deleteQueue(resource.id).catch(() => {})
            break
          case 'project':
            await deleteProject(resource.id).catch(() => {})
            break
          // Tickets and tasks are cleaned up via cascading deletes
        }
      } catch (error) {
        // Ignore cleanup errors - database reset will handle remaining items
      }
    }
    
    // Additional delay in CI to prevent race conditions between tests
    if (isCI) {
      await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
    }
  })

  afterAll(async () => {
    await clearAllData()
    resetDatabaseInstance()
  })

  describe('Queue CRUD Operations', () => {
    test('should create queue with defaults', async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      const queue = await createQueue({
        projectId: testProjectId,
        name: `Default Queue ${suiteId}-${queueSuffix}`,
        description: 'Testing defaults'
      })
      testResources.push({ type: 'queue', id: queue.id })

      expect(queue.id).toBeDefined()
      expect(queue.name).toBe(`Default Queue ${suiteId}-${queueSuffix}`)
      expect(queue.description).toBe('Testing defaults')
      expect(queue.status).toBe('active')
      expect(queue.maxParallelItems).toBe(1)
      expect(queue.created).toBeDefined()
      expect(queue.updated).toBeDefined()
    }, testTimeout)

    test('should update queue properties', async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      const queue = await createQueue({
        projectId: testProjectId,
        name: `Original Name ${suiteId}-${queueSuffix}`,
        description: 'Original'
      })
      testResources.push({ type: 'queue', id: queue.id })

      // Add delay in CI to ensure creation is committed before update
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      const updated = await updateQueue(queue.id, {
        name: `Updated Name ${suiteId}-${queueSuffix}`,
        description: 'Updated description',
        maxParallelItems: 5
      })

      expect(updated.id).toBe(queue.id)
      expect(updated.name).toBe(`Updated Name ${suiteId}-${queueSuffix}`)
      expect(updated.description).toBe('Updated description')
      expect(updated.maxParallelItems).toBe(5)
    }, testTimeout)

    test('should pause and resume queue', async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      const queue = await createQueue({
        projectId: testProjectId,
        name: `Pausable Queue ${suiteId}-${queueSuffix}`
      })
      testResources.push({ type: 'queue', id: queue.id })

      expect(queue.status).toBe('active')

      // Add delay in CI to ensure creation is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      const paused = await pauseQueue(queue.id)
      expect(paused.status).toBe('paused')
      expect(paused.id).toBe(queue.id)

      // Add delay in CI to ensure pause is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      const resumed = await resumeQueue(queue.id)
      expect(resumed.status).toBe('active')
      expect(resumed.id).toBe(queue.id)
    }, testTimeout)

    test('should delete queue', async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      const queue = await createQueue({
        projectId: testProjectId,
        name: `Deletable Queue ${suiteId}-${queueSuffix}`
      })
      // Don't add to testResources since we're testing deletion

      // Add delay in CI to ensure creation is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      await deleteQueue(queue.id)

      // Add delay in CI to ensure deletion is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      await expect(getQueueById(queue.id)).rejects.toThrow(ApiError)
      await expect(getQueueById(queue.id)).rejects.toThrow(/not found/)
    }, testTimeout)
  })

  describe('Ticket Operations', () => {
    let testQueue: any

    beforeEach(async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      testQueue = await createQueue({
        projectId: testProjectId,
        name: `Ticket Queue ${suiteId}-${queueSuffix}`
      })
      testResources.push({ type: 'queue', id: testQueue.id })
      
      // Add delay in CI to ensure queue creation is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }
    })

    test('should enqueue single ticket', async () => {
      const ticketSuffix = randomBytes(4).toString('hex')
      const ticket = await createTicket({
        projectId: testProjectId,
        title: `Test Ticket ${suiteId}-${ticketSuffix}`,
        status: 'open',
        priority: 'high',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: ticket.id })

      // Add delay in CI to ensure ticket creation is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      const enqueued = await enqueueTicket(ticket.id, testQueue.id, 10)

      expect(enqueued.id).toBe(ticket.id)
      expect(enqueued.queueId).toBe(testQueue.id)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queuePriority).toBe(10)
      expect(enqueued.queuedAt).toBeDefined()
    }, testTimeout)

    test('should dequeue ticket', async () => {
      const ticketSuffix = randomBytes(4).toString('hex')
      const ticket = await createTicket({
        projectId: testProjectId,
        title: `Dequeue Test ${suiteId}-${ticketSuffix}`,
        status: 'open',
        priority: 'normal',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: ticket.id })

      await enqueueTicket(ticket.id, testQueue.id, 5)
      
      // Add delay in CI to ensure enqueue is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }
      
      const dequeued = await dequeueTicket(ticket.id)

      expect(dequeued.id).toBe(ticket.id)
      expect(dequeued.queueId).toBeUndefined()
      expect(dequeued.queueStatus).toBeUndefined()
      expect(dequeued.queuePriority).toBeUndefined()
      expect(dequeued.queuedAt == null).toBe(true)
    }, testTimeout)

    test('should get ticket queue status', async () => {
      const ticketSuffix = randomBytes(4).toString('hex')
      const ticket = await createTicket({
        projectId: testProjectId,
        title: `Status Test ${suiteId}-${ticketSuffix}`,
        status: 'open',
        priority: 'low',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: ticket.id })

      // Add delay in CI to ensure ticket creation is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      // Before enqueueing
      let fetchedTicket = await getTicketById(ticket.id)
      expect(fetchedTicket.queueStatus).toBeUndefined()

      // After enqueueing
      await enqueueTicket(ticket.id, testQueue.id, 3)
      
      // Add delay in CI to ensure enqueue is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }
      
      fetchedTicket = await getTicketById(ticket.id)
      expect(fetchedTicket.queueStatus).toBe('queued')
    }, testTimeout)

    test('should complete ticket in queue', async () => {
      const ticketSuffix = randomBytes(4).toString('hex')
      const ticket = await createTicket({
        projectId: testProjectId,
        title: `Complete Test ${suiteId}-${ticketSuffix}`,
        status: 'in_progress',
        priority: 'high',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: ticket.id })

      await enqueueTicket(ticket.id, testQueue.id, 10)
      
      // Add delay in CI to ensure enqueue is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      // Mark as in_progress (simulating processing)
      await ticketStorage.updateTicket(ticket.id, { queueStatus: 'in_progress' })
      
      // Add delay in CI to ensure update is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      // Complete the ticket
      await completeQueueItem('ticket', ticket.id)
      
      // Add delay in CI to ensure completion is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      const completed = await getTicketById(ticket.id)
      expect(completed.queueStatus).toBe('completed')
    }, testTimeout)
  })

  describe('Task Operations', () => {
    let testQueue: any
    let testTicket: any

    beforeEach(async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      const ticketSuffix = randomBytes(4).toString('hex')
      
      testQueue = await createQueue({
        projectId: testProjectId,
        name: `Task Queue ${suiteId}-${queueSuffix}`
      })
      testResources.push({ type: 'queue', id: testQueue.id })

      testTicket = await createTicket({
        projectId: testProjectId,
        title: `Parent Ticket ${suiteId}-${ticketSuffix}`,
        status: 'open',
        priority: 'normal',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: testTicket.id })
      
      // Add delay in CI to ensure both resources are created
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime * 2))
      }
    })

    test('should enqueue task with ticket', async () => {
      const taskSuffix = randomBytes(4).toString('hex')
      const task = await createTask(testTicket.id, {
        content: `Test Task ${suiteId}-${taskSuffix}`,
        description: 'A test task'
      })
      testResources.push({ type: 'task', id: task.id })

      // Add delay in CI to ensure task creation is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      const enqueued = await enqueueTask(testTicket.id, task.id, testQueue.id, 7)

      expect(enqueued.id).toBe(task.id)
      expect(enqueued.queueId).toBe(testQueue.id)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queuePriority).toBe(7)
    }, testTimeout)

    test('should process task from queue', async () => {
      const taskSuffix = randomBytes(4).toString('hex')
      const task = await createTask(testTicket.id, {
        content: `Process Task ${suiteId}-${taskSuffix}`,
        description: 'Task to process'
      })
      testResources.push({ type: 'task', id: task.id })

      await enqueueTask(testTicket.id, task.id, testQueue.id, 5)
      
      // Add delay in CI to ensure enqueue is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      // Get task from queue (simulating agent processing)
      const agentId = `test-agent-${suiteId}-${randomBytes(2).toString('hex')}`
      const result = await getNextTaskFromQueue(testQueue.id, agentId)

      expect(result.type).toBe('task')
      expect(result.item).toBeDefined()
      expect(result.item?.id).toBe(task.id)
      expect((result.item as any)?.queueStatus).toBe('in_progress')
    }, testTimeout)

    test('should complete task', async () => {
      const taskSuffix = randomBytes(4).toString('hex')
      const task = await createTask(testTicket.id, {
        content: `Complete Task ${suiteId}-${taskSuffix}`,
        description: 'Task to complete'
      })
      testResources.push({ type: 'task', id: task.id })

      await enqueueTask(testTicket.id, task.id, testQueue.id, 8)
      
      // Add delay in CI to ensure enqueue is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      // Mark as in_progress via queue
      const agentId = `test-agent-${suiteId}-${randomBytes(2).toString('hex')}`
      await getNextTaskFromQueue(testQueue.id, agentId)
      
      // Add delay in CI to ensure status update is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      // Complete the task (tasks require ticketId)
      await completeQueueItem('task', task.id, testTicket.id)
      
      // Add delay in CI to ensure completion is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }

      const tasks = await getTasks(testTicket.id)
      const completed = tasks.find((t) => t.id === task.id)

      expect(completed?.queueStatus).toBe('completed')
      expect(completed?.done).toBe(true)
    }, testTimeout)
  })

  describe('Basic Statistics', () => {
    let testQueue: any

    beforeEach(async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      testQueue = await createQueue({
        projectId: testProjectId,
        name: `Stats Queue ${suiteId}-${queueSuffix}`
      })
      testResources.push({ type: 'queue', id: testQueue.id })
      
      // Add delay in CI to ensure queue creation is committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime))
      }
    })

    test('should get queue item counts', async () => {
      const ticketIds: number[] = []
      
      // Create and enqueue 3 tickets
      for (let i = 0; i < 3; i++) {
        const ticketSuffix = randomBytes(4).toString('hex')
        const ticket = await createTicket({
          projectId: testProjectId,
          title: `Ticket ${i + 1} ${suiteId}-${ticketSuffix}`,
          status: 'open',
          priority: 'normal',
          overview: ''
        })
        ticketIds.push(ticket.id)
        testResources.push({ type: 'ticket', id: ticket.id })
        
        await enqueueTicket(ticket.id, testQueue.id, 5)
        
        // Add small delay between operations in CI
        if (isCI) {
          await new Promise(resolve => setTimeout(resolve, asyncWaitTime / 2))
        }
      }
      
      // Add delay in CI to ensure all operations are committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime * 2))
      }

      const stats = await getQueueStats(testQueue.id)

      expect(stats.totalItems).toBe(3)
      expect(stats.queuedItems).toBe(3)
      expect(stats.inProgressItems).toBe(0)
      expect(stats.completedItems).toBe(0)
      expect(stats.ticketCount).toBe(3)
      expect(stats.taskCount).toBe(0)
    }, testTimeout)

    test('should get queue status breakdown', async () => {
      const ticketSuffix1 = randomBytes(4).toString('hex')
      const ticketSuffix2 = randomBytes(4).toString('hex')
      const ticketSuffix3 = randomBytes(4).toString('hex')
      
      // Create tickets with different statuses
      const ticket1 = await createTicket({
        projectId: testProjectId,
        title: `Queued ${suiteId}-${ticketSuffix1}`,
        status: 'open',
        priority: 'high',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: ticket1.id })
      
      const ticket2 = await createTicket({
        projectId: testProjectId,
        title: `Processing ${suiteId}-${ticketSuffix2}`,
        status: 'in_progress',
        priority: 'normal',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: ticket2.id })
      
      const ticket3 = await createTicket({
        projectId: testProjectId,
        title: `Done ${suiteId}-${ticketSuffix3}`,
        status: 'closed',
        priority: 'low',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: ticket3.id })

      // Enqueue all
      await enqueueTicket(ticket1.id, testQueue.id, 10)
      await enqueueTicket(ticket2.id, testQueue.id, 5)
      await enqueueTicket(ticket3.id, testQueue.id, 1)
      
      // Add delay in CI to ensure all enqueue operations are committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime * 2))
      }

      // Update statuses
      await ticketStorage.updateTicket(ticket2.id, { queueStatus: 'in_progress' })
      await ticketStorage.updateTicket(ticket3.id, { queueStatus: 'completed' })
      
      // Add delay in CI to ensure all status updates are committed
      if (isCI) {
        await new Promise(resolve => setTimeout(resolve, asyncWaitTime * 2))
      }

      const stats = await getQueueStats(testQueue.id)

      expect(stats.queuedItems).toBe(1)
      expect(stats.inProgressItems).toBe(1)
      expect(stats.completedItems).toBe(1)
      expect(stats.failedItems).toBe(0)
    }, testTimeout)
  })
})
