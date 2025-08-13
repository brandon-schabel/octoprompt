import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { ZodError, z } from 'zod'
import { ApiError } from '@promptliano/shared'
import {
  handleValidationError,
  throwNotFound,
  withErrorHandling,
  createCrudErrorHandlers,
  throwApiError,
  safeAsync
} from './error-handlers'

describe('error-handlers', () => {
  describe('handleValidationError', () => {
    test('handles ZodError with field errors', () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().positive()
      })

      try {
        schema.parse({ name: '', age: -5 })
      } catch (error) {
        expect(() => 
          handleValidationError(error, 'User', 'creating')
        ).toThrow(ApiError)

        try {
          handleValidationError(error, 'User', 'creating')
        } catch (apiError) {
          expect(apiError).toBeInstanceOf(ApiError)
          expect((apiError as ApiError).status).toBe(500)
          expect((apiError as ApiError).message).toContain('Internal validation error creating User')
          expect((apiError as ApiError).code).toBe('USER_VALIDATION_ERROR')
          expect((apiError as ApiError).details).toBeDefined()
        }
      }
    })

    test('handles ZodError with additional context', () => {
      const zodError = new ZodError([
        { path: ['email'], message: 'Invalid email', code: 'invalid_string' }
      ])

      try {
        handleValidationError(zodError, 'Account', 'updating', { id: 123 })
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).code).toBe('ACCOUNT_VALIDATION_ERROR')
      }
    })

    test('handles entity names with spaces', () => {
      const zodError = new ZodError([])

      try {
        handleValidationError(zodError, 'User Profile', 'creating')
      } catch (error) {
        expect((error as ApiError).code).toBe('USER_PROFILE_VALIDATION_ERROR')
      }
    })

    test('rethrows non-ZodError errors', () => {
      const customError = new Error('Custom error')

      expect(() => 
        handleValidationError(customError, 'User', 'creating')
      ).toThrow('Custom error')
    })

    test('never returns (type safety)', () => {
      const zodError = new ZodError([])
      
      // This should never execute past the error handler
      let executed = false
      try {
        handleValidationError(zodError, 'Test', 'testing')
        executed = true
      } catch {
        // Expected
      }
      
      expect(executed).toBe(false)
    })
  })

  describe('throwNotFound', () => {
    test('throws ApiError with 404 status', () => {
      expect(() => 
        throwNotFound('User', 123)
      ).toThrow(ApiError)

      try {
        throwNotFound('User', 123)
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(404)
        expect((error as ApiError).message).toBe('User with ID 123 not found.')
        expect((error as ApiError).code).toBe('USER_NOT_FOUND')
      }
    })

    test('handles string identifiers', () => {
      try {
        throwNotFound('Document', 'abc-123')
      } catch (error) {
        expect((error as ApiError).message).toBe('Document with ID abc-123 not found.')
      }
    })

    test('supports custom field names', () => {
      try {
        throwNotFound('User', 'john@example.com', 'email')
      } catch (error) {
        expect((error as ApiError).message).toBe('User with email john@example.com not found.')
      }
    })

    test('handles entity names with special characters', () => {
      try {
        throwNotFound('User Profile', 123)
      } catch (error) {
        expect((error as ApiError).code).toBe('USER_PROFILE_NOT_FOUND')
      }
    })
  })

  describe('withErrorHandling', () => {
    test('wraps successful async methods', async () => {
      const method = mock(async (id: number) => ({ id, name: 'Test' }))
      const wrapped = withErrorHandling(method, 'User', 'fetching')

      const result = await wrapped(123)

      expect(result).toEqual({ id: 123, name: 'Test' })
      expect(method).toHaveBeenCalledWith(123)
    })

    test('passes through ApiError unchanged', async () => {
      const apiError = new ApiError(400, 'Bad request', 'BAD_REQUEST')
      const method = mock(async () => {
        throw apiError
      })
      const wrapped = withErrorHandling(method, 'User', 'creating')

      await expect(wrapped()).rejects.toThrow(apiError)
    })

    test('handles ZodError with validation', async () => {
      const zodError = new ZodError([
        { path: ['name'], message: 'Required', code: 'invalid_type' }
      ])
      const method = mock(async () => {
        throw zodError
      })
      const wrapped = withErrorHandling(method, 'User', 'creating')

      await expect(wrapped()).rejects.toThrow(ApiError)
      
      try {
        await wrapped()
      } catch (error) {
        expect((error as ApiError).status).toBe(500)
        expect((error as ApiError).code).toBe('USER_VALIDATION_ERROR')
      }
    })

    test('preserves method signature and parameters', async () => {
      const method = async (id: number, data: { name: string }) => {
        return { id, ...data }
      }
      const wrapped = withErrorHandling(method, 'User', 'updating')

      const result = await wrapped(1, { name: 'Test' })

      expect(result).toEqual({ id: 1, name: 'Test' })
    })

    test('handles methods with multiple parameters', async () => {
      const method = mock(async (a: string, b: number, c: boolean) => {
        return `${a}-${b}-${c}`
      })
      const wrapped = withErrorHandling(method, 'Test', 'processing')

      const result = await wrapped('hello', 42, true)

      expect(result).toBe('hello-42-true')
      expect(method).toHaveBeenCalledWith('hello', 42, true)
    })
  })

  describe('createCrudErrorHandlers', () => {
    let handlers: ReturnType<typeof createCrudErrorHandlers>

    beforeEach(() => {
      handlers = createCrudErrorHandlers('Product')
    })

    test('creates handleCreate handler', () => {
      const zodError = new ZodError([])
      
      expect(() => 
        handlers.handleCreate(zodError, { name: 'Test' })
      ).toThrow(ApiError)

      try {
        handlers.handleCreate(zodError, { name: 'Test' })
      } catch (error) {
        expect((error as ApiError).code).toBe('PRODUCT_VALIDATION_ERROR')
      }
    })

    test('creates handleUpdate handler', () => {
      const zodError = new ZodError([])
      
      expect(() => 
        handlers.handleUpdate(zodError, 123, { name: 'Updated' })
      ).toThrow(ApiError)
    })

    test('creates handleDelete handler', () => {
      const error = new Error('Delete failed')
      
      expect(() => 
        handlers.handleDelete(error, 456)
      ).toThrow('Delete failed')
    })

    test('creates handleGet handler', () => {
      const zodError = new ZodError([])
      
      expect(() => 
        handlers.handleGet(zodError, 'abc')
      ).toThrow(ApiError)
    })

    test('creates notFound handler', () => {
      expect(() => 
        handlers.notFound(999)
      ).toThrow(ApiError)

      try {
        handlers.notFound(999)
      } catch (error) {
        expect((error as ApiError).status).toBe(404)
        expect((error as ApiError).message).toBe('Product with ID 999 not found.')
      }
    })

    test('handles entity names with spaces', () => {
      const handlers = createCrudErrorHandlers('Order Item')
      
      try {
        handlers.notFound(123)
      } catch (error) {
        expect((error as ApiError).code).toBe('ORDER_ITEM_NOT_FOUND')
      }
    })
  })

  describe('throwApiError', () => {
    test('throws ApiError with provided parameters', () => {
      expect(() => 
        throwApiError(403, 'Forbidden', 'FORBIDDEN', { userId: 123 })
      ).toThrow(ApiError)

      try {
        throwApiError(403, 'Forbidden', 'FORBIDDEN', { userId: 123 })
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(403)
        expect((error as ApiError).message).toBe('Forbidden')
        expect((error as ApiError).code).toBe('FORBIDDEN')
        expect((error as ApiError).details).toEqual({ userId: 123 })
      }
    })

    test('works without details', () => {
      try {
        throwApiError(500, 'Server Error', 'INTERNAL_ERROR')
      } catch (error) {
        expect((error as ApiError).details).toBeUndefined()
      }
    })

    test('never returns', () => {
      let executed = false
      try {
        throwApiError(400, 'Bad', 'BAD')
        executed = true
      } catch {
        // Expected
      }
      
      expect(executed).toBe(false)
    })
  })

  describe('safeAsync', () => {
    test('returns result on successful operation', async () => {
      const operation = mock(async () => 'success')
      
      const result = await safeAsync(operation, {
        entityName: 'User',
        action: 'creating'
      })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    test('passes through ApiError unchanged', async () => {
      const apiError = new ApiError(400, 'Bad request', 'BAD_REQUEST')
      const operation = mock(async () => {
        throw apiError
      })

      await expect(
        safeAsync(operation, {
          entityName: 'User',
          action: 'creating'
        })
      ).rejects.toThrow(apiError)
    })

    test('handles ZodError with validation', async () => {
      const zodError = new ZodError([
        { path: ['email'], message: 'Invalid', code: 'invalid_string' }
      ])
      const operation = mock(async () => {
        throw zodError
      })

      await expect(
        safeAsync(operation, {
          entityName: 'User',
          action: 'creating',
          details: { email: 'invalid' }
        })
      ).rejects.toThrow(ApiError)

      try {
        await safeAsync(operation, {
          entityName: 'User',
          action: 'creating'
        })
      } catch (error) {
        expect((error as ApiError).status).toBe(500)
        expect((error as ApiError).code).toBe('USER_VALIDATION_ERROR')
      }
    })

    test('handles generic Error with fallback message', async () => {
      const operation = mock(async () => {
        throw new Error('Something went wrong')
      })

      try {
        await safeAsync(operation, {
          entityName: 'Order',
          action: 'processing',
          fallbackMessage: 'Order processing failed',
          details: { orderId: 123 }
        })
      } catch (error) {
        expect((error as ApiError).status).toBe(500)
        expect((error as ApiError).message).toBe('Order processing failed')
        expect((error as ApiError).code).toBe('ORDER_PROCESSING_FAILED')
        expect((error as ApiError).details).toEqual({ orderId: 123 })
      }
    })

    test('handles generic Error without fallback message', async () => {
      const operation = mock(async () => {
        throw new Error('Database error')
      })

      try {
        await safeAsync(operation, {
          entityName: 'Product',
          action: 'updating'
        })
      } catch (error) {
        expect((error as ApiError).message).toBe('Failed to updating Product: Database error')
      }
    })

    test('handles non-Error objects', async () => {
      const operation = mock(async () => {
        throw 'String error'
      })

      try {
        await safeAsync(operation, {
          entityName: 'Item',
          action: 'deleting'
        })
      } catch (error) {
        expect((error as ApiError).message).toBe('Failed to deleting Item: String error')
      }
    })

    test('handles null/undefined errors', async () => {
      const operation = mock(async () => {
        throw null
      })

      try {
        await safeAsync(operation, {
          entityName: 'Record',
          action: 'fetching'
        })
      } catch (error) {
        expect((error as ApiError).message).toContain('Failed to fetching Record')
      }
    })

    test('preserves operation return type', async () => {
      const operation = async () => ({ id: 1, name: 'Test' })
      
      const result = await safeAsync(operation, {
        entityName: 'User',
        action: 'fetching'
      })

      expect(result).toEqual({ id: 1, name: 'Test' })
    })

    test('handles complex entity names and actions', async () => {
      const operation = mock(async () => {
        throw new Error('Failed')
      })

      try {
        await safeAsync(operation, {
          entityName: 'User Profile Settings',
          action: 'bulk updating'
        })
      } catch (error) {
        expect((error as ApiError).code).toBe('USER_PROFILE_SETTINGS_BULK_UPDATING_FAILED')
      }
    })
  })
})