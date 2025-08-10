import type { Ticket, TicketTask, TaskQueue } from '@promptliano/schemas'

// Test project ID used across tests
export const TEST_PROJECT_ID = 999999

// Simple test data creators
export function createTestTicket(overrides: Partial<Ticket> = {}): Omit<Ticket, 'id'> {
  return {
    projectId: TEST_PROJECT_ID,
    title: 'Test Ticket',
    description: 'Test description',
    overview: 'Test overview',
    status: 'open',
    priority: 'normal',
    type: 'feature',
    suggestedFileIds: [],
    suggestedAgentIds: [],
    suggestedPromptIds: [],
    created: Date.now(),
    updated: Date.now(),
    ...overrides
  } as Omit<Ticket, 'id'>
}

export function createTestTask(ticketId: number, overrides: Partial<TicketTask> = {}): Omit<TicketTask, 'id'> {
  return {
    ticketId,
    content: 'Test Task',
    description: 'Test task description',
    done: false,
    orderIndex: 0,
    estimatedHours: 1,
    actualHours: null,
    tags: [],
    suggestedFileIds: [],
    suggestedAgentIds: [],
    suggestedPromptIds: [],
    queueId: null,
    queueStatus: null,
    queuePriority: null,
    queuePosition: null,
    queuedAt: null,
    queueStartedAt: null,
    queueCompletedAt: null,
    queueAgentId: null,
    queueErrorMessage: null,
    queueRetryCount: null,
    queueMaxRetries: null,
    queueTimeoutAt: null,
    created: Date.now(),
    updated: Date.now(),
    ...overrides
  } as Omit<TicketTask, 'id'>
}

export function createTestQueue(overrides: Partial<TaskQueue> = {}): Omit<TaskQueue, 'id'> {
  return {
    projectId: TEST_PROJECT_ID,
    name: 'Test Queue',
    description: 'Test queue description',
    status: 'active',
    maxParallelItems: 1,
    created: Date.now(),
    updated: Date.now(),
    ...overrides
  } as Omit<TaskQueue, 'id'>
}

// Simple assertions
export function assertQueuedCorrectly(item: any) {
  expect(item.queueId).toBeDefined()
  expect(item.queueId).not.toBeNull()
  expect(item.queueStatus).toBe('queued')
  expect(item.queuedAt).toBeDefined()
  expect(item.queuedAt).toBeGreaterThan(0)
}

export function assertInProgress(item: any, agentId?: string) {
  expect(item.queueStatus).toBe('in_progress')
  expect(item.queueStartedAt).toBeDefined()
  expect(item.queueStartedAt).toBeGreaterThan(0)

  if (agentId) {
    expect(item.queueAgentId).toBe(agentId)
  } else {
    expect(item.queueAgentId).toBeDefined()
  }
}

export function assertCompleted(item: any) {
  expect(item.queueStatus).toBe('completed')
  expect(item.queueCompletedAt).toBeDefined()
  expect(item.queueCompletedAt).toBeGreaterThan(0)

  if ('done' in item) {
    expect(item.done).toBe(true)
  }
  if ('status' in item && item.type === 'ticket') {
    expect(item.status).toBe('closed')
  }
}

export function assertFailed(item: any, errorMessage?: string) {
  expect(item.queueStatus).toBe('failed')
  expect(item.queueErrorMessage).toBeDefined()

  if (errorMessage) {
    expect(item.queueErrorMessage).toBe(errorMessage)
  }
}

export function assertNotQueued(item: any) {
  expect(item.queueId).toBeNull()
  expect(item.queueStatus).toBeNull()
  expect(item.queuePriority).toBeNull()
  expect(item.queuedAt).toBeNull()
}

// Batch creation helpers
export async function createTestTickets(
  count: number,
  createFn: (data: any) => Promise<Ticket>,
  overrides: Partial<Ticket> = {}
): Promise<Ticket[]> {
  const tickets = []
  for (let i = 0; i < count; i++) {
    const ticket = await createFn({
      ...createTestTicket(overrides),
      title: `Test Ticket ${i + 1}`
    })
    tickets.push(ticket)
  }
  return tickets
}

export async function createTestTasks(
  ticketId: number,
  count: number,
  createFn: (ticketId: number, data: any) => Promise<TicketTask>,
  overrides: Partial<TicketTask> = {}
): Promise<TicketTask[]> {
  const tasks = []
  for (let i = 0; i < count; i++) {
    const task = await createFn(ticketId, {
      ...createTestTask(ticketId, overrides),
      content: `Test Task ${i + 1}`,
      orderIndex: i
    })
    tasks.push(task)
  }
  return tasks
}

// Wait utilities
export async function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await waitFor(interval)
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

// Performance measurement
export function measureTime<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
  const start = performance.now()
  const result = fn()

  if (result instanceof Promise) {
    return result.then((value) => {
      const duration = performance.now() - start
      console.log(`[${name}] took ${duration.toFixed(2)}ms`)
      return value
    })
  }

  const duration = performance.now() - start
  console.log(`[${name}] took ${duration.toFixed(2)}ms`)
  return result
}

// Queue statistics helpers
export function assertQueueStats(
  stats: any,
  expected: {
    totalItems?: number
    queuedItems?: number
    inProgressItems?: number
    completedItems?: number
    failedItems?: number
    ticketCount?: number
    taskCount?: number
  }
) {
  if (expected.totalItems !== undefined) {
    expect(stats.totalItems).toBe(expected.totalItems)
  }
  if (expected.queuedItems !== undefined) {
    expect(stats.queuedItems).toBe(expected.queuedItems)
  }
  if (expected.inProgressItems !== undefined) {
    expect(stats.inProgressItems).toBe(expected.inProgressItems)
  }
  if (expected.completedItems !== undefined) {
    expect(stats.completedItems).toBe(expected.completedItems)
  }
  if (expected.failedItems !== undefined) {
    expect(stats.failedItems).toBe(expected.failedItems)
  }
  if (expected.ticketCount !== undefined) {
    expect(stats.ticketCount).toBe(expected.ticketCount)
  }
  if (expected.taskCount !== undefined) {
    expect(stats.taskCount).toBe(expected.taskCount)
  }
}

// Priority helpers
export function assertPriorityOrder(items: any[]) {
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const curr = items[i]

    // Higher priority values should come first
    expect(prev.queuePriority).toBeGreaterThanOrEqual(curr.queuePriority)

    // If same priority, check timestamps (FIFO)
    if (prev.queuePriority === curr.queuePriority) {
      expect(prev.queuedAt).toBeLessThanOrEqual(curr.queuedAt)
    }
  }
}

// Clean up helper
export async function cleanupTestQueue(queueId: number, deleteQueueFn: (id: number) => Promise<void>): Promise<void> {
  try {
    await deleteQueueFn(queueId)
  } catch (error) {
    // Ignore errors during cleanup
    console.log(`Cleanup error for queue ${queueId}:`, error)
  }
}

// Import expect for assertions
import { expect } from 'bun:test'
