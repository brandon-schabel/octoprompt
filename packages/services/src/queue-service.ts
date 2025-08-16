// Queue service layer - simplified to use Flow system only
import type {
  TaskQueue,
  CreateQueueBody,
  UpdateQueueBody,
  QueueStats,
  QueueWithStats,
  Ticket,
  TicketTask
} from '@promptliano/schemas'
import { queueStorage } from '@promptliano/storage'
import { ticketStorage } from '@promptliano/storage'
import { updateTicket as serviceUpdateTicket } from './ticket-service'
import { ApiError } from '@promptliano/shared'
import { ErrorFactory, assertExists, assertUpdateSucceeded } from './utils/error-factory'
import { QueueErrors, TicketErrors, TaskErrors } from '@promptliano/shared/src/error/entity-errors'
import { 
  clearQueueFields,
  createStartProcessingUpdate,
  createCompleteProcessingUpdate,
  createEnqueueUpdate
} from '@promptliano/shared/src/utils/queue-field-utils'

// === Queue Management ===

export async function createQueue(data: CreateQueueBody): Promise<TaskQueue> {
  try {
    // Validate project exists
    const projectQueues = await queueStorage.readQueues(data.projectId)

    // Check for duplicate name (case handled by storage unique constraint)
    const queue = await queueStorage.createQueue({
      projectId: data.projectId,
      name: data.name,
      description: data.description || '',
      status: 'active',
      maxParallelItems: data.maxParallelItems || 1,
      totalCompletedItems: 0
    })

    return queue
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error creating queue:', error)
    ErrorFactory.operationFailed('create queue', errorMessage)
  }
}

export async function getQueueById(queueId: number): Promise<TaskQueue> {
  const queue = await queueStorage.readQueue(queueId)
  if (!queue) {
    throw QueueErrors.notFound(queueId)
  }
  return queue
}

export async function listQueuesByProject(projectId: number): Promise<TaskQueue[]> {
  const queues = await queueStorage.readQueues(projectId)
  return Object.values(queues)
}

export async function updateQueue(queueId: number, updates: UpdateQueueBody): Promise<TaskQueue> {
  // Verify queue exists
  await getQueueById(queueId)

  return await queueStorage.updateQueue(queueId, updates)
}

export async function deleteQueue(queueId: number): Promise<void> {
  const deleted = await queueStorage.deleteQueue(queueId)
  if (!deleted) {
    throw QueueErrors.notFound(queueId)
  }
}

export async function pauseQueue(queueId: number): Promise<TaskQueue> {
  try {
    // Verify queue exists
    const queue = await getQueueById(queueId)

    if (queue.status === 'paused') {
      throw QueueErrors.alreadyInState(queueId, 'paused')
    }

    // Update queue status to paused
    return await queueStorage.updateQueue(queueId, { status: 'paused' })
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error pausing queue:', error)
    ErrorFactory.operationFailed('pause queue', errorMessage)
  }
}

export async function resumeQueue(queueId: number): Promise<TaskQueue> {
  try {
    // Verify queue exists
    const queue = await getQueueById(queueId)

    if (queue.status === 'active') {
      throw QueueErrors.alreadyInState(queueId, 'active')
    }

    // Update queue status to active
    return await queueStorage.updateQueue(queueId, { status: 'active' })
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error resuming queue:', error)
    ErrorFactory.operationFailed('resume queue', errorMessage)
  }
}

// === Simplified Queue Operations Using Flow System ===

/**
 * Enqueue a ticket or task by updating its queueId field
 */
export async function enqueueTicket(ticketId: number, queueId: number, priority: number = 0): Promise<Ticket> {
  try {
    // Verify queue exists
    await getQueueById(queueId)

    // Verify ticket exists
    const ticket = await ticketStorage.readTicket(ticketId)
    if (!ticket) {
      throw TicketErrors.notFound(ticketId)
    }

    // Update ticket queue fields using type-safe helper
    const updatedTicket = await ticketStorage.updateTicket(ticketId, createEnqueueUpdate(queueId, priority))

    return updatedTicket
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error enqueuing ticket:', error)
    ErrorFactory.operationFailed('enqueue ticket', errorMessage)
  }
}

/**
 * Enqueue a task by updating its queueId field
 */
