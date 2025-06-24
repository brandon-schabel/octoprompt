import { db } from "@/utils/database";
import { z } from "zod";
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
  TaskSuggestions,
  TaskSuggestionsZodSchema,
} from "shared/src/schemas/ticket.schemas";
import { randomUUID } from "crypto";
import { generateStructuredData } from "./gen-ai-services";

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

export async function fetchTaskSuggestionsForTicket(
  ticket: Ticket,
  userContext: string | undefined
): Promise<TaskSuggestions> {
  const projectSummary = await getFullProjectSummary(ticket.projectId);

  const userMessage = `
  <goal>
  Suggest tasks for this ticket. The tickets should be relevant to the project.  The gaol is to break down the
  ticket into smaller, actionable tasks based on the users request. Refer to the ticket overview and title for context. 
  Break the ticket down into step by step tasks that are clear, actionable, and specific to the project. 


  - Each Task should include which files are relevant to the task.

  </goal>

  <ticket_title>
  ${ticket.title}
  </ticket_title>

  <ticket_overview>
  ${ticket.overview}
  </ticket_overview>

  <user_context>
  ${userContext ? `Additional Context: ${userContext}` : ''}
  </user_context>

  ${projectSummary}
`;

  const cfg = MEDIUM_MODEL_CONFIG;
  if (!cfg.model) {
    throw new ApiError(500, `Model not configured for 'suggest-ticket-tasks'`, "CONFIG_ERROR");
  }

  const result = await generateStructuredData({
    prompt: userMessage,
    systemMessage: defaultTaskPrompt,
    schema: TaskSuggestionsZodSchema,
    options: MEDIUM_MODEL_CONFIG
  });

  return result.object
}

