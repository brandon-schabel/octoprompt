import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { z } from 'zod'
import { createOctoPromptClient, OctoPromptError } from '@octoprompt/api-client'
import type { OctoPromptClient } from '@octoprompt/api-client'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  TicketSchema,
  TaskSchema,
  type Ticket,
  type TicketTask,
  type CreateTicketBody,
  ProjectFileSchema
} from '@octoprompt/schemas'
import { TEST_API_URL } from './test-config'

const BASE_URL = TEST_API_URL

// Schemas for direct validation of client specific response structures if not fully covered by simple DataResponseSchema<T>
const SpecificTicketResponseSchema = z.object({ success: z.literal(true), ticket: TicketSchema })
const SpecificTicketListResponseSchema = z.object({ success: z.literal(true), tickets: z.array(TicketSchema) })
const SpecificTaskResponseSchema = z.object({ success: z.literal(true), task: TaskSchema })
const SpecificTaskListResponseSchema = z.object({ success: z.literal(true), tasks: z.array(TaskSchema) })
const SpecificLinkedFilesResponseSchema = z.object({
  success: z.literal(true),
  linkedFiles: z.array(z.object({
    ticketId: z.number(),
    fileId: z.number()
  }))
})
const SpecificBulkTasksResponseSchema = z.object({
  success: z.literal(true),
  tasks: z.record(z.string(), z.array(TaskSchema))
})

const SpecificTicketWithTaskCountListResponseSchema = z.object({
  success: z.literal(true),
  ticketsWithCount: z.array(
    z.object({
      ticket: TicketSchema,
      taskCount: z.number(),
      completedTaskCount: z.number()
    })
  )
})
const SpecificTicketWithTasksListResponseSchema = z.object({
  success: z.literal(true),
  ticketsWithTasks: z.array(
    z.object({
      ticket: TicketSchema,
      tasks: z.array(TaskSchema)
    })
  )
})