export async function enqueueTask(
  ticketId: number,
  taskId: number,
  queueId: number,
  priority: number = 0
): Promise<TicketTask> {
  try {
    // Verify queue exists
    await getQueueById(queueId)

    // Verify task exists
    const task = await ticketStorage.getTaskById(taskId)
    if (!task || task.ticketId !== ticketId) {
      throw TaskErrors.notFound(taskId)
    }

    // Update task queue fields using type-safe helper
    const updatedTask = await ticketStorage.updateTask(ticketId, taskId, createEnqueueUpdate(queueId, priority))

    return updatedTask
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error enqueuing task:', error)
    ErrorFactory.operationFailed('enqueue task', errorMessage)
  }
}

/**
 * Enqueue a ticket with all its tasks
 */
export async function enqueueTicketWithAllTasks(
  queueId: number,
  ticketId: number,
  priority?: number
): Promise<{ ticket: Ticket; tasks: TicketTask[] }> {
  try {
    // Verify queue exists
    await getQueueById(queueId)

    // Enqueue the ticket
    const ticket = await enqueueTicket(ticketId, queueId, priority || 0)

    // Get all tasks for the ticket
    const tasks = await ticketStorage.readTasks(ticketId)
    const taskList = Object.values(tasks)
      .filter((task) => !task.done) // Only enqueue incomplete tasks
      .sort((a, b) => a.orderIndex - b.orderIndex) // Maintain order

    // Enqueue each task
    const enqueuedTasks: TicketTask[] = []
    for (const [i, task] of taskList.entries()) {
      const taskPriority = priority !== undefined ? priority + (taskList.length - i) : i + 1
      const enqueuedTask = await enqueueTask(ticketId, task.id, queueId, taskPriority)
      enqueuedTasks.push(enqueuedTask)
    }

    return { ticket, tasks: enqueuedTasks }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error enqueuing ticket with tasks:', error)
    ErrorFactory.operationFailed('enqueue ticket with tasks', errorMessage)
  }
}

/**
 * Remove ticket from queue
 */
export async function dequeueTicket(ticketId: number): Promise<Ticket> {
  try {
    const ticket = await ticketStorage.readTicket(ticketId)
    if (!ticket) {
      throw TicketErrors.notFound(ticketId)
    }

    // Clear queue fields on the ticket using type-safe helper
    const updatedTicket = await ticketStorage.updateTicket(ticketId, clearQueueFields())

    // Also dequeue all tasks associated with this ticket
    const tasks = await ticketStorage.readTasks(ticketId)
    const taskList = Object.values(tasks).filter((task) => task.queueId !== null)

    for (const task of taskList) {
      await ticketStorage.updateTask(ticketId, task.id, clearQueueFields())
    }

    return updatedTicket
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error dequeuing ticket:', error)
    ErrorFactory.operationFailed('dequeue ticket', errorMessage)
  }
}

/**
 * Remove task from queue
 */
export async function dequeueTask(ticketId: number, taskId: number): Promise<TicketTask> {
  try {
    const task = await ticketStorage.getTaskById(taskId)
    if (!task || task.ticketId !== ticketId) {
      throw TaskErrors.notFound(taskId)
    }

    // Clear queue fields using type-safe helper
    const updatedTask = await ticketStorage.updateTask(ticketId, taskId, clearQueueFields())

    return updatedTask
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error dequeuing task:', error)
    ErrorFactory.operationFailed('dequeue task', errorMessage)
  }
}

/**
 * Remove a ticket and all its tasks from queue
 */
export async function dequeueTicketWithAllTasks(ticketId: number): Promise<{ ticket: Ticket; tasks: TicketTask[] }> {
  try {
    // Dequeue the ticket
    const ticket = await dequeueTicket(ticketId)

    // Get all tasks for the ticket
    const tasks = await ticketStorage.readTasks(ticketId)
    const taskList = Object.values(tasks)
      .filter((task) => task.queueId !== null) // Only dequeue tasks that are queued
      .sort((a, b) => a.orderIndex - b.orderIndex) // Maintain order

    // Dequeue each task
    const dequeuedTasks: TicketTask[] = []
    for (const task of taskList) {
      const dequeuedTask = await dequeueTask(ticketId, task.id)
      dequeuedTasks.push(dequeuedTask)
    }

    return { ticket, tasks: dequeuedTasks }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error dequeuing ticket with tasks:', error)
    ErrorFactory.operationFailed('dequeue ticket with tasks', errorMessage)
  }
}

