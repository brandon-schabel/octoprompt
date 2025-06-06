import { ApiError } from '@octoprompt/shared'
import { MEDIUM_MODEL_CONFIG } from '@octoprompt/schemas'
import { getFullProjectSummary } from '@octoprompt/services'
import { z, ZodError } from 'zod'
import {
  type CreateTicketBody,
  type UpdateTicketBody,
  TicketReadSchema,
  TicketTaskReadSchema,
  TicketFileReadSchema,
  type Ticket,
  type TicketTask,
  type TicketFile,
  type TaskSuggestions,
  TaskSuggestionsZodSchema
} from '@octoprompt/schemas'
import { projectStorage } from '@octoprompt/storage'
import {
  ticketStorage,
  type TicketsStorage,
} from '@octoprompt/storage'
import { generateStructuredData } from './gen-ai-services'
import { normalizeToUnixMs } from '@octoprompt/shared'

const validTaskFormatPrompt = `IMPORTANT: Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "Task title here",
      "description": "Optional description here"
    }
  ]
}`

export const defaultTaskPrompt = `You are a technical project manager helping break down tickets into actionable tasks.
Given a ticket's title and overview, suggest specific, concrete tasks that would help complete the ticket.
Focus on technical implementation tasks, testing, and validation steps.
Each task should be clear and actionable.

${validTaskFormatPrompt}
`

export async function fetchTaskSuggestionsForTicket(
  ticket: Ticket,
  userContext: string | undefined
): Promise<TaskSuggestions> {
  const projectSummary = await getFullProjectSummary(ticket.projectId)

  const userMessage = `
  <goal>
  Suggest tasks for this ticket. The tickets should be relevant to the project.  The gaol is to break down the
  ticket into smaller, actionable tasks based on the users request. Refer to the ticket overview and title for context. 
  Break the ticket down into step by step tasks that are clear, actionable, and specific to the project. 

  - Each Task should include which files are relevant to the task.

  </goal>

  <ticket_title>
  ${ticket.title}
  </ticket_title>

  <ticket_overview>
  ${ticket.overview}
  </ticket_overview>

  <user_context>
  ${userContext ? `Additional Context: ${userContext}` : ''}
  </user_context>

  ${projectSummary}
`

  const cfg = MEDIUM_MODEL_CONFIG
  if (!cfg.model) {
    throw new ApiError(500, `Model not configured for 'suggest-ticket-tasks'`, 'CONFIG_ERROR')
  }

  const result = await generateStructuredData({
    prompt: userMessage,
    systemMessage: defaultTaskPrompt,
    schema: TaskSuggestionsZodSchema,
    options: MEDIUM_MODEL_CONFIG
  })

  return result.object
}