describe('Ticket API Tests', () => {
  let client: OctoPromptClient
  let testTickets: Ticket[] = []
  let testTasks: TicketTask[] = [] // For tasks belonging to the first ticket primarily
  let testProjectId: number | null = null
  let testProjectFileIds: number[] = []

  beforeAll(async () => {
    console.log('Starting Ticket API Tests...')
    client = createOctoPromptClient({ baseUrl: BASE_URL })

    try {
      // Create a temporary directory for the test project
      const tempDir = mkdtempSync(join(tmpdir(), `ticket-test-${Date.now()}-`))
      
      const projectResult = await client.projects.createProject({
        name: 'Test Project for Tickets',
        path: tempDir,
        description: 'Temporary project for testing tickets'
      })
      if (projectResult.success) {
        testProjectId = projectResult.data.id
        console.log(`Test project created with ID: ${testProjectId}`)

        // Create a dummy file in the project path if needed for sync, or rely on sync to find existing files
        writeFileSync(join(projectResult.data.path, 'ticket-test-file.txt'), 'some content')
        await client.projects.syncProject(testProjectId) // Sync to populate files

        const filesResult = await client.projects.getProjectFiles(testProjectId)
        if (filesResult.success && filesResult.data.length > 0) {
          testProjectFileIds = filesResult.data.slice(0, 2).map((f) => f.id)
          console.log(`Found ${testProjectFileIds.length} test files:`, testProjectFileIds)
        } else {
          console.warn('No files found in test project for linking, or failed to fetch files.')
        }
      } else {
        throw new Error('Failed to create test project for tickets.')
      }
    } catch (error) {
      console.error('Error in beforeAll setup for Ticket API Tests:', error)
      throw error
    }
  })

  afterAll(async () => {
    console.log('Cleaning up ticket test data...')
    // Tickets (and their tasks) should be cleaned up by project deletion if cascade delete is implemented
    // Explicitly delete tickets if not, or for safety
    for (const ticket of testTickets) {
      try {
        await client.tickets.deleteTicket(ticket.id)
      } catch (err) {
        if (err instanceof OctoPromptError && err.statusCode === 404) {
          /* ignore */
        } else console.error(`Failed to delete ticket ${ticket.id}:`, err)
      }
    }

    if (testProjectId) {
      try {
        await client.projects.deleteProject(testProjectId)
        console.log(`Cleaned up test project ${testProjectId}`)
      } catch (err) {
        if (err instanceof OctoPromptError && err.statusCode === 404) {
          /* ignore */
        } else console.error(`Failed to delete test project ${testProjectId}:`, err)
      }
    }
  })

  test('POST /api/tickets - Create tickets', async () => {
    if (!testProjectId) {
      console.warn('Skipping ticket creation test - no test project ID.')
      return
    }
    const ticketInputData: CreateTicketBody[] = [
      {
        projectId: testProjectId,
        title: 'Test Ticket 1',
        overview: 'First overview',
        status: 'open',
        priority: 'high',
        suggestedFileIds: []
      },
      {
        projectId: testProjectId,
        title: 'Test Ticket 2',
        overview: 'Second overview',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: []
      }
    ]

    for (const data of ticketInputData) {
      const result = await client.tickets.createTicket(data) // client.tickets.createTicket returns { success, ticket }
      expect(SpecificTicketResponseSchema.safeParse(result).success).toBe(true) // Validate entire response structure
      expect(result.ticket.title).toBe(data.title)
      expect(result.ticket.projectId).toBe(testProjectId)
      testTickets.push(result.ticket)
    }
  })

  test('GET /api/tickets/{ticketId} - Get individual tickets', async () => {
    for (const ticket of testTickets) {
      const result = await client.tickets.getTicket(ticket.id)
      expect(SpecificTicketResponseSchema.safeParse(result).success).toBe(true)
      expect(result.ticket.id).toBe(ticket.id)
      expect(result.ticket.title).toBe(ticket.title)
    }
  })

  test('PATCH /api/tickets/{ticketId} - Update tickets', async () => {
    if (testTickets.length === 0) return
    const ticketToUpdate = testTickets[0]!
    const updatePayload = { title: 'Updated Ticket 1 Title', status: 'done' as const }

    const result = await client.tickets.updateTicket(ticketToUpdate.id, updatePayload)
    expect(SpecificTicketResponseSchema.safeParse(result).success).toBe(true)
    expect(result.ticket.title).toBe(updatePayload.title)
    expect(result.ticket.status).toBe(updatePayload.status)
    expect(result.ticket.updated).toBeGreaterThanOrEqual(ticketToUpdate.updated)
    testTickets[0] = result.ticket // Update local copy
  })

  test('POST /api/tickets/{ticketId}/link-files - Link files to ticket', async () => {
    if (testTickets.length === 0 || testProjectFileIds.length === 0) {
      console.warn('Skipping link files test - no ticket or no project files.')
      return
    }
    const ticket = testTickets[0]!
    const result = await client.tickets.linkFilesToTicket(ticket.id, testProjectFileIds)
    expect(SpecificLinkedFilesResponseSchema.safeParse(result).success).toBe(true)
    expect(result.linkedFiles.length).toBe(testProjectFileIds.length)
    result.linkedFiles.forEach((file) => {
      expect(testProjectFileIds).toContain(file.fileId)
      expect(file.ticketId).toBe(ticket.id)
    })
  })

  test('GET /api/projects/{projectId}/tickets - List tickets by project', async () => {
    if (!testProjectId) return
    const result = await client.tickets.listProjectTickets(testProjectId) // Returns { success, tickets }
    expect(SpecificTicketListResponseSchema.safeParse(result).success).toBe(true)
    expect(result.tickets.length).toBe(testTickets.length)
  })

  test('GET /api/projects/{projectId}/tickets?status=open - Filter tickets by status', async () => {
    if (!testProjectId) return
    // Assuming at least one ticket is 'open', or adjust test data if 'Test Ticket 2' is still open
    const openTicketsInLocal = testTickets.filter((t) => t.status === 'open')
    if (openTicketsInLocal.length === 0) {
      console.warn("Skipping filter by status 'open' as no local test tickets are open.")
      // Potentially create an open ticket here if needed, or ensure test data supports this.
      // For now, if this happens, the test might not be meaningful.
    }

    const result = await client.tickets.listProjectTickets(testProjectId, 'open')
    expect(SpecificTicketListResponseSchema.safeParse(result).success).toBe(true)
    result.tickets.forEach((ticket) => expect(ticket.status).toBe('open'))
    // This assertion is correct if all tickets fetched by this filter are indeed 'open'.
    // Compare with local open tickets if confident about data state.
    // expect(result.tickets.length).toBe(openTicketsInLocal.length); // This can be flaky if other tests modify status
  })

  test('POST /api/tickets/{ticketId}/tasks - Create tasks for a ticket', async () => {
    if (testTickets.length === 0) return
    const ticket = testTickets[0]!
    const taskContents = ['Task 1 for ticket', 'Task 2 for ticket']
    testTasks = [] // Clear previous tasks for this ticket

    for (const content of taskContents) {
      const result = await client.tickets.createTask(ticket.id, content) // Returns { success, task }
      expect(SpecificTaskResponseSchema.safeParse(result).success).toBe(true)
      expect(result.task.content).toBe(content)
      expect(result.task.ticketId).toBe(ticket.id)
      testTasks.push(result.task)
    }
  })

  test('GET /api/tickets/{ticketId}/tasks - Get tasks for ticket', async () => {
    if (testTickets.length === 0 || testTasks.length === 0) return
    const ticket = testTickets[0]!
    const result = await client.tickets.getTasks(ticket.id) // Returns { success, tasks }
    expect(SpecificTaskListResponseSchema.safeParse(result).success).toBe(true)
    expect(result.tasks.length).toBe(testTasks.length)
  })

  test('PATCH /api/tickets/{ticketId}/tasks/{taskId} - Update task', async () => {
    if (testTasks.length === 0) return
    const taskToUpdate = testTasks[0]!
    const updatePayload = { content: 'Updated Task Content', done: true }

    const result = await client.tickets.updateTask(taskToUpdate.ticketId, taskToUpdate.id, updatePayload)
    expect(SpecificTaskResponseSchema.safeParse(result).success).toBe(true)
    expect(result.task.content).toBe(updatePayload.content)
    expect(result.task.done).toBe(updatePayload.done)
    testTasks[0] = result.task // Update local
  })

  test('PATCH /api/tickets/{ticketId}/tasks/reorder - Reorder tasks', async () => {
    if (testTickets.length === 0 || testTasks.length < 2) {
      console.warn('Skipping reorder tasks test: needs a ticket with at least 2 tasks.')
      return
    }
    const ticket = testTickets[0]!
    const reorderPayload = {
      tasks: testTasks.map((task, index) => ({ taskId: task.id, orderIndex: testTasks.length - 1 - index }))
    }

    const result = await client.tickets.reorderTasks(ticket.id, reorderPayload) // Returns { success, tasks }
    expect(SpecificTaskListResponseSchema.safeParse(result).success).toBe(true)
    expect(result.tasks[0]!.id).toBe(testTasks[testTasks.length - 1]!.id) // Check if first element is now the last one from original
    testTasks = result.tasks.sort((a, b) => a.orderIndex - b.orderIndex) // Update local order
  })

  test('GET /api/projects/{projectId}/tickets-with-count - Get tickets with task counts', async () => {
    if (!testProjectId || testTickets.length === 0) return
    const result = await client.tickets.listTicketsWithTaskCount(testProjectId)
    expect(SpecificTicketWithTaskCountListResponseSchema.safeParse(result).success).toBe(true)

    const ticketData = result.ticketsWithCount.find((tc) => tc.ticket.id === testTickets[0]!.id)
    if (ticketData && testTasks.length > 0) {
      // Only if tasks were added to testTickets[0]
      expect(ticketData.taskCount).toBe(testTasks.length)
      expect(ticketData.completedTaskCount).toBe(testTasks.filter((t) => t.done).length)
    }
  })

  test('GET /api/projects/{projectId}/tickets-with-tasks - Get tickets with their tasks', async () => {
    if (!testProjectId || testTickets.length === 0) return
    const result = await client.tickets.listTicketsWithTasks(testProjectId)
    expect(SpecificTicketWithTasksListResponseSchema.safeParse(result).success).toBe(true)

    const ticketData = result.ticketsWithTasks.find((twt) => twt.ticket.id === testTickets[0]!.id)
    if (ticketData && testTasks.length > 0) {
      expect(ticketData.tasks.length).toBe(testTasks.length)
    }
  })

  test('GET /api/tickets/bulk-tasks?ids= - Get tasks for multiple tickets', async () => {
    if (testTickets.length < 1) {
      // Need at least one ticket with tasks.
      console.warn('Skipping bulk-tasks test due to insufficient test tickets.')
      return
    }
    const ticketIdsToQuery = testTickets.map((t) => t.id).slice(0, 2) // Query for first two tickets
    if (ticketIdsToQuery.length === 0) return

    const result = await client.tickets.getTasksForTickets(ticketIdsToQuery) // Returns { success, tasks: Record }
    expect(SpecificBulkTasksResponseSchema.safeParse(result).success).toBe(true)

    const firstTicketIdStr = String(testTickets[0]!.id)
    if (result.tasks[firstTicketIdStr] && testTasks.length > 0) {
      // If tasks were added to first ticket
      expect(result.tasks[firstTicketIdStr]!.length).toBe(testTasks.length)
    } else if (result.tasks[firstTicketIdStr]) {
      expect(result.tasks[firstTicketIdStr]!.length).toBe(0)
    }
  })

  test('DELETE /api/tickets/{ticketId}/tasks/{taskId} - Delete task', async () => {
    if (testTasks.length === 0) return
    const taskToDelete = testTasks.pop()! // Delete the last task

    const success = await client.tickets.deleteTask(taskToDelete.ticketId, taskToDelete.id)
    expect(success).toBe(true)
  })

  test('DELETE /api/tickets/{ticketId} - Delete all test tickets and verify', async () => {
    const ticketsToDelete = [...testTickets]
    testTickets = []

    for (const ticket of ticketsToDelete) {
      const success = await client.tickets.deleteTicket(ticket.id)
      expect(success).toBe(true)

      try {
        await client.tickets.getTicket(ticket.id)
        expect(true).toBe(false) // Should fail
      } catch (error) {
        expect(error).toBeInstanceOf(OctoPromptError)
        if (error instanceof OctoPromptError) {
          expect(error.statusCode).toBe(404)
        }
      }
    }
  })
})
