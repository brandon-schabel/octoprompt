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
import { ApiError } from '@promptliano/shared'

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
    throw new ApiError(500, 'Failed to create queue', 'QUEUE_CREATE_ERROR', { error: errorMessage })
  }
}

export async function getQueueById(queueId: number): Promise<TaskQueue> {
  const queue = await queueStorage.readQueue(queueId)
  if (!queue) {
    throw new ApiError(404, `Queue ${queueId} not found`, 'QUEUE_NOT_FOUND')
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
    throw new ApiError(404, `Queue ${queueId} not found`, 'QUEUE_NOT_FOUND')
  }
}

export async function pauseQueue(queueId: number): Promise<TaskQueue> {
  try {
    // Verify queue exists
    const queue = await getQueueById(queueId)

    if (queue.status === 'paused') {
      throw new ApiError(400, `Queue ${queueId} is already paused`, 'QUEUE_ALREADY_PAUSED')
    }

    // Update queue status to paused
    return await queueStorage.updateQueue(queueId, { status: 'paused' })
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error pausing queue:', error)
    throw new ApiError(500, 'Failed to pause queue', 'QUEUE_PAUSE_ERROR', { error: errorMessage })
  }
}

export async function resumeQueue(queueId: number): Promise<TaskQueue> {
  try {
    // Verify queue exists
    const queue = await getQueueById(queueId)

    if (queue.status === 'active') {
      throw new ApiError(400, `Queue ${queueId} is already active`, 'QUEUE_ALREADY_ACTIVE')
    }

    // Update queue status to active
    return await queueStorage.updateQueue(queueId, { status: 'active' })
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error resuming queue:', error)
    throw new ApiError(500, 'Failed to resume queue', 'QUEUE_RESUME_ERROR', { error: errorMessage })
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
      throw new ApiError(404, `Ticket ${ticketId} not found`, 'TICKET_NOT_FOUND')
    }

    // Update ticket queue fields
    const updatedTicket = await ticketStorage.updateTicket(ticketId, {
      queueId: queueId,
      queueStatus: 'queued',
      queuePriority: priority,
      queuedAt: Date.now()
    })

    return updatedTicket
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error enqueuing ticket:', error)
    throw new ApiError(500, 'Failed to enqueue ticket', 'ENQUEUE_ERROR', { error: errorMessage })
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
      throw new ApiError(404, `Task ${taskId} not found for ticket ${ticketId}`, 'TASK_NOT_FOUND')
    }

    // Update task queue fields
    const updatedTask = await ticketStorage.updateTask(ticketId, taskId, {
      queueId: queueId,
      queueStatus: 'queued',
      queuePriority: priority,
      queuedAt: Date.now()
    })

    return updatedTask
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error enqueuing task:', error)
    throw new ApiError(500, 'Failed to enqueue task', 'ENQUEUE_ERROR', { error: errorMessage })
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
    throw new ApiError(500, 'Failed to enqueue ticket with tasks', 'ENQUEUE_TICKET_ERROR', { error: errorMessage })
  }
}

/**
 * Remove ticket from queue
 */
export async function dequeueTicket(ticketId: number): Promise<Ticket> {
  try {
    const ticket = await ticketStorage.readTicket(ticketId)
    if (!ticket) {
      throw new ApiError(404, `Ticket ${ticketId} not found`, 'TICKET_NOT_FOUND')
    }

    // Clear queue fields on the ticket
    const updatedTicket = await ticketStorage.updateTicket(ticketId, {
      queueId: null,
      queueStatus: null,
      queuePriority: 0,
      queuedAt: null
    })

    // Also dequeue all tasks associated with this ticket
    const tasks = await ticketStorage.readTasks(ticketId)
    const taskList = Object.values(tasks).filter((task) => task.queueId !== null)

    for (const task of taskList) {
      await ticketStorage.dequeueTask(task.id)
    }

    return updatedTicket
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error dequeuing ticket:', error)
    throw new ApiError(500, 'Failed to dequeue ticket', 'DEQUEUE_ERROR', { error: errorMessage })
  }
}

/**
 * Remove task from queue
 */
