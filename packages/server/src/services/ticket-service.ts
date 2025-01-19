import { db } from "shared/database";
import {
    tickets,
    ticketFiles,
    ticketTasks,
    type Ticket,
    type TicketFile,
    type NewTicket,
    type TicketTask,
    type NewTicketTask,
    eq,
    and,
    inArray,
} from "shared";
import { CreateTicketBody, UpdateTicketBody } from "shared";
import { ApiError } from "shared";
import { desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getState } from "@/websocket/websocket-config";  // if you use that for global state

export class TicketService {

    async createTicket(data: CreateTicketBody): Promise<Ticket> {
        const newItem: NewTicket = {
            projectId: data.projectId,
            title: data.title,
            overview: data.overview ?? "",
            status: data.status ?? "open",
            priority: data.priority ?? "normal",
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
        const [updated] = await db.update(tickets)
            .set({
                ...data,
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
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new Error(`Ticket ${ticketId} not found`);
        }
        // e.g. call LLM or mock
        return [
            "Review acceptance criteria",
            "Implement data model changes",
            "Write unit tests",
        ];
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
}