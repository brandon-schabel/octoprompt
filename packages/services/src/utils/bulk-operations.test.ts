import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
  bulkOperation,
  bulkCreate,
  bulkUpdate,
  bulkDelete,
  processBatch,
  retryOperation
} from './bulk-operations'

describe('bulk-operations', () => {
  describe('bulkOperation', () => {
    describe('happy path', () => {
      test('processes all items successfully', async () => {
        const items = [1, 2, 3, 4, 5]
        const operation = mock((item: number) => Promise.resolve(item * 2))

        const result = await bulkOperation(items, operation)

        expect(result.succeeded).toEqual([2, 4, 6, 8, 10])
        expect(result.failed).toEqual([])
        expect(operation).toHaveBeenCalledTimes(5)
      })

      test('processes items sequentially by default', async () => {
        const order: number[] = []
        const operation = mock(async (item: number) => {
          order.push(item)
          await new Promise(resolve => setTimeout(resolve, 10))
          return item
        })

        await bulkOperation([1, 2, 3], operation)

        expect(order).toEqual([1, 2, 3])
      })

      test('processes items concurrently when specified', async () => {
        const startTimes: number[] = []
        const operation = mock(async (item: number) => {
          startTimes.push(Date.now())
          await new Promise(resolve => setTimeout(resolve, 10))
          return item
        })

        await bulkOperation([1, 2, 3, 4], operation, { concurrency: 2 })

        // First two should start at roughly the same time
        expect(startTimes[1] - startTimes[0]).toBeLessThan(5)
        // Third should start after first completes
        expect(startTimes[2] - startTimes[0]).toBeGreaterThan(8)
      })
    })

    describe('error handling', () => {
      test('continues on error by default', async () => {
        const operation = mock((item: number) => {
          if (item === 3) throw new Error(`Failed on ${item}`)
          return Promise.resolve(item * 2)
        })

        const result = await bulkOperation([1, 2, 3, 4, 5], operation)

        expect(result.succeeded).toEqual([2, 4, 8, 10])
        expect(result.failed).toHaveLength(1)
        expect(result.failed[0].item).toBe(3)
        expect(result.failed[0].error.message).toBe('Failed on 3')
      })

      test('stops on error when continueOnError is false', async () => {
        const operation = mock((item: number) => {
          if (item === 2) throw new Error('Stop!')
          return Promise.resolve(item)
        })

        await expect(
          bulkOperation([1, 2, 3], operation, { continueOnError: false })
        ).rejects.toThrow('Stop!')

        expect(operation).toHaveBeenCalledTimes(2)
      })

      test('calls onError callback for failed items', async () => {
        const onError = mock()
        const operation = mock((item: number) => {
          if (item % 2 === 0) throw new Error(`Even number: ${item}`)
          return Promise.resolve(item)
        })

        await bulkOperation([1, 2, 3, 4], operation, { onError })

        expect(onError).toHaveBeenCalledTimes(2)
        expect(onError).toHaveBeenCalledWith(2, expect.any(Error))
        expect(onError).toHaveBeenCalledWith(4, expect.any(Error))
      })

      test('handles non-Error objects', async () => {
        const operation = mock((item: number) => {
          if (item === 2) throw 'String error'
          return Promise.resolve(item)
        })

        const result = await bulkOperation([1, 2, 3], operation)

        expect(result.failed[0].error).toBeInstanceOf(Error)
        expect(result.failed[0].error.message).toBe('String error')
      })
    })

    describe('edge cases', () => {
      test('handles empty array', async () => {
        const operation = mock()
        const result = await bulkOperation([], operation)

        expect(result.succeeded).toEqual([])
        expect(result.failed).toEqual([])
        expect(operation).not.toHaveBeenCalled()
      })

      test('handles single item', async () => {
        const operation = mock((item: string) => Promise.resolve(item.toUpperCase()))
        const result = await bulkOperation(['hello'], operation)

        expect(result.succeeded).toEqual(['HELLO'])
        expect(result.failed).toEqual([])
      })

      test('handles large batch with concurrency', async () => {
        const items = Array.from({ length: 100 }, (_, i) => i)
        const operation = mock((item: number) => Promise.resolve(item * 2))

        const result = await bulkOperation(items, operation, { concurrency: 10 })

        expect(result.succeeded).toHaveLength(100)
        expect(result.failed).toHaveLength(0)
        expect(operation).toHaveBeenCalledTimes(100)
      })
    })
  })

  describe('bulkCreate', () => {
    describe('happy path', () => {
      test('creates all items successfully', async () => {
        const items = ['a', 'b', 'c']
        const createFn = mock((item: string) => Promise.resolve({ id: 1, value: item }))

        const result = await bulkCreate(items, createFn)

        expect(result.succeeded).toHaveLength(3)
        expect(result.failed).toHaveLength(0)
        expect(createFn).toHaveBeenCalledTimes(3)
      })
    })

    describe('duplicate handling', () => {
      test('skips duplicates when validator provided', async () => {
        const items = ['a', 'b', 'c', 'b']
        const created = new Set<string>(['b']) // 'b' already exists
        
        const validateDuplicates = mock(async (item: string) => {
          return created.has(item)
        })
        
        const createFn = mock(async (item: string) => {
          created.add(item)
          return { id: 1, value: item }
        })

        const onDuplicate = mock()

        const result = await bulkCreate(items, createFn, {
          validateDuplicates,
          onDuplicate
        })

        expect(result.succeeded).toHaveLength(2) // Only 'a' and 'c' created
        expect(validateDuplicates).toHaveBeenCalledTimes(4)
        expect(onDuplicate).toHaveBeenCalledTimes(2) // Called for both 'b' occurrences
      })

      test('creates all when no duplicate validator', async () => {
        const items = ['a', 'b', 'a']
        const createFn = mock((item: string) => Promise.resolve({ id: 1, value: item }))

        const result = await bulkCreate(items, createFn)

        expect(result.succeeded).toHaveLength(3)
        expect(createFn).toHaveBeenCalledTimes(3)
      })
    })

    describe('error handling', () => {
      test('continues on error by default', async () => {
        const createFn = mock((item: string) => {
          if (item === 'b') throw new Error('Create failed')
          return Promise.resolve({ id: 1, value: item })
        })

        const result = await bulkCreate(['a', 'b', 'c'], createFn)

        expect(result.succeeded).toHaveLength(2)
        expect(result.failed).toHaveLength(1)
      })

      test('stops on error when specified', async () => {
        const createFn = mock((item: string) => {
          if (item === 'b') throw new Error('Stop')
          return Promise.resolve({ id: 1, value: item })
        })

        await expect(
          bulkCreate(['a', 'b', 'c'], createFn, { continueOnError: false })
        ).rejects.toThrow('Stop')
      })
    })
  })

  describe('bulkUpdate', () => {
    describe('happy path', () => {
      test('updates all items successfully', async () => {
        const updates = [
          { id: 1, data: { name: 'One' } },
          { id: 2, data: { name: 'Two' } }
        ]
        const updateFn = mock((id: number, data: any) => 
          Promise.resolve({ id, ...data })
        )

        const result = await bulkUpdate(updates, updateFn)

        expect(result.succeeded).toEqual([
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' }
        ])
        expect(result.failed).toHaveLength(0)
      })
    })

    describe('validation', () => {
      test('validates existence when validator provided', async () => {
        const updates = [
          { id: 1, data: { name: 'One' } },
          { id: 999, data: { name: 'Missing' } }
        ]
        
        const validateExists = mock((id: number) => Promise.resolve(id !== 999))
        const updateFn = mock((id: number, data: any) => 
          Promise.resolve({ id, ...data })
        )

        const result = await bulkUpdate(updates, updateFn, { validateExists })

        expect(result.succeeded).toHaveLength(1)
        expect(result.failed).toHaveLength(1)
        expect(result.failed[0].error.message).toContain('not found')
      })

      test('updates without validation when not provided', async () => {
        const updates = [{ id: 999, data: { name: 'Test' } }]
        const updateFn = mock((id: number, data: any) => 
          Promise.resolve({ id, ...data })
        )

        const result = await bulkUpdate(updates, updateFn)

        expect(result.succeeded).toHaveLength(1)
        expect(updateFn).toHaveBeenCalledWith(999, { name: 'Test' })
      })
    })

    describe('error handling', () => {
      test('handles update failures', async () => {
        const updateFn = mock((id: number) => {
          if (id === 2) throw new Error('Update failed')
          return Promise.resolve({ id })
        })

        const updates = [{ id: 1, data: {} }, { id: 2, data: {} }, { id: 3, data: {} }]
        const result = await bulkUpdate(updates, updateFn)

        expect(result.succeeded).toHaveLength(2)
        expect(result.failed).toHaveLength(1)
        expect(result.failed[0].item.id).toBe(2)
      })
    })
  })

  describe('bulkDelete', () => {
    describe('happy path', () => {
      test('deletes all items successfully', async () => {
        const ids = [1, 2, 3]
        const deleteFn = mock(() => Promise.resolve(true))

        const result = await bulkDelete(ids, deleteFn)

        expect(result.deletedCount).toBe(3)
        expect(result.failed).toEqual([])
        expect(deleteFn).toHaveBeenCalledTimes(3)
      })

      test('tracks failed deletions', async () => {
        const deleteFn = mock((id: number) => Promise.resolve(id !== 2))

        const result = await bulkDelete([1, 2, 3], deleteFn)

        expect(result.deletedCount).toBe(2)
        expect(result.failed).toEqual([2])
      })
    })

    describe('validation', () => {
      test('skips non-existent items when validator provided', async () => {
        const validateExists = mock((id: number) => Promise.resolve(id !== 999))
        const deleteFn = mock(() => Promise.resolve(true))

        const result = await bulkDelete([1, 999, 2], deleteFn, { validateExists })

        expect(result.deletedCount).toBe(2)
        expect(result.failed).toEqual([999])
        expect(deleteFn).toHaveBeenCalledTimes(2)
      })
    })

    describe('error handling', () => {
      test('continues on error by default', async () => {
        const deleteFn = mock((id: number) => {
          if (id === 2) throw new Error('Delete failed')
          return Promise.resolve(true)
        })

        const result = await bulkDelete([1, 2, 3], deleteFn)

        expect(result.deletedCount).toBe(2)
        expect(result.failed).toEqual([2])
      })

      test('stops on error when specified', async () => {
        const deleteFn = mock((id: number) => {
          if (id === 2) throw new Error('Stop')
          return Promise.resolve(true)
        })

        await expect(
          bulkDelete([1, 2, 3], deleteFn, { continueOnError: false })
        ).rejects.toThrow('Stop')
      })
    })

    describe('edge cases', () => {
      test('handles empty array', async () => {
        const deleteFn = mock()
        const result = await bulkDelete([], deleteFn)

        expect(result.deletedCount).toBe(0)
        expect(result.failed).toEqual([])
        expect(deleteFn).not.toHaveBeenCalled()
      })
    })
  })

  describe('processBatch', () => {
    describe('happy path', () => {
      test('processes items in correct batch sizes', async () => {
        const items = [1, 2, 3, 4, 5, 6, 7]
        const processor = mock((batch: number[]) => 
          Promise.resolve(batch.map(n => n * 2))
        )

        const result = await processBatch(items, 3, processor)

        expect(result).toEqual([2, 4, 6, 8, 10, 12, 14])
        expect(processor).toHaveBeenCalledTimes(3)
        expect(processor).toHaveBeenCalledWith([1, 2, 3])
        expect(processor).toHaveBeenCalledWith([4, 5, 6])
        expect(processor).toHaveBeenCalledWith([7])
      })

      test('handles batch size larger than array', async () => {
        const items = [1, 2, 3]
        const processor = mock((batch: number[]) => 
          Promise.resolve(batch.map(n => n * 2))
        )

        const result = await processBatch(items, 10, processor)

        expect(result).toEqual([2, 4, 6])
        expect(processor).toHaveBeenCalledTimes(1)
        expect(processor).toHaveBeenCalledWith([1, 2, 3])
      })

      test('handles batch size of 1', async () => {
        const items = [1, 2, 3]
        const processor = mock((batch: number[]) => 
          Promise.resolve(batch)
        )

        const result = await processBatch(items, 1, processor)

        expect(result).toEqual([1, 2, 3])
        expect(processor).toHaveBeenCalledTimes(3)
      })
    })

    describe('edge cases', () => {
      test('handles empty array', async () => {
        const processor = mock()
        const result = await processBatch([], 5, processor)

        expect(result).toEqual([])
        expect(processor).not.toHaveBeenCalled()
      })

      test('processes large dataset in batches', async () => {
        const items = Array.from({ length: 1000 }, (_, i) => i)
        const processor = mock((batch: number[]) => 
          Promise.resolve(batch)
        )

        const result = await processBatch(items, 100, processor)

        expect(result).toHaveLength(1000)
        expect(processor).toHaveBeenCalledTimes(10)
      })
    })

    describe('error handling', () => {
      test('propagates processor errors', async () => {
        const processor = mock(() => {
          throw new Error('Process failed')
        })

        await expect(
          processBatch([1, 2, 3], 2, processor)
        ).rejects.toThrow('Process failed')
      })
    })
  })

  describe('retryOperation', () => {
    describe('happy path', () => {
      test('succeeds on first try', async () => {
        const operation = mock(() => Promise.resolve('success'))

        const result = await retryOperation(operation)

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(1)
      })

      test('retries on failure and succeeds', async () => {
        let attempts = 0
        const operation = mock(() => {
          attempts++
          if (attempts < 3) throw new Error('Try again')
          return Promise.resolve('success')
        })

        const result = await retryOperation(operation, { maxRetries: 3 })

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(3)
      })
    })

    describe('retry logic', () => {
      test('respects max retries', async () => {
        const operation = mock(() => {
          throw new Error('Always fails')
        })

        await expect(
          retryOperation(operation, { maxRetries: 2, initialDelay: 1 })
        ).rejects.toThrow('Always fails')

        expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
      })

      test('uses exponential backoff', async () => {
        const delays: number[] = []
        let lastCall = Date.now()
        
        const operation = mock(() => {
          const now = Date.now()
          delays.push(now - lastCall)
          lastCall = now
          throw new Error('Fail')
        })

        await expect(
          retryOperation(operation, {
            maxRetries: 3,
            initialDelay: 10,
            backoffFactor: 2
          })
        ).rejects.toThrow()

        // First call is immediate, then delays should increase
        expect(delays[1]).toBeGreaterThanOrEqual(9)
        expect(delays[2]).toBeGreaterThanOrEqual(19)
        expect(delays[3]).toBeGreaterThanOrEqual(39)
      })

      test('respects max delay', async () => {
        const delays: number[] = []
        let lastCall = Date.now()
        
        const operation = mock(() => {
          const now = Date.now()
          delays.push(now - lastCall)
          lastCall = now
          throw new Error('Fail')
        })

        await expect(
          retryOperation(operation, {
            maxRetries: 3,
            initialDelay: 10,
            maxDelay: 20,
            backoffFactor: 10
          })
        ).rejects.toThrow()

        // Delays should be capped at maxDelay (with some tolerance for timing)
        expect(delays[2]).toBeLessThanOrEqual(30) // Allow some timing variance
        expect(delays[3]).toBeLessThanOrEqual(30) // Allow some timing variance
      })

      test('uses shouldRetry predicate', async () => {
        let attempt = 0
        const operation = mock(() => {
          attempt++
          if (attempt === 1) throw new Error('Retryable')
          if (attempt === 2) throw new Error('Not retryable')
          return Promise.resolve('success')
        })

        const shouldRetry = (error: unknown) => {
          return (error as Error).message === 'Retryable'
        }

        await expect(
          retryOperation(operation, {
            maxRetries: 3,
            initialDelay: 1,
            shouldRetry
          })
        ).rejects.toThrow('Not retryable')

        expect(operation).toHaveBeenCalledTimes(2)
      })
    })

    describe('edge cases', () => {
      test('handles zero retries', async () => {
        const operation = mock(() => {
          throw new Error('Fail')
        })

        await expect(
          retryOperation(operation, { maxRetries: 0 })
        ).rejects.toThrow('Fail')

        expect(operation).toHaveBeenCalledTimes(1)
      })

      test('handles synchronous operations', async () => {
        const operation = mock(() => Promise.resolve(42))

        const result = await retryOperation(operation)

        expect(result).toBe(42)
      })

      test('preserves operation return type', async () => {
        const operation = () => Promise.resolve({ id: 1, name: 'test' })

        const result = await retryOperation(operation)

        expect(result).toEqual({ id: 1, name: 'test' })
      })
    })
  })
})