// Last 5 changes: Created comprehensive ticket storage layer following Promptliano database patterns
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

      // Find all tickets for this project using JSON query
      const tickets = await db.findByJsonField<Ticket>(TICKETS_TABLE, '$.projectId', projectId)

      // Convert array to TicketsStorage (Record keyed by ticketId)
      const ticketsStorage: TicketsStorage = {}
      for (const ticket of tickets) {
        // Validate each ticket
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
          WHERE JSON_EXTRACT(data, '$.projectId') = ?
        `)
        deleteQuery.run(projectId)

        // Write all new tickets
        const now = Date.now()
        const insertQuery = database.prepare(`
          INSERT INTO ${TICKETS_TABLE} (id, data, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `)

        for (const [ticketId, ticket] of Object.entries(validatedTickets)) {
          // Ensure projectId is consistent
          if (ticket.projectId !== projectId) {
            throw new ApiError(400, `Ticket ${ticketId} has mismatched projectId`, 'INVALID_PROJECT_ID')
          }
          insertQuery.run(ticketId, JSON.stringify(ticket), ticket.created || now, ticket.updated || now)
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
      const ticket = await db.get<Ticket>(TICKETS_TABLE, String(ticketId))

      if (!ticket) {
        return null
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

      // Find all tasks for this ticket using JSON query
      const tasks = await db.findByJsonField<TicketTask>(TICKET_TASKS_TABLE, '$.ticketId', ticketId)

      // Convert array to TicketTasksStorage (Record keyed by taskId)
      const tasksStorage: TicketTasksStorage = {}
      for (const task of tasks) {
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
          WHERE JSON_EXTRACT(data, '$.ticketId') = ?
        `)
        deleteQuery.run(ticketId)

        // Write all new tasks
        const now = Date.now()
        const insertQuery = database.prepare(`
          INSERT INTO ${TICKET_TASKS_TABLE} (id, data, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `)

        for (const [taskId, task] of Object.entries(validatedTasks)) {
          // Ensure ticketId is consistent
          if (task.ticketId !== ticketId) {
            throw new ApiError(400, `Task ${taskId} has mismatched ticketId`, 'INVALID_TICKET_ID')
          }
          insertQuery.run(taskId, JSON.stringify(task), task.created || now, task.updated || now)
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
        // Delete all tasks for this ticket
        const taskDeleteQuery = database.prepare(`
          DELETE FROM ${TICKET_TASKS_TABLE}
          WHERE JSON_EXTRACT(data, '$.ticketId') = ?
        `)
        const taskResult = taskDeleteQuery.run(ticketId)

        // Delete the ticket
        const ticketDeleteQuery = database.prepare(`DELETE FROM ${TICKETS_TABLE} WHERE id = ?`)
        const ticketResult = ticketDeleteQuery.run(String(ticketId))

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
          SELECT JSON_EXTRACT(data, '$.id') as ticketId FROM ${TICKETS_TABLE}
          WHERE JSON_EXTRACT(data, '$.projectId') = ?
        `)
        const ticketIds = getTicketsQuery.all(projectId) as Array<{ ticketId: number }>

        // Delete all tasks for all tickets in this project
        for (const { ticketId } of ticketIds) {
          const taskDeleteQuery = database.prepare(`
            DELETE FROM ${TICKET_TASKS_TABLE}
            WHERE JSON_EXTRACT(data, '$.ticketId') = ?
          `)
          taskDeleteQuery.run(ticketId)
        }

        // Delete all tickets for this project
        const ticketDeleteQuery = database.prepare(`
          DELETE FROM ${TICKETS_TABLE}
          WHERE JSON_EXTRACT(data, '$.projectId') = ?
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
        SELECT data FROM ${TICKETS_TABLE}
        WHERE JSON_EXTRACT(data, '$.projectId') = ?
        AND created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC
      `)
      const rows = query.all(projectId, startTime, endTime) as Array<{ data: string }>

      // Validate each ticket
      const validatedTickets: Ticket[] = []
      for (const row of rows) {
        const ticket = JSON.parse(row.data)
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
      return await db.countByJsonField(TICKET_TASKS_TABLE, '$.ticketId', ticketId)
    } catch (error: any) {
      console.error(`Error counting tasks for ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to count tasks for ticket ${ticketId}`, 'DB_READ_ERROR')
    }
  }

  /** Get a single task by ID. */
  async getTaskById(taskId: number): Promise<TicketTask | null> {
    try {
      const db = this.getDb()
      const task = await db.get<TicketTask>(TICKET_TASKS_TABLE, String(taskId))

      if (!task) {
        return null
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

      // Validate the ticket
      const validatedTicket = await validateData(ticket, TicketSchema, `ticket ${ticket.id}`)

      // Create the ticket
      await db.create(TICKETS_TABLE, String(validatedTicket.id), validatedTicket)

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

      // Validate the ticket
      const validatedTicket = await validateData(ticket, TicketSchema, `ticket ${ticketId}`)

      // Update the ticket
      return await db.update(TICKETS_TABLE, String(ticketId), validatedTicket)
    } catch (error: any) {
      console.error(`Error updating ticket ${ticketId}:`, error)
      throw new ApiError(500, `Failed to update ticket ${ticketId}`, 'DB_UPDATE_ERROR')
    }
  }

  /** Add a single task. */
  async addTask(task: TicketTask): Promise<TicketTask> {
    try {
      const db = this.getDb()

      // Validate the task
      const validatedTask = await validateData(task, TicketTaskSchema, `task ${task.id}`)

      // Create the task
      await db.create(TICKET_TASKS_TABLE, String(validatedTask.id), validatedTask)

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

      // Validate the task
      const validatedTask = await validateData(task, TicketTaskSchema, `task ${taskId}`)

      // Update the task
      return await db.update(TICKET_TASKS_TABLE, String(taskId), validatedTask)
    } catch (error: any) {
      console.error(`Error updating task ${taskId}:`, error)
      throw new ApiError(500, `Failed to update task ${taskId}`, 'DB_UPDATE_ERROR')
    }
  }

  /** Delete a single task. */
  async deleteTask(taskId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      return await db.delete(TICKET_TASKS_TABLE, String(taskId))
    } catch (error: any) {
      console.error(`Error deleting task ${taskId}:`, error)
      throw new ApiError(500, `Failed to delete task ${taskId}`, 'DB_DELETE_ERROR')
    }
  }
}

// Export singleton instance
export const ticketStorage = new TicketStorage()
