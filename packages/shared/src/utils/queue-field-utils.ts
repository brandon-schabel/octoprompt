/**
 * Queue Field Utilities - Type-safe helpers for managing queue-related fields
 * 
 * This module provides utilities to safely clear queue fields and prevent
 * null vs undefined inconsistencies that can cause runtime errors.
 * 
 * @module QueueFieldUtils
 */

import type { Ticket, TicketTask } from '@promptliano/schemas'

/**
 * All queue-related fields that can be present on tickets and tasks.
 * This type represents the intersection of queue fields from both schemas.
 */
type QueueFields = {
  queueId?: number | null
  queuePosition?: number | null
  queueStatus?: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | null
  queuePriority?: number
  queuedAt?: number
  queueStartedAt?: number
  queueCompletedAt?: number
  queueAgentId?: string | null
  queueErrorMessage?: string | null
  estimatedProcessingTime?: number | null
  actualProcessingTime?: number | null
}

/**
 * Partial queue field updates where all fields are optional.
 * This ensures type safety when creating update objects.
 */
export type QueueFieldUpdates = Partial<QueueFields>

/**
 * Object with all queue fields cleared (set to undefined).
 * 
 * **IMPORTANT: Null vs Undefined Distinction**
 * 
 * This utility always sets queue fields to `undefined` rather than `null` for the following reasons:
 * 
 * 1. **Schema Compatibility**: Our Zod schemas define queue fields as `.nullable().optional()`,
 *    which means they accept `undefined`, `null`, or the actual value type.
 * 
 * 2. **SQLite Storage**: The storage layer properly handles `undefined` by converting it to `NULL`
 *    in the database, but keeps the TypeScript type system clean.
 * 
 * 3. **Consistency**: Using `undefined` consistently prevents mix-ups where some fields are
 *    `null` and others are `undefined`, which can cause difficult-to-debug runtime errors.
 * 
 * 4. **JSON Serialization**: When objects with `undefined` values are serialized to JSON,
 *    the `undefined` fields are omitted entirely, resulting in cleaner API responses.
 * 
 * 5. **Type Safety**: TypeScript's strict null checks work better with `undefined` for
 *    optional fields, as it matches the expected behavior of optional properties.
 * 
 * **Example of the Problem This Solves:**
 * ```typescript
 * // PROBLEMATIC - mixing null and undefined
 * const badUpdate = {
 *   queueId: null,           // null
 *   queueStatus: undefined,  // undefined  
 *   queuePriority: null      // null
 * }
 * 
 * // SOLUTION - consistent undefined usage
 * const goodUpdate = clearQueueFields()
 * // All fields are consistently undefined
 * ```
 */
const CLEARED_QUEUE_FIELDS = {
  queueId: undefined as number | null | undefined,
  queuePosition: undefined as number | null | undefined,
  queueStatus: undefined as 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | null | undefined,
  queuePriority: undefined as number | undefined,
  queuedAt: undefined as number | undefined,
  queueStartedAt: undefined as number | undefined,
  queueCompletedAt: undefined as number | undefined,
  queueAgentId: undefined as string | null | undefined,
  queueErrorMessage: undefined as string | null | undefined,
  estimatedProcessingTime: undefined as number | null | undefined,
  actualProcessingTime: undefined as number | null | undefined,
} as const

/**
 * Returns an object with all queue fields set to undefined.
 * 
 * This function provides a type-safe way to clear all queue-related fields
 * from tickets or tasks, ensuring consistency and preventing null vs undefined bugs.
 * 
 * @returns Object with all queue fields set to undefined
 * 
 * @example
 * ```typescript
 * // Clear all queue fields when dequeuing
 * const clearedFields = clearQueueFields()
 * await ticketStorage.updateTicket(ticketId, clearedFields)
 * 
 * // Partial clearing with additional updates
 * const updates = {
 *   ...clearQueueFields(),
 *   status: 'closed' as const
 * }
 * await ticketStorage.updateTicket(ticketId, updates)
 * ```
 */
export function clearQueueFields(): QueueFieldUpdates {
  return { ...CLEARED_QUEUE_FIELDS }
}

/**
 * Returns an object with specific queue fields set to undefined.
 * 
 * This function allows selective clearing of queue fields while maintaining
 * type safety. Useful when you only want to clear certain aspects of queue state.
 * 
 * @param fields - Array of queue field names to clear
 * @returns Object with only the specified fields set to undefined
 * 
 * @example
 * ```typescript
 * // Clear only queue assignment but keep timing data
 * const partialClear = clearSpecificQueueFields(['queueId', 'queueStatus', 'queuePriority'])
 * await ticketStorage.updateTicket(ticketId, partialClear)
 * 
 * // Clear error state but keep other queue data
 * const errorClear = clearSpecificQueueFields(['queueErrorMessage'])
 * await ticketStorage.updateTask(ticketId, taskId, errorClear)
 * ```
 */
export function clearSpecificQueueFields(fields: Array<keyof QueueFields>): QueueFieldUpdates {
  const result: QueueFieldUpdates = {}
  
  for (const field of fields) {
    result[field] = undefined
  }
  
  return result
}

/**
 * Type guard to check if an object has queue fields.
 * 
 * @param obj - Object to check
 * @returns True if the object has any queue-related fields
 * 
 * @example
 * ```typescript
 * if (hasQueueFields(ticket)) {
 *   console.log('Ticket has queue data:', ticket.queueId)
 * }
 * ```
 */
export function hasQueueFields(obj: any): obj is QueueFields {
  if (!obj || typeof obj !== 'object') return false
  
  const queueFieldNames: Array<keyof QueueFields> = [
    'queueId',
    'queuePosition', 
    'queueStatus',
    'queuePriority',
    'queuedAt',
    'queueStartedAt',
    'queueCompletedAt',
    'queueAgentId',
    'queueErrorMessage',
    'estimatedProcessingTime',
    'actualProcessingTime'
  ]
  
  return queueFieldNames.some(field => field in obj)
}