export async function createTicket(data: CreateTicketBody): Promise<Ticket> {
  let ticketId = ticketStorage.generateId()
  const initialTicketId = ticketId
  let incrementCount = 0
  const now = normalizeToUnixMs(new Date())

  const newTicketData: Omit<Ticket, 'created' | 'updated'> & { created: number; updated: number } = {
    id: ticketId,
    projectId: data.projectId,
    title: data.title,
    overview: data.overview ?? '',
    status: data.status ?? 'open',
    priority: data.priority ?? 'normal',
    suggestedFileIds: data.suggestedFileIds || [],
    created: now,
    updated: now
  }

  try {
    const validatedTicket = TicketReadSchema.parse(newTicketData)

    const allTickets = await ticketStorage.readTickets()
    while (allTickets[ticketId.toString()]) {
      ticketId++
      incrementCount++
    }
    if (incrementCount > 0) {
      console.log(
        `Ticket ID ${initialTicketId} was taken. Found available ID ${ticketId} after ${incrementCount} increment(s).`
      )
      newTicketData.id = ticketId
    }

    const finalValidatedTicket = TicketReadSchema.parse(newTicketData)
    allTickets[finalValidatedTicket.id.toString()] = finalValidatedTicket
    await ticketStorage.writeTickets(allTickets)
    await ticketStorage.writeTicketTasks(finalValidatedTicket.id, {})
    await ticketStorage.writeTicketFiles(finalValidatedTicket.id, [])

    return finalValidatedTicket
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed for new ticket data: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(
        500,
        `Internal validation error creating ticket.`,
        'TICKET_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(500, `Failed to create ticket.`, 'CREATE_TICKET_FAILED', { originalError: error })
  }
}

export async function getTicketById(ticketId: number): Promise<Ticket> {
  const allTickets = await ticketStorage.readTickets()
  const ticketData = allTickets[ticketId.toString()]
  if (!ticketData) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found.`, 'TICKET_NOT_FOUND')
  }
  return ticketData
}

async function updateTicketTimestamp(ticketId: number, allTickets: TicketsStorage): Promise<TicketsStorage> {
  const ticketKey = ticketId.toString()
  if (allTickets[ticketKey]) {
    allTickets[ticketKey] = {
      ...allTickets[ticketKey],
      updated: normalizeToUnixMs(new Date())
    }
  }
  return allTickets
}

export async function listTicketsByProject(projectId: number, statusFilter?: string): Promise<Ticket[]> {
  const allTickets = await ticketStorage.readTickets()
  let tickets = Object.values(allTickets).filter((t) => t.projectId === projectId)

  if (statusFilter) {
    tickets = tickets.filter((t) => t.status === statusFilter)
  }

  tickets.sort((a, b) => b.created - a.created)
  return tickets
}

export async function updateTicket(ticketId: number, data: UpdateTicketBody): Promise<Ticket> {
  let allTickets = await ticketStorage.readTickets()
  const ticketKey = ticketId.toString()
  const existingTicket = allTickets[ticketKey]

  if (!existingTicket) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found for update.`, 'TICKET_NOT_FOUND')
  }

  const updatedData = { ...existingTicket }

  if (data.title !== undefined) updatedData.title = data.title
  if (data.overview !== undefined) updatedData.overview = data.overview
  if (data.status !== undefined) updatedData.status = data.status
  if (data.priority !== undefined) updatedData.priority = data.priority
  if (data.suggestedFileIds !== undefined) {
    const projectFiles = await projectStorage.readProjectFiles(existingTicket.projectId)
    for (const fileId of data.suggestedFileIds) {
      if (!projectFiles[fileId.toString()]) {
        throw new ApiError(
          400,
          `File with ID ${fileId} not found in project ${existingTicket.projectId}.`,
          'FILE_NOT_FOUND_IN_PROJECT'
        )
      }
    }
    updatedData.suggestedFileIds = data.suggestedFileIds
  }
  updatedData.updated = normalizeToUnixMs(new Date())

  try {
    const dataToValidate = {
      ...updatedData,
      created: existingTicket.created
    }
    const validatedTicket = TicketReadSchema.parse(dataToValidate)
    allTickets[ticketKey] = validatedTicket
    await ticketStorage.writeTickets(allTickets)
    return validatedTicket
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Validation failed updating ticket ${ticketId}.`,
        'TICKET_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(500, `Failed to update ticket ${ticketId}.`, 'UPDATE_TICKET_FAILED', { originalError: error })
  }
}

export async function deleteTicket(ticketId: number): Promise<void> {
  const allTickets = await ticketStorage.readTickets()
  const ticketKey = ticketId.toString()
  if (!allTickets[ticketKey]) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found for deletion.`, 'TICKET_NOT_FOUND')
  }

  delete allTickets[ticketKey]
  await ticketStorage.writeTickets(allTickets)
  await ticketStorage.deleteTicketData(ticketId)
}

export async function linkFilesToTicket(ticketId: number, fileIds: number[]): Promise<TicketFile[]> {
  const ticket = await getTicketById(ticketId)

  const projectFilesData = await projectStorage.readProjectFiles(ticket.projectId)
  for (const fileId of fileIds) {
    if (!projectFilesData[fileId.toString()]) {
      throw new ApiError(
        400,
        `File with ID ${fileId} not found in project ${ticket.projectId} for linking.`,
        'FILE_NOT_FOUND_IN_PROJECT'
      )
    }
  }

  let ticketLinks = await ticketStorage.readTicketFiles(ticketId)
  const existingFileIds = new Set(ticketLinks.map((link) => link.fileId))

  let newLinksMade = false
  for (const fileId of fileIds) {
    if (!existingFileIds.has(fileId)) {
      ticketLinks.push({ ticketId, fileId })
      newLinksMade = true
    }
  }

  if (newLinksMade) {
    await ticketStorage.writeTicketFiles(ticketId, ticketLinks)
    let allTickets = await ticketStorage.readTickets()
    allTickets = await updateTicketTimestamp(ticketId, allTickets)
    await ticketStorage.writeTickets(allTickets)
  }
  return ticketLinks
}

