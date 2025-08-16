// Ticket storage layer refactored using BaseStorage pattern
// Split into TicketStorage, TaskStorage, and TicketQueueStorage
import { z } from 'zod'
import { 
  TicketSchema, 
  TicketTaskSchema, 
  type Ticket, 
  type TicketTask,
  type ItemQueueStatus
} from '@promptliano/schemas'
import { BaseStorage } from './base-storage'
import { 
  createEntityConverter,
  createStandardMappings,
  getInsertColumnsFromMappings,
  getInsertValuesFromEntity
} from './utils/storage-helpers'
import { SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'
import { TicketErrors, TaskErrors } from '@promptliano/shared/src/error/entity-errors'
import { withTransaction, batchInsert, batchDelete } from './utils/transaction-helpers'

// Storage schemas for validation
export const TicketsStorageSchema = z.record(z.string(), TicketSchema)
export type TicketsStorage = z.infer<typeof TicketsStorageSchema>

export const TicketTasksStorageSchema = z.record(z.string(), TicketTaskSchema)
export type TicketTasksStorage = z.infer<typeof TicketTasksStorageSchema>

/**
 * Ticket storage implementation using BaseStorage
 * Part 1: Core ticket management
 */
class TicketStorageClass extends BaseStorage<Ticket, TicketsStorage> {
  protected readonly tableName = 'tickets'
  protected readonly entitySchema = TicketSchema as any
  protected readonly storageSchema = TicketsStorageSchema as any

  private readonly fieldMappings = {
    // Core fields
    id: { dbColumn: 'id', converter: (v: any) => SqliteConverters.toNumber(v) },
    projectId: { dbColumn: 'project_id', converter: (v: any) => SqliteConverters.toNumber(v) },
    title: { dbColumn: 'title', converter: (v: any) => SqliteConverters.toString(v) },
    overview: { dbColumn: 'overview', converter: (v: any) => SqliteConverters.toString(v), defaultValue: '' },
    status: { dbColumn: 'status', converter: (v: any) => v },
    priority: { dbColumn: 'priority', converter: (v: any) => v },
    
    // Suggested IDs arrays
    suggestedFileIds: { 
      dbColumn: 'suggested_file_ids', 
      converter: (v: any) => v ? SqliteConverters.toArray(v, [], 'ticket.suggestedFileIds') : []
    },
    suggestedAgentIds: { 
      dbColumn: 'suggested_agent_ids', 
      converter: (v: any) => v ? SqliteConverters.toArray(v, [], 'ticket.suggestedAgentIds') : []
    },
    suggestedPromptIds: { 
      dbColumn: 'suggested_prompt_ids', 
      converter: (v: any) => v ? SqliteConverters.toArray(v, [], 'ticket.suggestedPromptIds') : []
    },
    
    // Queue fields (unified flow system)
    queueId: { dbColumn: 'queue_id', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    queuePosition: { dbColumn: 'queue_position', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    queueStatus: { dbColumn: 'queue_status', converter: (v: any) => v || undefined },
    queuePriority: { dbColumn: 'queue_priority', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    queuedAt: { dbColumn: 'queued_at', converter: (v: any) => v ? SqliteConverters.toTimestamp(v) : undefined },
    queueStartedAt: { dbColumn: 'queue_started_at', converter: (v: any) => v ? SqliteConverters.toTimestamp(v) : undefined },
    queueCompletedAt: { dbColumn: 'queue_completed_at', converter: (v: any) => v ? SqliteConverters.toTimestamp(v) : undefined },
    queueAgentId: { dbColumn: 'queue_agent_id', converter: (v: any) => v || undefined },
    queueErrorMessage: { dbColumn: 'queue_error_message', converter: (v: any) => v || undefined },
    estimatedProcessingTime: { dbColumn: 'estimated_processing_time', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    actualProcessingTime: { dbColumn: 'actual_processing_time', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    
    // Timestamps
    created: { dbColumn: 'created_at', converter: (v: any) => SqliteConverters.toTimestamp(v) },
    updated: { dbColumn: 'updated_at', converter: (v: any) => SqliteConverters.toTimestamp(v) }
  } as const

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  public rowToEntity(row: any): Ticket {
    return this.converter(row) as Ticket
  }

  public getSelectColumns(): string[] {
    return [
      'id', 'project_id', 'title', 'overview', 'status', 'priority',
      'suggested_file_ids', 'suggested_agent_ids', 'suggested_prompt_ids',
      'queue_id', 'queue_position', 'queue_status', 'queue_priority',
      'queued_at', 'queue_started_at', 'queue_completed_at',
      'queue_agent_id', 'queue_error_message',
      'estimated_processing_time', 'actual_processing_time',
      'created_at', 'updated_at'
    ]
  }

  public getInsertColumns(): string[] {
    return getInsertColumnsFromMappings(this.fieldMappings)
  }

  public getInsertValues(entity: Ticket): any[] {
    const values = getInsertValuesFromEntity(entity, this.fieldMappings)
    // Handle array serialization for suggested IDs
    const arrays = [
      { field: 'suggested_file_ids', key: 'suggestedFileIds' },
      { field: 'suggested_agent_ids', key: 'suggestedAgentIds' },
      { field: 'suggested_prompt_ids', key: 'suggestedPromptIds' }
    ]
    
    for (const { field, key } of arrays) {
      const index = this.getInsertColumns().indexOf(field)
      if (index !== -1) {
        const arrayValue = (entity as any)[key]
        values[index] = JSON.stringify(arrayValue || [])
      }
    }
    
    // Handle optional fields with defaults for database
    const overviewIndex = this.getInsertColumns().indexOf('overview')
    if (overviewIndex !== -1 && !values[overviewIndex]) {
      values[overviewIndex] = ''
    }
    
    const statusIndex = this.getInsertColumns().indexOf('status')
    if (statusIndex !== -1 && !values[statusIndex]) {
      values[statusIndex] = 'open'
    }
    
    const priorityIndex = this.getInsertColumns().indexOf('priority')
    if (priorityIndex !== -1 && !values[priorityIndex]) {
      values[priorityIndex] = 'normal'
    }
    
    return values
  }

  // === Custom Methods ===

  // Public accessor for queue storage
  public getDatabase() {
    return this.getDb()
  }

  async readTickets(projectId: number): Promise<TicketsStorage> {
    return this.readAll('project_id = ?', [projectId])
  }

  async writeTickets(projectId: number, tickets: TicketsStorage): Promise<TicketsStorage> {
    return this.writeAll(tickets, 'project_id = ?', [projectId])
  }

  async getTicketById(ticketId: number): Promise<Ticket | null> {
    return this.getById(ticketId)
  }

  async addTicket(ticket: Ticket): Promise<Ticket> {
    return this.add(ticket)
  }

  async updateTicket(ticketId: number, updates: Partial<Ticket>): Promise<Ticket> {
    const result = await this.update(ticketId, updates)
    if (!result) {
      throw TicketErrors.notFound(ticketId)
    }
    return result
  }

  async deleteTicket(ticketId: number): Promise<boolean> {
    return this.delete(ticketId)
  }

  async deleteProjectTickets(projectId: number): Promise<void> {
    const db = this.getDb()
    const database = db.getDatabase()
    
    withTransaction(database, () => {
      // Delete all tasks for tickets in this project
      database.prepare(`
        DELETE FROM ticket_tasks 
        WHERE ticket_id IN (SELECT id FROM tickets WHERE project_id = ?)
      `).run(projectId)
      
      // Delete all tickets for this project
      database.prepare(`DELETE FROM tickets WHERE project_id = ?`).run(projectId)
    })
  }
}

/**
 * Task storage implementation using BaseStorage
 * Part 2: Task management
 */
class TaskStorageClass extends BaseStorage<TicketTask, TicketTasksStorage> {
  protected readonly tableName = 'ticket_tasks'
  protected readonly entitySchema = TicketTaskSchema as any
  protected readonly storageSchema = TicketTasksStorageSchema as any

  private readonly fieldMappings = {
    // Core fields
    id: { dbColumn: 'id', converter: (v: any) => SqliteConverters.toNumber(v) },
    ticketId: { dbColumn: 'ticket_id', converter: (v: any) => SqliteConverters.toNumber(v) },
    content: { dbColumn: 'content', converter: (v: any) => SqliteConverters.toString(v) },
    description: { dbColumn: 'description', converter: (v: any) => SqliteConverters.toString(v), defaultValue: '' },
    done: { dbColumn: 'done', converter: (v: any) => SqliteConverters.toBoolean(v) },
    orderIndex: { dbColumn: 'order_index', converter: (v: any) => SqliteConverters.toNumber(v) },
    estimatedHours: { dbColumn: 'estimated_hours', converter: (v: any) => v ? SqliteConverters.toNumber(v) : null },
    agentId: { dbColumn: 'agent_id', converter: (v: any) => v },
    
    // Array fields
    suggestedFileIds: { 
      dbColumn: 'suggested_file_ids', 
      converter: (v: any) => v ? SqliteConverters.toArray(v, [], 'task.suggestedFileIds') : []
    },
    suggestedPromptIds: { 
      dbColumn: 'suggested_prompt_ids', 
      converter: (v: any) => v ? SqliteConverters.toArray(v, [], 'task.suggestedPromptIds') : []
    },
    dependencies: { 
      dbColumn: 'dependencies', 
      converter: (v: any) => v ? SqliteConverters.toArray(v, [], 'task.dependencies') : []
    },
    tags: { 
      dbColumn: 'tags', 
      converter: (v: any) => v ? SqliteConverters.toArray(v, [], 'task.tags') : []
    },
    
    // Queue fields (unified flow system)
    queueId: { dbColumn: 'queue_id', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    queuePosition: { dbColumn: 'queue_position', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    queueStatus: { dbColumn: 'queue_status', converter: (v: any) => v || undefined },
    queuePriority: { dbColumn: 'queue_priority', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    queuedAt: { dbColumn: 'queued_at', converter: (v: any) => v ? SqliteConverters.toTimestamp(v) : undefined },
    queueStartedAt: { dbColumn: 'queue_started_at', converter: (v: any) => v ? SqliteConverters.toTimestamp(v) : undefined },
    queueCompletedAt: { dbColumn: 'queue_completed_at', converter: (v: any) => v ? SqliteConverters.toTimestamp(v) : undefined },
    queueAgentId: { dbColumn: 'queue_agent_id', converter: (v: any) => v || undefined },
    queueErrorMessage: { dbColumn: 'queue_error_message', converter: (v: any) => v || undefined },
    estimatedProcessingTime: { dbColumn: 'estimated_processing_time', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    actualProcessingTime: { dbColumn: 'actual_processing_time', converter: (v: any) => v ? SqliteConverters.toNumber(v) : undefined },
    
    // Timestamps
    created: { dbColumn: 'created_at', converter: (v: any) => SqliteConverters.toTimestamp(v) },
    updated: { dbColumn: 'updated_at', converter: (v: any) => SqliteConverters.toTimestamp(v) }
  } as const

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  public rowToEntity(row: any): TicketTask {
    return this.converter(row) as TicketTask
  }

  public getSelectColumns(): string[] {
    return [
      'id', 'ticket_id', 'content', 'description', 'done', 'order_index',
      'estimated_hours', 'agent_id', 'suggested_file_ids', 'suggested_prompt_ids',
      'dependencies', 'tags',
      'queue_id', 'queue_position', 'queue_status', 'queue_priority',
      'queued_at', 'queue_started_at', 'queue_completed_at',
      'queue_agent_id', 'queue_error_message',
      'estimated_processing_time', 'actual_processing_time',
      'created_at', 'updated_at'
    ]
  }

  public getInsertColumns(): string[] {
    return getInsertColumnsFromMappings(this.fieldMappings)
  }

  public getInsertValues(entity: TicketTask): any[] {
    const values = getInsertValuesFromEntity(entity, this.fieldMappings)
    // Handle array serialization
    const arrays = ['suggested_file_ids', 'suggested_prompt_ids', 'dependencies', 'tags']
    for (const field of arrays) {
      const index = this.getInsertColumns().indexOf(field)
      if (index !== -1) {
        const key = field.replace(/_([a-z])/g, (_, l) => l.toUpperCase()) as keyof TicketTask
        const arrayValue = (entity as any)[key]
        values[index] = JSON.stringify(arrayValue || [])
      }
    }
    // Handle boolean conversion
    const doneIndex = this.getInsertColumns().indexOf('done')
    if (doneIndex !== -1) {
      values[doneIndex] = entity.done ? 1 : 0
    }
    return values
  }

  // === Custom Methods ===

  // Public accessor for queue storage
  public getDatabase() {
    return this.getDb()
  }

  async readTicketTasks(ticketId: number): Promise<TicketTasksStorage> {
    return this.readAll('ticket_id = ?', [ticketId])
  }

  async writeTicketTasks(ticketId: number, tasks: TicketTasksStorage): Promise<TicketTasksStorage> {
    return this.writeAll(tasks, 'ticket_id = ?', [ticketId])
  }

  async getTaskById(taskId: number): Promise<TicketTask | null> {
    return this.getById(taskId)
  }

  async addTask(task: TicketTask): Promise<TicketTask> {
    return this.add(task)
  }

  async updateTask(taskId: number, updates: Partial<TicketTask>): Promise<TicketTask> {
    const result = await this.update(taskId, updates)
    if (!result) {
      throw TaskErrors.notFound(taskId)
    }
    return result
  }

  async deleteTask(taskId: number): Promise<boolean> {
    return this.delete(taskId)
  }

  async deleteTicketTasks(ticketId: number): Promise<void> {
    const db = this.getDb()
    const database = db.getDatabase()
    database.prepare(`DELETE FROM ticket_tasks WHERE ticket_id = ?`).run(ticketId)
  }
}

/**
 * Queue-specific operations for tickets and tasks
 * Part 3: Queue management
 */
class TicketQueueStorage {
  private ticketStorage = new TicketStorageClass()
  private taskStorage = new TaskStorageClass()

  private getDb() {
    return this.ticketStorage.getDatabase()
  }

  async getNextQueuePosition(queueId: number): Promise<number> {
    const db = this.getDb()
    const database = db.getDatabase()

    const result = database.prepare(`
      SELECT 
        COALESCE(MAX(queue_position), 0) + 1 as next_position
      FROM (
        SELECT queue_position FROM tickets WHERE queue_id = ?
        UNION ALL
        SELECT queue_position FROM ticket_tasks WHERE queue_id = ?
      )
    `).get(queueId, queueId) as any

    return result?.next_position || 1
  }

  async getQueueItems(queueId: number): Promise<{ tickets: Ticket[]; tasks: TicketTask[] }> {
    const db = this.getDb()
    const database = db.getDatabase()

    // Get queued tickets
    const ticketQuery = database.prepare(`
      SELECT ${this.ticketStorage.getSelectColumns().join(', ')}
      FROM tickets
      WHERE queue_id = ?
      ORDER BY queue_position ASC, queue_priority ASC
    `)
    
    const ticketRows = ticketQuery.all(queueId) as any[]
    const tickets = ticketRows.map(row => this.ticketStorage.rowToEntity(row))

    // Get queued tasks
    const taskQuery = database.prepare(`
      SELECT ${this.taskStorage.getSelectColumns().join(', ')}
      FROM ticket_tasks
      WHERE queue_id = ?
      ORDER BY queue_position ASC, queue_priority ASC
    `)
    
    const taskRows = taskQuery.all(queueId) as any[]
    const tasks = taskRows.map(row => this.taskStorage.rowToEntity(row))

    return { tickets, tasks }
  }

  async getUnqueuedItems(projectId: number): Promise<{ tickets: Ticket[]; tasks: TicketTask[] }> {
    const db = this.getDb()
    const database = db.getDatabase()

    // Get unqueued tickets
    const ticketQuery = database.prepare(`
      SELECT ${this.ticketStorage.getSelectColumns().join(', ')}
      FROM tickets
      WHERE project_id = ? AND queue_id IS NULL
      ORDER BY created_at DESC
    `)
    
    const ticketRows = ticketQuery.all(projectId) as any[]
    const tickets = ticketRows.map(row => this.ticketStorage.rowToEntity(row))

    // Get unqueued tasks for this project
    const taskQuery = database.prepare(`
      SELECT ${this.taskStorage.getSelectColumns().join(', ')}
      FROM ticket_tasks tt
      JOIN tickets t ON tt.ticket_id = t.id
      WHERE t.project_id = ? AND tt.queue_id IS NULL
      ORDER BY tt.created_at DESC
    `)
    
    const taskRows = taskQuery.all(projectId) as any[]
    const tasks = taskRows.map(row => this.taskStorage.rowToEntity(row))

    return { tickets, tasks }
  }

  async updateQueueStatus(
    itemType: 'ticket' | 'task',
    itemId: number,
    status: ItemQueueStatus,
    agentId?: string
  ): Promise<void> {
    const db = this.getDb()
    const database = db.getDatabase()
    const now = Date.now()

    const table = itemType === 'ticket' ? 'tickets' : 'ticket_tasks'
    
    let updateFields = ['queue_status = ?', 'updated_at = ?']
    let updateValues: any[] = [status, now]

    if (status === 'in_progress' && agentId) {
      updateFields.push('queue_started_at = ?', 'queue_agent_id = ?')
      updateValues.push(now, agentId)
    } else if (status === 'completed') {
      updateFields.push('queue_completed_at = ?')
      updateValues.push(now)
      
      // Calculate actual processing time
      const item = database.prepare(`
        SELECT queue_started_at FROM ${table} WHERE id = ?
      `).get(itemId) as any
      
      if (item?.queue_started_at) {
        updateFields.push('actual_processing_time = ?')
        updateValues.push(now - item.queue_started_at)
      }
    }

    updateValues.push(itemId)

    database.prepare(`
      UPDATE ${table}
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...updateValues)
  }

  async getTicketsWithTasksOptimized(projectId: number): Promise<Array<{ ticket: Ticket; tasks: TicketTask[] }>> {
    const db = this.getDb()
    const database = db.getDatabase()

    // Single query to get all tickets and tasks with a join
    const query = database.prepare(`
      SELECT 
        t.id as ticket_id,
        ${this.ticketStorage.getSelectColumns().map(c => `t.${c} as t_${c}`).join(', ')},
        ${this.taskStorage.getSelectColumns().map(c => `tt.${c} as tt_${c}`).join(', ')}
      FROM tickets t
      LEFT JOIN ticket_tasks tt ON t.id = tt.ticket_id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC, tt.order_index ASC
    `)

    const rows = query.all(projectId) as any[]
    
    // Group by ticket
    const ticketsMap = new Map<number, { ticket: Ticket; tasks: TicketTask[] }>()
    
    for (const row of rows) {
      const ticketId = row.ticket_id
      
      if (!ticketsMap.has(ticketId)) {
        // Create ticket from t_ prefixed columns
        const ticketRow: any = {}
        for (const col of this.ticketStorage.getSelectColumns()) {
          ticketRow[col] = row[`t_${col}`]
        }
        
        ticketsMap.set(ticketId, {
          ticket: this.ticketStorage.rowToEntity(ticketRow),
          tasks: []
        })
      }
      
      // Add task if exists (LEFT JOIN may have null tasks)
      if (row.tt_id) {
        const taskRow: any = {}
        for (const col of this.taskStorage.getSelectColumns()) {
          taskRow[col] = row[`tt_${col}`]
        }
        
        ticketsMap.get(ticketId)!.tasks.push(this.taskStorage.rowToEntity(taskRow))
      }
    }
    
    return Array.from(ticketsMap.values())
  }
}

// Create singleton instances
const ticketStorageInstance = new TicketStorageClass()
const taskStorageInstance = new TaskStorageClass()
const queueStorageInstance = new TicketQueueStorage()

// Export the combined storage object for backward compatibility
export const ticketStorage = {
  // Ticket methods
  readTickets: (projectId: number) => ticketStorageInstance.readTickets(projectId),
  writeTickets: (projectId: number, tickets: TicketsStorage) => 
    ticketStorageInstance.writeTickets(projectId, tickets),
  getTicketById: (ticketId: number) => ticketStorageInstance.getTicketById(ticketId),
  addTicket: (ticket: Ticket) => ticketStorageInstance.addTicket(ticket),
  updateTicket: (ticketId: number, updates: any) => ticketStorageInstance.updateTicket(ticketId, updates),
  replaceTicket: async (ticketId: number, ticket: Ticket) => {
    // Replace is essentially an update with all fields
    const result = await ticketStorageInstance.update(ticketId, ticket)
    return result !== null
  },
  deleteTicketData: async (ticketId: number) => {
    await taskStorageInstance.deleteTicketTasks(ticketId)
    await ticketStorageInstance.deleteTicket(ticketId)
  },
  deleteProjectTickets: (projectId: number) => ticketStorageInstance.deleteProjectTickets(projectId),
  readTicket: (ticketId: number) => ticketStorageInstance.getTicketById(ticketId),
  enqueueTicket: async (ticketId: number, queueId: number, priority: number = 0) => {
    const position = await queueStorageInstance.getNextQueuePosition(queueId)
    const now = Date.now()
    const updates: Partial<Ticket> = {
      queueId,
      queuePosition: position,
      queueStatus: 'queued' as any,
      queuePriority: priority || 0,
      queuedAt: now,
      updated: now
    }
    await ticketStorageInstance.update(ticketId, updates)
    return true
  },
  dequeueTicket: async (ticketId: number) => {
    const updates = {
      queueId: undefined,
      queuePosition: undefined,
      queueStatus: undefined,
      queuePriority: undefined,
      queuedAt: undefined,
      queueStartedAt: undefined,
      queueCompletedAt: undefined,
      queueAgentId: undefined,
      queueErrorMessage: undefined,
      estimatedProcessingTime: undefined,
      actualProcessingTime: undefined,
      updated: Date.now()
    }
    await ticketStorageInstance.update(ticketId, updates)
    return true
  },
  generateTicketId: () => ticketStorageInstance.generateId(),
  
  // Task methods
  readTicketTasks: (ticketId: number) => taskStorageInstance.readTicketTasks(ticketId),
  writeTicketTasks: (ticketId: number, tasks: TicketTasksStorage) => 
    taskStorageInstance.writeTicketTasks(ticketId, tasks),
  getTaskById: (taskId: number) => taskStorageInstance.getTaskById(taskId),
  addTask: (task: TicketTask) => taskStorageInstance.addTask(task),
  updateTask: (ticketId: number, taskId: number, updates: any) => 
    taskStorageInstance.updateTask(taskId, updates),
  replaceTask: async (taskId: number, task: TicketTask) => {
    // Replace is essentially an update with all fields
    const result = await taskStorageInstance.update(taskId, task)
    return result !== null
  },
  deleteTask: (taskId: number) => taskStorageInstance.deleteTask(taskId),
  readTask: (ticketId: number, taskId: number) => taskStorageInstance.getTaskById(taskId),
  readTasks: (ticketId: number) => taskStorageInstance.readTicketTasks(ticketId),
  generateTaskId: () => taskStorageInstance.generateId(),
  enqueueTask: async (taskId: number, queueId: number, priority: number = 0) => {
    const position = await queueStorageInstance.getNextQueuePosition(queueId)
    const now = Date.now()
    const updates: Partial<TicketTask> = {
      queueId,
      queuePosition: position,
      queueStatus: 'queued' as any,
      queuePriority: priority || 0,
      queuedAt: now,
      updated: now
    }
    await taskStorageInstance.update(taskId, updates)
    return true
  },
  dequeueTask: async (taskId: number) => {
    const updates = {
      queueId: undefined,
      queuePosition: undefined,
      queueStatus: undefined,
      queuePriority: undefined,
      queuedAt: undefined,
      queueStartedAt: undefined,
      queueCompletedAt: undefined,
      queueAgentId: undefined,
      queueErrorMessage: undefined,
      estimatedProcessingTime: undefined,
      actualProcessingTime: undefined,
      updated: Date.now()
    }
    await taskStorageInstance.update(taskId, updates)
    return true
  },
  
  // Queue methods
  getNextQueuePosition: (queueId: number) => queueStorageInstance.getNextQueuePosition(queueId),
  getQueueItems: (queueId: number) => queueStorageInstance.getQueueItems(queueId),
  getUnqueuedItems: (projectId: number) => queueStorageInstance.getUnqueuedItems(projectId),
  updateQueueStatus: (itemType: 'ticket' | 'task', itemId: number, status: ItemQueueStatus, agentId?: string) =>
    queueStorageInstance.updateQueueStatus(itemType, itemId, status, agentId),
  getTicketsWithTasksOptimized: (projectId: number) => 
    queueStorageInstance.getTicketsWithTasksOptimized(projectId),
  
  // Utility methods
  generateId: () => ticketStorageInstance.generateId()
}