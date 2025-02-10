import { router } from "server-router";
import { json } from "@bnk/router";
import { z } from "zod";

import { ApiError } from "shared";
import { ticketsApiValidation } from "shared";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { FileSuggestionsZodSchema } from "@/routes/suggest-files-routes";
import { DEFAULT_MODEL_CONFIGS } from "shared";
import { createTicket, getTicketById, updateTicket, deleteTicket, linkFilesToTicket, suggestTasksForTicket, listTicketsByProject, listTicketsWithTaskCount, createTask, getTasks, updateTask, deleteTask, reorderTasks, autoGenerateTasksFromOverview, getTasksForTickets, listTicketsWithTasks } from "@/services/ticket-service";
import { openRouterProvider } from "@/services/model-providers/providers/open-router-provider";


router.post("/api/tickets", {
    validation: ticketsApiValidation.create,
}, async (_, { body }) => {
    const ticket = await createTicket(body);
    return json({ success: true, ticket }, { status: 201 });
});

router.get("/api/tickets/:ticketId", {
    validation: ticketsApiValidation.getOrDelete,
}, async (_, { params }) => {
    const { ticketId } = params;
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        throw new ApiError("Ticket not found", 404, "NOT_FOUND");
    }
    return json({ success: true, ticket });
});

router.patch("/api/tickets/:ticketId", {
    validation: ticketsApiValidation.update,
}, async (_, { params, body }) => {
    const { ticketId } = params;
    const updatedTicket = await updateTicket(ticketId, body);
    if (!updatedTicket) {
        throw new ApiError("Ticket not found", 404, "NOT_FOUND");
    }
    return json({ success: true, ticket: updatedTicket });
});

router.delete("/api/tickets/:ticketId", {
    validation: ticketsApiValidation.getOrDelete,
}, async (_, { params }) => {
    const { ticketId } = params;
    const deleted = await deleteTicket(ticketId);
    if (!deleted) {
        throw new ApiError("Ticket not found or already deleted", 404, "NOT_FOUND");
    }
    return json({ success: true });
});

router.post("/api/tickets/:ticketId/link-files", {
    validation: ticketsApiValidation.linkFiles,
}, async (_, { params, body }) => {
    const { ticketId } = params;
    const { fileIds } = body;
    const result = await linkFilesToTicket(ticketId, fileIds);
    return json({ success: true, linkedFiles: result });
});


router.post("/api/tickets/:ticketId/suggest-tasks", {
    validation: ticketsApiValidation.suggestTasks,
}, async (_, { params, body }) => {
    const { ticketId } = params;
    const { userContext } = body;

    // If your AI call is slow, you might want to do streaming or queue it.
    const tasks = await suggestTasksForTicket(ticketId, userContext);

    return json({ success: true, suggestedTasks: tasks });
});

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
    const tickets = await listTicketsByProject(projectId, statusFilter);
    return json({ success: true, tickets });
});

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

    const results = await listTicketsWithTaskCount(params.projectId, query?.status);

    console.log("Sending response:", { success: true, ticketsWithCount: results });
    return json({ success: true, ticketsWithCount: results });
});

router.post("/api/tickets/:ticketId/tasks", {
    validation: ticketsApiValidation.createTask,
}, async (_, { params, body }) => {
    const { ticketId } = params;
    const { content } = body;
    const task = await createTask(ticketId, content);
    return json({ success: true, task });
});

router.get("/api/tickets/:ticketId/tasks", {
    validation: {
        params: z.object({ ticketId: z.string() }),
    },
}, async (_, { params }) => {
    const tasks = await getTasks(params.ticketId);
    return json({ success: true, tasks });
});

router.patch("/api/tickets/:ticketId/tasks/:taskId", {
    validation: ticketsApiValidation.updateTask,
}, async (_, { params, body }) => {
    const updated = await updateTask(params.ticketId, params.taskId, body);
    if (!updated) {
        throw new ApiError("Task not found", 404, "NOT_FOUND");
    }
    return json({ success: true, task: updated });
});

router.delete("/api/tickets/:ticketId/tasks/:taskId", {
    validation: ticketsApiValidation.deleteTask,
}, async (_, { params }) => {
    const deleted = await deleteTask(params.ticketId, params.taskId);
    if (!deleted) {
        throw new ApiError("Task not found or already deleted", 404, "NOT_FOUND");
    }
    return json({ success: true });
});

router.patch("/api/tickets/:ticketId/tasks/reorder", {
    validation: ticketsApiValidation.reorderTasks,
}, async (_, { params, body }) => {
    const updated = await reorderTasks(params.ticketId, body.tasks);
    return json({ success: true, tasks: updated });
});

router.post("/api/tickets/:ticketId/auto-generate-tasks", {
    validation: {
        params: z.object({ ticketId: z.string(), }),
    },
}, async (_, { params }) => {
    const newTasks = await autoGenerateTasksFromOverview(params.ticketId);
    return json({ success: true, tasks: newTasks });
});

router.get("/api/tickets/bulk-tasks", {
    validation: {
        query: z.object({
            ids: z.string().transform(str => str.split(',')),
        }),
    },
}, async (_, { query }) => {
    const tasks = await getTasksForTickets(query.ids);
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
    const ticketsWithTasks = await listTicketsWithTasks(projectId, statusFilter);

    // 2) Return in a standard JSON response
    return json({
        success: true,
        ticketsWithTasks,
    });
});


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
        const ticket = await getTicketById(ticketId);
        if (!ticket) {
            throw new ApiError("Ticket not found", 404, "NOT_FOUND");
        }
        const tasks = await getTasks(ticketId); // optional

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

        const cfg = DEFAULT_MODEL_CONFIGS['suggest-code-files-ticket']

        // 4) Use your structured-output-fetcher or direct parse
        const result = await fetchStructuredOutput(openRouterProvider, {
            userMessage,
            systemMessage: systemPrompt,
            zodSchema: FileSuggestionsZodSchema,
            schemaName: "TicketFileSuggestions",
            model: cfg.model,
            temperature: cfg.temperature,
            chatId: `ticket-${ticketId}-suggest-files`,
        });

        // e.g. result.fileIds: string[]
        return json({
            success: true,
            recommendedFileIds: result.fileIds,
        });
    }
);