export async function getTicketFiles(ticketId: number): Promise<TicketFile[]> {
  await getTicketById(ticketId)
  const ticketLinks = await ticketStorage.readTicketFiles(ticketId)
  return ticketLinks
}

export async function suggestTasksForTicket(ticketId: number, userContext?: string): Promise<string[]> {
  console.log('[TicketService] Starting task suggestion for ticket:', ticketId)
  const ticket = await getTicketById(ticketId)

  try {
    const suggestions = await fetchTaskSuggestionsForTicket(ticket, userContext)
    return suggestions.tasks.map((task) => task.title)
  } catch (error: any) {
    console.error('[TicketService] Error in task suggestion:', error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      500,
      `Failed to suggest tasks for ticket ${ticketId}: ${error.message || 'AI provider error'}`,
      'TASK_SUGGESTION_FAILED',
      { originalError: error }
    )
  }
}

export async function getTicketsWithFiles(projectId: number): Promise<(Ticket & { fileIds: number[] })[]> {
  const projectTickets = await listTicketsByProject(projectId)
  if (projectTickets.length === 0) return []

  const results: (Ticket & { fileIds: number[] })[] = []
  for (const ticket of projectTickets) {
    const links = await ticketStorage.readTicketFiles(ticket.id)
    results.push({
      ...ticket,
      fileIds: links.map((link) => link.fileId)
    })
  }
  return results
}

export async function createTask(ticketId: number, content: string): Promise<TicketTask> {
  await getTicketById(ticketId)

  let taskId = ticketStorage.generateId()
  const initialTaskId = taskId
  let incrementCount = 0
  const now = normalizeToUnixMs(new Date())

  let ticketTasks = await ticketStorage.readTicketTasks(ticketId)
  const orderIndex =
    Object.keys(ticketTasks).length > 0 ? Math.max(...Object.values(ticketTasks).map((t) => t.orderIndex)) + 1 : 1

  const newTaskData: TicketTask = {
    id: taskId,
    ticketId: ticketId,
    content: content,
    done: false,
    orderIndex: orderIndex,
    created: now,
    updated: now
  }

  try {
    while (ticketTasks[taskId.toString()]) {
      taskId++
      incrementCount++
    }
    if (incrementCount > 0) {
      console.log(
        `Task ID ${initialTaskId} for ticket ${ticketId} was taken. Found available ID ${taskId} after ${incrementCount} increment(s).`
      )
      newTaskData.id = taskId
    }

    const validatedTask = TicketTaskReadSchema.parse(newTaskData)
    ticketTasks[validatedTask.id.toString()] = validatedTask
    await ticketStorage.writeTicketTasks(ticketId, ticketTasks)

    let allTickets = await ticketStorage.readTickets()
    allTickets = await updateTicketTimestamp(ticketId, allTickets)
    await ticketStorage.writeTickets(allTickets)

    return validatedTask
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Validation failed creating task for ticket ${ticketId}.`,
        'TASK_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(500, `Failed to create task for ticket ${ticketId}.`, 'CREATE_TASK_FAILED', {
      originalError: error
    })
  }
}

export async function getTasks(ticketId: number): Promise<TicketTask[]> {
  await getTicketById(ticketId)
  const ticketTasksData = await ticketStorage.readTicketTasks(ticketId)
  const tasks = Object.values(ticketTasksData)
  tasks.sort((a, b) => a.orderIndex - b.orderIndex)
  return tasks
}

export async function deleteTask(ticketId: number, taskId: number): Promise<void> {
  await getTicketById(ticketId)

  const ticketTasks = await ticketStorage.readTicketTasks(ticketId)
  const taskKey = taskId.toString()
  if (!ticketTasks[taskKey]) {
    throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}.`, 'TASK_NOT_FOUND_FOR_TICKET')
  }

  delete ticketTasks[taskKey]
  await ticketStorage.writeTicketTasks(ticketId, ticketTasks)

  let allTickets = await ticketStorage.readTickets()
  allTickets = await updateTicketTimestamp(ticketId, allTickets)
  await ticketStorage.writeTickets(allTickets)
}

