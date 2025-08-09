import { mock } from 'bun:test'
import type {
  TaskQueue,
  QueueItem,
  Ticket,
  TicketTask,
  QueueStatus,
  QueueItemStatus,
  CreateQueueBody,
  EnqueueItemBody
} from '@promptliano/schemas'

// Factory functions for test data
export function createMockQueue(overrides?: Partial<TaskQueue>): TaskQueue {
  const now = Date.now()
  return {
    id: Math.floor(Math.random() * 1000000),
    projectId: 1754713756748,
    name: 'Test Queue',
    description: 'Queue for testing',
    status: 'active' as QueueStatus,
    maxParallelItems: 2,
    averageProcessingTime: 5000,
    totalCompletedItems: 0,
    created: now,
    updated: now,
    ...overrides
  }
}

export function createMockQueueItem(overrides?: Partial<QueueItem>): QueueItem {
  const now = Date.now()
  return {
    id: Math.floor(Math.random() * 1000000),
    queueId: 1,
    ticketId: null,
    taskId: null,
    status: 'queued' as QueueItemStatus,
    priority: 5,
    position: null,
    agentId: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    estimatedProcessingTime: null,
    created: now,
    updated: now,
    ...overrides
  }
}

export function createMockTicket(overrides?: Partial<Ticket>): Ticket {
  const now = Date.now()
  return {
    id: Math.floor(Math.random() * 1000000),
    projectId: 1754713756748,
    title: 'Test Ticket',
    overview: 'Test ticket for queue testing',
    priority: 'normal',
    status: 'open',
    suggestedAgentIds: [],
    suggestedPromptIds: [],
    suggestedFileIds: [],
    tasks: [],
    queue_id: null,
    queue_status: null,
    queued_at: null,
    created: now,
    updated: now,
    ...overrides
  }
}

export function createMockTask(ticketId: number, overrides?: Partial<TicketTask>): TicketTask {
  const now = Date.now()
  return {
    id: Math.floor(Math.random() * 1000000),
    ticketId,
    content: 'Test Task',
    description: 'Test task description',
    done: false,
    orderIndex: 0,
    suggestedFileIds: [],
    suggestedPromptIds: [],
    estimatedHours: 1,
    actualHours: null,
    tags: [],
    agentId: null,
    queue_id: null,
    queue_status: null,
    queued_at: null,
    created: now,
    updated: now,
    ...overrides
  }
}

// Mock storage implementations using Bun's mock
export function createMockQueueStorage() {
  const queues = new Map<number, TaskQueue>()
  const queueItems = new Map<number, QueueItem>()
  let nextQueueId = 1
  let nextItemId = 1

  // Create mock functions
  const readQueues = mock(async (projectId: number) => {
    const result: Record<string, TaskQueue> = {}
    for (const [id, queue] of queues) {
      if (queue.projectId === projectId) {
        result[String(id)] = queue
      }
    }
    return result
  })

  const readQueue = mock(async (queueId: number) => {
    return queues.get(queueId) || null
  })

  const createQueue = mock(async (data: Omit<TaskQueue, 'id' | 'created' | 'updated'>) => {
    const queue = createMockQueue({ ...data, id: nextQueueId++ })
    queues.set(queue.id, queue)
    return queue
  })

  const updateQueue = mock(async (queueId: number, updates: Partial<TaskQueue>) => {
    const queue = queues.get(queueId)
    if (!queue) throw new Error('Queue not found')
    const updated = { ...queue, ...updates, updated: Date.now() }
    queues.set(queueId, updated)
    return updated
  })

  const deleteQueue = mock(async (queueId: number) => {
    const existed = queues.has(queueId)
    queues.delete(queueId)
    // Also delete all items in the queue
    for (const [id, item] of queueItems) {
      if (item.queueId === queueId) {
        queueItems.delete(id)
      }
    }
    return existed
  })

  const readQueueItems = mock(async (queueId: number, status?: QueueItemStatus) => {
    const result: Record<string, QueueItem> = {}
    for (const [id, item] of queueItems) {
      if (item.queueId === queueId && (!status || item.status === status)) {
        result[String(id)] = item
      }
    }
    return result
  })

  const readQueueItem = mock(async (itemId: number) => {
    return queueItems.get(itemId) || null
  })

  const createQueueItem = mock(async (data: Omit<QueueItem, 'id' | 'created' | 'updated'>) => {
    const item = createMockQueueItem({ ...data, id: nextItemId++ })
    queueItems.set(item.id, item)
    return item
  })

  const updateQueueItem = mock(async (itemId: number, updates: Partial<QueueItem>) => {
    const item = queueItems.get(itemId)
    if (!item) throw new Error('Queue item not found')
    const updated = { ...item, ...updates, updated: Date.now() }
    queueItems.set(itemId, updated)
    return updated
  })

  const deleteQueueItem = mock(async (itemId: number) => {
    const existed = queueItems.has(itemId)
    queueItems.delete(itemId)
    return existed
  })

  const getNextQueueItem = mock(async (queueId: number, agentId?: string) => {
    const items = Array.from(queueItems.values())
      .filter((item) => item.queueId === queueId && item.status === 'queued')
      .sort((a, b) => {
        // Sort by priority (lower number = higher priority)
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        // Then by creation time
        return a.created - b.created
      })

    if (items.length > 0) {
      const item = items[0]
      const updated = { ...item, status: 'in_progress' as QueueItemStatus, agentId, startedAt: Date.now() }
      queueItems.set(item.id, updated)
      return updated
    }

    return null
  })

  const getQueueStats = mock(async (queueId: number) => {
    const items = Array.from(queueItems.values()).filter((item) => item.queueId === queueId)

    return {
      totalItems: items.length,
      queuedItems: items.filter((i) => i.status === 'queued').length,
      inProgressItems: items.filter((i) => i.status === 'in_progress').length,
      completedItems: items.filter((i) => i.status === 'completed').length,
      failedItems: items.filter((i) => i.status === 'failed').length,
      cancelledItems: items.filter((i) => i.status === 'cancelled').length,
      averageProcessingTime: 5000
    }
  })

  const getCurrentAgents = mock(async (queueId: number) => {
    const agents: string[] = []
    for (const item of queueItems.values()) {
      if (item.queueId === queueId && item.status === 'in_progress' && item.agentId) {
        agents.push(item.agentId)
      }
    }
    return agents
  })

  const checkExistingQueueItem = mock(async (queueId: number, ticketId: number | null, taskId: number | null) => {
    for (const item of queueItems.values()) {
      if (item.queueId === queueId && item.ticketId === ticketId && item.taskId === taskId) {
        return item
      }
    }
    return null
  })

  return {
    readQueues,
    readQueue,
    createQueue,
    updateQueue,
    deleteQueue,
    readQueueItems,
    readQueueItem,
    createQueueItem,
    updateQueueItem,
    deleteQueueItem,
    getNextQueueItem,
    getQueueStats,
    getCurrentAgents,
    checkExistingQueueItem,

    // Utility methods
    clear: () => {
      queues.clear()
      queueItems.clear()
      nextQueueId = 1
      nextItemId = 1
    },

    getQueues: () => queues,
    getQueueItems: () => queueItems
  }
}