/**
 * Checks if an item (ticket or task) is currently queued.
 * 
 * An item is considered queued if it has a queueId that is not null/undefined.
 * 
 * @param item - Ticket or task to check
 * @returns True if the item is currently in a queue
 * 
 * @example
 * ```typescript
 * if (isQueued(ticket)) {
 *   console.log(`Ticket is in queue ${ticket.queueId}`)
 * } else {
 *   console.log('Ticket is not queued')
 * }
 * ```
 */
export function isQueued(item: Pick<QueueFields, 'queueId'>): boolean {
  return item.queueId != null // Checks for both null and undefined
}

/**
 * Checks if an item is currently being processed (in_progress state).
 * 
 * @param item - Ticket or task to check
 * @returns True if the item is currently being processed
 * 
 * @example
 * ```typescript
 * if (isInProgress(task)) {
 *   console.log(`Task is being processed by ${task.queueAgentId}`)
 * }
 * ```
 */
export function isInProgress(item: Pick<QueueFields, 'queueStatus'>): boolean {
  return item.queueStatus === 'in_progress'
}

/**
 * Checks if an item has completed processing.
 * 
 * @param item - Ticket or task to check
 * @returns True if the item has completed (successfully or failed)
 * 
 * @example
 * ```typescript
 * if (isCompleted(ticket)) {
 *   const duration = getProcessingDuration(ticket)
 *   console.log(`Ticket completed in ${duration}ms`)
 * }
 * ```
 */
export function isCompleted(item: Pick<QueueFields, 'queueStatus'>): boolean {
  return item.queueStatus === 'completed' || item.queueStatus === 'failed' || item.queueStatus === 'cancelled'
}

/**
 * Calculates the processing duration for an item if it has timing data.
 * 
 * @param item - Ticket or task with timing information
 * @returns Processing duration in milliseconds, or null if timing data is incomplete
 * 
 * @example
 * ```typescript
 * const duration = getProcessingDuration(task)
 * if (duration !== null) {
 *   console.log(`Task took ${duration / 1000} seconds to complete`)
 * }
 * ```
 */
export function getProcessingDuration(
  item: Pick<QueueFields, 'queueStartedAt' | 'queueCompletedAt'>
): number | null {
  if (!item.queueStartedAt || !item.queueCompletedAt) {
    return null
  }
  
  return item.queueCompletedAt - item.queueStartedAt
}

/**
 * Creates update object for starting queue item processing.
 * 
 * @param agentId - Optional agent ID to assign
 * @returns Update object with in_progress status and start time
 * 
 * @example
 * ```typescript
 * const startProcessing = createStartProcessingUpdate('ai-agent-1')
 * await ticketStorage.updateTicket(ticketId, startProcessing)
 * ```
 */
export function createStartProcessingUpdate(agentId?: string): QueueFieldUpdates {
  return {
    queueStatus: 'in_progress',
    queueStartedAt: Date.now(),
    queueAgentId: agentId,
    queueErrorMessage: undefined // Clear any previous errors
  }
}

/**
 * Creates update object for completing queue item processing.
 * 
 * @param success - Whether the processing was successful
 * @param errorMessage - Error message if processing failed
 * @returns Update object with completed status and timing
 * 
 * @example
 * ```typescript
 * // Successful completion
 * const completeUpdate = createCompleteProcessingUpdate(true)
 * await ticketStorage.updateTicket(ticketId, completeUpdate)
 * 
 * // Failed completion
 * const failUpdate = createCompleteProcessingUpdate(false, 'Validation failed')
 * await ticketStorage.updateTask(ticketId, taskId, failUpdate)
 * ```
 */
export function createCompleteProcessingUpdate(
  success: boolean, 
  errorMessage?: string
): QueueFieldUpdates {
  const now = Date.now()
  
  return {
    queueStatus: success ? 'completed' : 'failed',
    queueCompletedAt: now,
    queueErrorMessage: success ? undefined : errorMessage,
    // Note: actualProcessingTime should be calculated by the caller using queueStartedAt
  }
}

/**
 * Creates update object for enqueuing an item.
 * 
 * @param queueId - Queue ID to assign item to
 * @param priority - Priority level (lower numbers = higher priority)
 * @returns Update object for enqueuing
 * 
 * @example
 * ```typescript
 * const enqueueUpdate = createEnqueueUpdate(123, 5)
 * await ticketStorage.updateTicket(ticketId, enqueueUpdate)
 * ```
 */
export function createEnqueueUpdate(queueId: number, priority: number = 0): QueueFieldUpdates {
  return {
    queueId,
    queueStatus: 'queued',
    queuePriority: priority,
    queuedAt: Date.now(),
    // Clear processing fields
    queueStartedAt: undefined,
    queueCompletedAt: undefined,
    queueAgentId: undefined,
    queueErrorMessage: undefined,
    actualProcessingTime: undefined
  }
}

/**
 * Type-safe queue field utilities for preventing null vs undefined bugs.
 * 
 * This module ensures consistent handling of queue fields across the application
 * by always using `undefined` for cleared fields rather than mixing `null` and `undefined`.
 * 
 * @public
 */
export const QueueFieldUtils = {
  clearQueueFields,
  clearSpecificQueueFields,
  hasQueueFields,
  isQueued,
  isInProgress,
  isCompleted,
  getProcessingDuration,
  createStartProcessingUpdate,
  createCompleteProcessingUpdate,
  createEnqueueUpdate
} as const

// Re-export the main function for convenience
export default clearQueueFields