/**
 * Get next task from queue for processing
 * Enforces maxParallelItems limit to prevent too many concurrent tasks
 */
export async function getNextTaskFromQueue(
  queueId: number,
  agentId?: string
): Promise<{ type: 'ticket' | 'task' | 'none'; item: Ticket | TicketTask | null; message?: string }> {
  try {
    const queue = await getQueueById(queueId)

    // Check if queue is active
    if (queue.status !== 'active') {
      console.log(`[Queue] Queue ${queueId} is ${queue.status}, not returning tasks`)
      return { type: 'none', item: null, message: `Queue is ${queue.status}` }
    }

    // ENFORCE MAX PARALLEL ITEMS
    // Count current in-progress items
    const stats = await getQueueStats(queueId)
    if (stats.inProgressItems >= queue.maxParallelItems) {
      console.log(
        `[Queue] Queue ${queueId} has reached max parallel items (${stats.inProgressItems}/${queue.maxParallelItems})`
      )
      return {
        type: 'none',
        item: null,
        message: `Queue has reached maximum parallel items limit (${queue.maxParallelItems}). Wait for current tasks to complete.`
      }
    }

    // Get all tickets and tasks in this queue that are queued
    const projectTickets = await ticketStorage.readTickets(queue.projectId)

    // Find tickets in this queue with 'queued' status
    const queuedTickets = Object.values(projectTickets)
      .filter((t) => t.queueId === queueId && t.queueStatus === 'queued')
      .sort((a, b) => {
        // Sort by priority (lower values first per migration 022), then by queued time (older first)
        if (a.queuePriority !== b.queuePriority) {
          return (a.queuePriority || 999) - (b.queuePriority || 999) // Use 999 as default so null/undefined goes last
        }
        return (a.queuedAt || 0) - (b.queuedAt || 0)
      })

    // Try to get a ticket first
    if (queuedTickets.length > 0) {
      const ticket = queuedTickets[0]

      if (!ticket) {
        console.warn('[Queue] Ticket array has length but first item is undefined')
        return { type: 'none', item: null, message: 'No valid tickets available' }
      }

      // Update ticket status to in_progress using type-safe helper
      const updatedTicket = await ticketStorage.updateTicket(ticket.id, createStartProcessingUpdate(agentId))

      return { type: 'ticket', item: updatedTicket }
    }

    // If no tickets, look for tasks
    for (const ticket of Object.values(projectTickets)) {
      const tasks = await ticketStorage.readTasks(ticket.id)
      const queuedTasks = Object.values(tasks)
        .filter((t) => t.queueId === queueId && t.queueStatus === 'queued' && !t.done)
        .sort((a, b) => {
          // Sort by priority (lower values first per migration 022), then by order index
          if (a.queuePriority !== b.queuePriority) {
            return (a.queuePriority || 999) - (b.queuePriority || 999) // Use 999 as default so null/undefined goes last
          }
          return a.orderIndex - b.orderIndex
        })

      if (queuedTasks.length > 0) {
        const task = queuedTasks[0]

        if (!task) {
          console.warn('[Queue] Task array has length but first item is undefined')
          continue
        }

        // Update task status to in_progress using type-safe helper
        const updatedTask = await ticketStorage.updateTask(ticket.id, task.id, createStartProcessingUpdate(agentId))

        // Reflect progress on parent ticket
        try {
          const parentTicket = await ticketStorage.readTicket(ticket.id)
          if (parentTicket) {
            await ticketStorage.updateTicket(ticket.id, {
              queueStatus: 'in_progress',
              queueStartedAt: parentTicket.queueStartedAt || Date.now(),
              queueAgentId: parentTicket.queueAgentId || agentId
            })
          }
        } catch { }

        return { type: 'task', item: updatedTask }
      }
    }

    return { type: 'none', item: null, message: 'No tasks available' }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error getting next task from queue:', error)
    ErrorFactory.operationFailed('get next task from queue', errorMessage)
  }
}

// === Queue Statistics ===

