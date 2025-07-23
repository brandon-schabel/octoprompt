// Last 5 changes: Completely rewritten to use OctoPrompt storage patterns and proper error handling
import type {
  CreateTicketBody,
  UpdateTicketBody,
  CreateTaskBody,
  UpdateTaskBody,
  ReorderTasksBody,
  Ticket,
  TicketTask,
  TaskSuggestions
} from '@octoprompt/schemas'
import { TaskSuggestionsSchema, FileSuggestionsZodSchema } from '@octoprompt/schemas'
import { MEDIUM_MODEL_CONFIG, HIGH_MODEL_CONFIG } from '@octoprompt/config'
import { ticketStorage } from '@octoprompt/storage'
import { ApiError } from '@octoprompt/shared'
import { getFullProjectSummary, getCompactProjectSummary } from './utils/get-full-project-summary'
import { generateStructuredData } from './gen-ai-services'

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

export function stripTripleBackticks(text: string): string {
  const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/
  const match = text.match(tripleBacktickRegex)
  if (match) {
    return match[1].trim()
  }
  return text.trim()
}

export async function fetchTaskSuggestionsForTicket(
  ticket: Ticket,
  userContext: string | undefined
): Promise<TaskSuggestions> {
  const projectSummary = await getFullProjectSummary(ticket.projectId)

  const userMessage = `
  <goal>
  Suggest tasks for this ticket. The tickets should be relevant to the project. The goal is to break down the
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
    schema: TaskSuggestionsSchema,
    options: MEDIUM_MODEL_CONFIG
  })

  return result.object
}

// --- Ticket CRUD Operations ---

export async function createTicket(data: CreateTicketBody): Promise<Ticket> {
  const ticketId = ticketStorage.generateTicketId()
  const now = Date.now()

  const newTicket: Ticket = {
    id: ticketId,
    projectId: data.projectId,
    title: data.title,
    overview: data.overview || '',
    status: data.status || 'open',
    priority: data.priority || 'normal',
    suggestedFileIds: data.suggestedFileIds || [],
    created: now,
    updated: now
  }

  return await ticketStorage.addTicket(newTicket)
}

export async function getTicketById(ticketId: number): Promise<Ticket> {
  const ticket = await ticketStorage.getTicketById(ticketId)
  if (!ticket) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found.`, 'TICKET_NOT_FOUND')
  }
  return ticket
}

export async function listTicketsByProject(projectId: number, statusFilter?: string): Promise<Ticket[]> {
  const ticketsStorage = await ticketStorage.readTickets(projectId)
  let tickets = Object.values(ticketsStorage)

  if (statusFilter) {
    tickets = tickets.filter((ticket) => ticket.status === statusFilter)
  }

  // Sort by created date (newest first)
  return tickets.sort((a, b) => b.created - a.created)
}

export async function updateTicket(ticketId: number, data: UpdateTicketBody): Promise<Ticket> {
  const existingTicket = await getTicketById(ticketId)
  const now = Date.now()

  const updatedTicket: Ticket = {
    ...existingTicket,
    ...(data.title && { title: data.title }),
    ...(data.overview !== undefined && { overview: data.overview }),
    ...(data.status && { status: data.status }),
    ...(data.priority && { priority: data.priority }),
    ...(data.suggestedFileIds && { suggestedFileIds: data.suggestedFileIds }),
    updated: now
  }

  const success = await ticketStorage.updateTicket(ticketId, updatedTicket)
  if (!success) {
    throw new ApiError(500, `Failed to update ticket ${ticketId}`, 'UPDATE_TICKET_FAILED')
  }

  return updatedTicket
}

export async function deleteTicket(ticketId: number): Promise<void> {
  const existingTicket = await getTicketById(ticketId) // This will throw if not found
  await ticketStorage.deleteTicketData(ticketId)
}

// --- Task CRUD Operations ---

