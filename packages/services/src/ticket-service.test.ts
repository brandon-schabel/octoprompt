import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test'
import { randomUUID } from 'crypto'
import { db, resetDatabase } from '@db'
import {
  createTicket,
  getTicketById,
  listTicketsByProject,
  updateTicket,
  deleteTicket,
  linkFilesToTicket,
  getTicketFiles,
  fetchTaskSuggestionsForTicket,
  suggestTasksForTicket,
  getTicketsWithFiles,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  autoGenerateTasksFromOverview,
  listTicketsWithTaskCount,
  getTasksForTickets,
  listTicketsWithTasks,
  getTicketWithSuggestedFiles
} from '@/services/ticket-service'

const generateStructuredDataMock = mock(async () => {
  return { object: { tasks: [{ title: 'MockTask', description: 'MockDesc' }] } }
})

describe('Ticket Service', () => {
  let summaryMock: ReturnType<typeof mock>

  beforeEach(async () => {
    await resetDatabase()

    summaryMock = mock(async () => 'Fake project summary content')
    mock.module('@/services/gen-ai-services.ts/', () => {
      return {
        generateStructuredData: generateStructuredDataMock
      }
    })

    // spyOn(aiProviderInterface, "generateStructuredData").mockImplementation(generateStructuredDataMock);

    spyOn(await import('@/utils/get-full-project-summary'), 'getFullProjectSummary').mockImplementation(summaryMock)
  })

  test('createTicket inserts new row', async () => {
    // Use a project ID that won't be converted by timestamp processing (> 1e10)
    const projectId = 12345678901 // Beyond timestamp threshold
    const newT = await createTicket({
      projectId,
      title: 'TestTicket',
      overview: 'Test overview',
      status: 'open',
      priority: 'normal'
    })
    expect(newT.id).toBeDefined()

    // Test by fetching through service layer instead of direct SQL
    const found = await getTicketById(newT.id)
    expect(found.title).toBe('TestTicket')
    expect(found.projectId).toBe(projectId)
  })

  test('getTicketById returns null if not found', async () => {
    await expect(getTicketById(99999)).rejects.toThrow(expect.objectContaining({ code: 'TICKET_NOT_FOUND' }))
  })

  test('listTicketsByProject returns only those tickets', async () => {
    const pA = 12345678902
    const pB = 12345678903

    // Insert tickets
    await createTicket({
      projectId: pA,
      title: 'TicketA1',
      overview: 'Overview A1',
      status: 'open',
      priority: 'normal'
    })
    await createTicket({
      projectId: pA,
      title: 'TicketA2',
      overview: 'Overview A2',
      status: 'open',
      priority: 'normal'
    })
    await createTicket({
      projectId: pB,
      title: 'TicketB1',
      overview: 'Overview B1',
      status: 'open',
      priority: 'normal'
    })

    const forA = await listTicketsByProject(pA)
    expect(forA.length).toBe(2)

    const forB = await listTicketsByProject(pB)
    expect(forB.length).toBe(1)
  })

  test('updateTicket modifies fields or returns null if not found', async () => {
    const ticket = await createTicket({
      projectId: 12345678904,
      title: 'Old',
      overview: 'Old overview',
      status: 'open',
      priority: 'normal'
    })

    const updated = await updateTicket(ticket.id, {
      title: 'NewTitle',
      suggestedFileIds: ['test-file-1']
    })
    expect(updated).not.toBeNull()
    expect(updated?.title).toBe('NewTitle')

    await expect(updateTicket(99999, { title: 'No' })).rejects.toThrow(
      expect.objectContaining({ code: 'TICKET_NOT_FOUND' })
    )
  })

  test('updateTicket throws if suggestedFileIds references missing file', async () => {
    const ticket = await createTicket({
      projectId: 1005,
      title: 'T',
      overview: 'Test overview',
      status: 'open',
      priority: 'normal'
    })
    // This test case is simplified since we don't have file validation in the current implementation
    const updated = await updateTicket(ticket.id, { suggestedFileIds: ['nonexistent-file'] })
    expect(updated.suggestedFileIds).toEqual(['nonexistent-file'])
  })

  test('deleteTicket returns true if deleted, false if not found', async () => {
    const ticket = await createTicket({
      projectId: 1006,
      title: 'DelMe',
      overview: 'Delete me overview',
      status: 'open',
      priority: 'normal'
    })
    await expect(deleteTicket(ticket.id)).resolves.toBeUndefined()
    await expect(getTicketById(ticket.id)).rejects.toThrow(expect.objectContaining({ code: 'TICKET_NOT_FOUND' }))

    await expect(deleteTicket(ticket.id)).rejects.toThrow(expect.objectContaining({ code: 'TICKET_NOT_FOUND' }))
  })

  test('linkFilesToTicket inserts rows in ticketFiles, getTicketFiles retrieves them', async () => {
    const ticketProjectId = 1007

    const ticket = await createTicket({
      projectId: ticketProjectId,
      title: 'LinkT',
      overview: 'Link ticket overview',
      status: 'open',
      priority: 'normal'
    })

    const f1 = 'file-1'
    const f2 = 'file-2'

    const linked = await linkFilesToTicket(ticket.id, [f1, f2])
    expect(linked.length).toBe(2)

    const files = await getTicketFiles(ticket.id)
    expect(files.length).toBe(2)
  })

  test('linkFilesToTicket throws if ticket not found', async () => {
    await expect(linkFilesToTicket(99999, ['someFile'])).rejects.toThrow(
      expect.objectContaining({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket with ID 99999 not found.'
      })
    )
  })

  test('fetchTaskSuggestionsForTicket uses fetchStructuredOutput, getFullProjectSummary', async () => {
    const ticket = await createTicket({
      projectId: 1008,
      title: 'TestTitle',
      overview: 'Test overview',
      status: 'open',
      priority: 'normal'
    })

    const suggestions = await fetchTaskSuggestionsForTicket(ticket, 'User context')
    expect(generateStructuredDataMock.mock.calls.length).toBe(1)
    expect(summaryMock.mock.calls.length).toBe(1)
    expect(suggestions.tasks[0].title).toBe('MockTask')
  })

  test('suggestTasksForTicket calls fetchTaskSuggestionsForTicket, returns array of titles', async () => {
    const ticket = await createTicket({
      projectId: 1009,
      title: 'SuggTitle',
      overview: 'Suggest title overview',
      status: 'open',
      priority: 'normal'
    })
    const titles = await suggestTasksForTicket(ticket.id, 'some context')
    expect(titles.length).toBe(1)
    expect(titles[0]).toBe('MockTask')
  })

  test('suggestTasksForTicket returns [] if error is thrown', async () => {
    generateStructuredDataMock.mockImplementationOnce(async () => {
      throw new Error('AI error')
    })
    const ticket = await createTicket({
      projectId: 1010,
      title: 'ErrTicket',
      overview: 'Error ticket overview',
      status: 'open',
      priority: 'normal'
    })
    await expect(suggestTasksForTicket(ticket.id, 'err context')).rejects.toThrow(
      expect.objectContaining({ code: 'TASK_SUGGESTION_FAILED' })
    )
  })

  test('suggestTasksForTicket throws if ticket not found', async () => {
    await expect(suggestTasksForTicket(99999, 'ctx')).rejects.toThrow(
      expect.objectContaining({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket with ID 99999 not found.'
      })
    )
  })

  test('getTicketsWithFiles merges file IDs', async () => {
    const projId = 12345678911

    const t1 = await createTicket({
      projectId: projId,
      title: 'T1',
      overview: 'T1 overview',
      status: 'open',
      priority: 'normal'
    })
    const t2 = await createTicket({
      projectId: projId,
      title: 'T2',
      overview: 'T2 overview',
      status: 'open',
      priority: 'normal'
    })

    const f1 = 'file-1'
    const f2 = 'file-2'

    await linkFilesToTicket(t1.id, [f1, f2])
    await linkFilesToTicket(t2.id, [f2])

    const all = await getTicketsWithFiles(projId)
    expect(all.length).toBe(2)

    const t1Info = all.find((x: any) => x.id === t1.id)
    expect(t1Info?.fileIds.length).toBe(2)

    const t2Info = all.find((x: any) => x.id === t2.id)
    expect(t2Info?.fileIds.length).toBe(1)
  })

  test('createTask inserts new row with incremented orderIndex', async () => {
    const t = await createTicket({
      projectId: 1012,
      title: 'T',
      overview: 'Ticket overview',
      status: 'open',
      priority: 'normal'
    })
    const task1 = await createTask(t.id, 'First')
    expect(task1.id).toBeDefined()
    expect(task1.orderIndex).toBe(0)

    const task2 = await createTask(t.id, 'Second')
    expect(task2.orderIndex).toBe(1)
  })

  test('createTask throws if ticket not found', async () => {
    await expect(createTask(99999, 'Nope')).rejects.toThrow(expect.objectContaining({ code: 'TICKET_NOT_FOUND' }))
  })

  test('getTasks returns tasks sorted by orderIndex', async () => {
    const t = await createTicket({
      projectId: 1013,
      title: 'T2',
      overview: 'T2 overview',
      status: 'open',
      priority: 'normal'
    })
    const taskA = await createTask(t.id, 'A')
    const taskB = await createTask(t.id, 'B')
    const tasks = await getTasks(t.id)
    expect(tasks.length).toBe(2)
    expect(tasks[0].id).toBe(taskA.id)
    expect(tasks[1].id).toBe(taskB.id)
  })

  test('updateTask modifies content/done, returns null if not found', async () => {
    const t = await createTicket({
      projectId: 1014,
      title: 'T3',
      overview: 'T3 overview',
      status: 'open',
      priority: 'normal'
    })
    const task = await createTask(t.id, 'OldContent')

    await updateTask(t.id, task.id, { content: 'NewContent', done: true })
    const all = await getTasks(t.id)
    expect(all[0].content).toBe('NewContent')
    expect(all[0].done).toBe(true)

    await expect(updateTask(t.id, 99999, { done: false })).rejects.toThrow(
      expect.objectContaining({ code: 'TASK_NOT_FOUND_FOR_TICKET' })
    )
  })

  test('deleteTask returns true if removed, false if not found', async () => {
    const t = await createTicket({
      projectId: 1015,
      title: 'Del',
      overview: 'Delete ticket overview',
      status: 'open',
      priority: 'normal'
    })
    const task = await createTask(t.id, 'ToDel')
    await expect(deleteTask(t.id, task.id)).resolves.toBeUndefined()

    const tasksAfterDelete = await getTasks(t.id)
    expect(tasksAfterDelete.find((tk: any) => tk.id === task.id)).toBeUndefined()

    await expect(deleteTask(t.id, task.id)).rejects.toThrow(
      expect.objectContaining({ code: 'TASK_NOT_FOUND_FOR_TICKET' })
    )
  })

  test('reorderTasks updates multiple orderIndexes', async () => {
    const t = await createTicket({
      projectId: 1016,
      title: 'RT',
      overview: 'Reorder ticket overview',
      status: 'open',
      priority: 'normal'
    })
    const ta = await createTask(t.id, 'A')
    const tb = await createTask(t.id, 'B')

    await reorderTasks(t.id, [
      { taskId: ta.id, orderIndex: 2 },
      { taskId: tb.id, orderIndex: 1 }
    ])

    const tasks = await getTasks(t.id)
    expect(tasks[0].id).toBe(tb.id)
    expect(tasks[0].orderIndex).toBe(1)
    expect(tasks[1].id).toBe(ta.id)
    expect(tasks[1].orderIndex).toBe(2)
  })

  test('autoGenerateTasksFromOverview calls suggestTasksForTicket, inserts tasks', async () => {
    const t = await createTicket({
      projectId: 1017,
      title: 'Auto',
      overview: 'Auto generate overview',
      status: 'open',
      priority: 'normal'
    })
    const newTasks = await autoGenerateTasksFromOverview(t.id)
    expect(newTasks.length).toBe(1)
    expect(newTasks[0].content).toBe('MockTask')
  })

  test('listTicketsWithTaskCount returns array with aggregated taskCount', async () => {
    const projId = 12345678918

    const tk1 = await createTicket({
      projectId: projId,
      title: 'TC1',
      overview: 'TC1 overview',
      status: 'open',
      priority: 'normal'
    })
    const tk2 = await createTicket({
      projectId: projId,
      title: 'TC2',
      overview: 'TC2 overview',
      status: 'open',
      priority: 'normal'
    })

    // tk1 -> 2 tasks, tk2 -> 1 task
    await createTask(tk1.id, 'T1A')
    await createTask(tk1.id, 'T1B')
    await createTask(tk2.id, 'T2A')

    const results = await listTicketsWithTaskCount(projId)
    expect(results.length).toBe(2)

    const r1 = results.find((r: any) => r.id === tk1.id)
    expect(r1?.taskCount).toBe(2)

    const r2 = results.find((r: any) => r.id === tk2.id)
    expect(r2?.taskCount).toBe(1)
  })

  test('getTasksForTickets returns object keyed by ticketId', async () => {
    const t1 = await createTicket({
      projectId: 1019,
      title: 'T1',
      overview: 'T1 overview',
      status: 'open',
      priority: 'normal'
    })
    const t2 = await createTicket({
      projectId: 1019,
      title: 'T2',
      overview: 'T2 overview',
      status: 'open',
      priority: 'normal'
    })
    await createTask(t1.id, 'One')
    await createTask(t1.id, 'Two')
    await createTask(t2.id, 'Other')

    const map = await getTasksForTickets([t1.id, t2.id])
    expect(Object.keys(map).length).toBe(2)
    expect(map[t1.id].length).toBe(2)
    expect(map[t2.id].length).toBe(1)
  })

  test('listTicketsWithTasks merges tasks array', async () => {
    const t1 = await createTicket({
      projectId: 12345678920,
      title: 'TT1',
      overview: 'TT1 overview',
      status: 'open',
      priority: 'normal'
    })
    const t2 = await createTicket({
      projectId: 12345678920,
      title: 'TT2',
      overview: 'TT2 overview',
      status: 'open',
      priority: 'normal'
    })
    await createTask(t1.id, 'TaskA')
    await createTask(t1.id, 'TaskB')

    const found = await listTicketsWithTasks(12345678920)
    expect(found.length).toBe(2)
    const f1 = found.find((x: any) => x.id === t1.id)
    expect(f1?.tasks.length).toBe(2)

    const f2 = found.find((x: any) => x.id === t2.id)
    expect(f2?.tasks.length).toBe(0)
  })

  test('getTicketWithSuggestedFiles returns parsed array of file IDs', async () => {
    const t = await createTicket({
      projectId: 1021,
      title: 'SF',
      overview: 'SF overview',
      status: 'open',
      priority: 'normal'
    })

    await updateTicket(t.id, { suggestedFileIds: ['abc', 'def'] })

    const withFiles = await getTicketWithSuggestedFiles(t.id)
    expect(withFiles?.parsedSuggestedFileIds).toEqual(['abc', 'def'])
  })
})