export async function getQueueStats(queueId: number): Promise<QueueStats> {
  const queue = await getQueueById(queueId)
  const stats = await queueStorage.getEnhancedQueueStats(queueId)

  // Get current agents from tickets/tasks
  const projectTickets = await ticketStorage.readTickets(queue.projectId)
  const currentAgents = new Set<string>()

  // Check tickets
  for (const ticket of Object.values(projectTickets)) {
    if (ticket.queueId === queueId && ticket.queueStatus === 'in_progress' && ticket.queueAgentId) {
      currentAgents.add(ticket.queueAgentId)
    }

    // Check tasks
    const tasks = await ticketStorage.readTasks(ticket.id)
    for (const task of Object.values(tasks)) {
      if (task.queueId === queueId && task.queueStatus === 'in_progress' && task.queueAgentId) {
        currentAgents.add(task.queueAgentId)
      }
    }
  }

  return {
    queueId: queue.id,
    queueName: queue.name,
    totalItems: stats.totalItems,
    queuedItems: stats.queuedItems,
    inProgressItems: stats.inProgressItems,
    completedItems: stats.completedItems,
    failedItems: stats.failedItems,
    cancelledItems: stats.cancelledItems,
    averageProcessingTime: stats.averageProcessingTime,
    currentAgents: Array.from(currentAgents),
    ticketCount: stats.ticketCount,
    taskCount: stats.taskCount,
    uniqueTickets: stats.uniqueTickets
  }
}

export async function getQueuesWithStats(projectId: number): Promise<QueueWithStats[]> {
  const queues = await listQueuesByProject(projectId)
  const results: QueueWithStats[] = []

  for (const queue of queues) {
    const stats = await getQueueStats(queue.id)
    results.push({ queue, stats })
  }

  return results
}

// === Batch Operations ===

/**
 * Move items between queues
 */
