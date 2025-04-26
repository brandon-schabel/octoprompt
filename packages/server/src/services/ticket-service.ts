import { db } from "@/utils/database";
import { ApiError, MEDIUM_MODEL_CONFIG } from "shared";
import { getFullProjectSummary } from "@/utils/get-full-project-summary";
import { z } from "zod";
import { APIProviders } from "shared/src/schemas/provider-key.schemas";
import {
  CreateTicketBody, UpdateTicketBody,
  TicketReadSchema,
  TicketTaskReadSchema,
  TicketFileReadSchema,
  TicketCreateSchema,
  TicketUpdateSchema,
  TicketTaskCreateSchema,
  type Ticket,
  type TicketTask,
  type TicketFile,
} from "shared/src/schemas/ticket.schemas";
import { randomUUID } from "crypto";
import { aiProviderInterface } from "./model-providers/providers/ai-provider-interface-services";

const validTaskFormatPrompt = `IMPORTANT: Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "Task title here",
      "description": "Optional description here"
    }
  ]
}`;

export const defaultTaskPrompt = `You are a technical project manager helping break down tickets into actionable tasks.
Given a ticket's title and overview, suggest specific, concrete tasks that would help complete the ticket.
Focus on technical implementation tasks, testing, and validation steps.
Each task should be clear and actionable.

${validTaskFormatPrompt}
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
  }))
});
export type TaskSuggestions = z.infer<typeof TaskSuggestionsZodSchema>;

export async function fetchTaskSuggestionsForTicket(
  ticket: Ticket,
  userContext: string | undefined
): Promise<TaskSuggestions> {
  const projectSummary = await getFullProjectSummary(ticket.projectId);

  const userMessage = `Please suggest tasks for this ticket:
Title: ${ticket.title}
Overview: ${ticket.overview}

UserContext: ${userContext ? `Additional Context: ${userContext}` : ''}

