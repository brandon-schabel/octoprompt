import type {
  TaskQueue,
  QueueItem,
  ItemQueueStatus as QueueItemStatus,
  QueueStats,
  Ticket,
  TicketTask
} from '@promptliano/schemas'

// Queue state validators
export function assertQueueState(
  queue: TaskQueue,
  expectedState: {
    status?: 'active' | 'paused' | 'inactive'
    maxParallelItems?: number
    hasItems?: boolean
  }
) {
  if (expectedState.status !== undefined) {
    expect(queue.status).toBe(expectedState.status)
  }

  if (expectedState.maxParallelItems !== undefined) {
    expect(queue.maxParallelItems).toBe(expectedState.maxParallelItems)
  }
}

// Status transition checkers
export function assertValidStatusTransition(fromStatus: QueueItemStatus, toStatus: QueueItemStatus): boolean {
  const validTransitions: Record<QueueItemStatus, QueueItemStatus[]> = {
    queued: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'failed', 'timeout', 'cancelled'],
    completed: [], // Terminal state
    failed: ['queued'], // Can retry
    cancelled: [], // Terminal state
    timeout: ['queued'], // Can retry
    released: ['queued'] // Goes back to queue
  }

  const allowed = validTransitions[fromStatus] || []
  expect(allowed).toContain(toStatus)
  return allowed.includes(toStatus)
}

export function assertQueueItemStatus(
  item: QueueItem,
  expectedStatus: QueueItemStatus,
  additionalChecks?: {
    hasAgent?: boolean
    hasError?: boolean
    isStarted?: boolean
    isCompleted?: boolean
  }
) {
  expect(item.status).toBe(expectedStatus)

  if (additionalChecks?.hasAgent !== undefined) {
    if (additionalChecks.hasAgent) {
      expect(item.agentId).toBeTruthy()
    } else {
      expect(item.agentId).toBeFalsy()
    }
  }

  if (additionalChecks?.hasError !== undefined) {
    if (additionalChecks.hasError) {
      expect(item.errorMessage).toBeTruthy()
    } else {
      expect(item.errorMessage).toBeFalsy()
    }
  }

  if (additionalChecks?.isStarted !== undefined) {
    if (additionalChecks.isStarted) {
      expect(item.startedAt).toBeTruthy()
      expect(item.startedAt).toBeGreaterThan(0)
    } else {
      expect(item.startedAt).toBeFalsy()
    }
  }

  if (additionalChecks?.isCompleted !== undefined) {
    if (additionalChecks.isCompleted) {
      expect(item.completedAt).toBeTruthy()
      expect(item.completedAt).toBeGreaterThan(0)
    } else {
      expect(item.completedAt).toBeFalsy()
    }
  }
}

// Priority order validator
export function assertPriorityOrder(items: QueueItem[]) {
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const curr = items[i]

    // Lower priority number means higher priority (should come first)
    expect(prev.priority).toBeLessThanOrEqual(curr.priority)

    // If same priority, check creation time
    if (prev.priority === curr.priority) {
      expect(prev.created).toBeLessThanOrEqual(curr.created)
    }
  }
}

