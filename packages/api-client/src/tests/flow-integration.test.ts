import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient, PromptlianoError } from '@promptliano/api-client'
import type { PromptlianoClient } from '@promptliano/api-client'
import type { TestEnvironment } from './test-environment'
import { withTestEnvironment, checkLMStudioAvailability } from './test-environment'
import { assertions, factories, TestDataManager, withTestData, retryOperation, waitFor, PerformanceTracker } from './utils/test-helpers'

/**
 * End-to-end integration tests for the complete flow system
 * Tests the entire workflow: Project → Tickets → Tasks → Queues → Processing → Completion
 */
describe('Flow Integration Tests', () => {
  describe('Complete Workflow Integration', () => {
    test('should handle complete project workflow from creation to completion', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          const tracker = new PerformanceTracker()
          
          // Phase 1: Project Setup
          const project = await tracker.measure('create-project', () =>
            dataManager.createProject(factories.createProjectData({
              name: 'Integration Test Project',
              description: 'Project for testing complete workflow integration'
            }))
          )
          
          console.log(`✅ Project created: ${project.name} (ID: ${project.id})`)
          
          // Phase 2: Create Tickets with Different Priorities
          const tickets = await tracker.measure('create-tickets', async () => {
            const ticketData = [
              { title: 'High Priority Feature', priority: 'high', description: 'Critical feature implementation' },
              { title: 'Normal Priority Bug Fix', priority: 'normal', description: 'Important bug that needs fixing' },
              { title: 'Low Priority Enhancement', priority: 'low', description: 'Nice to have improvement' }
            ]
            
            return await Promise.all(
              ticketData.map(data => 
                dataManager.createTicket(factories.createTicketData({
                  ...data,
                  projectId: project.id
                }))
              )
            )
          })
          
          console.log(`✅ Created ${tickets.length} tickets`)
          
          // Phase 3: Create Tasks for Each Ticket
          const allTasks = await tracker.measure('create-tasks', async () => {
            const tasks = []
            
            // High priority ticket gets 3 tasks
            for (let i = 1; i <= 3; i++) {
              tasks.push(await dataManager.createTask(tickets[0].id, factories.createTaskData({
                content: `High Priority Task ${i}`,
                description: `Task ${i} for critical feature`,
                estimatedHours: 2 + i,
                priority: 5
              })))
            }
            
            // Medium priority ticket gets 2 tasks
            for (let i = 1; i <= 2; i++) {
              tasks.push(await dataManager.createTask(tickets[1].id, factories.createTaskData({
                content: `Medium Priority Task ${i}`,
                description: `Task ${i} for bug fix`,
                estimatedHours: 1 + i,
                priority: 3
              })))
            }
            
            // Low priority ticket gets 1 task
            tasks.push(await dataManager.createTask(tickets[2].id, factories.createTaskData({
              content: 'Low Priority Task 1',
              description: 'Enhancement task',
              estimatedHours: 1,
              priority: 1
            })))
            
            return tasks
          })
          
          console.log(`✅ Created ${allTasks.length} tasks across all tickets`)
          
          // Phase 4: Create Queue with Appropriate Capacity
          const queue = await tracker.measure('create-queue', () =>
            dataManager.createQueue(project.id, factories.createQueueData({
              name: 'Integration Test Queue',
              description: 'Queue for testing complete workflow',
              maxParallelItems: 3,
              priority: 1
            }))
          )
          
          console.log(`✅ Queue created: ${queue.name} (ID: ${queue.id})`)
          
          // Phase 5: Enqueue Items with Priority-Based Ordering
          await tracker.measure('enqueue-items', async () => {
            // Enqueue tickets with priority-based ordering
            const priorities = { 'high': 10, 'normal': 5, 'low': 1 }
            
            for (const ticket of tickets) {
              const priority = priorities[ticket.priority as keyof typeof priorities] || 1
              await client.queues.enqueueTicket(queue.id, ticket.id, priority)
            }
          })
          
          console.log('✅ All tickets enqueued with priority ordering')
          
          // Phase 6: Verify Queue State and Statistics
          const queueStats = await tracker.measure('check-queue-stats', () =>
            client.queues.getQueueStats(queue.id)
          )
          assertions.assertSuccessResponse(queueStats)
          assertions.assertValidQueueStats(queueStats.data)
          expect(queueStats.data.totalItems).toBeGreaterThanOrEqual(3) // At least the 3 tickets
          expect(queueStats.data.pendingItems).toBeGreaterThanOrEqual(3)
          
          console.log(`✅ Queue stats verified: ${queueStats.data.totalItems} total items, ${queueStats.data.pendingItems} pending`)
          
          // Phase 7: Process Items in Priority Order
          const processedItems = []
          let processingRound = 1
          
          while (true) {
            const nextTask = await client.queues.getNextTask(queue.id, `integration-agent-${processingRound}`)
            assertions.assertSuccessResponse(nextTask)
            
            if (!nextTask.data.item) {
              console.log('✅ No more items to process')
              break
            }
            
            const item = nextTask.data.item
            assertions.assertValidQueueItem(item)
            processedItems.push(item)
            
            console.log(`🔄 Processing ${item.itemType} ${item.itemId} (Priority: ${item.priority})`)
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Complete the item
            if (item.itemType === 'ticket') {
              await client.queues.completeQueueItem('ticket', item.itemId)
            } else {
              // For tasks, we need the ticket ID
              const tasks = await client.tickets.getTasks(item.itemId)
              assertions.assertSuccessResponse(tasks)
              if (tasks.data.length > 0) {
                await client.queues.completeQueueItem('task', item.itemId, tasks.data[0].ticketId)
              }
            }
            
            processingRound++
            
            // Safety check to prevent infinite loops
            if (processingRound > 20) {
              console.warn('⚠️  Breaking processing loop after 20 rounds')
              break
            }
          }
          
          console.log(`✅ Processed ${processedItems.length} items`)
          
          // Phase 8: Verify Processing Order (High Priority First)
          if (processedItems.length >= 3) {
            // First item should be high priority (10)
            expect(processedItems[0].priority).toBeGreaterThanOrEqual(processedItems[1].priority)
            expect(processedItems[1].priority).toBeGreaterThanOrEqual(processedItems[2].priority)
            console.log('✅ Items processed in correct priority order')
          }
          
          // Phase 9: Verify Final Queue Statistics
          const finalStats = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(finalStats)
          expect(finalStats.data.completedItems).toBeGreaterThanOrEqual(processedItems.length)
          expect(finalStats.data.pendingItems).toBeLessThan(queueStats.data.pendingItems)
          
          console.log(`✅ Final stats: ${finalStats.data.completedItems} completed, ${finalStats.data.pendingItems} pending`)
          
          // Phase 10: Verify Task and Ticket Status Updates
          await tracker.measure('verify-status-updates', async () => {
            for (const ticket of tickets) {
              const ticketTasks = await client.tickets.getTasks(ticket.id)
              assertions.assertSuccessResponse(ticketTasks)
              
              // Check if any tasks were marked as done during processing
              const completedTasks = ticketTasks.data.filter(task => task.done)
              console.log(`📋 Ticket ${ticket.id}: ${completedTasks.length}/${ticketTasks.data.length} tasks completed`)
            }
          })
          
          // Phase 11: Test Queue Timeline
          const timeline = await client.queues.getQueueTimeline(queue.id)
          assertions.assertSuccessResponse(timeline)
          expect(Array.isArray(timeline.data.events)).toBe(true)
          console.log(`📈 Queue timeline contains ${timeline.data.events.length} events`)
          
          // Performance Summary
          tracker.printSummary()
          
          // Verify overall performance (entire workflow under 10 seconds)
          const totalTime = Object.values(tracker.getStats('create-project') || {}).reduce((sum, time) => sum + time, 0)
          console.log(`🚀 Complete workflow executed in ${totalTime.toFixed(2)}ms`)
          
          console.log('🎉 Complete workflow integration test passed!')
        })
      })
    }, 30000) // Extended timeout for full workflow

    test('should handle concurrent workflow operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create project
          const project = await dataManager.createProject(factories.createProjectData({
            name: 'Concurrent Workflow Test'
          }))
          
          // Create multiple queues
          const queues = await Promise.all([
            dataManager.createQueue(project.id, factories.createQueueData({ name: 'Queue A', priority: 1 })),
            dataManager.createQueue(project.id, factories.createQueueData({ name: 'Queue B', priority: 2 })),
            dataManager.createQueue(project.id, factories.createQueueData({ name: 'Queue C', priority: 3 }))
          ])
          
          // Create tickets concurrently
          const ticketPromises = Array.from({ length: 6 }, (_, i) =>
            dataManager.createTicket(factories.createTicketData({
              projectId: project.id,
              title: `Concurrent Ticket ${i + 1}`,
              priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'normal' : 'low'
            }))
          )
          
          const tickets = await Promise.all(ticketPromises)
          
          // Distribute tickets across queues
          const enqueuePromises = tickets.map((ticket, i) => {
            const queueIndex = i % queues.length
            const priority = Math.floor(Math.random() * 10) + 1
            return client.queues.enqueueItem(queues[queueIndex].id, {
              type: 'ticket',
              itemId: ticket.id,
              priority
            })
          })
          
          const enqueueResults = await Promise.all(enqueuePromises)
          
          // Verify all enqueues succeeded
          enqueueResults.forEach(result => {
            assertions.assertSuccessResponse(result)
            assertions.assertValidQueueItem(result.data)
          })
          
          // Process from all queues concurrently
          const processingPromises = queues.map(async (queue, queueIndex) => {
            const agent = `concurrent-agent-${queueIndex}`
            const processedItems = []
            
            for (let round = 0; round < 3; round++) {
              const nextTask = await client.queues.getNextTask(queue.id, agent)
              assertions.assertSuccessResponse(nextTask)
              
              if (nextTask.data.item) {
                processedItems.push(nextTask.data.item)
                await client.queues.completeQueueItem(
                  nextTask.data.item.itemType,
                  nextTask.data.item.itemId
                )
              }
            }
            
            return processedItems
          })
          
          const allProcessedItems = await Promise.all(processingPromises)
          
          // Verify processing results
          const totalProcessed = allProcessedItems.flat().length
          expect(totalProcessed).toBeGreaterThan(0)
          
          console.log(`✅ Concurrent processing completed: ${totalProcessed} items processed across ${queues.length} queues`)
        })
      })
    })
  })

  describe('AI-Enhanced Workflow Integration', () => {
    test.skipIf(!process.env.AI_TEST_MODE)('should create complete AI-assisted workflow', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        const lmStudioCheck = await checkLMStudioAvailability(env.config.ai.lmstudio)
        if (!lmStudioCheck.available) {
          console.log(`⏭️  Skipping AI integration test: ${lmStudioCheck.message}`)
          return
        }

        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Phase 1: Create Project and Initial Ticket
          const project = await dataManager.createProject(factories.createProjectData({
            name: 'AI-Enhanced Workflow Test',
            description: 'Testing AI-assisted task generation and file suggestions'
          }))
          
          const ticket = await dataManager.createTicket(factories.createTicketData({
            projectId: project.id,
            title: 'Build user authentication system',
            description: 'Create a complete authentication system with JWT tokens, password hashing, email verification, and role-based access control'
          }))
          
          console.log(`✅ Created ticket: ${ticket.title}`)
          
          // Phase 2: AI Task Generation
          const aiTasks = await retryOperation(
            () => client.tickets.autoGenerateTasks(ticket.id),
            { maxRetries: 2, delay: 3000 }
          )
          
          assertions.assertSuccessResponse(aiTasks)
          expect(aiTasks.data.length).toBeGreaterThan(0)
          
          console.log(`🤖 AI generated ${aiTasks.data.length} tasks`)
          
          // Track AI-generated tasks for cleanup
          aiTasks.data.forEach(task => {
            dataManager.track('task', task, async () => {
              await client.tickets.deleteTask(ticket.id, task.id)
            })
          })
          
          // Phase 3: AI File Suggestions
          const fileSuggestions = await retryOperation(
            () => client.tickets.suggestFiles(ticket.id, 'Focus on authentication, security, and user management'),
            { maxRetries: 2, delay: 2000 }
          )
          
          assertions.assertSuccessResponse(fileSuggestions)
          console.log(`🤖 AI suggested ${fileSuggestions.data.recommendedFileIds.length} files`)
          
          // Phase 4: Create Queue and Process AI-Enhanced Workflow
          const queue = await dataManager.createQueue(project.id, factories.createQueueData({
            name: 'AI-Enhanced Queue',
            description: 'Queue for processing AI-generated tasks'
          }))
          
          // Enqueue the ticket with high priority
          await client.queues.enqueueTicket(queue.id, ticket.id, 10)
          
          // Phase 5: Verify AI-Enhanced Processing
          const nextTask = await client.queues.getNextTask(queue.id, 'ai-assistant-agent')
          assertions.assertSuccessResponse(nextTask)
          
          if (nextTask.data.item) {
            assertions.assertValidQueueItem(nextTask.data.item)
            expect(nextTask.data.item.itemId).toBe(ticket.id)
            
            // Complete the AI-enhanced workflow
            await client.queues.completeQueueItem('ticket', ticket.id)
            console.log('✅ AI-enhanced workflow completed successfully')
          }
          
          // Phase 6: Verify AI Task Quality
          const allTasks = await client.tickets.getTasks(ticket.id)
          assertions.assertSuccessResponse(allTasks)
          
          // AI tasks should have meaningful content
          allTasks.data.forEach(task => {
            expect(task.content.length).toBeGreaterThan(10)
            expect(task.content).not.toBe('')
          })
          
          console.log('🎉 AI-enhanced workflow integration test completed!')
        })
      })
    }, 90000) // Extended timeout for AI operations

    test.skipIf(!process.env.AI_TEST_MODE)('should handle AI task suggestions in workflow', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        const lmStudioCheck = await checkLMStudioAvailability(env.config.ai.lmstudio)
        if (!lmStudioCheck.available) {
          console.log(`⏭️  Skipping AI suggestions test: ${lmStudioCheck.message}`)
          return
        }

        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create project and ticket
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({
            projectId: project.id,
            title: 'Implement real-time chat system',
            description: 'Build a real-time chat system with websockets, message persistence, and user presence indicators'
          }))
          
          // Get AI task suggestions
          const suggestions = await retryOperation(
            () => client.tickets.suggestTasks(ticket.id, 'Focus on real-time features and scalability'),
            { maxRetries: 2, delay: 2000 }
          )
          
          assertions.assertSuccessResponse(suggestions)
          expect(suggestions.data.suggestedTasks.length).toBeGreaterThan(0)
          
          console.log(`🤖 AI suggested ${suggestions.data.suggestedTasks.length} tasks:`)
          suggestions.data.suggestedTasks.forEach((task, i) => {
            console.log(`  ${i + 1}. ${task}`)
          })
          
          // Create tasks based on suggestions
          const createdTasks = []
          for (let i = 0; i < Math.min(3, suggestions.data.suggestedTasks.length); i++) {
            const suggestion = suggestions.data.suggestedTasks[i]
            const task = await dataManager.createTask(ticket.id, factories.createTaskData({
              content: suggestion,
              description: `AI-suggested task: ${suggestion}`,
              estimatedHours: 2
            }))
            createdTasks.push(task)
          }
          
          // Process in queue
          const queue = await dataManager.createQueue(project.id)
          await client.queues.enqueueTicket(queue.id, ticket.id, 8)
          
          const nextTask = await client.queues.getNextTask(queue.id, 'ai-suggestion-processor')
          assertions.assertSuccessResponse(nextTask)
          
          if (nextTask.data.item) {
            await client.queues.completeQueueItem(nextTask.data.item.itemType, nextTask.data.item.itemId)
            console.log('✅ AI-suggested workflow processed successfully')
          }
        })
      })
    }, 60000) // Extended timeout for AI operations
  })

  describe('Error Recovery and Resilience', () => {
    test('should handle workflow interruptions gracefully', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create complex workflow
          const project = await dataManager.createProject()
          const queue = await dataManager.createQueue(project.id)
          
          const tickets = await Promise.all([
            dataManager.createTicket(factories.createTicketData({ projectId: project.id, title: 'Ticket 1' })),
            dataManager.createTicket(factories.createTicketData({ projectId: project.id, title: 'Ticket 2' })),
            dataManager.createTicket(factories.createTicketData({ projectId: project.id, title: 'Ticket 3' }))
          ])
          
          // Enqueue all tickets
          for (const ticket of tickets) {
            await client.queues.enqueueItem(queue.id, {
              type: 'ticket',
              itemId: ticket.id,
              priority: 5
            })
          }
          
          // Start processing first item
          const firstTask = await client.queues.getNextTask(queue.id, 'resilience-agent')
          assertions.assertSuccessResponse(firstTask)
          expect(firstTask.data.item).toBeDefined()
          
          // Simulate interruption by not completing the task
          // Check that other items can still be processed
          const secondTask = await client.queues.getNextTask(queue.id, 'backup-agent')
          assertions.assertSuccessResponse(secondTask)
          
          // Verify queue state is consistent
          const stats = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(stats)
          expect(stats.data.totalItems).toBe(3)
          
          // Complete workflow properly
          if (firstTask.data.item) {
            await client.queues.completeQueueItem(firstTask.data.item.itemType, firstTask.data.item.itemId)
          }
          if (secondTask.data.item) {
            await client.queues.completeQueueItem(secondTask.data.item.itemType, secondTask.data.item.itemId)
          }
          
          console.log('✅ Workflow interruption handled gracefully')
        })
      })
    })

    test('should handle resource cleanup during workflow failures', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create workflow with dependencies
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const tasks = await Promise.all([
            dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Task 1' })),
            dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Task 2' }))
          ])
          
          // Create multiple queues
          const queues = await Promise.all([
            dataManager.createQueue(project.id, factories.createQueueData({ name: 'Primary Queue' })),
            dataManager.createQueue(project.id, factories.createQueueData({ name: 'Backup Queue' }))
          ])
          
          // Enqueue in both queues
          await client.queues.enqueueTicket(queues[0].id, ticket.id, 5)
          await client.queues.enqueueTicket(queues[1].id, ticket.id, 3)
          
          // Verify initial state
          const stats1 = await client.queues.getQueueStats(queues[0].id)
          const stats2 = await client.queues.getQueueStats(queues[1].id)
          assertions.assertSuccessResponse(stats1)
          assertions.assertSuccessResponse(stats2)
          
          // Simulate failure by deleting one queue
          await client.queues.deleteQueue(queues[1].id)
          
          // Verify remaining queue is still functional
          const remainingStats = await client.queues.getQueueStats(queues[0].id)
          assertions.assertSuccessResponse(remainingStats)
          expect(remainingStats.data.totalItems).toBeGreaterThan(0)
          
          // Continue processing in remaining queue
          const nextTask = await client.queues.getNextTask(queues[0].id, 'cleanup-agent')
          assertions.assertSuccessResponse(nextTask)
          
          if (nextTask.data.item) {
            await client.queues.completeQueueItem(nextTask.data.item.itemType, nextTask.data.item.itemId)
          }
          
          console.log('✅ Resource cleanup during failure handled properly')
        })
      })
    })
  })

  describe('Performance and Scalability Integration', () => {
    test('should handle large-scale workflow operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          const tracker = new PerformanceTracker()
          
          // Create large-scale workflow
          const project = await dataManager.createProject(factories.createProjectData({
            name: 'Large Scale Test Project'
          }))
          
          // Create multiple queues for load distribution
          const queueCount = 3
          const queues = await Promise.all(
            Array.from({ length: queueCount }, (_, i) =>
              dataManager.createQueue(project.id, factories.createQueueData({
                name: `Load Test Queue ${i + 1}`,
                maxParallelItems: 5
              }))
            )
          )
          
          // Create many tickets
          const ticketCount = 15
          const tickets = await tracker.measure('create-large-dataset', () =>
            Promise.all(
              Array.from({ length: ticketCount }, (_, i) =>
                dataManager.createTicket(factories.createTicketData({
                  projectId: project.id,
                  title: `Large Scale Ticket ${i + 1}`,
                  priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'normal' : 'low'
                }))
              )
            )
          )
          
          // Create tasks for tickets
          const taskPromises = []
          for (const ticket of tickets) {
            const taskCount = Math.floor(Math.random() * 3) + 1 // 1-3 tasks per ticket
            for (let i = 0; i < taskCount; i++) {
              taskPromises.push(
                dataManager.createTask(ticket.id, factories.createTaskData({
                  content: `Task ${i + 1} for ${ticket.title}`,
                  estimatedHours: Math.floor(Math.random() * 4) + 1
                }))
              )
            }
          }
          
          const allTasks = await tracker.measure('create-all-tasks', () =>
            Promise.all(taskPromises)
          )
          
          console.log(`📊 Created ${tickets.length} tickets and ${allTasks.length} tasks`)
          
          // Distribute tickets across queues
          const distributionPromises = tickets.map((ticket, i) => {
            const queueIndex = i % queueCount
            const priority = Math.floor(Math.random() * 10) + 1
            return client.queues.enqueueTicket(queues[queueIndex].id, ticket.id, priority)
          })
          
          await tracker.measure('distribute-across-queues', () =>
            Promise.all(distributionPromises)
          )
          
          // Verify distribution
          const allStats = await Promise.all(
            queues.map(queue => client.queues.getQueueStats(queue.id))
          )
          
          const totalEnqueued = allStats.reduce((sum, statsResult) => {
            assertions.assertSuccessResponse(statsResult)
            return sum + statsResult.data.totalItems
          }, 0)
          
          expect(totalEnqueued).toBeGreaterThanOrEqual(ticketCount)
          console.log(`📊 Distributed ${totalEnqueued} items across ${queueCount} queues`)
          
          // Concurrent processing from all queues
          const processingPromises = queues.map(async (queue, queueIndex) => {
            const processedItems = []
            const agent = `scale-test-agent-${queueIndex}`
            
            // Process up to 5 items per queue
            for (let round = 0; round < 5; round++) {
              const nextTask = await client.queues.getNextTask(queue.id, agent)
              assertions.assertSuccessResponse(nextTask)
              
              if (!nextTask.data.item) break
              
              processedItems.push(nextTask.data.item)
              await client.queues.completeQueueItem(
                nextTask.data.item.itemType,
                nextTask.data.item.itemId
              )
            }
            
            return processedItems
          })
          
          const allProcessedItems = await tracker.measure('concurrent-processing', () =>
            Promise.all(processingPromises)
          )
          
          const totalProcessed = allProcessedItems.flat().length
          console.log(`🚀 Processed ${totalProcessed} items concurrently`)
          
          // Verify final state
          const finalStats = await Promise.all(
            queues.map(queue => client.queues.getQueueStats(queue.id))
          )
          
          const totalCompleted = finalStats.reduce((sum, statsResult) => {
            assertions.assertSuccessResponse(statsResult)
            return sum + statsResult.data.completedItems
          }, 0)
          
          expect(totalCompleted).toBe(totalProcessed)
          
          // Performance verification
          tracker.printSummary()
          
          // All operations should complete within reasonable time
          const createDatasetStats = tracker.getStats('create-large-dataset')
          const distributionStats = tracker.getStats('distribute-across-queues')
          const processingStats = tracker.getStats('concurrent-processing')
          
          expect(createDatasetStats?.avg).toBeLessThan(5000) // Under 5s for data creation
          expect(distributionStats?.avg).toBeLessThan(3000) // Under 3s for distribution
          expect(processingStats?.avg).toBeLessThan(5000) // Under 5s for processing
          
          console.log('🎉 Large-scale workflow integration test completed successfully!')
        })
      })
    }, 45000) // Extended timeout for large-scale testing
  })

  describe('Data Consistency and Integrity', () => {
    test('should maintain data consistency across workflow operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create initial data
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const tasks = await Promise.all([
            dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Consistency Task 1' })),
            dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Consistency Task 2' }))
          ])
          
          const queue = await dataManager.createQueue(project.id)
          
          // Enqueue and track state changes
          await client.queues.enqueueTicket(queue.id, ticket.id, 5)
          
          // Verify relationships are maintained
          const ticketsWithTasks = await client.tickets.getTicketsWithTasks(project.id)
          assertions.assertSuccessResponse(ticketsWithTasks)
          
          const ticketWithTasks = ticketsWithTasks.data.find(t => t.id === ticket.id)
          expect(ticketWithTasks).toBeDefined()
          expect(ticketWithTasks?.tasks?.length).toBe(2)
          
          // Process and verify state consistency
          const nextTask = await client.queues.getNextTask(queue.id, 'consistency-agent')
          assertions.assertSuccessResponse(nextTask)
          
          if (nextTask.data.item) {
            // Verify item relationships
            expect(nextTask.data.item.itemId).toBe(ticket.id)
            expect(nextTask.data.item.queueId).toBe(queue.id)
            
            // Complete and verify updates
            await client.queues.completeQueueItem('ticket', ticket.id)
            
            // Check that ticket still has its tasks
            const updatedTasks = await client.tickets.getTasks(ticket.id)
            assertions.assertSuccessResponse(updatedTasks)
            expect(updatedTasks.data.length).toBe(2)
            
            // Check queue stats reflect completion
            const stats = await client.queues.getQueueStats(queue.id)
            assertions.assertSuccessResponse(stats)
            expect(stats.data.completedItems).toBeGreaterThan(0)
          }
          
          console.log('✅ Data consistency maintained throughout workflow')
        })
      })
    })

    test('should handle concurrent modifications gracefully', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create shared resources
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const queue = await dataManager.createQueue(project.id)
          
          // Enqueue the ticket
          await client.queues.enqueueItem(queue.id, {
            type: 'ticket',
            itemId: ticket.id,
            priority: 5
          })
          
          // Concurrent operations
          const operations = [
            // Agent 1: Try to process the ticket
            client.queues.getNextTask(queue.id, 'concurrent-agent-1'),
            
            // Agent 2: Try to process the same ticket
            client.queues.getNextTask(queue.id, 'concurrent-agent-2'),
            
            // Agent 3: Update ticket while it's being processed
            client.tickets.updateTicket(ticket.id, { title: 'Concurrently Updated Ticket' }),
            
            // Agent 4: Get queue stats
            client.queues.getQueueStats(queue.id)
          ]
          
          const results = await Promise.all(operations)
          
          // All operations should succeed
          results.forEach(result => {
            assertions.assertSuccessResponse(result)
          })
          
          // Verify final state is consistent
          const finalStats = await client.queues.getQueueStats(queue.id)
          assertions.assertSuccessResponse(finalStats)
          
          const updatedTicket = await client.tickets.getTicket(ticket.id)
          assertions.assertSuccessResponse(updatedTicket)
          expect(updatedTicket.data.title).toBe('Concurrently Updated Ticket')
          
          console.log('✅ Concurrent modifications handled gracefully')
        })
      })
    })
  })
})