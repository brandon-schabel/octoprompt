// Ticket storage layer using proper database columns instead of JSON
import { z } from 'zod'
import { TicketSchema, TicketTaskSchema, type Ticket, type TicketTask } from '@promptliano/schemas'
import { normalizeToUnixMs } from '@promptliano/shared/src/utils/parse-timestamp'
import { DatabaseManager, getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'

// Table names for database storage
const TICKETS_TABLE = 'tickets'
const TICKET_TASKS_TABLE = 'ticket_tasks'

// --- Schemas for Storage ---
// Store all tickets for a project as a map (Record) keyed by ticketId
export const TicketsStorageSchema = z.record(z.string(), TicketSchema)
export type TicketsStorage = z.infer<typeof TicketsStorageSchema>

// Store tasks within a specific ticket as a map (Record) keyed by taskId
export const TicketTasksStorageSchema = z.record(z.string(), TicketTaskSchema)
export type TicketTasksStorage = z.infer<typeof TicketTasksStorageSchema>

// --- Database Helper Functions ---

/**
 * Validates data against a schema and returns the validated data.
 */
async function validateData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): Promise<T> {
  const validationResult = await schema.safeParseAsync(data)
  if (!validationResult.success) {
    console.error(`Zod validation failed for ${context}:`, validationResult.error.errors)
    throw new ApiError(400, `Validation failed for ${context}`, 'VALIDATION_ERROR')
  }
  return validationResult.data
}

/**
 * Safely parse JSON with fallback value and error logging.
 */
function safeJsonParse<T>(json: string | null | undefined, fallback: T, context?: string): T {
  if (!json) return fallback
  
  try {
    return JSON.parse(json)
  } catch (error) {
    console.warn(`Failed to parse JSON${context ? ` for ${context}` : ''}: ${json}`, error)
    return fallback
  }
}

// --- Specific Data Accessors ---

class TicketStorage {
  /**
   * Get database instance lazily. Always get fresh instance to avoid closed db issues.
   */
  private getDb(): DatabaseManager {
    return getDb()
  }

  /** Reads all tickets for a specific project from the database. */
  async readTickets(projectId: number): Promise<TicketsStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Query tickets directly from columns
      const query = database.prepare(`
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          created_at, updated_at
        FROM ${TICKETS_TABLE}
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)

      const rows = query.all(projectId) as any[]

      // Convert rows to TicketsStorage
      const ticketsStorage: TicketsStorage = {}
      for (const row of rows) {
        const ticket: Ticket = {
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          overview: row.overview,
          status: row.status,
          priority: row.priority,
          suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
          suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
          suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
          created: row.created_at,
          updated: row.updated_at
        }

        // Validate the ticket
        const validatedTicket = await validateData(ticket, TicketSchema, `ticket ${ticket.id} in project ${projectId}`)
        ticketsStorage[String(validatedTicket.id)] = validatedTicket
      }

      return ticketsStorage
    } catch (error: any) {
      console.error(`Error reading tickets for project ${projectId} from database:`, error)
      throw new ApiError(500, `Failed to read tickets for project ${projectId}`, 'DB_READ_ERROR')
    }
  }

  /** Writes tickets for a specific project to the database. */
  async writeTickets(projectId: number, tickets: TicketsStorage): Promise<TicketsStorage> {
    try {
      const db = this.getDb()

      // Validate the entire storage structure
      const validatedTickets = await validateData(tickets, TicketsStorageSchema, `tickets for project ${projectId}`)

      // Use raw database transaction for atomic updates
      const database = db.getDatabase()

      database.transaction(() => {
        // First, delete all existing tickets for this project
        const deleteQuery = database.prepare(`
          DELETE FROM ${TICKETS_TABLE}
          WHERE project_id = ?
        `)
        deleteQuery.run(projectId)

        // Write all new tickets
        const now = Date.now()
        const insertQuery = database.prepare(`
          INSERT INTO ${TICKETS_TABLE} (
            id, project_id, title, overview, status, priority,
            suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        for (const [ticketId, ticket] of Object.entries(validatedTickets)) {
          // Ensure projectId is consistent
          if (ticket.projectId !== projectId) {
            throw new ApiError(400, `Ticket ${ticketId} has mismatched projectId`, 'INVALID_PROJECT_ID')
          }
          insertQuery.run(
            ticketId,
            ticket.projectId,
            ticket.title,
            ticket.overview,
            ticket.status,
            ticket.priority,
            JSON.stringify(ticket.suggestedFileIds || []),
            JSON.stringify(ticket.suggestedAgentIds || []),
            JSON.stringify(ticket.suggestedPromptIds || []),
            ticket.created || now,
            ticket.updated || now
          )
        }
      })()

