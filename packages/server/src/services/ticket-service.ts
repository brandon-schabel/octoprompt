import { ApiError, MEDIUM_MODEL_CONFIG } from 'shared'
import { getFullProjectSummary } from '@/utils/get-full-project-summary'
import { z, ZodError } from 'zod'
import {
  CreateTicketBody,
  UpdateTicketBody,
  TicketReadSchema, // Will be used by storage directly
  TicketTaskReadSchema, // Will be used by storage directly
  TicketFileReadSchema, // Will be used by storage directly
  type Ticket,
  type TicketTask,
  type TicketFile,
  TaskSuggestions,
  TaskSuggestionsZodSchema
} from 'shared/src/schemas/ticket.schemas'
// Import projectStorage to check for file existence
import { projectStorage } from '@/utils/storage/project-storage'
import { ticketStorage, type TicketsStorage, type TicketTasksStorage, type TicketFilesStorage } from '@/utils/storage/ticket-storage'
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

// Helper to ensure data read from JSON (potentially with string dates) conforms to the schema with Date objects
// Zod's z.date() should handle ISO string parsing automatically, so direct mapping might be fine.
// These map functions are essentially for type safety and consistency if any transformation were needed.
function mapTicket(data: any): Ticket {
  const preprocessedData = {
    ...data,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
  };
  const parsed = TicketReadSchema.parse(preprocessedData)
  return parsed
}

function mapTicketTask(data: any): TicketTask {
  const preprocessedData = {
    ...data,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
  };
  const parsed = TicketTaskReadSchema.parse(preprocessedData)
  return parsed
}

function mapTicketFile(data: any): TicketFile {
  return TicketFileReadSchema.parse(data)
}


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
  const ticketId = ticketStorage.generateId('tkt')
  const now = new Date()

  const newTicketData: Ticket = {
    id: ticketId,
    projectId: data.projectId,
    title: data.title,
    overview: data.overview ?? '',
    status: data.status ?? 'open',
    priority: data.priority ?? 'normal',
    suggestedFileIds: JSON.stringify(data.suggestedFileIds || []),
    createdAt: now,
    updatedAt: now
  }

  try {
    // Validate with TicketReadSchema as it represents the full ticket structure with Date objects
    const validatedTicket = TicketReadSchema.parse(newTicketData)

    const allTickets = await ticketStorage.readTickets()
    if (allTickets[ticketId]) {
      // Extremely unlikely with UUIDs but good to check
      throw new ApiError(509, `Ticket ID conflict for ${ticketId}`, 'TICKET_ID_CONFLICT');
    }

    allTickets[ticketId] = validatedTicket
    await ticketStorage.writeTickets(allTickets)
    // Initialize empty tasks and files for the new ticket
    await ticketStorage.writeTicketTasks(ticketId, {})
    await ticketStorage.writeTicketFiles(ticketId, [])

    return mapTicket(validatedTicket) // Ensure Date objects are correctly typed
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Validation failed for new ticket data: ${error.message}`, error.flatten().fieldErrors)
      throw new ApiError(500, `Internal validation error creating ticket.`, 'TICKET_VALIDATION_ERROR', error.flatten().fieldErrors)
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(500, `Failed to create ticket.`, 'CREATE_TICKET_FAILED', { originalError: error })
  }
}

export async function getTicketById(ticketId: string): Promise<Ticket> {
  const allTickets = await ticketStorage.readTickets()
  const ticketData = allTickets[ticketId]
  if (!ticketData) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found.`, 'TICKET_NOT_FOUND')
  }
  return mapTicket(ticketData)
}

async function updateTicketTimestamp(ticketId: string, allTickets: TicketsStorage): Promise<TicketsStorage> {
  if (allTickets[ticketId]) {
    allTickets[ticketId] = {
      ...allTickets[ticketId],
      updatedAt: new Date() // Store as Date object; writeTickets (mock) will stringify
    };
    // The TicketReadSchema.parse call here was removed for simplification.
    // Full validation occurs in the main service functions (e.g., updateTicket) before writing.
  }
  return allTickets;
}


