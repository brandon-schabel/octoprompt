import {
    eq,
    and,
    inArray,
    sql,
    desc,

    db
} from "@db"

import { CreateTicketBody, UpdateTicketBody, schema } from "shared";
import { ApiError } from "shared";
import type { InferSelectModel } from "drizzle-orm";
import { OpenRouterProviderService } from "./model-providers/providers/open-router-provider";
import { promptsMap } from "@/utils/prompts-map";
import { getFullProjectSummary } from "@/utils/get-full-project-summary";
import { z } from "zod";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { DEFAULT_MODEL_CONFIGS } from "shared";

const { tickets, ticketFiles, ticketTasks, files, } = schema;

type Ticket = schema.Ticket;
type TicketFile = schema.TicketFile;
type NewTicket = schema.NewTicket;
type TicketTask = schema.TicketTask;
type NewTicketTask = schema.NewTicketTask;

const validTaskFormatPrompt = `IMPORTANT: Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "Task title here",
      "description": "Optional description here"
    }
  ]
}`;



export const defeaultTaskPrompt = `You are a technical project manager helping break down tickets into actionable tasks.
Given a ticket's title and overview, suggest specific, concrete tasks that would help complete the ticket.
Focus on technical implementation tasks, testing, and validation steps.
Each task should be clear and actionable.

${validTaskFormatPrompt}
`;



export const octopromptPlanningPrompt = `
${promptsMap.octopromptPlanningMetaPrompt}

${defeaultTaskPrompt}
`


export function stripTripleBackticks(text: string): string {
    // This regex captures everything inside the first ```json ... ``` block
    // or (if not found) the first ``` ... ``` block.
    // If there's more than one, we only handle the first. Adjust as needed.
    const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/;
    const match = text.match(tripleBacktickRegex);
    if (match) {
        return match[1].trim();
    }
    // If no triple backticks, return the original
    return text.trim();
}

// Define the Zod schema for task suggestions outside the class
export const TaskSuggestionsZodSchema = z.object({
    tasks: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
    })),
});

export type TaskSuggestions = z.infer<typeof TaskSuggestionsZodSchema>;

export class TicketService {
    private openRouterProvider: OpenRouterProviderService;

    constructor() {
        this.openRouterProvider = new OpenRouterProviderService();
    }

    async createTicket(data: CreateTicketBody): Promise<Ticket> {
        const newItem: NewTicket = {
            projectId: data.projectId,
            title: data.title,
            overview: data.overview ?? "",
            status: data.status ?? "open",
            priority: data.priority ?? "normal",
            suggestedFileIds: data.suggestedFileIds
                ? JSON.stringify(data.suggestedFileIds)
                : "[]",
        };

        const [created] = await db.insert(tickets)
            .values(newItem)
            .returning();

        return created;
    }

    async getTicketById(ticketId: string): Promise<Ticket | null> {
        const [found] = await db.select()
            .from(tickets)
            .where(eq(tickets.id, ticketId))
            .limit(1);

        return found ?? null;
    }

    async listTicketsByProject(projectId: string, statusFilter?: string): Promise<Ticket[]> {
        const whereClause = statusFilter
            ? and(eq(tickets.projectId, projectId), eq(tickets.status, statusFilter))
            : eq(tickets.projectId, projectId);

        return db.select()
            .from(tickets)
            .where(whereClause)
            .orderBy(desc(tickets.createdAt));
    }

