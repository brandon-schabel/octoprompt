// Last 5 changes: Fixed imports to use Promptliano package structure
import { ApiError } from '@promptliano/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { createStandardResponses, standardResponses, successResponse, operationSuccessResponse } from '../utils/route-helpers'
import {
  createTicket,
  getTicketById,
  updateTicket,
  deleteTicket,
  completeTicket,
  linkFilesToTicket,
  suggestTasksForTicket,
  listTicketsByProject,
  listTicketsWithTaskCount,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  autoGenerateTasksFromOverview,
  getTasksForTickets,
  listTicketsWithTasks,
  suggestFilesForTicket
} from '@promptliano/services'
import { ticketsApiValidation, TicketSchema, TicketTaskSchema } from '@promptliano/schemas'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

// Use the proper TicketSchema from @promptliano/schemas instead of redefining

// Use the proper TicketTaskSchema from @promptliano/schemas instead of redefining
const TaskSchema = TicketTaskSchema // Alias for consistency with existing code

const TicketResponseSchema = z
  .object({
    success: z.literal(true),
    data: TicketSchema
  })
  .openapi('TicketResponse')

const TicketListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TicketSchema)
  })
  .openapi('TicketListResponse')

const TaskResponseSchema = z
  .object({
    success: z.literal(true),
    data: TaskSchema
  })
  .openapi('TaskResponse')

const TaskListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TaskSchema)
  })
  .openapi('TaskListResponse')

const LinkedFilesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        ticketId: z.string(),
        fileId: z.string()
      })
    )
  })
  .openapi('LinkedFilesResponse')

const SuggestedTasksResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      suggestedTasks: z.array(z.string())
    })
  })
  .openapi('SuggestedTasksResponse')

const SuggestedFilesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      recommendedFileIds: z.array(z.string()),
      combinedSummaries: z.string().optional(),
      message: z.string().optional()
    })
  })
  .openapi('SuggestedFilesResponse')

const TicketWithTaskCountSchema = z
  .object({
    ticket: TicketSchema,
    taskCount: z.number(),
    completedTaskCount: z.number()
  })
  .openapi('TicketWithTaskCount')

const TicketWithTaskCountListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TicketWithTaskCountSchema)
  })
  .openapi('TicketWithTaskCountListResponse')

const TicketWithTasksSchema = z
  .object({
    ticket: TicketSchema,
    tasks: z.array(TaskSchema)
  })
  .openapi('TicketWithTasks')

const TicketWithTasksListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TicketWithTasksSchema)
  })
  .openapi('TicketWithTasksListResponse')

const BulkTasksResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.record(z.string(), z.array(TaskSchema))
  })
  .openapi('BulkTasksResponse')

// Custom schema for completeTicket response
const CompleteTicketResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      ticket: TicketSchema,
      tasks: z.array(TicketTaskSchema)
    })
  })
  .openapi('CompleteTicketResponse')

const CreateTicketBodySchema = ticketsApiValidation.create.body.openapi('CreateTicketBody')
const UpdateTicketBodySchema = ticketsApiValidation.update.body.openapi('UpdateTicketBody')
const TicketIdParamsSchema = z
  .object({
    ticketId: z.string().openapi({
      param: { name: 'ticketId', in: 'path' },
      description: 'Ticket identifier'
    })
  })
  .openapi('TicketIdParams')

const ProjectIdParamsSchema = z
  .object({
    projectId: z.string().openapi({
      param: { name: 'projectId', in: 'path' },
      description: 'Project identifier'
    })
  })
  .openapi('ProjectIdParams')

const StatusQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .openapi({
        param: { name: 'status', in: 'query' },
        description: 'Filter tickets by status'
      })
  })
  .openapi('StatusQuery')

const LinkFilesBodySchema = ticketsApiValidation.linkFiles.body.openapi('LinkFilesBody')
const SuggestTasksBodySchema = ticketsApiValidation.suggestTasks.body.openapi('SuggestTasksBody')
const SuggestFilesBodySchema = ticketsApiValidation.suggestFiles.body.openapi('SuggestFilesBody')

const CreateTaskBodySchema = ticketsApiValidation.createTask.body.openapi('CreateTaskBody')
const UpdateTaskBodySchema = ticketsApiValidation.updateTask.body.openapi('UpdateTaskBody')
const TaskIdParamsSchema = z
  .object({
    taskId: z.string().openapi({
      param: { name: 'taskId', in: 'path' },
      description: 'Task identifier'
    })
  })
  .openapi('TaskIdParams')