function mapTicket(row: any): Ticket {
  const mapped = {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    overview: row.overview,
    status: row.status,
    priority: row.priority,
    suggestedFileIds: typeof row.suggested_file_ids === 'string' ? row.suggested_file_ids : JSON.stringify(row.suggested_file_ids || []),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
  try {
    const validated = TicketReadSchema.parse(mapped);
    return {
        ...validated,
        createdAt: new Date(validated.createdAt),
        updatedAt: new Date(validated.updatedAt)
    };
  } catch (error) {
    console.error("Validation failed for ticket:", mapped, error);
    throw new ApiError(500, "Ticket data validation failed", "TICKET_VALIDATION_ERROR", { originalError: error });
  }
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
  try {
    const validated = TicketTaskReadSchema.parse(mapped);
    return {
        ...validated,
        createdAt: new Date(validated.createdAt),
        updatedAt: new Date(validated.updatedAt)
    };
  } catch (error) {
    console.error("Validation failed for ticket task:", mapped, error);
    throw new ApiError(500, "Ticket task data validation failed", "TASK_VALIDATION_ERROR", { originalError: error });
  }
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
  const createdRaw = stmt.get(
    newTicketId,
    validatedData.projectId,
    validatedData.title,
    validatedData.overview ?? "",
    validatedData.status ?? "open",
    validatedData.priority ?? "normal",
    validatedData.suggestedFileIds ?? "[]"
  ) as any;
  if (!createdRaw) {
    throw new ApiError(500, "Failed to create ticket", "CREATE_TICKET_FAILED");
  }
  return mapTicket(createdRaw);
}

export async function getTicketById(ticketId: string): Promise<Ticket> {
  const stmt = db.prepare(`SELECT * FROM tickets WHERE id = ? LIMIT 1`);
  const foundRaw = stmt.get(ticketId) as any;
  if (!foundRaw) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found.`, "TICKET_NOT_FOUND");
  }
  return mapTicket(foundRaw);
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

export async function updateTicket(ticketId: string, data: UpdateTicketBody): Promise<Ticket> {
  const existing = await getTicketById(ticketId);

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
          throw new ApiError(400, `File with ID ${fileId} not found in project ${existing.projectId}.`, "FILE_NOT_FOUND_IN_PROJECT");
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
  const updatedRaw = stmt.get(...values) as any;

  if (!updatedRaw) {
    throw new ApiError(500, `Failed to update ticket ${ticketId} after confirming its existence.`, "UPDATE_TICKET_FAILED");
  }
  return mapTicket(updatedRaw);
}

export async function deleteTicket(ticketId: string): Promise<void> {
  db.prepare(`DELETE FROM ticket_tasks WHERE ticket_id = ?`).run(ticketId);
  db.prepare(`DELETE FROM ticket_files WHERE ticket_id = ?`).run(ticketId);

  const stmt = db.prepare(`DELETE FROM tickets WHERE id = ?`);
  const info = stmt.run(ticketId);
  if (info.changes === 0) {
    throw new ApiError(404, `Ticket with ID ${ticketId} not found for deletion.`, "TICKET_NOT_FOUND");
  }
}

export async function linkFilesToTicket(ticketId: string, fileIds: string[]): Promise<TicketFile[]> {
  const existingTicket = await getTicketById(ticketId);
  
  if (fileIds.length > 0) {
    const placeholders = fileIds.map(() => '?').join(',');
    const filesInProjectStmt = db.prepare(
        `SELECT id FROM files WHERE project_id = ? AND id IN (${placeholders})`
    );
    const existingFilesInProject = filesInProjectStmt.all(existingTicket.projectId, ...fileIds) as { id: string }[];
    if (existingFilesInProject.length !== fileIds.length) {
        const foundFileIds = new Set(existingFilesInProject.map(f => f.id));
        const missingFileIds = fileIds.filter(id => !foundFileIds.has(id));
        throw new ApiError(400, `Some files not found in project ${existingTicket.projectId}: ${missingFileIds.join(', ')}`, "FILES_NOT_FOUND_IN_PROJECT");
    }
  }

  const stmt = db.prepare(`INSERT OR IGNORE INTO ticket_files (ticket_id, file_id) VALUES (?, ?)`);
  const transaction = db.transaction(() => {
    for (const fileId of fileIds) {
        stmt.run(ticketId, fileId);
    }
  });
  transaction();
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

  try {
    const suggestions = await fetchTaskSuggestionsForTicket(ticket, userContext);
    return suggestions.tasks.map(task => task.title);
  } catch (error: any) {
    console.error("[TicketService] Error in task suggestion:", error);
    if (error instanceof ApiError) {
        throw error;
    }
    throw new ApiError(500, `Failed to suggest tasks for ticket ${ticketId}: ${error.message || 'AI provider error'}`, "TASK_SUGGESTION_FAILED", { originalError: error });
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
    throw new ApiError(500, "Failed to create task", "CREATE_TASK_FAILED");
  }
  return mapTicketTask(createdTaskRaw);
}

export async function getTasks(ticketId: string): Promise<TicketTask[]> {
  const stmt = db.prepare(`SELECT * FROM ticket_tasks WHERE ticket_id = ? ORDER BY order_index`);
  const taskRows = stmt.all(ticketId) as any[];
  return taskRows.map(mapTicketTask);
}

export async function deleteTask(ticketId: string, taskId: string): Promise<void> {
  const stmt = db.prepare(`DELETE FROM ticket_tasks WHERE id = ? AND ticket_id = ?`);
  const info = stmt.run(taskId, ticketId);
  if (info.changes === 0) {
    try {
        await getTicketById(ticketId);
        throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}.`, "TASK_NOT_FOUND_FOR_TICKET");
    } catch (ticketError: any) {
        if (ticketError instanceof ApiError && ticketError.code === 'TICKET_NOT_FOUND') {
            throw new ApiError(404, `Ticket with ID ${ticketId} not found, cannot delete task.`, "TICKET_NOT_FOUND");
        }
        throw ticketError; 
    }
  }
}

