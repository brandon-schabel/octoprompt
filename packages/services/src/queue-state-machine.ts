/**
 * Queue Status State Machine
 *
 * Manages valid state transitions for queue items
 */

export type QueueStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface StateTransition {
  from: QueueStatus
  to: QueueStatus
  reason?: string
}

/**
 * Valid state transitions for queue items
 * Maps from current state to allowed next states
 */
const VALID_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  queued: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'failed', 'queued', 'cancelled'],
  completed: [], // Terminal state - no transitions allowed
  failed: ['queued'], // Can retry by re-queuing
  cancelled: ['queued'] // Can re-queue after cancellation
}

/**
 * State transition hooks for additional logic
 */
const TRANSITION_HOOKS: Partial<Record<`${QueueStatus}->${QueueStatus}`, (context: any) => void>> = {
  'queued->in_progress': (context) => {
    // Set started_at timestamp
    context.queue_started_at = Date.now()
  },
  'in_progress->completed': (context) => {
    // Set completed_at and calculate actual processing time
    context.queue_completed_at = Date.now()
    if (context.queue_started_at) {
      context.actual_processing_time = context.queue_completed_at - context.queue_started_at
    }
  },
  'in_progress->failed': (context) => {
    // Set completed_at even for failures
    context.queue_completed_at = Date.now()
  },
  'failed->queued': (context) => {
    // Clear error state for retry
    context.queue_error_message = null
    context.queue_started_at = null
    context.queue_completed_at = null
    context.actual_processing_time = null
  },
  'cancelled->queued': (context) => {
    // Clear all processing state
    context.queue_started_at = null
    context.queue_completed_at = null
    context.queue_error_message = null
    context.actual_processing_time = null
  }
}

export class QueueStateMachine {
  /**
   * Check if a state transition is valid
   */
  static isValidTransition(from: QueueStatus, to: QueueStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }

  /**
   * Get all valid next states from current state
   */
  static getValidNextStates(currentState: QueueStatus): QueueStatus[] {
    return VALID_TRANSITIONS[currentState] || []
  }

  /**
   * Validate and apply a state transition
   * @throws Error if transition is invalid
   */
  static transition<T extends { queueStatus?: string | null; updated?: number }>(
    item: T,
    newStatus: QueueStatus,
    options?: { errorMessage?: string; agentId?: string }
  ): T {
    const currentStatus = ((item.queueStatus as any) || 'queued') as QueueStatus

    if (!this.isValidTransition(currentStatus, newStatus)) {
      const validStates = this.getValidNextStates(currentStatus)
      throw new Error(
        `Invalid state transition from '${currentStatus}' to '${newStatus}'. ` +
          `Valid transitions: ${validStates.length > 0 ? validStates.join(', ') : 'none (terminal state)'}`
      )
    }

    // Create updated item with new status
    const updatedItem = {
      ...item,
      queueStatus: newStatus,
      updated: Date.now()
    } as any

    // Apply transition hook if exists
    const hookKey = `${currentStatus}->${newStatus}` as keyof typeof TRANSITION_HOOKS
    const hook = TRANSITION_HOOKS[hookKey]
    if (hook) hook(updatedItem)

    // Apply additional options
    if (options?.errorMessage && newStatus === 'failed') updatedItem.queue_error_message = options.errorMessage
    if (options?.agentId && newStatus === 'in_progress') updatedItem.queue_agent_id = options.agentId

    return updatedItem
  }

  /**
   * Check if a status is a terminal state (no further transitions possible)
   */
  static isTerminalState(status: QueueStatus): boolean {
    return VALID_TRANSITIONS[status]?.length === 0
  }

  /**
   * Check if a status indicates the item is actively being processed
   */
  static isActiveState(status: QueueStatus): boolean {
    return status === 'in_progress'
  }

  /**
   * Check if a status indicates the item is waiting to be processed
   */
  static isPendingState(status: QueueStatus): boolean {
    return status === 'queued'
  }

  /**
   * Check if a status indicates the item has finished processing (success or failure)
   */
  static isFinishedState(status: QueueStatus): boolean {
    return status === 'completed' || status === 'failed' || status === 'cancelled'
  }

  /**
   * Get a human-readable description of the status
   */
  static getStatusDescription(status: QueueStatus): string {
    const descriptions: Record<QueueStatus, string> = {
      queued: 'Waiting in queue to be processed',
      in_progress: 'Currently being processed',
      completed: 'Successfully completed',
      failed: 'Failed during processing',
      cancelled: 'Cancelled by user or system'
    }
    return descriptions[status] || 'Unknown status'
  }

  /**
   * Get status color for UI display
   */
  static getStatusColor(status: QueueStatus): string {
    const colors: Record<QueueStatus, string> = {
      queued: 'gray',
      in_progress: 'blue',
      completed: 'green',
      failed: 'red',
      cancelled: 'yellow'
    }
    return colors[status] || 'gray'
  }

  /**
   * Validate a batch of transitions
   */
  static validateBatchTransitions(
    items: Array<{ id: string | number; currentStatus: QueueStatus; newStatus: QueueStatus }>
  ): { valid: typeof items; invalid: Array<(typeof items)[0] & { reason: string }> } {
    const valid: typeof items = []
    const invalid: Array<(typeof items)[0] & { reason: string }> = []

    for (const item of items) {
      if (this.isValidTransition(item.currentStatus, item.newStatus)) {
        valid.push(item)
      } else {
        const validStates = this.getValidNextStates(item.currentStatus)
        invalid.push({
          ...item,
          reason: `Cannot transition from ${item.currentStatus} to ${item.newStatus}. Valid: ${validStates.join(', ')}`
        })
      }
    }

    return { valid, invalid }
  }

  /**
   * Get statistics about queue states
   */
  static getQueueStatistics(items: Array<{ queueStatus?: string | null }>): Record<QueueStatus | 'unqueued', number> {
    const stats: Record<QueueStatus | 'unqueued', number> = {
      unqueued: 0,
      queued: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    }

    for (const item of items) {
      const status = ((item.queueStatus as any) || 'unqueued') as QueueStatus | 'unqueued'
      stats[status] = (stats[status] || 0) + 1
    }

    return stats
  }
}

export default QueueStateMachine
