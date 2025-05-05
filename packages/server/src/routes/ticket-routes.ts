import { ApiError } from 'shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from 'shared/src/schemas/common.schemas'
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
import { ticketsApiValidation } from 'shared/src/schemas/ticket.schemas'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

const TicketSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique ticket identifier' }),
    projectId: z.string().openapi({ description: 'Project this ticket belongs to' }),
    title: z.string().openapi({ description: 'Ticket title' }),
    overview: z.string().openapi({ description: 'Ticket description' }),
    status: z.enum(['open', 'in_progress', 'closed']).openapi({ description: 'Current ticket status' }),
    priority: z.enum(['low', 'normal', 'high']).openapi({ description: 'Ticket priority' }),
    suggestedFileIds: z.string().openapi({ description: 'JSON string of suggested file IDs' }),
    createdAt: z.string().datetime().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.string().datetime().openapi({ description: 'Last update timestamp' })
  })
  .openapi('Ticket')

const TaskSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique task identifier' }),
    ticketId: z.string().openapi({ description: 'Ticket this task belongs to' }),
    content: z.string().openapi({ description: 'Task content/description' }),
    done: z.boolean().openapi({ description: 'Whether the task is completed' }),
    orderIndex: z.number().openapi({ description: 'Task order within the ticket' }),
    createdAt: z.string().datetime().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.string().datetime().openapi({ description: 'Last update timestamp' })
  })
  .openapi('Task')

const TicketResponseSchema = z
  .object({
    success: z.literal(true),
    ticket: TicketSchema
  })
  .openapi('TicketResponse')

const TicketListResponseSchema = z
  .object({
    success: z.literal(true),
    tickets: z.array(TicketSchema)
  })
  .openapi('TicketListResponse')

const TaskResponseSchema = z
  .object({
    success: z.literal(true),
    task: TaskSchema
  })
  .openapi('TaskResponse')

const TaskListResponseSchema = z
  .object({
    success: z.literal(true),
    tasks: z.array(TaskSchema)
  })
  .openapi('TaskListResponse')

const LinkedFilesResponseSchema = z
  .object({
    success: z.literal(true),
    linkedFiles: z.array(
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
    suggestedTasks: z.array(z.string())
  })
  .openapi('SuggestedTasksResponse')

const SuggestedFilesResponseSchema = z
  .object({
    success: z.literal(true),
    recommendedFileIds: z.array(z.string()),
    combinedSummaries: z.string().optional(),
    message: z.string().optional()
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
    ticketsWithCount: z.array(TicketWithTaskCountSchema)
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
    ticketsWithTasks: z.array(TicketWithTasksSchema)
  })
  .openapi('TicketWithTasksListResponse')

const BulkTasksResponseSchema = z
  .object({
    success: z.literal(true),
    tasks: z.record(z.string(), z.array(TaskSchema))
  })
  .openapi('BulkTasksResponse')

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
const SuggestFilesBodySchema = z
  .object({
    extraUserInput: z.string().optional().openapi({
      description: 'Optional additional context for file suggestions'
    })
  })
  .openapi('SuggestFilesBody')

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
    400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
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

const updateTaskRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}/tasks/{taskId}',
  tags: ['Tickets', 'Tasks'],
  summary: 'Update a task',
  request: {
    params: TicketTaskIdParamsSchema,
    body: { content: { 'application/json': { schema: UpdateTaskBodySchema } } }
  },
  responses: {
    200: { content: { 'application/json': { schema: TaskResponseSchema } }, description: 'Task updated successfully' },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Task not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const deleteTaskRoute = createRoute({
  method: 'delete',
  path: '/api/tickets/{ticketId}/tasks/{taskId}',
  tags: ['Tickets', 'Tasks'],
  summary: 'Delete a task',
  request: {
    params: TicketTaskIdParamsSchema
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

const formatTicketData = (ticket: any): z.infer<typeof TicketSchema> => {
  const dataToValidate = {
    ...ticket,

    createdAt: ticket.createdAt instanceof Date ? ticket.createdAt.toISOString() : ticket.createdAt,
    updatedAt: ticket.updatedAt instanceof Date ? ticket.updatedAt.toISOString() : ticket.updatedAt,

    suggestedFileIds:
      typeof ticket.suggestedFileIds === 'string'
        ? ticket.suggestedFileIds
        : JSON.stringify(ticket.suggestedFileIds || []),

    status: ticket.status,
    priority: ticket.priority
  }

  return TicketSchema.parse(dataToValidate)
}

const formatTaskData = (task: any): z.infer<typeof TaskSchema> => {
  const dataToValidate = {
    ...task,
    done: Boolean(task.done),

    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
    orderIndex: Number(task.orderIndex)
  }
  return TaskSchema.parse(dataToValidate)
}

export const ticketRoutes = new OpenAPIHono()

  .openapi(createTicketRoute, async (c) => {
    const body = c.req.valid('json')
    const ticket = await createTicket(body)
    const formattedTicket = formatTicketData(ticket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket }
    return c.json(payload, 201)
  })
  .openapi(getTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const ticket = await getTicketById(ticketId)
    if (!ticket) {
      throw new ApiError(404, 'Ticket not found', 'NOT_FOUND')
    }
    const formattedTicket = formatTicketData(ticket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket }
    return c.json(payload, 200)
  })
  .openapi(updateTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedTicket = await updateTicket(ticketId, body)
    if (!updatedTicket) {
      throw new ApiError(404, 'Ticket not found', 'NOT_FOUND')
    }
    const formattedTicket = formatTicketData(updatedTicket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket }
    return c.json(payload, 200)
  })
  .openapi(deleteTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const deleted = await deleteTicket(ticketId)
    if (!deleted) {
      throw new ApiError(404, 'Ticket not found or already deleted', 'NOT_FOUND')
    }
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
  .openapi(updateTaskRoute, async (c) => {
    const { ticketId, taskId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updated = await updateTask(ticketId, taskId, body)
    if (!updated) {
      throw new ApiError(404, 'Task not found', 'NOT_FOUND')
    }
    const formattedTask = formatTaskData(updated)
    const payload: z.infer<typeof TaskResponseSchema> = { success: true, task: formattedTask }
    return c.json(payload, 200)
  })
  .openapi(deleteTaskRoute, async (c) => {
    const { ticketId, taskId } = c.req.valid('param')
    const deleted = await deleteTask(ticketId, taskId)
    if (!deleted) {
      throw new ApiError(404, 'Task not found or already deleted', 'NOT_FOUND')
    }
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Task deleted successfully'
    }
    return c.json(payload, 200)
  })
  .openapi(reorderTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { tasks } = c.req.valid('json')
    const updated = await reorderTasks(ticketId, tasks)
    const formattedTasks = updated.map(formatTaskData)
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
  .openapi(getTasksForTicketsRoute, async (c) => {
    const { ids } = c.req.valid('query')
    const tasksByTicketId = await getTasksForTickets(ids)

    const formattedTasks: Record<string, z.infer<typeof TaskSchema>[]> = {}
    for (const [ticketId, tasks] of Object.entries(tasksByTicketId)) {
      formattedTasks[ticketId] = tasks.map(formatTaskData)
    }

    const payload: z.infer<typeof BulkTasksResponseSchema> = { success: true, tasks: formattedTasks }
    return c.json(payload, 200)
  })

export type TicketRouteTypes = typeof ticketRoutes