// FIXED: Handle the updated reorder schema properly
export async function reorderTasks(
  ticketId: number,
  taskReorders: Array<{ taskId: number; orderIndex: number }>
): Promise<TicketTask[]> {
  await getTicketById(ticketId)

  const ticketTasks = await ticketStorage.readTicketTasks(ticketId)
  let changed = false

  for (const { taskId, orderIndex } of taskReorders) {
    const taskKey = taskId.toString()
    if (ticketTasks[taskKey]) {
      if (ticketTasks[taskKey].orderIndex !== orderIndex) {
        ticketTasks[taskKey].orderIndex = orderIndex
        ticketTasks[taskKey].updated = normalizeToUnixMs(new Date())
        changed = true
      }
    } else {
      throw new ApiError(
        404,
        `Task with ID ${taskId} not found for ticket ${ticketId} during reorder.`,
        'TASK_NOT_FOUND_FOR_TICKET'
      )
    }
  }

  if (changed) {
    await ticketStorage.writeTicketTasks(ticketId, ticketTasks)
    let allTickets = await ticketStorage.readTickets()
    allTickets = await updateTicketTimestamp(ticketId, allTickets)
    await ticketStorage.writeTickets(allTickets)
  }

  return Object.values(ticketTasks).sort((a, b) => a.orderIndex - b.orderIndex)
}

export async function autoGenerateTasksFromOverview(ticketId: number): Promise<TicketTask[]> {
  const ticket = await getTicketById(ticketId)

  const titles = await suggestTasksForTicket(ticketId, ticket.overview ?? '')

  const insertedTasks: TicketTask[] = []
  if (titles.length > 0) {
    let ticketTasks = await ticketStorage.readTicketTasks(ticketId)
    let currentMaxOrder =
      Object.keys(ticketTasks).length > 0 ? Math.max(...Object.values(ticketTasks).map((t) => t.orderIndex)) : 0
    const now = normalizeToUnixMs(new Date())

    for (const content of titles) {
      currentMaxOrder++
      const taskId = ticketStorage.generateId()
      const newTaskData: TicketTask = {
        id: taskId,
        ticketId: ticketId,
        content: content,
        done: false,
        orderIndex: currentMaxOrder,
        created: now,
        updated: now
      }
      try {
        const validatedTask = TicketTaskReadSchema.parse(newTaskData)
        ticketTasks[taskId.toString()] = validatedTask
        insertedTasks.push(validatedTask)
      } catch (error) {
        if (error instanceof ZodError) {
          console.error(
            `Validation failed for auto-generated task '${content}': ${error.message}`,
            error.flatten().fieldErrors
          )
        } else {
          throw error
        }
      }
    }
    if (insertedTasks.length > 0) {
      await ticketStorage.writeTicketTasks(ticketId, ticketTasks)
      let allTickets = await ticketStorage.readTickets()
      allTickets = await updateTicketTimestamp(ticketId, allTickets)
      await ticketStorage.writeTickets(allTickets)
    }
  }
  return insertedTasks
}

export async function listTicketsWithTaskCount(
  projectId: number,
  statusFilter?: string
): Promise<Array<Ticket & { taskCount: number; completedTaskCount: number }>> {
  const tickets = await listTicketsByProject(projectId, statusFilter)
  const results: Array<Ticket & { taskCount: number; completedTaskCount: number }> = []

  for (const ticket of tickets) {
    const tasksData = await ticketStorage.readTicketTasks(ticket.id)
    const tasksArray = Object.values(tasksData)
    results.push({
      ...ticket,
      taskCount: tasksArray.length,
      completedTaskCount: tasksArray.filter((t) => t.done).length
    })
  }
  return results
}

export async function getTasksForTickets(ticketIds: number[]): Promise<Record<number, TicketTask[]>> {
  if (!ticketIds.length) return {}

  const tasksByTicket: Record<number, TicketTask[]> = {}
  const allTickets = await ticketStorage.readTickets()

  for (const ticketId of ticketIds) {
    if (allTickets[ticketId.toString()]) {
      const tasksData = await ticketStorage.readTicketTasks(ticketId)
      const tasksArray = Object.values(tasksData).sort((a, b) => a.orderIndex - b.orderIndex)
      tasksByTicket[ticketId] = tasksArray
    }
  }
  return tasksByTicket
}

