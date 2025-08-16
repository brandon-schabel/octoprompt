import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient, PromptlianoError } from '@promptliano/api-client'
import type { PromptlianoClient } from '@promptliano/api-client'
import type { TestEnvironment } from './test-environment'
import { withTestEnvironment, checkLMStudioAvailability } from './test-environment'
import { assertions, factories, TestDataManager, withTestData, retryOperation, waitFor } from './utils/test-helpers'

/**
 * Comprehensive API tests for tickets and task management
 * Tests CRUD operations, task management, and AI-powered features
 */
describe('Tickets API Tests', () => {
  describe('Basic Ticket CRUD Operations', () => {
    test('should create, read, update, and delete tickets', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          // Create a project first
          const project = await dataManager.createProject()
          
          // Test Create
          const ticketData = factories.createTicketData({ 
            projectId: project.id,
            title: 'Test Ticket Creation',
            priority: 'high'
          })
          const ticket = await dataManager.createTicket(ticketData)
          
          assertions.assertValidTicket(ticket)
          expect(ticket.title).toBe(ticketData.title)
          expect(ticket.priority).toBe(ticketData.priority)
          expect(ticket.projectId).toBe(project.id)
          
          // Test Read
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          const readResult = await client.tickets.getTicket(ticket.id)
          assertions.assertSuccessResponse(readResult)
          assertions.assertValidTicket(readResult.data)
          expect(readResult.data.id).toBe(ticket.id)
          
          // Test Update
          const updateData = { title: 'Updated Ticket Title', priority: 'low' }
          const updateResult = await client.tickets.updateTicket(ticket.id, updateData)
          assertions.assertSuccessResponse(updateResult)
          expect(updateResult.data.title).toBe(updateData.title)
          expect(updateResult.data.priority).toBe(updateData.priority)
          expect(updateResult.data.updated).toBeGreaterThan(ticket.updated)
          
          // Test List tickets for project
          const listResult = await client.tickets.listTickets(project.id)
          assertions.assertSuccessResponse(listResult)
          assertions.assertArrayOfItems(listResult.data, 1)
          const foundTicket = listResult.data.find(t => t.id === ticket.id)
          expect(foundTicket).toBeDefined()
          expect(foundTicket?.title).toBe(updateData.title)
          
          // Test Delete (handled by cleanup)
        })
      })
    })

    test('should handle ticket status filtering', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create tickets with different statuses
          const openTicket = await dataManager.createTicket(factories.createTicketData({ 
            projectId: project.id,
            title: 'Open Ticket',
            status: 'open'
          }))
          
          const inProgressTicket = await dataManager.createTicket(factories.createTicketData({ 
            projectId: project.id,
            title: 'In Progress Ticket',
            status: 'in_progress'
          }))
          
          // Update one ticket to different status
          await client.tickets.updateTicket(inProgressTicket.id, { status: 'in_progress' })
          
          // Test filtering by status
          const openTickets = await client.tickets.listTickets(project.id, 'open')
          assertions.assertSuccessResponse(openTickets)
          expect(openTickets.data.length).toBeGreaterThanOrEqual(1)
          expect(openTickets.data.every(t => t.status === 'open')).toBe(true)
          
          const inProgressTickets = await client.tickets.listTickets(project.id, 'in_progress')
          assertions.assertSuccessResponse(inProgressTickets)
          expect(inProgressTickets.data.length).toBeGreaterThanOrEqual(1)
          expect(inProgressTickets.data.every(t => t.status === 'in_progress')).toBe(true)
        })
      })
    })

    test('should handle ticket error scenarios', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        const client = createPromptlianoClient({ baseUrl: env.baseUrl })
        
        // Test getting non-existent ticket
        try {
          await client.tickets.getTicket(99999)
          expect(false).toBe(true) // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(PromptlianoError)
          expect((error as PromptlianoError).statusCode).toBe(404)
        }
        
        // Test creating ticket with invalid data
        try {
          await client.tickets.createTicket({
            projectId: 99999, // Non-existent project
            title: '',
            description: 'Test'
          } as any)
          expect(false).toBe(true) // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
        }
        
        // Test updating non-existent ticket
        try {
          await client.tickets.updateTicket(99999, { title: 'Updated' })
          expect(false).toBe(true) // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(PromptlianoError)
          expect((error as PromptlianoError).statusCode).toBe(404)
        }
      })
    })
  })

  describe('Task Management', () => {
    test('should create, read, update, and delete tasks', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Test Create Task
          const taskData = factories.createTaskData({
            content: 'Test Task Creation',
            description: 'Detailed task description',
            estimatedHours: 4
          })
          const task = await dataManager.createTask(ticket.id, taskData)
          
          assertions.assertValidTask(task)
          expect(task.content).toBe(taskData.content)
          expect(task.description).toBe(taskData.description)
          expect(task.ticketId).toBe(ticket.id)
          expect(task.done).toBe(false)
          
          // Test Read Tasks
          const tasksResult = await client.tickets.getTasks(ticket.id)
          assertions.assertSuccessResponse(tasksResult)
          assertions.assertArrayOfItems(tasksResult.data, 1)
          const foundTask = tasksResult.data.find(t => t.id === task.id)
          expect(foundTask).toBeDefined()
          
          // Test Update Task
          const updateData = { content: 'Updated Task Content', done: true }
          const updateResult = await client.tickets.updateTask(ticket.id, task.id, updateData)
          assertions.assertSuccessResponse(updateResult)
          expect(updateResult.data.content).toBe(updateData.content)
          expect(updateResult.data.done).toBe(updateData.done)
          expect(updateResult.data.updatedAt).toBeGreaterThan(task.updatedAt)
          
          // Test Delete (handled by cleanup)
        })
      })
    })

    test('should handle task ordering and reordering', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create multiple tasks
          const task1 = await dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Task 1' }))
          const task2 = await dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Task 2' }))
          const task3 = await dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Task 3' }))
          
          // Verify initial order
          const initialTasks = await client.tickets.getTasks(ticket.id)
          assertions.assertSuccessResponse(initialTasks)
          expect(initialTasks.data.length).toBe(3)
          
          // Test reordering
          const reorderResult = await client.tickets.reorderTasks(ticket.id, {
            taskIds: [task3.id, task1.id, task2.id]
          })
          assertions.assertSuccessResponse(reorderResult)
          
          // Verify new order
          const reorderedTasks = await client.tickets.getTasks(ticket.id)
          assertions.assertSuccessResponse(reorderedTasks)
          expect(reorderedTasks.data[0].id).toBe(task3.id)
          expect(reorderedTasks.data[1].id).toBe(task1.id)
          expect(reorderedTasks.data[2].id).toBe(task2.id)
        })
      })
    })

    test('should handle bulk task operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create multiple tasks
          const tasks = await Promise.all([
            dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Bulk Task 1' })),
            dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Bulk Task 2' })),
            dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Bulk Task 3' }))
          ])
          
          // Test getting tickets with task counts
          const ticketsWithCounts = await client.tickets.getTicketsWithCounts(project.id)
          assertions.assertSuccessResponse(ticketsWithCounts)
          const ticketWithCount = ticketsWithCounts.data.find(t => t.id === ticket.id)
          expect(ticketWithCount).toBeDefined()
          expect(ticketWithCount?.taskCount).toBe(3)
          
          // Test getting tickets with all tasks
          const ticketsWithTasks = await client.tickets.getTicketsWithTasks(project.id)
          assertions.assertSuccessResponse(ticketsWithTasks)
          const ticketWithTasks = ticketsWithTasks.data.find(t => t.id === ticket.id)
          expect(ticketWithTasks).toBeDefined()
          expect(ticketWithTasks?.tasks?.length).toBe(3)
        })
      })
    })
  })

  describe('AI-Powered Features', () => {
    test.skipIf(!process.env.AI_TEST_MODE)('should suggest tasks for tickets', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        const lmStudioCheck = await checkLMStudioAvailability(env.config.ai.lmstudio)
        if (!lmStudioCheck.available) {
          console.log(`⏭️  Skipping AI test: ${lmStudioCheck.message}`)
          return
        }

        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ 
            projectId: project.id,
            title: 'Implement user authentication system',
            description: 'Create a complete authentication system with login, registration, and password reset functionality'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Test task suggestions
          const suggestResult = await retryOperation(
            () => client.tickets.suggestTasks(ticket.id, 'Focus on security and user experience'),
            { maxRetries: 2, delay: 2000, shouldRetry: (error) => !error.message.includes('404') }
          )
          
          assertions.assertSuccessResponse(suggestResult)
          expect(Array.isArray(suggestResult.data.suggestedTasks)).toBe(true)
          expect(suggestResult.data.suggestedTasks.length).toBeGreaterThan(0)
          expect(suggestResult.data.suggestedTasks.every(task => typeof task === 'string')).toBe(true)
        })
      })
    }, 45000) // Longer timeout for AI operations

    test.skipIf(!process.env.AI_TEST_MODE)('should auto-generate tasks for tickets', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        const lmStudioCheck = await checkLMStudioAvailability(env.config.ai.lmstudio)
        if (!lmStudioCheck.available) {
          console.log(`⏭️  Skipping AI test: ${lmStudioCheck.message}`)
          return
        }

        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ 
            projectId: project.id,
            title: 'Build REST API endpoints',
            description: 'Create CRUD endpoints for user management with proper validation and error handling'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Test auto-generation
          const generateResult = await retryOperation(
            () => client.tickets.autoGenerateTasks(ticket.id),
            { maxRetries: 2, delay: 3000, shouldRetry: (error) => !error.message.includes('404') }
          )
          
          assertions.assertSuccessResponse(generateResult)
          assertions.assertArrayOfItems(generateResult.data, 1)
          generateResult.data.forEach(task => {
            assertions.assertValidTask(task)
            expect(task.ticketId).toBe(ticket.id)
          })
        })
      })
    }, 60000) // Longer timeout for AI generation

    test.skipIf(!process.env.AI_TEST_MODE)('should suggest relevant files for tickets', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        const lmStudioCheck = await checkLMStudioAvailability(env.config.ai.lmstudio)
        if (!lmStudioCheck.available) {
          console.log(`⏭️  Skipping AI test: ${lmStudioCheck.message}`)
          return
        }

        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ 
            projectId: project.id,
            title: 'Fix database connection issues',
            description: 'Resolve intermittent database connection problems in the user service'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Test file suggestions
          const suggestResult = await retryOperation(
            () => client.tickets.suggestFiles(ticket.id, 'Look for database configuration and connection pool settings'),
            { maxRetries: 2, delay: 2000, shouldRetry: (error) => !error.message.includes('404') }
          )
          
          assertions.assertSuccessResponse(suggestResult)
          expect(Array.isArray(suggestResult.data.recommendedFileIds)).toBe(true)
          // File suggestions might be empty if no relevant files found
          if (suggestResult.data.recommendedFileIds.length > 0) {
            expect(suggestResult.data.recommendedFileIds.every(id => typeof id === 'string')).toBe(true)
          }
        })
      })
    }, 45000) // Longer timeout for AI operations
  })

  describe('Ticket Completion Workflow', () => {
    test('should complete tickets and update task status', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create tasks for the ticket
          const task1 = await dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Task 1' }))
          const task2 = await dataManager.createTask(ticket.id, factories.createTaskData({ content: 'Task 2' }))
          
          // Mark tasks as done
          await client.tickets.updateTask(ticket.id, task1.id, { done: true })
          await client.tickets.updateTask(ticket.id, task2.id, { done: true })
          
          // Complete the ticket
          const completeResult = await client.tickets.completeTicket(ticket.id)
          assertions.assertSuccessResponse(completeResult)
          
          // Verify ticket status changed
          assertions.assertValidTicket(completeResult.data.ticket)
          expect(completeResult.data.ticket.status).toBe('completed')
          
          // Verify tasks are included
          assertions.assertArrayOfItems(completeResult.data.tasks, 2)
          completeResult.data.tasks.forEach(task => {
            assertions.assertValidTask(task)
            expect(task.done).toBe(true)
          })
        })
      })
    })
  })

  describe('Performance and Concurrency', () => {
    test('should handle concurrent task operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create multiple tasks concurrently
          const taskPromises = Array.from({ length: 5 }, (_, i) =>
            client.tickets.createTask(ticket.id, factories.createTaskData({ content: `Concurrent Task ${i + 1}` }))
          )
          
          const taskResults = await Promise.all(taskPromises)
          
          // Verify all tasks were created successfully
          taskResults.forEach(result => {
            assertions.assertSuccessResponse(result)
            assertions.assertValidTask(result.data)
            // Track for cleanup
            dataManager.track('task', result.data, async () => {
              await client.tickets.deleteTask(ticket.id, result.data.id)
            })
          })
          
          // Verify all tasks exist
          const allTasks = await client.tickets.getTasks(ticket.id)
          assertions.assertSuccessResponse(allTasks)
          expect(allTasks.data.length).toBe(5)
        })
      })
    })

    test('should handle bulk operations efficiently', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create multiple tickets
          const ticketPromises = Array.from({ length: 10 }, (_, i) =>
            dataManager.createTicket(factories.createTicketData({ 
              projectId: project.id,
              title: `Bulk Ticket ${i + 1}`,
              priority: i % 2 === 0 ? 'high' : 'low'
            }))
          )
          
          const tickets = await Promise.all(ticketPromises)
          
          // Test bulk retrieval with counts
          const startTime = performance.now()
          const ticketsWithCounts = await client.tickets.getTicketsWithCounts(project.id)
          const endTime = performance.now()
          
          assertions.assertSuccessResponse(ticketsWithCounts)
          expect(ticketsWithCounts.data.length).toBe(10)
          
          // Performance should be reasonable (under 2 seconds for 10 tickets)
          const executionTime = endTime - startTime
          expect(executionTime).toBeLessThan(2000)
          
          console.log(`🚀 Bulk operation completed in ${executionTime.toFixed(2)}ms`)
        })
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty task lists gracefully', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Get tasks for ticket with no tasks
          const tasksResult = await client.tickets.getTasks(ticket.id)
          assertions.assertSuccessResponse(tasksResult)
          expect(Array.isArray(tasksResult.data)).toBe(true)
          expect(tasksResult.data.length).toBe(0)
        })
      })
    })

    test('should handle invalid task reordering', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Try to reorder with non-existent task IDs
          try {
            await client.tickets.reorderTasks(ticket.id, { taskIds: [99999, 99998] })
            expect(false).toBe(true) // Should not reach here
          } catch (error) {
            expect(error).toBeInstanceOf(Error)
          }
        })
      })
    })

    test('should handle ticket with many tasks', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject()
          const ticket = await dataManager.createTicket(factories.createTicketData({ projectId: project.id }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })
          
          // Create many tasks (test pagination/limits)
          const taskCount = 25
          const tasks = await Promise.all(
            Array.from({ length: taskCount }, (_, i) =>
              dataManager.createTask(ticket.id, factories.createTaskData({ content: `Task ${i + 1}` }))
            )
          )
          
          // Verify all tasks can be retrieved
          const allTasks = await client.tickets.getTasks(ticket.id)
          assertions.assertSuccessResponse(allTasks)
          expect(allTasks.data.length).toBe(taskCount)
          
          // Test getting ticket with all tasks
          const ticketWithTasks = await client.tickets.getTicketsWithTasks(project.id)
          assertions.assertSuccessResponse(ticketWithTasks)
          const foundTicket = ticketWithTasks.data.find(t => t.id === ticket.id)
          expect(foundTicket).toBeDefined()
          expect(foundTicket?.tasks?.length).toBe(taskCount)
        })
      })
    })
  })
})