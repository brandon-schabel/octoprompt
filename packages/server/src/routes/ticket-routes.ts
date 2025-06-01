import { ApiError } from '@octoprompt/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@octoprompt/schemas'
import {
  createTicket,
  getTicketById,
  updateTicket,
  deleteTicket,
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
} from '../services/ticket-service'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  BulkTasksResponseSchema,
  createTaskSchema,
  CreateTicketBodySchema,
  createTicketSchema,
  LinkedFilesResponseSchema,
  linkFilesSchema,
  ProjectIdParamsSchema,
  reorderTasksSchema,
  StatusQuerySchema,
  SuggestedFilesResponseSchema,
  SuggestedTasksResponseSchema,
  suggestTasksSchema,
  TaskListResponseSchema,
  TaskResponseSchema,
  TaskSchema,
  TicketIdParamsSchema,
  TaskIdParamsSchema,
  TicketTaskIdParamsSchema,
  TicketListResponseSchema,
  TicketResponseSchema,
  TicketSchema,
  TicketWithTaskCountListResponseSchema,
  TicketWithTaskCountSchema,
  TicketWithTasksListResponseSchema,
  TicketWithTasksSchema,
  updateTaskSchema,
  UpdateTicketBodySchema,
  updateTicketSchema
} from '@octoprompt/schemas'
import { normalizeToUnixMs } from '@/utils/parse-timestamp'

const LinkFilesBodySchema = linkFilesSchema
const SuggestTasksBodySchema = suggestTasksSchema
const SuggestFilesBodySchema = z
  .object({
    extraUserInput: z.string().optional().openapi({
      description: 'Optional additional context for file suggestions'
    })
  })
  .openapi('SuggestFilesBody')

const CreateTaskBodySchema = createTaskSchema
const UpdateTaskBodySchema = updateTaskSchema

// FIXED: Use shared parameter schemas instead of local definitions
const ReorderTasksBodySchema = reorderTasksSchema
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
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

