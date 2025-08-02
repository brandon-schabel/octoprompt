import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ticketStorage } from './ticket-storage'
import { DatabaseManager, getDb } from './database-manager'
import type { Ticket, TicketTask } from '@promptliano/schemas'

describe('Ticket Storage', () => {
  let db: DatabaseManager

  beforeEach(() => {
    // Get fresh database instance
    db = getDb()
  })

  afterEach(async () => {
    // Clean up test data
    await db.clearAllTables()
  })

  describe('Database Constraints', () => {
    it('should enforce CHECK constraints on ticket status', async () => {
      const ticket: Ticket = {
        id: 1,
        projectId: 100,
        title: 'Test Ticket',
        overview: 'Test overview',
        status: 'invalid_status' as any, // Invalid status
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }

      // Should throw validation error before reaching database
      await expect(ticketStorage.addTicket(ticket)).rejects.toThrow()
    })

    it('should enforce CHECK constraints on ticket priority', async () => {
      const ticket: Ticket = {
        id: 2,
        projectId: 100,
        title: 'Test Ticket',
        overview: 'Test overview',
        status: 'open',
        priority: 'urgent' as any, // Invalid priority
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }

      await expect(ticketStorage.addTicket(ticket)).rejects.toThrow()
    })

    it('should handle NOT NULL constraints on JSON fields', async () => {
      const database = db.getDatabase()
      
      // Try to insert with NULL JSON field directly (bypassing validation)
      const insertQuery = database.prepare(`
        INSERT INTO tickets (
          id, project_id, title, overview, status, priority,
          suggested_file_ids, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
      `)

      // This should fail with NOT NULL constraint
      expect(() => {
        insertQuery.run(3, 100, 'Test', '', 'open', 'normal', Date.now(), Date.now())
      }).toThrow()
    })

    it('should enforce foreign key constraint on task deletion', async () => {
      // Create a ticket
      const ticket: Ticket = {
        id: 4,
        projectId: 100,
        title: 'Parent Ticket',
        overview: '',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }
      await ticketStorage.addTicket(ticket)

      // Create a task
      const task: TicketTask = {
        id: 1,
        ticketId: 4,
        content: 'Test Task',
        description: '',
        suggestedFileIds: [],
        done: false,
        orderIndex: 0,
        created: Date.now(),
        updated: Date.now()
      }
      await ticketStorage.addTask(task)

      // Delete the ticket
      await ticketStorage.deleteTicketData(4)

      // Task should be deleted due to CASCADE
      const foundTask = await ticketStorage.getTaskById(1)
      expect(foundTask).toBeNull()
    })
  })

  describe('Transaction Rollback', () => {
    it('should rollback all changes on error in writeTickets', async () => {
      const projectId = 200
      
      // Add initial tickets
      const initialTickets = {
        '10': {
          id: 10,
          projectId,
          title: 'Initial Ticket',
          overview: '',
          status: 'open' as const,
          priority: 'normal' as const,
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
      }
      await ticketStorage.writeTickets(projectId, initialTickets)

      // Try to write tickets with mismatched projectId
      const badTickets = {
        '11': {
          id: 11,
          projectId: 999, // Wrong project ID
          title: 'Bad Ticket',
          overview: '',
          status: 'open' as const,
          priority: 'normal' as const,
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
      }

      await expect(ticketStorage.writeTickets(projectId, badTickets)).rejects.toThrow('mismatched projectId')

      // Original tickets should still exist
      const tickets = await ticketStorage.readTickets(projectId)
      expect(Object.keys(tickets)).toHaveLength(1)
      expect(tickets['10']).toBeDefined()
    })

    it('should rollback all changes on error in writeTicketTasks', async () => {
      const ticketId = 20
      
      // Create parent ticket first
      const ticket: Ticket = {
        id: ticketId,
        projectId: 300,
        title: 'Parent Ticket',
        overview: '',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }
      await ticketStorage.addTicket(ticket)

      // Add initial task
      const initialTasks = {
        '1': {
          id: 1,
          ticketId,
          content: 'Initial Task',
          description: '',
          suggestedFileIds: [],
          done: false,
          orderIndex: 0,
          created: Date.now(),
          updated: Date.now()
        }
      }
      await ticketStorage.writeTicketTasks(ticketId, initialTasks)

      // Try to write tasks with wrong ticketId
      const badTasks = {
        '2': {
          id: 2,
          ticketId: 999, // Wrong ticket ID
          content: 'Bad Task',
          description: '',
          suggestedFileIds: [],
          done: false,
          orderIndex: 1,
          created: Date.now(),
          updated: Date.now()
        }
      }

      await expect(ticketStorage.writeTicketTasks(ticketId, badTasks)).rejects.toThrow('mismatched ticketId')

      // Original task should still exist
      const tasks = await ticketStorage.readTicketTasks(ticketId)
      expect(Object.keys(tasks)).toHaveLength(1)
      expect(tasks['1']).toBeDefined()
    })
  })

  describe('JSON Parsing Edge Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const database = db.getDatabase()
      
      // Insert ticket with malformed JSON directly
      const insertQuery = database.prepare(`
        INSERT INTO tickets (
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      insertQuery.run(
        30, 400, 'Test Ticket', '', 'open', 'normal',
        '{invalid json}', // Malformed JSON
        '[]',
        '[]',
        Date.now(),
        Date.now()
      )

      // Should handle gracefully with fallback
      const tickets = await ticketStorage.readTickets(400)
      expect(tickets['30']).toBeDefined()
      expect(tickets['30'].suggestedFileIds).toEqual([]) // Fallback value
    })

    it('should log warnings for JSON parse failures', async () => {
      const database = db.getDatabase()
      // Note: Bun doesn't have jest.spyOn, we'll track console.warn calls manually
      const originalWarn = console.warn
      const warnCalls: any[] = []
      console.warn = (...args) => warnCalls.push(args)
      
      // Insert task with malformed JSON
      const insertTicketQuery = database.prepare(`
        INSERT INTO tickets (id, project_id, title, overview, status, priority, 
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      insertTicketQuery.run(40, 500, 'Parent', '', 'open', 'normal', '[]', '[]', '[]', Date.now(), Date.now())

      const insertTaskQuery = database.prepare(`
        INSERT INTO ticket_tasks (
          id, ticket_id, content, description, suggested_file_ids,
          done, order_index, estimated_hours, dependencies, tags,
          agent_id, suggested_prompt_ids, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      insertTaskQuery.run(
        3, 40, 'Test Task', '', '[]',
        0, 0, null,
        'not an array', // Invalid JSON
        '{"broken": ]', // Malformed JSON
        null, '[]',
        Date.now(), Date.now()
      )

      await ticketStorage.readTicketTasks(40)
      
      // Restore console.warn
      console.warn = originalWarn
      
      // Check that warnings were logged
      expect(warnCalls.length).toBeGreaterThan(0)
      expect(warnCalls.some(args => args[0].includes('Failed to parse JSON'))).toBe(true)
    })
  })

  describe('Concurrent Access', () => {
    it('should handle concurrent reads safely', async () => {
      const projectId = 600
      
      // Create test tickets
      const tickets: Record<string, Ticket> = {}
      for (let i = 0; i < 10; i++) {
        tickets[String(50 + i)] = {
          id: 50 + i,
          projectId,
          title: `Ticket ${i}`,
          overview: '',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
      }
      await ticketStorage.writeTickets(projectId, tickets)

      // Concurrent reads
      const readPromises = []
      for (let i = 0; i < 5; i++) {
        readPromises.push(ticketStorage.readTickets(projectId))
      }

      const results = await Promise.all(readPromises)
      
      // All reads should return the same data
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(Object.keys(result)).toHaveLength(10)
      })
    })

    it('should handle concurrent writes with proper isolation', async () => {
      // Create multiple tickets concurrently
      const createPromises = []
      for (let i = 0; i < 5; i++) {
        const ticket: Ticket = {
          id: 60 + i,
          projectId: 700,
          title: `Concurrent Ticket ${i}`,
          overview: '',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
        createPromises.push(ticketStorage.addTicket(ticket))
      }

      await Promise.all(createPromises)

      // Verify all tickets were created
      const tickets = await ticketStorage.readTickets(700)
      expect(Object.keys(tickets)).toHaveLength(5)
    })
  })

  describe('Cascade Delete Behavior', () => {
    it('should delete all tasks when deleting a project', async () => {
      const projectId = 800
      
      // Create tickets with tasks
      for (let i = 0; i < 3; i++) {
        const ticket: Ticket = {
          id: 70 + i,
          projectId,
          title: `Ticket ${i}`,
          overview: '',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
        await ticketStorage.addTicket(ticket)

        // Add tasks
        for (let j = 0; j < 2; j++) {
          const task: TicketTask = {
            id: i * 10 + j,
            ticketId: ticket.id,
            content: `Task ${j}`,
            description: '',
            suggestedFileIds: [],
            done: false,
            orderIndex: j,
            created: Date.now(),
            updated: Date.now()
          }
          await ticketStorage.addTask(task)
        }
      }

      // Delete all tickets for project
      await ticketStorage.deleteProjectTickets(projectId)

      // Verify all tickets and tasks are gone
      const tickets = await ticketStorage.readTickets(projectId)
      expect(Object.keys(tickets)).toHaveLength(0)

      // Check tasks are also deleted
      for (let i = 0; i < 3; i++) {
        const tasks = await ticketStorage.readTicketTasks(70 + i)
        expect(Object.keys(tasks)).toHaveLength(0)
      }
    })
  })

  describe('Data Validation', () => {
    it('should validate all ticket fields', async () => {
      const invalidTicket = {
        id: 'not-a-number', // Should be number
        projectId: 900,
        title: '', // Should not be empty
        overview: 123, // Should be string
        status: 'open',
        priority: 'normal',
        suggestedFileIds: 'not-an-array', // Should be array
        created: 'not-a-timestamp', // Should be number
        updated: Date.now()
      } as any

      await expect(ticketStorage.addTicket(invalidTicket)).rejects.toThrow()
    })

    it('should validate all task fields', async () => {
      // Create parent ticket
      const ticket: Ticket = {
        id: 80,
        projectId: 900,
        title: 'Parent',
        overview: '',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }
      await ticketStorage.addTicket(ticket)

      const invalidTask = {
        id: 'not-a-number', // Should be number
        ticketId: 80,
        content: '', // Should not be empty
        done: 'yes', // Should be boolean
        orderIndex: -5, // Should be >= 0
        tags: 'not-an-array', // Should be array
        created: Date.now(),
        updated: Date.now()
      } as any

      await expect(ticketStorage.addTask(invalidTask)).rejects.toThrow()
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const projectId = 1000
      const ticketCount = 100
      const tasksPerTicket = 10

      // Create many tickets
      const tickets: Record<string, Ticket> = {}
      for (let i = 0; i < ticketCount; i++) {
        const ticketId = 100 + i
        tickets[String(ticketId)] = {
          id: ticketId,
          projectId,
          title: `Ticket ${i}`,
          overview: `Description for ticket ${i}`,
          status: i % 3 === 0 ? 'closed' : i % 2 === 0 ? 'in_progress' : 'open',
          priority: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'low' : 'normal',
          suggestedFileIds: [`file${i}.ts`, `test${i}.ts`],
          suggestedAgentIds: [i, i + 1000],
          suggestedPromptIds: [i * 2, i * 2 + 1],
          created: Date.now() - i * 1000,
          updated: Date.now()
        }
      }

      const startWrite = Date.now()
      await ticketStorage.writeTickets(projectId, tickets)
      const writeTime = Date.now() - startWrite

      // Should complete in reasonable time
      expect(writeTime).toBeLessThan(1000) // Less than 1 second

      // Create tasks for each ticket
      for (let i = 0; i < ticketCount; i++) {
        const tasks: Record<string, TicketTask> = {}
        for (let j = 0; j < tasksPerTicket; j++) {
          const taskId = i * 100 + j
          tasks[String(taskId)] = {
            id: taskId,
            ticketId: 100 + i,
            content: `Task ${j} for ticket ${i}`,
            description: `Detailed description of task ${j}`,
            suggestedFileIds: [`task${taskId}.ts`],
            done: j % 2 === 0,
            orderIndex: j,
            estimatedHours: j + 1,
            dependencies: j > 0 ? [taskId - 1] : [],
            tags: [`tag${j % 3}`, `priority${j % 2}`],
            created: Date.now() - j * 1000,
            updated: Date.now()
          }
        }
        await ticketStorage.writeTicketTasks(100 + i, tasks)
      }

      // Test query performance
      const startRead = Date.now()
      const readTickets = await ticketStorage.readTickets(projectId)
      const readTime = Date.now() - startRead

      expect(Object.keys(readTickets)).toHaveLength(ticketCount)
      expect(readTime).toBeLessThan(100) // Should be very fast with indexes

      // Test filtered queries
      const startDateRange = Date.now()
      const recentTickets = await ticketStorage.findTicketsByDateRange(
        projectId,
        Date.now() - 10000,
        Date.now()
      )
      const dateRangeTime = Date.now() - startDateRange

      expect(recentTickets.length).toBeGreaterThan(0)
      expect(dateRangeTime).toBeLessThan(50) // Indexed query should be fast
    })
  })
})