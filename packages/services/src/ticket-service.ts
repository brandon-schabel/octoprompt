// Last 5 changes: Completely rewritten to use Promptliano storage patterns and proper error handling
import type {
  CreateTicketBody,
  UpdateTicketBody,
  CreateTaskBody,
  UpdateTaskBody,
  ReorderTasksBody,
  Ticket,
  TicketTask,
  TaskSuggestions
} from '@promptliano/schemas'
import { TaskSuggestionsSchema, FileSuggestionsZodSchema } from '@promptliano/schemas'
import { MEDIUM_MODEL_CONFIG, HIGH_MODEL_CONFIG } from '@promptliano/config'
import { ticketStorage } from '@promptliano/storage'
import { ApiError } from '@promptliano/shared'
import { getFullProjectSummary, getCompactProjectSummary } from './utils/project-summary-service'
import { generateStructuredData } from './gen-ai-services'
import { fileSuggestionStrategyService, FileSuggestionStrategyService } from './file-suggestion-strategy-service'
import { z } from 'zod'

const validTaskFormatPrompt = `IMPORTANT: Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "Task title here",
      "description": "Optional description here",
      "suggestedFileIds": ["fileId1", "fileId2"],
      "estimatedHours": 4,
      "tags": ["frontend", "backend"]
    }
  ]
}`

export const defaultTaskPrompt = `You are a technical project manager helping break down tickets into actionable tasks.
Given a ticket's information, create detailed tasks with:
1. Clear, actionable title (content field)
2. Detailed step-by-step description
3. Relevant file IDs from the project that need to be modified
4. Estimated hours for completion
5. Relevant tags (e.g., "frontend", "backend", "testing", "documentation", "refactoring", "bugfix")

Focus on creating tasks that are:
- Specific and measurable
- Achievable within a reasonable timeframe
- Relevant to the ticket's goals
- Time-bound with estimates

Consider the project structure and existing files when suggesting file associations.
Each task should include which files are relevant to the task.

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
  let projectSummary: string

  try {
    projectSummary = await getFullProjectSummary(ticket.projectId)
  } catch (error) {
    // Handle case where project doesn't exist or has no files
    if (error instanceof ApiError && error.status === 404) {
      throw new ApiError(
        404,
        `Cannot generate tasks: Project ${ticket.projectId} not found or has no files`,
        'PROJECT_NOT_FOUND',
        { ticketId: ticket.id, projectId: ticket.projectId }
      )
    }
    throw error
  }

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

  try {
    const result = await generateStructuredData({
      prompt: userMessage,
      systemMessage: defaultTaskPrompt,
      schema: TaskSuggestionsSchema,
      options: MEDIUM_MODEL_CONFIG
    })

    return result.object
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      500,
      `Failed to generate task suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'TASK_GENERATION_FAILED',
      { ticketId: ticket.id, originalError: error }
    )
  }
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

export async function createTask(ticketId: number, data: CreateTaskBody): Promise<TicketTask> {
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
    content: data.content,
    description: data.description ?? '',
    suggestedFileIds: data.suggestedFileIds ?? [],
    done: false,
    orderIndex: nextIndex,
    estimatedHours: data.estimatedHours ?? undefined,
    dependencies: data.dependencies ?? [],
    tags: data.tags ?? [],
    created: now,
    updated: now
  }

  return await ticketStorage.addTask(newTask)
}

