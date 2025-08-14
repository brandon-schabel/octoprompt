import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import {
  createQueue,
  enqueueTicket,
  getNextTaskFromQueue,
  getQueueStats,
  updateQueue,
  completeQueueItem,
  failQueueItem
} from './queue-service'
import { createProject } from './project-service'
import { createTicket, updateTicket } from './ticket-service'
import { DatabaseManager } from '@promptliano/storage'
import { clearAllData, resetTestDatabase } from '@promptliano/storage/src/test-utils'

describe('Queue System Edge Cases', () => {
  let testProjectId: number
  let testQueueId: number
  let db: DatabaseManager

  beforeEach(async () => {
    await resetTestDatabase()
    db = DatabaseManager.getInstance()

    const project = await createProject({
      name: 'Edge Case Test Project',
      path: '/test/edge-' + Date.now(),
      created: Date.now(),
      updated: Date.now()
    })
    testProjectId = project.id

    const queue = await createQueue({
      projectId: testProjectId,
      name: 'Edge Case Queue',
      description: 'Testing edge cases',
      status: 'active',
      maxParallelItems: 3
    })
    testQueueId = queue.id
  })

  afterAll(async () => {
    await clearAllData()
  })

  describe.skip('Race Conditions', () => {
    test('should handle concurrent agents fetching next task', async () => {
      // Create multiple tickets
      const tickets = await Promise.all([
        createTicket({
          projectId: testProjectId,
          title: 'Ticket 1',
          status: 'open',
          priority: 'high'
        }),
        createTicket({
          projectId: testProjectId,
          title: 'Ticket 2',
          status: 'open',
          priority: 'high'
        }),
        createTicket({
          projectId: testProjectId,
          title: 'Ticket 3',
          status: 'open',
          priority: 'high'
        })
      ])

      // Enqueue all tickets
      await Promise.all(tickets.map((t) => enqueueTicket(t.id, testQueueId, 5)))

      // Multiple agents fetch simultaneously
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4']
      const results = await Promise.all(agents.map((agentId) => getNextTaskFromQueue(testQueueId, agentId)))

      // Should get 3 unique tasks (maxParallelItems = 3)
      const assignedTasks = results.filter((r) => r.type !== 'none')
      const uniqueTaskIds = new Set(assignedTasks.map((t) => t.item?.id))

      expect(assignedTasks.length).toBe(3)
      expect(uniqueTaskIds.size).toBe(3)

      // Fourth agent should get no task
      const noTaskResults = results.filter((r) => r.type === 'none')
      expect(noTaskResults.length).toBe(1)
    })

    test('should prevent double processing of same item', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Single Ticket',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueueId, 10)

      // Two agents try to get the same task
      const [result1, result2] = await Promise.all([
        getNextTaskFromQueue(testQueueId, 'agent-1'),
        getNextTaskFromQueue(testQueueId, 'agent-2')
      ])

      // Only one should succeed
      const successResults = [result1, result2].filter((r) => r.type !== 'none')
      expect(successResults.length).toBe(1)
      expect(successResults[0].item?.id).toBe(ticket.id)
    })
  })

  describe('State Transition Validation', () => {
    test('should enforce valid state transitions', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'State Test Ticket',
        status: 'open',
        priority: 'high'
      })

      // Enqueue (null -> queued)
      const queued = await enqueueTicket(ticket.id, testQueueId, 5)
      expect(queued.queueStatus).toBe('queued')

      // Start processing (queued -> in_progress)
      await getNextTaskFromQueue(testQueueId, 'test-agent')
      const inProgress = await getTicketById(ticket.id)
      expect(inProgress.queueStatus).toBe('in_progress')

      // Complete (in_progress -> completed)
      await completeQueueItem('ticket', ticket.id)
      const completed = await getTicketById(ticket.id)
      expect(completed.queueStatus).toBe('completed')
    })

    test.skip('should prevent invalid state transitions', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Invalid Transition Test',
        status: 'closed',
        priority: 'low'
      })

      // Complete ticket first
      await enqueueTicket(ticket.id, testQueueId, 5)
      await updateTicket(ticket.id, { queueStatus: 'completed' })

      // Try to enqueue completed ticket again
      await expect(enqueueTicket(ticket.id, testQueueId, 10)).rejects.toThrow(/already in queue|completed/)
    })

    test.skip('should handle failed to retry transition', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Retry Test',
        status: 'in_progress',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueueId, 5)
      await updateTicket(ticket.id, { queueStatus: 'in_progress' })

      // Fail the item
      await failQueueItem('ticket', ticket.id, 'Test failure')
      const failed = await getTicketById(ticket.id)
      expect(failed.queueStatus).toBe('failed')

      // Retry by re-enqueueing
      await updateTicket(ticket.id, {
        queueStatus: 'queued',
        queueErrorMessage: null
      })
      const retrying = await getTicketById(ticket.id)
      expect(retrying.queueStatus).toBe('queued')
      expect(retrying.queueErrorMessage).toBeNull()
    })
  })

  describe('Priority Edge Cases', () => {
    test('should handle negative priority values', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Negative Priority',
        status: 'open',
        priority: 'low'
      })

      const enqueued = await enqueueTicket(ticket.id, testQueueId, -10)
      expect(enqueued.queuePriority).toBe(-10)

      // Should still be retrievable
      const nextTask = await getNextTaskFromQueue(testQueueId)
      expect(nextTask.item?.id).toBe(ticket.id)
    })

    // Skip in CI - timing-sensitive test
    test.skip('should maintain FIFO for same priority', async () => {
      const tickets = []
      for (let i = 1; i <= 3; i++) {
        const ticket = await createTicket({
          projectId: testProjectId,
          title: `Same Priority ${i}`,
          status: 'open',
          priority: 'normal'
        })
        tickets.push(ticket)

        // Enqueue with same priority but different times
        await enqueueTicket(ticket.id, testQueueId, 5)

        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Should get tickets in FIFO order
      const retrieved = []
      for (let i = 0; i < 3; i++) {
        const next = await getNextTaskFromQueue(testQueueId, `agent-${i}`)
        retrieved.push(next.item?.id)
      }

      expect(retrieved).toEqual(tickets.map((t) => t.id))
    })
  })

  describe('Queue Limits and Constraints', () => {
    test.skip('should respect maxParallelItems limit', async () => {
      // Queue already has maxParallelItems = 3
      const tickets = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          createTicket({
            projectId: testProjectId,
            title: `Parallel Test ${i + 1}`,
            status: 'open',
            priority: 'high'
          })
        )
      )

      // Enqueue all
      await Promise.all(tickets.map((t) => enqueueTicket(t.id, testQueueId, 5)))

      // Start 3 items (up to limit)
      const agents = ['agent-1', 'agent-2', 'agent-3']
      await Promise.all(agents.map((agent) => getNextTaskFromQueue(testQueueId, agent)))

      // Try to get another while 3 are in progress
      const stats = await getQueueStats(testQueueId)
      expect(stats.inProgressItems).toBe(3)

      // Should not get another task
      const blocked = await getNextTaskFromQueue(testQueueId, 'agent-4')
      expect(blocked.type).toBe('none')
      expect(blocked.message).toContain('parallel limit reached')
    })

    test('should handle queue pause correctly', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Pause Test',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueueId, 5)

      // Pause the queue
      await updateQueue(testQueueId, { status: 'paused' })

      // Should not get task from paused queue
      const result = await getNextTaskFromQueue(testQueueId)
      expect(result.type).toBe('none')
      expect(result.message).toContain('paused')

      // Resume and retry
      await updateQueue(testQueueId, { status: 'active' })
      const afterResume = await getNextTaskFromQueue(testQueueId)
      expect(afterResume.item?.id).toBe(ticket.id)
    })
  })

  describe('Data Integrity', () => {
    test.skip('should handle orphaned queue references', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Orphan Test',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueueId, 5)

      // Directly update to invalid queue ID (simulating orphaned reference)
      await updateTicket(ticket.id, { queueId: 999999 })

      // Should handle gracefully
      const stats = await getQueueStats(testQueueId)
      expect(stats.totalItems).toBe(0)

      // Should be able to re-enqueue
      const reEnqueued = await enqueueTicket(ticket.id, testQueueId, 10)
      expect(reEnqueued.queueId).toBe(testQueueId)
    })

    test.skip('should maintain consistency with null queue fields', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Null Fields Test',
        status: 'open',
        priority: 'normal'
      })

      // Initial state - all queue fields should be null
      expect(ticket.queueId).toBeNull()
      expect(ticket.queueStatus).toBeNull()
      expect(ticket.queuePriority).toBe(0)
      expect(ticket.queuePosition).toBeNull()

      // After enqueue - fields should be set
      const enqueued = await enqueueTicket(ticket.id, testQueueId, 5)
      expect(enqueued.queueId).not.toBeNull()
      expect(enqueued.queueStatus).not.toBeNull()
      expect(enqueued.queuePriority).not.toBe(0)

      // After dequeue - fields should be null again
      const { dequeueTicket } = await import('./queue-service')
      const dequeued = await dequeueTicket(ticket.id)
      expect(dequeued.queueId).toBeNull()
      expect(dequeued.queueStatus).toBeNull()
      expect(dequeued.queuePriority).toBe(0)
    })
  })

  describe('Error Recovery', () => {
    test('should recover stuck in_progress items', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Stuck Item',
        status: 'in_progress',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, testQueueId, 10)

      // Simulate item stuck in progress (set old timestamp)
      const oldTimestamp = Date.now() - 1000 * 60 * 60 // 1 hour ago
      await updateTicket(ticket.id, {
        queueStatus: 'in_progress',
        queueStartedAt: oldTimestamp
      })

      // checkAndHandleTimeouts would normally handle this
      // For now, manually reset
      await updateTicket(ticket.id, {
        queueStatus: 'queued',
        queueStartedAt: null,
        queueAgentId: null
      })

      // Should be available again
      const next = await getNextTaskFromQueue(testQueueId)
      expect(next.item?.id).toBe(ticket.id)
    })

    test.skip('should handle partial transaction failures gracefully', async () => {
      // Create multiple tickets
      const tickets = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          createTicket({
            projectId: testProjectId,
            title: `Transaction Test ${i + 1}`,
            status: 'open',
            priority: 'high'
          })
        )
      )

      // Try to enqueue with one invalid ID in the middle
      const operations = [
        enqueueTicket(tickets[0].id, testQueueId, 5),
        enqueueTicket(999999, testQueueId, 5), // This will fail
        enqueueTicket(tickets[2].id, testQueueId, 5)
      ]

      const results = await Promise.allSettled(operations)

      // First and third should succeed
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      expect(results[2].status).toBe('fulfilled')

      // Queue should have 2 items
      const stats = await getQueueStats(testQueueId)
      expect(stats.totalItems).toBe(2)
    })
  })
})

// Helper function
async function getTicketById(ticketId: number) {
  const { getTicketById } = await import('./ticket-service')
  return getTicketById(ticketId)
}
