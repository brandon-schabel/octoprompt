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

      // Query tickets directly from columns (including queue fields)
      const query = database.prepare(`
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          queue_id, queue_position, queue_status, queue_priority,
          queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM ${TICKETS_TABLE}
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)

      const rows = query.all(projectId) as any[]

      // Convert rows to TicketsStorage
      const ticketsStorage: TicketsStorage = {}
      for (const row of rows) {
        const ticket = {
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          overview: row.overview,
          status: row.status,
          priority: row.priority,
          suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
          suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
          suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
          // Queue fields
          queueId: row.queue_id || undefined,
          queuePosition: row.queue_position || undefined,
          queueStatus: row.queue_status || undefined,
          queuePriority: row.queue_priority ?? 0,
          queuedAt: row.queued_at || undefined,
          queueStartedAt: row.queue_started_at || undefined,
          queueCompletedAt: row.queue_completed_at || undefined,
          queueAgentId: row.queue_agent_id || undefined,
          queueErrorMessage: row.queue_error_message || undefined,
          estimatedProcessingTime: row.estimated_processing_time || undefined,
          actualProcessingTime: row.actual_processing_time || undefined,
          created: Number(row.created_at) || Date.now(),
          updated: Number(row.updated_at) || Date.now()
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
            ticket.overview || '',
            ticket.status || 'open',
            ticket.priority || 'normal',
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
          queue_id, queue_position, queue_status, queue_priority,
          queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM ${TICKETS_TABLE}
        WHERE id = ?
      `)

      const row = query.get(ticketId) as any

      if (!row) {
        return null
      }

      const ticket = {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        overview: row.overview || '',
        status: row.status || 'open',
        priority: row.priority || 'normal',
        suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
        suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
        suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
        // Queue fields
        queueId: row.queue_id || undefined,
        queuePosition: row.queue_position || undefined,
        queueStatus: row.queue_status || undefined,
        queuePriority: row.queue_priority ?? 0,
        queuedAt: row.queued_at || undefined,
        queueStartedAt: row.queue_started_at || undefined,
        queueCompletedAt: row.queue_completed_at || undefined,
        queueAgentId: row.queue_agent_id || undefined,
        queueErrorMessage: row.queue_error_message || undefined,
        estimatedProcessingTime: row.estimated_processing_time || undefined,
        actualProcessingTime: row.actual_processing_time || undefined,
        created: Number(row.created_at) || Date.now(),
        updated: Number(row.updated_at) || Date.now()
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
          agent_id, suggested_prompt_ids, 
          queue_id, queue_position, queue_status, queue_priority,
          queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM ${TICKET_TASKS_TABLE}
        WHERE ticket_id = ?
        ORDER BY order_index ASC
      `)

      const rows = query.all(ticketId) as any[]

      // Convert rows to TicketTasksStorage
      const tasksStorage: TicketTasksStorage = {}
      for (const row of rows) {
        const task = {
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
          // Queue fields
          queueId: row.queue_id || undefined,
          queuePosition: row.queue_position || undefined,
          queueStatus: row.queue_status || undefined,
          queuePriority: row.queue_priority ?? 0,
          queuedAt: row.queued_at || undefined,
          queueStartedAt: row.queue_started_at || undefined,
          queueCompletedAt: row.queue_completed_at || undefined,
          queueAgentId: row.queue_agent_id || undefined,
          queueErrorMessage: row.queue_error_message || undefined,
          estimatedProcessingTime: row.estimated_processing_time || undefined,
          actualProcessingTime: row.actual_processing_time || undefined,
          created: Number(row.created_at) || Date.now(),
          updated: Number(row.updated_at) || Date.now()
        }

        // Validate each task
        const validatedTask = await validateData(task, TicketTaskSchema, `task ${task.id} in ticket ${ticketId}`)
        tasksStorage[String(validatedTask.id)] = validatedTask
      }

      return tasksStorage
    } catch (error: any) {
      console.error(`Error reading tasks for ticket ${ticketId} from database:`, error)
      throw new ApiError(500, `Failed to read tasks for ticket ${ticketId}`, 'DB_READ_ERROR', {
        ticketId,
        errorMessage: error?.message || 'Unknown database error',
        suggestion: 'Verify that the ticket exists and the database is accessible'
      })
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
      throw new ApiError(500, `Failed to write tasks for ticket ${ticketId}`, 'DB_WRITE_ERROR', {
        ticketId,
        taskCount: Object.keys(tasks).length,
        errorMessage: error?.message || 'Unknown database error',
        suggestion: 'Check if the ticket exists and ensure all task IDs are unique'
      })
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
        const ticket = {
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          overview: row.overview,
          status: row.status,
          priority: row.priority,
          suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
          suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
          suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
          created: Number(row.created_at) || Date.now(),
          updated: Number(row.updated_at) || Date.now()
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
          agent_id, suggested_prompt_ids,
          queue_id, queue_position, queue_status, queue_priority,
          queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
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
        description: row.description || '',
        suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'task.suggestedFileIds'),
        done: Boolean(row.done),
        orderIndex: row.order_index,
        estimatedHours: row.estimated_hours,
        dependencies: safeJsonParse(row.dependencies, [], 'task.dependencies'),
        tags: safeJsonParse(row.tags, [], 'task.tags'),
        agentId: row.agent_id,
        suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'task.suggestedPromptIds'),
        // Queue fields
        queueId: row.queue_id || undefined,
        queuePosition: row.queue_position || undefined,
        queueStatus: row.queue_status || undefined,
        queuePriority: row.queue_priority ?? 0,
        queuedAt: row.queued_at || undefined,
        queueStartedAt: row.queue_started_at || undefined,
        queueCompletedAt: row.queue_completed_at || undefined,
        queueAgentId: row.queue_agent_id || undefined,
        queueErrorMessage: row.queue_error_message || undefined,
        estimatedProcessingTime: row.estimated_processing_time || undefined,
        actualProcessingTime: row.actual_processing_time || undefined,
        created: Number(row.created_at) || Date.now(),
        updated: Number(row.updated_at) || Date.now()
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
        validatedTicket.overview || '',
        validatedTicket.status || 'open',
        validatedTicket.priority || 'normal',
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

  /** Update a single ticket (full replacement). */
  async replaceTicket(ticketId: number, ticket: Ticket): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate the ticket
      const validatedTicket = await validateData(ticket, TicketSchema, `ticket ${ticketId}`)

      // Update the ticket (including queue fields)
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
          queue_id = ?,
          queue_position = ?,
          queue_status = ?,
          queue_priority = ?,
          queued_at = ?,
          queue_started_at = ?,
          queue_completed_at = ?,
          queue_agent_id = ?,
          queue_error_message = ?,
          estimated_processing_time = ?,
          actual_processing_time = ?,
          updated_at = ?
        WHERE id = ?
      `)

      const result = updateQuery.run(
        validatedTicket.projectId,
        validatedTicket.title,
        validatedTicket.overview || '',
        validatedTicket.status || 'open',
        validatedTicket.priority || 'normal',
        JSON.stringify(validatedTicket.suggestedFileIds || []),
        JSON.stringify(validatedTicket.suggestedAgentIds || []),
        JSON.stringify(validatedTicket.suggestedPromptIds || []),
        validatedTicket.queueId || null,
        validatedTicket.queuePosition || null,
        validatedTicket.queueStatus || null,
        validatedTicket.queuePriority ?? 0,
        validatedTicket.queuedAt || null,
        validatedTicket.queueStartedAt || null,
        validatedTicket.queueCompletedAt || null,
        validatedTicket.queueAgentId || null,
        validatedTicket.queueErrorMessage || null,
        validatedTicket.estimatedProcessingTime || null,
        validatedTicket.actualProcessingTime || null,
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

  /** Update a single task (full replacement). */
  async replaceTask(taskId: number, task: TicketTask): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate the task
      const validatedTask = await validateData(task, TicketTaskSchema, `task ${taskId}`)

      // Update the task (including queue fields)
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
          queue_id = ?,
          queue_position = ?,
          queue_status = ?,
          queue_priority = ?,
          queued_at = ?,
          queue_started_at = ?,
          queue_completed_at = ?,
          queue_agent_id = ?,
          queue_error_message = ?,
          estimated_processing_time = ?,
          actual_processing_time = ?,
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
        validatedTask.queueId || null,
        validatedTask.queuePosition || null,
        validatedTask.queueStatus || null,
        validatedTask.queuePriority ?? 0,
        validatedTask.queuedAt || null,
        validatedTask.queueStartedAt || null,
        validatedTask.queueCompletedAt || null,
        validatedTask.queueAgentId || null,
        validatedTask.queueErrorMessage || null,
        validatedTask.estimatedProcessingTime || null,
        validatedTask.actualProcessingTime || null,
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

  // === Individual ticket operations (for queue integration) ===

  /** Read a single ticket by ID. */
  async readTicket(ticketId: number): Promise<Ticket | null> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          queue_id, queue_position, queue_status, queue_priority,
          queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM ${TICKETS_TABLE}
        WHERE id = ?
      `)

      const row = query.get(ticketId) as any
      if (!row) return null

      const ticket = {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        overview: row.overview || '',
        status: row.status || 'open',
        priority: row.priority || 'normal',
        suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
        suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
        suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
        // Queue fields
        queueId: row.queue_id || undefined,
        queuePosition: row.queue_position || undefined,
        queueStatus: row.queue_status || undefined,
        queuePriority: row.queue_priority ?? 0,
        queuedAt: row.queued_at || undefined,
        queueStartedAt: row.queue_started_at || undefined,
        queueCompletedAt: row.queue_completed_at || undefined,
        queueAgentId: row.queue_agent_id || undefined,
        queueErrorMessage: row.queue_error_message || undefined,
        estimatedProcessingTime: row.estimated_processing_time || undefined,
        actualProcessingTime: row.actual_processing_time || undefined,
        created: Number(row.created_at) || Date.now(),
        updated: Number(row.updated_at) || Date.now()
      }

      return await validateData(ticket, TicketSchema, `ticket ${ticket.id}`)
    } catch (error: any) {
      console.error(`Error reading ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to read ticket ${ticketId}`, 'DB_READ_ERROR')
    }
  }

  /** Update specific fields of a ticket (for queue integration). */
  async updateTicket(ticketId: number, updates: any): Promise<Ticket> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      // Build dynamic update query - handle both camelCase and snake_case
      const updateFields: string[] = ['updated_at = ?']
      const updateValues: any[] = [now]

      // Map camelCase to snake_case for database columns
      if (updates.queueId !== undefined || updates.queue_id !== undefined) {
        updateFields.push('queue_id = ?')
        updateValues.push(updates.queueId ?? updates.queue_id)
      }
      if (updates.queueStatus !== undefined || updates.queue_status !== undefined) {
        updateFields.push('queue_status = ?')
        updateValues.push(updates.queueStatus ?? updates.queue_status)
      }
      if (updates.queuePosition !== undefined || updates.queue_position !== undefined) {
        updateFields.push('queue_position = ?')
        updateValues.push(updates.queuePosition ?? updates.queue_position)
      }
      if (updates.queuePriority !== undefined || updates.queue_priority !== undefined) {
        updateFields.push('queue_priority = ?')
        updateValues.push(updates.queuePriority ?? updates.queue_priority)
      }
      if (updates.queuedAt !== undefined || updates.queued_at !== undefined) {
        updateFields.push('queued_at = ?')
        updateValues.push(updates.queuedAt ?? updates.queued_at)
      }
      if (updates.queueStartedAt !== undefined || updates.queue_started_at !== undefined) {
        updateFields.push('queue_started_at = ?')
        updateValues.push(updates.queueStartedAt ?? updates.queue_started_at)
      }
      if (updates.queueCompletedAt !== undefined || updates.queue_completed_at !== undefined) {
        updateFields.push('queue_completed_at = ?')
        updateValues.push(updates.queueCompletedAt ?? updates.queue_completed_at)
      }
      if (updates.queueAgentId !== undefined || updates.queue_agent_id !== undefined) {
        updateFields.push('queue_agent_id = ?')
        updateValues.push(updates.queueAgentId ?? updates.queue_agent_id)
      }
      if (updates.queueErrorMessage !== undefined || updates.queue_error_message !== undefined) {
        updateFields.push('queue_error_message = ?')
        updateValues.push(updates.queueErrorMessage ?? updates.queue_error_message)
      }
      if (updates.actualProcessingTime !== undefined || updates.actual_processing_time !== undefined) {
        updateFields.push('actual_processing_time = ?')
        updateValues.push(updates.actualProcessingTime ?? updates.actual_processing_time)
      }

      updateValues.push(ticketId)

      const updateQuery = database.prepare(`
        UPDATE ${TICKETS_TABLE}
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `)

      const result = updateQuery.run(...updateValues)

      // Return the updated ticket
      const updatedTicket = await this.readTicket(ticketId)
      if (!updatedTicket) {
        throw new ApiError(404, `Ticket ${ticketId} not found after update`, 'TICKET_NOT_FOUND')
      }
      return updatedTicket
    } catch (error: any) {
      console.error(`Error updating ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to update ticket ${ticketId}`, 'DB_WRITE_ERROR')
    }
  }

  /** Read a single task by ID. */
  async readTask(ticketId: number, taskId: number): Promise<TicketTask | null> {
    try {
      const tasks = await this.readTicketTasks(ticketId)
      return tasks[String(taskId)] || null
    } catch (error: any) {
      console.error(`Error reading task ${taskId} from ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to read task ${taskId}`, 'DB_READ_ERROR')
    }
  }

  /** Update specific fields of a task (for queue integration). */
  async updateTask(ticketId: number, taskId: number, updates: any): Promise<TicketTask> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()
      const now = Date.now()

      // Build dynamic update query - handle both camelCase and snake_case
      const updateFields: string[] = ['updated_at = ?']
      const updateValues: any[] = [now]

      // Map camelCase to snake_case for database columns
      if (updates.queueId !== undefined || updates.queue_id !== undefined) {
        updateFields.push('queue_id = ?')
        updateValues.push(updates.queueId ?? updates.queue_id)
      }
      if (updates.queueStatus !== undefined || updates.queue_status !== undefined) {
        updateFields.push('queue_status = ?')
        updateValues.push(updates.queueStatus ?? updates.queue_status)
      }
      if (updates.queuePosition !== undefined || updates.queue_position !== undefined) {
        updateFields.push('queue_position = ?')
        updateValues.push(updates.queuePosition ?? updates.queue_position)
      }
      if (updates.queuePriority !== undefined || updates.queue_priority !== undefined) {
        updateFields.push('queue_priority = ?')
        updateValues.push(updates.queuePriority ?? updates.queue_priority)
      }
      if (updates.queuedAt !== undefined || updates.queued_at !== undefined) {
        updateFields.push('queued_at = ?')
        updateValues.push(updates.queuedAt ?? updates.queued_at)
      }
      if (updates.queueStartedAt !== undefined || updates.queue_started_at !== undefined) {
        updateFields.push('queue_started_at = ?')
        updateValues.push(updates.queueStartedAt ?? updates.queue_started_at)
      }
      if (updates.queueCompletedAt !== undefined || updates.queue_completed_at !== undefined) {
        updateFields.push('queue_completed_at = ?')
        updateValues.push(updates.queueCompletedAt ?? updates.queue_completed_at)
      }
      if (updates.queueAgentId !== undefined || updates.queue_agent_id !== undefined) {
        updateFields.push('queue_agent_id = ?')
        updateValues.push(updates.queueAgentId ?? updates.queue_agent_id)
      }
      if (updates.queueErrorMessage !== undefined || updates.queue_error_message !== undefined) {
        updateFields.push('queue_error_message = ?')
        updateValues.push(updates.queueErrorMessage ?? updates.queue_error_message)
      }
      if (updates.actualProcessingTime !== undefined || updates.actual_processing_time !== undefined) {
        updateFields.push('actual_processing_time = ?')
        updateValues.push(updates.actualProcessingTime ?? updates.actual_processing_time)
      }
      if (updates.done !== undefined) {
        updateFields.push('done = ?')
        updateValues.push(updates.done ? 1 : 0)
      }

      updateValues.push(taskId)

      const updateQuery = database.prepare(`
        UPDATE ${TICKET_TASKS_TABLE}
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `)

      const result = updateQuery.run(...updateValues)

      // Return the updated task
      const updatedTask = await this.getTaskById(taskId)
      if (!updatedTask) {
        throw new ApiError(404, `Task ${taskId} not found after update`, 'TASK_NOT_FOUND')
      }
      return updatedTask
    } catch (error: any) {
      console.error(`Error updating task ${taskId}:`, error)
      throw new ApiError(500, `Failed to update task ${taskId}`, 'DB_WRITE_ERROR')
    }
  }

  /** Read all tasks for a ticket (alias for compatibility). */
  async readTasks(ticketId: number): Promise<TicketTasksStorage> {
    return this.readTicketTasks(ticketId)
  }

  // === Queue-specific operations for unified flow system ===

  /** Enqueue a ticket to a queue. */
  async enqueueTicket(ticketId: number, queueId: number, priority: number = 0): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const position = await this.getNextQueuePosition(queueId)
      const now = Date.now()

      const updateQuery = database.prepare(`
        UPDATE ${TICKETS_TABLE}
        SET queue_id = ?, queue_position = ?, queue_status = ?, 
            queue_priority = ?, queued_at = ?, updated_at = ?
        WHERE id = ?
      `)

      const result = updateQuery.run(queueId, position, 'queued', priority, now, now, ticketId)
      return result.changes > 0
    } catch (error: any) {
      console.error(`Error enqueuing ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to enqueue ticket ${ticketId}`, 'DB_WRITE_ERROR')
    }
  }

  /** Enqueue a task to a queue. */
  async enqueueTask(taskId: number, queueId: number, priority: number = 0): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const position = await this.getNextQueuePosition(queueId)
      const now = Date.now()

      const updateQuery = database.prepare(`
        UPDATE ${TICKET_TASKS_TABLE}
        SET queue_id = ?, queue_position = ?, queue_status = ?, 
            queue_priority = ?, queued_at = ?, updated_at = ?
        WHERE id = ?
      `)

      const result = updateQuery.run(queueId, position, 'queued', priority, now, now, taskId)
      return result.changes > 0
    } catch (error: any) {
      console.error(`Error enqueuing task ${taskId}:`, error)
      throw new ApiError(500, `Failed to enqueue task ${taskId}`, 'DB_WRITE_ERROR')
    }
  }

  /** Dequeue a ticket (remove from queue). */
  async dequeueTicket(ticketId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const now = Date.now()
      const updateQuery = database.prepare(`
        UPDATE ${TICKETS_TABLE}
        SET queue_id = NULL, queue_position = NULL, queue_status = NULL,
            queue_priority = 0, queued_at = NULL, queue_started_at = NULL,
            queue_completed_at = NULL, queue_agent_id = NULL, 
            queue_error_message = NULL, updated_at = ?
        WHERE id = ?
      `)

      const result = updateQuery.run(now, ticketId)
      return result.changes > 0
    } catch (error: any) {
      console.error(`Error dequeuing ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to dequeue ticket ${ticketId}`, 'DB_WRITE_ERROR')
    }
  }

  /** Dequeue a task (remove from queue). */
  async dequeueTask(taskId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const now = Date.now()
      const updateQuery = database.prepare(`
        UPDATE ${TICKET_TASKS_TABLE}
        SET queue_id = NULL, queue_position = NULL, queue_status = NULL,
            queue_priority = 0, queued_at = NULL, queue_started_at = NULL,
            queue_completed_at = NULL, queue_agent_id = NULL,
            queue_error_message = NULL, updated_at = ?
        WHERE id = ?
      `)

      const result = updateQuery.run(now, taskId)
      return result.changes > 0
    } catch (error: any) {
      console.error(`Error dequeuing task ${taskId}:`, error)
      throw new ApiError(500, `Failed to dequeue task ${taskId}`, 'DB_WRITE_ERROR')
    }
  }

  /** Get the next available queue position for a queue (atomic). */
  private async getNextQueuePosition(queueId: number): Promise<number> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Use atomic increment on position counter table
      // This prevents race conditions in concurrent operations
      const updateCounter = database.prepare(`
        UPDATE queue_position_counters 
        SET max_position = max_position + 1,
            last_updated = ?
        WHERE queue_id = ?
        RETURNING max_position
      `)

      const result = updateCounter.get(Date.now(), queueId) as { max_position: number } | undefined

      if (result) {
        return result.max_position
      }

      // If no counter exists (shouldn't happen with migration), create it
      const insertCounter = database.prepare(`
        INSERT INTO queue_position_counters (queue_id, max_position, last_updated)
        VALUES (?, 1, ?)
        RETURNING max_position
      `)

      const insertResult = insertCounter.get(queueId, Date.now()) as { max_position: number }
      return insertResult.max_position
    } catch (error: any) {
      console.error(`Error getting next queue position for queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to get next queue position`, 'DB_READ_ERROR')
    }
  }

  /** Get all queued items (tickets and tasks) for a queue. */
  async getQueueItems(queueId: number): Promise<{ tickets: Ticket[]; tasks: TicketTask[] }> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Get queued tickets
      const ticketQuery = database.prepare(`
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          queue_id, queue_position, queue_status, queue_priority,
          queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM ${TICKETS_TABLE}
        WHERE queue_id = ?
        ORDER BY queue_position ASC
      `)

      const ticketRows = ticketQuery.all(queueId) as any[]

      // Get queued tasks
      const taskQuery = database.prepare(`
        SELECT 
          id, ticket_id, content, description, suggested_file_ids,
          done, order_index, estimated_hours, dependencies, tags,
          agent_id, suggested_prompt_ids,
          queue_id, queue_position, queue_status, queue_priority,
          queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM ${TICKET_TASKS_TABLE}
        WHERE queue_id = ?
        ORDER BY queue_position ASC
      `)

      const taskRows = taskQuery.all(queueId) as any[]

      // Convert to proper types
      const tickets: Ticket[] = []
      for (const row of ticketRows) {
        const ticket = {
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          overview: row.overview,
          status: row.status,
          priority: row.priority,
          suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
          suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
          suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
          queueId: row.queue_id,
          queuePosition: row.queue_position,
          queueStatus: row.queue_status,
          queuePriority: row.queue_priority,
          queuedAt: row.queued_at,
          queueStartedAt: row.queue_started_at,
          queueCompletedAt: row.queue_completed_at,
          queueAgentId: row.queue_agent_id,
          queueErrorMessage: row.queue_error_message,
          estimatedProcessingTime: row.estimated_processing_time,
          actualProcessingTime: row.actual_processing_time,
          created: Number(row.created_at) || Date.now(),
          updated: Number(row.updated_at) || Date.now()
        }
        tickets.push(await validateData(ticket as any, TicketSchema, `ticket ${ticket.id}`))
      }

      const tasks: TicketTask[] = []
      for (const row of taskRows) {
        const task = {
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
          queueId: row.queue_id,
          queuePosition: row.queue_position,
          queueStatus: row.queue_status,
          queuePriority: row.queue_priority,
          queuedAt: row.queued_at,
          queueStartedAt: row.queue_started_at,
          queueCompletedAt: row.queue_completed_at,
          queueAgentId: row.queue_agent_id,
          queueErrorMessage: row.queue_error_message,
          estimatedProcessingTime: row.estimated_processing_time,
          actualProcessingTime: row.actual_processing_time,
          created: Number(row.created_at) || Date.now(),
          updated: Number(row.updated_at) || Date.now()
        }
        tasks.push(await validateData(task as any, TicketTaskSchema, `task ${task.id}`))
      }

      return { tickets, tasks }
    } catch (error: any) {
      console.error(`Error getting queue items for queue ${queueId}:`, error)
      throw new ApiError(500, `Failed to get queue items`, 'DB_READ_ERROR')
    }
  }

  /** Get all unqueued items (tickets and tasks) for a project. */
  async getUnqueuedItems(projectId: number): Promise<{ tickets: Ticket[]; tasks: TicketTask[] }> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Get unqueued tickets
      const ticketQuery = database.prepare(`
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          queue_id, queue_position, queue_status, queue_priority,
          queued_at, queue_started_at, queue_completed_at,
          queue_agent_id, queue_error_message,
          estimated_processing_time, actual_processing_time,
          created_at, updated_at
        FROM ${TICKETS_TABLE}
        WHERE project_id = ? AND queue_id IS NULL
        ORDER BY created_at DESC
      `)

      const ticketRows = ticketQuery.all(projectId) as any[]

      // Get unqueued tasks for this project
      const taskQuery = database.prepare(`
        SELECT 
          t.id, t.ticket_id, t.content, t.description, t.suggested_file_ids,
          t.done, t.order_index, t.estimated_hours, t.dependencies, t.tags,
          t.agent_id, t.suggested_prompt_ids,
          t.queue_id, t.queue_position, t.queue_status, t.queue_priority,
          t.queued_at, t.queue_started_at, t.queue_completed_at,
          t.queue_agent_id, t.queue_error_message,
          t.estimated_processing_time, t.actual_processing_time,
          t.created_at, t.updated_at
        FROM ${TICKET_TASKS_TABLE} t
        JOIN ${TICKETS_TABLE} tk ON t.ticket_id = tk.id
        WHERE tk.project_id = ? AND t.queue_id IS NULL
        ORDER BY t.created_at DESC
      `)

      const taskRows = taskQuery.all(projectId) as any[]

      // Convert to proper types (reuse conversion logic from getQueueItems)
      const tickets: Ticket[] = []
      for (const row of ticketRows) {
        const ticket = {
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          overview: row.overview,
          status: row.status,
          priority: row.priority,
          suggestedFileIds: safeJsonParse(row.suggested_file_ids, [], 'ticket.suggestedFileIds'),
          suggestedAgentIds: safeJsonParse(row.suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
          suggestedPromptIds: safeJsonParse(row.suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
          created: Number(row.created_at) || Date.now(),
          updated: Number(row.updated_at) || Date.now()
        }
        tickets.push(await validateData(ticket as any, TicketSchema, `ticket ${ticket.id}`))
      }

      const tasks: TicketTask[] = []
      for (const row of taskRows) {
        const task = {
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
          created: Number(row.created_at) || Date.now(),
          updated: Number(row.updated_at) || Date.now()
        }
        tasks.push(await validateData(task as any, TicketTaskSchema, `task ${task.id}`))
      }

      return { tickets, tasks }
    } catch (error: any) {
      console.error(`Error getting unqueued items for project ${projectId}:`, error)
      throw new ApiError(500, `Failed to get unqueued items`, 'DB_READ_ERROR')
    }
  }

  /**
   * Get all tickets with their tasks in a single optimized query.
   * Eliminates N+1 query problem by using a JOIN.
   */
  async getTicketsWithTasksOptimized(projectId: number): Promise<Array<{ ticket: Ticket; tasks: TicketTask[] }>> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Fetch all tickets and tasks in a single query using LEFT JOIN
      const query = database.prepare(`
        SELECT 
          t.id as ticket_id,
          t.project_id,
          t.title as ticket_title,
          t.overview,
          t.status as ticket_status,
          t.priority as ticket_priority,
          t.suggested_file_ids as ticket_suggested_file_ids,
          t.suggested_agent_ids as ticket_suggested_agent_ids,
          t.suggested_prompt_ids as ticket_suggested_prompt_ids,
          t.queue_id as ticket_queue_id,
          t.queue_position as ticket_queue_position,
          t.queue_status as ticket_queue_status,
          t.queue_priority as ticket_queue_priority,
          t.queued_at as ticket_queued_at,
          t.queue_started_at as ticket_queue_started_at,
          t.queue_completed_at as ticket_queue_completed_at,
          t.queue_agent_id as ticket_queue_agent_id,
          t.queue_error_message as ticket_queue_error_message,
          t.estimated_processing_time as ticket_estimated_processing_time,
          t.actual_processing_time as ticket_actual_processing_time,
          t.created_at as ticket_created_at,
          t.updated_at as ticket_updated_at,
          tt.id as task_id,
          tt.content as task_content,
          tt.description as task_description,
          tt.suggested_file_ids as task_suggested_file_ids,
          tt.done as task_done,
          tt.order_index as task_order_index,
          tt.estimated_hours as task_estimated_hours,
          tt.dependencies as task_dependencies,
          tt.tags as task_tags,
          tt.agent_id as task_agent_id,
          tt.suggested_prompt_ids as task_suggested_prompt_ids,
          tt.queue_id as task_queue_id,
          tt.queue_position as task_queue_position,
          tt.queue_status as task_queue_status,
          tt.queue_priority as task_queue_priority,
          tt.queued_at as task_queued_at,
          tt.queue_started_at as task_queue_started_at,
          tt.queue_completed_at as task_queue_completed_at,
          tt.queue_agent_id as task_queue_agent_id,
          tt.queue_error_message as task_queue_error_message,
          tt.estimated_processing_time as task_estimated_processing_time,
          tt.actual_processing_time as task_actual_processing_time,
          tt.created_at as task_created_at,
          tt.updated_at as task_updated_at
        FROM ${TICKETS_TABLE} t
        LEFT JOIN ${TICKET_TASKS_TABLE} tt ON t.id = tt.ticket_id
        WHERE t.project_id = ?
        ORDER BY t.id, tt.order_index
      `)

      const rows = query.all(projectId) as any[]
      const ticketsMap = new Map<number, { ticket: Ticket; tasks: TicketTask[] }>()

      for (const row of rows) {
        const ticketId = row.ticket_id

        if (!ticketsMap.has(ticketId)) {
          // Create ticket object
          const ticket = {
            id: ticketId,
            projectId: row.project_id,
            title: row.ticket_title,
            overview: row.overview,
            status: row.ticket_status,
            priority: row.ticket_priority,
            suggestedFileIds: safeJsonParse(row.ticket_suggested_file_ids, [], 'ticket.suggestedFileIds'),
            suggestedAgentIds: safeJsonParse(row.ticket_suggested_agent_ids, [], 'ticket.suggestedAgentIds'),
            suggestedPromptIds: safeJsonParse(row.ticket_suggested_prompt_ids, [], 'ticket.suggestedPromptIds'),
            queueId: row.ticket_queue_id || undefined,
            queuePosition: row.ticket_queue_position || undefined,
            queueStatus: row.ticket_queue_status || undefined,
            queuePriority: row.ticket_queue_priority ?? 0,
            queuedAt: row.ticket_queued_at || undefined,
            queueStartedAt: row.ticket_queue_started_at || undefined,
            queueCompletedAt: row.ticket_queue_completed_at || undefined,
            queueAgentId: row.ticket_queue_agent_id || undefined,
            queueErrorMessage: row.ticket_queue_error_message || undefined,
            estimatedProcessingTime: row.ticket_estimated_processing_time || undefined,
            actualProcessingTime: row.ticket_actual_processing_time || undefined,
            created: row.ticket_created_at,
            updated: row.ticket_updated_at
          }

          ticketsMap.set(ticketId, {
            ticket: await validateData(ticket as any, TicketSchema, `ticket ${ticketId}`),
            tasks: []
          })
        }

        // Add task if exists (LEFT JOIN may have NULL tasks)
        if (row.task_id) {
          const task = {
            id: row.task_id,
            ticketId: ticketId,
            content: row.task_content,
            description: row.task_description,
            suggestedFileIds: safeJsonParse(row.task_suggested_file_ids, [], 'task.suggestedFileIds'),
            done: Boolean(row.task_done),
            orderIndex: row.task_order_index,
            estimatedHours: row.task_estimated_hours,
            dependencies: safeJsonParse(row.task_dependencies, [], 'task.dependencies'),
            tags: safeJsonParse(row.task_tags, [], 'task.tags'),
            agentId: row.task_agent_id,
            suggestedPromptIds: safeJsonParse(row.task_suggested_prompt_ids, [], 'task.suggestedPromptIds'),
            queueId: row.task_queue_id || undefined,
            queuePosition: row.task_queue_position || undefined,
            queueStatus: row.task_queue_status || undefined,
            queuePriority: row.task_queue_priority ?? 0,
            queuedAt: row.task_queued_at || undefined,
            queueStartedAt: row.task_queue_started_at || undefined,
            queueCompletedAt: row.task_queue_completed_at || undefined,
            queueAgentId: row.task_queue_agent_id || undefined,
            queueErrorMessage: row.task_queue_error_message || undefined,
            estimatedProcessingTime: row.task_estimated_processing_time || undefined,
            actualProcessingTime: row.task_actual_processing_time || undefined,
            created: row.task_created_at || Date.now(),
            updated: row.task_updated_at || Date.now()
          }

          const validatedTask = await validateData(task as any, TicketTaskSchema, `task ${task.id}`)
          ticketsMap.get(ticketId)!.tasks.push(validatedTask)
        }
      }

      return Array.from(ticketsMap.values())
    } catch (error: any) {
      console.error(`Error getting tickets with tasks for project ${projectId}:`, error)
      throw new ApiError(500, `Failed to get tickets with tasks`, 'DB_READ_ERROR')
    }
  }
}

// Export singleton instance
export const ticketStorage = new TicketStorage()
