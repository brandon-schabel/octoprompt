
import { ApiError } from "shared";
import {
    ApiErrorResponseSchema,
    OperationSuccessResponseSchema
} from 'shared/src/schemas/common.schemas';
import {
    createTicket, getTicketById, updateTicket, deleteTicket, linkFilesToTicket,
    suggestTasksForTicket, listTicketsByProject, listTicketsWithTaskCount,
    createTask, getTasks, updateTask, deleteTask, reorderTasks,
    autoGenerateTasksFromOverview, getTasksForTickets, listTicketsWithTasks,
    suggestFilesForTicket
} from "../services/ticket-service";
import { ticketsApiValidation } from "shared/src/schemas/ticket.schemas";
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

// Define common schemas for Ticket and Task
const TicketSchema = z.object({
    id: z.string().openapi({ description: "Unique ticket identifier" }),
    projectId: z.string().openapi({ description: "Project this ticket belongs to" }),
    title: z.string().openapi({ description: "Ticket title" }),
    overview: z.string().openapi({ description: "Ticket description" }),
    status: z.enum(["open", "in_progress", "closed"]).openapi({ description: "Current ticket status" }),
    priority: z.enum(["low", "normal", "high"]).openapi({ description: "Ticket priority" }),
    suggestedFileIds: z.string().openapi({ description: "JSON string of suggested file IDs" }), // Keep as string from DB
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
    updatedAt: z.string().datetime().openapi({ description: "Last update timestamp" }),
}).openapi('Ticket');