export async function listTicketsByProject(projectId: string, statusFilter?: string): Promise<Ticket[]> {
  const allTickets = await ticketStorage.readTickets()
  let tickets = Object.values(allTickets).filter(t => t.projectId === projectId)

  if (statusFilter) {
    tickets = tickets.filter(t => t.status === statusFilter)
  }

  tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return tickets.map(mapTicket)
}

export async function updateTicket(ticketId: string, data: UpdateTicketBody): Promise<Ticket> {
  let allTickets = await ticketStorage.readTickets()
  const existingTicket = allTickets[ticketId]

  if (!existingTicket) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found for update.`, 'TICKET_NOT_FOUND')
  }

  const updatedData = { ...existingTicket }

  if (data.title !== undefined) updatedData.title = data.title
  if (data.overview !== undefined) updatedData.overview = data.overview
  if (data.status !== undefined) updatedData.status = data.status
  if (data.priority !== undefined) updatedData.priority = data.priority
  if (data.suggestedFileIds !== undefined) {
    // Validate that these files exist in the project
    const projectFiles = await projectStorage.readProjectFiles(existingTicket.projectId)
    for (const fileId of data.suggestedFileIds) {
      if (!projectFiles[fileId]) {
        throw new ApiError(
          400,
          `File with ID ${fileId} not found in project ${existingTicket.projectId}.`,
          'FILE_NOT_FOUND_IN_PROJECT'
        )
      }
    }
    updatedData.suggestedFileIds = JSON.stringify(data.suggestedFileIds)
  }
  updatedData.updatedAt = new Date()

  try {
    // Ensure date fields from existingTicket are Date objects before validation
    const dataToValidate = {
      ...updatedData,
      createdAt: new Date(existingTicket.createdAt), // existingTicket.createdAt would be a string here
    };
    const validatedTicket = TicketReadSchema.parse(dataToValidate)
    allTickets[ticketId] = validatedTicket
    await ticketStorage.writeTickets(allTickets)
    return mapTicket(validatedTicket)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(500, `Validation failed updating ticket ${ticketId}.`, 'TICKET_VALIDATION_ERROR', error.flatten().fieldErrors)
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(500, `Failed to update ticket ${ticketId}.`, 'UPDATE_TICKET_FAILED', { originalError: error })
  }
}

export async function deleteTicket(ticketId: string): Promise<void> {
  const allTickets = await ticketStorage.readTickets()
  if (!allTickets[ticketId]) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found for deletion.`, 'TICKET_NOT_FOUND')
  }

  delete allTickets[ticketId]
  await ticketStorage.writeTickets(allTickets)
  await ticketStorage.deleteTicketData(ticketId) // Delete associated tasks and files
}

export async function linkFilesToTicket(ticketId: string, fileIds: string[]): Promise<TicketFile[]> {
  const ticket = await getTicketById(ticketId) // Ensures ticket exists

  // Validate that files exist in the project
  const projectFilesData = await projectStorage.readProjectFiles(ticket.projectId);
  for (const fileId of fileIds) {
    if (!projectFilesData[fileId]) {
      throw new ApiError(
        400,
        `File with ID ${fileId} not found in project ${ticket.projectId} for linking.`,
        'FILE_NOT_FOUND_IN_PROJECT'
      );
    }
  }

  let ticketLinks = await ticketStorage.readTicketFiles(ticketId)
  const existingFileIds = new Set(ticketLinks.map(link => link.fileId))

  let newLinksMade = false;
  for (const fileId of fileIds) {
    if (!existingFileIds.has(fileId)) {
      ticketLinks.push({ ticketId, fileId })
      newLinksMade = true;
    }
  }

  if (newLinksMade) {
    await ticketStorage.writeTicketFiles(ticketId, ticketLinks)
    let allTickets = await ticketStorage.readTickets();
    allTickets = await updateTicketTimestamp(ticketId, allTickets);
    await ticketStorage.writeTickets(allTickets);
  }
  return ticketLinks.map(mapTicketFile)
}

