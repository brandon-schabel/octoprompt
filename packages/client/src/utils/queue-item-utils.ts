import { QueueItem } from '@promptliano/schemas'
import { formatDistanceToNow } from 'date-fns'

// Normalized queue item interface that matches frontend expectations
export interface NormalizedQueueItem
  extends Omit<QueueItem, 'created' | 'startedAt' | 'completedAt' | 'agentId' | 'errorMessage'> {
  createdAt: number
  processingStartedAt: number | null
  processingCompletedAt: number | null
  assignedAgentId: string | null
  error: string | null
  retryCount: number
}

/**
 * Normalizes a queue item from backend schema to frontend expectations
 * Maps field names and provides defaults for missing fields
 */
export function normalizeQueueItem(item: any): NormalizedQueueItem {
  if (!item) {
    throw new Error('Cannot normalize null or undefined queue item')
  }

  return {
    ...item,
    // Map backend fields to frontend expectations
    createdAt: item.created || item.createdAt || Date.now(),
    processingStartedAt: item.startedAt || item.processingStartedAt || null,
    processingCompletedAt: item.completedAt || item.processingCompletedAt || null,
    assignedAgentId: item.agentId || item.assignedAgentId || null,
    error: item.errorMessage || item.error || null,
    retryCount: item.retryCount || 0
  }
}

/**
 * Safely formats a timestamp with fallback for invalid values
 * Handles undefined, null, zero, and invalid timestamps gracefully
 */
export function safeFormatDate(timestamp: number | null | undefined): string {
  if (!timestamp || timestamp <= 0) {
    return 'Unknown'
  }

  try {
    // Handle both seconds and milliseconds timestamps
    const date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp)

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }

    return formatDistanceToNow(date) + ' ago'
  } catch (e) {
    console.error('Error formatting date:', e, 'timestamp:', timestamp)
    return 'Invalid date'
  }
}

/**
 * Ensures the provided data is always an array
 * Returns empty array for null, undefined, or non-array values
 */
export function ensureArray<T>(data: T[] | undefined | null | any): T[] {
  if (Array.isArray(data)) {
    return data
  }

  // Log warning for unexpected data types
  if (data !== undefined && data !== null) {
    console.warn('Expected array but received:', typeof data, data)
  }

  return []
}

/**
 * Safely accesses a nested property with a default value
 */
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
  try {
    const keys = path.split('.')
    let result = obj

    for (const key of keys) {
      if (result === null || result === undefined) {
        return defaultValue
      }
      result = result[key]
    }

    return result ?? defaultValue
  } catch (e) {
    return defaultValue
  }
}
