import {
    eq,
    and,
    inArray,
    sql,
    desc,
    db
} from "@db";

import { CreateTicketBody, UpdateTicketBody, schema } from "shared";
import { ApiError } from "shared";
import type { InferSelectModel } from "drizzle-orm";
import { OpenRouterProviderService } from "./model-providers/providers/open-router-provider";
import { promptsMap } from "@/utils/prompts-map";
import { getFullProjectSummary } from "@/utils/get-full-project-summary";
import { z } from "zod";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { DEFAULT_MODEL_CONFIGS } from "shared";

const { tickets, ticketFiles, ticketTasks, files } = schema;

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
`;

export function stripTripleBackticks(text: string): string {
    const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/;
    const match = text.match(tripleBacktickRegex);
    if (match) {
        return match[1].trim();
    }
    return text.trim();
}

export const TaskSuggestionsZodSchema = z.object({
    tasks: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
    })),
});
export type TaskSuggestions = z.infer<typeof TaskSuggestionsZodSchema>;

const openRouterProvider = new OpenRouterProviderService();

export async function createTicket(data: CreateTicketBody): Promise<Ticket> {
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

export async function getTicketById(ticketId: string): Promise<Ticket | null> {
    const [found] = await db.select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

    return found ?? null;
}

export async function listTicketsByProject(projectId: string, statusFilter?: string): Promise<Ticket[]> {
    const whereClause = statusFilter
        ? and(eq(tickets.projectId, projectId), eq(tickets.status, statusFilter))
        : eq(tickets.projectId, projectId);

    return db.select()
        .from(tickets)
        .where(whereClause)
        .orderBy(desc(tickets.createdAt));
}

export async function updateTicket(ticketId: string, data: UpdateTicketBody): Promise<Ticket | null> {
    const existing = await getTicketById(ticketId);
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

export async function deleteTicket(ticketId: string): Promise<boolean> {
    const existing = await getTicketById(ticketId);
    if (!existing) return false;

    const [deleted] = await db.delete(tickets)
        .where(eq(tickets.id, ticketId))
        .returning();

    return !!deleted;
}

export async function linkFilesToTicket(ticketId: string, fileIds: string[]): Promise<TicketFile[]> {
    const existingTicket = await getTicketById(ticketId);
    if (!existingTicket) {
        throw new Error(`Ticket ${ticketId} not found`);
    }

    const rowsToInsert = fileIds.map(fileId => ({
        ticketId,
        fileId,
    }));

    await db.insert(ticketFiles).values(rowsToInsert).onConflictDoNothing();
    return getTicketFiles(ticketId);
}

export async function getTicketFiles(ticketId: string): Promise<TicketFile[]> {
    return db.select()
        .from(ticketFiles)
        .where(eq(ticketFiles.ticketId, ticketId));
}

export async function suggestTasksForTicket(ticketId: string, userContext?: string): Promise<string[]> {
    console.log("[TicketService] Starting task suggestion for ticket:", ticketId);

    const ticket = await getTicketById(ticketId);
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

        const result = await fetchStructuredOutput(openRouterProvider, {
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

export async function getTicketsWithFiles(projectId: string): Promise<(Ticket & { fileIds: string[] })[]> {
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

export async function createTask(ticketId: string, content: string): Promise<TicketTask> {
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        throw new ApiError(`Ticket ${ticketId} not found`, 404, "NOT_FOUND");
    }
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

export async function getTasks(ticketId: string): Promise<TicketTask[]> {
    return db
        .select()
        .from(ticketTasks)
        .where(eq(ticketTasks.ticketId, ticketId))
        .orderBy(ticketTasks.orderIndex);
}

export async function updateTask(
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

export async function deleteTask(ticketId: string, taskId: string): Promise<boolean> {
    const [deleted] = await db
        .delete(ticketTasks)
        .where(and(
            eq(ticketTasks.id, taskId),
            eq(ticketTasks.ticketId, ticketId)
        ))
        .returning();
    return !!deleted;
}

export async function reorderTasks(
    ticketId: string,
    tasks: Array<{ taskId: string; orderIndex: number }>
): Promise<TicketTask[]> {
    for (const { taskId, orderIndex } of tasks) {
        await db
            .update(ticketTasks)
            .set({ orderIndex })
            .where(and(
                eq(ticketTasks.id, taskId),
                eq(ticketTasks.ticketId, ticketId)
            ));
    }
    return getTasks(ticketId);
}

export async function autoGenerateTasksFromOverview(ticketId: string): Promise<TicketTask[]> {
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        throw new ApiError(`Ticket ${ticketId} not found`, 404, "NOT_FOUND");
    }
    const suggestions = await suggestTasksForTicket(ticketId, ticket.overview ?? "");
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

export async function listTicketsWithTaskCount(
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

export async function getTasksForTickets(ticketIds: string[]): Promise<Record<string, TicketTask[]>> {
    if (!ticketIds.length) return {};

    const tasks = await db
        .select()
        .from(ticketTasks)
        .where(inArray(ticketTasks.ticketId, ticketIds))
        .orderBy(ticketTasks.orderIndex);

    const tasksByTicket: Record<string, TicketTask[]> = {};
    for (const task of tasks) {
        if (!tasksByTicket[task.ticketId]) {
            tasksByTicket[task.ticketId] = [];
        }
        tasksByTicket[task.ticketId].push(task);
    }

    return tasksByTicket;
}

export async function listTicketsWithTasks(
    projectId: string,
    statusFilter?: string
): Promise<Array<Ticket & { tasks: TicketTask[] }>> {

    const baseTickets = await listTicketsByProject(projectId, statusFilter);
    if (!baseTickets.length) {
        return [];
    }

    const ticketIds = baseTickets.map(t => t.id);
    const tasksByTicket = await getTasksForTickets(ticketIds);

    return baseTickets.map(ticket => ({
        ...ticket,
        tasks: tasksByTicket[ticket.id] ?? [],
    }));
}

function parseSuggestedFileIds(ticket: Ticket): string[] {
    try {
        return JSON.parse(ticket.suggestedFileIds || "[]");
    } catch {
        return [];
    }
}

export async function getTicketWithSuggestedFiles(ticketId: string): Promise<(Ticket & { parsedSuggestedFileIds: string[] }) | null> {
    const ticket = await getTicketById(ticketId);
    if (!ticket) return null;

    return {
        ...ticket,
        parsedSuggestedFileIds: parseSuggestedFileIds(ticket)
    };
}