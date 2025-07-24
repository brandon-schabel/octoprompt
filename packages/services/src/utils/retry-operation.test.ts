import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { retryOperation } from './retry-operation'
import { ApiError } from '@octoprompt/shared'

describe('retryOperation', () => {
  test('should use maxAttempts correctly', async () => {
    let attempts = 0
    const operation = mock(async () => {
      attempts++
      throw new Error('Test error')
    })

    await expect(
      retryOperation(operation, {
        maxAttempts: 3,
        initialDelay: 10,
        shouldRetry: () => true
      })
    ).rejects.toThrow('Test error')

    expect(attempts).toBe(3)
  })

  test('should retry on rate limit errors', async () => {
    let attempts = 0
    const operation = mock(async () => {
      attempts++
      if (attempts < 3) {
        throw new ApiError(429, 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
      }
      return 'success'
    })

    const result = await retryOperation(operation, {
      maxAttempts: 3,
      initialDelay: 10
    })

    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })

  test('should retry on server errors (status >= 500)', async () => {
    let attempts = 0
    const operation = mock(async () => {
      attempts++
      if (attempts < 2) {
        throw new ApiError(503, 'Service unavailable', 'PROVIDER_UNAVAILABLE')
      }
      return 'success'
    })

    const result = await retryOperation(operation, {
      maxAttempts: 3,
      initialDelay: 10
    })

    expect(result).toBe('success')
    expect(attempts).toBe(2)
  })

  test('should not retry on client errors (status < 500)', async () => {
    let attempts = 0
    const operation = mock(async () => {
      attempts++
      throw new ApiError(400, 'Bad request', 'BAD_REQUEST')
    })

    await expect(
      retryOperation(operation, {
        maxAttempts: 3,
        initialDelay: 10
      })
    ).rejects.toThrow('Bad request')

    expect(attempts).toBe(1)
  })

  test('should use custom shouldRetry function', async () => {
    let attempts = 0
    const operation = mock(async () => {
      attempts++
      const error = new ApiError(400, 'Custom error', 'CUSTOM_ERROR')
      throw error
    })

    await expect(
      retryOperation(operation, {
        maxAttempts: 3,
        initialDelay: 10,
        shouldRetry: (error: any) => {
          return error instanceof ApiError && error.code === 'CUSTOM_ERROR'
        }
      })
    ).rejects.toThrow('Custom error')

    expect(attempts).toBe(3)
  })

  test('should respect maxAttempts option name (not maxRetries)', async () => {
    let attempts = 0
    const operation = mock(async () => {
      attempts++
      throw new Error('Test error')
    })

    // This test verifies that the option is correctly named maxAttempts
    await expect(
      retryOperation(operation, {
        maxAttempts: 2, // Correct property name
        initialDelay: 10,
        shouldRetry: () => true
      })
    ).rejects.toThrow('Test error')

    expect(attempts).toBe(2)
  })
})