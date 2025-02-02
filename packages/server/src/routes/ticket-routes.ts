import { router } from "server-router";
import { json } from "@bnk/router";
import { z } from "zod";

import { TicketService } from "@/services/ticket-service";
import { ApiError } from "shared";
import { ticketsApiValidation } from "shared";
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { FileSuggestionsZodSchema, FileSuggestionsJsonSchema } from "@/routes/suggest-files-routes";

// Create an instance of the TicketService
const ticketService = new TicketService();
const openRouter = new OpenRouterProviderService();


/**
 * POST /api/tickets
 * Create a new ticket.
 */
router.post("/api/tickets", {
    validation: ticketsApiValidation.create,
}, async (_, { body }) => {
    const ticket = await ticketService.createTicket(body);
    return json({ success: true, ticket }, { status: 201 });
});

/**
 * GET /api/tickets/:ticketId
 * Fetch a single ticket by ID.
 */
router.get("/api/tickets/:ticketId", {
    validation: ticketsApiValidation.getOrDelete,
}, async (_, { params }) => {
    const { ticketId } = params;
    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket) {
        throw new ApiError("Ticket not found", 404, "NOT_FOUND");
    }
    return json({ success: true, ticket });
});

/**
 * PATCH /api/tickets/:ticketId
 * Update a ticket (title, overview, status, priority).
 */
router.patch("/api/tickets/:ticketId", {
    validation: ticketsApiValidation.update,
}, async (_, { params, body }) => {
    const { ticketId } = params;
    const updatedTicket = await ticketService.updateTicket(ticketId, body);
    if (!updatedTicket) {
        throw new ApiError("Ticket not found", 404, "NOT_FOUND");
    }
    return json({ success: true, ticket: updatedTicket });
});

/**
 * DELETE /api/tickets/:ticketId
 * Delete a ticket by ID.
 */
router.delete("/api/tickets/:ticketId", {
    validation: ticketsApiValidation.getOrDelete,
}, async (_, { params }) => {
    const { ticketId } = params;
    const deleted = await ticketService.deleteTicket(ticketId);
    if (!deleted) {
        throw new ApiError("Ticket not found or already deleted", 404, "NOT_FOUND");
    }
    return json({ success: true });
});

/**
 * POST /api/tickets/:ticketId/link-files
 * Attach one or more files to a ticket.
 */
router.post("/api/tickets/:ticketId/link-files", {
    validation: ticketsApiValidation.linkFiles,
}, async (_, { params, body }) => {
    const { ticketId } = params;
    const { fileIds } = body;
    const result = await ticketService.linkFilesToTicket(ticketId, fileIds);
    return json({ success: true, linkedFiles: result });
});

/**
 * POST /api/tickets/:ticketId/suggest-tasks
 * Example endpoint that uses an AI to suggest tasks for a ticket.
 */
router.post("/api/tickets/:ticketId/suggest-tasks", {
    validation: ticketsApiValidation.suggestTasks,
}, async (_, { params, body }) => {
    const { ticketId } = params;
    const { userContext } = body;

    // If your AI call is slow, you might want to do streaming or queue it.
    const tasks = await ticketService.suggestTasksForTicket(ticketId, userContext);

    return json({ success: true, suggestedTasks: tasks });
});

/**
 * GET /api/projects/:projectId/tickets
 * In many cases you'll want a route to list tickets by project. 
 * This is outside the base /api/tickets, so implement as needed:
 */
router.get("/api/projects/:projectId/tickets", {
    validation: {
        params: z.object({ projectId: z.string() }),
        query: z.object({
            status: z.string().optional(),
        }).optional(),
    },
}, async (_, { params, query }) => {
    const { projectId } = params;
    const statusFilter = query?.status;
    const tickets = await ticketService.listTicketsByProject(projectId, statusFilter);
    return json({ success: true, tickets });
});

/**
 * GET /api/projects/:projectId/tickets-with-count
 * Get tickets with task counts.
 */
router.get("/api/projects/:projectId/tickets-with-count", {
    validation: {
        params: z.object({ projectId: z.string() }),
        query: z.object({ status: z.string().optional() }).optional(),
    },
}, async (_, { params, query }) => {
    console.log("GET /api/projects/:projectId/tickets-with-count called with:", {
        projectId: params.projectId,
        status: query?.status
    });

    const results = await ticketService.listTicketsWithTaskCount(params.projectId, query?.status);

    console.log("Sending response:", { success: true, ticketsWithCount: results });
    return json({ success: true, ticketsWithCount: results });
});

/** --- TASKS --- **/

/**
 * POST /api/tickets/:ticketId/tasks
 * Create a new task for a ticket.
 */
router.post("/api/tickets/:ticketId/tasks", {
    validation: ticketsApiValidation.createTask,
}, async (_, { params, body }) => {
    const { ticketId } = params;
    const { content } = body;
    const task = await ticketService.createTask(ticketId, content);
    return json({ success: true, task });
});

/**
 * GET /api/tickets/:ticketId/tasks
 * List tasks for a ticket.
 */
router.get("/api/tickets/:ticketId/tasks", {
    validation: {
        params: z.object({ ticketId: z.string() }),
    },
}, async (_, { params }) => {
    const tasks = await ticketService.getTasks(params.ticketId);
    return json({ success: true, tasks });
});

