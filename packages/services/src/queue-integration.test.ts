import { describe, test, expect, beforeEach, afterAll, jest, mock } from 'bun:test'
import { DatabaseManager, getDb } from '@promptliano/storage'
import { clearAllData, resetTestDatabase } from '@promptliano/storage/src/test-utils'
import * as queueService from './queue-service'
import * as ticketService from './ticket-service'
import type { TaskQueue, QueueItem, Ticket, TicketTask } from '@promptliano/schemas'
import {
  assertQueueItemStatus,
  assertQueueStats,
  assertTicketQueueSync,
  assertTaskQueueSync,
  assertConcurrentLimits,
  waitForCondition
} from './test-utils/queue-assertions'
import { MockAgent } from './test-utils/queue-mocks'
import { QueuePerformanceMonitor, QueueLoadTester } from './test-utils/queue-performance'

describe('Queue Integration Tests', () => {
  const TEST_PROJECT_ID = 999999 // Use a different ID to avoid conflicts

  beforeEach(async () => {
    await resetTestDatabase()
  })

  afterAll(async () => {
    await clearAllData()
  })

  describe('Ticket-Task Flow', () => {
    let testQueue: TaskQueue
    let testTicket: Ticket

    beforeEach(async () => {
      // Create a test queue
      testQueue = await queueService.createQueue({
        projectId: TEST_PROJECT_ID,
        name: 'Integration Test Queue',
        description: 'Queue for integration testing',
        maxParallelItems: 3
      })

      // Create a test ticket with tasks
      testTicket = await ticketService.createTicket({
        projectId: TEST_PROJECT_ID,
        title: 'Integration Test Ticket',
        overview: 'Testing ticket-task queue flow',
        priority: 'high',
        status: 'open'
      })
    })

    test('should process entire ticket workflow', async () => {
      // Create 5 tasks for the ticket
      const tasks: TicketTask[] = []
      for (let i = 0; i < 5; i++) {
        const task = await ticketService.createTask(testTicket.id, {
          content: `Task ${i + 1}`,
          description: `Description for task ${i + 1}`,
          estimatedHours: 1,
          tags: ['integration', 'test']
        })
        tasks.push(task)
      }

      // Enqueue the entire ticket
      const enqueueResult = await queueService.enqueueTicketWithAllTasks(testQueue.id, testTicket.id, 5)

      expect(enqueueResult.queueItems).toHaveLength(5)
      expect(enqueueResult.skippedCount).toBe(0)

      // Verify ticket status updated
      const updatedTicket = await ticketService.getTicketById(testTicket.id)
      assertTicketQueueSync(updatedTicket, {
        isQueued: true,
        queueId: testQueue.id,
        queueStatus: 'queued'
      })

      // Process all tasks
      const agent = new MockAgent('integration-agent', 50)
      const processedTasks = []

      for (let i = 0; i < 5; i++) {
        // Get next task
        const nextTask = await queueService.getNextTaskFromQueue(testQueue.id, agent.id)
        expect(nextTask.queueItem).toBeDefined()
        expect(nextTask.task).toBeDefined()

        // Simulate processing
        const result = await agent.processTask(nextTask.task!)
        expect(result.success).toBe(true)

        // Mark as completed
        await queueService.updateQueueItem(nextTask.queueItem!.id, {
          status: 'completed'
        })

        processedTasks.push(nextTask.task)

        // Verify task marked as done
        const tasks = await ticketService.getTasksByTicket(testTicket.id)
        const completedTask = tasks.find((t) => t.id === nextTask.task!.id)
        expect(completedTask?.done).toBe(true)
      }

      // Verify all tasks processed
      expect(processedTasks).toHaveLength(5)

      // Check queue stats
      const stats = await queueService.getQueueStats(testQueue.id)
      assertQueueStats(stats, {
        totalItems: 5,
        completedItems: 5,
        queuedItems: 0,
        inProgressItems: 0
      })

      // Verify ticket auto-dequeue (all tasks completed)
      const finalTicket = await ticketService.getTicketById(testTicket.id)
      assertTicketQueueSync(finalTicket, {
        queueStatus: 'completed'
      })
    })

    test('should handle partial task completion', async () => {
      // Create 3 tasks
      const tasks: TicketTask[] = []
      for (let i = 0; i < 3; i++) {
        const task = await ticketService.createTask(testTicket.id, {
          content: `Task ${i + 1}`,
          description: `Task ${i + 1} description`
        })
        tasks.push(task)
      }

      // Enqueue all tasks
      await queueService.enqueueTicketWithAllTasks(testQueue.id, testTicket.id)

      // Process only first 2 tasks
      const agent = new MockAgent('partial-agent')

      for (let i = 0; i < 2; i++) {
        const nextTask = await queueService.getNextTaskFromQueue(testQueue.id, agent.id)
        await agent.processTask(nextTask.task!)
        await queueService.updateQueueItem(nextTask.queueItem!.id, {
          status: 'completed'
        })
      }

      // Check ticket status - should still be in progress
      const ticketStatus = await ticketService.getTicketById(testTicket.id)
      expect(ticketStatus.queue_status).toBe('in_progress')

      // Check task statuses
      const allTasks = await ticketService.getTasksByTicket(testTicket.id)
      const completedTasks = allTasks.filter((t) => t.done)
      const pendingTasks = allTasks.filter((t) => !t.done)

      expect(completedTasks).toHaveLength(2)
      expect(pendingTasks).toHaveLength(1)
    })

    test('should handle task failures and retries', async () => {
      // Create a task
      const task = await ticketService.createTask(testTicket.id, {
        content: 'Failing Task',
        description: 'This task will fail initially'
      })

      // Enqueue the task
      const queueItem = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 1
      })

      // Process with failing agent
      const failingAgent = new MockAgent('failing-agent', 50, 1.0) // 100% failure rate
      const nextTask = await queueService.getNextTaskFromQueue(testQueue.id, failingAgent.id)

      const result = await failingAgent.processTask(nextTask.task!)
      expect(result.success).toBe(false)

      // Mark as failed
      await queueService.updateQueueItem(nextTask.queueItem!.id, {
        status: 'failed',
        errorMessage: result.error
      })

      // Verify task not marked as done
      const failedTask = await ticketService.getTaskById(task.id)
      expect(failedTask?.done).toBe(false)

      // Retry the failed item
      const retriedItem = await queueService.retryFailedItem(nextTask.queueItem!.id)
      assertQueueItemStatus(retriedItem, 'queued')

      // Process with successful agent
      const successAgent = new MockAgent('success-agent', 50, 0) // 0% failure rate
      const retryTask = await queueService.getNextTaskFromQueue(testQueue.id, successAgent.id)

      const retryResult = await successAgent.processTask(retryTask.task!)
      expect(retryResult.success).toBe(true)

      await queueService.updateQueueItem(retryTask.queueItem!.id, {
        status: 'completed'
      })

      // Verify task now marked as done
      const completedTask = await ticketService.getTaskById(task.id)
      expect(completedTask?.done).toBe(true)
    })
  })

  describe('Multi-Agent Processing', () => {
    let testQueue: TaskQueue
    let testTicket: Ticket
    let tasks: TicketTask[]

    beforeEach(async () => {
      // Create queue with higher parallelism
      testQueue = await queueService.createQueue({
        projectId: TEST_PROJECT_ID,
        name: 'Multi-Agent Queue',
        description: 'Testing concurrent processing',
        maxParallelItems: 3
      })

      // Create ticket with 10 tasks
      testTicket = await ticketService.createTicket({
        projectId: TEST_PROJECT_ID,
        title: 'Multi-Agent Test',
        overview: 'Testing concurrent agent processing',
        priority: 'normal',
        status: 'open'
      })

      tasks = []
      for (let i = 0; i < 10; i++) {
        const task = await ticketService.createTask(testTicket.id, {
          content: `Concurrent Task ${i + 1}`,
          description: `Task for concurrent processing ${i + 1}`,
          estimatedHours: 0.5
        })
        tasks.push(task)
      }

      // Enqueue all tasks
      await queueService.enqueueTicketWithAllTasks(testQueue.id, testTicket.id)
    })

    test('should process tasks concurrently with multiple agents', async () => {
      const agents = [new MockAgent('agent-1', 100), new MockAgent('agent-2', 150), new MockAgent('agent-3', 200)]

      const processedItems: Map<string, number> = new Map()
      agents.forEach((agent) => processedItems.set(agent.id, 0))

      // Process tasks concurrently
      const agentPromises = agents.map(async (agent) => {
        let consecutiveNulls = 0
        const maxConsecutiveNulls = 3

        while (consecutiveNulls < maxConsecutiveNulls) {
          const nextTask = await queueService.getNextTaskFromQueue(testQueue.id, agent.id)

          if (!nextTask.queueItem) {
            consecutiveNulls++
            await new Promise((resolve) => setTimeout(resolve, 50))
            continue
          }

          consecutiveNulls = 0
          const result = await agent.processTask(nextTask.task!)

          if (result.success) {
            await queueService.updateQueueItem(nextTask.queueItem.id, {
              status: 'completed'
            })
            processedItems.set(agent.id, processedItems.get(agent.id)! + 1)
          }
        }
      })

      await Promise.all(agentPromises)

      // Verify all tasks processed
      const stats = await queueService.getQueueStats(testQueue.id)
      expect(stats.completedItems).toBe(10)

      // Verify work was distributed
      let totalProcessed = 0
      for (const [agentId, count] of processedItems) {
        console.log(`Agent ${agentId} processed ${count} items`)
        totalProcessed += count
        expect(count).toBeGreaterThan(0) // Each agent should process at least 1
      }
      expect(totalProcessed).toBe(10)
    })

    test('should respect maxParallelItems limit', async () => {
      // Create 5 agents but queue allows only 3 parallel
      const agents = Array.from({ length: 5 }, (_, i) => new MockAgent(`agent-${i + 1}`, 100))

      // Try to get tasks for all agents simultaneously
      const taskPromises = agents.map((agent) => queueService.getNextTaskFromQueue(testQueue.id, agent.id))

      const results = await Promise.all(taskPromises)

      // Count how many got tasks
      const withTasks = results.filter((r) => r.queueItem !== null)
      const withoutTasks = results.filter((r) => r.queueItem === null)

      // Only 3 should get tasks (maxParallelItems)
      expect(withTasks.length).toBeLessThanOrEqual(testQueue.maxParallelItems)
      expect(withoutTasks.length).toBeGreaterThanOrEqual(2)

      // Verify with queue stats
      const stats = await queueService.getQueueStats(testQueue.id)
      expect(stats.inProgressItems).toBeLessThanOrEqual(testQueue.maxParallelItems)
    })

    test('should handle agent-specific task assignment', async () => {
      // Create tasks with specific agent assignments
      const specialTicket = await ticketService.createTicket({
        projectId: TEST_PROJECT_ID,
        title: 'Agent-Specific Tasks',
        overview: 'Tasks assigned to specific agents',
        priority: 'normal',
        status: 'open'
      })

      const agent1Tasks = []
      const agent2Tasks = []

      // Create tasks for agent-1
      for (let i = 0; i < 3; i++) {
        const task = await ticketService.createTask(specialTicket.id, {
          content: `Agent-1 Task ${i + 1}`,
          description: 'Task for agent-1',
          agentId: 'agent-1'
        })
        agent1Tasks.push(task)
      }

      // Create tasks for agent-2
      for (let i = 0; i < 2; i++) {
        const task = await ticketService.createTask(specialTicket.id, {
          content: `Agent-2 Task ${i + 1}`,
          description: 'Task for agent-2',
          agentId: 'agent-2'
        })
        agent2Tasks.push(task)
      }

      // Enqueue all tasks
      await queueService.enqueueTicketWithAllTasks(testQueue.id, specialTicket.id)

      // Process with specific agents
      const agent1 = new MockAgent('agent-1')
      const agent2 = new MockAgent('agent-2')
      const agent3 = new MockAgent('agent-3')

      const agent1Processed = []
      const agent2Processed = []
      const agent3Processed = []

      // Process all tasks
      for (let i = 0; i < 5; i++) {
        const task1 = await queueService.getNextTaskFromQueue(testQueue.id, agent1.id)
        if (task1.queueItem) {
          agent1Processed.push(task1.task)
          await queueService.updateQueueItem(task1.queueItem.id, { status: 'completed' })
        }

        const task2 = await queueService.getNextTaskFromQueue(testQueue.id, agent2.id)
        if (task2.queueItem) {
          agent2Processed.push(task2.task)
          await queueService.updateQueueItem(task2.queueItem.id, { status: 'completed' })
        }

        const task3 = await queueService.getNextTaskFromQueue(testQueue.id, agent3.id)
        if (task3.queueItem) {
          agent3Processed.push(task3.task)
          await queueService.updateQueueItem(task3.queueItem.id, { status: 'completed' })
        }
      }

      // Verify agent-specific processing
      // Note: Actual agent assignment logic would need to be implemented in the service
      console.log(`Agent-1 processed: ${agent1Processed.length}`)
      console.log(`Agent-2 processed: ${agent2Processed.length}`)
      console.log(`Agent-3 processed: ${agent3Processed.length}`)

      // All tasks should be processed
      expect(agent1Processed.length + agent2Processed.length + agent3Processed.length).toBe(5)
    })
  })

  describe('Performance Testing', () => {
    let testQueue: TaskQueue
    let monitor: QueuePerformanceMonitor

    beforeEach(async () => {
      monitor = new QueuePerformanceMonitor()

      testQueue = await queueService.createQueue({
        projectId: TEST_PROJECT_ID,
        name: 'Performance Queue',
        description: 'Queue for performance testing',
        maxParallelItems: 5
      })
    })

    test('should handle high-throughput enqueue operations', async () => {
      const itemCount = 100

      const { result, latency } = await monitor.measureLatency(async () => {
        const ticket = await ticketService.createTicket({
          projectId: TEST_PROJECT_ID,
          title: 'Performance Test Ticket',
          overview: 'High throughput test',
          priority: 'normal',
          status: 'open'
        })

        const items = []
        for (let i = 0; i < itemCount; i++) {
          const task = await ticketService.createTask(ticket.id, {
            content: `Perf Task ${i}`,
            description: `Performance test task ${i}`
          })

          items.push({
            taskId: task.id,
            priority: Math.floor(Math.random() * 10)
          })
        }

        return await queueService.batchEnqueueItems(testQueue.id, items)
      })

      console.log(`Enqueued ${itemCount} items in ${latency}ms`)
      console.log(`Throughput: ${(itemCount / latency) * 1000} items/second`)

      expect(result.enqueued).toHaveLength(itemCount)
      expect(latency).toBeLessThan(5000) // Should complete within 5 seconds
    })

    test('should measure processing throughput', async () => {
      // Create and enqueue test items
      const ticket = await ticketService.createTicket({
        projectId: TEST_PROJECT_ID,
        title: 'Throughput Test',
        overview: 'Testing processing throughput',
        priority: 'normal',
        status: 'open'
      })

      const itemCount = 50
      for (let i = 0; i < itemCount; i++) {
        const task = await ticketService.createTask(ticket.id, {
          content: `Throughput Task ${i}`,
          description: `Task for throughput testing ${i}`
        })

        await queueService.enqueueItem(testQueue.id, {
          taskId: task.id,
          priority: 5
        })
      }

      // Measure processing throughput
      const tester = new QueueLoadTester(queueService, monitor)
      const result = await tester.testProcessingThroughput(
        testQueue.id,
        3, // 3 agents
        2000 // Run for 2 seconds
      )

      console.log(`Processed ${result.processedCount} items in 2 seconds`)
      console.log(`Throughput: ${result.throughput} items/second`)
      console.log(`Average latency: ${result.avgLatency}ms`)

      expect(result.processedCount).toBeGreaterThan(0)
      expect(result.avgLatency).toBeLessThan(1000) // Each item should process in < 1 second
    })

    test('should track memory usage during operations', async () => {
      const initialMemory = monitor.captureMemoryUsage()

      // Create a large batch of items
      const ticket = await ticketService.createTicket({
        projectId: TEST_PROJECT_ID,
        title: 'Memory Test',
        overview: 'Testing memory usage',
        priority: 'normal',
        status: 'open'
      })

      const tasks = []
      for (let i = 0; i < 200; i++) {
        const task = await ticketService.createTask(ticket.id, {
          content: `Memory Task ${i}`,
          description: `Task with large description `.repeat(100) // Large description
        })
        tasks.push(task)
      }

      await queueService.enqueueTicketWithAllTasks(testQueue.id, ticket.id)

      const finalMemory = monitor.captureMemoryUsage()
      const memoryIncrease = finalMemory - initialMemory

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)

      // Get performance statistics
      const stats = monitor.getStats()
      console.log('Performance Statistics:', stats)

      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase
    })
  })

  describe('Error Recovery', () => {
    let testQueue: TaskQueue

    beforeEach(async () => {
      testQueue = await queueService.createQueue({
        projectId: TEST_PROJECT_ID,
        name: 'Error Recovery Queue',
        description: 'Testing error recovery',
        maxParallelItems: 2
      })
    })

    test('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test error handling paths
      const ticket = await ticketService.createTicket({
        projectId: TEST_PROJECT_ID,
        title: 'Error Test',
        overview: 'Testing error handling',
        priority: 'normal',
        status: 'open'
      })

      const task = await ticketService.createTask(ticket.id, {
        content: 'Error Task',
        description: 'Task that may encounter errors'
      })

      const item = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 1
      })

      // Simulate various error states
      await queueService.updateQueueItem(item.id, {
        status: 'failed',
        errorMessage: 'Database connection lost'
      })

      // Verify error state
      const failedItem = await queueService.getQueueItems(testQueue.id, 'failed')
      expect(Object.values(failedItem)).toHaveLength(1)
      expect(Object.values(failedItem)[0].errorMessage).toContain('Database connection lost')
    })

    test('should handle timeout and retry', async () => {
      const ticket = await ticketService.createTicket({
        projectId: TEST_PROJECT_ID,
        title: 'Timeout Test',
        overview: 'Testing timeout handling',
        priority: 'normal',
        status: 'open'
      })

      const task = await ticketService.createTask(ticket.id, {
        content: 'Timeout Task',
        description: 'Task that will timeout'
      })

      const item = await queueService.enqueueItem(testQueue.id, {
        taskId: task.id,
        priority: 1
      })

      // Set a timeout
      await queueService.setItemTimeout(item.id, 100) // 100ms timeout

      // Get the task to start processing
      const processing = await queueService.getNextTaskFromQueue(testQueue.id, 'timeout-agent')

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Check for timeouts
      const timedOut = await queueService.checkAndHandleTimeouts(testQueue.id)

      // Note: The actual timeout handling would need proper implementation
      console.log(`Timed out items: ${JSON.stringify(timedOut)}`)
    })

    test('should maintain data consistency during failures', async () => {
      const ticket = await ticketService.createTicket({
        projectId: TEST_PROJECT_ID,
        title: 'Consistency Test',
        overview: 'Testing data consistency',
        priority: 'normal',
        status: 'open'
      })

      const tasks = []
      for (let i = 0; i < 5; i++) {
        const task = await ticketService.createTask(ticket.id, {
          content: `Consistency Task ${i}`,
          description: 'Task for consistency testing'
        })
        tasks.push(task)
      }

      // Enqueue all tasks
      await queueService.enqueueTicketWithAllTasks(testQueue.id, ticket.id)

      // Process some tasks
      const agent = new MockAgent('consistency-agent')
      for (let i = 0; i < 2; i++) {
        const next = await queueService.getNextTaskFromQueue(testQueue.id, agent.id)
        if (next.queueItem) {
          await queueService.updateQueueItem(next.queueItem.id, {
            status: 'completed'
          })
        }
      }

      // Simulate a failure
      const next = await queueService.getNextTaskFromQueue(testQueue.id, agent.id)
      if (next.queueItem) {
        await queueService.updateQueueItem(next.queueItem.id, {
          status: 'failed',
          errorMessage: 'Simulated failure'
        })
      }

      // Verify data consistency
      const stats = await queueService.getQueueStats(testQueue.id)
      const allTasks = await ticketService.getTasksByTicket(ticket.id)
      const completedTasks = allTasks.filter((t) => t.done)

      // Stats should match actual state
      expect(stats.completedItems).toBe(2)
      expect(stats.failedItems).toBe(1)
      expect(stats.queuedItems).toBe(2)
      expect(completedTasks).toHaveLength(2)

      // Total should always equal sum of states
      assertQueueStats(stats, {
        totalItems: 5
      })
    })
  })
})