// IMPORTANT: Put specific routes BEFORE parameterized routes to avoid conflicts
const getTasksForTicketsRoute = createRoute({
  method: 'get',
  path: '/api/tickets/bulk-tasks',
  tags: ['Tickets', 'Tasks'],
  summary: 'Get tasks for multiple tickets',
  request: {
    query: BulkTasksQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BulkTasksResponseSchema } },
      description: 'Tasks retrieved successfully'
    },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
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
  responses: {
    200: {
      content: { 'application/json': { schema: TicketResponseSchema } },
      description: 'Ticket retrieved successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: TicketResponseSchema } },
      description: 'Ticket updated successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const deleteTicketRoute = createRoute({
  method: 'delete',
  path: '/api/tickets/{ticketId}',
  tags: ['Tickets'],
  summary: 'Delete a ticket',
  request: {
    params: TicketIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Ticket deleted successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: LinkedFilesResponseSchema } },
      description: 'Files linked successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: SuggestedTasksResponseSchema } },
      description: 'Tasks suggested successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: SuggestedFilesResponseSchema } },
      description: 'Files suggested successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: TicketListResponseSchema } },
      description: 'Tickets listed successfully'
    },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: TicketWithTaskCountListResponseSchema } },
      description: 'Tickets with counts listed successfully'
    },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: TicketWithTasksListResponseSchema } },
      description: 'Tickets with tasks listed successfully'
    },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
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
    201: { content: { 'application/json': { schema: TaskResponseSchema } }, description: 'Task created successfully' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
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
  responses: {
    200: {
      content: { 'application/json': { schema: TaskListResponseSchema } },
      description: 'Tasks retrieved successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

// CRITICAL: Reorder route must come BEFORE parameterized {taskId} routes
const reorderTasksRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}/tasks/reorder',
  tags: ['Tickets', 'Tasks'],
  summary: 'Reorder tasks within a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: ReorderTasksBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: TaskListResponseSchema } },
      description: 'Tasks reordered successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const autoGenerateTasksRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/auto-generate-tasks',
  tags: ['Tickets', 'Tasks', 'AI'],
  summary: 'Auto-generate tasks from ticket overview',
  request: {
    params: TicketIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: TaskListResponseSchema } },
      description: 'Tasks generated successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

// FIXED: Use proper parameter schema with both ticketId and taskId
const updateTaskRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}/tasks/{taskId}',
  tags: ['Tickets', 'Tasks'],
  summary: 'Update a task',
  request: {
    params: TicketTaskIdParamsSchema, // FIXED: Use the combined schema
    body: { content: { 'application/json': { schema: UpdateTaskBodySchema } } }
  },
  responses: {
    200: { content: { 'application/json': { schema: TaskResponseSchema } }, description: 'Task updated successfully' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Task not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

// FIXED: Use proper parameter schema with both ticketId and taskId
const deleteTaskRoute = createRoute({
  method: 'delete',
  path: '/api/tickets/{ticketId}/tasks/{taskId}',
  tags: ['Tickets', 'Tasks'],
  summary: 'Delete a task',
  request: {
    params: TicketTaskIdParamsSchema // FIXED: Use the combined schema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Task deleted successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Task not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const formatTicketData = (ticket: any): z.infer<typeof TicketSchema> => {
  const dataToValidate = {
    ...ticket,
    created: normalizeToUnixMs(ticket.created),
    updated: normalizeToUnixMs(ticket.updated),
  }
  return TicketSchema.parse(dataToValidate)
}

const formatTaskData = (task: any): z.infer<typeof TaskSchema> => {
  const dataToValidate = {
    ...task,
    done: Boolean(task.done),
    created: normalizeToUnixMs(task.created),
    updated: normalizeToUnixMs(task.updated),
    orderIndex: Number(task.orderIndex)
  }
  return TaskSchema.parse(dataToValidate)
}

export const ticketRoutes = new OpenAPIHono()
  // Add the missing createTicketRoute first
  .openapi(createTicketRoute, async (c) => {
    const body = c.req.valid('json')
    const newTicket = await createTicket(body)
    const formattedTicket = formatTicketData(newTicket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket }
    return c.json(payload, 201)
  })

  // CRITICAL: Handle bulk-tasks BEFORE the generic {ticketId} route to avoid route conflicts
  .openapi(getTasksForTicketsRoute, async (c) => {
    const { ids } = c.req.valid('query')
    const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    const tasksByTicketId = await getTasksForTickets(numericIds)

    const formattedTasks: Record<string, z.infer<typeof TaskSchema>[]> = {}
    for (const [ticketId, tasks] of Object.entries(tasksByTicketId)) {
      formattedTasks[ticketId] = tasks.map(formatTaskData)
    }

    const payload: z.infer<typeof BulkTasksResponseSchema> = { success: true, tasks: formattedTasks }
    return c.json(payload, 200)
  })
  .openapi(getTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const ticket = await getTicketById(ticketId)
    const formattedTicket = formatTicketData(ticket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket }
    return c.json(payload, 200)
  })
  .openapi(updateTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedTicket = await updateTicket(ticketId, body)
    const formattedTicket = formatTicketData(updatedTicket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket }
    return c.json(payload, 200)
  })
  .openapi(deleteTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    await deleteTicket(ticketId)
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Ticket deleted successfully'
    }
    return c.json(payload, 200)
  })

  .openapi(linkFilesRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { fileIds } = c.req.valid('json')
    const result = await linkFilesToTicket(ticketId, fileIds)
    const payload: z.infer<typeof LinkedFilesResponseSchema> = { success: true, linkedFiles: result }
    return c.json(payload, 200)
  })
  .openapi(suggestFilesRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { extraUserInput } = c.req.valid('json')
    const result = await suggestFilesForTicket(ticketId, { extraUserInput })

    const payload: z.infer<typeof SuggestedFilesResponseSchema> = {
      success: true,
      recommendedFileIds: result.recommendedFileIds || [],
      combinedSummaries: result.combinedSummaries,
      message: result.message
    }
    return c.json(payload, 200)
  })

  .openapi(suggestTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { userContext } = c.req.valid('json')
    const tasks = await suggestTasksForTicket(ticketId, userContext)
    const payload: z.infer<typeof SuggestedTasksResponseSchema> = { success: true, suggestedTasks: tasks }
    return c.json(payload, 200)
  })

  .openapi(listTicketsByProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const tickets = await listTicketsByProject(projectId, query?.status)
    const formattedTickets = tickets.map(formatTicketData)
    const payload: z.infer<typeof TicketListResponseSchema> = {
      success: true,
      tickets: formattedTickets
    }
    return c.json(payload, 200)
  })
  .openapi(listTicketsWithCountRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const statusFilter = query?.status === 'all' ? undefined : query?.status

    const results = await listTicketsWithTaskCount(projectId, statusFilter)

    const formatted: z.infer<typeof TicketWithTaskCountSchema>[] = results.map((item) => {
      const { taskCount, completedTaskCount, ...ticketData } = item
      return {
        ticket: formatTicketData(ticketData),
        taskCount: Number(taskCount || 0),
        completedTaskCount: Number(completedTaskCount || 0)
      }
    })

    const payload: z.infer<typeof TicketWithTaskCountListResponseSchema> = {
      success: true,
      ticketsWithCount: formatted
    }
    return c.json(payload, 200)
  })
  .openapi(listTicketsWithTasksRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const statusFilter = query?.status === 'all' ? undefined : query?.status

    const ticketsWithTasks = await listTicketsWithTasks(projectId, statusFilter)

    const formatted: z.infer<typeof TicketWithTasksSchema>[] = ticketsWithTasks.map((item) => ({
      ticket: formatTicketData(item),
      tasks: (item.tasks || []).map(formatTaskData)
    }))

    const payload: z.infer<typeof TicketWithTasksListResponseSchema> = {
      success: true,
      ticketsWithTasks: formatted
    }
    return c.json(payload, 200)
  })

  .openapi(createTaskRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { content } = c.req.valid('json')
    const task = await createTask(ticketId, content)
    const formattedTask = formatTaskData(task)
    const payload: z.infer<typeof TaskResponseSchema> = { success: true, task: formattedTask }
    return c.json(payload, 201)
  })
  .openapi(getTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const tasks = await getTasks(ticketId)
    const formattedTasks = tasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, tasks: formattedTasks }
    return c.json(payload, 200)
  })

  // CRITICAL: Put reorder route BEFORE parameterized {taskId} routes to avoid route conflicts
  .openapi(reorderTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { tasks } = c.req.valid('json')
    const updatedTasks = await reorderTasks(ticketId, tasks)
    const formattedTasks = updatedTasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, tasks: formattedTasks }
    return c.json(payload, 200)
  })
  .openapi(autoGenerateTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const newTasks = await autoGenerateTasksFromOverview(ticketId)
    const formattedTasks = newTasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, tasks: formattedTasks }
    return c.json(payload, 200)
  })

  .openapi(updateTaskRoute, async (c) => {
    const { ticketId, taskId } = c.req.valid('param') // FIXED: Now properly extracts both parameters
    const body = c.req.valid('json')
    const updatedTask = await updateTask(ticketId, taskId, body)
    const formattedTask = formatTaskData(updatedTask)
    const payload: z.infer<typeof TaskResponseSchema> = { success: true, task: formattedTask }
    return c.json(payload, 200)
  })
  .openapi(deleteTaskRoute, async (c) => {
    const { ticketId, taskId } = c.req.valid('param') // FIXED: Now properly extracts both parameters
    await deleteTask(ticketId, taskId)
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Task deleted successfully'
    }
    return c.json(payload, 200)
  })

export type TicketRouteTypes = typeof ticketRoutes