/**
 * PATCH /api/tickets/:ticketId/tasks/:taskId
 * Update a single task.
 */
router.patch("/api/tickets/:ticketId/tasks/:taskId", {
    validation: ticketsApiValidation.updateTask,
}, async (_, { params, body }) => {
    const updated = await ticketService.updateTask(params.ticketId, params.taskId, body);
    if (!updated) {
        throw new ApiError("Task not found", 404, "NOT_FOUND");
    }
    return json({ success: true, task: updated });
});

/**
 * DELETE /api/tickets/:ticketId/tasks/:taskId
 * Delete a task.
 */
router.delete("/api/tickets/:ticketId/tasks/:taskId", {
    validation: ticketsApiValidation.deleteTask,
}, async (_, { params }) => {
    const deleted = await ticketService.deleteTask(params.ticketId, params.taskId);
    if (!deleted) {
        throw new ApiError("Task not found or already deleted", 404, "NOT_FOUND");
    }
    return json({ success: true });
});

/**
 * PATCH /api/tickets/:ticketId/tasks/reorder
 * Reorder tasks.
 */
router.patch("/api/tickets/:ticketId/tasks/reorder", {
    validation: ticketsApiValidation.reorderTasks,
}, async (_, { params, body }) => {
    const updated = await ticketService.reorderTasks(params.ticketId, body.tasks);
    return json({ success: true, tasks: updated });
});

/**
 * POST /api/tickets/:ticketId/auto-generate-tasks
 * Auto-generate tasks from ticket overview.
 */
router.post("/api/tickets/:ticketId/auto-generate-tasks", {
    validation: {
        params: z.object({ ticketId: z.string(), }),
    },
}, async (_, { params }) => {
    const newTasks = await ticketService.autoGenerateTasksFromOverview(params.ticketId);
    return json({ success: true, tasks: newTasks });
});

/**
 * GET /api/tickets/bulk-tasks
 * Get tasks for multiple tickets in a single request.
 */
router.get("/api/tickets/bulk-tasks", {
    validation: {
        query: z.object({
            ids: z.string().transform(str => str.split(',')),
        }),
    },
}, async (_, { query }) => {
    const tasks = await ticketService.getTasksForTickets(query.ids);
    return json({ success: true, tasks });
});

router.get("/api/projects/:projectId/tickets-with-tasks", {
    validation: {
        params: z.object({ projectId: z.string() }),
        query: z.object({
            status: z.string().optional(), // e.g. 'open', 'in_progress', 'closed', or 'all'
        }).optional(),
    },
}, async (_, { params, query }) => {
    const { projectId } = params;
    const statusFilter = query?.status === 'all' ? undefined : query?.status;

    // 1) Use our new service method
    const ticketsWithTasks = await ticketService.listTicketsWithTasks(projectId, statusFilter);

    // 2) Return in a standard JSON response
    return json({
        success: true,
        ticketsWithTasks,
    });
});


/**
 * POST /api/tickets/:ticketId/suggest-files
 * Suggest relevant files based on this ticket’s overview and tasks.
 */
router.post(
    "/api/tickets/:ticketId/suggest-files",
    {
        validation: {
            params: z.object({ ticketId: z.string() }),
            body: z.object({ extraUserInput: z.string().optional() }),
        },
    },
    async (_, { params, body }) => {
        const { ticketId } = params;
        const { extraUserInput } = body;

        // 1) Fetch the ticket, including tasks if needed
        const ticket = await ticketService.getTicketById(ticketId);
        if (!ticket) {
            throw new ApiError("Ticket not found", 404, "NOT_FOUND");
        }
        const tasks = await ticketService.getTasks(ticketId); // optional

        // 2) Build userMessage from ticket’s data
        const userMessage = `
  Ticket Title: ${ticket.title}
  Overview: ${ticket.overview}
  Additional User Input: ${extraUserInput ?? ""}
  Tasks:
  ${tasks.map((t, i) => ` ${i + 1}) ${t.content}`).join("\n")}
  
  Now suggest relevant files for completing this ticket.
  `;

        // 3) LLM system prompt (similar to /suggest-files)
        const systemPrompt = `
  You are a code assistant that recommends relevant files based on a ticket’s overview and tasks.
     You have a list of file summaries and a user request.

      Return only valid JSON with the shape: {"fileIds": ["abc123", "def456"]}

      Guidelines:
      - For simple tasks: return max 5 files
      - For complex tasks: return max 10 files
      - For very complex tasks: return max 20 files
      - Do not add comments in your response
      - Strictly follow the JSON schema, do not add any additional properties or comments
  `;

        // 4) Use your structured-output-fetcher or direct parse
        const result = await fetchStructuredOutput(openRouter, {
            userMessage,
            systemMessage: systemPrompt,
            zodSchema: FileSuggestionsZodSchema,
            schemaName: "TicketFileSuggestions",
            model: "qwen/qwen-plus",
            temperature: 0.2,
            chatId: `ticket-${ticketId}-suggest-files`,
        });

        // e.g. result.fileIds: string[]
        return json({
            success: true,
            recommendedFileIds: result.fileIds,
        });
    }
);