export async function moveItemToQueue(
  itemType: 'ticket' | 'task',
  itemId: number,
  targetQueueId: number | null,
  ticketId?: number
): Promise<void> {
  try {
    if (targetQueueId !== null) {
      // Verify target queue exists
      await getQueueById(targetQueueId)
    }

    if (itemType === 'ticket') {
      if (targetQueueId === null) {
        await dequeueTicketWithAllTasks(itemId)
      } else {
        await enqueueTicket(itemId, targetQueueId)
      }
    } else {
      if (!ticketId) {
        throw TaskErrors.missingRequired('ticketId')
      }
      if (targetQueueId === null) {
        await dequeueTask(ticketId, itemId)
      } else {
        await enqueueTask(ticketId, itemId, targetQueueId)
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error moving item to queue:', error)
    ErrorFactory.operationFailed('move item to queue', errorMessage)
  }
}

/**
 * Complete a ticket or task in queue
 */
export async function completeQueueItem(itemType: 'ticket' | 'task', itemId: number, ticketId?: number): Promise<void> {
  try {
    if (itemType === 'ticket') {
      const ticket = await ticketStorage.readTicket(itemId)
      if (!ticket) {
        ErrorFactory.notFound("Ticket", itemId)
      }

      const completionUpdate = createCompleteProcessingUpdate(true)
      if (ticket.queueStartedAt) {
        completionUpdate.actualProcessingTime = Date.now() - ticket.queueStartedAt
      }
      await ticketStorage.updateTicket(itemId, completionUpdate)

      // Also mark all tasks as completed
      const tasks = await ticketStorage.readTasks(itemId)
      for (const task of Object.values(tasks)) {
        if (task.queueId === ticket.queueId) {
          const taskCompletionUpdate = {
            ...createCompleteProcessingUpdate(true),
            done: true
          }
          await ticketStorage.updateTask(itemId, task.id, taskCompletionUpdate)
        }
      }
    } else {
      if (!ticketId) {
        throw TaskErrors.missingRequired('ticketId')
      }

      const task = await ticketStorage.getTaskById(itemId)
      if (!task || task.ticketId !== ticketId) {
        ErrorFactory.notFound("Task", itemId)
      }

      const taskCompletionUpdate = {
        ...createCompleteProcessingUpdate(true),
        done: true
      }
      if (task.queueStartedAt) {
        taskCompletionUpdate.actualProcessingTime = Date.now() - task.queueStartedAt
      }
      await ticketStorage.updateTask(ticketId, itemId, taskCompletionUpdate)

      // If all tasks are done, mark parent ticket completed/closed
      try {
        const tasks = await ticketStorage.readTasks(ticketId)
        const allDone = Object.values(tasks).every((t) => t.done)
        if (allDone) await serviceUpdateTicket(ticketId, { status: 'closed' })
      } catch { }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error completing queue item:', error)
    ErrorFactory.operationFailed('complete queue item', errorMessage)
  }
}

/**
 * Fail a ticket or task in queue
 */
export async function failQueueItem(
  itemType: 'ticket' | 'task',
  itemId: number,
  errorMessage: string,
  ticketId?: number
): Promise<void> {
  try {
    const failureUpdate = createCompleteProcessingUpdate(false, errorMessage)
    
    if (itemType === 'ticket') {
      await ticketStorage.updateTicket(itemId, failureUpdate)
    } else {
      if (!ticketId) {
        throw TaskErrors.missingRequired('ticketId')
      }

      await ticketStorage.updateTask(ticketId, itemId, failureUpdate)
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error failing queue item:', error)
    ErrorFactory.operationFailed('fail queue item', errorMessage)
  }
}

/**
 * Get unqueued items for a project
 */
export async function getUnqueuedItems(projectId: number): Promise<{ tickets: Ticket[]; tasks: TicketTask[] }> {
  try {
    const tickets = await ticketStorage.readTickets(projectId)
    const unqueuedTickets = Object.values(tickets).filter((t) => !t.queueId)

    const unqueuedTasks: TicketTask[] = []
    for (const ticket of Object.values(tickets)) {
      const tasks = await ticketStorage.readTasks(ticket.id)
      const ticketUnqueuedTasks = Object.values(tasks).filter((t) => !t.queueId && !t.done)
      unqueuedTasks.push(...ticketUnqueuedTasks)
    }

    return { tickets: unqueuedTickets, tasks: unqueuedTasks }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error getting unqueued items:', error)
    ErrorFactory.operationFailed('get unqueued items', errorMessage)
  }
}

// All functions are already exported as named exports above
// No additional export block needed

// Stub function for backwards compatibility - timeout handling needs to be refactored
// to work with the Flow system (queue fields on tickets/tasks)
export async function checkAndHandleTimeouts(
  queueId: number,
  timeoutMs: number = 300000
): Promise<{ timedOut: number; failed: number; errors: Array<{ itemId: number; error: string }> }> {
  // TODO: Implement timeout handling for Flow system
  // This would check tickets/tasks with queue_status = 'in_progress'
  // and queue_started_at older than timeoutMs
  console.warn('checkAndHandleTimeouts not yet implemented for Flow system')
  return { timedOut: 0, failed: 0, errors: [] }
}

// === NEW QUEUE-CENTRIC SERVICE FUNCTIONS ===

/**
 * Get all queue items with enriched ticket/task data
 */
export async function getQueueItems(queueId: number, status?: string): Promise<Array<{
  queueItem: any;
  ticket?: Ticket;
  task?: TicketTask;
}>> {
  try {
    // Validate queue exists and get projectId
    const queue = await getQueueById(queueId)

    // Get all tickets in this queue
    const tickets = await ticketStorage.readTickets(queue.projectId)
    const ticketsInQueue = Object.values(tickets)
      .filter(ticket => ticket.queueId === queueId && (!status || ticket.queueStatus === status))

    // Get all tasks in this queue  
    const tasks = await ticketStorage.readTasks(queue.projectId)
    const tasksInQueue = Object.values(tasks)
      .filter(task => task.queueId === queueId && (!status || task.queueStatus === status))

    const results: Array<{
      queueItem: any;
      ticket?: Ticket;
      task?: TicketTask;
    }> = []

    // Add tickets as queue items
    for (const ticket of ticketsInQueue) {
      results.push({
        queueItem: {
          id: ticket.id,
          queueId: ticket.queueId,
          ticketId: ticket.id,
          taskId: null,
          status: ticket.queueStatus || 'queued',
          priority: ticket.queuePriority || 0,
          created: ticket.created,
          updated: ticket.updated
        },
        ticket
      })
    }

    // Add tasks as queue items
    for (const task of tasksInQueue) {
      // Get parent ticket for context
      const parentTicket = Object.values(tickets).find(t => t.id === task.ticketId)

      results.push({
        queueItem: {
          id: task.id,
          queueId: task.queueId,
          ticketId: task.ticketId,
          taskId: task.id,
          status: task.queueStatus || 'queued',
          priority: task.queuePriority || 0,
          created: task.created,
          updated: task.updated
        },
        task,
        ticket: parentTicket
      })
    }

    // Sort by priority (descending) then by created date (ascending)
    results.sort((a, b) => {
      const priorityDiff = (b.queueItem.priority || 0) - (a.queueItem.priority || 0)
      if (priorityDiff !== 0) return priorityDiff
      return a.queueItem.created - b.queueItem.created
    })

    return results
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error getting queue items:', error)
    throw ErrorFactory.operationFailed('get queue items', error instanceof Error ? error.message : String(error))
  }
}

/**
 * Batch enqueue multiple items to a queue
 */
export async function batchEnqueueItems(queueId: number, items: Array<{
  ticketId?: number;
  taskId?: number;
  priority?: number;
}>): Promise<any[]> {
  try {
    // Validate queue exists
    await getQueueById(queueId)

    const results: any[] = []

    for (const item of items) {
      try {
        if (item.ticketId && !item.taskId) {
          // Enqueue ticket
          await enqueueTicket(item.ticketId, queueId, item.priority || 0)
          results.push({
            id: item.ticketId,
            queueId,
            ticketId: item.ticketId,
            taskId: null,
            status: 'queued',
            priority: item.priority || 0,
            created: Date.now(),
            updated: Date.now()
          })
        } else if (item.taskId && item.ticketId) {
          // Enqueue task (requires both ticketId and taskId)
          await enqueueTask(item.ticketId, item.taskId, queueId, item.priority || 0)
          results.push({
            id: item.taskId,
            queueId,
            ticketId: item.ticketId,
            taskId: item.taskId,
            status: 'queued',
            priority: item.priority || 0,
            created: Date.now(),
            updated: Date.now()
          })
        } else {
          throw new Error('Either ticketId (only) or both ticketId and taskId must be provided')
        }
      } catch (error) {
        console.error(`Error enqueuing item:`, error)
        // Continue with other items in batch
      }
    }

    return results
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error batch enqueuing items:', error)
    throw ErrorFactory.operationFailed('batch enqueue items', error instanceof Error ? error.message : String(error))
  }
}

/**
 * Get queue timeline - processing history and estimated completion times
 */
export async function getQueueTimeline(queueId: number): Promise<{
  queueId: number;
  currentTime: number;
  items: Array<{
    itemId: number;
    ticketId: number | null;
    taskId: number | null;
    title: string;
    estimatedStartTime: number;
    estimatedEndTime: number;
    estimatedProcessingTime: number;
    status: string;
  }>;
  totalEstimatedTime: number;
  estimatedCompletionTime: number;
}> {
  try {
    // Validate queue exists
    const queue = await getQueueById(queueId)

    // Get queue items
    const queueItems = await getQueueItems(queueId)

    const currentTime = Date.now()
    let runningTime = currentTime
    const timelineItems: Array<{
      itemId: number;
      ticketId: number | null;
      taskId: number | null;
      title: string;
      estimatedStartTime: number;
      estimatedEndTime: number;
      estimatedProcessingTime: number;
      status: string;
    }> = []

    // Calculate processing times for each item
    for (const item of queueItems) {
      // Get title from ticket or task
      const title = item.ticket?.title || 
                   (item.task ? `Task: ${item.task.content}` : 'Unknown Item')

      // Estimate processing time (default 30 minutes if not available)
      const estimatedProcessingTime = item.task?.estimatedHours ? 
        item.task.estimatedHours * 60 * 60 * 1000 : // Convert hours to ms
        30 * 60 * 1000 // 30 minutes default

      const estimatedStartTime = runningTime
      const estimatedEndTime = runningTime + estimatedProcessingTime

      timelineItems.push({
        itemId: item.queueItem.id,
        ticketId: item.queueItem.ticketId,
        taskId: item.queueItem.taskId,
        title,
        estimatedStartTime,
        estimatedEndTime,
        estimatedProcessingTime,
        status: item.queueItem.status
      })

      // Only add to running time if item is queued (not already processing or complete)
      if (item.queueItem.status === 'queued') {
        runningTime = estimatedEndTime
      }
    }

    const totalEstimatedTime = timelineItems.reduce((total, item) => 
      total + item.estimatedProcessingTime, 0)

    return {
      queueId,
      currentTime,
      items: timelineItems,
      totalEstimatedTime,
      estimatedCompletionTime: runningTime
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error getting queue timeline:', error)
    throw ErrorFactory.operationFailed('get queue timeline', error instanceof Error ? error.message : String(error))
  }
}