Below is a combined summary of project files:
${projectSummary}
`;

  const cfg = MEDIUM_MODEL_CONFIG;
  if (!cfg.model) {
    throw new ApiError(500, `Model not configured for 'suggest-ticket-tasks'`, "CONFIG_ERROR");
  }

  const result = await aiProviderInterface.generateStructuredData({
    provider: cfg.provider as APIProviders || 'openai',
    prompt: userMessage,
    systemMessage: defaultTaskPrompt,
    schema: TaskSuggestionsZodSchema,
    options: {
      model: cfg.model,
      temperature: cfg.temperature,
    },
  });

  return result;
}

function mapTicket(row: any): Ticket {
  const mapped = {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    overview: row.overview,
    status: row.status,
    priority: row.priority,
    suggestedFileIds: row.suggested_file_ids,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
  const validated = TicketReadSchema.parse(mapped);
  return {
    ...validated,
    createdAt: new Date(validated.createdAt),
    updatedAt: new Date(validated.updatedAt)
  };
}

function mapTicketTask(row: any): TicketTask {
  const mapped = {
    id: row.id,
    ticketId: row.ticket_id,
    content: row.content,
    done: row.done === 1,
    orderIndex: row.order_index,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
  const validated = TicketTaskReadSchema.parse(mapped);
  return {
    ...validated,
    createdAt: new Date(validated.createdAt),
    updatedAt: new Date(validated.updatedAt)
  };
}

function mapTicketFile(row: any): TicketFile {
  const mapped = {
    ticketId: row.ticket_id,
    fileId: row.file_id
  };
  return TicketFileReadSchema.parse(mapped);
}

function validateCreateTicket(data: CreateTicketBody) {
  return TicketCreateSchema.parse({
    projectId: data.projectId,
    title: data.title,
    overview: data.overview ?? "",
    status: data.status ?? "open",
    priority: data.priority ?? "normal",
    suggestedFileIds: data.suggestedFileIds ? JSON.stringify(data.suggestedFileIds) : "[]"
  });
}

function validateUpdateTicket(data: UpdateTicketBody) {
  return TicketUpdateSchema.parse({
    title: data.title,
    overview: data.overview,
    status: data.status,
    priority: data.priority,
    suggestedFileIds: data.suggestedFileIds ? JSON.stringify(data.suggestedFileIds) : undefined
  });
}

function validateCreateTask(ticketId: string, content: string) {
  return TicketTaskCreateSchema.parse({
    ticketId,
    content,
    done: false
  });
}

export async function createTicket(data: CreateTicketBody): Promise<Ticket> {
  const validatedData = validateCreateTicket(data);
  const newTicketId = randomUUID();

  const stmt = db.prepare(`
      INSERT INTO tickets (id, project_id, title, overview, status, priority, suggested_file_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `);
  const created = stmt.get(
    newTicketId,
    validatedData.projectId,
    validatedData.title,
    validatedData.overview ?? "",
    validatedData.status ?? "open",
    validatedData.priority ?? "normal",
    validatedData.suggestedFileIds ?? "[]"
  ) as any;
  if (!created) {
    throw new ApiError(500, "Failed to create ticket", "CREATE_FAILED");
  }
  return mapTicket(created);
}

export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const stmt = db.prepare(`SELECT * FROM tickets WHERE id = ? LIMIT 1`);
  const found = stmt.get(ticketId) as any;
  if (!found) return null;
  return mapTicket(found);
}

export async function listTicketsByProject(projectId: string, statusFilter?: string): Promise<Ticket[]> {
  let stmt;
  if (statusFilter) {
    stmt = db.prepare(`SELECT * FROM tickets WHERE project_id = ? AND status = ? ORDER BY created_at DESC`);
    const rows = stmt.all(projectId, statusFilter) as any[];
    return rows.map(mapTicket);
  } else {
    stmt = db.prepare(`SELECT * FROM tickets WHERE project_id = ? ORDER BY created_at DESC`);
    const rows = stmt.all(projectId) as any[];
    return rows.map(mapTicket);
  }
}

export async function updateTicket(ticketId: string, data: UpdateTicketBody): Promise<Ticket | null> {
  const existing = await getTicketById(ticketId);
  if (!existing) return null;

  const validatedData = validateUpdateTicket(data);

  if (validatedData.suggestedFileIds !== undefined) {
    let fileIds: string[] = [];
    try {
      fileIds = JSON.parse(validatedData.suggestedFileIds);
    } catch (error) {
      fileIds = [];
    }
    if (fileIds.length > 0) {
      const stmtFile = db.prepare(`SELECT 1 as present FROM files WHERE id = ? AND project_id = ? LIMIT 1`);
      for (const fileId of fileIds) {
        const file = stmtFile.get(fileId, existing.projectId);
        if (!file) {
          throw new ApiError(400, "Some fileIds no longer exist on disk", "FILE_NOT_FOUND");
        }
      }
    }
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (validatedData.title !== undefined) {
    updates.push('title = ?');
    values.push(validatedData.title);
  }
  if (validatedData.overview !== undefined) {
    updates.push('overview = ?');
    values.push(validatedData.overview);
  }
  if (validatedData.status !== undefined) {
    updates.push('status = ?');
    values.push(validatedData.status);
  }
  if (validatedData.priority !== undefined) {
    updates.push('priority = ?');
    values.push(validatedData.priority);
  }
  if (validatedData.suggestedFileIds !== undefined) {
    updates.push('suggested_file_ids = ?');
    values.push(validatedData.suggestedFileIds);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');

  const updateQuery = `
      UPDATE tickets 
      SET ${updates.join(', ')}
      WHERE id = ?
      RETURNING *
    `;

  values.push(ticketId);
  const stmt = db.prepare(updateQuery);
  const updated = stmt.get(...values) as any;

  if (!updated) return null;
  return mapTicket(updated);
}

export async function deleteTicket(ticketId: string): Promise<boolean> {
  const stmt = db.prepare(`DELETE FROM tickets WHERE id = ? RETURNING *`);
  const deleted = stmt.get(ticketId) as any;
  return !!deleted;
}

export async function linkFilesToTicket(ticketId: string, fileIds: string[]): Promise<TicketFile[]> {
  const existingTicket = await getTicketById(ticketId);
  if (!existingTicket) throw new Error(`Ticket ${ticketId} not found`);
  const stmt = db.prepare(`INSERT OR IGNORE INTO ticket_files (ticket_id, file_id) VALUES (?, ?)`);
  for (const fileId of fileIds) {
    stmt.run(ticketId, fileId);
  }
  return getTicketFiles(ticketId);
}

export async function getTicketFiles(ticketId: string): Promise<TicketFile[]> {
  const stmt = db.prepare(`SELECT * FROM ticket_files WHERE ticket_id = ?`);
  const rows = stmt.all(ticketId) as any[];
  return rows.map(mapTicketFile);
}

export async function suggestTasksForTicket(ticketId: string, userContext?: string): Promise<string[]> {
  console.log("[TicketService] Starting task suggestion for ticket:", ticketId);
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    console.error("[TicketService] Ticket not found:", ticketId);
    throw new Error(`Ticket ${ticketId} not found`);
  }
  try {
    const suggestions = await fetchTaskSuggestionsForTicket(ticket, userContext);
    return suggestions.tasks.map(task => task.title);
  } catch (error) {
    console.error("[TicketService] Error in task suggestion:", error);
    if (error instanceof Error) {
      console.error("[TicketService] Error details:", { message: error.message, stack: error.stack });
    }
    return [];
  }
}

export async function getTicketsWithFiles(projectId: string): Promise<(Ticket & { fileIds: string[] })[]> {
  const stmtTickets = db.prepare(`SELECT * FROM tickets WHERE project_id = ?`);
  const allTickets = stmtTickets.all(projectId) as any[];
  if (allTickets.length === 0) return [];
  const ticketIds = allTickets.map((t: any) => t.id);
  const placeholders = ticketIds.map(() => '?').join(', ');
  const stmtTicketFiles = db.prepare(`SELECT * FROM ticket_files WHERE ticket_id IN (${placeholders})`);
  const allLinks = stmtTicketFiles.all(...ticketIds) as Array<{ ticket_id: string; file_id: string }>;
  const mapping: Record<string, string[]> = {};
  for (const link of allLinks) {
    if (!mapping[link.ticket_id]) {
      mapping[link.ticket_id] = [];
    }
    mapping[link.ticket_id].push(link.file_id);
  }
  return allTickets.map((t: any) => ({
    ...t,
    fileIds: mapping[t.id] || []
  }));
}

export async function createTask(ticketId: string, content: string): Promise<TicketTask> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new ApiError(404, `Ticket ${ticketId} not found`, "NOT_FOUND");
  }
  const validatedData = validateCreateTask(ticketId, content);
  const stmtMax = db.prepare(`SELECT MAX(order_index) as max FROM ticket_tasks WHERE ticket_id = ?`);
  const row = stmtMax.get(ticketId) as { max: number | null };
  const nextIndex = (row?.max ?? 0) + 1;

  const newTaskId = randomUUID();

  const stmt = db.prepare(`
      INSERT INTO ticket_tasks (id, ticket_id, content, done, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `);

  const params: [string, string, string, number, number] = [
    newTaskId,
    validatedData.ticketId,
    validatedData.content,
    validatedData.done ? 1 : 0,
    nextIndex
  ];

  const createdTaskRaw = stmt.get(...params) as any;
  if (!createdTaskRaw) {
    throw new ApiError(500, "Failed to create task", "CREATE_FAILED");
  }
  return mapTicketTask(createdTaskRaw);
}

export async function getTasks(ticketId: string): Promise<TicketTask[]> {
  const stmt = db.prepare(`SELECT * FROM ticket_tasks WHERE ticket_id = ? ORDER BY order_index`);
  const taskRows = stmt.all(ticketId) as any[];
  return taskRows.map(mapTicketTask);
}

export async function deleteTask(ticketId: string, taskId: string): Promise<boolean> {
  const stmt = db.prepare(`DELETE FROM ticket_tasks WHERE id = ? AND ticket_id = ? RETURNING *`);
  const deletedTask = stmt.get(taskId, ticketId) as any;
  return !!deletedTask;
}

export async function reorderTasks(
  ticketId: string,
  tasks: Array<{ taskId: string; orderIndex: number }>
): Promise<TicketTask[]> {
  const stmt = db.prepare(`UPDATE ticket_tasks SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ticket_id = ?`);
  for (const { taskId, orderIndex } of tasks) {
    stmt.run(orderIndex, taskId, ticketId);
  }
  return getTasks(ticketId);
}

export async function autoGenerateTasksFromOverview(ticketId: string): Promise<TicketTask[]> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new ApiError(404, `Ticket ${ticketId} not found`, "NOT_FOUND");
  }
  const titles = await suggestTasksForTicket(ticketId, ticket.overview ?? "");
  const inserted: TicketTask[] = [];
  for (const [idx, content] of titles.entries()) {
    const stmt = db.prepare(`
          INSERT INTO ticket_tasks (id, ticket_id, content, done, order_index, created_at, updated_at)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `);
    const createdRaw = stmt.get(ticketId, content, 0, idx) as any;
    if (!createdRaw) {
      throw new ApiError(500, "Failed to create task", "CREATE_FAILED");
    }
    const createdTask = mapTicketTask(createdRaw);
    inserted.push(createdTask);
  }
  return inserted;
}

export async function listTicketsWithTaskCount(
  projectId: string,
  statusFilter?: string
): Promise<Array<Ticket & { taskCount: number; completedTaskCount: number }>> {
  let query: string;
  let params: any[];
  if (statusFilter && statusFilter !== "all") {
    query = `
          SELECT t.*, 
            (SELECT COUNT(*) FROM ticket_tasks tt WHERE tt.ticket_id = t.id) as taskCount,
            (SELECT COUNT(*) FROM ticket_tasks tt WHERE tt.ticket_id = t.id AND tt.done = 1) as completedTaskCount
          FROM tickets t
          WHERE t.project_id = ? AND t.status = ?
          ORDER BY t.created_at DESC
        `;
    params = [projectId, statusFilter];
  } else {
    query = `
          SELECT t.*, 
            (SELECT COUNT(*) FROM ticket_tasks tt WHERE tt.ticket_id = t.id) as taskCount,
            (SELECT COUNT(*) FROM ticket_tasks tt WHERE tt.ticket_id = t.id AND tt.done = 1) as completedTaskCount
          FROM tickets t
          WHERE t.project_id = ?
          ORDER BY t.created_at DESC
        `;
    params = [projectId];
  }
  const stmt = db.prepare(query);
  const rowsCount = stmt.all(...params) as any[];
  return rowsCount.map((r: any) => ({
    ...r,
    taskCount: Number(r.taskCount || 0),
    completedTaskCount: Number(r.completedTaskCount || 0)
  }));
}

export async function getTasksForTickets(ticketIds: string[]): Promise<Record<string, TicketTask[]>> {
  if (!ticketIds.length) return {};
  const placeholders = ticketIds.map(() => '?').join(', ');
  const stmt = db.prepare(`SELECT * FROM ticket_tasks WHERE ticket_id IN (${placeholders}) ORDER BY order_index`);
  const tasks = stmt.all(...ticketIds) as any[];
  const tasksByTicket: Record<string, TicketTask[]> = {};
  for (const task of tasks) {
    if (!tasksByTicket[task.ticket_id]) {
      tasksByTicket[task.ticket_id] = [];
    }
    tasksByTicket[task.ticket_id].push(mapTicketTask(task));
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
  const ticketIds = baseTickets.map((t: any) => t.id);
  const tasksByTicket = await getTasksForTickets(ticketIds);
  return baseTickets.map((ticket: any) => ({
    ...ticket,
    tasks: tasksByTicket[ticket.id] || [],
  }));
}

export async function getTicketWithSuggestedFiles(ticketId: string): Promise<(Ticket & { parsedSuggestedFileIds: string[] }) | null> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) return null;
  return {
    ...ticket,
    parsedSuggestedFileIds: (() => {
      try {
        return JSON.parse(ticket.suggestedFileIds || "[]");
      } catch {
        return [];
      }
    })(),
  };
}

export async function updateTask(ticketId: string, taskId: string, updates: { content?: string; done?: boolean }): Promise<TicketTask | null> {
  try {
    const stmt = db.prepare(`UPDATE ticket_tasks SET content = COALESCE(?, content), done = COALESCE(?, done) WHERE ticket_id = ? AND id = ? RETURNING *`);
    const updatedTask = stmt.get(
      updates.content === undefined ? null : updates.content,
      updates.done === undefined ? null : updates.done,
      ticketId,
      taskId
    ) as any;
    return updatedTask ?? null;
  } catch (error: any) {
    // If the error message indicates that no row was affected, return null
    if (error && typeof error.message === "string" && (error.message.includes("no such") || error.message.includes("not found"))) {
      return null;
    }
    throw error;
  }
}

export async function suggestFilesForTicket(
  ticketId: string,
  options: { extraUserInput?: string }
): Promise<{ recommendedFileIds: string[], combinedSummaries?: string, message?: string }> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found", "NOT_FOUND");
  }

  const tasks = await getTasks(ticketId);

  // This is a simplified implementation - you'd likely want to actually
  // call an AI service to get file suggestions based on the ticket content
  try {
    // Get files from the project that might be relevant
    const projectFiles = await db.prepare(
      `SELECT id FROM files WHERE project_id = ?`
    ).all(ticket.projectId) as any[];

    // For now, just return the first 5 files or fewer if there aren't many
    const recommendedFileIds = projectFiles
      .slice(0, Math.min(5, projectFiles.length))
      .map((file: any) => file.id);

    return {
      recommendedFileIds,
      combinedSummaries: `Combined summary for ticket: ${ticket.title}`,
      message: "Files suggested based on ticket content"
    };
  } catch (error) {
    console.error("[TicketService] Error suggesting files:", error);
    return {
      recommendedFileIds: [],
      message: "Failed to suggest files"
    };
  }
}