    async updateTicket(ticketId: string, data: UpdateTicketBody): Promise<Ticket | null> {
        const existing = await this.getTicketById(ticketId);
        if (!existing) {
            return null;
        }

        let suggestedFileIds: string | undefined;
        if (data.suggestedFileIds) {
            const allIds = data.suggestedFileIds;
            const foundFiles = await db
                .select({ id: files.id })
                .from(files)
                .where(inArray(files.id, allIds));
            const foundIds = new Set(foundFiles.map((f) => f.id));
            const invalids = allIds.filter((id) => !foundIds.has(id));
            if (invalids.length) {
                throw new ApiError(
                    `Some fileIds no longer exist on disk: ${invalids.join(", ")}`,
                    400,
                    "INVALID_FILE_IDS"
                );
            }

            suggestedFileIds = JSON.stringify(allIds);
        }

        const [updated] = await db
            .update(tickets)
            .set({
                title: data.title ?? existing.title,
                overview: data.overview ?? existing.overview,
                status: data.status ?? existing.status,
                priority: data.priority ?? existing.priority,
                suggestedFileIds: suggestedFileIds ?? existing.suggestedFileIds,
                updatedAt: new Date(),
            })
            .where(eq(tickets.id, ticketId))
            .returning();

        return updated ?? null;
    }

    async deleteTicket(ticketId: string): Promise<boolean> {
        const existing = await this.getTicketById(ticketId);
        if (!existing) return false;

        const [deleted] = await db.delete(tickets)
            .where(eq(tickets.id, ticketId))
            .returning();

        return !!deleted;
    }

    async linkFilesToTicket(ticketId: string, fileIds: string[]): Promise<TicketFile[]> {
        const existingTicket = await this.getTicketById(ticketId);
        if (!existingTicket) {
            throw new Error(`Ticket ${ticketId} not found`);
        }

        const rowsToInsert = fileIds.map(fileId => ({
            ticketId,
            fileId,
        }));

        await db.insert(ticketFiles).values(rowsToInsert).onConflictDoNothing();
        return this.getTicketFiles(ticketId);
    }

    async getTicketFiles(ticketId: string): Promise<TicketFile[]> {
        return db.select()
            .from(ticketFiles)
            .where(eq(ticketFiles.ticketId, ticketId));
    }

    async suggestTasksForTicket(ticketId: string, userContext?: string): Promise<string[]> {
        console.log("[TicketService] Starting task suggestion for ticket:", ticketId);

        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            console.error("[TicketService] Ticket not found:", ticketId);
            throw new Error(`Ticket ${ticketId} not found`);
        }

        const projectId = ticket.projectId;
        const projectSummary = await getFullProjectSummary(projectId);

        const userMessage = `Please suggest tasks for this ticket:
Title: ${ticket.title}
Overview: ${ticket.overview}

UserContext: ${userContext ? `Additional Context: ${userContext}` : ''}

Below is a combined summary of project files:
${projectSummary}
`;

