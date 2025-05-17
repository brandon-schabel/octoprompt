// packages/server/src/services/ticket-service.test.ts
import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test'
import {
  createTicket,
  getTicketById,
  listTicketsByProject,
  updateTicket,
  deleteTicket,
  linkFilesToTicket,
  getTicketFiles,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  fetchTaskSuggestionsForTicket,
  suggestTasksForTicket,
  autoGenerateTasksFromOverview,
  listTicketsWithTaskCount,
  getTasksForTickets,
  listTicketsWithTasks,
  getTicketWithSuggestedFiles,
  suggestFilesForTicket
} from '@/services/ticket-service'
import type {
  Ticket,
  TicketTask,
  TicketFile,
  CreateTicketBody,
  UpdateTicketBody,
  TaskSuggestions
} from 'shared/src/schemas/ticket.schemas'
import type { TicketsStorage, TicketTasksStorage, TicketFilesStorage } from '@/utils/storage/ticket-storage'
import type { ProjectFilesStorage } from '@/utils/storage/project-storage' // Assuming this type exists
import { ApiError, MEDIUM_MODEL_CONFIG } from 'shared'
import { randomUUID } from 'crypto'

// In-memory stores for our mocks
let mockTicketsDb: TicketsStorage = {}
let mockTicketTasksDb: { [ticketId: string]: TicketTasksStorage } = {}
let mockTicketFilesDb: { [ticketId: string]: TicketFilesStorage } = {}
let mockProjectFilesDb: { [projectId: string]: ProjectFilesStorage } = {}

// Mock ID generator
const mockGeneratedIds: Record<string, number> = {
  tkt: 0,
  task: 0
}
const mockGenerateId = (prefix: string) => {
  mockGeneratedIds[prefix] = (mockGeneratedIds[prefix] || 0) + 1
  return `${prefix}_mock_${mockGeneratedIds[prefix]}`
}

// Mock the ticketStorage utility
mock.module('@/utils/storage/ticket-storage', () => ({
  ticketStorage: {
    readTickets: async () => JSON.parse(JSON.stringify(mockTicketsDb)),
    writeTickets: async (data: TicketsStorage) => {
      mockTicketsDb = JSON.parse(JSON.stringify(data))
      return mockTicketsDb
    },
    readTicketTasks: async (ticketId: string) => JSON.parse(JSON.stringify(mockTicketTasksDb[ticketId] || {})),
    writeTicketTasks: async (ticketId: string, data: TicketTasksStorage) => {
      mockTicketTasksDb[ticketId] = JSON.parse(JSON.stringify(data))
      return mockTicketTasksDb[ticketId]
    },
    readTicketFiles: async (ticketId: string) => JSON.parse(JSON.stringify(mockTicketFilesDb[ticketId] || [])),
    writeTicketFiles: async (ticketId: string, data: TicketFilesStorage) => {
      mockTicketFilesDb[ticketId] = JSON.parse(JSON.stringify(data))
      return mockTicketFilesDb[ticketId]
    },
    deleteTicketData: async (ticketId: string) => {
      delete mockTicketTasksDb[ticketId]
      delete mockTicketFilesDb[ticketId]
    },
    generateId: mockGenerateId
  }
}))

// Mock the projectStorage utility
mock.module('@/utils/storage/project-storage', () => ({
  projectStorage: {
    readProjectFiles: async (projectId: string): Promise<ProjectFilesStorage> => {
      return JSON.parse(JSON.stringify(mockProjectFilesDb[projectId] || {}))
    }
    // Add other projectStorage mocks if needed by ticket-service
  }
}))

// Mock AI services
const mockGenAIService = {
  generateStructuredData: mock(async (args: { schema: any, prompt: string, systemMessage: string, options: any }) => {
    // Default mock behavior, can be overridden in specific tests
    if (args.schema.description === 'TaskSuggestionsZodSchema') {
      return { object: { tasks: [{ title: 'Suggested Task 1', description: 'Description 1' }, { title: 'Suggested Task 2' }] } }
    }
    return { object: {} }
  })
}
mock.module('@/services/gen-ai-services', () => ({
  generateStructuredData: mockGenAIService.generateStructuredData
}))

// Mock getFullProjectSummary
const mockGetFullProjectSummary = mock(async (projectId: string) => {
  return `<project_summary>Mock project summary for ${projectId}</project_summary>`;
});
mock.module('@/utils/get-full-project-summary', () => ({
  getFullProjectSummary: mockGetFullProjectSummary
}));


