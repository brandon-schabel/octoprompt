import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { ApiError } from '@octoprompt/shared'
import { MEDIUM_MODEL_CONFIG } from '@octoprompt/schemas'
import * as ticketService from './ticket-service'
import type { CreateTicketBody, UpdateTicketBody } from '@octoprompt/schemas'
import { ticketStorage } from '@octoprompt/storage'
import { projectStorage } from '@octoprompt/storage'
import * as genAiServices from './gen-ai-services'
import * as getFullProjectSummaryModule from '@/utils/get-full-project-summary'

// Use realistic unix timestamps for test IDs
const BASE_TIMESTAMP = 1700000000000 // Nov 2023 as base
const defaultProjectId = BASE_TIMESTAMP + 1000 // 1700000001000
const existingFileId1 = BASE_TIMESTAMP + 2000 // 1700000002000
const existingFileId2 = BASE_TIMESTAMP + 3000 // 1700000003000

describe('Ticket Service (File Storage Mock)', () => {
  let mockIdCounter = BASE_TIMESTAMP + 10000 // Start at 1700000010000

  // Mock the storage modules
  const mockTicketStorage = {
    readTickets: mock(() => Promise.resolve({})),
    writeTickets: mock(() => Promise.resolve({})),
    readTicketTasks: mock(() => Promise.resolve({})),
    writeTicketTasks: mock(() => Promise.resolve({})),
    readTicketFiles: mock(() => Promise.resolve([]) as Promise<Array<{ ticketId: number; fileId: number }>>),
    writeTicketFiles: mock(() => Promise.resolve([])),
    deleteTicketData: mock(() => Promise.resolve()),
    generateId: mock(() => {
      const id = mockIdCounter
      mockIdCounter += 1000 // Increment by 1000 for next ID
      return id
    })
  }

  const mockProjectStorage = {
    readProjectFiles: mock(() =>
      Promise.resolve({
        [existingFileId1.toString()]: {
          id: existingFileId1,
          name: 'file1.ts',
          path: 'path/to/file1.ts',
          content: 'content1',
          created: BASE_TIMESTAMP,
          updated: BASE_TIMESTAMP,
          projectId: defaultProjectId,
          extension: '.ts',
          size: 100,
          summary: null,
          summaryLastUpdated: null,
          meta: null,
          checksum: 'checksum1'
        },
        [existingFileId2.toString()]: {
          id: existingFileId2,
          name: 'file2.ts',
          path: 'path/to/file2.ts',
          content: 'content2',
          created: BASE_TIMESTAMP,
          updated: BASE_TIMESTAMP,
          projectId: defaultProjectId,
          extension: '.ts',
          size: 120,
          summary: null,
          summaryLastUpdated: null,
          meta: null,
          checksum: 'checksum2'
        }
      })
    )
  }

  // Mock the AI services
  const mockGenerateStructuredData = mock(() =>
    Promise.resolve({
      object: {
        tasks: [
          { title: 'Mock AI Task 1', description: 'Description 1' },
          { title: 'Mock AI Task 2', description: 'Description 2' }
        ]
      },
      usage: { completionTokens: 50, promptTokens: 100, totalTokens: 150 },
      finishReason: 'stop'
    } as any)
  )

  const mockGetFullProjectSummary = mock(() => Promise.resolve('Mock project summary'))

  beforeEach(() => {
    // Reset mocks and counter
    mockIdCounter = BASE_TIMESTAMP + 10000

    // Reset all mock call counts
    Object.values(mockTicketStorage).forEach((mockFn) => mockFn.mockClear?.())
    Object.values(mockProjectStorage).forEach((mockFn) => mockFn.mockClear?.())
    mockGenerateStructuredData.mockClear()
    mockGetFullProjectSummary.mockClear()

    // Apply mocks
    spyOn(ticketStorage, 'readTickets').mockImplementation(mockTicketStorage.readTickets)
    spyOn(ticketStorage, 'writeTickets').mockImplementation(mockTicketStorage.writeTickets)
    spyOn(ticketStorage, 'readTicketTasks').mockImplementation(mockTicketStorage.readTicketTasks)
    spyOn(ticketStorage, 'writeTicketTasks').mockImplementation(mockTicketStorage.writeTicketTasks)
    spyOn(ticketStorage, 'readTicketFiles').mockImplementation(mockTicketStorage.readTicketFiles)
    spyOn(ticketStorage, 'writeTicketFiles').mockImplementation(mockTicketStorage.writeTicketFiles)
    spyOn(ticketStorage, 'deleteTicketData').mockImplementation(mockTicketStorage.deleteTicketData)
    spyOn(ticketStorage, 'generateId').mockImplementation(mockTicketStorage.generateId)

    spyOn(projectStorage, 'readProjectFiles').mockImplementation(mockProjectStorage.readProjectFiles)

    spyOn(genAiServices, 'generateStructuredData').mockImplementation(mockGenerateStructuredData)
    spyOn(getFullProjectSummaryModule, 'getFullProjectSummary').mockImplementation(mockGetFullProjectSummary)
  })

  afterEach(() => {
    // Restore all mocks
    mock.restore()
  })

  test('createTicket creates a new ticket', async () => {
    const input: CreateTicketBody = {
      projectId: defaultProjectId,
      title: 'Test Ticket',
      overview: 'Test overview',
      status: 'open',
      priority: 'high',
      suggestedFileIds: [existingFileId1]
    }
    const created = await ticketService.createTicket(input)

    expect(created.id).toBeGreaterThan(0)
    expect(created.projectId).toBe(defaultProjectId)
    expect(created.title).toBe('Test Ticket')
    expect(created.overview).toBe('Test overview')
    expect(created.status).toBe('open')
    expect(created.priority).toBe('high')
    expect(created.suggestedFileIds).toEqual([existingFileId1])
    expect(typeof created.created).toBe('number')
    expect(typeof created.updated).toBe('number')
    expect(created.created).toBe(created.updated)

    expect(mockTicketStorage.readTickets).toHaveBeenCalledTimes(1)
    expect(mockTicketStorage.writeTickets).toHaveBeenCalledTimes(1)
    expect(mockTicketStorage.writeTicketTasks).toHaveBeenCalledTimes(1)
    expect(mockTicketStorage.writeTicketFiles).toHaveBeenCalledTimes(1)
  })

  test('createTicket with minimal data', async () => {
    const input: CreateTicketBody = {
      projectId: defaultProjectId,
      title: 'Minimal Ticket',
      overview: '',
      status: 'open',
      priority: 'normal',
      suggestedFileIds: []
    }
    const created = await ticketService.createTicket(input)

    expect(created.id).toBeGreaterThan(0)
    expect(created.projectId).toBe(defaultProjectId)
    expect(created.title).toBe('Minimal Ticket')
    expect(created.overview).toBe('')
    expect(created.status).toBe('open')
    expect(created.priority).toBe('normal')
    expect(created.suggestedFileIds).toEqual([])
  })

  test('createTicket handles ID conflict by incrementing', async () => {
    // Mock readTickets to return existing ticket with generated ID
    const existingTicketId = BASE_TIMESTAMP + 10000 // Same as mockIdCounter initial value
    mockTicketStorage.readTickets.mockResolvedValueOnce({
      [existingTicketId.toString()]: { id: existingTicketId }
    })

    const firstTicket = await ticketService.createTicket({
      projectId: defaultProjectId,
      title: 'First',
      overview: '',
      status: 'open',
      priority: 'normal',
      suggestedFileIds: []
    })

    // Should get incremented ID since initial ID was taken
    expect(firstTicket.id).toBe(existingTicketId + 1) // ID gets incremented by 1
  })

  test('getTicketById returns ticket if found, throws ApiError if not', async () => {
    const ticketId = BASE_TIMESTAMP + 5000
    const mockTicket = {
      id: ticketId,
      projectId: defaultProjectId,
      title: 'Found',
      overview: 'Overview',
      status: 'open' as const,
      priority: 'normal' as const,
      suggestedFileIds: [],
      created: Date.now(),
      updated: Date.now()
    }

    // Test found case
    mockTicketStorage.readTickets.mockResolvedValueOnce({
      [ticketId.toString()]: mockTicket
    })
    const found = await ticketService.getTicketById(ticketId)
    expect(found).toEqual(mockTicket)

    // Test not found case
    mockTicketStorage.readTickets.mockResolvedValueOnce({})
    await expect(ticketService.getTicketById(ticketId)).rejects.toThrow(
      new ApiError(404, `Ticket with ID ${ticketId} not found.`, 'TICKET_NOT_FOUND')
    )
  })

  test('listTicketsByProject returns tickets for a project, optionally filtered by status', async () => {
    const t1Id = BASE_TIMESTAMP + 6000
    const t2Id = BASE_TIMESTAMP + 7000
    const t3Id = BASE_TIMESTAMP + 8000
    const t4Id = BASE_TIMESTAMP + 9000

    // Create tickets with different timestamps to test sorting
    const baseTime = Date.now()
    mockTicketStorage.readTickets.mockResolvedValue({
      [t1Id.toString()]: {
        id: t1Id,
        projectId: defaultProjectId,
        title: 'T1 Closed',
        status: 'closed',
        created: baseTime + 1000
      },
      [t2Id.toString()]: {
        id: t2Id,
        projectId: defaultProjectId,
        title: 'T2 Open',
        status: 'open',
        created: baseTime + 2000
      },
      [t3Id.toString()]: {
        id: t3Id,
        projectId: defaultProjectId + 1000,
        title: 'T3 Other Project',
        status: 'open',
        created: baseTime + 3000
      },
      [t4Id.toString()]: {
        id: t4Id,
        projectId: defaultProjectId,
        title: 'T4 Open',
        status: 'open',
        created: baseTime + 4000
      }
    })

    // Test all tickets for project
    let fromA = await ticketService.listTicketsByProject(defaultProjectId)
    expect(fromA.length).toBe(3)
    expect(fromA[0].title).toBe('T4 Open') // Most recent first
    expect(fromA[1].title).toBe('T2 Open')
    expect(fromA[2].title).toBe('T1 Closed')

    // Test filtered by status
    let openOnly = await ticketService.listTicketsByProject(defaultProjectId, 'open')
    expect(openOnly.length).toBe(2)
    expect(openOnly[0].title).toBe('T4 Open')
    expect(openOnly[1].title).toBe('T2 Open')
  })

  test('updateTicket updates fields and returns updated ticket', async () => {
    const ticketId = BASE_TIMESTAMP + 11000
    const existingTicket = {
      id: ticketId,
      projectId: defaultProjectId,
      title: 'Old Title',
      overview: 'Old overview',
      status: 'open' as const,
      priority: 'normal' as const,
      suggestedFileIds: [],
      created: Date.now() - 1000,
      updated: Date.now() - 1000
    }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: existingTicket
    })

    const updates: UpdateTicketBody = {
      title: 'New Title',
      status: 'done',
      suggestedFileIds: [existingFileId1]
    }

    const updated = await ticketService.updateTicket(ticketId, updates)

    expect(updated.title).toBe('New Title')
    expect(updated.status).toBe('done')
    expect(updated.suggestedFileIds).toEqual([existingFileId1])
    expect(updated.overview).toBe('Old overview') // Unchanged
    expect(updated.priority).toBe('normal') // Unchanged
    expect(updated.updated).toBeGreaterThan(existingTicket.updated)
    expect(updated.created).toBe(existingTicket.created) // Should not change
  })

  test('updateTicket throws if suggestedFileId not in project', async () => {
    const ticketId = BASE_TIMESTAMP + 12000
    const existingTicket = { id: ticketId, projectId: defaultProjectId }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: existingTicket
    })

    const nonExistentFileId = BASE_TIMESTAMP + 99000
    const updates: UpdateTicketBody = { suggestedFileIds: [nonExistentFileId] }

    await expect(ticketService.updateTicket(ticketId, updates)).rejects.toThrow(
      new ApiError(
        400,
        `File with ID ${nonExistentFileId} not found in project ${defaultProjectId}.`,
        'FILE_NOT_FOUND_IN_PROJECT'
      )
    )
  })

  test('updateTicket throws ApiError if ticket does not exist', async () => {
    const ticketId = BASE_TIMESTAMP + 13000
    mockTicketStorage.readTickets.mockResolvedValue({})

    await expect(ticketService.updateTicket(ticketId, { suggestedFileIds: [] })).rejects.toThrow(
      new ApiError(404, `Ticket with ID ${ticketId} not found for update.`, 'TICKET_NOT_FOUND')
    )
  })

  test('deleteTicket removes ticket and its data', async () => {
    const ticketId = BASE_TIMESTAMP + 14000
    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: { id: ticketId }
    })

    await ticketService.deleteTicket(ticketId)

    expect(mockTicketStorage.deleteTicketData).toHaveBeenCalledWith(ticketId)
    expect(mockTicketStorage.writeTickets).toHaveBeenCalled()
  })

  test('deleteTicket throws ApiError if ticket does not exist', async () => {
    const ticketId = BASE_TIMESTAMP + 15000
    mockTicketStorage.readTickets.mockResolvedValue({})

    await expect(ticketService.deleteTicket(ticketId)).rejects.toThrow(
      new ApiError(404, `Ticket with ID ${ticketId} not found for deletion.`, 'TICKET_NOT_FOUND')
    )
  })

  test('linkFilesToTicket links files and updates ticket timestamp', async () => {
    const ticketId = BASE_TIMESTAMP + 16000
    const mockTicket = { id: ticketId, projectId: defaultProjectId }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })
    mockTicketStorage.readTicketFiles.mockResolvedValue([])

    const linkedFiles = await ticketService.linkFilesToTicket(ticketId, [existingFileId1, existingFileId2])

    expect(linkedFiles.length).toBe(2)
    expect(linkedFiles[0]).toEqual({ ticketId, fileId: existingFileId1 })
    expect(linkedFiles[1]).toEqual({ ticketId, fileId: existingFileId2 })
    expect(mockTicketStorage.writeTicketFiles).toHaveBeenCalled()
    expect(mockTicketStorage.writeTickets).toHaveBeenCalled() // Timestamp update
  })

  test('linkFilesToTicket throws if file not in project', async () => {
    const ticketId = BASE_TIMESTAMP + 17000
    const mockTicket = { id: ticketId, projectId: defaultProjectId }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })

    const nonExistentFileId = BASE_TIMESTAMP + 99000
    await expect(ticketService.linkFilesToTicket(ticketId, [nonExistentFileId])).rejects.toThrow(
      new ApiError(
        400,
        `File with ID ${nonExistentFileId} not found in project ${defaultProjectId} for linking.`,
        'FILE_NOT_FOUND_IN_PROJECT'
      )
    )
  })

  test('getTicketFiles returns linked files', async () => {
    const ticketId = BASE_TIMESTAMP + 18000
    const mockTicket = { id: ticketId, projectId: defaultProjectId }
    const mockFiles = [
      { ticketId, fileId: existingFileId1 },
      { ticketId, fileId: existingFileId2 }
    ]

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })
    mockTicketStorage.readTicketFiles.mockResolvedValue(mockFiles as any)

    const files = await ticketService.getTicketFiles(ticketId)
    expect(files).toEqual(mockFiles)
  })

  test('createTask adds a task to a ticket', async () => {
    const ticketId = BASE_TIMESTAMP + 19000
    const mockTicket = { id: ticketId, projectId: defaultProjectId }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })
    mockTicketStorage.readTicketTasks.mockResolvedValue({})

    const task = await ticketService.createTask(ticketId, 'First task content')

    expect(task.id).toBeGreaterThan(0)
    expect(task.ticketId).toBe(ticketId)
    expect(task.content).toBe('First task content')
    expect(task.done).toBe(false)
    expect(task.orderIndex).toBe(1)
    expect(typeof task.created).toBe('number')
    expect(typeof task.updated).toBe('number')
  })

  test('getTasks returns tasks for a ticket, sorted by orderIndex', async () => {
    const ticketId = BASE_TIMESTAMP + 20000
    const task1Id = BASE_TIMESTAMP + 21000
    const task2Id = BASE_TIMESTAMP + 22000

    const mockTicket = { id: ticketId }
    const mockTasks = {
      [task2Id.toString()]: { id: task2Id, ticketId, content: 'Second task', orderIndex: 2 },
      [task1Id.toString()]: { id: task1Id, ticketId, content: 'First task', orderIndex: 1 }
    }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })
    mockTicketStorage.readTicketTasks.mockResolvedValue(mockTasks)

    const tasks = await ticketService.getTasks(ticketId)

    expect(tasks.length).toBe(2)
    expect(tasks[0].content).toBe('First task') // Sorted by orderIndex
    expect(tasks[1].content).toBe('Second task')
  })

  test('updateTask updates task content or status', async () => {
    const ticketId = BASE_TIMESTAMP + 23000
    const taskId = BASE_TIMESTAMP + 24000

    const mockTicket = { id: ticketId }
    const mockTask = {
      id: taskId,
      ticketId,
      content: 'Original content',
      done: false,
      orderIndex: 1,
      created: Date.now() - 1000,
      updated: Date.now() - 1000
    }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })
    mockTicketStorage.readTicketTasks.mockResolvedValue({
      [taskId.toString()]: mockTask
    })

    const updated = await ticketService.updateTask(ticketId, taskId, {
      content: 'Updated content',
      done: true
    })

    expect(updated.content).toBe('Updated content')
    expect(updated.done).toBe(true)
    expect(updated.updated).toBeGreaterThan(mockTask.updated)
    expect(mockTicketStorage.writeTicketTasks).toHaveBeenCalled()
    expect(mockTicketStorage.writeTickets).toHaveBeenCalled() // Ticket timestamp update
  })

  test('deleteTask removes a task', async () => {
    const ticketId = BASE_TIMESTAMP + 25000
    const taskId = BASE_TIMESTAMP + 26000

    const mockTicket = { id: ticketId }
    const mockTasks = {
      [taskId.toString()]: { id: taskId, ticketId }
    }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })
    mockTicketStorage.readTicketTasks.mockResolvedValue(mockTasks)

    await ticketService.deleteTask(ticketId, taskId)

    expect(mockTicketStorage.writeTicketTasks).toHaveBeenCalled()
    expect(mockTicketStorage.writeTickets).toHaveBeenCalled() // Ticket timestamp update
  })

  test('reorderTasks changes task orderIndices', async () => {
    const ticketId = BASE_TIMESTAMP + 27000
    const task1Id = BASE_TIMESTAMP + 28000
    const task2Id = BASE_TIMESTAMP + 29000

    const mockTicket = { id: ticketId }
    const mockTasks = {
      [task1Id.toString()]: { id: task1Id, ticketId, orderIndex: 1, updated: Date.now() - 1000 },
      [task2Id.toString()]: { id: task2Id, ticketId, orderIndex: 2, updated: Date.now() - 1000 }
    }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })
    mockTicketStorage.readTicketTasks.mockResolvedValue(mockTasks)

    const reorderedTasks = await ticketService.reorderTasks(ticketId, [
      { taskId: task1Id, orderIndex: 2 },
      { taskId: task2Id, orderIndex: 1 }
    ])

    expect(reorderedTasks.length).toBe(2)
    expect(reorderedTasks[0].id).toBe(task2Id) // Now first by orderIndex
    expect(reorderedTasks[1].id).toBe(task1Id) // Now second by orderIndex
    expect(mockTicketStorage.writeTicketTasks).toHaveBeenCalled()
    expect(mockTicketStorage.writeTickets).toHaveBeenCalled() // Ticket timestamp update
  })

  test('fetchTaskSuggestionsForTicket calls AI service and returns suggestions', async () => {
    const ticket = {
      id: BASE_TIMESTAMP + 30000,
      projectId: defaultProjectId,
      title: 'Test Ticket',
      overview: 'Test overview'
    }
    const userContext = 'Additional context'

    const suggestions = await ticketService.fetchTaskSuggestionsForTicket(ticket as any, userContext)

    expect(suggestions.tasks.length).toBe(2)
    expect(suggestions.tasks[0].title).toBe('Mock AI Task 1')
    expect(mockGetFullProjectSummary).toHaveBeenCalledWith(defaultProjectId)
    expect(mockGenerateStructuredData).toHaveBeenCalled()
  })

  test('fetchTaskSuggestionsForTicket throws if model not configured', async () => {
    const ticket = { id: BASE_TIMESTAMP + 31000, projectId: defaultProjectId, title: 'Test', overview: 'Test' }

    // Mock MEDIUM_MODEL_CONFIG to not have a model
    const originalModel = MEDIUM_MODEL_CONFIG.model
    MEDIUM_MODEL_CONFIG.model = undefined as any

    try {
      await expect(ticketService.fetchTaskSuggestionsForTicket(ticket as any, '')).rejects.toThrow(
        new ApiError(500, `Model not configured for 'suggest-ticket-tasks'`, 'CONFIG_ERROR')
      )
    } finally {
      MEDIUM_MODEL_CONFIG.model = originalModel // Restore
    }
  })

  test('suggestTasksForTicket gets suggestions from AI', async () => {
    const ticketId = BASE_TIMESTAMP + 32000
    const mockTicket = { id: ticketId, projectId: defaultProjectId, title: 'Test', overview: 'Test overview' }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })

    const suggestions = await ticketService.suggestTasksForTicket(ticketId, 'context')

    expect(suggestions.length).toBe(2)
    expect(suggestions[0]).toBe('Mock AI Task 1')
    expect(suggestions[1]).toBe('Mock AI Task 2')
  })

  test('autoGenerateTasksFromOverview creates tasks from AI suggestions', async () => {
    const ticketId = BASE_TIMESTAMP + 33000
    const mockTicket = { id: ticketId, projectId: defaultProjectId, title: 'Test', overview: 'Test overview' }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })
    mockTicketStorage.readTicketTasks.mockResolvedValue({})

    const tasks = await ticketService.autoGenerateTasksFromOverview(ticketId)

    expect(tasks.length).toBe(2)
    expect(tasks[0].content).toBe('Mock AI Task 1')
    expect(tasks[1].content).toBe('Mock AI Task 2')
    expect(tasks[0].orderIndex).toBe(1)
    expect(tasks[1].orderIndex).toBe(2)
  })

  test('listTicketsWithTaskCount returns tickets with task counts', async () => {
    const p1 = defaultProjectId
    const ticket1Id = BASE_TIMESTAMP + 34000
    const ticket2Id = BASE_TIMESTAMP + 35000
    const ticket3Id = BASE_TIMESTAMP + 36000
    const task1Id = BASE_TIMESTAMP + 37000
    const task2Id = BASE_TIMESTAMP + 38000
    const task3Id = BASE_TIMESTAMP + 39000

    // Create tickets with ascending created timestamps (ticket3 is most recent)
    const baseTime = Date.now()
    mockTicketStorage.readTickets.mockResolvedValue({
      [ticket1Id.toString()]: { id: ticket1Id, projectId: p1, title: 'Ticket 1', status: 'open', created: baseTime },
      [ticket2Id.toString()]: {
        id: ticket2Id,
        projectId: p1,
        title: 'Ticket 2',
        status: 'open',
        created: baseTime + 1000
      },
      [ticket3Id.toString()]: {
        id: ticket3Id,
        projectId: p1,
        title: 'Ticket 3',
        status: 'open',
        created: baseTime + 2000
      }
    })

    // Mock tasks - order matters! Service processes tickets in descending created order: ticket3, ticket2, ticket1
    mockTicketStorage.readTicketTasks
      .mockResolvedValueOnce({}) // First call is for ticket3 (most recent) - 0 tasks
      .mockResolvedValueOnce({
        [task3Id.toString()]: { id: task3Id, ticketId: ticket2Id, done: false }
      }) // Second call is for ticket2 - 1 task, 0 done
      .mockResolvedValueOnce({
        [task1Id.toString()]: { id: task1Id, ticketId: ticket1Id, done: true },
        [task2Id.toString()]: { id: task2Id, ticketId: ticket1Id, done: false }
      }) // Third call is for ticket1 - 2 tasks, 1 done

    const results = await ticketService.listTicketsWithTaskCount(p1)

    expect(results.length).toBe(3)
    // Results are sorted by created desc, so ticket3 (most recent) is first
    expect(results[0].title).toBe('Ticket 3')
    expect(results[0].taskCount).toBe(0) // ticket3 has 0 tasks
    expect(results[0].completedTaskCount).toBe(0)

    expect(results[1].title).toBe('Ticket 2')
    expect(results[1].taskCount).toBe(1) // ticket2 has 1 task
    expect(results[1].completedTaskCount).toBe(0)

    expect(results[2].title).toBe('Ticket 1')
    expect(results[2].taskCount).toBe(2) // ticket1 has 2 tasks
    expect(results[2].completedTaskCount).toBe(1)
  })

  test('getTasksForTickets returns tasks grouped by ticketId', async () => {
    const ticketId1 = BASE_TIMESTAMP + 40000
    const ticketId2 = BASE_TIMESTAMP + 41000
    const task1Id = BASE_TIMESTAMP + 42000
    const task2Id = BASE_TIMESTAMP + 43000

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId1.toString()]: { id: ticketId1 },
      [ticketId2.toString()]: { id: ticketId2 }
    })

    mockTicketStorage.readTicketTasks
      .mockResolvedValueOnce({
        [task1Id.toString()]: { id: task1Id, ticketId: ticketId1, orderIndex: 1 }
      })
      .mockResolvedValueOnce({
        [task2Id.toString()]: { id: task2Id, ticketId: ticketId2, orderIndex: 1 }
      })

    const results = await ticketService.getTasksForTickets([ticketId1, ticketId2])

    expect(Object.keys(results)).toEqual([ticketId1.toString(), ticketId2.toString()])
    expect(results[ticketId1].length).toBe(1)
    expect(results[ticketId2].length).toBe(1)
  })

  test('listTicketsWithTasks returns tickets with their tasks embedded', async () => {
    const p1 = defaultProjectId
    const ticketId1 = BASE_TIMESTAMP + 44000
    const ticketId2 = BASE_TIMESTAMP + 45000
    const taskId1 = BASE_TIMESTAMP + 46000

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId1.toString()]: { id: ticketId1, projectId: p1, title: 'T1', status: 'open', created: Date.now() },
      [ticketId2.toString()]: {
        id: ticketId2,
        projectId: p1,
        title: 'T2',
        status: 'closed',
        created: Date.now() + 1000
      }
    })

    mockTicketStorage.readTicketTasks
      .mockResolvedValueOnce({
        [taskId1.toString()]: { id: taskId1, ticketId: ticketId1, orderIndex: 1 }
      })
      .mockResolvedValueOnce({})

    const results = await ticketService.listTicketsWithTasks(p1, 'open')

    expect(results.length).toBe(1)
    expect(results[0].title).toBe('T1')
    expect(results[0].tasks.length).toBe(1)
    expect(results[0].tasks[0].id).toBe(taskId1)
  })

  test('getTicketWithSuggestedFiles parses suggestedFileIds', async () => {
    const ticketId = BASE_TIMESTAMP + 47000
    const mockTicket = {
      id: ticketId,
      suggestedFileIds: [existingFileId1, existingFileId2]
    }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })

    const result = await ticketService.getTicketWithSuggestedFiles(ticketId)

    expect(result).not.toBeNull()
    expect(result!.parsedSuggestedFileIds).toEqual([existingFileId1, existingFileId2])
  })

  test('getTicketWithSuggestedFiles throws for non-existent ticket', async () => {
    const ticketId = BASE_TIMESTAMP + 48000
    mockTicketStorage.readTickets.mockResolvedValue({})

    await expect(ticketService.getTicketWithSuggestedFiles(ticketId)).rejects.toThrow(
      new ApiError(404, `Ticket with ID ${ticketId} not found.`, 'TICKET_NOT_FOUND')
    )
  })

  test('suggestFilesForTicket returns recommendations based on project files', async () => {
    const ticketId = BASE_TIMESTAMP + 49000
    const mockTicket = { id: ticketId, projectId: defaultProjectId, title: 'FileSuggest' }

    mockTicketStorage.readTickets.mockResolvedValue({
      [ticketId.toString()]: mockTicket
    })

    const suggestions = await ticketService.suggestFilesForTicket(ticketId, {})

    expect(suggestions.recommendedFileIds.length).toBe(2) // Max 5, but only 2 in project
    expect(suggestions.recommendedFileIds).toContain(existingFileId1)
    expect(suggestions.recommendedFileIds).toContain(existingFileId2)
    expect(suggestions.combinedSummaries).toBeDefined()
    expect(suggestions.message).toBeDefined()
  })
})