        try {
            const cfg = DEFAULT_MODEL_CONFIGS['suggest-ticket-tasks'];

            const result = await fetchStructuredOutput(this.openRouterProvider, {
                userMessage,
                systemMessage: octopromptPlanningPrompt,
                zodSchema: TaskSuggestionsZodSchema,
                schemaName: "TaskSuggestions",
                model: cfg.model,
                temperature: cfg.temperature,
                chatId: `ticket-${ticketId}-suggest-tasks`,
            });


            return result.tasks.map(task => task.title);
        } catch (error) {
            console.error("[TicketService] Error in task suggestion:", error);
            if (error instanceof Error) {
                console.error("[TicketService] Error details:", {
                    message: error.message,
                    stack: error.stack,
                });
            }
            return [];
        }
    }

    async getTicketsWithFiles(projectId: string): Promise<(Ticket & { fileIds: string[] })[]> {
        const allTickets = await db.select().from(tickets).where(eq(tickets.projectId, projectId));
        const ticketIds = allTickets.map(t => t.id);
        if (!ticketIds.length) return [];

        const allLinks = await db.select().from(ticketFiles)
            .where(inArray(ticketFiles.ticketId, ticketIds));

        const mapping: Record<string, string[]> = {};
        for (const link of allLinks) {
            if (!mapping[link.ticketId]) {
                mapping[link.ticketId] = [];
            }
            mapping[link.ticketId].push(link.fileId);
        }

        return allTickets.map(t => ({
            ...t,
            fileIds: mapping[t.id] ?? [],
        }));
    }

    /*************************************
     * TICKET TASKS
     *************************************/
    // Creates a single new task
    async createTask(ticketId: string, content: string): Promise<TicketTask> {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new ApiError(`Ticket ${ticketId} not found`, 404, "NOT_FOUND");
        }
        // find max existing orderIndex:
        const [maxOrder] = await db
            .select({ max: sql<number>`MAX(${ticketTasks.orderIndex})`.as("max") })
            .from(ticketTasks)
            .where(eq(ticketTasks.ticketId, ticketId));

        const nextIndex = (maxOrder?.max ?? 0) + 1;
        const insertData: NewTicketTask = {
            ticketId,
            content,
            done: false,
            orderIndex: nextIndex,
        };
        const [created] = await db.insert(ticketTasks).values(insertData).returning();
        return created;
    }

    // Retrieves all tasks for a ticket
    async getTasks(ticketId: string): Promise<TicketTask[]> {
        return db
            .select()
            .from(ticketTasks)
            .where(eq(ticketTasks.ticketId, ticketId))
            .orderBy(ticketTasks.orderIndex);
    }

    // Updates a task's content or done status
    async updateTask(
        ticketId: string,
        taskId: string,
        updates: { content?: string; done?: boolean }
    ): Promise<TicketTask | null> {
        const existing = await db
            .select()
            .from(ticketTasks)
            .where(and(
                eq(ticketTasks.id, taskId),
                eq(ticketTasks.ticketId, ticketId)
            ))
            .limit(1);

        if (!existing.length) {
            return null;
        }
        const updateObj: Partial<Pick<TicketTask, "content" | "done">> = {};
        if (typeof updates.content === "string") {
            updateObj.content = updates.content;
        }
        if (typeof updates.done === "boolean") {
            updateObj.done = updates.done;
        }
        const [updated] = await db
            .update(ticketTasks)
            .set(updateObj)
            .where(eq(ticketTasks.id, taskId))
            .returning();
        return updated ?? null;
    }

    // Delete a task
    async deleteTask(ticketId: string, taskId: string): Promise<boolean> {
        const [deleted] = await db
            .delete(ticketTasks)
            .where(and(
                eq(ticketTasks.id, taskId),
                eq(ticketTasks.ticketId, ticketId)
            ))
            .returning();
        return !!deleted;
    }

    // Reorder tasks (bulk update of orderIndex)
    async reorderTasks(
        ticketId: string,
        tasks: Array<{ taskId: string; orderIndex: number }>
    ): Promise<TicketTask[]> {
        // We'll do a transaction or just update each.
        for (const { taskId, orderIndex } of tasks) {
            await db
                .update(ticketTasks)
                .set({ orderIndex })
                .where(and(
                    eq(ticketTasks.id, taskId),
                    eq(ticketTasks.ticketId, ticketId)
                ));
        }
        // Return updated tasks
        return this.getTasks(ticketId);
    }

    /**
     * Auto-generate tasks from the overview.  Could call an LLM if needed.
     * We'll do a mock or reuse suggestTasksForTicket. Then we can create the tasks in DB.
     */
    async autoGenerateTasksFromOverview(ticketId: string): Promise<TicketTask[]> {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new ApiError(`Ticket ${ticketId} not found`, 404, "NOT_FOUND");
        }
        // For now, reuse suggestTasksForTicket logic:
        const suggestions = await this.suggestTasksForTicket(ticketId, ticket.overview ?? "");
        const inserted: TicketTask[] = [];
        for (const [idx, content] of suggestions.entries()) {
            const newRow: NewTicketTask = {
                ticketId,
                content,
                done: false,
                orderIndex: idx,
            };
            const [created] = await db.insert(ticketTasks).values(newRow).returning();
            inserted.push(created);
        }
        return inserted;
    }

    /**
     * Lists tickets for a project along with their task counts
     */
    async listTicketsWithTaskCount(
        projectId: string,
        statusFilter?: string
    ): Promise<Array<Ticket & { taskCount: number }>> {
        console.log("listTicketsWithTaskCount called with:", { projectId, statusFilter });

        const whereClause = statusFilter && statusFilter !== "all"
            ? and(eq(tickets.projectId, projectId), eq(tickets.status, statusFilter))
            : eq(tickets.projectId, projectId);

        type TicketRow = InferSelectModel<typeof tickets> & { taskCount: number };

        const rows = await db
            .select({
                id: tickets.id,
                projectId: tickets.projectId,
                title: tickets.title,
                overview: tickets.overview,
                status: tickets.status,
                priority: tickets.priority,
                suggestedFileIds: tickets.suggestedFileIds,
                createdAt: tickets.createdAt,
                updatedAt: tickets.updatedAt,
                taskCount: sql<number>`COUNT(${ticketTasks.id})`.as("taskCount"),
            })
            .from(tickets)
            .leftJoin(ticketTasks, eq(ticketTasks.ticketId, tickets.id))
            .where(whereClause)
            .groupBy(tickets.id)
            .orderBy(desc(tickets.createdAt));

        console.log("Query results:", rows);

        const result = rows.map((r: TicketRow) => ({
            id: r.id,
            projectId: r.projectId,
            title: r.title,
            overview: r.overview,
            status: r.status,
            priority: r.priority,
            suggestedFileIds: r.suggestedFileIds,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            taskCount: Number(r.taskCount || 0),
        }));

        console.log("Mapped results:", result);
        return result;
    }

    /**
     * Get tasks for multiple tickets in a single query
     */
    async getTasksForTickets(ticketIds: string[]): Promise<Record<string, TicketTask[]>> {
        if (!ticketIds.length) return {};

        const tasks = await db
            .select()
            .from(ticketTasks)
            .where(inArray(ticketTasks.ticketId, ticketIds))
            .orderBy(ticketTasks.orderIndex);

        // Group tasks by ticketId
        const tasksByTicket: Record<string, TicketTask[]> = {};
        for (const task of tasks) {
            if (!tasksByTicket[task.ticketId]) {
                tasksByTicket[task.ticketId] = [];
            }
            tasksByTicket[task.ticketId].push(task);
        }

        return tasksByTicket;
    }
    /**
 * Returns tickets for a project along with each ticket's full list of tasks.
 */
    async listTicketsWithTasks(
        projectId: string,
        statusFilter?: string
    ): Promise<Array<Ticket & { tasks: TicketTask[] }>> {

        // 1) Fetch all tickets for the given project & optional status.
        const baseTickets = await this.listTicketsByProject(projectId, statusFilter);
        if (!baseTickets.length) {
            return [];
        }

        // 2) Extract their IDs
        const ticketIds = baseTickets.map(t => t.id);

        // 3) Fetch tasks for all tickets in one shot
        const tasksByTicket = await this.getTasksForTickets(ticketIds);

        // 4) Merge tasks into their corresponding ticket
        const results = baseTickets.map(ticket => ({
            ...ticket,
            tasks: tasksByTicket[ticket.id] ?? [],
        }));

        return results;
    }

    /**
     * Helper to parse suggestedFileIds from a ticket
     */
    private parseSuggestedFileIds(ticket: Ticket): string[] {
        try {
            return JSON.parse(ticket.suggestedFileIds || "[]");
        } catch {
            return [];
        }
    }

    /**
     * Get a ticket with its suggested file IDs parsed
     */
    async getTicketWithSuggestedFiles(ticketId: string): Promise<(Ticket & { parsedSuggestedFileIds: string[] }) | null> {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) return null;

        return {
            ...ticket,
            parsedSuggestedFileIds: this.parseSuggestedFileIds(ticket)
        };
    }

}