export async function dequeueTask(ticketId: number, taskId: number): Promise<TicketTask> {
  try {
    const task = await ticketStorage.getTaskById(taskId)
    if (!task || task.ticketId !== ticketId) {
      throw new ApiError(404, `Task ${taskId} not found for ticket ${ticketId}`, 'TASK_NOT_FOUND')
    }

    // Clear queue fields
    const updatedTask = await ticketStorage.updateTask(ticketId, taskId, {
      queueId: null,
      queueStatus: null,
      queuePriority: 0,
      queuedAt: null
    })

    return updatedTask
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error dequeuing task:', error)
    throw new ApiError(500, 'Failed to dequeue task', 'DEQUEUE_ERROR', { error: errorMessage })
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
    throw new ApiError(500, 'Failed to dequeue ticket with tasks', 'DEQUEUE_TICKET_ERROR', { error: errorMessage })
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

      // Update ticket status to in_progress
      const updatedTicket = await ticketStorage.updateTicket(ticket.id, {
        queueStatus: 'in_progress',
        queueStartedAt: Date.now(),
        queueAgentId: agentId
      })

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

        // Update task status to in_progress
        const updatedTask = await ticketStorage.updateTask(ticket.id, task.id, {
          queueStatus: 'in_progress',
          queueStartedAt: Date.now(),
          queueAgentId: agentId
        })

        return { type: 'task', item: updatedTask }
      }
    }

    return { type: 'none', item: null, message: 'No tasks available' }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error getting next task from queue:', error)
    throw new ApiError(500, 'Failed to get next task from queue', 'QUEUE_PROCESS_ERROR', { error: errorMessage })
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
        throw new ApiError(400, 'Ticket ID required for task operations', 'TICKET_ID_REQUIRED')
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
    throw new ApiError(500, 'Failed to move item to queue', 'MOVE_ERROR', { error: errorMessage })
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
        throw new ApiError(404, `Ticket ${itemId} not found`, 'TICKET_NOT_FOUND')
      }

      await ticketStorage.updateTicket(itemId, {
        queueStatus: 'completed',
        queueCompletedAt: Date.now(),
        actualProcessingTime: ticket.queueStartedAt ? Date.now() - ticket.queueStartedAt : undefined
      })

      // Also mark all tasks as completed
      const tasks = await ticketStorage.readTasks(itemId)
      for (const task of Object.values(tasks)) {
        if (task.queueId === ticket.queueId) {
          await ticketStorage.updateTask(itemId, task.id, {
            queueStatus: 'completed',
            queueCompletedAt: Date.now(),
            done: true
          })
        }
      }
    } else {
      if (!ticketId) {
        throw new ApiError(400, 'Ticket ID required for task operations', 'TICKET_ID_REQUIRED')
      }

      const task = await ticketStorage.getTaskById(itemId)
      if (!task || task.ticketId !== ticketId) {
        throw new ApiError(404, `Task ${itemId} not found for ticket ${ticketId}`, 'TASK_NOT_FOUND')
      }

      await ticketStorage.updateTask(ticketId, itemId, {
        queueStatus: 'completed',
        queueCompletedAt: Date.now(),
        actualProcessingTime: task.queueStartedAt ? Date.now() - task.queueStartedAt : undefined,
        done: true
      })
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error completing queue item:', error)
    throw new ApiError(500, 'Failed to complete queue item', 'COMPLETE_ERROR', { error: errorMessage })
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
    if (itemType === 'ticket') {
      await ticketStorage.updateTicket(itemId, {
        queueStatus: 'failed',
        queueErrorMessage: errorMessage,
        queueCompletedAt: Date.now()
      })
    } else {
      if (!ticketId) {
        throw new ApiError(400, 'Ticket ID required for task operations', 'TICKET_ID_REQUIRED')
      }

      await ticketStorage.updateTask(ticketId, itemId, {
        queueStatus: 'failed',
        queueErrorMessage: errorMessage,
        queueCompletedAt: Date.now()
      })
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error failing queue item:', error)
    throw new ApiError(500, 'Failed to fail queue item', 'FAIL_ERROR', { error: errorMessage })
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
    throw new ApiError(500, 'Failed to get unqueued items', 'UNQUEUED_ITEMS_ERROR', { error: errorMessage })
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