// Legacy function for backward compatibility
export async function createTaskLegacy(ticketId: number, content: string): Promise<TicketTask> {
  return createTask(ticketId, { content })
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
    ...(updates.description !== undefined && { description: updates.description }),
    ...(updates.suggestedFileIds !== undefined && { suggestedFileIds: updates.suggestedFileIds }),
    ...(updates.done !== undefined && { done: updates.done }),
    ...(updates.estimatedHours !== undefined && { estimatedHours: updates.estimatedHours }),
    ...(updates.dependencies !== undefined && { dependencies: updates.dependencies }),
    ...(updates.tags !== undefined && { tags: updates.tags }),
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

  // Get enhanced task suggestions with descriptions and file associations
  const suggestions = await fetchTaskSuggestionsForTicket(ticket, ticket.overview || '')
  if (suggestions.tasks.length === 0 && ticket.overview && ticket.overview.trim() !== '') {
    console.warn(`No tasks generated for ticket ${ticketId} despite having overview`)
  }

  const createdTasks: TicketTask[] = []

  for (const [idx, taskSuggestion] of suggestions.tasks.entries()) {
    const taskId = ticketStorage.generateTaskId()
    const now = Date.now()

    const newTask: TicketTask = {
      id: taskId,
      ticketId,
      content: taskSuggestion.title,
      description: taskSuggestion.description || '',
      suggestedFileIds: taskSuggestion.suggestedFileIds || [],
      done: false,
      orderIndex: idx,
      estimatedHours: taskSuggestion.estimatedHours,
      dependencies: [],
      tags: taskSuggestion.tags || [],
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
  options: {
    extraUserInput?: string
    strategy?: 'fast' | 'balanced' | 'thorough'
    maxResults?: number
  } = {}
): Promise<{ recommendedFileIds: string[]; combinedSummaries?: string; message?: string }> {
  const ticket = await getTicketById(ticketId)

  try {
    // Determine strategy based on project size if not specified
    const strategy = options.strategy || (await FileSuggestionStrategyService.recommendStrategy(ticket.projectId))

    // Use the new file suggestion strategy service
    const suggestionResponse = await fileSuggestionStrategyService.suggestFiles(
      ticket,
      strategy,
      options.maxResults || 10,
      options.extraUserInput
    )

    // Convert file IDs to strings
    const suggestedFileIds = suggestionResponse.suggestions.map((id) => id.toString())

    // Merge with existing suggestions to preserve any manually added files
    const allFileIds = [...new Set([...ticket.suggestedFileIds, ...suggestedFileIds])]

    // Update the ticket with the new suggestions if there are new ones
    if (suggestedFileIds.length > 0 && suggestedFileIds.some((id) => !ticket.suggestedFileIds.includes(id))) {
      await updateTicket(ticketId, {
        suggestedFileIds: allFileIds
      })
    }

    // Create summary message with performance info
    const { metadata } = suggestionResponse
    const performanceInfo = `(${metadata.analyzedFiles} files analyzed in ${metadata.processingTime}ms, ~${Math.round(metadata.tokensSaved || 0).toLocaleString()} tokens saved)`

    return {
      recommendedFileIds: allFileIds,
      combinedSummaries: `AI-suggested ${suggestedFileIds.length} relevant files using ${strategy} strategy ${performanceInfo}`,
      message:
        suggestedFileIds.length > 0
          ? `Found ${suggestedFileIds.length} relevant files for this ticket ${performanceInfo}`
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

// --- Search and Filter Operations ---

export interface TicketSearchOptions {
  query?: string // Text search in title and overview
  status?: string | string[]
  priority?: string | string[]
  dateFrom?: number
  dateTo?: number
  hasFiles?: boolean
  tags?: string[] // Search in associated task tags
  limit?: number
  offset?: number
}

export async function searchTickets(
  projectId: number,
  options: TicketSearchOptions
): Promise<{ tickets: Ticket[]; total: number }> {
  let tickets = await listTicketsByProject(projectId)
  const originalTotal = tickets.length

  // Text search
  if (options.query) {
    const query = options.query.toLowerCase()
    tickets = tickets.filter(
      (ticket) => ticket.title.toLowerCase().includes(query) || ticket.overview.toLowerCase().includes(query)
    )
  }

  // Status filter
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status]
    tickets = tickets.filter((ticket) => statuses.includes(ticket.status))
  }

  // Priority filter
  if (options.priority) {
    const priorities = Array.isArray(options.priority) ? options.priority : [options.priority]
    tickets = tickets.filter((ticket) => priorities.includes(ticket.priority))
  }

  // Date range filter
  if (options.dateFrom || options.dateTo) {
    tickets = tickets.filter((ticket) => {
      if (options.dateFrom && ticket.created < options.dateFrom) return false
      if (options.dateTo && ticket.created > options.dateTo) return false
      return true
    })
  }

  // Has files filter
  if (options.hasFiles !== undefined) {
    tickets = tickets.filter((ticket) =>
      options.hasFiles ? ticket.suggestedFileIds.length > 0 : ticket.suggestedFileIds.length === 0
    )
  }

  // Tags filter (search in associated tasks)
  if (options.tags && options.tags.length > 0) {
    const ticketsWithTags = await Promise.all(
      tickets.map(async (ticket) => {
        const tasks = await getTasks(ticket.id)
        const hasTags = tasks.some((task) => task.tags?.some((tag) => options.tags?.includes(tag)))
        return hasTags ? ticket : null
      })
    )
    tickets = ticketsWithTags.filter((t): t is Ticket => t !== null)
  }

  const total = tickets.length

  // Apply pagination
  if (options.offset) {
    tickets = tickets.slice(options.offset)
  }
  if (options.limit) {
    tickets = tickets.slice(0, options.limit)
  }
  return { tickets, total }
}

export interface TaskFilterOptions {
  ticketId?: number // Filter by specific ticket
  status?: 'pending' | 'done' | 'all'
  tags?: string[]
  estimatedHoursMin?: number
  estimatedHoursMax?: number
  hasDescription?: boolean
  hasFiles?: boolean
  query?: string // Text search in content and description
  limit?: number
  offset?: number
}

export async function filterTasks(
  projectId: number,
  options: TaskFilterOptions
): Promise<{ tasks: Array<TicketTask & { ticketTitle: string }>; total: number }> {
  let allTasks: Array<TicketTask & { ticketTitle: string }> = []
  if (options.ticketId) {
    // Filter for specific ticket
    const tasks = await getTasks(options.ticketId)
    const ticket = await getTicketById(options.ticketId)
    allTasks = tasks.map((task) => ({ ...task, ticketTitle: ticket.title }))
  } else {
    // Get all tasks from all tickets in project
    const tickets = await listTicketsByProject(projectId)
    for (const ticket of tickets) {
      const tasks = await getTasks(ticket.id)
      allTasks.push(...tasks.map((task) => ({ ...task, ticketTitle: ticket.title })))
    }
  }

  // Apply filters

  // Status filter
  if (options.status && options.status !== 'all') {
    allTasks = allTasks.filter((task) => (options.status === 'done' ? task.done : !task.done))
  }

  // Tags filter
  if (options.tags && options.tags.length > 0) {
    allTasks = allTasks.filter((task) => task.tags?.some((tag) => options.tags?.includes(tag)))
  }

  // Estimated hours filter
  if (options.estimatedHoursMin !== undefined || options.estimatedHoursMax !== undefined) {
    allTasks = allTasks.filter((task) => {
      if (!task.estimatedHours) return false
      if (options.estimatedHoursMin && task.estimatedHours < options.estimatedHoursMin) return false
      if (options.estimatedHoursMax && task.estimatedHours > options.estimatedHoursMax) return false
      return true
    })
  }

  // Has description filter
  if (options.hasDescription !== undefined) {
    allTasks = allTasks.filter((task) =>
      options.hasDescription
        ? task.description && task.description.length > 0
        : !task.description || task.description.length === 0
    )
  }

  // Has files filter
  if (options.hasFiles !== undefined) {
    allTasks = allTasks.filter((task) =>
      options.hasFiles
        ? task.suggestedFileIds && task.suggestedFileIds.length > 0
        : !task.suggestedFileIds || task.suggestedFileIds.length === 0
    )
  }

  // Text search
  if (options.query) {
    const query = options.query.toLowerCase()
    allTasks = allTasks.filter(
      (task) =>
        task.content.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
    )
  }

  const total = allTasks.length

  // Sort by ticket and order
  allTasks.sort((a, b) => {
    if (a.ticketId !== b.ticketId) return a.ticketId - b.ticketId
    return a.orderIndex - b.orderIndex
  })
  // Apply pagination
  if (options.offset) {
    allTasks = allTasks.slice(options.offset)
  }
  if (options.limit) {
    allTasks = allTasks.slice(0, options.limit)
  }
  return { tasks: allTasks, total }
}

// --- Batch Operations ---

export interface BatchOperationResult<T> {
  succeeded: T[]
  failed: Array<{ item: any; error: string }>
  total: number
  successCount: number
  failureCount: number
}

export async function batchCreateTickets(
  projectId: number,
  tickets: CreateTicketBody[]
): Promise<BatchOperationResult<Ticket>> {
  const result: BatchOperationResult<Ticket> = {
    succeeded: [],
    failed: [],
    total: tickets.length,
    successCount: 0,
    failureCount: 0
  }

  if (tickets.length > 100) {
    throw new ApiError(400, 'Batch size exceeded. Maximum 100 tickets per batch.', 'BATCH_SIZE_EXCEEDED')
  }

  for (const ticketData of tickets) {
    try {
      const ticket = await createTicket({ ...ticketData, projectId })
      result.succeeded.push(ticket)
      result.successCount++
    } catch (error) {
      result.failed.push({
        item: ticketData,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      result.failureCount++
    }
  }
  return result
}

export async function batchUpdateTickets(
  updates: Array<{ ticketId: number; data: UpdateTicketBody }>
): Promise<BatchOperationResult<Ticket>> {
  const result: BatchOperationResult<Ticket> = {
    succeeded: [],
    failed: [],
    total: updates.length,
    successCount: 0,
    failureCount: 0
  }

  if (updates.length > 100) {
    throw new ApiError(400, 'Batch size exceeded. Maximum 100 tickets per batch.', 'BATCH_SIZE_EXCEEDED')
  }

  for (const { ticketId, data } of updates) {
    try {
      const ticket = await updateTicket(ticketId, data)
      result.succeeded.push(ticket)
      result.successCount++
    } catch (error) {
      result.failed.push({
        item: { ticketId, data },
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      result.failureCount++
    }
  }

  return result
}

export async function batchDeleteTickets(ticketIds: number[]): Promise<BatchOperationResult<number>> {
  const result: BatchOperationResult<number> = {
    succeeded: [],
    failed: [],
    total: ticketIds.length,
    successCount: 0,
    failureCount: 0
  }

  if (ticketIds.length > 100) {
    throw new ApiError(400, 'Batch size exceeded. Maximum 100 tickets per batch.', 'BATCH_SIZE_EXCEEDED')
  }

  for (const ticketId of ticketIds) {
    try {
      await deleteTicket(ticketId)
      result.succeeded.push(ticketId)
      result.successCount++
    } catch (error) {
      result.failed.push({
        item: ticketId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      result.failureCount++
    }
  }
  return result
}

// Task batch operations

export async function batchCreateTasks(
  ticketId: number,
  tasks: CreateTaskBody[]
): Promise<BatchOperationResult<TicketTask>> {
  const result: BatchOperationResult<TicketTask> = {
    succeeded: [],
    failed: [],
    total: tasks.length,
    successCount: 0,
    failureCount: 0
  }

  if (tasks.length > 100) {
    throw new ApiError(400, 'Batch size exceeded. Maximum 100 tasks per batch.', 'BATCH_SIZE_EXCEEDED')
  }

  // Verify ticket exists first
  await getTicketById(ticketId)

  for (const taskData of tasks) {
    try {
      const task = await createTask(ticketId, taskData)
      result.succeeded.push(task)
      result.successCount++
    } catch (error) {
      result.failed.push({
        item: taskData,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      result.failureCount++
    }
  }
  return result
}

export async function batchUpdateTasks(
  updates: Array<{ ticketId: number; taskId: number; data: UpdateTaskBody }>
): Promise<BatchOperationResult<TicketTask>> {
  const result: BatchOperationResult<TicketTask> = {
    succeeded: [],
    failed: [],
    total: updates.length,
    successCount: 0,
    failureCount: 0
  }

  if (updates.length > 100) {
    throw new ApiError(400, 'Batch size exceeded. Maximum 100 tasks per batch.', 'BATCH_SIZE_EXCEEDED')
  }

  for (const { ticketId, taskId, data } of updates) {
    try {
      const task = await updateTask(ticketId, taskId, data)
      result.succeeded.push(task)
      result.successCount++
    } catch (error) {
      result.failed.push({
        item: { ticketId, taskId, data },
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      result.failureCount++
    }
  }
  return result
}

export async function batchDeleteTasks(
  deletes: Array<{ ticketId: number; taskId: number }>
): Promise<BatchOperationResult<number>> {
  const result: BatchOperationResult<number> = {
    succeeded: [],
    failed: [],
    total: deletes.length,
    successCount: 0,
    failureCount: 0
  }

  if (deletes.length > 100) {
    throw new ApiError(400, 'Batch size exceeded. Maximum 100 tasks per batch.', 'BATCH_SIZE_EXCEEDED')
  }

  for (const { ticketId, taskId } of deletes) {
    try {
      await deleteTask(ticketId, taskId)
      result.succeeded.push(taskId)
      result.successCount++
    } catch (error) {
      result.failed.push({
        item: { ticketId, taskId },
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      result.failureCount++
    }
  }
  return result
}

export async function batchMoveTasks(
  moves: Array<{ taskId: number; fromTicketId: number; toTicketId: number }>
): Promise<BatchOperationResult<TicketTask>> {
  const result: BatchOperationResult<TicketTask> = {
    succeeded: [],
    failed: [],
    total: moves.length,
    successCount: 0,
    failureCount: 0
  }

  if (moves.length > 100) {
    throw new ApiError(400, 'Batch size exceeded. Maximum 100 tasks per batch.', 'BATCH_SIZE_EXCEEDED')
  }

  for (const { taskId, fromTicketId, toTicketId } of moves) {
    try {
      // Get the task
      const task = await ticketStorage.getTaskById(taskId)
      if (!task || task.ticketId !== fromTicketId) {
        throw new ApiError(404, `Task ${taskId} not found in ticket ${fromTicketId}`, 'TASK_NOT_FOUND')
      }

      // Verify target ticket exists
      await getTicketById(toTicketId)

      // Get max order index in target ticket
      const targetTasks = await getTasks(toTicketId)
      const maxIndex = targetTasks.length > 0 ? Math.max(...targetTasks.map((t) => t.orderIndex)) : -1

      // Update the task
      const updatedTask: TicketTask = {
        ...task,
        ticketId: toTicketId,
        orderIndex: maxIndex + 1,
        updated: Date.now()
      }
      await ticketStorage.updateTask(taskId, updatedTask)
      result.succeeded.push(updatedTask)
      result.successCount++
    } catch (error) {
      result.failed.push({
        item: { taskId, fromTicketId, toTicketId },
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      result.failureCount++
    }
  }
  return result
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
): Promise<{ updatedTickets: number; updatedTasks: number }> {
  try {
    const tickets = await listTicketsByProject(projectId)
    let updatedTicketCount = 0
    let updatedTaskCount = 0

    for (const ticket of tickets) {
      let ticketUpdated = false
      // Update ticket's suggested files
      if (ticket.suggestedFileIds && ticket.suggestedFileIds.length > 0) {
        const originalLength = ticket.suggestedFileIds.length
        const updatedFileIds = ticket.suggestedFileIds.filter(
          (fileId) => !deletedFileIds.includes(parseInt(fileId, 10))
        )

        if (updatedFileIds.length < originalLength) {
          await updateTicket(ticket.id, { suggestedFileIds: updatedFileIds })
          ticketUpdated = true
          updatedTicketCount++
        }
      }
      // Update tasks' suggested files
      const tasks = await getTasks(ticket.id)
      for (const task of tasks) {
        if (task.suggestedFileIds && task.suggestedFileIds.length > 0) {
          const originalLength = task.suggestedFileIds.length
          const updatedFileIds = task.suggestedFileIds.filter(
            (fileId) => !deletedFileIds.includes(parseInt(fileId, 10))
          )
          if (updatedFileIds.length < originalLength) {
            await updateTask(ticket.id, task.id, { suggestedFileIds: updatedFileIds })
            updatedTaskCount++
          }
        }
      }
    }

    return { updatedTickets: updatedTicketCount, updatedTasks: updatedTaskCount }
  } catch (error) {
    console.error(`Failed to remove deleted file IDs from tickets in project ${projectId}:`, error)
    // Don't throw - this is a cleanup operation that shouldn't fail the main operation
    return { updatedTickets: 0, updatedTasks: 0 }
  }
}

// --- Enhanced Task Operations ---

/**
 * Create a task with full context including file associations
 */
export async function createTaskWithContext(
  ticketId: number,
  content: string,
  options?: {
    description?: string
    suggestedFileIds?: string[]
    estimatedHours?: number
    dependencies?: number[]
    tags?: string[]
  }
): Promise<TicketTask> {
  return createTask(ticketId, {
    content,
    description: options?.description,
    suggestedFileIds: options?.suggestedFileIds,
    estimatedHours: options?.estimatedHours,
    dependencies: options?.dependencies,
    tags: options?.tags
  })
}

/**
 * Get task with resolved file information
 */
export async function getTaskWithContext(
  taskId: number
): Promise<TicketTask & { files?: Array<{ id: string; path: string }> }> {
  const task = await ticketStorage.getTaskById(taskId)
  if (!task) {
    throw new ApiError(404, `Task with ID ${taskId} not found.`, 'TASK_NOT_FOUND')
  }
  // In a real implementation, this would resolve file information
  // For now, return task with basic file info
  return {
    ...task,
    files: task.suggestedFileIds?.map((id) => ({
      id,
      path: `file-${id}` // This would be resolved from file storage
    }))
  }
}

/**
 * AI-powered file suggestion for individual tasks
 */
export async function suggestFilesForTask(taskId: number, context?: string): Promise<string[]> {
  const task = await ticketStorage.getTaskById(taskId)
  if (!task) {
    throw new ApiError(404, `Task with ID ${taskId} not found.`, 'TASK_NOT_FOUND')
  }

  const ticket = await getTicketById(task.ticketId)
  const projectSummary = await getCompactProjectSummary(ticket.projectId)

  const systemPrompt = `You are an expert at analyzing tasks and suggesting relevant files from a project.
Given a task's content and description, suggest the most relevant files that would need to be modified or reviewed.

Return ONLY a JSON array of file IDs, like: ["123", "456", "789"]`

  const userMessage = `Task: ${task.content}
${task.description ? `Description: ${task.description}` : ''}
${context ? `Additional context: ${context}` : ''}

Project context:
${projectSummary}

Suggest the most relevant file IDs for this task.`

  try {
    const result = await generateStructuredData({
      prompt: userMessage,
      systemMessage: systemPrompt,
      schema: z.object({ fileIds: z.array(z.string()) }),
      options: MEDIUM_MODEL_CONFIG
    })
    return result.object.fileIds
  } catch (error) {
    console.error('[TicketService] Error suggesting files for task:', error)
    return []
  }
}

/**
 * Analyze task complexity and provide insights
 */
export async function analyzeTaskComplexity(taskId: number): Promise<{
  complexity: 'low' | 'medium' | 'high'
  estimatedHours: number
  requiredSkills: string[]
  suggestedApproach: string
}> {
  const task = await ticketStorage.getTaskById(taskId)
  if (!task) {
    throw new ApiError(404, `Task with ID ${taskId} not found.`, 'TASK_NOT_FOUND')
  }

  const ticket = await getTicketById(task.ticketId)
  const projectContext = await getCompactProjectSummary(ticket.projectId)

  const systemPrompt = `You are a technical project manager analyzing task complexity.
Analyze the given task and provide insights on its complexity, estimated time, required skills, and suggested approach.

Return a JSON object with:
- complexity: "low", "medium", or "high"
- estimatedHours: number (1-40)
- requiredSkills: array of skills needed
- suggestedApproach: brief description of recommended approach`

  const userMessage = `Task: ${task.content}
${task.description ? `Description: ${task.description}` : ''}

Project context:
${projectContext}`

  try {
    const result = await generateStructuredData({
      prompt: userMessage,
      systemMessage: systemPrompt,
      schema: z.object({
        complexity: z.enum(['low', 'medium', 'high']),
        estimatedHours: z.number().min(1).max(40),
        requiredSkills: z.array(z.string()),
        suggestedApproach: z.string()
      }),
      options: MEDIUM_MODEL_CONFIG
    })
    return result.object
  } catch (error) {
    console.error('[TicketService] Error analyzing task complexity:', error)
    // Return default values
    return {
      complexity: 'medium',
      estimatedHours: 4,
      requiredSkills: ['General development'],
      suggestedApproach: 'Standard implementation approach'
    }
  }
}