const TaskSchema = z.object({
    id: z.string().openapi({ description: "Unique task identifier" }),
    ticketId: z.string().openapi({ description: "Ticket this task belongs to" }),
    content: z.string().openapi({ description: "Task content/description" }),
    done: z.boolean().openapi({ description: "Whether the task is completed" }),
    orderIndex: z.number().openapi({ description: "Task order within the ticket" }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
    updatedAt: z.string().datetime().openapi({ description: "Last update timestamp" }),
}).openapi('Task');

// Success response schemas
const TicketResponseSchema = z.object({
    success: z.literal(true),
    ticket: TicketSchema // Use the defined TicketSchema
}).openapi('TicketResponse');

const TicketListResponseSchema = z.object({
    success: z.literal(true),
    tickets: z.array(TicketSchema) // Use the defined TicketSchema
}).openapi('TicketListResponse');

const TaskResponseSchema = z.object({
    success: z.literal(true),
    task: TaskSchema // Use the defined TaskSchema
}).openapi('TaskResponse');

const TaskListResponseSchema = z.object({
    success: z.literal(true),
    tasks: z.array(TaskSchema) // Use the defined TaskSchema
}).openapi('TaskListResponse');

const LinkedFilesResponseSchema = z.object({
    success: z.literal(true),
    linkedFiles: z.array(z.object({
        ticketId: z.string(),
        fileId: z.string()
    }))
}).openapi('LinkedFilesResponse');

const SuggestedTasksResponseSchema = z.object({
    success: z.literal(true),
    suggestedTasks: z.array(z.string())
}).openapi('SuggestedTasksResponse');

const SuggestedFilesResponseSchema = z.object({
    success: z.literal(true),
    recommendedFileIds: z.array(z.string()),
    combinedSummaries: z.string().optional(),
    message: z.string().optional()
}).openapi('SuggestedFilesResponse');

// Define TicketWithTaskCount based on TicketSchema
const TicketWithTaskCountSchema = z.object({
    ticket: TicketSchema, // Use the defined TicketSchema
    taskCount: z.number(),
    completedTaskCount: z.number() // Make required as per service logic
}).openapi('TicketWithTaskCount');


const TicketWithTaskCountListResponseSchema = z.object({
    success: z.literal(true),
    ticketsWithCount: z.array(TicketWithTaskCountSchema) // Use the defined schema
}).openapi('TicketWithTaskCountListResponse');

// Define TicketWithTasks based on TicketSchema and TaskSchema
const TicketWithTasksSchema = z.object({
    ticket: TicketSchema, // Use the defined TicketSchema
    tasks: z.array(TaskSchema) // Use the defined TaskSchema
}).openapi('TicketWithTasks');


const TicketWithTasksListResponseSchema = z.object({
    success: z.literal(true),
    ticketsWithTasks: z.array(TicketWithTasksSchema) // Use the defined schema
}).openapi('TicketWithTasksListResponse');

const BulkTasksResponseSchema = z.object({
    success: z.literal(true),
    tasks: z.record(z.string(), z.array(TaskSchema)) // Use the defined TaskSchema
}).openapi('BulkTasksResponse');

// Request schemas using the existing validation schemas from shared package
const CreateTicketBodySchema = ticketsApiValidation.create.body.openapi('CreateTicketBody');
const UpdateTicketBodySchema = ticketsApiValidation.update.body.openapi('UpdateTicketBody');
const TicketIdParamsSchema = z.object({
    ticketId: z.string().openapi({
        param: { name: 'ticketId', in: 'path' },
        description: "Ticket identifier"
    })
}).openapi('TicketIdParams');

const ProjectIdParamsSchema = z.object({
    projectId: z.string().openapi({
        param: { name: 'projectId', in: 'path' },
        description: "Project identifier"
    })
}).openapi('ProjectIdParams');

const StatusQuerySchema = z.object({
    status: z.string().optional().openapi({
        param: { name: 'status', in: 'query' },
        description: "Filter tickets by status"
    })
}).openapi('StatusQuery');

const LinkFilesBodySchema = ticketsApiValidation.linkFiles.body.openapi('LinkFilesBody');
const SuggestTasksBodySchema = ticketsApiValidation.suggestTasks.body.openapi('SuggestTasksBody');
const SuggestFilesBodySchema = z.object({
    extraUserInput: z.string().optional().openapi({
        description: "Optional additional context for file suggestions"
    })
}).openapi('SuggestFilesBody');

const CreateTaskBodySchema = ticketsApiValidation.createTask.body.openapi('CreateTaskBody');
const UpdateTaskBodySchema = ticketsApiValidation.updateTask.body.openapi('UpdateTaskBody');
const TaskIdParamsSchema = z.object({
    taskId: z.string().openapi({
        param: { name: 'taskId', in: 'path' },
        description: "Task identifier"
    })
}).openapi('TaskIdParams');

const TicketTaskIdParamsSchema = z.object({
    ticketId: TicketIdParamsSchema.shape.ticketId,
    taskId: TaskIdParamsSchema.shape.taskId,
}).openapi('TicketTaskIdParams');

const ReorderTasksBodySchema = ticketsApiValidation.reorderTasks.body.openapi('ReorderTasksBody');
const BulkTasksQuerySchema = z.object({
    ids: z.string().transform(str => str.split(',')).openapi({
        param: { name: 'ids', in: 'query' },
        description: "Comma-separated list of ticket IDs"
    })
}).openapi('BulkTasksQuery');

// Route definitions
const createTicketRoute = createRoute({
    method: 'post',
    path: '/api/tickets',
    tags: ['Tickets'],
    summary: 'Create a new ticket',
    request: {
        body: { content: { 'application/json': { schema: CreateTicketBodySchema } } },
    },
    responses: {
        201: { content: { 'application/json': { schema: TicketResponseSchema } }, description: 'Ticket created successfully' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const getTicketRoute = createRoute({
    method: 'get',
    path: '/api/tickets/{ticketId}',
    tags: ['Tickets'],
    summary: 'Get a ticket by ID',
    request: {
        params: TicketIdParamsSchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: TicketResponseSchema } }, description: 'Ticket retrieved successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const updateTicketRoute = createRoute({
    method: 'patch',
    path: '/api/tickets/{ticketId}',
    tags: ['Tickets'],
    summary: 'Update a ticket',
    request: {
        params: TicketIdParamsSchema,
        body: { content: { 'application/json': { schema: UpdateTicketBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: TicketResponseSchema } }, description: 'Ticket updated successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const deleteTicketRoute = createRoute({
    method: 'delete',
    path: '/api/tickets/{ticketId}',
    tags: ['Tickets'],
    summary: 'Delete a ticket',
    request: {
        params: TicketIdParamsSchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: OperationSuccessResponseSchema } }, description: 'Ticket deleted successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const linkFilesRoute = createRoute({
    method: 'post',
    path: '/api/tickets/{ticketId}/link-files',
    tags: ['Tickets', 'Files'],
    summary: 'Link files to a ticket',
    request: {
        params: TicketIdParamsSchema,
        body: { content: { 'application/json': { schema: LinkFilesBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: LinkedFilesResponseSchema } }, description: 'Files linked successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const suggestTasksRoute = createRoute({
    method: 'post',
    path: '/api/tickets/{ticketId}/suggest-tasks',
    tags: ['Tickets', 'AI'],
    summary: 'Get AI suggestions for tasks',
    request: {
        params: TicketIdParamsSchema,
        body: { content: { 'application/json': { schema: SuggestTasksBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: SuggestedTasksResponseSchema } }, description: 'Tasks suggested successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const suggestFilesRoute = createRoute({
    method: 'post',
    path: '/api/tickets/{ticketId}/suggest-files',
    tags: ['Tickets', 'Files', 'AI'],
    summary: 'Get AI suggestions for relevant files',
    request: {
        params: TicketIdParamsSchema,
        body: { content: { 'application/json': { schema: SuggestFilesBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: SuggestedFilesResponseSchema } }, description: 'Files suggested successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const listTicketsByProjectRoute = createRoute({
    method: 'get',
    path: '/api/projects/{projectId}/tickets',
    tags: ['Projects', 'Tickets'],
    summary: 'List all tickets for a project',
    request: {
        params: ProjectIdParamsSchema,
        query: StatusQuerySchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: TicketListResponseSchema } }, description: 'Tickets listed successfully' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const listTicketsWithCountRoute = createRoute({
    method: 'get',
    path: '/api/projects/{projectId}/tickets-with-count',
    tags: ['Projects', 'Tickets'],
    summary: 'List tickets with task counts',
    request: {
        params: ProjectIdParamsSchema,
        query: StatusQuerySchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: TicketWithTaskCountListResponseSchema } }, description: 'Tickets with counts listed successfully' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const listTicketsWithTasksRoute = createRoute({
    method: 'get',
    path: '/api/projects/{projectId}/tickets-with-tasks',
    tags: ['Projects', 'Tickets', 'Tasks'],
    summary: 'List tickets with their tasks',
    request: {
        params: ProjectIdParamsSchema,
        query: StatusQuerySchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: TicketWithTasksListResponseSchema } }, description: 'Tickets with tasks listed successfully' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const createTaskRoute = createRoute({
    method: 'post',
    path: '/api/tickets/{ticketId}/tasks',
    tags: ['Tickets', 'Tasks'],
    summary: 'Create a new task for a ticket',
    request: {
        params: TicketIdParamsSchema,
        body: { content: { 'application/json': { schema: CreateTaskBodySchema } } },
    },
    responses: {
        201: { content: { 'application/json': { schema: TaskResponseSchema } }, description: 'Task created successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const getTasksRoute = createRoute({
    method: 'get',
    path: '/api/tickets/{ticketId}/tasks',
    tags: ['Tickets', 'Tasks'],
    summary: 'Get all tasks for a ticket',
    request: {
        params: TicketIdParamsSchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: TaskListResponseSchema } }, description: 'Tasks retrieved successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const updateTaskRoute = createRoute({
    method: 'patch',
    path: '/api/tickets/{ticketId}/tasks/{taskId}',
    tags: ['Tickets', 'Tasks'],
    summary: 'Update a task',
    request: {
        params: TicketTaskIdParamsSchema,
        body: { content: { 'application/json': { schema: UpdateTaskBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: TaskResponseSchema } }, description: 'Task updated successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Task not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const deleteTaskRoute = createRoute({
    method: 'delete',
    path: '/api/tickets/{ticketId}/tasks/{taskId}',
    tags: ['Tickets', 'Tasks'],
    summary: 'Delete a task',
    request: {
        params: TicketTaskIdParamsSchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: OperationSuccessResponseSchema } }, description: 'Task deleted successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Task not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const reorderTasksRoute = createRoute({
    method: 'patch',
    path: '/api/tickets/{ticketId}/tasks/reorder',
    tags: ['Tickets', 'Tasks'],
    summary: 'Reorder tasks within a ticket',
    request: {
        params: TicketIdParamsSchema,
        body: { content: { 'application/json': { schema: ReorderTasksBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: TaskListResponseSchema } }, description: 'Tasks reordered successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const autoGenerateTasksRoute = createRoute({
    method: 'post',
    path: '/api/tickets/{ticketId}/auto-generate-tasks',
    tags: ['Tickets', 'Tasks', 'AI'],
    summary: 'Auto-generate tasks from ticket overview',
    request: {
        params: TicketIdParamsSchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: TaskListResponseSchema } }, description: 'Tasks generated successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Ticket not found' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const getTasksForTicketsRoute = createRoute({
    method: 'get',
    path: '/api/tickets/bulk-tasks',
    tags: ['Tickets', 'Tasks'],
    summary: 'Get tasks for multiple tickets',
    request: {
        query: BulkTasksQuerySchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: BulkTasksResponseSchema } }, description: 'Tasks retrieved successfully' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

// --- Helper functions adjusted for API Schema ---

// Helper to map DB Ticket (with Date objects) to API Ticket (with ISO strings)
const formatTicketData = (ticket: any): z.infer<typeof TicketSchema> => {
    // Ensure input is treated as 'any' to avoid premature TS errors before validation
    const dataToValidate = {
        ...ticket,
        // Ensure Dates are converted to ISO strings BEFORE validation
        createdAt: ticket.createdAt instanceof Date ? ticket.createdAt.toISOString() : ticket.createdAt,
        updatedAt: ticket.updatedAt instanceof Date ? ticket.updatedAt.toISOString() : ticket.updatedAt,
        // Ensure suggestedFileIds is a string as expected by the DB/service layer
        suggestedFileIds: typeof ticket.suggestedFileIds === 'string' ? ticket.suggestedFileIds : JSON.stringify(ticket.suggestedFileIds || []),
        // Ensure boolean/numeric fields are correctly typed if necessary (DB might return 0/1)
        status: ticket.status, // Assuming status is already correct enum string
        priority: ticket.priority, // Assuming priority is already correct enum string
    };
    // Validate against the stricter API schema *after* transformations
    // This might throw if the input `ticket` doesn't conform, which is good.
    return TicketSchema.parse(dataToValidate);
};

// Helper to map DB Task (with Date objects, potentially 0/1 for boolean) to API Task
const formatTaskData = (task: any): z.infer<typeof TaskSchema> => {
    const dataToValidate = {
        ...task,
        done: Boolean(task.done), // Ensure 'done' is a boolean
        // Ensure Dates are converted to ISO strings BEFORE validation
        createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
        updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
        orderIndex: Number(task.orderIndex), // Ensure orderIndex is a number
    };
    return TaskSchema.parse(dataToValidate); // Validate against API schema
};

// --- Route Implementations ---

export const ticketRoutes = new OpenAPIHono()
    // Ticket management routes
    .openapi(createTicketRoute, async (c) => {
        const body = c.req.valid('json');
        const ticket = await createTicket(body); // Service returns Ticket with Date objects
        const formattedTicket = formatTicketData(ticket); // Format for API response
        const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket };
        return c.json(payload, 201); // Explicitly return 201
    })
    .openapi(getTicketRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const ticket = await getTicketById(ticketId);
        if (!ticket) {
            throw new ApiError(404, "Ticket not found", "NOT_FOUND");
        }
        const formattedTicket = formatTicketData(ticket);
        const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(updateTicketRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const body = c.req.valid('json');
        const updatedTicket = await updateTicket(ticketId, body);
        if (!updatedTicket) {
            throw new ApiError(404, "Ticket not found", "NOT_FOUND");
        }
        const formattedTicket = formatTicketData(updatedTicket);
        const payload: z.infer<typeof TicketResponseSchema> = { success: true, ticket: formattedTicket };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(deleteTicketRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const deleted = await deleteTicket(ticketId);
        if (!deleted) {
            throw new ApiError(404, "Ticket not found or already deleted", "NOT_FOUND");
        }
        const payload: z.infer<typeof OperationSuccessResponseSchema> = { success: true, message: "Ticket deleted successfully" };
        return c.json(payload, 200); // Explicitly return 200
    })

    // File-related routes
    .openapi(linkFilesRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const { fileIds } = c.req.valid('json');
        const result = await linkFilesToTicket(ticketId, fileIds); // Assuming service returns { ticketId: string; fileId: string; }[]
        const payload: z.infer<typeof LinkedFilesResponseSchema> = { success: true, linkedFiles: result };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(suggestFilesRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const { extraUserInput } = c.req.valid('json');
        const result = await suggestFilesForTicket(ticketId, { extraUserInput }); // Service returns { recommendedFileIds, combinedSummaries?, message? }
        // Ensure the payload matches the response schema
        const payload: z.infer<typeof SuggestedFilesResponseSchema> = {
            success: true,
            recommendedFileIds: result.recommendedFileIds || [],
            combinedSummaries: result.combinedSummaries, // Optional, will be undefined if not returned
            message: result.message // Optional
        };
        return c.json(payload, 200); // Explicitly return 200
    })

    // AI-assisted task suggestion
    .openapi(suggestTasksRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const { userContext } = c.req.valid('json');
        const tasks = await suggestTasksForTicket(ticketId, userContext); // Service returns string[]
        const payload: z.infer<typeof SuggestedTasksResponseSchema> = { success: true, suggestedTasks: tasks };
        return c.json(payload, 200); // Explicitly return 200
    })

    // Project-related ticket routes
    .openapi(listTicketsByProjectRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const query = c.req.valid('query');
        const tickets = await listTicketsByProject(projectId, query?.status); // Service returns Ticket[] with Dates
        const formattedTickets = tickets.map(formatTicketData); // Format each ticket
        const payload: z.infer<typeof TicketListResponseSchema> = {
            success: true,
            tickets: formattedTickets
        };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(listTicketsWithCountRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const query = c.req.valid('query');
        const statusFilter = query?.status === 'all' ? undefined : query?.status;
        // Assuming service returns Array<DBTicket & { taskCount: number | string; completedTaskCount: number | string }>
        const results = await listTicketsWithTaskCount(projectId, statusFilter);

        const formatted: z.infer<typeof TicketWithTaskCountSchema>[] = results.map(item => {
            // Separate counts potentially needing conversion
            const { taskCount, completedTaskCount, ...ticketData } = item;
            return {
                ticket: formatTicketData(ticketData), // Format the ticket part
                taskCount: Number(taskCount || 0), // Ensure number
                completedTaskCount: Number(completedTaskCount || 0) // Ensure number and included
            };
        });
        // Validate the final structure if needed, though formatTicketData does internal validation
        // TicketWithTaskCountSchema.array().parse(formatted); // Optional deep validation

        const payload: z.infer<typeof TicketWithTaskCountListResponseSchema> = {
            success: true,
            ticketsWithCount: formatted
        };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(listTicketsWithTasksRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const query = c.req.valid('query');
        const statusFilter = query?.status === 'all' ? undefined : query?.status;
        // Service returns Array<Ticket & { tasks: TicketTask[] }> with Date objects
        const ticketsWithTasks = await listTicketsWithTasks(projectId, statusFilter);

        const formatted: z.infer<typeof TicketWithTasksSchema>[] = ticketsWithTasks.map(item => ({
            ticket: formatTicketData(item), // Format ticket part
            tasks: (item.tasks || []).map(formatTaskData) // Format each task
        }));

        // Validate final structure
        // TicketWithTasksSchema.array().parse(formatted); // Optional deep validation

        const payload: z.infer<typeof TicketWithTasksListResponseSchema> = {
            success: true,
            ticketsWithTasks: formatted
        };
        return c.json(payload, 200); // Explicitly return 200
    })

    // Task management routes
    .openapi(createTaskRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const { content } = c.req.valid('json');
        const task = await createTask(ticketId, content); // Service returns Task with Dates
        const formattedTask = formatTaskData(task); // Format for API
        const payload: z.infer<typeof TaskResponseSchema> = { success: true, task: formattedTask };
        return c.json(payload, 201); // Explicitly return 201
    })
    .openapi(getTasksRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const tasks = await getTasks(ticketId); // Service returns Task[] with Dates
        const formattedTasks = tasks.map(formatTaskData); // Format each task
        const payload: z.infer<typeof TaskListResponseSchema> = { success: true, tasks: formattedTasks };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(updateTaskRoute, async (c) => {
        const { ticketId, taskId } = c.req.valid('param');
        const body = c.req.valid('json');
        const updated = await updateTask(ticketId, taskId, body);
        if (!updated) {
            throw new ApiError(404, "Task not found", "NOT_FOUND");
        }
        const formattedTask = formatTaskData(updated);
        const payload: z.infer<typeof TaskResponseSchema> = { success: true, task: formattedTask };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(deleteTaskRoute, async (c) => {
        const { ticketId, taskId } = c.req.valid('param');
        const deleted = await deleteTask(ticketId, taskId);
        if (!deleted) {
            throw new ApiError(404, "Task not found or already deleted", "NOT_FOUND");
        }
        const payload: z.infer<typeof OperationSuccessResponseSchema> = { success: true, message: "Task deleted successfully" };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(reorderTasksRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const { tasks } = c.req.valid('json');
        const updated = await reorderTasks(ticketId, tasks); // Service returns updated Task[] with Dates
        const formattedTasks = updated.map(formatTaskData);
        const payload: z.infer<typeof TaskListResponseSchema> = { success: true, tasks: formattedTasks };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(autoGenerateTasksRoute, async (c) => {
        const { ticketId } = c.req.valid('param');
        const newTasks = await autoGenerateTasksFromOverview(ticketId); // Service returns Task[] with Dates
        const formattedTasks = newTasks.map(formatTaskData);
        const payload: z.infer<typeof TaskListResponseSchema> = { success: true, tasks: formattedTasks };
        return c.json(payload, 200); // Explicitly return 200
    })
    .openapi(getTasksForTicketsRoute, async (c) => {
        const { ids } = c.req.valid('query'); // Already transformed to string[] by schema
        const tasksByTicketId = await getTasksForTickets(ids); // Service returns Record<string, Task[] with Dates>

        // Transform each task list in the record
        const formattedTasks: Record<string, z.infer<typeof TaskSchema>[]> = {};
        for (const [ticketId, tasks] of Object.entries(tasksByTicketId)) {
            formattedTasks[ticketId] = tasks.map(formatTaskData); // Format tasks for API
        }

        const payload: z.infer<typeof BulkTasksResponseSchema> = { success: true, tasks: formattedTasks };
        return c.json(payload, 200); // Explicitly return 200
    });

export type TicketRouteTypes = typeof ticketRoutes;