      return validatedTickets
    } catch (error: any) {
      console.error(`Error writing tickets for project ${projectId} to database:`, error)
      throw new ApiError(500, `Failed to write tickets for project ${projectId}`, 'DB_WRITE_ERROR')
    }
  }

  /** Gets a specific ticket by ID. */
  async getTicketById(ticketId: number): Promise<Ticket | null> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          created_at, updated_at
        FROM ${TICKETS_TABLE}
        WHERE id = ?
      `)

      const row = query.get(ticketId) as any

      if (!row) {
        return null
      }

      const ticket: Ticket = {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        overview: row.overview,
        status: row.status,
        priority: row.priority,
        suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
        suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
        suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
        created: row.created_at,
        updated: row.updated_at
      }

      // Validate the ticket data
      return await validateData(ticket, TicketSchema, `ticket ${ticketId}`)
    } catch (error: any) {
      console.error(`Error reading ticket ${ticketId} from database:`, error)
      throw new ApiError(500, `Failed to read ticket ${ticketId}`, 'DB_READ_ERROR')
    }
  }

  /** Reads all tasks for a specific ticket. */
  async readTicketTasks(ticketId: number): Promise<TicketTasksStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Query tasks directly from columns
      const query = database.prepare(`
        SELECT 
          id, ticket_id, content, description, suggested_file_ids,
          done, order_index, estimated_hours, dependencies, tags,
          agent_id, suggested_prompt_ids, created_at, updated_at
        FROM ${TICKET_TASKS_TABLE}
        WHERE ticket_id = ?
        ORDER BY order_index ASC
      `)

      const rows = query.all(ticketId) as any[]

      // Convert rows to TicketTasksStorage
      const tasksStorage: TicketTasksStorage = {}
      for (const row of rows) {
        const task: TicketTask = {
          id: row.id,
          ticketId: row.ticket_id,
          content: row.content,
          description: row.description,
          suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'task.suggestedFileIds'),
          done: Boolean(row.done),
          orderIndex: row.order_index,
          estimatedHours: row.estimated_hours,
          dependencies: safeJsonParse(row.dependencies, [], 'task.dependencies'),
          tags: safeJsonParse(row.tags, [], 'task.tags'),
          agentId: row.agent_id,
          suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'task.suggestedPromptIds'),
          created: row.created_at,
          updated: row.updated_at
        }

        // Validate each task
        const validatedTask = await validateData(task, TicketTaskSchema, `task ${task.id} in ticket ${ticketId}`)
        tasksStorage[String(validatedTask.id)] = validatedTask
      }

      return tasksStorage
    } catch (error: any) {
      console.error(`Error reading tasks for ticket ${ticketId} from database:`, error)
      throw new ApiError(500, `Failed to read tasks for ticket ${ticketId}`, 'DB_READ_ERROR')
    }
  }

  /** Writes tasks for a specific ticket. */
  async writeTicketTasks(ticketId: number, tasks: TicketTasksStorage): Promise<TicketTasksStorage> {
    try {
      const db = this.getDb()

      // Validate the tasks storage structure
      const validatedTasks = await validateData(tasks, TicketTasksStorageSchema, `tasks for ticket ${ticketId}`)

      // Use raw database transaction for atomic updates
      const database = db.getDatabase()

      database.transaction(() => {
        // First, delete all existing tasks for this ticket
        const deleteQuery = database.prepare(`
          DELETE FROM ${TICKET_TASKS_TABLE}
          WHERE ticket_id = ?
        `)
        deleteQuery.run(ticketId)

        // Write all new tasks
        const now = Date.now()
        const insertQuery = database.prepare(`
          INSERT INTO ${TICKET_TASKS_TABLE} (
            id, ticket_id, content, description, suggested_file_ids,
            done, order_index, estimated_hours, dependencies, tags,
            agent_id, suggested_prompt_ids, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        for (const [taskId, task] of Object.entries(validatedTasks)) {
          // Ensure ticketId is consistent
          if (task.ticketId !== ticketId) {
            throw new ApiError(400, `Task ${taskId} has mismatched ticketId`, 'INVALID_TICKET_ID')
          }
          insertQuery.run(
            taskId,
            task.ticketId,
            task.content,
            task.description || '',
            JSON.stringify(task.suggestedFileIds || []),
            task.done ? 1 : 0,
            task.orderIndex,
            task.estimatedHours || null,
            JSON.stringify(task.dependencies || []),
            JSON.stringify(task.tags || []),
            task.agentId || null,
            JSON.stringify(task.suggestedPromptIds || []),
            task.created || now,
            task.updated || now
          )
        }
      })()

      return validatedTasks
    } catch (error: any) {
      console.error(`Error writing tasks for ticket ${ticketId} to database:`, error)
      throw new ApiError(500, `Failed to write tasks for ticket ${ticketId}`, 'DB_WRITE_ERROR')
    }
  }

  /** Deletes a ticket and all its tasks. */
  async deleteTicketData(ticketId: number): Promise<void> {
    try {
      const db = this.getDb()

      // Use raw database transaction to ensure atomic deletion
      const database = db.getDatabase()

      database.transaction(() => {
        // Delete all tasks for this ticket (cascade delete should handle this with FK)
        const taskDeleteQuery = database.prepare(`
          DELETE FROM ${TICKET_TASKS_TABLE}
          WHERE ticket_id = ?
        `)
        const taskResult = taskDeleteQuery.run(ticketId)

        // Delete the ticket
        const ticketDeleteQuery = database.prepare(`DELETE FROM ${TICKETS_TABLE} WHERE id = ?`)
        const ticketResult = ticketDeleteQuery.run(ticketId)

        if (ticketResult.changes === 0) {
          console.warn(`Ticket ${ticketId} not found, nothing to delete`)
        }

        console.log(`Deleted ticket ${ticketId} and ${taskResult.changes} associated tasks`)
      })()
    } catch (error: any) {
      console.error(`Error deleting ticket ${ticketId} from database:`, error)
      throw new ApiError(500, `Failed to delete ticket ${ticketId}`, 'DB_DELETE_ERROR')
    }
  }

  /** Deletes all tickets and tasks for a specific project. */
  async deleteProjectTickets(projectId: number): Promise<void> {
    try {
      const db = this.getDb()

      // Use raw database transaction to ensure atomic deletion
      const database = db.getDatabase()

      database.transaction(() => {
        // First get all tickets for this project
        const getTicketsQuery = database.prepare(`
          SELECT id FROM ${TICKETS_TABLE}
          WHERE project_id = ?
        `)
        const ticketIds = getTicketsQuery.all(projectId) as Array<{ id: number }>

        // Delete all tasks for all tickets in this project
        for (const { id: ticketId } of ticketIds) {
          const taskDeleteQuery = database.prepare(`
            DELETE FROM ${TICKET_TASKS_TABLE}
            WHERE ticket_id = ?
          `)
          taskDeleteQuery.run(ticketId)
        }

        // Delete all tickets for this project
        const ticketDeleteQuery = database.prepare(`
          DELETE FROM ${TICKETS_TABLE}
          WHERE project_id = ?
        `)
        const result = ticketDeleteQuery.run(projectId)

        console.log(`Deleted ${result.changes} tickets and their tasks for project ${projectId}`)
      })()
    } catch (error: any) {
      console.error(`Error deleting tickets for project ${projectId}:`, error)
      throw new ApiError(500, `Failed to delete tickets for project ${projectId}`, 'DB_DELETE_ERROR')
    }
  }

  /** Generates a unique ID for tickets. */
  generateTicketId(): number {
    try {
      const db = this.getDb()
      return db.generateUniqueId(TICKETS_TABLE)
    } catch (error) {
      console.error(`CRITICAL: Failed to generate unique ticket ID: ${error}`)
      throw new ApiError(500, 'Failed to generate a valid unique ticket ID', 'ID_GENERATION_ERROR')
    }
  }

  /** Generates a unique ID for tasks. */
  generateTaskId(): number {
    try {
      const db = this.getDb()
      return db.generateUniqueId(TICKET_TASKS_TABLE)
    } catch (error) {
      console.error(`CRITICAL: Failed to generate unique task ID: ${error}`)
      throw new ApiError(500, 'Failed to generate a valid unique task ID', 'ID_GENERATION_ERROR')
    }
  }

  /**
   * Additional utility methods leveraging database capabilities
   */

  /** Find tickets created within a date range for a project. */
  async findTicketsByDateRange(projectId: number, startTime: number, endTime: number): Promise<Ticket[]> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          created_at, updated_at
        FROM ${TICKETS_TABLE}
        WHERE project_id = ?
        AND created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC
      `)
      const rows = query.all(projectId, startTime, endTime) as any[]

      // Convert and validate each ticket
      const validatedTickets: Ticket[] = []
      for (const row of rows) {
        const ticket: Ticket = {
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          overview: row.overview,
          status: row.status,
          priority: row.priority,
          suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
          suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
          suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
          created: row.created_at,
          updated: row.updated_at
        }
        const validated = await validateData(ticket, TicketSchema, `ticket ${ticket.id}`)
        validatedTickets.push(validated)
      }

      return validatedTickets
    } catch (error: any) {
      console.error('Error finding tickets by date range:', error)
      throw new ApiError(500, 'Failed to find tickets by date range', 'DB_READ_ERROR')
    }
  }

  /** Count tasks for a specific ticket. */
  async countTasksForTicket(ticketId: number): Promise<number> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT COUNT(*) as count FROM ${TICKET_TASKS_TABLE}
        WHERE ticket_id = ?
      `)
      const result = query.get(ticketId) as { count: number }
      return result.count
    } catch (error: any) {
      console.error(`Error counting tasks for ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to count tasks for ticket ${ticketId}`, 'DB_READ_ERROR')
    }
  }

  /** Get a single task by ID. */
  async getTaskById(taskId: number): Promise<TicketTask | null> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, ticket_id, content, description, suggested_file_ids,
          done, order_index, estimated_hours, dependencies, tags,
          agent_id, suggested_prompt_ids, created_at, updated_at
        FROM ${TICKET_TASKS_TABLE}
        WHERE id = ?
      `)

      const row = query.get(taskId) as any

      if (!row) {
        return null
      }

      const task: TicketTask = {
        id: row.id,
        ticketId: row.ticket_id,
        content: row.content,
        description: row.description,
        suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'task.suggestedFileIds'),
        done: Boolean(row.done),
        orderIndex: row.order_index,
        estimatedHours: row.estimated_hours,
        dependencies: safeJsonParse(row.dependencies, [], 'task.dependencies'),
        tags: safeJsonParse(row.tags, [], 'task.tags'),
        agentId: row.agent_id,
        suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'task.suggestedPromptIds'),
        created: row.created_at,
        updated: row.updated_at
      }

      // Validate the task data
      return await validateData(task, TicketTaskSchema, `task ${taskId}`)
    } catch (error: any) {
      console.error(`Error reading task ${taskId} from database:`, error)
      throw new ApiError(500, `Failed to read task ${taskId}`, 'DB_READ_ERROR')
    }
  }

  /** Add a single ticket. */
  async addTicket(ticket: Ticket): Promise<Ticket> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate the ticket
      const validatedTicket = await validateData(ticket, TicketSchema, `ticket ${ticket.id}`)

      // Insert the ticket
      const insertQuery = database.prepare(`
        INSERT INTO ${TICKETS_TABLE} (
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      insertQuery.run(
        validatedTicket.id,
        validatedTicket.projectId,
        validatedTicket.title,
        validatedTicket.overview,
        validatedTicket.status,
        validatedTicket.priority,
        JSON.stringify(validatedTicket.suggestedFileIds || []),
        JSON.stringify(validatedTicket.suggestedAgentIds || []),
        JSON.stringify(validatedTicket.suggestedPromptIds || []),
        validatedTicket.created,
        validatedTicket.updated
      )

      return validatedTicket
    } catch (error: any) {
      console.error(`Error adding ticket to project ${ticket.projectId}:`, error)
      throw new ApiError(500, `Failed to add ticket to project ${ticket.projectId}`, 'DB_CREATE_ERROR')
    }
  }

  /** Update a single ticket. */
  async updateTicket(ticketId: number, ticket: Ticket): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate the ticket
      const validatedTicket = await validateData(ticket, TicketSchema, `ticket ${ticketId}`)

      // Update the ticket
      const updateQuery = database.prepare(`
        UPDATE ${TICKETS_TABLE} SET
          project_id = ?,
          title = ?,
          overview = ?,
          status = ?,
          priority = ?,
          suggested_file_ids = ?,
          suggested_agent_ids = ?,
          suggested_prompt_ids = ?,
          updated_at = ?
        WHERE id = ?
      `)

      const result = updateQuery.run(
        validatedTicket.projectId,
        validatedTicket.title,
        validatedTicket.overview,
        validatedTicket.status,
        validatedTicket.priority,
        JSON.stringify(validatedTicket.suggestedFileIds || []),
        JSON.stringify(validatedTicket.suggestedAgentIds || []),
        JSON.stringify(validatedTicket.suggestedPromptIds || []),
        validatedTicket.updated,
        ticketId
      )

      return result.changes > 0
    } catch (error: any) {
      console.error(`Error updating ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to update ticket ${ticketId}`, 'DB_UPDATE_ERROR')
    }
  }

  /** Add a single task. */
  async addTask(task: TicketTask): Promise<TicketTask> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate the task
      const validatedTask = await validateData(task, TicketTaskSchema, `task ${task.id}`)

      // Insert the task
      const insertQuery = database.prepare(`
        INSERT INTO ${TICKET_TASKS_TABLE} (
          id, ticket_id, content, description, suggested_file_ids,
          done, order_index, estimated_hours, dependencies, tags,
          agent_id, suggested_prompt_ids, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      insertQuery.run(
        validatedTask.id,
        validatedTask.ticketId,
        validatedTask.content,
        validatedTask.description || '',
        JSON.stringify(validatedTask.suggestedFileIds || []),
        validatedTask.done ? 1 : 0,
        validatedTask.orderIndex,
        validatedTask.estimatedHours || null,
        JSON.stringify(validatedTask.dependencies || []),
        JSON.stringify(validatedTask.tags || []),
        validatedTask.agentId || null,
        JSON.stringify(validatedTask.suggestedPromptIds || []),
        validatedTask.created,
        validatedTask.updated
      )

      return validatedTask
    } catch (error: any) {
      console.error(`Error adding task to ticket ${task.ticketId}:`, error)
      throw new ApiError(500, `Failed to add task to ticket ${task.ticketId}`, 'DB_CREATE_ERROR')
    }
  }

  /** Update a single task. */
  async updateTask(taskId: number, task: TicketTask): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate the task
      const validatedTask = await validateData(task, TicketTaskSchema, `task ${taskId}`)

      // Update the task
      const updateQuery = database.prepare(`
        UPDATE ${TICKET_TASKS_TABLE} SET
          ticket_id = ?,
          content = ?,
          description = ?,
          suggested_file_ids = ?,
          done = ?,
          order_index = ?,
          estimated_hours = ?,
          dependencies = ?,
          tags = ?,
          agent_id = ?,
          suggested_prompt_ids = ?,
          updated_at = ?
        WHERE id = ?
      `)

      const result = updateQuery.run(
        validatedTask.ticketId,
        validatedTask.content,
        validatedTask.description || '',
        JSON.stringify(validatedTask.suggestedFileIds || []),
        validatedTask.done ? 1 : 0,
        validatedTask.orderIndex,
        validatedTask.estimatedHours || null,
        JSON.stringify(validatedTask.dependencies || []),
        JSON.stringify(validatedTask.tags || []),
        validatedTask.agentId || null,
        JSON.stringify(validatedTask.suggestedPromptIds || []),
        validatedTask.updated,
        taskId
      )

      return result.changes > 0
    } catch (error: any) {
      console.error(`Error updating task ${taskId}:`, error)
      throw new ApiError(500, `Failed to update task ${taskId}`, 'DB_UPDATE_ERROR')
    }
  }

  /** Delete a single task. */
  async deleteTask(taskId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const deleteQuery = database.prepare(`DELETE FROM ${TICKET_TASKS_TABLE} WHERE id = ?`)
      const result = deleteQuery.run(taskId)

      return result.changes > 0
    } catch (error: any) {
      console.error(`Error deleting task ${taskId}:`, error)
      throw new ApiError(500, `Failed to delete task ${taskId}`, 'DB_DELETE_ERROR')
    }
  }
}

// Export singleton instance
export const ticketStorage = new TicketStorage()