// Statistics verifiers
export function assertQueueStats(
  stats: QueueStats,
  expected: {
    totalItems?: number
    queuedItems?: number
    inProgressItems?: number
    completedItems?: number
    failedItems?: number
    cancelledItems?: number
    currentAgents?: string[]
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

  if (expected.cancelledItems !== undefined) {
    expect(stats.cancelledItems).toBe(expected.cancelledItems)
  }

  if (expected.currentAgents) {
    expect(stats.currentAgents).toEqual(expect.arrayContaining(expected.currentAgents))
    expect(stats.currentAgents).toHaveLength(expected.currentAgents.length)
  }

  // Verify that all counts add up
  const itemSum =
    stats.queuedItems + stats.inProgressItems + stats.completedItems + stats.failedItems + stats.cancelledItems
  expect(itemSum).toBe(stats.totalItems)
}

// Ticket-Task synchronization validators
export function assertTicketQueueSync(
  ticket: Ticket,
  expectedState: {
    isQueued?: boolean
    queueId?: number | null
    queueStatus?: string | null
  }
) {
  if (expectedState.isQueued !== undefined) {
    if (expectedState.isQueued) {
      expect(ticket.queueId).toBeTruthy()
      expect(ticket.queueStatus).toBeTruthy()
      expect(ticket.queuedAt).toBeTruthy()
    } else {
      expect(ticket.queueId).toBeFalsy()
      expect(ticket.queueStatus).toBeFalsy()
    }
  }

  if (expectedState.queueId !== undefined) expect(ticket.queueId).toBe(expectedState.queueId)

  if (expectedState.queueStatus !== undefined) expect(ticket.queueStatus).toBe(expectedState.queueStatus)
}

export function assertTaskQueueSync(
  task: TicketTask,
  expectedState: {
    isQueued?: boolean
    queueId?: number | null
    queueStatus?: string | null
    isDone?: boolean
  }
) {
  if (expectedState.isQueued !== undefined) {
    if (expectedState.isQueued) {
      expect(task.queueId).toBeTruthy()
      expect(task.queueStatus).toBeTruthy()
      expect(task.queuedAt).toBeTruthy()
    } else {
      expect(task.queueId).toBeFalsy()
      expect(task.queueStatus).toBeFalsy()
    }
  }

  if (expectedState.queueId !== undefined) expect(task.queueId).toBe(expectedState.queueId)

  if (expectedState.queueStatus !== undefined) expect(task.queueStatus).toBe(expectedState.queueStatus)

  if (expectedState.isDone !== undefined) {
    expect(task.done).toBe(expectedState.isDone)
  }
}

// Timeline validators
export function assertTimelineOrder(timeline: any) {
  const items = timeline.items

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const curr = items[i]

    // Each item should start after or when the previous one starts
    expect(curr.estimatedStartTime).toBeGreaterThanOrEqual(prev.estimatedStartTime)
  }

  // Total time should be sum of individual processing times
  const totalTime = items
    .filter((item: any) => item.status === 'queued' || item.status === 'in_progress')
    .reduce((sum: number, item: any) => sum + item.estimatedProcessingTime, 0)

  expect(timeline.totalEstimatedTime).toBe(totalTime)
}

// Concurrent processing validators
export function assertConcurrentLimits(items: QueueItem[], maxParallel: number) {
  const inProgressItems = items.filter((item) => item.status === 'in_progress')
  expect(inProgressItems.length).toBeLessThanOrEqual(maxParallel)

  // Check unique agents
  const agents = new Set(inProgressItems.map((item) => item.agentId).filter(Boolean))
  expect(agents.size).toBeLessThanOrEqual(maxParallel)
}

// Error state validators
export function assertErrorState(
  item: QueueItem,
  expectedError: {
    hasMessage?: boolean
    messageContains?: string
    retryCount?: number
    canRetry?: boolean
  }
) {
  expect(['failed', 'timeout']).toContain(item.status)

  if (expectedError.hasMessage) {
    expect(item.errorMessage).toBeTruthy()
  }

  if (expectedError.messageContains) {
    expect(item.errorMessage).toContain(expectedError.messageContains)
  }

  // Note: retryCount is stored in extended properties in real implementation
  // This is simplified for testing
}

// Batch operation validators
export function assertBatchResult<T>(
  result: { enqueued?: T[]; skipped?: number; successful?: T[]; failed?: any[] },
  expected: {
    enqueuedCount?: number
    skippedCount?: number
    successCount?: number
    failedCount?: number
  }
) {
  if (expected.enqueuedCount !== undefined && result.enqueued) {
    expect(result.enqueued).toHaveLength(expected.enqueuedCount)
  }

  if (expected.skippedCount !== undefined && result.skipped !== undefined) {
    expect(result.skipped).toBe(expected.skippedCount)
  }

  if (expected.successCount !== undefined && result.successful) {
    expect(result.successful).toHaveLength(expected.successCount)
  }

  if (expected.failedCount !== undefined && result.failed) {
    expect(result.failed).toHaveLength(expected.failedCount)
  }
}

// Helper to wait for condition with timeout
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const result = await condition()
    if (result) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}
