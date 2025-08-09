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
  BatchEnqueueResult,
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
      maxParallelItems: data.maxParallelItems || 1,
      totalCompletedItems: 0
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
    console.error('Error pausing queue:', error)
    throw new ApiError(500, 'Failed to pause queue', 'QUEUE_PAUSE_ERROR', { error })
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
    console.error('Error resuming queue:', error)
    throw new ApiError(500, 'Failed to resume queue', 'QUEUE_RESUME_ERROR', { error })
  }
}

// === Queue Items Management ===

export async function enqueueItem(
  queueId: number,
  data: EnqueueItemBody,
  options: { skipDuplicates?: boolean; returnExisting?: boolean; defaultTimeoutMs?: number } = {}
): Promise<QueueItem> {
  try {
    // Verify queue exists
    const queue = await getQueueById(queueId)

    // Check for existing queue item if duplicate prevention is enabled
    if (options.skipDuplicates !== false) {
      const existingItem = await queueStorage.checkExistingQueueItem(
        queueId,
        data.ticketId || null,
        data.taskId || null
      )

      if (existingItem) {
        const itemType = data.ticketId ? 'ticket' : 'task'
        const itemId = data.ticketId || data.taskId

        console.log(`[Queue] Duplicate queue item detected for ${itemType} ${itemId} in queue ${queueId}`)

        if (options.returnExisting) {
          return existingItem
        }

        throw new ApiError(
          409,
          `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} ${itemId} is already in queue "${queue.name}" (item ID: ${existingItem.id}, status: ${existingItem.status})`,
          'DUPLICATE_QUEUE_ITEM',
          {
            existingItemId: existingItem.id,
            queueId: queueId,
            queueName: queue.name,
            itemType,
            itemId,
            existingStatus: existingItem.status,
            existingPriority: existingItem.priority
          }
        )
      }
    }

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

    // Create the queue item (storage layer handles duplicate prevention atomically)
    // NOTE: We explicitly set position to null for priority-based queuing
    // Position is only used for manual Kanban-style ordering
    const queueItem = await queueStorage.createQueueItem({
      queueId,
      ticketId: data.ticketId || null,
      taskId: data.taskId || null,
      status: 'queued',
      priority: data.priority || 0,
      position: null, // NULL for priority-based ordering
      agentId: data.agentId ?? undefined,
      errorMessage: null,
      startedAt: undefined,
      completedAt: undefined,
      estimatedProcessingTime: undefined,
      retryCount: 0,
      maxRetries: 3,
      timeoutAt: undefined
    })

    // Check if we got an existing item (duplicate was ignored)
    if (options.returnExisting && queueItem.ticketId === data.ticketId && queueItem.taskId === data.taskId) {
      console.log(
        `[Queue] Returned existing queue item ${queueItem.id} for ${data.ticketId ? `ticket ${data.ticketId}` : `task ${data.taskId}`}`
      )
    }

    return queueItem
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error enqueuing item:', error)
    // Include actual error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new ApiError(500, `Failed to enqueue item: ${errorMessage}`, 'ENQUEUE_ERROR', {
      error: errorMessage,
      queueId,
      ticketId: data.ticketId,
      taskId: data.taskId
    })
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
          ticketQueueStatus = 'in_progress'
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
      // Find the ticket for this task more efficiently
      try {
        // First try to get the task directly with its ticket ID
        const task = await ticketStorage.getTaskById(item.taskId)

        if (task && task.ticketId) {
          let taskQueueStatus: string
          switch (updates.status) {
            case 'in_progress':
              taskQueueStatus = 'in_progress'
              break
            case 'completed':
            case 'failed':
            case 'cancelled':
              taskQueueStatus = 'completed'
              break
            default:
              taskQueueStatus = 'queued'
          }

          await ticketStorage.updateTask(task.ticketId, item.taskId, {
            queue_status: taskQueueStatus,
            done: updates.status === 'completed'
          })
        } else {
          // Fallback: search through all tickets if direct lookup fails
          console.warn(`Task ${item.taskId} not found directly, searching through tickets...`)
          const allTickets = await ticketStorage.readTickets(queue.projectId)

          for (const [_, ticket] of Object.entries(allTickets)) {
            try {
              const tasks = await ticketStorage.readTasks(ticket.id)
              if (tasks[String(item.taskId)]) {
                let taskQueueStatus: string
                switch (updates.status) {
                  case 'in_progress':
                    taskQueueStatus = 'in_progress'
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
            } catch (taskError) {
              console.warn(`Error reading tasks for ticket ${ticket.id}:`, taskError)
              // Continue to next ticket instead of failing completely
              continue
            }
          }
        }
      } catch (error) {
        console.error(`Error updating task ${item.taskId} status:`, error)
        // Don't fail the entire queue item update if task update fails
        // The queue item status will still be updated
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
  // Convert to array and sort by priority to ensure correct order
  // (Object.values loses the SQL ORDER BY ordering)
  return Object.values(items).sort((a, b) => {
    // Sort by position first (if set), then priority, then created
    if (a.position != null && b.position != null) {
      if (a.position !== b.position) return (a.position as number) - (b.position as number)
    }
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.created - b.created
  })
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
    const ids = Array.from(ticketIds)
    const tickets = await Promise.all(ids.map((id) => ticketStorage.readTicket(id)))
    for (let i = 0; i < ids.length; i++) {
      const t = tickets[i]
      if (t) ticketsMap.set(ids[i]!, t)
    }
  }

  // Build the result with full details
  const results = await Promise.all(
    items.map(async (queueItem) => {
      let ticket: Ticket | undefined
      let task: TicketTask | undefined

      if (queueItem.ticketId) ticket = ticketsMap.get(queueItem.ticketId)

      if (queueItem.taskId) {
        const foundTask = await ticketStorage.getTaskById(queueItem.taskId)
        if (foundTask) {
          task = foundTask
          if (!ticket && foundTask.ticketId) {
            const maybeTicket = await ticketStorage.readTicket(foundTask.ticketId)
            if (maybeTicket) ticket = maybeTicket
          }
        }
      }

      return { queueItem, ticket, task }
    })
  )

  return results
}

// === Queue Processing ===

export async function getNextTaskFromQueue(
  queueId: number,
  agentId?: string,
  options: { defaultTimeoutMs?: number } = {}
): Promise<GetNextTaskResponse> {
  try {
    const queue = await getQueueById(queueId)

    // Check if queue is active (not paused or inactive)
    if (queue.status !== 'active') {
      console.log(`[Queue] Queue ${queueId} is ${queue.status}, not returning tasks`)
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

    // Set automatic timeout if item was retrieved
    if (queueItem && options.defaultTimeoutMs) {
      const timeoutAt = Date.now() + options.defaultTimeoutMs
      await queueStorage.updateQueueItem(queueItem.id, { timeoutAt } as any)
    }
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
          queue_status: 'in_progress'
        })
      }
    } else if (queueItem.taskId) {
      // Find the task and its ticket more efficiently
      try {
        // First try to get the task directly
        task = await ticketStorage.getTaskById(queueItem.taskId)

        if (task && task.ticketId) {
          // Get the ticket for this task
          ticket = await ticketStorage.readTicket(task.ticketId)

          if (ticket) {
            // Update task status
            await ticketStorage.updateTask(task.ticketId, queueItem.taskId, {
              queue_status: 'in_progress'
            })
          } else {
            console.warn(`Ticket ${task.ticketId} not found for task ${queueItem.taskId}`)
          }
        } else {
          // Fallback: search through all tickets if direct lookup fails
          console.warn(`Task ${queueItem.taskId} not found directly, searching through tickets...`)
          const allTickets = await ticketStorage.readTickets(queue.projectId)

          for (const [_, t] of Object.entries(allTickets)) {
            try {
              const tasks = await ticketStorage.readTasks(t.id)
              if (tasks[String(queueItem.taskId)]) {
                ticket = t
                task = tasks[String(queueItem.taskId)]!

                // Update task status
                await ticketStorage.updateTask(t.id, queueItem.taskId, {
                  queue_status: 'in_progress'
                })
                break
              }
            } catch (taskError) {
              console.warn(
                `Error reading tasks for ticket ${t.id} while searching for task ${queueItem.taskId}:`,
                taskError
              )
              // Continue to next ticket
              continue
            }
          }
        }
      } catch (error) {
        console.error(`Error finding task ${queueItem.taskId} for queue processing:`, error)
        // Still return the queue item even if we can't find the task details
        // This allows the queue to continue processing
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

export async function batchEnqueueItems(
  queueId: number,
  items: EnqueueItemBody[],
  options: { skipDuplicates?: boolean } = { skipDuplicates: true }
): Promise<BatchEnqueueResult> {
  const enqueuedItems: QueueItem[] = []
  let skipped = 0
  const errors: string[] = []

  for (const item of items) {
    try {
      const queueItem = await enqueueItem(queueId, item, {
        skipDuplicates: options.skipDuplicates,
        returnExisting: true
      })
      enqueuedItems.push(queueItem)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DUPLICATE_QUEUE_ITEM') {
        skipped++
      } else {
        const errorMsg = `Error enqueueing item: ${error instanceof Error ? error.message : String(error)}`
        errors.push(errorMsg)
        console.error('Error in batch enqueue:', error)
      }
      // Continue with other items
    }
  }

  return {
    items: enqueuedItems,
    skipped,
    ...(errors.length > 0 && { errors })
  }
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
  priority?: number,
  options: { skipDuplicates?: boolean; includeTicketItem?: boolean } = { skipDuplicates: true }
): Promise<BatchEnqueueResult> {
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
    let skippedCount = 0

    // Only enqueue the ticket itself if explicitly requested (for backward compatibility)
    if (options.includeTicketItem) {
      try {
        const ticketItem = await enqueueItem(
          queueId,
          {
            ticketId: ticketId,
            priority: priority || 0
          },
          {
            skipDuplicates: options.skipDuplicates,
            returnExisting: true
          }
        )
        queueItems.push(ticketItem)
      } catch (error) {
        if (error instanceof ApiError && error.code === 'DUPLICATE_QUEUE_ITEM') {
          skippedCount++
        } else {
          throw error
        }
      }
    }

    // Update ticket queue status
    await ticketStorage.updateTicket(ticketId, {
      queue_id: queueId,
      queue_status: 'queued',
      queued_at: Date.now()
    })

    // Enqueue each task
    for (const [i, task] of taskList.entries()) {
      try {
        const item = await enqueueItem(
          queueId,
          {
            taskId: task.id,
            priority: priority !== undefined ? priority + (taskList.length - i) : i + 1, // Higher priority for earlier tasks
            agentId: task.agentId ?? undefined
          },
          {
            skipDuplicates: options.skipDuplicates,
            returnExisting: true
          }
        )
        queueItems.push(item)
      } catch (error) {
        if (error instanceof ApiError && error.code === 'DUPLICATE_QUEUE_ITEM') {
          skippedCount++
        } else {
          console.error(`Error enqueuing task ${task.id}:`, error)
        }
      }
    }

    return {
      items: queueItems,
      skipped: skippedCount
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error enqueuing ticket with tasks:', error)
    throw new ApiError(500, 'Failed to enqueue ticket with tasks', 'ENQUEUE_TICKET_ERROR', { error })
  }
}

// === Retry Mechanism ===

export async function retryFailedItem(itemId: number): Promise<QueueItem> {
  try {
    const item = await queueStorage.readQueueItem(itemId)
    if (!item) {
      throw new ApiError(404, `Queue item ${itemId} not found`, 'QUEUE_ITEM_NOT_FOUND')
    }

    if (item.status !== 'failed' && item.status !== 'timeout') {
      throw new ApiError(400, `Cannot retry item with status ${item.status}`, 'INVALID_RETRY_STATUS')
    }

    // Check retry count
    const retryCount = (item as any).retryCount || 0
    const maxRetries = (item as any).maxRetries || 3

    if (retryCount >= maxRetries) {
      // Move to dead letter queue
      await moveToDeadLetterQueue(item)
      throw new ApiError(400, `Item has exceeded max retries (${maxRetries})`, 'MAX_RETRIES_EXCEEDED')
    }

    // Reset item for retry
    const updatedItem = await queueStorage.updateQueueItem(itemId, {
      status: 'queued',
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      retryCount: retryCount + 1
    } as any)

    // Update associated ticket/task status
    const queue = await getQueueById(item.queueId)
    if (item.ticketId) {
      await ticketStorage.updateTicket(item.ticketId, {
        queue_status: 'queued'
      })
    } else if (item.taskId) {
      // Find the ticket for this task
      const allTickets = await ticketStorage.readTickets(queue.projectId)
      for (const [_, ticket] of Object.entries(allTickets)) {
        const tasks = await ticketStorage.readTasks(ticket.id)
        if (tasks[String(item.taskId)]) {
          await ticketStorage.updateTask(ticket.id, item.taskId, {
            queue_status: 'queued',
            done: false
          })
          break
        }
      }
    }

    return updatedItem
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error retrying failed item:', error)
    throw new ApiError(500, 'Failed to retry item', 'RETRY_ERROR', { error })
  }
}

export async function retryAllFailedItems(queueId: number): Promise<{ retried: number; failed: number }> {
  try {
    const failedItems = await getQueueItems(queueId, 'failed')
    let retried = 0
    let failed = 0

    for (const item of failedItems) {
      try {
        await retryFailedItem(item.id)
        retried++
      } catch (error) {
        console.error(`Failed to retry item ${item.id}:`, error)
        failed++
      }
    }

    return { retried, failed }
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error retrying failed items:', error)
    throw new ApiError(500, 'Failed to retry failed items', 'BATCH_RETRY_ERROR', { error })
  }
}

async function moveToDeadLetterQueue(item: QueueItem): Promise<void> {
  try {
    const db = queueStorage as any
    const database = db.getDb().getDatabase()

    // Insert into dead letter queue
    const insertQuery = database.prepare(`
      INSERT INTO queue_dead_letter (
        original_queue_id, original_item_id, ticket_id, task_id,
        final_status, error_message, retry_count, agent_id,
        moved_at, original_created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertQuery.run(
      item.queueId,
      item.id,
      item.ticketId,
      item.taskId,
      item.status,
      item.errorMessage,
      (item as any).retryCount || 0,
      item.agentId,
      Date.now(),
      item.created
    )

    // Delete from main queue
    await queueStorage.deleteQueueItem(item.id)
  } catch (error) {
    console.error('Error moving item to dead letter queue:', error)
    // Don't throw - this is a cleanup operation
  }
}

// === Timeout Handling ===

export async function checkAndHandleTimeouts(queueId?: number): Promise<{ timedOut: number; errors: number }> {
  try {
    const now = Date.now()
    let timedOut = 0
    let errors = 0

    // Get the appropriate storage method
    const db = queueStorage as any
    const database = db.getDb().getDatabase()

    // Build query based on whether we're checking a specific queue or all queues
    let query: string
    let params: any[]

    if (queueId) {
      query = `
        SELECT id, queue_id, ticket_id, task_id, agent_id
        FROM queue_items
        WHERE queue_id = ?
          AND status = 'in_progress'
          AND timeout_at IS NOT NULL
          AND timeout_at <= ?
      `
      params = [queueId, now]
    } else {
      query = `
        SELECT id, queue_id, ticket_id, task_id, agent_id
        FROM queue_items
        WHERE status = 'in_progress'
          AND timeout_at IS NOT NULL
          AND timeout_at <= ?
      `
      params = [now]
    }

    const timedOutItems = database.prepare(query).all(...params) as any[]

    for (const item of timedOutItems) {
      try {
        // Update item status to timeout
        await updateQueueItem(item.id, {
          status: 'timeout',
          errorMessage: 'Processing timeout exceeded',
          completedAt: now
        } as any)

        // Update associated ticket/task status
        if (item.ticket_id) {
          await ticketStorage.updateTicket(item.ticket_id, {
            queue_status: 'completed'
          })
        } else if (item.task_id && item.queue_id) {
          const queue = await getQueueById(item.queue_id)
          const allTickets = await ticketStorage.readTickets(queue.projectId)
          for (const [_, ticket] of Object.entries(allTickets)) {
            const tasks = await ticketStorage.readTasks(ticket.id)
            if (tasks[String(item.task_id)]) {
              await ticketStorage.updateTask(ticket.id, item.task_id, {
                queue_status: 'completed'
              })
              break
            }
          }
        }

        timedOut++
      } catch (error) {
        console.error(`Error handling timeout for item ${item.id}:`, error)
        errors++
      }
    }

    return { timedOut, errors }
  } catch (error) {
    console.error('Error checking timeouts:', error)
    throw new ApiError(500, 'Failed to check timeouts', 'TIMEOUT_CHECK_ERROR', { error })
  }
}

export async function setItemTimeout(itemId: number, timeoutMs: number): Promise<QueueItem> {
  try {
    const item = await queueStorage.readQueueItem(itemId)
    if (!item) {
      throw new ApiError(404, `Queue item ${itemId} not found`, 'QUEUE_ITEM_NOT_FOUND')
    }

    const timeoutAt = Date.now() + timeoutMs

    return await queueStorage.updateQueueItem(itemId, {
      timeoutAt
    } as any)
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Error setting item timeout:', error)
    throw new ApiError(500, 'Failed to set item timeout', 'SET_TIMEOUT_ERROR', { error })
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
      if (a.position != null && b.position != null) {
        return (a.position as number) - (b.position as number)
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