export async function getTicketFiles(ticketId: string): Promise<TicketFile[]> {
  // Ensure ticket exists, implicitly
  await getTicketById(ticketId);
  const ticketLinks = await ticketStorage.readTicketFiles(ticketId)
  return ticketLinks.map(mapTicketFile)
}

export async function suggestTasksForTicket(ticketId: string, userContext?: string): Promise<string[]> {
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

export async function getTicketsWithFiles(projectId: string): Promise<(Ticket & { fileIds: string[] })[]> {
  const projectTickets = await listTicketsByProject(projectId)
  if (projectTickets.length === 0) return []

  const results: (Ticket & { fileIds: string[] })[] = []
  for (const ticket of projectTickets) {
    const links = await ticketStorage.readTicketFiles(ticket.id)
    results.push({
      ...mapTicket(ticket), // Ensure Date objects are correct
      fileIds: links.map(link => link.fileId)
    })
  }
  return results
}

export async function createTask(ticketId: string, content: string): Promise<TicketTask> {
  await getTicketById(ticketId) // Ensure ticket exists

  const taskId = ticketStorage.generateId('task')
  const now = new Date()

  let ticketTasks = await ticketStorage.readTicketTasks(ticketId)
  const orderIndex = Object.keys(ticketTasks).length > 0
    ? Math.max(...Object.values(ticketTasks).map(t => t.orderIndex)) + 1
    : 1;

  const newTaskData: TicketTask = {
    id: taskId,
    ticketId: ticketId,
    content: content,
    done: false,
    orderIndex: orderIndex,
    createdAt: now,
    updatedAt: now
  }

  try {
    const validatedTask = TicketTaskReadSchema.parse(newTaskData)
    if (ticketTasks[taskId]) {
      throw new ApiError(509, `Task ID conflict for ${taskId}`, 'TASK_ID_CONFLICT');
    }
    ticketTasks[taskId] = validatedTask
    await ticketStorage.writeTicketTasks(ticketId, ticketTasks)

    let allTickets = await ticketStorage.readTickets();
    allTickets = await updateTicketTimestamp(ticketId, allTickets);
    await ticketStorage.writeTickets(allTickets);

    return mapTicketTask(validatedTask)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(500, `Validation failed creating task for ticket ${ticketId}.`, 'TASK_VALIDATION_ERROR', error.flatten().fieldErrors)
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(500, `Failed to create task for ticket ${ticketId}.`, 'CREATE_TASK_FAILED', { originalError: error })
  }
}

export async function getTasks(ticketId: string): Promise<TicketTask[]> {
  await getTicketById(ticketId); // Ensure ticket exists
  const ticketTasksData = await ticketStorage.readTicketTasks(ticketId)
  const tasks = Object.values(ticketTasksData)
  tasks.sort((a, b) => a.orderIndex - b.orderIndex)
  return tasks.map(mapTicketTask)
}


export async function deleteTask(ticketId: string, taskId: string): Promise<void> {
  await getTicketById(ticketId) // Ensure ticket exists

  const ticketTasks = await ticketStorage.readTicketTasks(ticketId)
  if (!ticketTasks[taskId]) {
    throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}.`, 'TASK_NOT_FOUND_FOR_TICKET')
  }

  delete ticketTasks[taskId]
  await ticketStorage.writeTicketTasks(ticketId, ticketTasks)

  let allTickets = await ticketStorage.readTickets();
  allTickets = await updateTicketTimestamp(ticketId, allTickets);
  await ticketStorage.writeTickets(allTickets);
}

export async function reorderTasks(
  ticketId: string,
  taskReorders: Array<{ taskId: string; orderIndex: number }>
): Promise<TicketTask[]> {
  await getTicketById(ticketId) // Ensure ticket exists

  const ticketTasks = await ticketStorage.readTicketTasks(ticketId)
  let changed = false
  for (const { taskId, orderIndex } of taskReorders) {
    if (ticketTasks[taskId]) {
      if (ticketTasks[taskId].orderIndex !== orderIndex) {
        ticketTasks[taskId].orderIndex = orderIndex
        ticketTasks[taskId].updatedAt = new Date()
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
    let allTickets = await ticketStorage.readTickets();
    allTickets = await updateTicketTimestamp(ticketId, allTickets);
    await ticketStorage.writeTickets(allTickets);
  }

  const tasksArray = Object.values(ticketTasks).sort((a, b) => a.orderIndex - b.orderIndex);
  return tasksArray.map(mapTicketTask)
}


export async function autoGenerateTasksFromOverview(ticketId: string): Promise<TicketTask[]> {
  const ticket = await getTicketById(ticketId)

  const titles = await suggestTasksForTicket(ticketId, ticket.overview ?? '')

  const insertedTasks: TicketTask[] = []
  if (titles.length > 0) {
    let ticketTasks = await ticketStorage.readTicketTasks(ticketId)
    let currentMaxOrder = Object.keys(ticketTasks).length > 0
      ? Math.max(...Object.values(ticketTasks).map(t => t.orderIndex))
      : 0;
    const now = new Date();

    for (const content of titles) {
      currentMaxOrder++;
      const taskId = ticketStorage.generateId('task');
      const newTaskData: TicketTask = {
        id: taskId,
        ticketId: ticketId,
        content: content,
        done: false,
        orderIndex: currentMaxOrder,
        createdAt: now,
        updatedAt: now
      };
      try {
        const validatedTask = TicketTaskReadSchema.parse(newTaskData);
        ticketTasks[taskId] = validatedTask;
        insertedTasks.push(mapTicketTask(validatedTask));
      } catch (error) {
        if (error instanceof ZodError) {
          console.error(`Validation failed for auto-generated task '${content}': ${error.message}`, error.flatten().fieldErrors);
          // Skip this task or throw? For now, skip.
        } else {
          throw error;
        }
      }
    }
    if (insertedTasks.length > 0) {
      await ticketStorage.writeTicketTasks(ticketId, ticketTasks);
      let allTickets = await ticketStorage.readTickets();
      allTickets = await updateTicketTimestamp(ticketId, allTickets);
      await ticketStorage.writeTickets(allTickets);
    }
  }
  return insertedTasks;
}

export async function listTicketsWithTaskCount(
  projectId: string,
  statusFilter?: string
): Promise<Array<Ticket & { taskCount: number; completedTaskCount: number }>> {
  const tickets = await listTicketsByProject(projectId, statusFilter)
  const results: Array<Ticket & { taskCount: number; completedTaskCount: number }> = []

  for (const ticket of tickets) {
    const tasksData = await ticketStorage.readTicketTasks(ticket.id)
    const tasksArray = Object.values(tasksData)
    results.push({
      ...mapTicket(ticket),
      taskCount: tasksArray.length,
      completedTaskCount: tasksArray.filter(t => t.done).length
    })
  }
  return results
}

export async function getTasksForTickets(ticketIds: string[]): Promise<Record<string, TicketTask[]>> {
  if (!ticketIds.length) return {}

  const tasksByTicket: Record<string, TicketTask[]> = {}
  const allTickets = await ticketStorage.readTickets(); // Fetch all tickets once

  for (const ticketId of ticketIds) {
    if (allTickets[ticketId]) { // Only process if the ticket actually exists
      const tasksData = await ticketStorage.readTicketTasks(ticketId)
      const tasksArray = Object.values(tasksData).sort((a, b) => a.orderIndex - b.orderIndex)
      tasksByTicket[ticketId] = tasksArray.map(mapTicketTask)
    } else {
      // Optionally log or handle cases where a ticketId is provided but doesn't exist
      // console.warn(`[getTasksForTickets] Ticket with ID ${ticketId} not found.`);
    }
  }
  return tasksByTicket
}


export async function listTicketsWithTasks(
  projectId: string,
  statusFilter?: string
): Promise<Array<Ticket & { tasks: TicketTask[] }>> {
  const baseTickets = await listTicketsByProject(projectId, statusFilter)
  if (!baseTickets.length) {
    return []
  }
  const ticketIds = baseTickets.map((t: any) => t.id)
  const tasksByTicket = await getTasksForTickets(ticketIds)
  return baseTickets.map((ticket: any) => ({
    ...mapTicket(ticket),
    tasks: tasksByTicket[ticket.id] || []
  }))
}

export async function getTicketWithSuggestedFiles(
  ticketId: string
): Promise<(Ticket & { parsedSuggestedFileIds: string[] }) | null> {
  const ticket = await getTicketById(ticketId)
  if (!ticket) return null

  let parsedFileIds: string[] = []
  try {
    if (ticket.suggestedFileIds) {
      const parsed = JSON.parse(ticket.suggestedFileIds)
      if (Array.isArray(parsed)) {
        parsedFileIds = parsed.filter(id => typeof id === 'string');
      }
    }
  } catch (e) {
    console.warn(`Could not parse suggestedFileIds for ticket ${ticketId}: ${ticket.suggestedFileIds}`)
    parsedFileIds = [] // Default to empty array on error
  }

  return {
    ...mapTicket(ticket),
    parsedSuggestedFileIds: parsedFileIds
  }
}

export async function updateTask(
  ticketId: string,
  taskId: string,
  updates: { content?: string; done?: boolean }
): Promise<TicketTask> {
  await getTicketById(ticketId) // Ensure ticket exists

  const ticketTasks = await ticketStorage.readTicketTasks(ticketId)
  const existingTask = ticketTasks[taskId]

  if (!existingTask) {
    throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}.`, 'TASK_NOT_FOUND_FOR_TICKET')
  }

  let changed = false
  if (updates.content !== undefined && existingTask.content !== updates.content) {
    existingTask.content = updates.content
    changed = true
  }
  if (updates.done !== undefined && existingTask.done !== updates.done) {
    existingTask.done = updates.done
    changed = true
  }

  if (changed) {
    existingTask.updatedAt = new Date()
    try {
      // Ensure date fields from existingTask are Date objects before validation
      const taskToValidate = {
        ...existingTask,
        createdAt: new Date(existingTask.createdAt), // existingTask.createdAt would be string here
        // updatedAt is already being set to a new Date() above if changed is true
      };
      TicketTaskReadSchema.parse(taskToValidate); // Re-validate before writing
      ticketTasks[taskId] = taskToValidate; // ensure the map has the potentially re-validated object
      await ticketStorage.writeTicketTasks(ticketId, ticketTasks)
      let allTickets = await ticketStorage.readTickets();
      allTickets = await updateTicketTimestamp(ticketId, allTickets);
      await ticketStorage.writeTickets(allTickets);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ApiError(500, `Validation failed updating task ${taskId}.`, 'TASK_VALIDATION_ERROR', error.flatten().fieldErrors)
      }
      throw error;
    }
  }
  return mapTicketTask(existingTask)
}

export async function suggestFilesForTicket(
  ticketId: string,
  options: { extraUserInput?: string } // extraUserInput not used in this version
): Promise<{ recommendedFileIds: string[]; combinedSummaries?: string; message?: string }> {
  const ticket = await getTicketById(ticketId)

  try {
    // This simplified version will just grab some files from the project.
    // A more advanced version would use AI and file summaries.
    const projectFilesMap = await projectStorage.readProjectFiles(ticket.projectId)
    const projectFileIds = Object.keys(projectFilesMap)

    if (projectFileIds.length === 0) {
      console.warn(
        `[TicketService] suggestFilesForTicket: No project files found for project ${ticket.projectId}.`
      )
      return {
        recommendedFileIds: [],
        message: 'No files found in the project to suggest from.'
      }
    }

    // Simple logic: recommend first 5 files or fewer if not enough.
    // A real implementation would use AI, ticket content, file summaries, etc.
    const recommendedFileIds = projectFileIds.slice(0, Math.min(5, projectFileIds.length))

    // Placeholder for combinedSummaries as it's not implemented with actual summaries here.
    const combinedSummaries = `Placeholder summary for files in project ${ticket.projectId} related to ticket: ${ticket.title}`;

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