/**
 * Tests for Queue Field Utilities
 * 
 * These tests ensure type safety and correct behavior for queue field operations.
 */

import { describe, test, expect } from 'bun:test'
import {
  clearQueueFields,
  clearSpecificQueueFields,
  hasQueueFields,
  isQueued,
  isInProgress,
  isCompleted,
  getProcessingDuration,
  createStartProcessingUpdate,
  createCompleteProcessingUpdate,
  createEnqueueUpdate,
  QueueFieldUtils
} from './queue-field-utils'

describe('Queue Field Utilities', () => {
  describe('clearQueueFields', () => {
    test('should return all queue fields set to undefined', () => {
      const cleared = clearQueueFields()
      
      expect(cleared.queueId).toBeUndefined()
      expect(cleared.queuePosition).toBeUndefined()
      expect(cleared.queueStatus).toBeUndefined()
      expect(cleared.queuePriority).toBeUndefined()
      expect(cleared.queuedAt).toBeUndefined()
      expect(cleared.queueStartedAt).toBeUndefined()
      expect(cleared.queueCompletedAt).toBeUndefined()
      expect(cleared.queueAgentId).toBeUndefined()
      expect(cleared.queueErrorMessage).toBeUndefined()
      expect(cleared.estimatedProcessingTime).toBeUndefined()
      expect(cleared.actualProcessingTime).toBeUndefined()
    })

    test('should return new object each time (not mutate shared state)', () => {
      const cleared1 = clearQueueFields()
      const cleared2 = clearQueueFields()
      
      expect(cleared1).not.toBe(cleared2)
      expect(cleared1).toEqual(cleared2)
    })
  })

  describe('clearSpecificQueueFields', () => {
    test('should clear only specified fields', () => {
      const cleared = clearSpecificQueueFields(['queueId', 'queueStatus', 'queuePriority'])
      
      expect(cleared.queueId).toBeUndefined()
      expect(cleared.queueStatus).toBeUndefined()
      expect(cleared.queuePriority).toBeUndefined()
      
      // Should not have other fields
      expect('queuedAt' in cleared).toBe(false)
      expect('queueStartedAt' in cleared).toBe(false)
      expect('queueCompletedAt' in cleared).toBe(false)
    })

    test('should handle empty array', () => {
      const cleared = clearSpecificQueueFields([])
      
      expect(Object.keys(cleared)).toHaveLength(0)
    })
  })

  describe('hasQueueFields', () => {
    test('should return true for objects with queue fields', () => {
      expect(hasQueueFields({ queueId: 123 })).toBe(true)
      expect(hasQueueFields({ queueStatus: 'queued' })).toBe(true)
      expect(hasQueueFields({ queuePriority: 5 })).toBe(true)
    })

    test('should return false for objects without queue fields', () => {
      expect(hasQueueFields({})).toBe(false)
      expect(hasQueueFields({ id: 123, title: 'test' })).toBe(false)
      expect(hasQueueFields(null)).toBe(false)
      expect(hasQueueFields(undefined)).toBe(false)
      expect(hasQueueFields('string')).toBe(false)
    })
  })

  describe('isQueued', () => {
    test('should return true when queueId is set', () => {
      expect(isQueued({ queueId: 123 })).toBe(true)
      expect(isQueued({ queueId: 0 })).toBe(true) // 0 is a valid queue ID
    })

    test('should return false when queueId is null or undefined', () => {
      expect(isQueued({ queueId: null })).toBe(false)
      expect(isQueued({ queueId: undefined })).toBe(false)
      expect(isQueued({})).toBe(false)
    })
  })

  describe('isInProgress', () => {
    test('should return true when status is in_progress', () => {
      expect(isInProgress({ queueStatus: 'in_progress' })).toBe(true)
    })

    test('should return false for other statuses', () => {
      expect(isInProgress({ queueStatus: 'queued' })).toBe(false)
      expect(isInProgress({ queueStatus: 'completed' })).toBe(false)
      expect(isInProgress({ queueStatus: 'failed' })).toBe(false)
      expect(isInProgress({ queueStatus: 'cancelled' })).toBe(false)
      expect(isInProgress({ queueStatus: null })).toBe(false)
      expect(isInProgress({})).toBe(false)
    })
  })

  describe('isCompleted', () => {
    test('should return true for completion statuses', () => {
      expect(isCompleted({ queueStatus: 'completed' })).toBe(true)
      expect(isCompleted({ queueStatus: 'failed' })).toBe(true)
      expect(isCompleted({ queueStatus: 'cancelled' })).toBe(true)
    })

    test('should return false for non-completion statuses', () => {
      expect(isCompleted({ queueStatus: 'queued' })).toBe(false)
      expect(isCompleted({ queueStatus: 'in_progress' })).toBe(false)
      expect(isCompleted({ queueStatus: null })).toBe(false)
      expect(isCompleted({})).toBe(false)
    })
  })

  describe('getProcessingDuration', () => {
    test('should calculate duration correctly', () => {
      const startTime = 1000000
      const endTime = 1005000
      
      const duration = getProcessingDuration({
        queueStartedAt: startTime,
        queueCompletedAt: endTime
      })
      
      expect(duration).toBe(5000)
    })

    test('should return null when timing data is incomplete', () => {
      expect(getProcessingDuration({ queueStartedAt: 1000000 })).toBeNull()
      expect(getProcessingDuration({ queueCompletedAt: 1000000 })).toBeNull()
      expect(getProcessingDuration({})).toBeNull()
    })
  })

  describe('createStartProcessingUpdate', () => {
    test('should create proper start processing update', () => {
      const agentId = 'test-agent'
      const beforeTime = Date.now()
      
      const update = createStartProcessingUpdate(agentId)
      
      const afterTime = Date.now()
      
      expect(update.queueStatus).toBe('in_progress')
      expect(update.queueAgentId).toBe(agentId)
      expect(update.queueErrorMessage).toBeUndefined()
      expect(update.queueStartedAt).toBeGreaterThanOrEqual(beforeTime)
      expect(update.queueStartedAt).toBeLessThanOrEqual(afterTime)
    })

    test('should work without agent ID', () => {
      const update = createStartProcessingUpdate()
      
      expect(update.queueStatus).toBe('in_progress')
      expect(update.queueAgentId).toBeUndefined()
      expect(update.queueErrorMessage).toBeUndefined()
      expect(typeof update.queueStartedAt).toBe('number')
    })
  })

  describe('createCompleteProcessingUpdate', () => {
    test('should create successful completion update', () => {
      const beforeTime = Date.now()
      
      const update = createCompleteProcessingUpdate(true)
      
      const afterTime = Date.now()
      
      expect(update.queueStatus).toBe('completed')
      expect(update.queueErrorMessage).toBeUndefined()
      expect(update.queueCompletedAt).toBeGreaterThanOrEqual(beforeTime)
      expect(update.queueCompletedAt).toBeLessThanOrEqual(afterTime)
    })

    test('should create failed completion update with error message', () => {
      const errorMessage = 'Processing failed'
      const update = createCompleteProcessingUpdate(false, errorMessage)
      
      expect(update.queueStatus).toBe('failed')
      expect(update.queueErrorMessage).toBe(errorMessage)
      expect(typeof update.queueCompletedAt).toBe('number')
    })
  })

  describe('createEnqueueUpdate', () => {
    test('should create proper enqueue update', () => {
      const queueId = 123
      const priority = 5
      const beforeTime = Date.now()
      
      const update = createEnqueueUpdate(queueId, priority)
      
      const afterTime = Date.now()
      
      expect(update.queueId).toBe(queueId)
      expect(update.queueStatus).toBe('queued')
      expect(update.queuePriority).toBe(priority)
      expect(update.queuedAt).toBeGreaterThanOrEqual(beforeTime)
      expect(update.queuedAt).toBeLessThanOrEqual(afterTime)
      
      // Should clear processing fields
      expect(update.queueStartedAt).toBeUndefined()
      expect(update.queueCompletedAt).toBeUndefined()
      expect(update.queueAgentId).toBeUndefined()
      expect(update.queueErrorMessage).toBeUndefined()
      expect(update.actualProcessingTime).toBeUndefined()
    })

    test('should use default priority when not specified', () => {
      const update = createEnqueueUpdate(123)
      
      expect(update.queuePriority).toBe(0)
    })
  })

  describe('QueueFieldUtils export', () => {
    test('should export all utility functions', () => {
      expect(QueueFieldUtils.clearQueueFields).toBe(clearQueueFields)
      expect(QueueFieldUtils.clearSpecificQueueFields).toBe(clearSpecificQueueFields)
      expect(QueueFieldUtils.hasQueueFields).toBe(hasQueueFields)
      expect(QueueFieldUtils.isQueued).toBe(isQueued)
      expect(QueueFieldUtils.isInProgress).toBe(isInProgress)
      expect(QueueFieldUtils.isCompleted).toBe(isCompleted)
      expect(QueueFieldUtils.getProcessingDuration).toBe(getProcessingDuration)
      expect(QueueFieldUtils.createStartProcessingUpdate).toBe(createStartProcessingUpdate)
      expect(QueueFieldUtils.createCompleteProcessingUpdate).toBe(createCompleteProcessingUpdate)
      expect(QueueFieldUtils.createEnqueueUpdate).toBe(createEnqueueUpdate)
    })
  })

  describe('Type Safety Edge Cases', () => {
    test('should handle null vs undefined consistently', () => {
      // Test that clearQueueFields always returns undefined, never null
      const cleared = clearQueueFields()
      
      // Check that all values are specifically undefined, not null
      Object.values(cleared).forEach(value => {
        expect(value).toBeUndefined()
        expect(value).not.toBeNull()
      })
    })

    test('should work with partial objects', () => {
      const partialTicket = {
        id: 123,
        title: 'Test Ticket',
        queueId: 456
      }
      
      expect(isQueued(partialTicket)).toBe(true)
      expect(hasQueueFields(partialTicket)).toBe(true)
    })

    test('should handle edge case queue IDs', () => {
      expect(isQueued({ queueId: 0 })).toBe(true) // 0 is valid
      expect(isQueued({ queueId: -1 })).toBe(true) // negative is technically valid
      expect(isQueued({ queueId: null })).toBe(false)
      expect(isQueued({ queueId: undefined })).toBe(false)
    })
  })

  describe('Integration with Real Data', () => {
    test('should work with ticket-like objects', () => {
      const mockTicket = {
        id: 1,
        projectId: 1,
        title: 'Test Ticket',
        queueId: 123,
        queueStatus: 'in_progress' as const,
        queuePriority: 5,
        queuedAt: 1000000,
        queueStartedAt: 1001000,
        queueAgentId: 'agent-1'
      }
      
      expect(isQueued(mockTicket)).toBe(true)
      expect(isInProgress(mockTicket)).toBe(true)
      expect(hasQueueFields(mockTicket)).toBe(true)
      
      // Test clearing
      const cleared = clearQueueFields()
      const clearedTicket = { ...mockTicket, ...cleared }
      
      expect(isQueued(clearedTicket)).toBe(false)
      expect(isInProgress(clearedTicket)).toBe(false)
      expect(clearedTicket.title).toBe('Test Ticket') // Non-queue fields preserved
    })

    test('should work with task-like objects', () => {
      const mockTask = {
        id: 1,
        ticketId: 1,
        content: 'Test Task',
        done: false,
        queueId: 123,
        queueStatus: 'completed' as const,
        queueCompletedAt: 1002000
      }
      
      expect(isQueued(mockTask)).toBe(true)
      expect(isCompleted(mockTask)).toBe(true)
      expect(hasQueueFields(mockTask)).toBe(true)
    })
  })
})