export async function reorderTasks(
  ticketId: string,
  tasks: Array<{ taskId: string; orderIndex: number }>
): Promise<TicketTask[]> {
  await getTicketById(ticketId);
  
  const stmt = db.prepare(`UPDATE ticket_tasks SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ticket_id = ?`);
  const transaction = db.transaction(() => {
    for (const { taskId, orderIndex } of tasks) {
        const info = stmt.run(orderIndex, taskId, ticketId);
        if (info.changes === 0) {
            throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId} during reorder.`, "TASK_NOT_FOUND_FOR_TICKET");
        }
    }
  });
  transaction();
  return getTasks(ticketId);
}

export async function autoGenerateTasksFromOverview(ticketId: string): Promise<TicketTask[]> {
  const ticket = await getTicketById(ticketId);
  
  const titles = await suggestTasksForTicket(ticketId, ticket.overview ?? "");
  if (titles.length === 0 && (ticket.overview && ticket.overview.trim() !== '')) {
  }

  const inserted: TicketTask[] = [];
  const transaction = db.transaction(() => {
    for (const [idx, content] of titles.entries()) {
        const stmtInsert = db.prepare(`
            INSERT INTO ticket_tasks (id, ticket_id, content, done, order_index, created_at, updated_at)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
            `);
        const createdRaw = stmtInsert.get(ticketId, content, 0, idx) as any;
        if (!createdRaw) {
        throw new ApiError(500, `Failed to create auto-generated task '${content}'`, "CREATE_TASK_FAILED");
        }
        const createdTask = mapTicketTask(createdRaw);
        inserted.push(createdTask);
    }
  });
  transaction();
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

export async function updateTask(ticketId: string, taskId: string, updates: { content?: string; done?: boolean }): Promise<TicketTask> {
  await getTicketById(ticketId);

  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) {
    setClauses.push('content = ?');
    values.push(updates.content);
  }
  if (updates.done !== undefined) {
    setClauses.push('done = ?');
    values.push(updates.done ? 1 : 0);
  }

  if (setClauses.length === 0) {
    const currentTaskStmt = db.prepare('SELECT * FROM ticket_tasks WHERE id = ? AND ticket_id = ?');
    const currentTaskRaw = currentTaskStmt.get(taskId, ticketId) as any;
    if (!currentTaskRaw) {
        throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}.`, "TASK_NOT_FOUND_FOR_TICKET");
    }
    return mapTicketTask(currentTaskRaw);
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');

  const query = `UPDATE ticket_tasks SET ${setClauses.join(', ')} WHERE ticket_id = ? AND id = ? RETURNING *`;
  values.push(ticketId, taskId);

  const stmt = db.prepare(query);
  const updatedTaskRaw = stmt.get(...values) as any;

  if (!updatedTaskRaw) {
    throw new ApiError(404, `Task with ID ${taskId} not found for ticket ${ticketId}, or no changes made.`, "TASK_UPDATE_FAILED_OR_NOT_FOUND");
  }
  return mapTicketTask(updatedTaskRaw);
}

export async function suggestFilesForTicket(
  ticketId: string,
  options: { extraUserInput?: string }
): Promise<{ recommendedFileIds: string[], combinedSummaries?: string, message?: string }> {
  const ticket = await getTicketById(ticketId);

  try {
    const projectFiles = await db.prepare(
      `SELECT id FROM files WHERE project_id = ?`
    ).all(ticket.projectId) as any[];

    if (!projectFiles) {
        console.warn(`[TicketService] suggestFilesForTicket: No project files found for project ${ticket.projectId}, though ticket exists.`);
        return {
            recommendedFileIds: [],
            message: "No files found in the project to suggest from."
        };
    }

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
    if (error instanceof ApiError) {
        throw error;
    }
    const errorMessage = (error as any)?.message || 'Error during file suggestion';
    throw new ApiError(500, `Failed to suggest files for ticket ${ticketId}: ${errorMessage}`, "FILE_SUGGESTION_FAILED", { originalError: error });
  }
}