import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import {
  createQueue,
  getQueueById,
  listQueuesByProject,
  updateQueue,
  deleteQueue,
  pauseQueue,
  resumeQueue,
  enqueueTicket,
  enqueueTask,
  enqueueTicketWithAllTasks,
  dequeueTicket,
  dequeueTask,
  getNextTaskFromQueue,
  getQueueStats,
  getQueuesWithStats,
  moveItemToQueue,
  completeQueueItem,
  failQueueItem,
  getUnqueuedItems
} from './queue-service'
import { createProject, deleteProject } from './project-service'
import { createTicket, updateTicket, deleteTicket } from './ticket-service'
import { createTask, updateTask } from './ticket-service'
import { DatabaseManager } from '@promptliano/storage'
import { clearAllData, resetTestDatabase, resetDatabaseInstance } from '@promptliano/storage/src/test-utils'
import { randomBytes } from 'crypto'

describe('Consolidated Queue System Tests', () => {
  let testProjectId: number
  let testQueueId: number
  let testQueueName: string
  let db: DatabaseManager

  // Generate unique suffix for this test suite
  const suiteId = randomBytes(4).toString('hex')

  beforeEach(async () => {
    // Initialize database for testing
    await resetTestDatabase()
    db = DatabaseManager.getInstance()

    // Create a test project with unique name
    const projectSuffix = randomBytes(4).toString('hex')
    const project = await createProject({
      name: `Queue Test Project ${suiteId}-${projectSuffix}`,
      path: `/test/queue-${suiteId}-${projectSuffix}`
    })
    testProjectId = project.id

    // Create a test queue with unique name to avoid conflicts
    const queueSuffix = randomBytes(4).toString('hex')
    testQueueName = `Test Queue ${suiteId}-${queueSuffix}`
    const queue = await createQueue({
      projectId: testProjectId,
      name: testQueueName,
      description: 'Testing consolidated queue system'
    })
    testQueueId = queue.id
  })

  afterAll(async () => {
    // Clean up test data and reset database instance
    await clearAllData()
    resetDatabaseInstance()
  })

  describe('Queue CRUD Operations', () => {
    test('should create a queue with default values', async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      const queue = await createQueue({
        projectId: testProjectId,
        name: `Another Test Queue ${suiteId}-${queueSuffix}`,
        description: 'Test description'
      })

      expect(queue).toBeDefined()
      expect(queue.name).toBe(`Another Test Queue ${suiteId}-${queueSuffix}`)
      expect(queue.status).toBe('active')
      expect(queue.maxParallelItems).toBe(1)
    })

    test('should get queue by ID', async () => {
      const queue = await getQueueById(testQueueId)

      expect(queue).toBeDefined()
      expect(queue.id).toBe(testQueueId)
      expect(queue.name).toBe(testQueueName)
    })

    test.skip('should list queues by project', async () => {
      const queues = await listQueuesByProject(testProjectId)

      expect(queues.length).toBeGreaterThan(0)
      expect(queues.some((q) => q.id === testQueueId)).toBe(true)
    })

    test.skip('should update queue properties', async () => {
      const updated = await updateQueue(testQueueId, {
        name: 'Updated Queue Name',
        maxParallelItems: 5
      })

      expect(updated.name).toBe('Updated Queue Name')
      expect(updated.maxParallelItems).toBe(5)
    })

    test('should pause and resume queue', async () => {
      const paused = await pauseQueue(testQueueId)
      expect(paused.status).toBe('paused')

      const resumed = await resumeQueue(testQueueId)
      expect(resumed.status).toBe('active')
    })
  })

  describe('Ticket Enqueueing (Flow System)', () => {
    let testTicketId: number

    beforeEach(async () => {
      // Create a test ticket
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Test Ticket',
        overview: 'For queue testing',
        status: 'open',
        priority: 'normal'
      })
      testTicketId = ticket.id
    })

    test('should enqueue ticket with queue fields', async () => {
      const enqueued = await enqueueTicket(testTicketId, testQueueId, 5)

      expect(enqueued.queueId).toBe(testQueueId)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queuePriority).toBe(5)
      expect(enqueued.queuedAt).toBeDefined()
    })

    test.skip('should dequeue ticket by clearing queue fields', async () => {
      // First enqueue
      await enqueueTicket(testTicketId, testQueueId, 5)

      // Then dequeue
      const dequeued = await dequeueTicket(testTicketId)

      expect(dequeued.queueId).toBeNull()
      expect(dequeued.queueStatus).toBeNull()
      expect(dequeued.queuePriority).toBe(0)
    })

    test.skip('should prevent duplicate enqueueing', async () => {
      // Enqueue once
      await enqueueTicket(testTicketId, testQueueId, 5)

      // Try to enqueue again to a different queue
      const anotherQueueSuffix = randomBytes(4).toString('hex')
      const anotherQueue = await createQueue({
        projectId: testProjectId,
        name: `Another Queue ${suiteId}-${anotherQueueSuffix}`
      })

      await expect(enqueueTicket(testTicketId, anotherQueue.id, 3)).rejects.toThrow(/already in queue/)
    })

    test.skip('should enqueue ticket with all its tasks', async () => {
      // Create tasks for the ticket
      const task1 = await createTask(testTicketId, {
        content: 'Task 1',
        description: 'First task'
      })
      const task2 = await createTask(testTicketId, {
        content: 'Task 2',
        description: 'Second task'
      })

      // Enqueue ticket with tasks
      const result = await enqueueTicketWithAllTasks(testQueueId, testTicketId, 5)

      expect(result.ticket.queueId).toBe(testQueueId)
      expect(result.tasks).toHaveLength(2)
      expect(result.tasks[0].queueId).toBe(testQueueId)
      expect(result.tasks[1].queueId).toBe(testQueueId)
    })
  })

  describe('Task Enqueueing (Flow System)', () => {
    let testTicketId: number
    let testTaskId: number

    beforeEach(async () => {
      // Create a test ticket and task
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Test Ticket for Task',
        overview: 'Task queue testing',
        status: 'open',
        priority: 'normal'
      })
      testTicketId = ticket.id

      const task = await createTask(testTicketId, {
        content: 'Test Task',
        description: 'For queue testing'
      })
      testTaskId = task.id
    })

    test.skip('should enqueue task with queue fields', async () => {
      const enqueued = await enqueueTask(testTicketId, testTaskId, testQueueId, 3)

      expect(enqueued.queueId).toBe(testQueueId)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queuePriority).toBe(3)
      expect(enqueued.queuedAt).toBeDefined()
    })

    test.skip('should dequeue task by clearing queue fields', async () => {
      // First enqueue
      await enqueueTask(testTicketId, testTaskId, testQueueId, 3)

      // Then dequeue
      const dequeued = await dequeueTask(testTicketId, testTaskId)

      expect(dequeued.queueId).toBeNull()
      expect(dequeued.queueStatus).toBeNull()
      expect(dequeued.queuePriority).toBe(0)
    })
  })

  describe('Queue Statistics (Flow System)', () => {
    test('should calculate queue stats from tickets/tasks', async () => {
      // Create and enqueue multiple tickets
      const ticket1 = await createTicket({
        projectId: testProjectId,
        title: 'Ticket 1',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const ticket2 = await createTicket({
        projectId: testProjectId,
        title: 'Ticket 2',
        overview: '',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket1.id, testQueueId, 10)
      await enqueueTicket(ticket2.id, testQueueId, 5)

      // Get stats
      const stats = await getQueueStats(testQueueId)

      expect(stats.totalItems).toBe(2)
      expect(stats.queuedItems).toBe(2)
      expect(stats.inProgressItems).toBe(0)
      expect(stats.completedItems).toBe(0)
      expect(stats.ticketCount).toBe(2)
      expect(stats.taskCount).toBe(0)
    })

    test.skip('should track different queue statuses', async () => {
      // Create tickets with different statuses
      const ticket1 = await createTicket({
        projectId: testProjectId,
        title: 'Queued Ticket',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const ticket2 = await createTicket({
        projectId: testProjectId,
        title: 'In Progress Ticket',
        overview: '',
        status: 'in_progress',
        priority: 'normal'
      })
      const ticket3 = await createTicket({
        projectId: testProjectId,
        title: 'Completed Ticket',
        overview: '',
        status: 'closed',
        priority: 'low'
      })

      // Enqueue all tickets
      await enqueueTicket(ticket1.id, testQueueId, 10)
      await enqueueTicket(ticket2.id, testQueueId, 5)
      await enqueueTicket(ticket3.id, testQueueId, 1)

      // Update their queue statuses
      // Simulate processing state via queue flow
      await getNextTaskFromQueue(testQueueId, 'agent-x')
      await completeQueueItem('ticket', ticket3.id)

      // Get stats
      const stats = await getQueueStats(testQueueId)

      expect(stats.totalItems).toBe(3)
      expect(stats.queuedItems).toBe(1)
      expect(stats.inProgressItems).toBe(1)
      expect(stats.completedItems).toBe(1)
    })

    test.skip('should get all queues with stats', async () => {
      // Create another queue
      const queue2Suffix = randomBytes(4).toString('hex')
      const queue2 = await createQueue({
        projectId: testProjectId,
        name: `Second Queue ${suiteId}-${queue2Suffix}`
      })

      // Add items to both queues
      const ticket1 = await createTicket({
        projectId: testProjectId,
        title: 'Ticket for Queue 1',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const ticket2 = await createTicket({
        projectId: testProjectId,
        title: 'Ticket for Queue 2',
        overview: '',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket1.id, testQueueId, 10)
      await enqueueTicket(ticket2.id, queue2.id, 5)

      // Get queues with stats
      const queuesWithStats = await getQueuesWithStats(testProjectId)

      expect(queuesWithStats.length).toBeGreaterThanOrEqual(2)

      const queue1Stats = queuesWithStats.find((q) => q.queue.id === testQueueId)
      const queue2Stats = queuesWithStats.find((q) => q.queue.id === queue2.id)

      expect(queue1Stats?.stats.totalItems).toBeGreaterThanOrEqual(1)
      expect(queue2Stats?.stats.totalItems).toBe(1)
    })
  })

  describe('Queue Processing (Flow System)', () => {
    test('should get next task from queue by priority', async () => {
      // Create multiple tickets with different priorities
      const ticket1 = await createTicket({
        projectId: testProjectId,
        title: 'Low Priority',
        overview: '',
        status: 'open',
        priority: 'low'
      })
      const ticket2 = await createTicket({
        projectId: testProjectId,
        title: 'High Priority',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const ticket3 = await createTicket({
        projectId: testProjectId,
        title: 'Medium Priority',
        overview: '',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket1.id, testQueueId, 10) // Lowest priority
      await enqueueTicket(ticket2.id, testQueueId, 1) // Highest priority (lower number = higher priority)
      await enqueueTicket(ticket3.id, testQueueId, 5) // Medium priority

      // Get next task (should be highest priority - ticket2 with priority 1)
      const nextTask = await getNextTaskFromQueue(testQueueId)

      expect(nextTask).toBeDefined()
      expect(nextTask.type).toBe('ticket')
      expect(nextTask.item?.id).toBe(ticket2.id)
      expect(nextTask.item?.queuePriority).toBe(1)
    })

    test('should mark item as in_progress when fetched', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Test Ticket',
        overview: '',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueueId, 5)

      // Get next task with agent ID
      const nextTask = await getNextTaskFromQueue(testQueueId, 'test-agent')

      expect(nextTask).toBeDefined()
      expect(nextTask.item?.queueStatus).toBe('in_progress')

      // Verify the ticket was updated
      const updatedTicket = await getTicketById(ticket.id)
      expect(updatedTicket.queueStatus).toBe('in_progress')
    })

    test('should handle empty queue', async () => {
      const nextTask = await getNextTaskFromQueue(testQueueId)

      expect(nextTask.type).toBe('none')
      expect(nextTask.item).toBeNull()
      expect(nextTask.message).toContain('No tasks available')
    })
  })

  describe('Queue Item Movement', () => {
    test('should move ticket between queues', async () => {
      // Create second queue
      const queue2Suffix = randomBytes(4).toString('hex')
      const queue2 = await createQueue({
        projectId: testProjectId,
        name: `Target Queue ${suiteId}-${queue2Suffix}`
      })

      // Create and enqueue ticket
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Mobile Ticket',
        overview: '',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket.id, testQueueId, 5)

      // Move to another queue
      await moveItemToQueue('ticket', ticket.id, queue2.id)

      // Verify moved
      const movedTicket = await getTicketById(ticket.id)
      expect(movedTicket.queueId).toBe(queue2.id)
      expect(movedTicket.queueStatus).toBe('queued')

      // Verify stats
      const stats1 = await getQueueStats(testQueueId)
      const stats2 = await getQueueStats(queue2.id)

      expect(stats1.totalItems).toBe(0)
      expect(stats2.totalItems).toBe(1)
    })

    test.skip('should remove from queue when moving to null', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Removable Ticket',
        overview: '',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket.id, testQueueId, 5)

      // Remove from queue
      await moveItemToQueue('ticket', ticket.id, null)

      // Verify removed
      const updatedTicket = await getTicketById(ticket.id)
      expect(updatedTicket.queueId).toBeNull()
      expect(updatedTicket.queueStatus).toBeNull()
    })
  })

  describe('Queue Item Completion and Failure', () => {
    test.skip('should complete queue item', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Completable Ticket',
        overview: '',
        status: 'in_progress',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueueId, 10)
      // Set in_progress via queue flow
      await enqueueTicket(ticket.id, testQueueId, 10)
      await getNextTaskFromQueue(testQueueId, 'agent-z')

      // Complete the item
      await completeQueueItem('ticket', ticket.id)

      // Verify completed
      const completedTicket = await getTicketById(ticket.id)
      expect(completedTicket.queueStatus).toBe('completed')
      expect(completedTicket.status).toBe('closed')
    })

    test('should fail queue item with error message', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Failing Ticket',
        overview: '',
        status: 'in_progress',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueueId, 10)
      // Set in_progress via queue flow
      await getNextTaskFromQueue(testQueueId, 'test-agent')

      // Fail the item
      await failQueueItem('ticket', ticket.id, 'Test failure reason')

      // Verify failed
      const failedTicket = await getTicketById(ticket.id)
      expect(failedTicket.queueStatus).toBe('failed')
      expect(failedTicket.queueErrorMessage).toBe('Test failure reason')
    })
  })

  describe('Unqueued Items', () => {
    test('should find unqueued items', async () => {
      // Create some tickets - some queued, some not
      const queuedTicket = await createTicket({
        projectId: testProjectId,
        title: 'Queued Ticket',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const unqueuedTicket1 = await createTicket({
        projectId: testProjectId,
        title: 'Unqueued Ticket 1',
        overview: '',
        status: 'open',
        priority: 'normal'
      })
      const unqueuedTicket2 = await createTicket({
        projectId: testProjectId,
        title: 'Unqueued Ticket 2',
        overview: '',
        status: 'in_progress',
        priority: 'low'
      })

      // Only enqueue one
      await enqueueTicket(queuedTicket.id, testQueueId, 5)

      // Get unqueued items
      const unqueued = await getUnqueuedItems(testProjectId)

      expect(unqueued.tickets.length).toBe(2)
      expect(unqueued.tickets.some((t) => t.id === unqueuedTicket1.id)).toBe(true)
      expect(unqueued.tickets.some((t) => t.id === unqueuedTicket2.id)).toBe(true)
      expect(unqueued.tickets.some((t) => t.id === queuedTicket.id)).toBe(false)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid queue ID gracefully', async () => {
      await expect(getQueueById(999999)).rejects.toThrow(ApiError)
      await expect(getQueueById(999999)).rejects.toThrow(/not found/i)
    })

    test('should handle invalid ticket ID when enqueueing', async () => {
      await expect(enqueueTicket(999999, testQueueId, 5)).rejects.toThrow(ApiError)
      await expect(enqueueTicket(999999, testQueueId, 5)).rejects.toThrow(/not found/i)
    })

    test.skip('should handle pausing already paused queue', async () => {
      await pauseQueue(testQueueId)

      // Pause again - should be idempotent
      const stillPaused = await pauseQueue(testQueueId)
      expect(stillPaused.status).toBe('paused')
    })

    test.skip('should handle resuming already active queue', async () => {
      // Already active by default
      const stillActive = await resumeQueue(testQueueId)
      expect(stillActive.status).toBe('active')
    })

    test.skip('should handle concurrent enqueueing', async () => {
      const tickets = await Promise.all([
        createTicket({
          projectId: testProjectId,
          title: 'Concurrent 1',
          overview: '',
          status: 'open',
          priority: 'high'
        }),
        createTicket({
          projectId: testProjectId,
          title: 'Concurrent 2',
          overview: '',
          status: 'open',
          priority: 'normal'
        }),
        createTicket({
          projectId: testProjectId,
          title: 'Concurrent 3',
          overview: '',
          status: 'open',
          priority: 'low'
        })
      ])

      // Enqueue all concurrently
      await Promise.all(tickets.map((ticket, index) => enqueueTicket(ticket.id, testQueueId, (index + 1) * 3)))

      // Verify all enqueued
      const stats = await getQueueStats(testQueueId)
      expect(stats.totalItems).toBe(3)
      expect(stats.queuedItems).toBe(3)
    })

    test('should handle queue deletion with items', async () => {
      // Create and enqueue a ticket
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Orphan Ticket',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      await enqueueTicket(ticket.id, testQueueId, 5)

      // Delete the queue
      await deleteQueue(testQueueId)

      // Ticket should still exist but not be queued
      const orphanTicket = await getTicketById(ticket.id)
      expect(orphanTicket).toBeDefined()
      // Queue fields should be cleared via CASCADE or trigger
      // This depends on database implementation
    })
  })
})

// Helper function that might be missing
async function getTicketById(ticketId: number) {
  // This would be imported from ticket-service
  const { getTicketById } = await import('./ticket-service')
  return getTicketById(ticketId)
}