const TicketTaskIdParamsSchema = z
  .object({
    ticketId: TicketIdParamsSchema.shape.ticketId,
    taskId: TaskIdParamsSchema.shape.taskId
  })
  .openapi('TicketTaskIdParams')

const ReorderTasksBodySchema = ticketsApiValidation.reorderTasks.body.openapi('ReorderTasksBody')
const BulkTasksQuerySchema = z
  .object({
    ids: z
      .string()
      .transform((str) => str.split(','))
      .openapi({
        param: { name: 'ids', in: 'query' },
        description: 'Comma-separated list of ticket IDs'
      })
  })
  .openapi('BulkTasksQuery')

const createTicketRoute = createRoute({
  method: 'post',
  path: '/api/tickets',
  tags: ['Tickets'],
  summary: 'Create a new ticket',
  request: {
    body: { content: { 'application/json': { schema: CreateTicketBodySchema } } }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: TicketResponseSchema } },
      description: 'Ticket created successfully'
    },
    ...standardResponses
  }
})

const getTicketRoute = createRoute({
  method: 'get',
  path: '/api/tickets/{ticketId}',
  tags: ['Tickets'],
  summary: 'Get a ticket by ID',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(TicketResponseSchema)
})

const updateTicketRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}',
  tags: ['Tickets'],
  summary: 'Update a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: UpdateTicketBodySchema } } }
  },
  responses: createStandardResponses(TicketResponseSchema)
})

const completeTicketRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/complete',
  tags: ['Tickets'],
  summary: 'Complete a ticket and mark all tasks as done',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(CompleteTicketResponseSchema)
})

const deleteTicketRoute = createRoute({
  method: 'delete',
  path: '/api/tickets/{ticketId}',
  tags: ['Tickets'],
  summary: 'Delete a ticket',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const linkFilesRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/link-files',
  tags: ['Tickets', 'Files'],
  summary: 'Link files to a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: LinkFilesBodySchema } } }
  },
  responses: createStandardResponses(LinkedFilesResponseSchema)
})

const suggestTasksRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/suggest-tasks',
  tags: ['Tickets', 'AI'],
  summary: 'Get AI suggestions for tasks',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: SuggestTasksBodySchema } } }
  },
  responses: createStandardResponses(SuggestedTasksResponseSchema)
})

const suggestFilesRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/suggest-files',
  tags: ['Tickets', 'Files', 'AI'],
  summary: 'Get AI suggestions for relevant files',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: SuggestFilesBodySchema } } }
  },
  responses: createStandardResponses(SuggestedFilesResponseSchema)
})

const listTicketsByProjectRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/tickets',
  tags: ['Projects', 'Tickets'],
  summary: 'List all tickets for a project',
  request: {
    params: ProjectIdParamsSchema,
    query: StatusQuerySchema
  },
  responses: createStandardResponses(TicketListResponseSchema)
})

const listTicketsWithCountRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/tickets-with-count',
  tags: ['Projects', 'Tickets'],
  summary: 'List tickets with task counts',
  request: {
    params: ProjectIdParamsSchema,
    query: StatusQuerySchema
  },
  responses: createStandardResponses(TicketWithTaskCountListResponseSchema)
})

const listTicketsWithTasksRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/tickets-with-tasks',
  tags: ['Projects', 'Tickets', 'Tasks'],
  summary: 'List tickets with their tasks',
  request: {
    params: ProjectIdParamsSchema,
    query: StatusQuerySchema
  },
  responses: createStandardResponses(TicketWithTasksListResponseSchema)
})

const createTaskRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/tasks',
  tags: ['Tickets', 'Tasks'],
  summary: 'Create a new task for a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: CreateTaskBodySchema } } }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: TaskResponseSchema } },
      description: 'Task created successfully'
    },
    ...standardResponses
  }
})

const getTasksRoute = createRoute({
  method: 'get',
  path: '/api/tickets/{ticketId}/tasks',
  tags: ['Tickets', 'Tasks'],
  summary: 'Get all tasks for a ticket',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(TaskListResponseSchema)
})

const updateTaskRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}/tasks/{taskId}',
  tags: ['Tickets', 'Tasks'],
  summary: 'Update a task',
  request: {
    params: TicketTaskIdParamsSchema,
    body: { content: { 'application/json': { schema: UpdateTaskBodySchema } } }
  },
  responses: createStandardResponses(TaskResponseSchema)
})

const deleteTaskRoute = createRoute({
  method: 'delete',
  path: '/api/tickets/{ticketId}/tasks/{taskId}',
  tags: ['Tickets', 'Tasks'],
  summary: 'Delete a task',
  request: {
    params: TicketTaskIdParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const reorderTasksRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}/tasks/reorder',
  tags: ['Tickets', 'Tasks'],
  summary: 'Reorder tasks within a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: ReorderTasksBodySchema } } }
  },
  responses: createStandardResponses(TaskListResponseSchema)
})

const autoGenerateTasksRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/auto-generate-tasks',
  tags: ['Tickets', 'Tasks', 'AI'],
  summary: 'Auto-generate tasks from ticket overview',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(TaskListResponseSchema)
})

const getTasksForTicketsRoute = createRoute({
  method: 'get',
  path: '/api/tickets/bulk-tasks',
  tags: ['Tickets', 'Tasks'],
  summary: 'Get tasks for multiple tickets',
  request: {
    query: BulkTasksQuerySchema
  },
  responses: createStandardResponses(BulkTasksResponseSchema)
})

// Helper function to parse string ID to number
const parseNumericId = (id: string): number => {
  const parsed = parseInt(id, 10)
  if (isNaN(parsed)) {
    throw new ApiError(400, `Invalid ID format: ${id}`, 'INVALID_ID_FORMAT')
  }
  return parsed
}

const formatTicketData = (ticket: any): z.infer<typeof TicketSchema> => {
  // The ticket data from service already matches the schema format
  // Just ensure all fields are present and valid
  return TicketSchema.parse(ticket)
}

const formatTaskData = (task: any): z.infer<typeof TaskSchema> => {
  // The task data from service already matches the schema format
  // Just ensure all fields are present and valid
  return TaskSchema.parse(task)
}

