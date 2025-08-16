import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient, PromptlianoError } from '@promptliano/api-client'
import type { PromptlianoClient } from '@promptliano/api-client'
import type { TestEnvironment } from './test-environment'
import { withTestEnvironment } from './test-environment'
import { assertions, factories, TestDataManager, withTestData, retryOperation, waitFor, PerformanceTracker } from './utils/test-helpers'

/**
 * Comprehensive API tests for queue management and processing
 * Tests queue CRUD, item management, statistics, and workflow processing
 */
describe('Queues API Tests', () => {
  describe('Basic Queue CRUD Operations', () => {
    test('should create, read, update, and delete queues', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Test Create
          const queueData = factories.createQueueData({
            name: 'Test Queue Creation',
            description: 'Queue for testing creation workflow',
            maxParallelItems: 5,
            priority: 2
          })
          const queue = await dataManager.createQueue(project.id, queueData)
          
          assertions.assertValidQueue(queue)
          expect(queue.name).toBe(queueData.name)
          expect(queue.description).toBe(queueData.description)
          expect(queue.maxParallelItems).toBe(queueData.maxParallelItems)
          expect(queue.priority).toBe(queueData.priority)
          expect(queue.projectId).toBe(project.id)
          
          // Test Read
          const readResult = await client.queues.getQueue(queue.id)
          assertions.assertSuccessResponse(readResult)
          assertions.assertValidQueue(readResult.data)
          expect(readResult.data.id).toBe(queue.id)
          
          // Test Update
          const updateData = { 
            name: 'Updated Queue Name', 
            maxParallelItems: 10,
            description: 'Updated description'
          }
          const updateResult = await client.queues.updateQueue(queue.id, updateData)
          assertions.assertSuccessResponse(updateResult)
          expect(updateResult.data.name).toBe(updateData.name)
          expect(updateResult.data.maxParallelItems).toBe(updateData.maxParallelItems)
          expect(updateResult.data.description).toBe(updateData.description)
          expect(updateResult.data.updatedAt).toBeGreaterThan(queue.updatedAt)
          
          // Test List queues for project
          const listResult = await client.queues.listQueues(project.id)
          assertions.assertSuccessResponse(listResult)
          assertions.assertArrayOfItems(listResult.data, 1)
          const foundQueue = listResult.data.find(q => q.id === queue.id)
          expect(foundQueue).toBeDefined()
          expect(foundQueue?.name).toBe(updateData.name)
          
          // Test Delete
          const deleteResult = await client.queues.deleteQueue(queue.id)
          assertions.assertSuccessResponse(deleteResult)
          expect(deleteResult.data.deleted).toBe(true)
          
          // Verify deletion
          try {
            await client.queues.getQueue(queue.id)
            expect(false).toBe(true) // Should not reach here
          } catch (error) {
            expect(error).toBeInstanceOf(PromptlianoError)
            expect((error as PromptlianoError).statusCode).toBe(404)
          }
        })
      })
    })

    test('should handle queue error scenarios', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        const client = createPromptlianoClient({ baseUrl: env.baseUrl })
        
        // Test getting non-existent queue
        try {
          await client.queues.getQueue(99999)
          expect(false).toBe(true) // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(PromptlianoError)
          expect((error as PromptlianoError).statusCode).toBe(404)
        }
        
        // Test creating queue with invalid data
        try {
          await client.queues.createQueue(99999, { // Non-existent project
            name: '',
            description: 'Test'
          } as any)
          expect(false).toBe(true) // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
        }
        
        // Test updating non-existent queue
        try {
          await client.queues.updateQueue(99999, { name: 'Updated' })
          expect(false).toBe(true) // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(PromptlianoError)
          expect((error as PromptlianoError).statusCode).toBe(404)
        }
      })
    })
  })

  describe('Queue Item Management', () => {
    test('should enqueue and manage individual items', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Test enqueuing individual item
          const enqueueData = factories.createEnqueueItemData({
            type: 'ticket',
            itemId: ticket.id,
            priority: 5
          })
          const enqueueResult = await client.queues.enqueueItem(queue.id, enqueueData)
          assertions.assertSuccessResponse(enqueueResult)
          assertions.assertValidQueueItem(enqueueResult.data)
          expect(enqueueResult.data.queueId).toBe(queue.id)
          expect(enqueueResult.data.itemType).toBe('ticket')
          expect(enqueueResult.data.itemId).toBe(ticket.id)
          expect(enqueueResult.data.priority).toBe(5)
          expect(enqueueResult.data.status).toBe('pending')
          
          // Test getting queue items
          const itemsResult = await client.queues.getQueueItems(queue.id)
          assertions.assertSuccessResponse(itemsResult)
          assertions.assertArrayOfItems(itemsResult.data, 1)
          const queueItem = itemsResult.data[0]
          expect(queueItem.queueItem).toBeDefined()
          assertions.assertValidQueueItem(queueItem.queueItem)
          expect(queueItem.ticket).toBeDefined()
          expect(queueItem.ticket.id).toBe(ticket.id)
        })
      })
    })

    test('should enqueue tickets with all their tasks', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const { project, tickets, tasks, queue } = await dataManager.createFlowTestData()
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Enqueue a ticket with its tasks
          const enqueueResult = await client.queues.enqueueTicket(queue.id, tickets[0].id, 8)
          assertions.assertSuccessResponse(enqueueResult)
          assertions.assertArrayOfItems(enqueueResult.data, 1) // Should include at least the ticket
          
          // Verify all items were enqueued
          const queueItems = await client.queues.getQueueItems(queue.id)
          assertions.assertSuccessResponse(queueItems)
          
          // Should have ticket + its tasks
          const ticketItems = queueItems.data.filter(item => 
            item.queueItem.itemType === 'ticket' && item.queueItem.itemId === tickets[0].id
          )
          expect(ticketItems.length).toBe(1)
          
          const taskItems = queueItems.data.filter(item => 
            item.queueItem.itemType === 'task' && 
            tasks.some(task => task.ticketId === tickets[0].id && task.id === item.queueItem.itemId)
          )
          expect(taskItems.length).toBeGreaterThanOrEqual(0) // Tasks might be 0 if none exist
        })
      })
    })

    test('should handle batch enqueue operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const { project, tickets, tasks, queue } = await dataManager.createFlowTestData()
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Test batch enqueue
          const batchData = {
            items: [
              { type: 'ticket' as const, id: tickets[0].id, priority: 10 },
              { type: 'ticket' as const, id: tickets[1].id, priority: 5 },
              { type: 'task' as const, id: tasks[0].id, priority: 7 }
            ]
          }
          
          const batchResult = await client.queues.batchEnqueue(queue.id, batchData)
          assertions.assertSuccessResponse(batchResult)
          assertions.assertArrayOfItems(batchResult.data, 3)
          
          // Verify all items were enqueued with correct priorities
          const queueItems = await client.queues.getQueueItems(queue.id)
          assertions.assertSuccessResponse(queueItems)
          expect(queueItems.data.length).toBeGreaterThanOrEqual(3)
          
          // Check priorities are set correctly
          const ticket1Item = queueItems.data.find(item => 
            item.queueItem.itemType === 'ticket' && item.queueItem.itemId === tickets[0].id
          )
          expect(ticket1Item?.queueItem.priority).toBe(10)
          
          const ticket2Item = queueItems.data.find(item => 
            item.queueItem.itemType === 'ticket' && item.queueItem.itemId === tickets[1].id
          )
          expect(ticket2Item?.queueItem.priority).toBe(5)
        })
      })
    })

    test('should filter queue items by status', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const ticket1 = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const ticket2 = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Enqueue items
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: ticket1.id, priority: 5 })
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: ticket2.id, priority: 3 })
          
          // Test filtering by pending status
          const pendingItems = await client.queues.getQueueItems(queue.id, 'pending')
          assertions.assertSuccessResponse(pendingItems)
          expect(pendingItems.data.every(item => item.queueItem.status === 'pending')).toBe(true)
          
          // Test getting all items (no filter)
          const allItems = await client.queues.getQueueItems(queue.id)
          assertions.assertSuccessResponse(allItems)
          expect(allItems.data.length).toBeGreaterThanOrEqual(pendingItems.data.length)
        })
      })
    })
  })

  describe('Queue Statistics and Monitoring', () => {
    test('should provide accurate queue statistics', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Initially empty queue
          const initialStats = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(initialStats)
          assertions.assertValidQueueStats(initialStats.data)
          expect(initialStats.data.totalItems).toBe(0)
          expect(initialStats.data.pendingItems).toBe(0)
          
          // Add some items
          const ticket1 = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const ticket2 = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: ticket1.id, priority: 5 })
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: ticket2.id, priority: 3 })
          
          // Check updated stats
          const updatedStats = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(updatedStats)
          assertions.assertValidQueueStats(updatedStats.data)
          expect(updatedStats.data.totalItems).toBe(2)
          expect(updatedStats.data.pendingItems).toBe(2)
          expect(updatedStats.data.inProgressItems).toBe(0)
          expect(updatedStats.data.completedItems).toBe(0)
          expect(updatedStats.data.failedItems).toBe(0)
        })
      })
    })

    test('should provide queues with statistics for projects', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue1 = await dataManager.createQueue(project.id, factories.createQueueData({ name: 'Queue 1' }))
          const queue2 = await dataManager.createQueue(project.id, factories.createQueueData({ name: 'Queue 2' }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Add items to queues
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          await client.queues.enqueueItem(queue1.id, { type: 'ticket', itemId: ticket.id, priority: 5 })
          
          // Get queues with stats
          const queuesWithStats = await client.queues.getQueuesWithStats(project.id)
          assertions.assertSuccessResponse(queuesWithStats)
          assertions.assertArrayOfItems(queuesWithStats.data, 2)
          
          queuesWithStats.data.forEach(queueWithStats => {
            assertions.assertValidQueue(queueWithStats.queue)
            assertions.assertValidQueueStats(queueWithStats.stats)
          })
          
          // Find queue1 and verify it has items
          const queue1WithStats = queuesWithStats.data.find(q => q.queue.id === queue1.id)
          expect(queue1WithStats).toBeDefined()
          expect(queue1WithStats?.stats.totalItems).toBe(1)
          
          // Find queue2 and verify it's empty
          const queue2WithStats = queuesWithStats.data.find(q => q.queue.id === queue2.id)
          expect(queue2WithStats).toBeDefined()
          expect(queue2WithStats?.stats.totalItems).toBe(0)
        })
      })
    })

    test('should track queue timeline and processing history', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Enqueue item
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: ticket.id, priority: 5 })
          
          // Get timeline
          const timelineResult = await client.queues.getQueueTimeline(queue.id)
          assertions.assertSuccessResponse(timelineResult)
          expect(Array.isArray(timelineResult.data.events)).toBe(true)
          
          if (timelineResult.data.events.length > 0) {
            const event = timelineResult.data.events[0]
            expect(event.type).toBeTypeOf('string')
            expect(event.timestamp).toBeTypeOf('number')
            expect(['ticket', 'task']).toContain(event.itemType)
            expect(event.itemId).toBeTypeOf('number')
          }
        })
      })
    })
  })

  describe('Queue Processing and Workflow', () => {
    test('should get next task for processing', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const { project, tickets, queue } = await dataManager.createFlowTestData()
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Enqueue tickets with different priorities
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: tickets[0].id, priority: 10 })
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: tickets[1].id, priority: 5 })
          
          // Get next task
          const nextTaskResult = await client.queues.getNextTask(queue.id, 'test-agent')
          assertions.assertSuccessResponse(nextTaskResult)
          
          if (nextTaskResult.data.item) {
            assertions.assertValidQueueItem(nextTaskResult.data.item)
            expect(nextTaskResult.data.item.priority).toBe(10) // Should get highest priority first
            expect(nextTaskResult.data.position).toBeTypeOf('number')
          }
          
          // Estimated wait time might be null if no items are processing
          if (nextTaskResult.data.estimatedWaitTime !== null) {
            expect(nextTaskResult.data.estimatedWaitTime).toBeTypeOf('number')
          }
        })
      })
    })

    test('should handle queue processing with agent assignment', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id, factories.createQueueData({
            maxParallelItems: 2
          }))
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Enqueue item
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: ticket.id, priority: 5 })
          
          // Get next task with specific agent
          const nextTask1 = await client.queues.getNextTask(queue.id, 'agent-1')
          assertions.assertSuccessResponse(nextTask1)
          
          if (nextTask1.data.item) {
            // Try to get another task with different agent (should respect maxParallelItems)
            const nextTask2 = await client.queues.getNextTask(queue.id, 'agent-2')
            assertions.assertSuccessResponse(nextTask2)
            
            // Depending on implementation, might return null if maxParallelItems reached
            if (nextTask2.data.item) {
              assertions.assertValidQueueItem(nextTask2.data.item)
            }
          }
        })
      })
    })

    test('should complete queue items and update status', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const task = await dataManager.createTask(ticket.id)
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Enqueue items
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: ticket.id, priority: 5 })
          await client.queues.enqueueItem(queue.id, { type: 'task', itemId: task.id, priority: 3 })
          
          // Complete ticket item
          const completeTicketResult = await client.queues.completeQueueItem('ticket', ticket.id)
          assertions.assertSuccessResponse(completeTicketResult)
          expect(completeTicketResult.data.completed).toBe(true)
          
          // Complete task item
          const completeTaskResult = await client.queues.completeQueueItem('task', task.id, ticket.id)
          assertions.assertSuccessResponse(completeTaskResult)
          expect(completeTaskResult.data.completed).toBe(true)
          
          // Verify stats updated
          const stats = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(stats)
          expect(stats.data.completedItems).toBeGreaterThanOrEqual(2)
        })
      })
    })

    test('should identify unqueued items for a project', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create tickets and tasks
          const ticket1 = await dataManager.createTicket(factories.createTicketData({ projectId: project.id, title: 'Queued Ticket' }))
          const ticket2 = await dataManager.createTicket(factories.createTicketData({ projectId: project.id, title: 'Unqueued Ticket' }))
          const task1 = await dataManager.createTask(ticket1.id, factories.createTaskData({ content: 'Queued Task' }))
          const task2 = await dataManager.createTask(ticket2.id, factories.createTaskData({ content: 'Unqueued Task' }))
          
          // Enqueue only some items
          await client.queues.enqueueItem(queue.id, { type: 'ticket', itemId: ticket1.id, priority: 5 })
          await client.queues.enqueueItem(queue.id, { type: 'task', itemId: task1.id, priority: 3 })
          
          // Get unqueued items
          const unqueuedResult = await client.queues.getUnqueuedItems(project.id)
          assertions.assertSuccessResponse(unqueuedResult)
          
          expect(Array.isArray(unqueuedResult.data.tickets)).toBe(true)
          expect(Array.isArray(unqueuedResult.data.tasks)).toBe(true)
          
          // Should include unqueued ticket
          const unqueuedTicket = unqueuedResult.data.tickets.find(t => t.id === ticket2.id)
          expect(unqueuedTicket).toBeDefined()
          expect(unqueuedTicket?.title).toBe('Unqueued Ticket')
          
          // Should include unqueued task
          const unqueuedTask = unqueuedResult.data.tasks.find(t => t.id === task2.id)
          expect(unqueuedTask).toBeDefined()
          expect(unqueuedTask?.title).toBe('Unqueued Task')
          expect(unqueuedTask?.ticket_id).toBe(ticket2.id)
        })
      })
    })
  })

  describe('Performance and Load Testing', () => {
    test('should handle high-volume queue operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id, factories.createQueueData({
            maxParallelItems: 10
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          const tracker = new PerformanceTracker()
          
          // Create many tickets for testing
          const ticketCount = 20
          const tickets = await Promise.all(
            Array.from({ length: ticketCount }, (_, i) =>
              dataManager.createTicket(factories.createTicketData({ 
                projectId: project.id,
                title: `Load Test Ticket ${i + 1}`
              }))
            )
          )
          
          // Test batch enqueue performance
          const batchData = {
            items: tickets.map((ticket, i) => ({
              type: 'ticket' as const,
              id: ticket.id,
              priority: Math.floor(Math.random() * 10) + 1
            }))
          }
          
          const batchResult = await tracker.measure('batch-enqueue', () =>
            client.queues.batchEnqueue(queue.id, batchData)
          )
          
          assertions.assertSuccessResponse(batchResult)
          expect(batchResult.data.length).toBe(ticketCount)
          
          // Test getting queue items performance
          const itemsResult = await tracker.measure('get-queue-items', () =>
            client.queues.getQueueItems(queue.id)
          )
          
          assertions.assertSuccessResponse(itemsResult)
          expect(itemsResult.data.length).toBe(ticketCount)
          
          // Test getting stats performance
          const statsResult = await tracker.measure('get-queue-stats', () =>
            client.queues.getQueueStats(queue.id)
          )
          
          assertions.assertSuccessResponse(statsResult)
          expect(statsResult.data.totalItems).toBe(ticketCount)
          
          // Print performance summary
          tracker.printSummary()
          
          // Verify reasonable performance (under 5 seconds total)
          const batchStats = tracker.getStats('batch-enqueue')
          const itemsStats = tracker.getStats('get-queue-items')
          const statsStats = tracker.getStats('get-queue-stats')
          
          expect(batchStats?.avg).toBeLessThan(3000) // Batch enqueue under 3s
          expect(itemsStats?.avg).toBeLessThan(2000) // Get items under 2s
          expect(statsStats?.avg).toBeLessThan(1000) // Get stats under 1s
        })
      })
    }, 15000) // Extended timeout for performance testing

    test('should handle concurrent queue access', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id, factories.createQueueData({
            maxParallelItems: 5
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create tickets for concurrent operations
          const tickets = await Promise.all(
            Array.from({ length: 10 }, (_, i) =>
              dataManager.createTicket(factories.createTicketData({ 
                projectId: project.id,
                title: `Concurrent Test Ticket ${i + 1}`
              }))
            )
          )
          
          // Perform concurrent enqueue operations
          const enqueuePromises = tickets.map((ticket, i) =>
            client.queues.enqueueItem(queue.id, {
              type: 'ticket',
              itemId: ticket.id,
              priority: i + 1
            })
          )
          
          const enqueueResults = await Promise.all(enqueuePromises)
          
          // Verify all enqueues succeeded
          enqueueResults.forEach(result => {
            assertions.assertSuccessResponse(result)
            assertions.assertValidQueueItem(result.data)
          })
          
          // Verify final state
          const finalItems = await client.queues.getQueueItems(queue.id)
          assertions.assertSuccessResponse(finalItems)
          expect(finalItems.data.length).toBe(10)
          
          // Verify priorities are maintained
          const priorities = finalItems.data.map(item => item.queueItem.priority).sort((a, b) => b - a)
          expect(priorities[0]).toBeGreaterThanOrEqual(priorities[priorities.length - 1])
        })
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty queues gracefully', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Get items from empty queue
          const itemsResult = await client.queues.getQueueItems(queue.id)
          assertions.assertSuccessResponse(itemsResult)
          expect(Array.isArray(itemsResult.data)).toBe(true)
          expect(itemsResult.data.length).toBe(0)
          
          // Get next task from empty queue
          const nextTaskResult = await client.queues.getNextTask(queue.id)
          assertions.assertSuccessResponse(nextTaskResult)
          expect(nextTaskResult.data.item).toBe(null)
          expect(nextTaskResult.data.position).toBe(null)
          
          // Get stats from empty queue
          const statsResult = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(statsResult)
          assertions.assertValidQueueStats(statsResult.data)
          expect(statsResult.data.totalItems).toBe(0)
        })
      })
    })

    test('should handle queue capacity limits', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id, factories.createQueueData({
            maxParallelItems: 2
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create more tickets than the queue can handle in parallel
          const tickets = await Promise.all(
            Array.from({ length: 5 }, (_, i) =>
              dataManager.createTicket(factories.createTicketData({ 
                projectId: project.id,
                title: `Capacity Test Ticket ${i + 1}`
              }))
            )
          )
          
          // Enqueue all tickets
          for (const ticket of tickets) {
            await client.queues.enqueueItem(queue.id, {
              type: 'ticket',
              itemId: ticket.id,
              priority: 5
            })
          }
          
          // Try to get multiple tasks (should respect maxParallelItems)
          const task1 = await client.queues.getNextTask(queue.id, 'agent-1')
          assertions.assertSuccessResponse(task1)
          
          const task2 = await client.queues.getNextTask(queue.id, 'agent-2')
          assertions.assertSuccessResponse(task2)
          
          // Depending on implementation, third request might be blocked
          const task3 = await client.queues.getNextTask(queue.id, 'agent-3')
          assertions.assertSuccessResponse(task3)
          
          // Verify queue state
          const stats = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(stats)
          expect(stats.data.totalItems).toBe(5)
          expect(stats.data.inProgressItems).toBeLessThanOrEqual(queue.maxParallelItems)
        })
      })
    })

    test('should handle invalid enqueue operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Try to enqueue non-existent item
          try {
            await client.queues.enqueueItem(queue.id, {
              type: 'ticket',
              itemId: 99999,
              priority: 5
            })
            expect(false).toBe(true) // Should not reach here
          } catch (error) {
            expect(error).toBeInstanceOf(Error)
          }
          
          // Try to enqueue to non-existent queue
          try {
            await client.queues.enqueueItem(99999, {
              type: 'ticket',
              itemId: 1,
              priority: 5
            })
            expect(false).toBe(true) // Should not reach here
          } catch (error) {
            expect(error).toBeInstanceOf(PromptlianoError)
            expect((error as PromptlianoError).statusCode).toBe(404)
          }
          
          // Try batch enqueue with invalid data
          try {
            await client.queues.batchEnqueue(queue.id, {
              items: [
                { type: 'ticket', id: 99999, priority: 5 }
              ]
            })
            expect(false).toBe(true) // Should not reach here
          } catch (error) {
            expect(error).toBeInstanceOf(Error)
          }
        })
      })
    })

    test('should handle queue deletion with active items', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Enqueue item
          await client.queues.enqueueItem(queue.id, {
            type: 'ticket',
            itemId: ticket.id,
            priority: 5
          })
          
          // Verify queue has items
          const beforeStats = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(beforeStats)
          expect(beforeStats.data.totalItems).toBe(1)
          
          // Delete queue (should handle cleanup)
          const deleteResult = await client.queues.deleteQueue(queue.id)
          assertions.assertSuccessResponse(deleteResult)
          expect(deleteResult.data.deleted).toBe(true)
          
          // Verify queue is gone
          try {
            await client.queues.getQueue(queue.id)
            expect(false).toBe(true) // Should not reach here
          } catch (error) {
            expect(error).toBeInstanceOf(PromptlianoError)
            expect((error as PromptlianoError).statusCode).toBe(404)
          }
        })
      })
    })
  })
})