export async function createTask(ticketId: number, content: string): Promise<TicketTask> {
  // Verify ticket exists
  await getTicketById(ticketId)

  const taskId = ticketStorage.generateTaskId()
  const now = Date.now()

  // Get existing tasks to determine next order index
  const existingTasks = await getTasks(ticketId)
  const maxIndex = existingTasks.length > 0 ? Math.max(...existingTasks.map((t) => t.orderIndex)) : -1
  const nextIndex = maxIndex + 1

  const newTask: TicketTask = {
    id: taskId,
    ticketId,
    content,
    done: false,
    orderIndex: nextIndex,
    created: now,
    updated: now
  }

  return await ticketStorage.addTask(newTask)
}

export async function getTasks(ticketId: number): Promise<TicketTask[]> {
  const tasksStorage = await ticketStorage.readTicketTasks(ticketId)
  const tasks = Object.values(tasksStorage)

  // Sort by order index
  return tasks.sort((a, b) => a.orderIndex - b.orderIndex)
}

export async function updateTask(ticketId: number, taskId: number, updates: UpdateTaskBody): Promise<TicketTask> {
  // Verify ticket exists
  await getTicketById(ticketId)

  const existingTask = await ticketStorage.getTaskById(taskId)
  if (!existingTask) {
    throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}.`, 'TASK_NOT_FOUND_FOR_TICKET')
  }

  if (existingTask.ticketId !== ticketId) {
    throw new ApiError(400, `Task ${taskId} does not belong to ticket ${ticketId}`, 'TASK_TICKET_MISMATCH')
  }

  const now = Date.now()
  const updatedTask: TicketTask = {
    ...existingTask,
    ...(updates.content !== undefined && { content: updates.content }),
    ...(updates.done !== undefined && { done: updates.done }),
    updated: now
  }

  const success = await ticketStorage.updateTask(taskId, updatedTask)
  if (!success) {
    throw new ApiError(500, `Failed to update task ${taskId}`, 'UPDATE_TASK_FAILED')
  }

  return updatedTask
}

export async function deleteTask(ticketId: number, taskId: number): Promise<void> {
  // Verify ticket exists
  await getTicketById(ticketId)

  const existingTask = await ticketStorage.getTaskById(taskId)
  if (!existingTask) {
    throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}.`, 'TASK_NOT_FOUND_FOR_TICKET')
  }

  if (existingTask.ticketId !== ticketId) {
    throw new ApiError(400, `Task ${taskId} does not belong to ticket ${ticketId}`, 'TASK_TICKET_MISMATCH')
  }

  const success = await ticketStorage.deleteTask(taskId)
  if (!success) {
    throw new ApiError(500, `Failed to delete task ${taskId}`, 'DELETE_TASK_FAILED')
  }
}

export async function reorderTasks(
  ticketId: number,
  tasks: Array<{ taskId: number; orderIndex: number }>
): Promise<TicketTask[]> {
  // Verify ticket exists
  await getTicketById(ticketId)

  const now = Date.now()

  // Update each task's order index
  for (const { taskId, orderIndex } of tasks) {
    const existingTask = await ticketStorage.getTaskById(taskId)
    if (!existingTask) {
      throw new ApiError(
        404,
        `Task with ID ${taskId} not found for ticket ${ticketId} during reorder.`,
        'TASK_NOT_FOUND_FOR_TICKET'
      )
    }

    if (existingTask.ticketId !== ticketId) {
      throw new ApiError(400, `Task ${taskId} does not belong to ticket ${ticketId}`, 'TASK_TICKET_MISMATCH')
    }

    const updatedTask: TicketTask = {
      ...existingTask,
      orderIndex,
      updated: now
    }

    await ticketStorage.updateTask(taskId, updatedTask)
  }

  return getTasks(ticketId)
}

// --- AI-Enhanced Operations ---

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

