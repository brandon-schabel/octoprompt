import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import {
  createQueue,
  getQueueById,
  enqueueTicket,
  enqueueTask,
  getNextTaskFromQueue,
  pauseQueue,
  resumeQueue,
  updateQueue,
  failQueueItem,
  completeQueueItem,
  moveItemToQueue,
  getQueueStats,
  deleteQueue
} from './queue-service'
import { createProject } from './project-service'
import { createTicket, createTask, updateTicket, updateTask, getTicketById } from './ticket-service'
import { clearAllData, resetTestDatabase } from '@promptliano/storage/src/test-utils'

describe('Queue Error Handling', () => {
  let testProjectId: number

  beforeEach(async () => {
    await resetTestDatabase()

    const project = await createProject({
      name: 'Error Test Project',
      path: '/test/error-' + Date.now(),
      created: Date.now(),
      updated: Date.now()
    })
    testProjectId = project.id
  })

  afterAll(async () => {
    await clearAllData()
  })

  describe('Invalid Operations', () => {
    test('should error when enqueueing to non-existent queue', async () => {
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Test Ticket',
        status: 'open',
        priority: 'normal'
      })

      await expect(enqueueTicket(ticket.id, 999999, 5)).rejects.toThrow(ApiError)

      await expect(enqueueTicket(ticket.id, 999999, 5)).rejects.toThrow(/not found/)
    })

    test('should error when processing from paused queue', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Paused Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Paused Ticket',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, queue.id, 10)
      await pauseQueue(queue.id)

      const result = await getNextTaskFromQueue(queue.id, 'blocked-agent')

      expect(result.type).toBe('none')
      expect(result.message).toContain('paused')
      expect(result.item).toBeNull()
    })

    test.skip('should prevent invalid status transitions', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Status Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Status Test',
        status: 'closed',
        priority: 'low'
      })

      // Enqueue and mark as completed
      await enqueueTicket(ticket.id, queue.id, 5)
      await updateTicket(ticket.id, { queueStatus: 'completed' })

      // Try to enqueue again (should fail)
      await expect(enqueueTicket(ticket.id, queue.id, 5)).rejects.toThrow(/already in queue|completed/)
    })

    test('should handle enqueueing non-existent ticket', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Valid Queue'
      })

      await expect(enqueueTicket(999999, queue.id, 5)).rejects.toThrow(ApiError)

      await expect(enqueueTicket(999999, queue.id, 5)).rejects.toThrow(/not found/)
    })

    test('should handle enqueueing non-existent task', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Task Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Parent Ticket',
        status: 'open',
        priority: 'normal'
      })

      await expect(enqueueTask(ticket.id, 999999, queue.id, 5)).rejects.toThrow(/not found|invalid/)
    })
  })

  describe('Recovery Scenarios', () => {
    test.skip('should retry failed items', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Retry Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Retry Test',
        status: 'in_progress',
        priority: 'high'
      })

      // Enqueue and mark as in_progress
      await enqueueTicket(ticket.id, queue.id, 10)
      await updateTicket(ticket.id, { queueStatus: 'in_progress' })

      // Fail the item
      await failQueueItem('ticket', ticket.id, 'Network timeout')

      let failed = await getTicketById(ticket.id)
      expect(failed.queueStatus).toBe('failed')
      expect(failed.queueErrorMessage).toBe('Network timeout')

      // Retry by resetting status
      await updateTicket(ticket.id, {
        queueStatus: 'queued',
        queueErrorMessage: null,
        queueStartedAt: null,
        queueCompletedAt: null
      })

      // Should be available again
      const retry = await getNextTaskFromQueue(queue.id, 'retry-agent')
      expect(retry.item?.id).toBe(ticket.id)
      expect(retry.item?.queueStatus).toBe('in_progress')

      // Complete successfully this time
      await completeQueueItem('ticket', ticket.id)

      const completed = await getTicketById(ticket.id)
      expect(completed.queueStatus).toBe('completed')
      expect(completed.queueErrorMessage).toBeNull()
    })

    test('should reset stuck in_progress items', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Stuck Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Stuck Item',
        status: 'in_progress',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, queue.id, 10)

      // Simulate stuck item (old timestamp)
      const oldTimestamp = Date.now() - 1000 * 60 * 60 // 1 hour ago
      await updateTicket(ticket.id, {
        queueStatus: 'in_progress',
        queueStartedAt: oldTimestamp,
        queueAgentId: 'dead-agent'
      })

      // Manual reset (in real system, checkAndHandleTimeouts would do this)
      await updateTicket(ticket.id, {
        queueStatus: 'queued',
        queueStartedAt: null,
        queueAgentId: null
      })

      // Should be available again
      const reset = await getNextTaskFromQueue(queue.id, 'new-agent')
      expect(reset.item?.id).toBe(ticket.id)
      expect(reset.item?.queueAgentId).toBe('new-agent')
    })

    test.skip('should handle missing references gracefully', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Reference Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Orphan Test',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket.id, queue.id, 5)

      // Simulate orphaned reference by setting invalid queue ID
      await updateTicket(ticket.id, { queueId: 999999 })

      // Stats should handle gracefully
      const stats = await getQueueStats(queue.id)
      expect(stats.totalItems).toBe(0)

      // Can re-enqueue after fixing
      await updateTicket(ticket.id, {
        queueId: null,
        queueStatus: null
      })

      const reEnqueued = await enqueueTicket(ticket.id, queue.id, 10)
      expect(reEnqueued.queueId).toBe(queue.id)
    })
  })

  describe('Data Validation', () => {
    test('should reject invalid priorities', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Priority Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Priority Test',
        status: 'open',
        priority: 'invalid' as any // Invalid priority
      }).catch((err) => err)

      // Should have failed validation
      expect(ticket).toBeInstanceOf(Error)
    })

    test('should handle null and undefined fields', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Null Queue',
        description: null as any // Null description
      })

      // Should use default or handle null
      expect(queue.name).toBe('Null Queue')
      expect(queue.description).toBeDefined() // Either null or empty string
    })

    test('should validate required fields', async () => {
      // Try to create queue without name
      await expect(
        createQueue({
          projectId: testProjectId,
          name: '', // Empty name
          description: 'Test'
        })
      ).rejects.toThrow()

      // Try to create ticket without title
      await expect(
        createTicket({
          projectId: testProjectId,
          title: '', // Empty title
          status: 'open',
          priority: 'normal'
        })
      ).rejects.toThrow()
    })

    test.skip('should enforce queue constraints', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Constraint Queue',
        maxParallelItems: 1
      })

      // Create 2 tickets
      const ticket1 = await createTicket({
        projectId: testProjectId,
        title: 'First',
        status: 'open',
        priority: 'high'
      })
      const ticket2 = await createTicket({
        projectId: testProjectId,
        title: 'Second',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket1.id, queue.id, 10)
      await enqueueTicket(ticket2.id, queue.id, 10)

      // First agent gets a task
      const first = await getNextTaskFromQueue(queue.id, 'agent-1')
      expect(first.item).toBeDefined()

      // Second agent should be blocked (maxParallelItems = 1)
      const blocked = await getNextTaskFromQueue(queue.id, 'agent-2')
      expect(blocked.type).toBe('none')
      expect(blocked.message).toContain('parallel limit')
    })
  })

  describe('Edge Case Recovery', () => {
    test('should handle queue deletion with items', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Deletable Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Queue Item',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket.id, queue.id, 5)

      // Delete the queue
      await deleteQueue(queue.id)

      // Queue should be gone
      await expect(getQueueById(queue.id)).rejects.toThrow(/not found/)

      // Ticket should still exist but not be queued
      const orphanTicket = await getTicketById(ticket.id)
      expect(orphanTicket).toBeDefined()
      // Queue fields might be cleared or orphaned depending on implementation
    })

    test('should handle concurrent status updates', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Concurrent Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Concurrent Updates',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, queue.id, 10)

      // Simulate concurrent updates
      const updates = [
        updateTicket(ticket.id, { queueStatus: 'in_progress' }),
        updateTicket(ticket.id, { queuePriority: 15 }),
        updateTicket(ticket.id, { queueAgentId: 'agent-1' })
      ]

      await Promise.allSettled(updates)

      // Final state should be consistent
      const final = await getTicketById(ticket.id)
      expect(final.queueId).toBe(queue.id)
      expect(final.queueStatus).toBeDefined()
      expect(final.queuePriority).toBeDefined()
    })

    test.skip('should handle moving to null queue', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Source Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Movable',
        status: 'open',
        priority: 'low'
      })

      await enqueueTicket(ticket.id, queue.id, 3)

      // Move to null (remove from queue)
      await moveItemToQueue('ticket', ticket.id, null)

      const moved = await getTicketById(ticket.id)
      expect(moved.queueId).toBeNull()
      expect(moved.queueStatus).toBeNull()
      expect(moved.queuePriority).toBe(0)
    })
  })
})

// deleteQueue already imported above