export const ticketRoutes = new OpenAPIHono()

  .openapi(createTicketRoute, async (c) => {
    const body = c.req.valid('json')
    const ticket = await createTicket(body)
    const formattedTicket = formatTicketData(ticket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, data: formattedTicket }
    return c.json(payload, 201)
  })
  .openapi(getTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const ticket = await getTicketById(parseNumericId(ticketId))
    const formattedTicket = formatTicketData(ticket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, data: formattedTicket }
    return c.json(payload, 200)
  })
  .openapi(updateTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedTicket = await updateTicket(parseNumericId(ticketId), body)
    const formattedTicket = formatTicketData(updatedTicket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, data: formattedTicket }
    return c.json(payload, 200)
  })
  .openapi(completeTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const result = await completeTicket(parseNumericId(ticketId))

    // Format the ticket and tasks
    const formattedTicket = formatTicketData(result.ticket)
    const formattedTasks = result.tasks.map(formatTaskData)

    const payload = {
      success: true as const,
      data: {
        ticket: formattedTicket,
        tasks: formattedTasks
      }
    }
    return c.json(payload, 200)
  })
  .openapi(deleteTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    await deleteTicket(parseNumericId(ticketId))
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Ticket deleted successfully'
    }
    return c.json(payload, 200)
  })

  .openapi(linkFilesRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { fileIds } = c.req.valid('json')
    const result = await linkFilesToTicket(parseNumericId(ticketId), fileIds)
    const payload: z.infer<typeof LinkedFilesResponseSchema> = { success: true, data: result }
    return c.json(payload, 200)
  })
  .openapi(suggestFilesRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { extraUserInput } = c.req.valid('json')
    const result = await suggestFilesForTicket(parseNumericId(ticketId), { extraUserInput })

    const payload: z.infer<typeof SuggestedFilesResponseSchema> = {
      success: true,
      data: {
        recommendedFileIds: result.recommendedFileIds || [],
        combinedSummaries: result.combinedSummaries,
        message: result.message
      }
    }
    return c.json(payload, 200)
  })

  .openapi(suggestTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { userContext } = c.req.valid('json')
    const tasks = await suggestTasksForTicket(parseNumericId(ticketId), userContext)
    const payload: z.infer<typeof SuggestedTasksResponseSchema> = { success: true, data: { suggestedTasks: tasks } }
    return c.json(payload, 200)
  })

  .openapi(listTicketsByProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const tickets = await listTicketsByProject(parseNumericId(projectId), query?.status)
    const formattedTickets = tickets.map(formatTicketData)
    const payload: z.infer<typeof TicketListResponseSchema> = {
      success: true,
      data: formattedTickets
    }
    return c.json(payload, 200)
  })
  .openapi(listTicketsWithCountRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const statusFilter = query?.status === 'all' ? undefined : query?.status

    const results = await listTicketsWithTaskCount(parseNumericId(projectId), statusFilter)

    const formatted: z.infer<typeof TicketWithTaskCountSchema>[] = results.map((item: any) => {
      const { taskCount, completedTaskCount, ...ticketData } = item
      return {
        ticket: formatTicketData(ticketData),
        taskCount: Number(taskCount || 0),
        completedTaskCount: Number(completedTaskCount || 0)
      }
    })

    const payload: z.infer<typeof TicketWithTaskCountListResponseSchema> = {
      success: true,
      data: formatted
    }
    return c.json(payload, 200)
  })
  .openapi(listTicketsWithTasksRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const statusFilter = query?.status === 'all' ? undefined : query?.status

    const ticketsWithTasks = await listTicketsWithTasks(parseNumericId(projectId), statusFilter)

    const formatted: z.infer<typeof TicketWithTasksSchema>[] = ticketsWithTasks.map((item: any) => ({
      ticket: formatTicketData(item),
      tasks: (item.tasks || []).map(formatTaskData)
    }))

    const payload: z.infer<typeof TicketWithTasksListResponseSchema> = {
      success: true,
      data: formatted
    }
    return c.json(payload, 200)
  })

  .openapi(createTaskRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const body = c.req.valid('json')
    const task = await createTask(parseNumericId(ticketId), body)
    const formattedTask = formatTaskData(task)
    const payload: z.infer<typeof TaskResponseSchema> = { success: true, data: formattedTask }
    return c.json(payload, 201)
  })
  .openapi(getTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const tasks = await getTasks(parseNumericId(ticketId))
    const formattedTasks = tasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, data: formattedTasks }
    return c.json(payload, 200)
  })
  .openapi(updateTaskRoute, async (c) => {
    const { ticketId, taskId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedTask = await updateTask(parseNumericId(ticketId), parseNumericId(taskId), body)
    const formattedTask = formatTaskData(updatedTask)
    const payload: z.infer<typeof TaskResponseSchema> = { success: true, data: formattedTask }
    return c.json(payload, 200)
  })
  .openapi(deleteTaskRoute, async (c) => {
    const { ticketId, taskId } = c.req.valid('param')
    await deleteTask(parseNumericId(ticketId), parseNumericId(taskId))
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Task deleted successfully'
    }
    return c.json(payload, 200)
  })
  .openapi(reorderTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { tasks } = c.req.valid('json')
    // Convert string taskIds to numbers in the tasks array
    const numericTasks = tasks.map((task: any) => ({
      taskId: parseNumericId(task.taskId.toString()),
      orderIndex: task.orderIndex
    }))
    const updatedTasks = await reorderTasks(parseNumericId(ticketId), numericTasks)
    const formattedTasks = updatedTasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, data: formattedTasks }
    return c.json(payload, 200)
  })
  .openapi(autoGenerateTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const newTasks = await autoGenerateTasksFromOverview(parseNumericId(ticketId))
    const formattedTasks = newTasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, data: formattedTasks }
    return c.json(payload, 200)
  })
  .openapi(getTasksForTicketsRoute, async (c) => {
    const { ids } = c.req.valid('query')
    const numericIds = ids.map((id: string) => parseNumericId(id))
    const tasksByTicketId = await getTasksForTickets(numericIds)

    const formattedTasks: Record<string, z.infer<typeof TaskSchema>[]> = {}
    for (const [ticketId, tasks] of Object.entries(tasksByTicketId)) {
      formattedTasks[ticketId] = (tasks as any[]).map(formatTaskData)
    }

    const payload: z.infer<typeof BulkTasksResponseSchema> = { success: true, data: formattedTasks }
    return c.json(payload, 200)
  })

export type TicketRouteTypes = typeof ticketRoutes