// Mock ticket storage
export function createMockTicketStorage() {
  const tickets = new Map<number, Ticket>()
  const tasks = new Map<string, TicketTask>() // key: `${ticketId}-${taskId}`
  let nextTicketId = 1
  let nextTaskId = 1

  const readTicket = mock(async (ticketId: number) => {
    return tickets.get(ticketId) || null
  })

  const readTickets = mock(async (projectId: number) => {
    const result: Record<string, Ticket> = {}
    for (const [id, ticket] of tickets) {
      if (ticket.projectId === projectId) {
        result[String(id)] = ticket
      }
    }
    return result
  })

  const updateTicket = mock(async (ticketId: number, updates: Partial<Ticket>) => {
    const ticket = tickets.get(ticketId)
    if (!ticket) throw new Error('Ticket not found')
    const updated = { ...ticket, ...updates, updated: Date.now() }
    tickets.set(ticketId, updated)
    return updated
  })

  const readTasks = mock(async (ticketId: number) => {
    const result: Record<string, TicketTask> = {}
    for (const [key, task] of tasks) {
      if (task.ticketId === ticketId) {
        result[String(task.id)] = task
      }
    }
    return result
  })

  const getTaskById = mock(async (taskId: number) => {
    for (const task of tasks.values()) {
      if (task.id === taskId) {
        return task
      }
    }
    return null
  })

  const updateTask = mock(async (ticketId: number, taskId: number, updates: Partial<TicketTask>) => {
    const key = `${ticketId}-${taskId}`
    const task = tasks.get(key)
    if (!task) {
      // Try to find by task ID alone
      for (const [k, t] of tasks) {
        if (t.id === taskId && t.ticketId === ticketId) {
          const updated = { ...t, ...updates, updated: Date.now() }
          tasks.set(k, updated)
          return updated
        }
      }
      throw new Error('Task not found')
    }
    const updated = { ...task, ...updates, updated: Date.now() }
    tasks.set(key, updated)
    return updated
  })

  return {
    readTicket,
    readTickets,
    updateTicket,
    readTasks,
    getTaskById,
    updateTask,

    // Test helpers
    addTicket: (ticket: Ticket) => {
      tickets.set(ticket.id, ticket)
    },

    addTask: (task: TicketTask) => {
      tasks.set(`${task.ticketId}-${task.id}`, task)
    },

    clear: () => {
      tickets.clear()
      tasks.clear()
      nextTicketId = 1
      nextTaskId = 1
    }
  }
}

// Agent behavior simulator
export class MockAgent {
  constructor(
    public id: string,
    public processingTime: number = 100,
    public failureRate: number = 0
  ) {}

  async processTask(task: TicketTask): Promise<{ success: boolean; error?: string }> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, this.processingTime))

    // Simulate random failures
    if (Math.random() < this.failureRate) {
      return { success: false, error: `Agent ${this.id} failed to process task` }
    }

    return { success: true }
  }
}