export async function listTicketsWithTasks(
  projectId: number,
  statusFilter?: string
): Promise<Array<Ticket & { tasks: TicketTask[] }>> {
  const baseTickets = await listTicketsByProject(projectId, statusFilter)
  if (!baseTickets.length) {
    return []
  }
  const ticketIds = baseTickets.map((t: any) => t.id)
  const tasksByTicket = await getTasksForTickets(ticketIds)
  return baseTickets.map((ticket: any) => ({
    ...ticket,
    tasks: tasksByTicket[ticket.id] || []
  }))
}

export async function getTicketWithSuggestedFiles(
  ticketId: number
): Promise<(Ticket & { parsedSuggestedFileIds: number[] }) | null> {
  const ticket = await getTicketById(ticketId)
  if (!ticket) return null

  let parsedFileIds: number[] = []
  try {
    if (ticket.suggestedFileIds) {
      if (Array.isArray(ticket.suggestedFileIds)) {
        parsedFileIds = ticket.suggestedFileIds.filter((id) => typeof id === 'number')
      }
    }
  } catch (e) {
    console.warn(`Could not parse suggestedFileIds for ticket ${ticketId}: ${ticket.suggestedFileIds}`)
    parsedFileIds = []
  }

  return {
    ...ticket,
    parsedSuggestedFileIds: parsedFileIds
  }
}

// FIXED: Ensure proper validation and timestamp updates
export async function updateTask(
  ticketId: number,
  taskId: number,
  updates: { content?: string; done?: boolean }
): Promise<TicketTask> {
  await getTicketById(ticketId)

  const ticketTasks = await ticketStorage.readTicketTasks(ticketId)
  const taskKey = taskId.toString()
  const existingTask = ticketTasks[taskKey]

  if (!existingTask) {
    throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}.`, 'TASK_NOT_FOUND_FOR_TICKET')
  }

  let changed = false
  const updatedTask = { ...existingTask }

  if (updates.content !== undefined && existingTask.content !== updates.content) {
    updatedTask.content = updates.content
    changed = true
  }
  if (updates.done !== undefined && existingTask.done !== updates.done) {
    updatedTask.done = updates.done
    changed = true
  }

  if (changed) {
    updatedTask.updated = normalizeToUnixMs(new Date())
    try {
      const validatedTask = TicketTaskReadSchema.parse(updatedTask)
      ticketTasks[taskKey] = validatedTask
      await ticketStorage.writeTicketTasks(ticketId, ticketTasks)

      // Update ticket timestamp
      let allTickets = await ticketStorage.readTickets()
      allTickets = await updateTicketTimestamp(ticketId, allTickets)
      await ticketStorage.writeTickets(allTickets)

      return validatedTask
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ApiError(
          500,
          `Validation failed updating task ${taskId}.`,
          'TASK_VALIDATION_ERROR',
          error.flatten().fieldErrors
        )
      }
      throw error
    }
  }

  return existingTask
}

export async function suggestFilesForTicket(
  ticketId: number,
  options: { extraUserInput?: string }
): Promise<{ recommendedFileIds: number[]; combinedSummaries?: string; message?: string }> {
  const ticket = await getTicketById(ticketId)

  try {
    const projectFilesMap = await projectStorage.readProjectFiles(ticket.projectId)
    const projectFileIdsAsNumbers = Object.keys(projectFilesMap).map((id) => parseInt(id, 10))

    if (projectFileIdsAsNumbers.length === 0) {
      console.warn(`[TicketService] suggestFilesForTicket: No project files found for project ${ticket.projectId}.`)
      return {
        recommendedFileIds: [],
        message: 'No files found in the project to suggest from.'
      }
    }

    const recommendedFileIds = projectFileIdsAsNumbers.slice(0, Math.min(5, projectFileIdsAsNumbers.length))
    const combinedSummaries = `Placeholder summary for files in project ${ticket.projectId} related to ticket: ${ticket.title}`

    return {
      recommendedFileIds,
      combinedSummaries,
      message: 'Files suggested based on simplified project file listing.'
    }
  } catch (error) {
    console.error('[TicketService] Error suggesting files:', error)
    if (error instanceof ApiError) {
      throw error
    }
    const errorMessage = (error as any)?.message || 'Error during file suggestion'
    throw new ApiError(
      500,
      `Failed to suggest files for ticket ${ticketId}: ${errorMessage}`,
      'FILE_SUGGESTION_FAILED',
      { originalError: error }
    )
  }
}
