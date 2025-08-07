// Queue service layer with business logic
import type {
  TaskQueue,
  QueueItem,
  CreateQueueBody,
  UpdateQueueBody,
  EnqueueItemBody,
  UpdateQueueItemBody,
  QueueStats,
  QueueWithStats,
  GetNextTaskResponse,
  QueueTimeline,
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
      maxParallelItems: data.maxParallelItems || 1
    })

    return queue
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error creating queue:', error)
    throw new ApiError(500, 'Failed to create queue', 'QUEUE_CREATE_ERROR', { error })
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

// === Queue Items Management ===

export async function enqueueItem(queueId: number, data: EnqueueItemBody): Promise<QueueItem> {
  try {
    // Verify queue exists
    const queue = await getQueueById(queueId)

    // Verify ticket or task exists
    if (data.ticketId) {
      const ticket = await ticketStorage.readTicket(data.ticketId)
      if (!ticket) {
        throw new ApiError(404, `Ticket ${data.ticketId} not found`, 'TICKET_NOT_FOUND')
      }

      // Update ticket queue status
      await ticketStorage.updateTicket(data.ticketId, {
        queue_id: queueId,
        queue_status: 'queued',
        queued_at: Date.now()
      })
    } else if (data.taskId) {
      // Get ticket ID for the task
      const allTickets = await ticketStorage.readTickets(queue.projectId)
      let ticketId: number | null = null
      let foundTask = false

      for (const [_, ticket] of Object.entries(allTickets)) {
        const tasks = await ticketStorage.readTasks(ticket.id)
        if (tasks[String(data.taskId)]) {
          ticketId = ticket.id
          foundTask = true
          break
        }
      }

      if (!foundTask) {
        throw new ApiError(404, `Task ${data.taskId} not found`, 'TASK_NOT_FOUND')
      }

      // Update task queue status
      if (ticketId) {
        await ticketStorage.updateTask(ticketId, data.taskId, {
          queue_id: queueId,
          queue_status: 'queued',
          queued_at: Date.now()
        })
      }
    }

    const queueItem = await queueStorage.createQueueItem({
      queueId,
      ticketId: data.ticketId || null,
      taskId: data.taskId || null,
      status: 'queued',
      priority: data.priority || 0,
      agentId: data.agentId || null,
      errorMessage: null,
      startedAt: null,
      completedAt: null
    })

    return queueItem
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error enqueuing item:', error)
    throw new ApiError(500, 'Failed to enqueue item', 'ENQUEUE_ERROR', { error })
  }
}

export async function updateQueueItem(itemId: number, updates: UpdateQueueItemBody): Promise<QueueItem> {
  const item = await queueStorage.readQueueItem(itemId)
  if (!item) {
    throw new ApiError(404, `Queue item ${itemId} not found`, 'QUEUE_ITEM_NOT_FOUND')
  }

  // Update ticket/task status if item status changes
  if (updates.status && updates.status !== item.status) {
    const queue = await getQueueById(item.queueId)

    if (item.ticketId) {
      let ticketQueueStatus: string
      switch (updates.status) {
        case 'in_progress':
          ticketQueueStatus = 'processing'
          break
        case 'completed':
        case 'failed':
        case 'cancelled':
          ticketQueueStatus = 'completed'
          break
        default:
          ticketQueueStatus = 'queued'
      }

      await ticketStorage.updateTicket(item.ticketId, {
        queue_status: ticketQueueStatus
      })
    } else if (item.taskId) {
      // Find the ticket for this task
      const allTickets = await ticketStorage.readTickets(queue.projectId)
      for (const [_, ticket] of Object.entries(allTickets)) {
        const tasks = await ticketStorage.readTasks(ticket.id)
        if (tasks[String(item.taskId)]) {
          let taskQueueStatus: string
          switch (updates.status) {
            case 'in_progress':
              taskQueueStatus = 'processing'
              break
            case 'completed':
            case 'failed':
            case 'cancelled':
              taskQueueStatus = 'completed'
              break
            default:
              taskQueueStatus = 'queued'
          }

          await ticketStorage.updateTask(ticket.id, item.taskId, {
            queue_status: taskQueueStatus,
            done: updates.status === 'completed'
          })
          break
        }
      }
    }
  }

  return await queueStorage.updateQueueItem(itemId, updates)
}

export async function deleteQueueItem(itemId: number): Promise<void> {
  const deleted = await queueStorage.deleteQueueItem(itemId)
  if (!deleted) {
    throw new ApiError(404, `Queue item ${itemId} not found`, 'QUEUE_ITEM_NOT_FOUND')
  }
}

export async function getQueueItems(queueId: number, status?: string): Promise<QueueItem[]> {
  await getQueueById(queueId) // Verify queue exists

  const items = await queueStorage.readQueueItems(queueId, status as any)
  return Object.values(items)
}

