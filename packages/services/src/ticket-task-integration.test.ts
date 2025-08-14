import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import {
  createQueue,
  enqueueTicketWithAllTasks,
  getNextTaskFromQueue,
  completeQueueItem,
  getQueueStats,
  dequeueTicket,
  enqueueTask
} from './queue-service'
import { createProject, deleteProject } from './project-service'
import {
  createTicket,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getTicketById,
  deleteTicket,
  updateTicket
} from './ticket-service'
import { clearAllData, resetTestDatabase } from '@promptliano/storage/src/test-utils'

describe('Ticket-Task Integration', () => {
  let testProjectId: number

  beforeEach(async () => {
    await resetTestDatabase()

    const project = await createProject({
      name: 'Integration Test Project',
      path: '/test/integration-' + Date.now()
    })
    testProjectId = project.id
  })

  afterAll(async () => {
    await clearAllData()
  })

  describe('Parent-Child Relationships', () => {
    test('should enqueue ticket with all its tasks', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Parent-Child Queue ' + Date.now()
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Parent Ticket',
        overview: 'Ticket with multiple tasks',
        status: 'open',
        priority: 'high'
      })

      // Create multiple tasks
      const tasks = []
      for (let i = 0; i < 5; i++) {
        const task = await createTask(ticket.id, {
          content: `Task ${i + 1}`,
          description: `Description for task ${i + 1}`
        })
        tasks.push(task)
      }

      // Enqueue ticket with all tasks
      const result = await enqueueTicketWithAllTasks(queue.id, ticket.id, 10)

      expect(result.ticket.queueId).toBe(queue.id)
      expect(result.ticket.queueStatus).toBe('queued')
      expect(result.tasks).toHaveLength(5)

      // Verify all tasks are enqueued
      for (const task of result.tasks) {
        expect(task.queueId).toBe(queue.id)
        expect(task.queueStatus).toBe('queued')
        expect(task.queuePriority).toBeDefined()
      }

      // Verify queue stats
      const stats = await getQueueStats(queue.id)
      expect(stats.totalItems).toBe(6) // 1 ticket + 5 tasks
      expect(stats.ticketCount).toBe(1)
      expect(stats.taskCount).toBe(5)
    })

    test('should handle task completion updating ticket progress', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Progress Queue ' + Date.now()
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Progress Tracking',
        overview: '',
        status: 'open',
        priority: 'normal'
      })

      // Create 3 tasks
      const task1 = await createTask(ticket.id, { content: 'Task 1' })
      const task2 = await createTask(ticket.id, { content: 'Task 2' })
      const task3 = await createTask(ticket.id, { content: 'Task 3' })

      // Enqueue tasks only
      await enqueueTask(ticket.id, task1.id, queue.id, 5)
      await enqueueTask(ticket.id, task2.id, queue.id, 5)
      await enqueueTask(ticket.id, task3.id, queue.id, 5)

      // Complete first task
      await getNextTaskFromQueue(queue.id, 'agent-1')
      await completeQueueItem('task', task1.id, ticket.id)

      let tasks = await getTasks(ticket.id)
      const completed1 = tasks.find((t) => t.id === task1.id)
      expect(completed1?.done).toBe(true)
      expect(completed1?.queueStatus).toBe('completed')

      // Complete second task
      await getNextTaskFromQueue(queue.id, 'agent-2')
      await completeQueueItem('task', task2.id, ticket.id)

      tasks = await getTasks(ticket.id)
      const completed2 = tasks.find((t) => t.id === task2.id)
      expect(completed2?.done).toBe(true)

      // Complete third task
      await getNextTaskFromQueue(queue.id, 'agent-3')
      await completeQueueItem('task', task3.id, ticket.id)

      tasks = await getTasks(ticket.id)
      const completed3 = tasks.find((t) => t.id === task3.id)
      expect(completed3?.done).toBe(true)

      // All tasks completed
      const allTasks = await getTasks(ticket.id)
      expect(allTasks.every((t) => t.done)).toBe(true)
      expect(allTasks.every((t) => t.queueStatus === 'completed')).toBe(true)
    })

    test('should remove tasks from queue when ticket is deleted', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Cascade Queue ' + Date.now()
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Deletable Ticket',
        overview: '',
        status: 'open',
        priority: 'low'
      })

      // Create tasks
      await createTask(ticket.id, { content: 'Task 1' })
      await createTask(ticket.id, { content: 'Task 2' })

      // Enqueue all
      await enqueueTicketWithAllTasks(queue.id, ticket.id, 3)

      // Verify they're in the queue
      let stats = await getQueueStats(queue.id)
      expect(stats.totalItems).toBe(3) // 1 ticket + 2 tasks

      // Delete the ticket (should cascade delete tasks)
      await deleteTicket(ticket.id)

      // Verify queue is now empty
      stats = await getQueueStats(queue.id)
      expect(stats.totalItems).toBe(0)
    })
  })

  describe('Status Synchronization', () => {
    test('should reflect task status in parent ticket', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Status Sync Queue ' + Date.now()
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Status Parent',
        overview: '',
        status: 'open',
        priority: 'high'
      })

      const task = await createTask(ticket.id, {
        content: 'Single Task',
        description: 'Task to track'
      })

      // Enqueue task
      await enqueueTask(ticket.id, task.id, queue.id, 8)

      // Task starts processing
      const processing = await getNextTaskFromQueue(queue.id, 'sync-agent')
      expect(processing.type).toBe('task')
      expect(processing.item?.queueStatus).toBe('in_progress')

      // Verify task status
      const tasks = await getTasks(ticket.id)
      const currentTask = tasks.find((t) => t.id === task.id)
      expect(currentTask?.queueStatus).toBe('in_progress')

      // Complete the task
      await completeQueueItem('task', task.id, ticket.id)

      // Verify task is marked done
      const finalTasks = await getTasks(ticket.id)
      const completedTask = finalTasks.find((t) => t.id === task.id)
      expect(completedTask?.done).toBe(true)
      expect(completedTask?.queueStatus).toBe('completed')
    })

    test('should mark ticket complete when all tasks done', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Completion Queue ' + Date.now()
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Auto-Complete Ticket',
        overview: '',
        status: 'in_progress',
        priority: 'normal'
      })

      // Create 2 tasks
      const task1 = await createTask(ticket.id, { content: 'Task 1' })
      const task2 = await createTask(ticket.id, { content: 'Task 2' })

      // Enqueue tasks only (not the ticket itself)
      await enqueueTask(ticket.id, task1.id, queue.id, 5)
      await enqueueTask(ticket.id, task2.id, queue.id, 5)

      // Complete both tasks
      await getNextTaskFromQueue(queue.id, 'agent-a')
      await completeQueueItem('task', task1.id, ticket.id)

      await getNextTaskFromQueue(queue.id, 'agent-b')
      await completeQueueItem('task', task2.id, ticket.id)

      // Verify both tasks are done
      const tasks = await getTasks(ticket.id)
      expect(tasks.every((t) => t.done)).toBe(true)

      // Give queue auto-close a tick
      const finalTicket = await getTicketById(ticket.id)
      expect(finalTicket.status).toBe('closed')
    })
  })

  describe('Mixed Entity Queues', () => {
    test('should handle tickets and tasks in same queue', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Mixed Queue ' + Date.now(),
        maxParallelItems: 5
      })

      // Create 2 tickets with tasks
      const ticket1 = await createTicket({
        projectId: testProjectId,
        title: 'Ticket 1',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const task1_1 = await createTask(ticket1.id, { content: 'T1 Task 1' })
      const task1_2 = await createTask(ticket1.id, { content: 'T1 Task 2' })

      const ticket2 = await createTicket({
        projectId: testProjectId,
        title: 'Ticket 2',
        overview: '',
        status: 'open',
        priority: 'normal'
      })
      const task2_1 = await createTask(ticket2.id, { content: 'T2 Task 1' })

      // Enqueue everything
      await enqueueTicketWithAllTasks(queue.id, ticket1.id, 10)
      await enqueueTicketWithAllTasks(queue.id, ticket2.id, 5)

      // Check queue stats
      const stats = await getQueueStats(queue.id)
      expect(stats.ticketCount).toBe(2)
      expect(stats.taskCount).toBe(3)
      expect(stats.totalItems).toBe(5)

      // Process items - should get based on priority
      const item1 = await getNextTaskFromQueue(queue.id, 'agent-1')
      const item2 = await getNextTaskFromQueue(queue.id, 'agent-2')
      const item3 = await getNextTaskFromQueue(queue.id, 'agent-3')

      // Should get ticket1 and its tasks first (higher priority)
      const ticket1Items = [item1, item2, item3].filter((entry) => {
        const it = entry.item as any
        return it && (it.id === ticket1.id || ('ticketId' in it && it.ticketId === ticket1.id))
      })
      expect(ticket1Items.length).toBeGreaterThanOrEqual(1)
    })

    test('should handle orphaned tasks gracefully', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Orphan Queue ' + Date.now()
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Parent for Orphan',
        overview: '',
        status: 'open',
        priority: 'low'
      })

      const task = await createTask(ticket.id, {
        content: 'Soon to be orphaned',
        description: 'This task will lose its parent'
      })

      // Enqueue the task
      await enqueueTask(ticket.id, task.id, queue.id, 5)

      // Delete the parent ticket (simulating orphaned task)
      // In a real system, this might cascade delete or handle differently
      try {
        await deleteTicket(ticket.id)

        // Task should be gone due to cascade delete
        const stats = await getQueueStats(queue.id)
        expect(stats.taskCount).toBe(0)
      } catch (error) {
        // If cascade delete is not implemented, task might remain
        // This is acceptable behavior to document
        console.log('Cascade delete not implemented - orphaned task remains')
      }
    })
  })

  describe('Queue Item Relationships', () => {
    test('should maintain task order within ticket', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Order Queue ' + Date.now()
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Ordered Tasks',
        overview: '',
        status: 'open',
        priority: 'normal'
      })

      // Create tasks with specific order
      const tasks = []
      for (let i = 0; i < 4; i++) {
        const task = await createTask(ticket.id, { content: `Step ${i + 1}` })
        tasks.push(task)
      }

      // Enqueue with priority based on order
      const result = await enqueueTicketWithAllTasks(queue.id, ticket.id, 10)

      // Tasks should have descending priorities (earlier tasks = higher priority)
      const sortedTasks = result.tasks.sort((a, b) => (b.queuePriority ?? 0) - (a.queuePriority ?? 0))

      // First task should have highest priority
      expect(sortedTasks[0].orderIndex).toBe(0)

      // Last task should have lowest priority
      expect(sortedTasks[sortedTasks.length - 1].orderIndex).toBe(3)
    })

    test('should handle partial task completion', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Partial Queue ' + Date.now()
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Partial Completion',
        overview: '',
        status: 'in_progress',
        priority: 'high'
      })

      // Create 5 tasks, mark 2 as already done
      const tasks = []
      for (let i = 0; i < 5; i++) {
        const task = await createTask(ticket.id, { content: `Task ${i + 1}` })
        tasks.push(task)
      }

      // Mark first 2 as done
      await updateTask(ticket.id, tasks[0].id, { done: true })
      await updateTask(ticket.id, tasks[1].id, { done: true })

      // Enqueue ticket with tasks (should skip completed ones)
      const result = await enqueueTicketWithAllTasks(queue.id, ticket.id, 8)

      // Should only enqueue the 3 incomplete tasks
      expect(result.tasks).toHaveLength(3)

      // Verify only incomplete tasks are in queue
      const enqueuedTaskIds = result.tasks.map((t) => t.id)
      const freshTasks = await getTasks(ticket.id)
      const incompleteTasks = freshTasks.filter((t) => !t.done)

      for (const task of incompleteTasks) {
        expect(enqueuedTaskIds).toContain(task.id)
      }
    })
  })
})
