// Recent changes:
// 1. Initial creation of comprehensive ticket API test suite
// 2. Tests ticket and task endpoints (excluding AI features)
// 3. Uses Bun's HTTP client for requests
// 4. Follows create-verify-update-verify-delete pattern
// 5. Ensures no test data persists after completion

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { z } from 'zod'
import { apiFetch } from '../api-fetch'
import type { Endpoint } from '../types/endpoint'
import {
    TicketSchema,
    TaskSchema,
    type Ticket,
    type Task,
    CreateTicketBodySchema,
    UpdateTicketBodySchema,
    TicketResponseSchema,
    TicketListResponseSchema,
    TicketWithTaskCountListResponseSchema,
    TicketWithTasksListResponseSchema,
    TaskResponseSchema,
    TaskListResponseSchema,
    LinkedFilesResponseSchema,
    BulkTasksResponseSchema
} from '../../../shared/src/schemas/ticket.schemas'
import { OperationSuccessResponseSchema } from '../../../shared/src/schemas/common.schemas'

const BASE_URL = process.env.API_URL || 'http://localhost:3147'
const API_URL = `${BASE_URL}/api`

describe('Ticket API Tests', () => {
    let testTickets: Ticket[] = []
    let testTasks: Task[] = []
    let testProjectId: number | null = null
    let testFileIds: number[] = []

    beforeAll(async () => {
        console.log('Starting Ticket API Tests...')
        // Create a test project for tickets
        const createProjectEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/projects`,
            options: { method: 'POST' }
        }
        const projectResult = await apiFetch(
            createProjectEndpoint,
            { name: 'Test Project for Tickets', path: '/test/tickets', description: 'Temporary project for testing tickets' },
            z.object({ success: z.literal(true), data: z.object({ id: z.number() }) })
        )
        testProjectId = projectResult.data.id

        // Get some files from the project to use for linking
        const getFilesEndpoint: Endpoint<never, any> = { url: `${API_URL}/projects/${testProjectId}/files` }
        const filesResult = await apiFetch(getFilesEndpoint, undefined, z.object({ 
            success: z.literal(true), 
            data: z.array(z.object({ id: z.number() })) 
        }))
        testFileIds = filesResult.data.slice(0, 2).map(f => f.id)
    })

    afterAll(async () => {
        console.log('Cleaning up ticket test data...')
        // Delete all test tickets (tasks will be cascade deleted)
        for (const ticket of testTickets) {
            try {
                await fetch(`${API_URL}/tickets/${ticket.id}`, { method: 'DELETE' })
            } catch (err) {
                console.error(`Failed to delete ticket ${ticket.id}:`, err)
            }
        }
        // Delete test project
        if (testProjectId) {
            try {
                await fetch(`${API_URL}/projects/${testProjectId}`, { method: 'DELETE' })
            } catch (err) {
                console.error(`Failed to delete test project ${testProjectId}:`, err)
            }
        }
    })

    test('POST /api/tickets - Create tickets', async () => {
        if (!testProjectId) {
            console.warn('Skipping ticket creation test - no test project')
            return
        }

        const testData = [
            {
                projectId: testProjectId,
                title: 'Test Ticket 1',
                overview: 'First test ticket overview',
                status: 'todo' as const,
                priority: 'high' as const
            },
            {
                projectId: testProjectId,
                title: 'Test Ticket 2',
                overview: 'Second test ticket with medium priority',
                status: 'in_progress' as const,
                priority: 'medium' as const
            },
            {
                projectId: testProjectId,
                title: 'Test Ticket 3',
                overview: 'Third test ticket - low priority',
                status: 'todo' as const,
                priority: 'low' as const
            }
        ]

        const createTicketEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/tickets`,
            options: { method: 'POST' }
        }

        for (const data of testData) {
            const result = await apiFetch(createTicketEndpoint, data, TicketResponseSchema)

            expect(result.success).toBe(true)
            expect(result.ticket).toBeDefined()
            expect(result.ticket.title).toBe(data.title)
            expect(result.ticket.overview).toBe(data.overview)
            expect(result.ticket.status).toBe(data.status)
            expect(result.ticket.priority).toBe(data.priority)
            expect(result.ticket.projectId).toBe(data.projectId)
            expect(result.ticket.id).toBeTypeOf('number')
            expect(result.ticket.created).toBeNumber()
            expect(result.ticket.updated).toBeNumber()

            testTickets.push(result.ticket)
        }
    })

    test('GET /api/tickets/{ticketId} - Get individual tickets', async () => {
        for (const ticket of testTickets) {
            const getTicketEndpoint: Endpoint<never, any> = { url: `${API_URL}/tickets/${ticket.id}` }
            const result = await apiFetch(getTicketEndpoint, undefined, TicketResponseSchema)

            expect(result.success).toBe(true)
            expect(result.ticket.id).toBe(ticket.id)
            expect(result.ticket.title).toBe(ticket.title)
            expect(result.ticket.overview).toBe(ticket.overview)
            expect(result.ticket.status).toBe(ticket.status)
            expect(result.ticket.priority).toBe(ticket.priority)
        }
    })

    test('PATCH /api/tickets/{ticketId} - Update tickets', async () => {
        const updates = [
            { title: 'Updated Ticket 1', status: 'done' as const },
            { overview: 'Updated overview for ticket 2', priority: 'high' as const },
            { status: 'in_progress' as const }
        ]

        for (let i = 0; i < testTickets.length; i++) {
            const ticket = testTickets[i]
            if (!ticket) continue
            const update = updates[i]
            if (!update) continue

            const updateTicketEndpoint: Endpoint<any, any> = {
                url: `${API_URL}/tickets/${ticket.id}`,
                options: { method: 'PATCH' }
            }

            const result = await apiFetch(updateTicketEndpoint, update, TicketResponseSchema)

            expect(result.success).toBe(true)
            if (update.title) expect(result.ticket.title).toBe(update.title)
            if (update.overview) expect(result.ticket.overview).toBe(update.overview)
            if (update.status) expect(result.ticket.status).toBe(update.status)
            if (update.priority) expect(result.ticket.priority).toBe(update.priority)
            expect(result.ticket.updated).toBeGreaterThan(ticket.updated)

            testTickets[i] = result.ticket
        }
    })

    test('POST /api/tickets/{ticketId}/link-files - Link files to ticket', async () => {
        if (testFileIds.length === 0) {
            console.warn('Skipping file linking test - no test files')
            return
        }

        const ticket = testTickets[0]
        if (!ticket) return

        const linkFilesEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/tickets/${ticket.id}/link-files`,
            options: { method: 'POST' }
        }
        const result = await apiFetch(
            linkFilesEndpoint, 
            { fileIds: testFileIds },
            LinkedFilesResponseSchema
        )

        expect(result.success).toBe(true)
        expect(result.linkedFiles).toBeDefined()
        expect(Array.isArray(result.linkedFiles)).toBe(true)
    })

    test('GET /api/projects/{projectId}/tickets - List tickets by project', async () => {
        if (!testProjectId) return

        const listTicketsEndpoint: Endpoint<never, any> = { 
            url: `${API_URL}/projects/${testProjectId}/tickets` 
        }
        const result = await apiFetch(listTicketsEndpoint, undefined, TicketListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.tickets)).toBe(true)
        expect(result.tickets.length).toBe(testTickets.length)

        for (const testTicket of testTickets) {
            const found = result.tickets.find((t: Ticket) => t.id === testTicket.id)
            expect(found).toBeDefined()
            expect(found.title).toBe(testTicket.title)
        }
    })

    test('GET /api/projects/{projectId}/tickets?status=todo - Filter tickets by status', async () => {
        if (!testProjectId) return

        const listTicketsEndpoint: Endpoint<never, any> = { 
            url: `${API_URL}/projects/${testProjectId}/tickets?status=todo` 
        }
        const result = await apiFetch(listTicketsEndpoint, undefined, TicketListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.tickets)).toBe(true)
        
        // All returned tickets should have 'todo' status
        for (const ticket of result.tickets) {
            expect(ticket.status).toBe('todo')
        }
    })

    test('POST /api/tickets/{ticketId}/tasks - Create tasks', async () => {
        const ticket = testTickets[0]
        if (!ticket) return

        const taskContents = [
            'First task for ticket',
            'Second task for ticket',
            'Third task for ticket'
        ]

        const createTaskEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/tickets/${ticket.id}/tasks`,
            options: { method: 'POST' }
        }

        for (const content of taskContents) {
            const result = await apiFetch(createTaskEndpoint, { content }, TaskResponseSchema)

            expect(result.success).toBe(true)
            expect(result.task).toBeDefined()
            expect(result.task.content).toBe(content)
            expect(result.task.ticketId).toBe(ticket.id)
            expect(result.task.done).toBe(false)
            expect(result.task.id).toBeTypeOf('number')
            expect(result.task.orderIndex).toBeTypeOf('number')

            testTasks.push(result.task)
        }
    })

    test('GET /api/tickets/{ticketId}/tasks - Get tasks for ticket', async () => {
        const ticket = testTickets[0]
        if (!ticket) return

        const getTasksEndpoint: Endpoint<never, any> = { url: `${API_URL}/tickets/${ticket.id}/tasks` }
        const result = await apiFetch(getTasksEndpoint, undefined, TaskListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.tasks)).toBe(true)
        expect(result.tasks.length).toBe(testTasks.length)

        for (const testTask of testTasks) {
            const found = result.tasks.find((t: Task) => t.id === testTask.id)
            expect(found).toBeDefined()
            expect(found.content).toBe(testTask.content)
            expect(found.ticketId).toBe(ticket.id)
        }
    })

    test('PATCH /api/tickets/{ticketId}/tasks/{taskId} - Update task', async () => {
        const task = testTasks[0]
        if (!task) return

        const updateTaskEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/tickets/${task.ticketId}/tasks/${task.id}`,
            options: { method: 'PATCH' }
        }

        const result = await apiFetch(
            updateTaskEndpoint, 
            { content: 'Updated task content', done: true },
            TaskResponseSchema
        )

        expect(result.success).toBe(true)
        expect(result.task.content).toBe('Updated task content')
        expect(result.task.done).toBe(true)
        expect(result.task.updated).toBeGreaterThan(task.updated)

        // Update local copy
        testTasks[0] = result.task
    })

    test('PATCH /api/tickets/{ticketId}/tasks/reorder - Reorder tasks', async () => {
        const ticket = testTickets[0]
        if (!ticket || testTasks.length < 2) return

        // Reverse the order of tasks
        const reorderedTasks = testTasks.map((task, index) => ({
            id: task.id,
            orderIndex: testTasks.length - index - 1
        }))

        const reorderTasksEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/tickets/${ticket.id}/tasks/reorder`,
            options: { method: 'PATCH' }
        }

        const result = await apiFetch(
            reorderTasksEndpoint,
            { tasks: reorderedTasks },
            TaskListResponseSchema
        )

        expect(result.success).toBe(true)
        expect(Array.isArray(result.tasks)).toBe(true)
        
        // Verify new order
        const sortedTasks = result.tasks.sort((a, b) => a.orderIndex - b.orderIndex)
        expect(sortedTasks[0].id).toBe(testTasks[testTasks.length - 1].id)
    })

    test('GET /api/projects/{projectId}/tickets-with-count - Get tickets with task counts', async () => {
        if (!testProjectId) return

        const listTicketsWithCountEndpoint: Endpoint<never, any> = { 
            url: `${API_URL}/projects/${testProjectId}/tickets-with-count` 
        }
        const result = await apiFetch(listTicketsWithCountEndpoint, undefined, TicketWithTaskCountListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.ticketsWithCount)).toBe(true)

        const ticketWithTasks = result.ticketsWithCount.find(
            item => item.ticket.id === testTickets[0]?.id
        )
        if (ticketWithTasks) {
            expect(ticketWithTasks.taskCount).toBe(testTasks.length)
            expect(ticketWithTasks.completedTaskCount).toBe(1) // We marked one as done
        }
    })

    test('GET /api/projects/{projectId}/tickets-with-tasks - Get tickets with their tasks', async () => {
        if (!testProjectId) return

        const listTicketsWithTasksEndpoint: Endpoint<never, any> = { 
            url: `${API_URL}/projects/${testProjectId}/tickets-with-tasks` 
        }
        const result = await apiFetch(listTicketsWithTasksEndpoint, undefined, TicketWithTasksListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.ticketsWithTasks)).toBe(true)

        const ticketWithTasks = result.ticketsWithTasks.find(
            item => item.ticket.id === testTickets[0]?.id
        )
        if (ticketWithTasks) {
            expect(Array.isArray(ticketWithTasks.tasks)).toBe(true)
            expect(ticketWithTasks.tasks.length).toBe(testTasks.length)
        }
    })

    test('GET /api/tickets/bulk-tasks?ids= - Get tasks for multiple tickets', async () => {
        if (testTickets.length < 2) return

        const ticketIds = testTickets.slice(0, 2).map(t => t.id).join(',')
        const bulkTasksEndpoint: Endpoint<never, any> = { 
            url: `${API_URL}/tickets/bulk-tasks?ids=${ticketIds}` 
        }
        const result = await apiFetch(bulkTasksEndpoint, undefined, BulkTasksResponseSchema)

        expect(result.success).toBe(true)
        expect(typeof result.tasks).toBe('object')
        
        // First ticket should have tasks
        const firstTicketTasks = result.tasks[testTickets[0].id.toString()]
        if (firstTicketTasks) {
            expect(Array.isArray(firstTicketTasks)).toBe(true)
            expect(firstTicketTasks.length).toBe(testTasks.length)
        }
    })

    test('DELETE /api/tickets/{ticketId}/tasks/{taskId} - Delete task', async () => {
        const taskToDelete = testTasks.pop()
        if (!taskToDelete) return

        const deleteTaskEndpoint: Endpoint<never, any> = {
            url: `${API_URL}/tickets/${taskToDelete.ticketId}/tasks/${taskToDelete.id}`,
            options: { method: 'DELETE' }
        }
        const result = await apiFetch(deleteTaskEndpoint, undefined, OperationSuccessResponseSchema)

        expect(result.success).toBe(true)
        expect(result.message).toBe('Task deleted successfully')
    })

    test('DELETE /api/tickets/{ticketId} - Delete all test tickets', async () => {
        for (const ticket of testTickets) {
            const deleteTicketEndpoint: Endpoint<never, any> = {
                url: `${API_URL}/tickets/${ticket.id}`,
                options: { method: 'DELETE' }
            }
            const result = await apiFetch(deleteTicketEndpoint, undefined, OperationSuccessResponseSchema)

            expect(result.success).toBe(true)
            expect(result.message).toBe('Ticket deleted successfully')
        }
    })

    test('GET /api/projects/{projectId}/tickets - Verify deletions', async () => {
        if (!testProjectId) return

        const listTicketsEndpoint: Endpoint<never, any> = { 
            url: `${API_URL}/projects/${testProjectId}/tickets` 
        }
        const result = await apiFetch(listTicketsEndpoint, undefined, TicketListResponseSchema)

        expect(result.success).toBe(true)
        expect(result.tickets.length).toBe(0)
    })

    test('GET /api/tickets/{ticketId} - Verify 404 after deletion', async () => {
        for (const ticket of testTickets) {
            const response = await fetch(`${API_URL}/tickets/${ticket.id}`)
            expect(response.status).toBe(404)

            const result = await response.json() as any
            expect(result.success).toBe(false)
            expect(result.error.code).toBe('TICKET_NOT_FOUND')
        }
    })
})