export async function getQueueItemsWithDetails(
  queueId: number,
  status?: string
): Promise<
  {
    queueItem: QueueItem
    ticket?: Ticket
    task?: TicketTask
  }[]
> {
  const items = await getQueueItems(queueId, status)

  // Collect all unique ticket IDs we need to fetch
  const ticketIds = new Set<number>()
  items.forEach((item) => {
    if (item.ticketId) ticketIds.add(item.ticketId)
  })

  // Fetch all tickets with their tasks in one go
  const ticketsMap = new Map<number, Ticket>()
  if (ticketIds.size > 0) {
    const tickets = await Promise.all(Array.from(ticketIds).map((id) => ticketStorage.readTicket(id)))
    tickets.forEach((ticket, index) => {
      if (ticket) {
        ticketsMap.set(Array.from(ticketIds)[index], ticket)
      }
    })
  }

  // Build the result with full details
  return items.map((queueItem) => {
    let ticket: Ticket | undefined
    let task: TicketTask | undefined

    if (queueItem.ticketId) {
      ticket = ticketsMap.get(queueItem.ticketId)
    }

    if (queueItem.taskId && ticket?.tasks) {
      task = ticket.tasks.find((t) => t.id === queueItem.taskId)
    }

    return { queueItem, ticket, task }
  })
}

// === Queue Processing ===