export async function autoGenerateTasksFromOverview(ticketId: number): Promise<TicketTask[]> {
  const ticket = await getTicketById(ticketId)

  const titles = await suggestTasksForTicket(ticketId, ticket.overview || '')
  if (titles.length === 0 && ticket.overview && ticket.overview.trim() !== '') {
    console.warn(`No tasks generated for ticket ${ticketId} despite having overview`)
  }

  const createdTasks: TicketTask[] = []

  for (const [idx, content] of titles.entries()) {
    const taskId = ticketStorage.generateTaskId()
    const now = Date.now()

    const newTask: TicketTask = {
      id: taskId,
      ticketId,
      content,
      done: false,
      orderIndex: idx,
      created: now,
      updated: now
    }

    const createdTask = await ticketStorage.addTask(newTask)
    createdTasks.push(createdTask)
  }

  return createdTasks
}

export async function suggestFilesForTicket(
  ticketId: number,
  options: { extraUserInput?: string } = {}
): Promise<{ recommendedFileIds: string[]; combinedSummaries?: string; message?: string }> {
  const ticket = await getTicketById(ticketId)

  try {
    // Get full project summary for context (includes file IDs needed for suggestion)
    const projectSummary = await getFullProjectSummary(ticket.projectId)

    // Prepare system prompt for file suggestion
    const systemPrompt = `You are a code assistant that recommends relevant files from a project based on a ticket's content.

Analyze the ticket information and project structure to suggest the most relevant files that would need to be modified or reviewed to complete the ticket.

Focus on:
- Files directly related to the functionality mentioned in the ticket
- Configuration files that might need updates
- Test files that should be created or modified
- Related components or modules that interact with the main functionality

Return file IDs as numbers only.`

    // Prepare user prompt with ticket details and project context
    const userPrompt = `Ticket Title: ${ticket.title}

Ticket Overview: ${ticket.overview || 'No overview provided'}

${options.extraUserInput ? `Additional Context: ${options.extraUserInput}\n\n` : ''}Project Summary:
${projectSummary}

Based on this ticket and project structure, suggest the most relevant file IDs that would need to be examined or modified to complete this ticket. Focus on files that are directly related to the functionality described.`

    // Use AI to suggest relevant files
    const result = await generateStructuredData({
      prompt: userPrompt,
      schema: FileSuggestionsZodSchema,
      systemMessage: systemPrompt,
      options: HIGH_MODEL_CONFIG
    })

    // Get the suggested file IDs and convert to strings
    const suggestedFileIds = result.object.fileIds.map(id => id.toString())

    // Merge with existing suggestions to preserve any manually added files
    const allFileIds = [...new Set([...ticket.suggestedFileIds, ...suggestedFileIds])]

    // Update the ticket with the new suggestions if there are new ones
    if (suggestedFileIds.length > 0 && suggestedFileIds.some(id => !ticket.suggestedFileIds.includes(id))) {
      await updateTicket(ticketId, {
        suggestedFileIds: allFileIds
      })
    }

    return {
      recommendedFileIds: allFileIds,
      combinedSummaries: `AI-suggested ${suggestedFileIds.length} relevant files based on ticket: "${ticket.title}"`,
      message: suggestedFileIds.length > 0 
        ? `Found ${suggestedFileIds.length} relevant files for this ticket`
        : 'No additional files suggested beyond existing selections'
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

// --- Bulk Operations ---

export async function listTicketsWithTaskCount(
  projectId: number,
  statusFilter?: string
): Promise<Array<Ticket & { taskCount: number; completedTaskCount: number }>> {
  const tickets = await listTicketsByProject(projectId, statusFilter)

  const ticketsWithCount = await Promise.all(
    tickets.map(async (ticket) => {
      const tasks = await getTasks(ticket.id)
      const taskCount = tasks.length
      const completedTaskCount = tasks.filter((task) => task.done).length

      return {
        ...ticket,
        taskCount,
        completedTaskCount
      }
    })
  )

  return ticketsWithCount
}

export async function getTasksForTickets(ticketIds: number[]): Promise<Record<string, TicketTask[]>> {
  if (!ticketIds.length) return {}

  const tasksByTicket: Record<string, TicketTask[]> = {}

  for (const ticketId of ticketIds) {
    try {
      const tasks = await getTasks(ticketId)
      tasksByTicket[ticketId.toString()] = tasks
    } catch (error) {
      // If ticket doesn't exist, just skip it
      console.warn(`Could not get tasks for ticket ${ticketId}:`, error)
      tasksByTicket[ticketId.toString()] = []
    }
  }

  return tasksByTicket
}

export async function listTicketsWithTasks(
  projectId: number,
  statusFilter?: string
): Promise<Array<Ticket & { tasks: TicketTask[] }>> {
  const tickets = await listTicketsByProject(projectId, statusFilter)

  const ticketsWithTasks = await Promise.all(
    tickets.map(async (ticket) => {
      const tasks = await getTasks(ticket.id)
      return {
        ...ticket,
        tasks
      }
    })
  )

  return ticketsWithTasks
}

// --- Legacy Support Functions ---

export async function linkFilesToTicket(
  ticketId: number,
  fileIds: string[]
): Promise<Array<{ ticketId: string; fileId: string }>> {
  const ticket = await getTicketById(ticketId)

  // Update the ticket's suggested file IDs
  const updatedTicket = await updateTicket(ticketId, {
    suggestedFileIds: [...new Set([...ticket.suggestedFileIds, ...fileIds])]
  })

  // Return the linked files in the expected format
  return fileIds.map((fileId) => ({
    ticketId: ticketId.toString(),
    fileId
  }))
}

export async function getTicketFiles(ticketId: number): Promise<Array<{ id: string; name: string; path: string }>> {
  const ticket = await getTicketById(ticketId)

  // Return basic file info based on suggested file IDs
  // In a real implementation, this would query the files table
  return ticket.suggestedFileIds.map((fileId) => ({
    id: fileId,
    name: `file-${fileId}`,
    path: `path/to/${fileId}`
  }))
}

export async function getTicketsWithFiles(
  projectId: number,
  statusFilter?: string
): Promise<Array<Ticket & { fileIds: string[] }>> {
  const tickets = await listTicketsByProject(projectId, statusFilter)

  return tickets.map((ticket) => ({
    ...ticket,
    fileIds: ticket.suggestedFileIds || []
  }))
}

export async function getTicketWithSuggestedFiles(
  ticketId: number
): Promise<(Ticket & { parsedSuggestedFileIds: string[] }) | null> {
  const ticket = await getTicketById(ticketId)

  return {
    ...ticket,
    parsedSuggestedFileIds: ticket.suggestedFileIds || []
  }
}

/**
 * Removes deleted file IDs from all tickets in a project.
 * This should be called after files are deleted from a project to maintain referential integrity.
 */
export async function removeDeletedFileIdsFromTickets(
  projectId: number,
  deletedFileIds: number[]
): Promise<{ updatedTickets: number }> {
  try {
    const tickets = await listTicketsByProject(projectId)
    let updatedCount = 0

    for (const ticket of tickets) {
      if (ticket.suggestedFileIds && ticket.suggestedFileIds.length > 0) {
        const originalLength = ticket.suggestedFileIds.length
        const updatedFileIds = ticket.suggestedFileIds.filter(
          (fileId) => !deletedFileIds.includes(fileId)
        )

        if (updatedFileIds.length < originalLength) {
          await updateTicket(ticket.id, { suggestedFileIds: updatedFileIds })
          updatedCount++
        }
      }
    }

    return { updatedTickets: updatedCount }
  } catch (error) {
    console.error(
      `Failed to remove deleted file IDs from tickets in project ${projectId}:`,
      error
    )
    // Don't throw - this is a cleanup operation that shouldn't fail the main operation
    return { updatedTickets: 0 }
  }
}