// Helper to generate random strings for test data
const randomString = (length = 8) => Math.random().toString(36).substring(2, 2 + length)

describe('Ticket Service (File Storage Mock)', () => {
  let defaultProjectId: string
  let anotherProjectId: string
  let existingFileId1: string
  let existingFileId2: string

  beforeEach(async () => {
    // Reset in-memory stores before each test
    mockTicketsDb = {}
    mockTicketTasksDb = {}
    mockTicketFilesDb = {}
    mockProjectFilesDb = {}
    mockGeneratedIds.tkt = 0
    mockGeneratedIds.task = 0

    // Reset mocks
    mockGenAIService.generateStructuredData.mockClear();
    mockGetFullProjectSummary.mockClear();


    defaultProjectId = `proj_${randomString()}`
    anotherProjectId = `proj_${randomString()}`
    existingFileId1 = `file_${randomString()}`
    existingFileId2 = `file_${randomString()}`

    // Setup default project files for validation
    mockProjectFilesDb[defaultProjectId] = {
      [existingFileId1]: { id: existingFileId1, name: "file1.txt", path: "/file1.txt", content: "content1", projectId: defaultProjectId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), summary: "summary1", extension: ".txt", size: 8, summaryLastUpdatedAt: null, meta: null, checksum: null },
      [existingFileId2]: { id: existingFileId2, name: "file2.ts", path: "/file2.ts", content: "content2", projectId: defaultProjectId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), summary: "summary2", extension: ".ts", size: 8, summaryLastUpdatedAt: null, meta: null, checksum: null },
    }
  })

  test('createTicket creates a new ticket', async () => {
    const input: CreateTicketBody = {
      projectId: defaultProjectId,
      title: `Test Ticket ${randomString()}`,
      overview: 'This is a test overview.',
      status: 'open',
      priority: 'high',
      suggestedFileIds: [existingFileId1]
    }
    const created = await createTicket(input)

    expect(created.id).toBe('tkt_mock_1')
    expect(created.projectId).toBe(defaultProjectId)
    expect(created.title).toBe(input.title)
    expect(created.overview).toBe(input.overview)
    expect(created.status).toBe('open')
    expect(created.priority).toBe('high')
    expect(created.suggestedFileIds).toBe(JSON.stringify([existingFileId1]))
    expect(created.createdAt).toBeDefined()
    expect(created.updatedAt).toBeDefined()
    expect(created.createdAt).toEqual(created.updatedAt)

    expect(mockTicketsDb[created.id]).toEqual(expect.objectContaining({ id: created.id, title: input.title }))
    expect(mockTicketTasksDb[created.id]).toEqual({}) // Empty tasks initialized
    expect(mockTicketFilesDb[created.id]).toEqual([]) // Empty files initialized
  })

  test('createTicket with minimal data', async () => {
    const input: CreateTicketBody = {
      projectId: defaultProjectId,
      title: `Minimal Ticket ${randomString()}`,
      overview: '',
      status: 'open',
      priority: 'normal'
    }
    const created = await createTicket(input)

    expect(created.id).toBe('tkt_mock_1')
    expect(created.projectId).toBe(defaultProjectId)
    expect(created.title).toBe(input.title)
    expect(created.overview).toBe(input.overview)
    expect(created.status).toBe('open')
    expect(created.priority).toBe('normal')
    expect(created.suggestedFileIds).toBe(JSON.stringify([]))
    expect(mockTicketsDb[created.id]).toBeDefined()
  })

  test('createTicket throws ApiError on ID conflict', async () => {
    // beforeEach clears mockTicketsDb and resets mockGeneratedIds.tkt = 0.

    // First call to createTicket:
    // The mock generateId will produce 'tkt_mock_1' because mockGeneratedIds.tkt is 0 and then incremented.
    // This call should succeed and add 'tkt_mock_1' to mockTicketsDb.
    await createTicket({
      projectId: defaultProjectId,
      title: 'First Ticket - Should Succeed',
      overview: '',
      status: 'open',
      priority: 'normal'
    });

    // Now, mockTicketsDb['tkt_mock_1'] exists as a result of the successful creation.

    // For the second call, force generateId to return 'tkt_mock_1' again.
    const conflictSpy = spyOn((await import('@/utils/storage/ticket-storage')).ticketStorage, 'generateId')
      .mockReturnValueOnce('tkt_mock_1');

    const inputConflict: CreateTicketBody = {
      projectId: defaultProjectId,
      title: 'Conflicting Ticket - Should Fail',
      status: 'open',
      overview: '',
      priority: 'normal'
    }

    try {
      await createTicket(inputConflict); // This call should now correctly throw the conflict
      // Should not reach here if conflict occurs
      expect(true).toBe(false); // Force failure if no error thrown
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      if (e instanceof ApiError) {
        expect(e.status).toBe(509);
        expect(e.message).toBe('Ticket ID conflict for tkt_mock_1');
        expect(e.code).toBe('TICKET_ID_CONFLICT');
      }
    }
    conflictSpy.mockRestore();
  })


  test('getTicketById returns ticket if found, throws ApiError if not', async () => {
    const t1 = await createTicket({ projectId: defaultProjectId, title: 'GetMe', overview: '', status: 'open', priority: 'normal' })
    const found = await getTicketById(t1.id)
    expect(found).toEqual(expect.objectContaining(t1)) // Use objectContaining due to Date objects

    await expect(getTicketById('nonexistent-id')).rejects.toThrow(new ApiError(404, 'Ticket with ID nonexistent-id not found.', 'TICKET_NOT_FOUND'))
  })

  test('listTicketsByProject returns tickets for a project, optionally filtered by status', async () => {
    const t1 = await createTicket({ projectId: defaultProjectId, title: 'T1 Open', status: 'open', overview: '', priority: 'normal' })
    // Ensure different createdAt for sorting by creating a slight delay
    await new Promise(resolve => setTimeout(resolve, 5));
    const t2 = await createTicket({ projectId: defaultProjectId, title: 'T2 Closed', status: 'closed', overview: '', priority: 'normal' })
    await new Promise(resolve => setTimeout(resolve, 5));
    const t3 = await createTicket({ projectId: anotherProjectId, title: 'T3 Other Proj', overview: '', status: 'open', priority: 'normal' })
    await new Promise(resolve => setTimeout(resolve, 5));
    const t4 = await createTicket({ projectId: defaultProjectId, title: 'T4 Open', status: 'open', overview: '', priority: 'normal' })


    let fromA = await listTicketsByProject(defaultProjectId)
    expect(fromA.length).toBe(3)
    // Sorted by createdAt DESC (t4, t2, t1)
    expect(fromA.map(t => t.id)).toEqual([t4.id, t2.id, t1.id])

    fromA = await listTicketsByProject(defaultProjectId, 'open')
    expect(fromA.length).toBe(2)
    expect(fromA.map(t => t.id)).toEqual([t4.id, t1.id]) // t4, then t1
    expect(fromA).toEqual(expect.arrayContaining([expect.objectContaining(t1), expect.objectContaining(t4)]))

    const fromB = await listTicketsByProject(anotherProjectId)
    expect(fromB.length).toBe(1)
    expect(fromB[0].id).toEqual(t3.id)

    const fromEmpty = await listTicketsByProject('nonexistent-project')
    expect(fromEmpty.length).toBe(0)
  })

  test('updateTicket updates fields and returns updated ticket', async () => {
    const created = await createTicket({ projectId: defaultProjectId, title: 'Before', overview: 'Old', suggestedFileIds: [], status: 'open', priority: 'normal' })
    const originalUpdatedAt = new Date(created.updatedAt).getTime();

    const updates: UpdateTicketBody = { title: 'After', overview: 'New content', status: 'in_progress', priority: 'low', suggestedFileIds: [existingFileId1, existingFileId2] }
    await new Promise(resolve => setTimeout(resolve, 10)); // Ensure time passes for updatedAt check
    const updated = await updateTicket(created.id, updates)

    expect(updated.title).toBe('After')
    expect(updated.overview).toBe('New content')
    expect(updated.status).toBe('in_progress')
    expect(updated.priority).toBe('low')
    expect(updated.suggestedFileIds).toBe(JSON.stringify([existingFileId1, existingFileId2]))
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(originalUpdatedAt)
    // mockTicketsDb stores dates as strings due to JSON.stringify in the mock storage
    // 'updated' has Date objects. Compare accordingly.
    const expectedInDb = {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
    expect(mockTicketsDb[created.id]).toEqual(expect.objectContaining(expectedInDb))
  })

  test('updateTicket throws if suggestedFileId not in project', async () => {
    const created = await createTicket({ projectId: defaultProjectId, title: 'Test', overview: '', status: 'open', priority: 'normal' })
    const updates: UpdateTicketBody = { suggestedFileIds: ['nonexistent-file-id'] }
    await expect(updateTicket(created.id, updates))
      .rejects.toThrow(new ApiError(400, `File with ID nonexistent-file-id not found in project ${defaultProjectId}.`, 'FILE_NOT_FOUND_IN_PROJECT'))
  })

  test('updateTicket throws ApiError if ticket does not exist', async () => {
    await expect(updateTicket('fake-id', { title: 'X' })).rejects.toThrow(new ApiError(404, 'Ticket with ID fake-id not found for update.', 'TICKET_NOT_FOUND'))
  })

  test('deleteTicket removes ticket and its data', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'DelMe', overview: '', status: 'open', priority: 'normal' })
    await createTask(ticket.id, 'Task for DelMe')
    await linkFilesToTicket(ticket.id, [existingFileId1])

    expect(mockTicketsDb[ticket.id]).toBeDefined()
    expect(Object.keys(mockTicketTasksDb[ticket.id] || {}).length).toBe(1)
    expect((mockTicketFilesDb[ticket.id] || []).length).toBe(1)

    await deleteTicket(ticket.id)

    expect(mockTicketsDb[ticket.id]).toBeUndefined()
    expect(mockTicketTasksDb[ticket.id]).toBeUndefined() // Via deleteTicketData
    expect(mockTicketFilesDb[ticket.id]).toBeUndefined() // Via deleteTicketData
  })

  test('deleteTicket throws ApiError if ticket does not exist', async () => {
    await expect(deleteTicket('fake-id')).rejects.toThrow(new ApiError(404, 'Ticket with ID fake-id not found for deletion.', 'TICKET_NOT_FOUND'))
  })


  test('linkFilesToTicket links files and updates ticket timestamp', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'LinkTest', overview: '', status: 'open', priority: 'normal' })
    const originalUpdatedAt = ticket.updatedAt

    await new Promise(resolve => setTimeout(resolve, 10))
    const links = await linkFilesToTicket(ticket.id, [existingFileId1, existingFileId2])

    expect(links.length).toBe(2)
    expect(links.map(l => l.fileId)).toEqual(expect.arrayContaining([existingFileId1, existingFileId2]))
    expect(mockTicketFilesDb[ticket.id].length).toBe(2)

    const updatedTicket = await getTicketById(ticket.id)
    expect(new Date(updatedTicket.updatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime())

    // Link again, should not duplicate and timestamp should not change if no new links
    const originalUpdatedAt2 = updatedTicket.updatedAt
    await new Promise(resolve => setTimeout(resolve, 10)) // ensure time would pass
    const linksAgain = await linkFilesToTicket(ticket.id, [existingFileId1])
    expect(linksAgain.length).toBe(2) // Still 2, existingFileId1 was already there.
    const ticketAfterRedundantLink = await getTicketById(ticket.id)
    // If no *new* links made, timestamp shouldn't change due to current logic in linkFilesToTicket
    expect(ticketAfterRedundantLink.updatedAt).toEqual(originalUpdatedAt2)
  })

  test('linkFilesToTicket throws if file not in project', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'LinkFail', overview: '', status: 'open', priority: 'normal' })
    await expect(linkFilesToTicket(ticket.id, ['nonexistent-file']))
      .rejects.toThrow(new ApiError(400, `File with ID nonexistent-file not found in project ${defaultProjectId} for linking.`, 'FILE_NOT_FOUND_IN_PROJECT'))
  })

  test('getTicketFiles returns linked files', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'GetLinks', overview: '', status: 'open', priority: 'normal' })
    await linkFilesToTicket(ticket.id, [existingFileId1])

    const files = await getTicketFiles(ticket.id)
    expect(files.length).toBe(1)
    expect(files[0].fileId).toBe(existingFileId1)
    expect(files[0].ticketId).toBe(ticket.id)
  })

  test('createTask adds a task to a ticket', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'TaskTest', overview: '', status: 'open', priority: 'normal' })
    const originalUpdatedAt = ticket.updatedAt

    await new Promise(resolve => setTimeout(resolve, 10))
    const task1 = await createTask(ticket.id, 'First task content')
    expect(task1.id).toBe('task_mock_1')
    expect(task1.ticketId).toBe(ticket.id)
    expect(task1.content).toBe('First task content')
    expect(task1.done).toBe(false)
    expect(task1.orderIndex).toBe(1)
    expect(task1.createdAt).toBeDefined()
    expect(task1.updatedAt).toBeDefined()

    const updatedTicket = await getTicketById(ticket.id)
    expect(new Date(updatedTicket.updatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime())

    const task2 = await createTask(ticket.id, 'Second task content')
    expect(task2.id).toBe('task_mock_2')
    expect(task2.orderIndex).toBe(2)

    expect(Object.keys(mockTicketTasksDb[ticket.id]).length).toBe(2)
  })

  test('getTasks returns tasks for a ticket, sorted by orderIndex', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'GetTasksTest', overview: '', status: 'open', priority: 'normal' })
    const t2 = await createTask(ticket.id, 'Task B') // orderIndex 1
    const t1 = await createTask(ticket.id, 'Task A') // orderIndex 2
    // Manually adjust order for test if needed, or rely on creation order
    mockTicketTasksDb[ticket.id][t1.id].orderIndex = 1
    mockTicketTasksDb[ticket.id][t2.id].orderIndex = 2
    await (await import('@/utils/storage/ticket-storage')).ticketStorage.writeTicketTasks(ticket.id, mockTicketTasksDb[ticket.id])


    const tasks = await getTasks(ticket.id)
    expect(tasks.length).toBe(2)
    expect(tasks.map(t => t.id)).toEqual([t1.id, t2.id]) // Assuming t1 (A) is now 1, t2 (B) is 2
  })

  test('updateTask updates task content or status', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'UpdateTaskTest', overview: '', status: 'open', priority: 'normal' })
    const task = await createTask(ticket.id, 'Old content')
    const ticketOriginalUpdatedAt = (await getTicketById(ticket.id)).updatedAt

    await new Promise(resolve => setTimeout(resolve, 10))
    const updatedTask = await updateTask(ticket.id, task.id, { content: 'New content', done: true })

    expect(updatedTask.content).toBe('New content')
    expect(updatedTask.done).toBe(true)
    expect(new Date(updatedTask.updatedAt).getTime()).toBeGreaterThan(new Date(task.updatedAt).getTime())

    const ticketAfterTaskUpdate = await getTicketById(ticket.id)
    expect(new Date(ticketAfterTaskUpdate.updatedAt).getTime()).toBeGreaterThan(new Date(ticketOriginalUpdatedAt).getTime())

    // Test no change
    const taskUnchangedUpdatedAt = updatedTask.updatedAt
    const ticketUnchangedUpdatedAt = ticketAfterTaskUpdate.updatedAt
    await new Promise(resolve => setTimeout(resolve, 10))
    const notUpdatedTask = await updateTask(ticket.id, task.id, { content: 'New content' }) // no actual change
    expect(notUpdatedTask.updatedAt).toEqual(taskUnchangedUpdatedAt) // updatedAt should not change for task
    const ticketAfterNoUpdate = await getTicketById(ticket.id)
    expect(ticketAfterNoUpdate.updatedAt).toEqual(ticketUnchangedUpdatedAt) // updatedAt should not change for ticket
  })

  test('deleteTask removes a task', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'DeleteTaskTest', overview: '', status: 'open', priority: 'normal' })
    const task1 = await createTask(ticket.id, 'Task 1')
    await createTask(ticket.id, 'Task 2')
    const ticketOriginalUpdatedAt = (await getTicketById(ticket.id)).updatedAt

    expect(Object.keys(mockTicketTasksDb[ticket.id]).length).toBe(2)
    await new Promise(resolve => setTimeout(resolve, 10))
    await deleteTask(ticket.id, task1.id)

    expect(Object.keys(mockTicketTasksDb[ticket.id]).length).toBe(1)
    expect(mockTicketTasksDb[ticket.id][task1.id]).toBeUndefined()
    const ticketAfterTaskDelete = await getTicketById(ticket.id)
    expect(new Date(ticketAfterTaskDelete.updatedAt).getTime()).toBeGreaterThan(new Date(ticketOriginalUpdatedAt).getTime())
  })

  test('reorderTasks changes task orderIndices', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'ReorderTest', overview: '', status: 'open', priority: 'normal' })
    const task1 = await createTask(ticket.id, 'T1') // order 1
    const task2 = await createTask(ticket.id, 'T2') // order 2
    const task3 = await createTask(ticket.id, 'T3') // order 3
    const ticketOriginalUpdatedAt = (await getTicketById(ticket.id)).updatedAt
    await new Promise(resolve => setTimeout(resolve, 10))

    const reorders = [
      { taskId: task1.id, orderIndex: 3 },
      { taskId: task2.id, orderIndex: 1 },
      { taskId: task3.id, orderIndex: 2 },
    ]
    const reorderedTasks = await reorderTasks(ticket.id, reorders)

    expect(reorderedTasks.length).toBe(3)
    expect(reorderedTasks.find(t => t.id === task1.id)?.orderIndex).toBe(3)
    expect(reorderedTasks.find(t => t.id === task2.id)?.orderIndex).toBe(1)
    expect(reorderedTasks.find(t => t.id === task3.id)?.orderIndex).toBe(2)
    expect(reorderedTasks.map(t => t.id)).toEqual([task2.id, task3.id, task1.id]) // Sorted by new order

    const ticketAfterReorder = await getTicketById(ticket.id)
    expect(new Date(ticketAfterReorder.updatedAt).getTime()).toBeGreaterThan(new Date(ticketOriginalUpdatedAt).getTime())

    // Test reorder with no actual change
    const ticketOriginalUpdatedAt2 = ticketAfterReorder.updatedAt
    await new Promise(resolve => setTimeout(resolve, 10))
    const noChangeReorders = [{ taskId: task2.id, orderIndex: 1 }]
    await reorderTasks(ticket.id, noChangeReorders);
    const ticketAfterNoReorder = await getTicketById(ticket.id)
    expect(ticketAfterNoReorder.updatedAt).toEqual(ticketOriginalUpdatedAt2)

  })

  test('fetchTaskSuggestionsForTicket calls AI service and returns suggestions', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'AI Suggest', overview: 'Needs AI tasks', status: 'open', priority: 'normal' });
    const userContext = 'High priority';

    mockGenAIService.generateStructuredData.mockResolvedValueOnce({
      object: { tasks: [{ title: 'Mock AI Task 1', description: 'From test' }, { title: 'Mock AI Task 2' }] }
    });

    const suggestions = await fetchTaskSuggestionsForTicket(ticket, userContext);

    expect(suggestions.tasks.length).toBe(2);
    expect(suggestions.tasks[0].title).toBe('Mock AI Task 1');
    expect(mockGetFullProjectSummary).toHaveBeenCalledWith(defaultProjectId);
    expect(mockGenAIService.generateStructuredData).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining(ticket.title) && expect.stringContaining(ticket.overview) && expect.stringContaining(userContext),
      systemMessage: expect.stringContaining('You are a technical project manager'),
      options: MEDIUM_MODEL_CONFIG
    }));
  });

  test('fetchTaskSuggestionsForTicket throws if model not configured', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'AI Suggest No Model', overview: 'Needs AI tasks', status: 'open', priority: 'normal' });
    const originalModel = MEDIUM_MODEL_CONFIG.model;
    MEDIUM_MODEL_CONFIG.model = undefined; // Simulate model not configured

    await expect(fetchTaskSuggestionsForTicket(ticket, 'context'))
      .rejects.toThrow(new ApiError(500, `Model not configured for 'suggest-ticket-tasks'`, 'CONFIG_ERROR'));

    MEDIUM_MODEL_CONFIG.model = originalModel; // Restore
  });


  test('suggestTasksForTicket gets suggestions from AI', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'Suggest Me Tasks', overview: 'Overview for suggestions', status: 'open', priority: 'normal' })

    mockGenAIService.generateStructuredData.mockImplementationOnce(async () => ({
      object: { tasks: [{ title: 'AI Task Alpha' }, { title: 'AI Task Beta' }] }
    }))

    const taskTitles = await suggestTasksForTicket(ticket.id, 'User context here')
    expect(taskTitles).toEqual(['AI Task Alpha', 'AI Task Beta'])
    expect(mockGenAIService.generateStructuredData).toHaveBeenCalledTimes(1)
  })

  test('autoGenerateTasksFromOverview creates tasks from AI suggestions', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'Auto Gen', overview: 'Detailed overview for auto generation.', status: 'open', priority: 'normal' })
    const originalUpdatedAt = (await getTicketById(ticket.id)).updatedAt

    mockGenAIService.generateStructuredData.mockImplementationOnce(async () => ({
      object: { tasks: [{ title: 'Generated Task One' }, { title: 'Generated Task Two' }] }
    }))
    await new Promise(resolve => setTimeout(resolve, 10))
    const newTasks = await autoGenerateTasksFromOverview(ticket.id)

    expect(newTasks.length).toBe(2)
    expect(newTasks[0].content).toBe('Generated Task One')
    expect(newTasks[1].content).toBe('Generated Task Two')
    expect(newTasks[0].orderIndex).toBe(1)
    expect(newTasks[1].orderIndex).toBe(2)

    const allTasks = await getTasks(ticket.id)
    expect(allTasks.length).toBe(2)

    const ticketAfterGen = await getTicketById(ticket.id)
    expect(new Date(ticketAfterGen.updatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime())

    // Test with no suggestions
    mockGenAIService.generateStructuredData.mockImplementationOnce(async () => ({
      object: { tasks: [] }
    }))
    const noNewTasks = await autoGenerateTasksFromOverview(ticket.id)
    expect(noNewTasks.length).toBe(0)
    const allTasksAfterEmpty = await getTasks(ticket.id)
    expect(allTasksAfterEmpty.length).toBe(2) // Should still be 2
  })

  test('listTicketsWithTaskCount returns tickets with task counts', async () => {
    const p1 = `proj_${randomString()}`
    const t1 = await createTicket({ projectId: p1, title: 'Ticket 1', status: 'open', overview: '', priority: 'normal' }) // 2 tasks, 1 done
    await createTask(t1.id, 'T1T1')
    const t1t2 = await createTask(t1.id, 'T1T2')
    await updateTask(t1.id, t1t2.id, { done: true })

    const t2 = await createTicket({ projectId: p1, title: 'Ticket 2', status: 'closed', overview: '', priority: 'normal' }) // 0 tasks

    const t3 = await createTicket({ projectId: p1, title: 'Ticket 3', status: 'open', overview: '', priority: 'normal' }) // 1 task, 0 done
    await createTask(t3.id, 'T3T1')


    let results = await listTicketsWithTaskCount(p1)
    expect(results.length).toBe(3)

    const resT1 = results.find(r => r.id === t1.id)
    expect(resT1?.taskCount).toBe(2)
    expect(resT1?.completedTaskCount).toBe(1)

    const resT2 = results.find(r => r.id === t2.id)
    expect(resT2?.taskCount).toBe(0)
    expect(resT2?.completedTaskCount).toBe(0)

    results = await listTicketsWithTaskCount(p1, 'open')
    expect(results.length).toBe(2) // t1 and t3
    expect(results.find(r => r.id === t2.id)).toBeUndefined()
  })

  test('getTasksForTickets returns tasks grouped by ticketId', async () => {
    const t1 = await createTicket({ projectId: defaultProjectId, title: 'T1', overview: '', status: 'open', priority: 'normal' })
    const t1a = await createTask(t1.id, 't1a') // order 1
    const t1b = await createTask(t1.id, 't1b') // order 2

    const t2 = await createTicket({ projectId: defaultProjectId, title: 'T2', overview: '', status: 'open', priority: 'normal' })
    const t2a = await createTask(t2.id, 't2a') // order 1

    const t3 = await createTicket({ projectId: defaultProjectId, title: 'T3', overview: '', status: 'open', priority: 'normal' }) // No tasks

    const tasksMap = await getTasksForTickets([t1.id, t2.id, t3.id, 'non-existent-ticket'])
    expect(Object.keys(tasksMap).length).toBe(3) // t1, t2, t3
    expect(tasksMap[t1.id].length).toBe(2)
    expect(tasksMap[t1.id].map(t => t.id)).toEqual([t1a.id, t1b.id])
    expect(tasksMap[t2.id].length).toBe(1)
    expect(tasksMap[t2.id][0].id).toBe(t2a.id)
    expect(tasksMap[t3.id].length).toBe(0)
    expect(tasksMap['non-existent-ticket']).toBeUndefined() // Or empty array depending on behavior for non-found tickets by readTicketTasks
  })

  test('listTicketsWithTasks returns tickets with their tasks embedded', async () => {
    const p1 = `proj_${randomString()}`
    const t1 = await createTicket({ projectId: p1, title: 'T1', status: 'open', overview: '', priority: 'normal' })
    const t1Task = await createTask(t1.id, 'T1 Task1')
    const t2 = await createTicket({ projectId: p1, title: 'T2', status: 'closed', overview: '', priority: 'normal' })

    const results = await listTicketsWithTasks(p1, 'open')
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(t1.id)
    expect(results[0].tasks.length).toBe(1)
    expect(results[0].tasks[0].id).toBe(t1Task.id)

    const allResults = await listTicketsWithTasks(p1)
    expect(allResults.length).toBe(2)
    const resT2 = allResults.find(r => r.id === t2.id)
    expect(resT2?.tasks.length).toBe(0)
  })

  test('getTicketWithSuggestedFiles parses suggestedFileIds', async () => {
    const fileIds = [existingFileId1, existingFileId2]
    const ticket = await createTicket({
      projectId: defaultProjectId,
      title: 'SuggestFilesTest',
      suggestedFileIds: fileIds,
      overview: '', status: 'open', priority: 'normal'
    })

    const result = await getTicketWithSuggestedFiles(ticket.id)
    expect(result).toBeDefined()
    expect(result?.id).toBe(ticket.id)
    expect(result?.parsedSuggestedFileIds).toEqual(fileIds)

    // Test with empty array
    const ticketEmpty = await createTicket({ projectId: defaultProjectId, title: 'EmptySuggest', suggestedFileIds: [], overview: '', status: 'open', priority: 'normal' })
    const resultEmpty = await getTicketWithSuggestedFiles(ticketEmpty.id)
    expect(resultEmpty?.parsedSuggestedFileIds).toEqual([])

    // Test with null (service default to '[]')
    const ticketNull = await createTicket({ projectId: defaultProjectId, title: 'NullSuggest', suggestedFileIds: null as any, overview: '', status: 'open', priority: 'normal' })
    const resultNull = await getTicketWithSuggestedFiles(ticketNull.id)
    expect(resultNull?.parsedSuggestedFileIds).toEqual([])


    // Test with malformed JSON (service should handle gracefully)
    mockTicketsDb[ticket.id].suggestedFileIds = "not a json"
    await (await import('@/utils/storage/ticket-storage')).ticketStorage.writeTickets(mockTicketsDb);
    const resultMalformed = await getTicketWithSuggestedFiles(ticket.id)
    expect(resultMalformed?.parsedSuggestedFileIds).toEqual([]) // Defaults to empty array on parse error
  })

  test('getTicketWithSuggestedFiles throws for non-existent ticket', async () => {
    await expect(getTicketWithSuggestedFiles('nonexistent-id')).rejects.toThrow(
      new ApiError(404, 'Ticket with ID nonexistent-id not found.', 'TICKET_NOT_FOUND')
    );
  });


  test('suggestFilesForTicket returns recommendations based on project files', async () => {
    const ticket = await createTicket({ projectId: defaultProjectId, title: 'FileSuggest', overview: '', status: 'open', priority: 'normal' })

    // defaultProjectId has existingFileId1, existingFileId2
    const suggestions = await suggestFilesForTicket(ticket.id, {})
    expect(suggestions.recommendedFileIds.length).toBe(2) // Max 5, but only 2 in project
    expect(suggestions.recommendedFileIds).toEqual(expect.arrayContaining([existingFileId1, existingFileId2]))
    expect(suggestions.message).toBe('Files suggested based on simplified project file listing.')

    // Test with a project with no files
    const projNoFiles = `proj_no_files_${randomString()}`
    mockProjectFilesDb[projNoFiles] = {}
    const ticketNoFiles = await createTicket({ projectId: projNoFiles, title: 'NoFilesTicket', overview: '', status: 'open', priority: 'normal' })
    const suggestionsNoFiles = await suggestFilesForTicket(ticketNoFiles.id, {})
    expect(suggestionsNoFiles.recommendedFileIds.length).toBe(0)
    expect(suggestionsNoFiles.message).toBe('No files found in the project to suggest from.')

    // Test with a project with more than 5 files
    const projManyFiles = `proj_many_files_${randomString()}`
    mockProjectFilesDb[projManyFiles] = {};
    const manyFileIds = [];
    for (let i = 0; i < 7; i++) {
      const fileId = `file_many_${i}`;
      manyFileIds.push(fileId);
      mockProjectFilesDb[projManyFiles][fileId] = { id: fileId, name: `many${i}.txt`, path: `/many${i}.txt`, content: "", projectId: projManyFiles, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), summary: "", extension: ".txt", size: 0, summaryLastUpdatedAt: null, meta: null, checksum: null };
    }
    const ticketManyFiles = await createTicket({ projectId: projManyFiles, title: 'ManyFilesTicket', overview: '', status: 'open', priority: 'normal' });
    const suggestionsManyFiles = await suggestFilesForTicket(ticketManyFiles.id, {})
    expect(suggestionsManyFiles.recommendedFileIds.length).toBe(5); // Should cap at 5
    expect(suggestionsManyFiles.recommendedFileIds).toEqual(manyFileIds.slice(0, 5));

  })

})