export async function getNextTaskFromQueue(queueId: number, agentId?: string): Promise<GetNextTaskResponse> {
  try {
    const queue = await getQueueById(queueId)

    // Check if queue is active
    if (queue.status !== 'active') {
      return {
        queueItem: null,
        ticket: null,
        task: null
      }
    }

    // Check if agent can take more items (respecting maxParallelItems)
    if (agentId) {
      const currentAgents = await queueStorage.getCurrentAgents(queueId)
      const agentCount = currentAgents.filter((a) => a === agentId).length

      if (agentCount >= queue.maxParallelItems) {
        return {
          queueItem: null,
          ticket: null,
          task: null
        }
      }
    }

    // Get next item
    const queueItem = await queueStorage.getNextQueueItem(queueId, agentId)
    if (!queueItem) {
      return {
        queueItem: null,
        ticket: null,
        task: null
      }
    }

    // Fetch associated ticket/task
    let ticket: Ticket | null = null
    let task: TicketTask | null = null

    if (queueItem.ticketId) {
      ticket = await ticketStorage.readTicket(queueItem.ticketId)

      // Update ticket status
      if (ticket) {
        await ticketStorage.updateTicket(queueItem.ticketId, {
          queue_status: 'processing'
        })
      }
    } else if (queueItem.taskId) {
      // Find the task and its ticket
      const allTickets = await ticketStorage.readTickets(queue.projectId)
      for (const [_, t] of Object.entries(allTickets)) {
        const tasks = await ticketStorage.readTasks(t.id)
        if (tasks[String(queueItem.taskId)]) {
          ticket = t
          task = tasks[String(queueItem.taskId)]

          // Update task status
          await ticketStorage.updateTask(t.id, queueItem.taskId, {
            queue_status: 'processing'
          })
          break
        }
      }
    }

    return {
      queueItem,
      ticket,
      task
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error getting next task from queue:', error)
    throw new ApiError(500, 'Failed to get next task from queue', 'QUEUE_PROCESS_ERROR', { error })
  }
}

// === Queue Statistics ===

export async function getQueueStats(queueId: number): Promise<QueueStats> {
  const queue = await getQueueById(queueId)
  const stats = await queueStorage.getQueueStats(queueId)
  const currentAgents = await queueStorage.getCurrentAgents(queueId)

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
    currentAgents
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

export async function batchEnqueueItems(queueId: number, items: EnqueueItemBody[]): Promise<QueueItem[]> {
  const results: QueueItem[] = []

  for (const item of items) {
    try {
      const queueItem = await enqueueItem(queueId, item)
      results.push(queueItem)
    } catch (error) {
      console.error('Error in batch enqueue:', error)
      // Continue with other items
    }
  }

  return results
}

export async function batchUpdateQueueItems(
  updates: Array<{ itemId: number; data: UpdateQueueItemBody }>
): Promise<QueueItem[]> {
  const results: QueueItem[] = []

  for (const { itemId, data } of updates) {
    try {
      const updated = await updateQueueItem(itemId, data)
      results.push(updated)
    } catch (error) {
      console.error('Error in batch update:', error)
      // Continue with other items
    }
  }

  return results
}

// === Queue Ticket Operations ===

export async function enqueueTicketWithAllTasks(
  queueId: number,
  ticketId: number,
  priority?: number
): Promise<QueueItem[]> {
  try {
    // Verify queue and ticket exist
    const queue = await getQueueById(queueId)
    const ticket = await ticketStorage.readTicket(ticketId)
    if (!ticket) {
      throw new ApiError(404, `Ticket ${ticketId} not found`, 'TICKET_NOT_FOUND')
    }

    // Get all tasks for the ticket
    const tasks = await ticketStorage.readTasks(ticketId)
    const taskList = Object.values(tasks)
      .filter((task) => !task.done) // Only enqueue incomplete tasks
      .sort((a, b) => a.orderIndex - b.orderIndex) // Maintain order

    const queueItems: QueueItem[] = []

    // First, enqueue the ticket itself
    const ticketItem = await enqueueItem(queueId, {
      ticketId: ticketId,
      priority: priority || 0
    })
    queueItems.push(ticketItem)

    // Then enqueue each task
    for (let i = 0; i < taskList.length; i++) {
      const task = taskList[i]
      const item = await enqueueItem(queueId, {
        taskId: task.id,
        priority: priority !== undefined ? priority + (taskList.length - i) + 1 : i + 1, // Higher priority for earlier tasks, but lower than ticket
        agentId: task.agentId
      })
      queueItems.push(item)
    }

    return queueItems
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error enqueuing ticket with tasks:', error)
    throw new ApiError(500, 'Failed to enqueue ticket with tasks', 'ENQUEUE_TICKET_ERROR', { error })
  }
}

// === Kanban Operations ===

export async function bulkMoveItems(itemIds: number[], targetQueueId: number, positions?: number[]): Promise<void> {
  try {
    // Verify target queue exists
    await getQueueById(targetQueueId)

    // Perform bulk move
    await queueStorage.bulkMoveItems(itemIds, targetQueueId, positions)
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error bulk moving items:', error)
    throw new ApiError(500, 'Failed to bulk move items', 'BULK_MOVE_ERROR', { error })
  }
}

export async function reorderQueueItems(queueId: number, itemIds: number[]): Promise<void> {
  try {
    // Verify queue exists
    await getQueueById(queueId)

    // Perform reorder
    await queueStorage.reorderQueueItems(queueId, itemIds)
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error reordering queue items:', error)
    throw new ApiError(500, 'Failed to reorder queue items', 'REORDER_ERROR', { error })
  }
}

export async function getQueueTimeline(queueId: number): Promise<QueueTimeline> {
  try {
    const queue = await getQueueById(queueId)
    const items = await queueStorage.readQueueItems(queueId)
    const itemsArray = Object.values(items).sort((a, b) => {
      // Sort by position first, then priority, then created
      if (a.position !== null && b.position !== null) {
        return a.position - b.position
      }
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.created - b.created
    })

    const now = Date.now()
    let currentTime = now
    const timelineItems: QueueTimeline['items'] = []

    for (const item of itemsArray) {
      if (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') {
        continue
      }

      // Get title from ticket or task
      let title = 'Unknown Item'
      if (item.ticketId) {
        const ticket = await ticketStorage.readTicket(item.ticketId)
        if (ticket) {
          title = ticket.title
        }
      } else if (item.taskId) {
        // Get task through tickets
        const tickets = await ticketStorage.readTickets(queue.projectId)
        for (const ticket of Object.values(tickets)) {
          const tasks = await ticketStorage.readTasks(ticket.id)
          const task = tasks[String(item.taskId)]
          if (task) {
            title = task.content
            break
          }
        }
      }

      const estimatedProcessingTime = item.estimatedProcessingTime || queue.averageProcessingTime || 300000 // Default 5 minutes
      const estimatedStartTime = item.status === 'in_progress' ? item.startedAt || now : currentTime
      const estimatedEndTime = estimatedStartTime + estimatedProcessingTime

      timelineItems.push({
        itemId: item.id,
        ticketId: item.ticketId,
        taskId: item.taskId,
        title,
        estimatedStartTime,
        estimatedEndTime,
        estimatedProcessingTime,
        status: item.status
      })

      if (item.status === 'queued') {
        currentTime = estimatedEndTime
      }
    }

    const totalEstimatedTime = timelineItems.reduce((sum, item) => {
      if (item.status === 'queued' || item.status === 'in_progress') {
        return sum + item.estimatedProcessingTime
      }
      return sum
    }, 0)

    return {
      queueId,
      currentTime: now,
      items: timelineItems,
      totalEstimatedTime,
      estimatedCompletionTime: now + totalEstimatedTime
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error getting queue timeline:', error)
    throw new ApiError(500, 'Failed to get queue timeline', 'TIMELINE_ERROR', { error })
  }
}

export async function getUnqueuedItems(projectId: number): Promise<{ tickets: any[]; tasks: any[] }> {
  try {
    return await queueStorage.getUnqueuedItems(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error getting unqueued items:', error)
    throw new ApiError(500, 'Failed to get unqueued items', 'UNQUEUED_ITEMS_ERROR', { error })
  }
}
