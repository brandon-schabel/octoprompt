import type {
  TaskQueue,
  QueueItem,
  Ticket,
  TicketTask,
  QueueStatus,
  ItemQueueStatus as QueueItemStatus,
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
    queueId: undefined,
    queueStatus: undefined,
    queuedAt: undefined,
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
    // actualHours removed from schema; tests can compute externally if needed
    tags: [],
    agentId: null,
    queueId: undefined,
    queueStatus: undefined,
    queuedAt: undefined,
    created: now,
    updated: now,
    ...overrides
  }
}

// Mock storage implementations
export function createMockQueueStorage() {
  const queues = new Map<number, TaskQueue>()
  const queueItems = new Map<number, QueueItem>()
  let nextQueueId = 1
  let nextItemId = 1

  return {
    // Queue operations
    readQueues: mock(async (projectId: number) => {
      const result: Record<string, TaskQueue> = {}
      for (const [id, queue] of queues) {
        if (queue.projectId === projectId) {
          result[String(id)] = queue
        }
      }
      return result
    }),

    readQueue: jest.fn(async (queueId: number) => {
      return queues.get(queueId) || null
    }),

    createQueue: jest.fn(async (data: Omit<TaskQueue, 'id' | 'created' | 'updated'>) => {
      const queue = createMockQueue({ ...data, id: nextQueueId++ })
      queues.set(queue.id, queue)
      return queue
    }),

    updateQueue: jest.fn(async (queueId: number, updates: Partial<TaskQueue>) => {
      const queue = queues.get(queueId)
      if (!queue) throw new Error('Queue not found')
      const updated = { ...queue, ...updates, updated: Date.now() }
      queues.set(queueId, updated)
      return updated
    }),

    deleteQueue: jest.fn(async (queueId: number) => {
      const existed = queues.has(queueId)
      queues.delete(queueId)
      // Also delete all items in the queue
      for (const [id, item] of queueItems) {
        if (item.queueId === queueId) {
          queueItems.delete(id)
        }
      }
      return existed
    }),

    // Queue item operations
    readQueueItems: jest.fn(async (queueId: number, status?: QueueItemStatus) => {
      const result: Record<string, QueueItem> = {}
      for (const [id, item] of queueItems) {
        if (item.queueId === queueId && (!status || item.status === status)) {
          result[String(id)] = item
        }
      }
      return result
    }),

    readQueueItem: jest.fn(async (itemId: number) => {
      return queueItems.get(itemId) || null
    }),

    createQueueItem: jest.fn(async (data: Omit<QueueItem, 'id' | 'created' | 'updated'>) => {
      const item = createMockQueueItem({ ...data, id: nextItemId++ })
      queueItems.set(item.id, item)
      return item
    }),

    updateQueueItem: jest.fn(async (itemId: number, updates: Partial<QueueItem>) => {
      const item = queueItems.get(itemId)
      if (!item) throw new Error('Queue item not found')
      const updated = { ...item, ...updates, updated: Date.now() }
      queueItems.set(itemId, updated)
      return updated
    }),

    deleteQueueItem: jest.fn(async (itemId: number) => {
      const existed = queueItems.has(itemId)
      queueItems.delete(itemId)
      return existed
    }),

    // Special operations
    getNextQueueItem: jest.fn(async (queueId: number, agentId?: string) => {
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
    }),

    getQueueStats: jest.fn(async (queueId: number) => {
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
    }),

    getCurrentAgents: jest.fn(async (queueId: number) => {
      const agents: string[] = []
      for (const item of queueItems.values()) {
        if (item.queueId === queueId && item.status === 'in_progress' && item.agentId) {
          agents.push(item.agentId)
        }
      }
      return agents
    }),

    checkExistingQueueItem: jest.fn(async (queueId: number, ticketId: number | null, taskId: number | null) => {
      for (const item of queueItems.values()) {
        if (item.queueId === queueId && item.ticketId === ticketId && item.taskId === taskId) {
          return item
        }
      }
      return null
    }),

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

  return {
    readTicket: jest.fn(async (ticketId: number) => {
      return tickets.get(ticketId) || null
    }),

    readTickets: jest.fn(async (projectId: number) => {
      const result: Record<string, Ticket> = {}
      for (const [id, ticket] of tickets) {
        if (ticket.projectId === projectId) {
          result[String(id)] = ticket
        }
      }
      return result
    }),

    updateTicket: jest.fn(async (ticketId: number, updates: Partial<Ticket>) => {
      const ticket = tickets.get(ticketId)
      if (!ticket) throw new Error('Ticket not found')
      const updated = { ...ticket, ...updates, updated: Date.now() }
      tickets.set(ticketId, updated)
      return updated
    }),

    readTasks: jest.fn(async (ticketId: number) => {
      const result: Record<string, TicketTask> = {}
      for (const [key, task] of tasks) {
        if (task.ticketId === ticketId) {
          result[String(task.id)] = task
        }
      }
      return result
    }),

    getTaskById: jest.fn(async (taskId: number) => {
      for (const task of tasks.values()) {
        if (task.id === taskId) {
          return task
        }
      }
      return null
    }),

    updateTask: jest.fn(async (ticketId: number, taskId: number, updates: Partial<TicketTask>) => {
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
    }),

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

// Time manipulation helpers
export const timeHelpers = {
  advanceTime: (ms: number) => {
    jest.advanceTimersByTime(ms)
  },

  setCurrentTime: (timestamp: number) => {
    jest.setSystemTime(new Date(timestamp))
  },

  resetTime: () => {
    jest.useRealTimers()
  }
}
