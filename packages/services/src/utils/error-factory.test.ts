import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import { ZodError, z } from 'zod'
import {
  ErrorFactory,
  createEntityErrorFactory,
  withErrorContext,
  assert,
  assertExists,
  assertRequiredFields,
  assertDatabaseOperation,
  assertUpdateSucceeded,
  assertDeleteSucceeded,
  handleZodError
} from './error-factory'

describe('error-factory', () => {
  describe('ErrorFactory', () => {
    describe('notFound', () => {
      test('creates not found error with string id', () => {
        expect(() => ErrorFactory.notFound('User', 'abc123')).toThrow(ApiError)
        
        try {
          ErrorFactory.notFound('User', 'abc123')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(404)
          expect(error.message).toBe('User with ID abc123 not found')
          expect(error.code).toBe('USER_NOT_FOUND')
        }
      })

      test('creates not found error with number id', () => {
        try {
          ErrorFactory.notFound('Project', 123)
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(404)
          expect(error.message).toBe('Project with ID 123 not found')
          expect(error.code).toBe('PROJECT_NOT_FOUND')
        }
      })

      test('handles multi-word entity names', () => {
        try {
          ErrorFactory.notFound('Task Item', 456)
        } catch (error) {
          expect(error.code).toBe('TASK_ITEM_NOT_FOUND')
        }
      })

      test('handles entity names with special characters', () => {
        try {
          ErrorFactory.notFound('User-Profile', 789)
        } catch (error) {
          expect(error.code).toBe('USER-PROFILE_NOT_FOUND')
        }
      })
    })

    describe('validationFailed', () => {
      test('creates validation error without details', () => {
        try {
          ErrorFactory.validationFailed('User')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(400)
          expect(error.message).toBe('Validation failed for User')
          expect(error.code).toBe('VALIDATION_ERROR')
          expect(error.details).toBeUndefined()
        }
      })

      test('creates validation error with details', () => {
        const validationDetails = { email: 'Invalid format', age: 'Must be positive' }
        
        try {
          ErrorFactory.validationFailed('User', validationDetails)
        } catch (error) {
          expect(error.details).toEqual(validationDetails)
        }
      })

      test('handles null and undefined details', () => {
        try {
          ErrorFactory.validationFailed('User', null)
        } catch (error) {
          expect(error.details).toBeNull()
        }

        try {
          ErrorFactory.validationFailed('User', undefined)
        } catch (error) {
          expect(error.details).toBeUndefined()
        }
      })
    })

    describe('operationFailed', () => {
      test('creates operation failed error with default message', () => {
        try {
          ErrorFactory.operationFailed('save data')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(500)
          expect(error.message).toBe("Operation 'save data' failed")
          expect(error.code).toBe('SAVE_DATA_FAILED')
        }
      })

      test('creates operation failed error with custom reason', () => {
        try {
          ErrorFactory.operationFailed('delete file', 'File is locked')
        } catch (error) {
          expect(error.message).toBe('File is locked')
          expect(error.code).toBe('DELETE_FILE_FAILED')
        }
      })

      test('handles multi-word operations', () => {
        try {
          ErrorFactory.operationFailed('sync user data')
        } catch (error) {
          expect(error.code).toBe('SYNC_USER_DATA_FAILED')
        }
      })

      test('handles operations with special characters', () => {
        try {
          ErrorFactory.operationFailed('backup-restore')
        } catch (error) {
          expect(error.code).toBe('BACKUP-RESTORE_FAILED')
        }
      })
    })

    describe('permissionDenied', () => {
      test('creates permission denied error', () => {
        try {
          ErrorFactory.permissionDenied('admin panel', 'access')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(403)
          expect(error.message).toBe('Permission denied: Cannot access admin panel')
          expect(error.code).toBe('PERMISSION_DENIED')
        }
      })

      test('handles various action verbs', () => {
        try {
          ErrorFactory.permissionDenied('file', 'delete')
        } catch (error) {
          expect(error.message).toBe('Permission denied: Cannot delete file')
        }

        try {
          ErrorFactory.permissionDenied('user account', 'modify')
        } catch (error) {
          expect(error.message).toBe('Permission denied: Cannot modify user account')
        }
      })
    })

    describe('duplicate', () => {
      test('creates duplicate entity error', () => {
        try {
          ErrorFactory.duplicate('User', 'email', 'test@example.com')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(409)
          expect(error.message).toBe("User with email 'test@example.com' already exists")
          expect(error.code).toBe('DUPLICATE_ENTITY')
          expect(error.details).toEqual({ field: 'email', value: 'test@example.com' })
        }
      })

      test('handles numeric values', () => {
        try {
          ErrorFactory.duplicate('Project', 'id', 123)
        } catch (error) {
          expect(error.message).toBe("Project with id '123' already exists")
          expect(error.details).toEqual({ field: 'id', value: 123 })
        }
      })

      test('handles object values', () => {
        const config = { theme: 'dark', lang: 'en' }
        
        try {
          ErrorFactory.duplicate('Settings', 'config', config)
        } catch (error) {
          expect(error.details).toEqual({ field: 'config', value: config })
        }
      })
    })

    describe('invalidState', () => {
      test('creates invalid state error', () => {
        try {
          ErrorFactory.invalidState('Task', 'completed', 'edit')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(400)
          expect(error.message).toBe('Cannot edit Task in current state: completed')
          expect(error.code).toBe('INVALID_STATE')
          expect(error.details).toEqual({ currentState: 'completed', attemptedAction: 'edit' })
        }
      })

      test('handles various states and actions', () => {
        try {
          ErrorFactory.invalidState('Order', 'shipped', 'cancel')
        } catch (error) {
          expect(error.message).toBe('Cannot cancel Order in current state: shipped')
        }
      })
    })

    describe('missingRequired', () => {
      test('creates missing required field error without context', () => {
        try {
          ErrorFactory.missingRequired('email')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(400)
          expect(error.message).toBe('Missing required field: email')
          expect(error.code).toBe('MISSING_REQUIRED_FIELD')
          expect(error.details).toEqual({ field: 'email', context: undefined })
        }
      })

      test('creates missing required field error with context', () => {
        try {
          ErrorFactory.missingRequired('password', 'user registration')
        } catch (error) {
          expect(error.message).toBe('Missing required field: password in user registration')
          expect(error.details).toEqual({ field: 'password', context: 'user registration' })
        }
      })
    })

    describe('invalidParam', () => {
      test('creates invalid parameter error without received value', () => {
        try {
          ErrorFactory.invalidParam('limit', 'positive integer')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(400)
          expect(error.message).toBe("Invalid parameter 'limit': expected positive integer")
          expect(error.code).toBe('INVALID_PARAMETER')
          expect(error.details).toEqual({ param: 'limit', expected: 'positive integer', received: undefined })
        }
      })

      test('creates invalid parameter error with received value', () => {
        try {
          ErrorFactory.invalidParam('age', 'number', 'not a number')
        } catch (error) {
          expect(error.message).toBe("Invalid parameter 'age': expected number, got string")
          expect(error.details).toEqual({ param: 'age', expected: 'number', received: 'not a number' })
        }
      })

      test('handles various types of received values', () => {
        try {
          ErrorFactory.invalidParam('config', 'object', null)
        } catch (error) {
          expect(error.message).toBe("Invalid parameter 'config': expected object, got object")
        }

        try {
          ErrorFactory.invalidParam('items', 'array', 123)
        } catch (error) {
          expect(error.message).toBe("Invalid parameter 'items': expected array, got number")
        }
      })
    })

    describe('resourceBusy', () => {
      test('creates resource busy error without operation', () => {
        try {
          ErrorFactory.resourceBusy('database')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(423)
          expect(error.message).toBe('database is currently busy')
          expect(error.code).toBe('RESOURCE_BUSY')
        }
      })

      test('creates resource busy error with operation', () => {
        try {
          ErrorFactory.resourceBusy('file system', 'perform backup')
        } catch (error) {
          expect(error.message).toBe('file system is currently busy and cannot perform backup')
        }
      })
    })

    describe('batchFailed', () => {
      test('creates batch operation failed error', () => {
        const failures = [
          { id: 1, error: 'Invalid data' },
          { id: 2, error: 'Missing field' }
        ]
        
        try {
          ErrorFactory.batchFailed('update', failures)
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(400)
          expect(error.message).toBe('Batch update failed for 2 items')
          expect(error.code).toBe('BATCH_OPERATION_FAILED')
          expect(error.details).toEqual({ failures })
        }
      })

      test('handles empty failures array', () => {
        try {
          ErrorFactory.batchFailed('delete', [])
        } catch (error) {
          expect(error.message).toBe('Batch delete failed for 0 items')
        }
      })
    })

    describe('databaseError', () => {
      test('creates database error without details', () => {
        try {
          ErrorFactory.databaseError('SELECT query')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(500)
          expect(error.message).toBe('Database operation failed: SELECT query')
          expect(error.code).toBe('DATABASE_ERROR')
          expect(error.details).toEqual({ operation: 'SELECT query', details: undefined })
        }
      })

      test('creates database error with details', () => {
        try {
          ErrorFactory.databaseError('INSERT user', 'Unique constraint violation')
        } catch (error) {
          expect(error.message).toBe('Database operation failed: INSERT user - Unique constraint violation')
          expect(error.details).toEqual({ operation: 'INSERT user', details: 'Unique constraint violation' })
        }
      })
    })

    describe('fileSystemError', () => {
      test('creates file system error without details', () => {
        try {
          ErrorFactory.fileSystemError('read', '/path/to/file.txt')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(500)
          expect(error.message).toBe("File system operation failed: read at '/path/to/file.txt'")
          expect(error.code).toBe('FILE_SYSTEM_ERROR')
          expect(error.details).toEqual({ operation: 'read', path: '/path/to/file.txt', details: undefined })
        }
      })

      test('creates file system error with details', () => {
        try {
          ErrorFactory.fileSystemError('write', '/tmp/output.log', 'Permission denied')
        } catch (error) {
          expect(error.message).toBe("File system operation failed: write at '/tmp/output.log' - Permission denied")
          expect(error.details).toEqual({ operation: 'write', path: '/tmp/output.log', details: 'Permission denied' })
        }
      })
    })

    describe('internalValidation', () => {
      test('creates internal validation error without details', () => {
        try {
          ErrorFactory.internalValidation('User', 'create')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(500)
          expect(error.message).toBe('Internal validation failed for User during create')
          expect(error.code).toBe('INTERNAL_VALIDATION_ERROR')
          expect(error.details).toEqual({ entity: 'User', operation: 'create', details: undefined })
        }
      })

      test('creates internal validation error with details', () => {
        const validationDetails = { field: 'email', issue: 'format' }
        
        try {
          ErrorFactory.internalValidation('User', 'update', validationDetails)
        } catch (error) {
          expect(error.details).toEqual({ entity: 'User', operation: 'update', details: validationDetails })
        }
      })
    })

    describe('updateFailed', () => {
      test('creates update failed error without reason', () => {
        try {
          ErrorFactory.updateFailed('User', 123)
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(500)
          expect(error.message).toBe('Failed to update User 123')
          expect(error.code).toBe('USER_UPDATE_FAILED')
          expect(error.details).toEqual({ id: 123, reason: undefined })
        }
      })

      test('creates update failed error with reason', () => {
        try {
          ErrorFactory.updateFailed('Project', 'abc456', 'Concurrent modification detected')
        } catch (error) {
          expect(error.message).toBe('Failed to update Project abc456: Concurrent modification detected')
          expect(error.details).toEqual({ id: 'abc456', reason: 'Concurrent modification detected' })
        }
      })

      test('handles multi-word entities', () => {
        try {
          ErrorFactory.updateFailed('User Profile', 789)
        } catch (error) {
          expect(error.code).toBe('USER_PROFILE_UPDATE_FAILED')
        }
      })
    })

    describe('deleteFailed', () => {
      test('creates delete failed error without reason', () => {
        try {
          ErrorFactory.deleteFailed('Task', 456)
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(500)
          expect(error.message).toBe('Failed to delete Task 456')
          expect(error.code).toBe('TASK_DELETE_FAILED')
          expect(error.details).toEqual({ id: 456, reason: undefined })
        }
      })

      test('creates delete failed error with reason', () => {
        try {
          ErrorFactory.deleteFailed('Queue', 'queue123', 'Still contains active items')
        } catch (error) {
          expect(error.message).toBe('Failed to delete Queue queue123: Still contains active items')
          expect(error.details).toEqual({ id: 'queue123', reason: 'Still contains active items' })
        }
      })
    })

    describe('createFailed', () => {
      test('creates create failed error without reason', () => {
        try {
          ErrorFactory.createFailed('Ticket')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(500)
          expect(error.message).toBe('Failed to create Ticket')
          expect(error.code).toBe('TICKET_CREATE_FAILED')
          expect(error.details).toEqual({ reason: undefined })
        }
      })

      test('creates create failed error with reason', () => {
        try {
          ErrorFactory.createFailed('User', 'Email already exists')
        } catch (error) {
          expect(error.message).toBe('Failed to create User: Email already exists')
          expect(error.details).toEqual({ reason: 'Email already exists' })
        }
      })
    })

    describe('invalidRelationship', () => {
      test('creates invalid relationship error', () => {
        try {
          ErrorFactory.invalidRelationship('Task', 123, 'Project', 456)
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(400)
          expect(error.message).toBe('Task 123 does not belong to Project 456')
          expect(error.code).toBe('INVALID_RELATIONSHIP')
          expect(error.details).toEqual({
            childEntity: 'Task',
            childId: 123,
            parentEntity: 'Project',
            parentId: 456
          })
        }
      })

      test('handles string IDs', () => {
        try {
          ErrorFactory.invalidRelationship('Comment', 'c789', 'Post', 'p123')
        } catch (error) {
          expect(error.message).toBe('Comment c789 does not belong to Post p123')
          expect(error.details).toEqual({
            childEntity: 'Comment',
            childId: 'c789',
            parentEntity: 'Post',
            parentId: 'p123'
          })
        }
      })
    })
  })

  describe('createEntityErrorFactory', () => {
    test('creates entity-specific error factory', () => {
      const userErrors = createEntityErrorFactory('User')
      
      expect(typeof userErrors.notFound).toBe('function')
      expect(typeof userErrors.validationFailed).toBe('function')
      expect(typeof userErrors.duplicate).toBe('function')
      expect(typeof userErrors.invalidState).toBe('function')
      expect(typeof userErrors.permissionDenied).toBe('function')
      expect(typeof userErrors.updateFailed).toBe('function')
      expect(typeof userErrors.deleteFailed).toBe('function')
      expect(typeof userErrors.createFailed).toBe('function')
      expect(typeof userErrors.internalValidation).toBe('function')
    })

    test('entity-specific notFound method works correctly', () => {
      const projectErrors = createEntityErrorFactory('Project')
      
      try {
        projectErrors.notFound(123)
      } catch (error) {
        expect(error.message).toBe('Project with ID 123 not found')
        expect(error.code).toBe('PROJECT_NOT_FOUND')
      }
    })

    test('entity-specific validationFailed method works correctly', () => {
      const taskErrors = createEntityErrorFactory('Task')
      const details = { title: 'Required' }
      
      try {
        taskErrors.validationFailed(details)
      } catch (error) {
        expect(error.message).toBe('Validation failed for Task')
        expect(error.details).toBe(details)
      }
    })

    test('entity-specific duplicate method works correctly', () => {
      const userErrors = createEntityErrorFactory('User')
      
      try {
        userErrors.duplicate('email', 'test@example.com')
      } catch (error) {
        expect(error.message).toBe("User with email 'test@example.com' already exists")
      }
    })

    test('entity-specific invalidState method works correctly', () => {
      const orderErrors = createEntityErrorFactory('Order')
      
      try {
        orderErrors.invalidState('shipped', 'cancel')
      } catch (error) {
        expect(error.message).toBe('Cannot cancel Order in current state: shipped')
      }
    })

    test('entity-specific permissionDenied method works correctly', () => {
      const fileErrors = createEntityErrorFactory('File')
      
      try {
        fileErrors.permissionDenied('delete')
      } catch (error) {
        expect(error.message).toBe('Permission denied: Cannot delete File')
      }
    })

    test('entity-specific CRUD methods work correctly', () => {
      const ticketErrors = createEntityErrorFactory('Ticket')
      
      try {
        ticketErrors.updateFailed(456, 'Locked by another user')
      } catch (error) {
        expect(error.message).toBe('Failed to update Ticket 456: Locked by another user')
      }

      try {
        ticketErrors.deleteFailed('t789')
      } catch (error) {
        expect(error.message).toBe('Failed to delete Ticket t789')
      }

      try {
        ticketErrors.createFailed('Invalid priority')
      } catch (error) {
        expect(error.message).toBe('Failed to create Ticket: Invalid priority')
      }
    })

    test('entity-specific internalValidation method works correctly', () => {
      const queueErrors = createEntityErrorFactory('Queue')
      const details = { schema: 'validation failed' }
      
      try {
        queueErrors.internalValidation('process', details)
      } catch (error) {
        expect(error.message).toBe('Internal validation failed for Queue during process')
        expect(error.details).toEqual({ entity: 'Queue', operation: 'process', details })
      }
    })
  })

  describe('withErrorContext', () => {
    test('returns result when operation succeeds', async () => {
      const operation = mock(() => Promise.resolve('success'))
      const context = { entity: 'User', action: 'create', id: 123 }
      
      const result = await withErrorContext(operation, context)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    test('re-throws ApiError without wrapping', async () => {
      const apiError = new ApiError(404, 'Not found', 'NOT_FOUND')
      const operation = mock(() => Promise.reject(apiError))
      const context = { entity: 'User' }
      
      await expect(withErrorContext(operation, context)).rejects.toThrow(apiError)
    })

    test('wraps non-ApiError with context', async () => {
      const originalError = new Error('Database connection failed')
      const operation = mock(() => Promise.reject(originalError))
      const context = { entity: 'User', action: 'create', id: 123 }
      
      try {
        await withErrorContext(operation, context)
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(500)
        expect(error.message).toBe('Operation failed (Entity: User, Action: create, ID: 123): Database connection failed')
        expect(error.code).toBe('OPERATION_ERROR')
        expect(error.details).toEqual({
          originalError: 'Database connection failed',
          entity: 'User',
          action: 'create',
          id: 123
        })
      }
    })

    test('handles partial context information', async () => {
      const operation = mock(() => Promise.reject(new Error('Failed')))
      
      // Only entity
      try {
        await withErrorContext(operation, { entity: 'Project' })
      } catch (error) {
        expect(error.message).toBe('Operation failed (Entity: Project): Failed')
      }

      // Only action
      try {
        await withErrorContext(operation, { action: 'delete' })
      } catch (error) {
        expect(error.message).toBe('Operation failed (Action: delete): Failed')
      }

      // Only id
      try {
        await withErrorContext(operation, { id: 456 })
      } catch (error) {
        expect(error.message).toBe('Operation failed (ID: 456): Failed')
      }
    })

    test('handles empty context', async () => {
      const operation = mock(() => Promise.reject(new Error('System error')))
      
      try {
        await withErrorContext(operation, {})
      } catch (error) {
        expect(error.message).toBe('Operation failed: System error')
      }
    })

    test('handles non-Error objects', async () => {
      const operation = mock(() => Promise.reject('String error'))
      const context = { entity: 'File' }
      
      try {
        await withErrorContext(operation, context)
      } catch (error) {
        expect(error.message).toBe('Operation failed (Entity: File): Unknown error')
        expect(error.details.originalError).toBe('Unknown error')
      }
    })

    test('handles null/undefined rejections', async () => {
      const operation1 = mock(() => Promise.reject(null))
      const operation2 = mock(() => Promise.reject(undefined))
      
      try {
        await withErrorContext(operation1, { entity: 'Test' })
      } catch (error) {
        expect(error.message).toBe('Operation failed (Entity: Test): Unknown error')
        expect(error.details.originalError).toBe('Unknown error')
      }

      try {
        await withErrorContext(operation2, { entity: 'Test' })
      } catch (error) {
        expect(error.message).toBe('Operation failed (Entity: Test): Unknown error')
        expect(error.details.originalError).toBe('Unknown error')
      }
    })
  })

  describe('assert', () => {
    test('passes when condition is truthy', () => {
      expect(() => assert(true, 'Should not throw')).not.toThrow()
      expect(() => assert('non-empty string', 'Should not throw')).not.toThrow()
      expect(() => assert(42, 'Should not throw')).not.toThrow()
      expect(() => assert({}, 'Should not throw')).not.toThrow()
      expect(() => assert([], 'Should not throw')).not.toThrow()
    })

    test('throws ApiError when condition is falsy with string error', () => {
      expect(() => assert(false, 'Condition failed')).toThrow(ApiError)
      expect(() => assert(0, 'Zero is falsy')).toThrow(ApiError)
      expect(() => assert('', 'Empty string')).toThrow(ApiError)
      expect(() => assert(null, 'Null value')).toThrow(ApiError)
      expect(() => assert(undefined, 'Undefined value')).toThrow(ApiError)
      
      try {
        assert(false, 'Custom assertion message')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(400)
        expect(error.message).toBe('Custom assertion message')
        expect(error.code).toBe('ASSERTION_FAILED')
      }
    })

    test('throws provided ApiError when condition is falsy', () => {
      const customError = new ApiError(422, 'Custom error', 'CUSTOM_CODE', { extra: 'data' })
      
      try {
        assert(false, customError)
      } catch (error) {
        expect(error).toBe(customError)
        expect(error.status).toBe(422)
        expect(error.message).toBe('Custom error')
        expect(error.code).toBe('CUSTOM_CODE')
        expect(error.details).toEqual({ extra: 'data' })
      }
    })

    test('provides correct type assertion behavior', () => {
      // This is more of a TypeScript compile-time test, but we can verify runtime behavior
      const value: string | null = 'test'
      
      // This should not throw and should allow access to string methods
      assert(value, 'Value should exist')
      expect(value.length).toBe(4) // This line would fail to compile if assertion didn't work
    })
  })

  describe('assertExists', () => {
    test('passes when entity exists', () => {
      const user = { id: 1, name: 'John' }
      
      expect(() => assertExists(user, 'User', 1)).not.toThrow()
      
      // Should allow access to properties after assertion
      assertExists(user, 'User', 1)
      expect(user.id).toBe(1)
      expect(user.name).toBe('John')
    })

    test('throws when entity is null', () => {
      try {
        assertExists(null, 'User', 123)
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(404)
        expect(error.message).toBe('User with ID 123 not found')
        expect(error.code).toBe('USER_NOT_FOUND')
      }
    })

    test('throws when entity is undefined', () => {
      try {
        assertExists(undefined, 'Project', 'abc456')
      } catch (error) {
        expect(error.message).toBe('Project with ID abc456 not found')
      }
    })

    test('handles various entity types', () => {
      const emptyObject = {}
      const emptyArray: any[] = []
      const zeroNumber = 0
      const emptyString = ''
      const falseBoolean = false
      
      // These should not throw (they are truthy or have content)
      expect(() => assertExists(emptyObject, 'Config', 1)).not.toThrow()
      expect(() => assertExists(emptyArray, 'List', 2)).not.toThrow()
      
      // These should throw (0, '', false are falsy)
      expect(() => assertExists(zeroNumber, 'Counter', 3)).toThrow()
      expect(() => assertExists(emptyString, 'Text', 4)).toThrow()
      expect(() => assertExists(falseBoolean, 'Flag', 5)).toThrow()
    })

    test('provides correct type assertion behavior', () => {
      const maybeUser: { id: number; name: string } | null = { id: 1, name: 'Test' }
      
      assertExists(maybeUser, 'User', 1)
      // After assertion, TypeScript should know maybeUser is not null
      expect(maybeUser.id).toBe(1)
      expect(maybeUser.name).toBe('Test')
    })
  })

  describe('assertRequiredFields', () => {
    test('passes when all required fields are present', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        age: 30,
        isActive: true
      }
      
      expect(() => assertRequiredFields(data, ['name', 'email' as keyof typeof data], 'user creation')).not.toThrow()
      expect(() => assertRequiredFields(data, ['name', 'email', 'age' as keyof typeof data])).not.toThrow()
      expect(() => assertRequiredFields(data, [])).not.toThrow() // No required fields
    })

    test('throws when required field is undefined', () => {
      const data = { name: 'John', email: undefined }
      
      try {
        assertRequiredFields(data, ['name', 'email' as keyof typeof data], 'registration')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(400)
        expect(error.message).toBe('Missing required field: email in registration')
        expect(error.code).toBe('MISSING_REQUIRED_FIELD')
        expect(error.details).toEqual({ field: 'email', context: 'registration' })
      }
    })

    test('throws when required field is null', () => {
      const data = { name: 'John', age: null }
      
      try {
        assertRequiredFields(data, ['name', 'age' as keyof typeof data])
      } catch (error) {
        expect(error.message).toBe('Missing required field: age')
        expect(error.details).toEqual({ field: 'age', context: undefined })
      }
    })

    test('throws on first missing field encountered', () => {
      const data = { name: 'John' } // missing email and age
      
      try {
        assertRequiredFields(data, ['name', 'email', 'age' as keyof typeof data], 'validation')
      } catch (error) {
        // Should throw for 'email' first
        expect(error.message).toBe('Missing required field: email in validation')
        expect(error.details.field).toBe('email')
      }
    })

    test('accepts falsy but defined values', () => {
      const data = {
        name: '',          // empty string
        age: 0,           // zero
        isActive: false,  // false boolean
        score: null,      // This should fail
        description: undefined // This should fail
      }
      
      // These should pass (empty string, zero, false are valid values)
      expect(() => assertRequiredFields(data, ['name', 'age', 'isActive' as keyof typeof data])).not.toThrow()
      
      // This should fail on null
      try {
        assertRequiredFields(data, ['score' as keyof typeof data])
      } catch (error) {
        expect(error.details.field).toBe('score')
      }
      
      // This should fail on undefined
      try {
        assertRequiredFields(data, ['description' as keyof typeof data])
      } catch (error) {
        expect(error.details.field).toBe('description')
      }
    })

    test('handles nested field references', () => {
      const data = {
        'user.name': 'John',
        'settings.theme': undefined
      }
      
      try {
        assertRequiredFields(data, ['user.name', 'settings.theme' as keyof typeof data], 'config update')
      } catch (error) {
        expect(error.message).toBe('Missing required field: settings.theme in config update')
      }
    })

    test('works without context parameter', () => {
      const data = { name: 'John' }
      
      try {
        assertRequiredFields(data, ['email' as keyof typeof data])
      } catch (error) {
        expect(error.message).toBe('Missing required field: email')
        expect(error.details).toEqual({ field: 'email', context: undefined })
      }
    })
  })

  describe('assertDatabaseOperation', () => {
    test('passes when result is truthy', () => {
      const result = { id: 1, name: 'Test' }
      
      expect(() => assertDatabaseOperation(result, 'SELECT user')).not.toThrow()
      
      // Result should be accessible after assertion
      assertDatabaseOperation(result, 'SELECT user')
      expect(result.id).toBe(1)
    })

    test('passes for falsy but defined values', () => {
      expect(() => assertDatabaseOperation(0, 'COUNT query')).not.toThrow()
      expect(() => assertDatabaseOperation('', 'SELECT text')).not.toThrow()
      expect(() => assertDatabaseOperation(false, 'EXISTS check')).not.toThrow()
      expect(() => assertDatabaseOperation([], 'SELECT array')).not.toThrow()
    })

    test('throws when result is null', () => {
      try {
        assertDatabaseOperation(null, 'INSERT user')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(500)
        expect(error.message).toBe('Database operation failed: INSERT user')
        expect(error.code).toBe('DATABASE_ERROR')
        expect(error.details).toEqual({ operation: 'INSERT user', details: undefined })
      }
    })

    test('throws when result is undefined', () => {
      try {
        assertDatabaseOperation(undefined, 'UPDATE project', 'Connection timeout')
      } catch (error) {
        expect(error.message).toBe('Database operation failed: UPDATE project - Connection timeout')
        expect(error.details).toEqual({ operation: 'UPDATE project', details: 'Connection timeout' })
      }
    })

    test('includes details in error when provided', () => {
      try {
        assertDatabaseOperation(null, 'DELETE task', 'Foreign key constraint violation')
      } catch (error) {
        expect(error.message).toBe('Database operation failed: DELETE task - Foreign key constraint violation')
        expect(error.details).toEqual({ operation: 'DELETE task', details: 'Foreign key constraint violation' })
      }
    })

    test('provides correct type assertion behavior', () => {
      const maybeResult: { data: string } | null = { data: 'test' }
      
      assertDatabaseOperation(maybeResult, 'query')
      // TypeScript should know result is not null after assertion
      expect(maybeResult.data).toBe('test')
    })
  })

  describe('assertUpdateSucceeded', () => {
    test('passes when result is truthy boolean', () => {
      expect(() => assertUpdateSucceeded(true, 'User', 123)).not.toThrow()
    })

    test('passes when result is positive number', () => {
      expect(() => assertUpdateSucceeded(1, 'Project', 'abc456')).not.toThrow()
      expect(() => assertUpdateSucceeded(5, 'Task', 789)).not.toThrow()
    })

    test('throws when result is false', () => {
      try {
        assertUpdateSucceeded(false, 'User', 123)
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(500)
        expect(error.message).toBe('Failed to update User 123: Update operation returned false/0')
        expect(error.code).toBe('USER_UPDATE_FAILED')
        expect(error.details).toEqual({ id: 123, reason: 'Update operation returned false/0' })
      }
    })

    test('throws when result is zero', () => {
      try {
        assertUpdateSucceeded(0, 'Task', 'task789')
      } catch (error) {
        expect(error.message).toBe('Failed to update Task task789: Update operation returned false/0')
        expect(error.code).toBe('TASK_UPDATE_FAILED')
        expect(error.details).toEqual({ id: 'task789', reason: 'Update operation returned false/0' })
      }
    })

    test('handles multi-word entity names', () => {
      try {
        assertUpdateSucceeded(false, 'User Profile', 456)
      } catch (error) {
        expect(error.code).toBe('USER_PROFILE_UPDATE_FAILED')
      }
    })

    test('handles entities with special characters', () => {
      try {
        assertUpdateSucceeded(0, 'API-Key', 'key123')
      } catch (error) {
        expect(error.code).toBe('API-KEY_UPDATE_FAILED')
      }
    })
  })

  describe('assertDeleteSucceeded', () => {
    test('passes when result is truthy boolean', () => {
      expect(() => assertDeleteSucceeded(true, 'User', 123)).not.toThrow()
    })

    test('passes when result is positive number', () => {
      expect(() => assertDeleteSucceeded(1, 'Project', 'abc456')).not.toThrow()
      expect(() => assertDeleteSucceeded(3, 'Task', 789)).not.toThrow()
    })

    test('throws when result is false', () => {
      try {
        assertDeleteSucceeded(false, 'Queue', 456)
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(500)
        expect(error.message).toBe('Failed to delete Queue 456: Delete operation returned false/0')
        expect(error.code).toBe('QUEUE_DELETE_FAILED')
        expect(error.details).toEqual({ id: 456, reason: 'Delete operation returned false/0' })
      }
    })

    test('throws when result is zero', () => {
      try {
        assertDeleteSucceeded(0, 'Prompt', 'prompt123')
      } catch (error) {
        expect(error.message).toBe('Failed to delete Prompt prompt123: Delete operation returned false/0')
        expect(error.code).toBe('PROMPT_DELETE_FAILED')
      }
    })

    test('handles multi-word entity names', () => {
      try {
        assertDeleteSucceeded(false, 'Chat Message', 789)
      } catch (error) {
        expect(error.code).toBe('CHAT_MESSAGE_DELETE_FAILED')
      }
    })
  })

  describe('handleZodError', () => {
    test('throws internal validation error for ZodError', () => {
      // Create a mock ZodError
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number'
        },
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          path: ['name'],
          message: 'String must contain at least 1 character(s)'
        }
      ])
      
      try {
        handleZodError(zodError, 'User', 'create')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(500)
        expect(error.message).toBe('Internal validation failed for User during create')
        expect(error.code).toBe('INTERNAL_VALIDATION_ERROR')
        expect(error.details).toEqual({
          entity: 'User',
          operation: 'create',
          details: {
            email: ['Expected string, received number'],
            name: ['String must contain at least 1 character(s)']
          }
        })
      }
    })

    test('throws internal validation error with complex nested paths', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['user', 'profile', 'name'],
          message: 'Required'
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'string',
          path: ['settings', 0, 'value'],
          message: 'Expected number, received string'
        }
      ])
      
      try {
        handleZodError(zodError, 'Configuration', 'update')
      } catch (error) {
        // ZodError.flatten() only shows the first level of the path
        expect(error.details.details).toHaveProperty('user')
        expect(error.details.details).toHaveProperty('settings')
        expect(error.details.details['user']).toContain('Required')
        expect(error.details.details['settings']).toContain('Expected number, received string')
      }
    })

    test('re-throws non-ZodError objects', () => {
      const customError = new Error('Not a ZodError')
      const apiError = new ApiError(400, 'Custom API Error')
      const stringError = 'String error'
      
      expect(() => handleZodError(customError, 'User', 'validate')).toThrow(customError)
      expect(() => handleZodError(apiError, 'User', 'validate')).toThrow(apiError)
      expect(() => handleZodError(stringError, 'User', 'validate')).toThrow(stringError)
    })

    test('handles error objects without name property', () => {
      const fakeError = { message: 'Fake error without name' }
      
      expect(() => handleZodError(fakeError, 'User', 'test')).toThrow(fakeError)
    })

    test('handles error objects with wrong name', () => {
      const fakeError = { name: 'ValidationError', message: 'Not a ZodError' }
      
      expect(() => handleZodError(fakeError, 'User', 'test')).toThrow(fakeError)
    })

    test('handles ZodError with empty issues array', () => {
      const emptyZodError = new ZodError([])
      
      try {
        handleZodError(emptyZodError, 'User', 'validate')
      } catch (error) {
        expect(error.details.details).toEqual({})
      }
    })

    test('creates ZodError and validates handling', () => {
      // Test with actual Zod schema to ensure realistic error structure
      const userSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().positive()
      })
      
      const invalidData = {
        name: '',
        email: 'invalid-email',
        age: -5
      }
      
      try {
        userSchema.parse(invalidData)
      } catch (zodError) {
        try {
          handleZodError(zodError, 'User', 'registration')
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.status).toBe(500)
          expect(error.code).toBe('INTERNAL_VALIDATION_ERROR')
          expect(error.details.entity).toBe('User')
          expect(error.details.operation).toBe('registration')
          expect(error.details.details).toHaveProperty('name')
          expect(error.details.details).toHaveProperty('email')
          expect(error.details.details).toHaveProperty('age')
        }
      }
    })
  })

  describe('edge cases and integration', () => {
    test('error factory methods create unique error codes', () => {
      const errors = [
        () => ErrorFactory.notFound('User', 1),
        () => ErrorFactory.validationFailed('User'),
        () => ErrorFactory.operationFailed('test'),
        () => ErrorFactory.permissionDenied('resource', 'action'),
        () => ErrorFactory.duplicate('User', 'email', 'test'),
        () => ErrorFactory.invalidState('Task', 'done', 'edit'),
        () => ErrorFactory.missingRequired('field'),
        () => ErrorFactory.invalidParam('param', 'type'),
        () => ErrorFactory.resourceBusy('resource'),
        () => ErrorFactory.batchFailed('operation', []),
        () => ErrorFactory.databaseError('query'),
        () => ErrorFactory.fileSystemError('read', 'path'),
        () => ErrorFactory.internalValidation('entity', 'op'),
        () => ErrorFactory.updateFailed('User', 1),
        () => ErrorFactory.deleteFailed('User', 1),
        () => ErrorFactory.createFailed('User'),
        () => ErrorFactory.invalidRelationship('child', 1, 'parent', 2)
      ]
      
      const codes = new Set()
      
      errors.forEach(errorFactory => {
        try {
          errorFactory()
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error.code).toBeTruthy()
          expect(codes.has(error.code)).toBe(false) // Ensure uniqueness
          codes.add(error.code)
        }
      })
      
      expect(codes.size).toBe(errors.length)
    })

    test('all error factory methods throw ApiError instances', () => {
      const errorFactories = [
        () => ErrorFactory.notFound('Test', 1),
        () => ErrorFactory.validationFailed('Test'),
        () => ErrorFactory.operationFailed('test'),
        () => ErrorFactory.permissionDenied('test', 'action'),
        () => ErrorFactory.duplicate('Test', 'field', 'value'),
        () => ErrorFactory.invalidState('Test', 'state', 'action'),
        () => ErrorFactory.missingRequired('field'),
        () => ErrorFactory.invalidParam('param', 'type'),
        () => ErrorFactory.resourceBusy('resource'),
        () => ErrorFactory.batchFailed('op', []),
        () => ErrorFactory.databaseError('query'),
        () => ErrorFactory.fileSystemError('read', 'path'),
        () => ErrorFactory.internalValidation('Test', 'op'),
        () => ErrorFactory.updateFailed('Test', 1),
        () => ErrorFactory.deleteFailed('Test', 1),
        () => ErrorFactory.createFailed('Test'),
        () => ErrorFactory.invalidRelationship('child', 1, 'parent', 2)
      ]
      
      errorFactories.forEach(factory => {
        try {
          factory()
          expect(true).toBe(false) // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect(typeof error.status).toBe('number')
          expect(typeof error.message).toBe('string')
          expect(typeof error.code).toBe('string')
          expect(error.message.length).toBeGreaterThan(0)
          expect(error.code.length).toBeGreaterThan(0)
        }
      })
    })

    test('status codes are appropriate for error types', () => {
      const errorChecks = [
        { factory: () => ErrorFactory.notFound('Test', 1), expectedStatus: 404 },
        { factory: () => ErrorFactory.validationFailed('Test'), expectedStatus: 400 },
        { factory: () => ErrorFactory.operationFailed('test'), expectedStatus: 500 },
        { factory: () => ErrorFactory.permissionDenied('test', 'action'), expectedStatus: 403 },
        { factory: () => ErrorFactory.duplicate('Test', 'field', 'value'), expectedStatus: 409 },
        { factory: () => ErrorFactory.invalidState('Test', 'state', 'action'), expectedStatus: 400 },
        { factory: () => ErrorFactory.missingRequired('field'), expectedStatus: 400 },
        { factory: () => ErrorFactory.invalidParam('param', 'type'), expectedStatus: 400 },
        { factory: () => ErrorFactory.resourceBusy('resource'), expectedStatus: 423 },
        { factory: () => ErrorFactory.batchFailed('op', []), expectedStatus: 400 },
        { factory: () => ErrorFactory.databaseError('query'), expectedStatus: 500 },
        { factory: () => ErrorFactory.fileSystemError('read', 'path'), expectedStatus: 500 },
        { factory: () => ErrorFactory.internalValidation('Test', 'op'), expectedStatus: 500 },
        { factory: () => ErrorFactory.updateFailed('Test', 1), expectedStatus: 500 },
        { factory: () => ErrorFactory.deleteFailed('Test', 1), expectedStatus: 500 },
        { factory: () => ErrorFactory.createFailed('Test'), expectedStatus: 500 },
        { factory: () => ErrorFactory.invalidRelationship('child', 1, 'parent', 2), expectedStatus: 400 }
      ]
      
      errorChecks.forEach(({ factory, expectedStatus }) => {
        try {
          factory()
        } catch (error) {
          expect(error.status).toBe(expectedStatus)
        }
      })
    })

    test('entity error factory methods delegate correctly to main ErrorFactory', () => {
      const userErrors = createEntityErrorFactory('User')
      
      // Test that entity-specific methods create the same errors as main factory
      try {
        userErrors.notFound(123)
      } catch (entityError) {
        try {
          ErrorFactory.notFound('User', 123)
        } catch (mainError) {
          expect(entityError.status).toBe(mainError.status)
          expect(entityError.message).toBe(mainError.message)
          expect(entityError.code).toBe(mainError.code)
        }
      }
    })

    test('complex withErrorContext scenarios', async () => {
      // Test with async operation that resolves
      const asyncOp = () => new Promise(resolve => setTimeout(() => resolve('result'), 10))
      const result = await withErrorContext(asyncOp, { entity: 'Test' })
      expect(result).toBe('result')
      
      // Test with sync operation converted to Promise
      const syncOp = () => Promise.resolve({ data: 'sync result' })
      const syncResult = await withErrorContext(syncOp, { action: 'sync' })
      expect(syncResult.data).toBe('sync result')
      
      // Test with operation that throws after delay
      const delayedError = () => new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Delayed error')), 10)
      )
      
      try {
        await withErrorContext(delayedError, { entity: 'Delayed', id: 'test' })
      } catch (error) {
        expect(error.message).toContain('Delayed error')
        expect(error.details.entity).toBe('Delayed')
        expect(error.details.id).toBe('test')
      }
    })
  })
})