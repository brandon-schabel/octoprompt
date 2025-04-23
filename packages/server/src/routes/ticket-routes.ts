import { zValidator } from "@hono/zod-validator";
import { z } from '@hono/zod-openapi';

import { ApiError } from "shared";
import { ticketsApiValidation } from "shared";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { DEFAULT_MODEL_CONFIGS } from "shared";
import {
    createTicket, getTicketById, updateTicket, deleteTicket, linkFilesToTicket,
    suggestTasksForTicket, listTicketsByProject, listTicketsWithTaskCount,
    createTask, getTasks, updateTask, deleteTask, reorderTasks,
    autoGenerateTasksFromOverview, getTasksForTickets, listTicketsWithTasks
} from "@/services/ticket-service";
import { FileSuggestionsZodSchema } from './project-routes';
import { OpenAPIHono } from '@hono/zod-openapi';

export const ticketRoutes = new OpenAPIHono().post("/api/tickets",
    zValidator('json', ticketsApiValidation.create.body),
    async (c) => {
        const body = c.req.valid('json'); // Changed: use c.req.valid directly
        const ticket = await createTicket(body);
        return c.json({ success: true, ticket }, 201);
    }
).get("/api/tickets/:ticketId",
    zValidator('param', ticketsApiValidation.getOrDelete.params),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const ticket = await getTicketById(ticketId);
        if (!ticket) {
            throw new ApiError(404, "Ticket not found", "NOT_FOUND");
        }
        return c.json({ success: true, ticket });
    }
).patch("/api/tickets/:ticketId",
    zValidator('param', ticketsApiValidation.update.params),
    zValidator('json', ticketsApiValidation.update.body),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const body = c.req.valid('json'); // Changed: use c.req.valid directly
        const updatedTicket = await updateTicket(ticketId, body);
        if (!updatedTicket) {
            throw new ApiError(404, "Ticket not found", "NOT_FOUND");
        }
        return c.json({ success: true, ticket: updatedTicket });
    }
).delete("/api/tickets/:ticketId",
    zValidator('param', ticketsApiValidation.getOrDelete.params),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const deleted = await deleteTicket(ticketId);
        if (!deleted) {
            throw new ApiError(404, "Ticket not found or already deleted", "NOT_FOUND");
        }
        // Consider returning 204 No Content for successful deletions
        return c.json({ success: true }, 200); // Or c.body(null, 204)
    }
).post("/api/tickets/:ticketId/link-files",
    zValidator('param', ticketsApiValidation.linkFiles.params),
    zValidator('json', ticketsApiValidation.linkFiles.body),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const { fileIds } = c.req.valid('json'); // Changed: use c.req.valid directly
        const result = await linkFilesToTicket(ticketId, fileIds);
        return c.json({ success: true, linkedFiles: result });
    }
).post("/api/tickets/:ticketId/suggest-tasks",
    zValidator('param', ticketsApiValidation.suggestTasks.params),
    zValidator('json', ticketsApiValidation.suggestTasks.body),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const { userContext } = c.req.valid('json'); // Changed: use c.req.valid directly
        const tasks = await suggestTasksForTicket(ticketId, userContext);
        return c.json({ success: true, suggestedTasks: tasks });
    }
).post(
    "/api/tickets/:ticketId/suggest-files",
    zValidator('param', z.object({ ticketId: z.string() })),
    zValidator('json', z.object({ extraUserInput: z.string().optional() })),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const { extraUserInput } = c.req.valid('json'); // Changed: use c.req.valid directly

        const ticket = await getTicketById(ticketId);
        if (!ticket) {
            throw new ApiError(404, "Ticket not found", "NOT_FOUND");
        }
        const tasks = await getTasks(ticketId);

        const userMessage = `
 Ticket Title: ${ticket.title}
 Overview: ${ticket.overview}
 Additional User Input: ${extraUserInput ?? ""}
 Tasks:
 ${tasks.map((t, i) => ` ${i + 1}) ${t.content}`).join("\n")}

 Now suggest relevant files for completing this ticket.
 `;

        const systemPrompt = `
 You are a code assistant that recommends relevant files based on a ticket's overview and tasks.
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

        const result = await fetchStructuredOutput({
            userMessage,
            systemMessage: systemPrompt,
            zodSchema: FileSuggestionsZodSchema, // Make sure this schema uses z from @hono/zod-openapi if defined elsewhere
            schemaName: "TicketFileSuggestions",
            model: cfg.model,
            temperature: cfg.temperature,
            chatId: `ticket-${ticketId}-suggest-files`,
        });

        return c.json({
            success: true,
            recommendedFileIds: result.fileIds,
        });
    }
).get("/api/projects/:projectId/tickets",
    zValidator('param', z.object({ projectId: z.string() })),
    zValidator('query', z.object({
        status: z.string().optional(),
    }).optional()),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const query = c.req.valid('query');
        const statusFilter = query?.status;
        const tickets = await listTicketsByProject(projectId, statusFilter);
        return c.json({ success: true, tickets });
    }
).get("/api/projects/:projectId/tickets-with-count",
    zValidator('param', z.object({ projectId: z.string() })),
    zValidator('query', z.object({ status: z.string().optional() }).optional()),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const query = c.req.valid('query');
        console.log("GET /api/projects/:projectId/tickets-with-count called with:", { projectId, status: query?.status });
        const results = await listTicketsWithTaskCount(projectId, query?.status);
        console.log("Sending response:", { success: true, ticketsWithCount: results });
        return c.json({ success: true, ticketsWithCount: results });
    }
).get("/api/projects/:projectId/tickets-with-tasks",
    zValidator('param', z.object({ projectId: z.string() })),
    zValidator('query', z.object({
        status: z.string().optional(), // e.g. 'open', 'in_progress', 'closed', or 'all'
    }).optional()),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const query = c.req.valid('query');
        const statusFilter = query?.status === 'all' ? undefined : query?.status;
        const ticketsWithTasks = await listTicketsWithTasks(projectId, statusFilter);
        return c.json({ success: true, ticketsWithTasks });
    }
).post("/api/tickets/:ticketId/tasks",
    zValidator('param', ticketsApiValidation.createTask.params),
    zValidator('json', ticketsApiValidation.createTask.body),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const { content } = c.req.valid('json'); // Changed: use c.req.valid directly
        const task = await createTask(ticketId, content);
        return c.json({ success: true, task });
    }
).get("/api/tickets/:ticketId/tasks",
    zValidator('param', z.object({ ticketId: z.string() })),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const tasks = await getTasks(ticketId);
        return c.json({ success: true, tasks });
    }
).patch("/api/tickets/:ticketId/tasks/:taskId",
    zValidator('param', ticketsApiValidation.updateTask.params),
    zValidator('json', ticketsApiValidation.updateTask.body),
    async (c) => {
        const { ticketId, taskId } = c.req.valid('param');
        const body = c.req.valid('json'); // Changed: use c.req.valid directly
        const updated = await updateTask(ticketId, taskId, body);
        if (!updated) {
            throw new ApiError(404, "Task not found", "NOT_FOUND");
        }
        return c.json({ success: true, task: updated });
    }
).delete("/api/tickets/:ticketId/tasks/:taskId",
    zValidator('param', ticketsApiValidation.deleteTask.params),
    async (c) => {
        const { ticketId, taskId } = c.req.valid('param');
        const deleted = await deleteTask(ticketId, taskId);
        if (!deleted) {
            throw new ApiError(404, "Task not found or already deleted", "NOT_FOUND");
        }
        return c.json({ success: true }); // Consider 204 No Content
    }
).patch("/api/tickets/:ticketId/tasks/reorder",
    zValidator('param', ticketsApiValidation.reorderTasks.params),
    zValidator('json', ticketsApiValidation.reorderTasks.body),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const { tasks } = c.req.valid('json'); // Changed: use c.req.valid directly
        const updated = await reorderTasks(ticketId, tasks);
        return c.json({ success: true, tasks: updated });
    }
).post("/api/tickets/:ticketId/auto-generate-tasks",
    zValidator('param', z.object({ ticketId: z.string() })),
    async (c) => {
        const { ticketId } = c.req.valid('param');
        const newTasks = await autoGenerateTasksFromOverview(ticketId);
        return c.json({ success: true, tasks: newTasks });
    }
).get("/api/tickets/bulk-tasks",
    zValidator('query', z.object({
        ids: z.string().transform(str => str.split(',')),
    })),
    async (c) => {
        const { ids } = c.req.valid('query');
        const tasks = await getTasksForTickets(ids);
        return c.json({ success: true, tasks });
    }
);


export type TicketRouteTypes = typeof ticketRoutes;