import { describe, test, expect } from 'bun:test'
import { 
  EntityErrors, 
  createEntityErrorFactory,
  ProjectErrors,
  TicketErrors,
  TaskErrors,
  QueueErrors,
  PromptErrors,
  ChatErrors,
  FileErrors
} from './entity-errors'
import { ApiError } from './api-error'

describe('EntityErrors', () => {
  describe('notFound', () => {
    test('throws 404 error with correct message and code', () => {
      expect(() => EntityErrors.notFound('User', 123))
        .toThrow(ApiError)
      
      try {
        EntityErrors.notFound('User', 123)
      } catch (error: any) {
        expect(error.status).toBe(404)
        expect(error.message).toBe('User 123 not found')
        expect(error.code).toBe('USER_NOT_FOUND')
      }
    })

    test('handles string IDs', () => {
      try {
        EntityErrors.notFound('Document', 'abc-123')
      } catch (error: any) {
        expect(error.message).toBe('Document abc-123 not found')
        expect(error.code).toBe('DOCUMENT_NOT_FOUND')
      }
    })

    test('handles entity names with spaces', () => {
      try {
        EntityErrors.notFound('Project File', 456)
      } catch (error: any) {
        expect(error.code).toBe('PROJECT_FILE_NOT_FOUND')
      }
    })
  })

  describe('manyNotFound', () => {
    test('throws 404 with list of IDs', () => {
      try {
        EntityErrors.manyNotFound('Task', [1, 2, 3])
      } catch (error: any) {
        expect(error.status).toBe(404)
        expect(error.message).toBe('Tasks not found: 1, 2, 3')
        expect(error.code).toBe('TASKS_NOT_FOUND')
        expect(error.details?.ids).toEqual([1, 2, 3])
      }
    })
  })

  describe('validationFailed', () => {
    test('throws 400 with validation errors', () => {
      const errors = [
        { field: 'name', message: 'Required' },
        { field: 'email', message: 'Invalid format' }
      ]

      try {
        EntityErrors.validationFailed('User', errors)
      } catch (error: any) {
        expect(error.status).toBe(400)
        expect(error.message).toBe('Validation failed for User')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.details?.errors).toEqual(errors)
      }
    })

    test('includes context when provided', () => {
      try {
        EntityErrors.validationFailed('User', {}, 'registration')
      } catch (error: any) {
        expect(error.message).toBe('Validation failed for User in registration')
      }
    })
  })

  describe('duplicate', () => {
    test('throws 409 conflict error', () => {
      try {
        EntityErrors.duplicate('User', 'email', 'test@example.com')
      } catch (error: any) {
        expect(error.status).toBe(409)
        expect(error.message).toBe("User with email 'test@example.com' already exists")
        expect(error.code).toBe('DUPLICATE_ENTITY')
        expect(error.details).toEqual({
          entity: 'User',
          field: 'email',
          value: 'test@example.com'
        })
      }
    })
  })

  describe('stateConflict', () => {
    test('throws 409 for invalid state transitions', () => {
      try {
        EntityErrors.stateConflict('Queue', 123, 'paused', 'delete')
      } catch (error: any) {
        expect(error.status).toBe(409)
        expect(error.message).toBe("Cannot delete Queue 123 in state 'paused'")
        expect(error.code).toBe('STATE_CONFLICT')
      }
    })
  })

  describe('batchSizeExceeded', () => {
    test('throws 400 with size information', () => {
      try {
        EntityErrors.batchSizeExceeded('Ticket', 100, 150)
      } catch (error: any) {
        expect(error.status).toBe(400)
        expect(error.message).toBe('Batch size exceeded for Ticket. Maximum 100, provided 150')
        expect(error.code).toBe('BATCH_SIZE_EXCEEDED')
        expect(error.details?.limit).toBe(100)
        expect(error.details?.provided).toBe(150)
      }
    })
  })

  describe('mismatch', () => {
    test('throws 400 for mismatched relationships', () => {
      try {
        EntityErrors.mismatch('Task', 456, 'Ticket', 123)
      } catch (error: any) {
        expect(error.status).toBe(400)
        expect(error.message).toBe('Task 456 does not belong to Ticket 123')
        expect(error.code).toBe('ENTITY_MISMATCH')
      }
    })
  })

  describe('missingRequired', () => {
    test('throws 400 for missing required fields', () => {
      try {
        EntityErrors.missingRequired('Ticket', 'title')
      } catch (error: any) {
        expect(error.status).toBe(400)
        expect(error.message).toBe('title required for Ticket')
        expect(error.code).toBe('MISSING_REQUIRED_FIELD')
      }
    })
  })

  describe('invalidTransition', () => {
    test('throws 400 for invalid state transitions', () => {
      try {
        EntityErrors.invalidTransition('Queue', 1, 'active', 'deleted')
      } catch (error: any) {
        expect(error.status).toBe(400)
        expect(error.message).toBe('Invalid state transition for Queue 1: active -> deleted')
        expect(error.code).toBe('INVALID_STATE_TRANSITION')
      }
    })
  })

  describe('alreadyInState', () => {
    test('throws 400 when entity already in state', () => {
      try {
        EntityErrors.alreadyInState('Queue', 123, 'paused')
      } catch (error: any) {
        expect(error.status).toBe(400)
        expect(error.message).toBe('Queue 123 is already paused')
        expect(error.code).toBe('QUEUE_ALREADY_PAUSED')
      }
    })

    test('handles complex state names', () => {
      try {
        EntityErrors.alreadyInState('Task', 456, 'in progress')
      } catch (error: any) {
        expect(error.code).toBe('TASK_ALREADY_IN_PROGRESS')
      }
    })
  })

  describe('Database Errors', () => {
    test('dbReadError throws 500', () => {
      const originalError = new Error('Connection failed')
      
      try {
        EntityErrors.dbReadError('Project', originalError)
      } catch (error: any) {
        expect(error.status).toBe(500)
        expect(error.message).toBe('Failed to read Project from database')
        expect(error.code).toBe('DB_READ_ERROR')
        expect(error.details?.originalError).toBe('Connection failed')
      }
    })

    test('dbWriteError includes context', () => {
      try {
        EntityErrors.dbWriteError('Project', {}, 'during sync')
      } catch (error: any) {
        expect(error.message).toBe('Failed to write Project to database: during sync')
      }
    })

    test('dbDeleteError handles errors', () => {
      try {
        EntityErrors.dbDeleteError('Project', new Error('FK constraint'))
      } catch (error: any) {
        expect(error.status).toBe(500)
        expect(error.code).toBe('DB_DELETE_ERROR')
      }
    })
  })

  describe('transactionError', () => {
    test('throws 500 for transaction failures', () => {
      try {
        EntityErrors.transactionError('bulk update', new Error('Rollback'))
      } catch (error: any) {
        expect(error.status).toBe(500)
        expect(error.message).toBe('Transaction failed during bulk update')
        expect(error.code).toBe('TRANSACTION_ERROR')
        expect(error.details?.originalError).toBe('Rollback')
      }
    })
  })

  describe('notPermitted', () => {
    test('throws 403 forbidden error', () => {
      try {
        EntityErrors.notPermitted('Project', 'delete')
      } catch (error: any) {
        expect(error.status).toBe(403)
        expect(error.message).toBe('delete not permitted for Project')
        expect(error.code).toBe('OPERATION_NOT_PERMITTED')
      }
    })

    test('includes reason when provided', () => {
      try {
        EntityErrors.notPermitted('Project', 'delete', 'has active tickets')
      } catch (error: any) {
        expect(error.message).toBe('delete not permitted for Project: has active tickets')
        expect(error.details?.reason).toBe('has active tickets')
      }
    })
  })

  describe('custom', () => {
    test('creates custom error with any status code', () => {
      try {
        EntityErrors.custom(418, 'Teapot', 'Cannot brew coffee', 'TEAPOT_ERROR', {
          temperature: 100
        })
      } catch (error: any) {
        expect(error.status).toBe(418)
        expect(error.message).toBe('Teapot: Cannot brew coffee')
        expect(error.code).toBe('TEAPOT_ERROR')
        expect(error.details?.temperature).toBe(100)
      }
    })
  })
})

describe('createEntityErrorFactory', () => {
  test('creates entity-specific error factory', () => {
    const UserErrors = createEntityErrorFactory('User')
    
    try {
      UserErrors.notFound(123)
    } catch (error: any) {
      expect(error.message).toBe('User 123 not found')
      expect(error.code).toBe('USER_NOT_FOUND')
    }
  })

  test('factory methods maintain entity context', () => {
    const CustomErrors = createEntityErrorFactory('CustomEntity')
    
    try {
      CustomErrors.validationFailed({ field: 'test' })
    } catch (error: any) {
      expect(error.message).toBe('Validation failed for CustomEntity')
    }

    try {
      CustomErrors.duplicate('name', 'test')
    } catch (error: any) {
      expect(error.message).toBe("CustomEntity with name 'test' already exists")
    }
  })
})

describe('Pre-created Entity Error Factories', () => {
  test('ProjectErrors work correctly', () => {
    try {
      ProjectErrors.notFound(123)
    } catch (error: any) {
      expect(error.message).toBe('Project 123 not found')
      expect(error.code).toBe('PROJECT_NOT_FOUND')
    }
  })

  test('TicketErrors work correctly', () => {
    try {
      TicketErrors.batchSizeExceeded(100, 150)
    } catch (error: any) {
      expect(error.message).toContain('Ticket')
      expect(error.message).toContain('100')
      expect(error.message).toContain('150')
    }
  })

  test('TaskErrors work correctly', () => {
    try {
      TaskErrors.notFound(456)
    } catch (error: any) {
      expect(error.message).toBe('Task 456 not found')
      expect(error.code).toBe('TASK_NOT_FOUND')
    }
  })

  test('QueueErrors work correctly', () => {
    try {
      QueueErrors.alreadyInState(1, 'paused')
    } catch (error: any) {
      expect(error.message).toBe('Queue 1 is already paused')
      expect(error.code).toBe('QUEUE_ALREADY_PAUSED')
    }
  })

  test('PromptErrors work correctly', () => {
    try {
      PromptErrors.duplicate('name', 'Test Prompt')
    } catch (error: any) {
      expect(error.message).toBe("Prompt with name 'Test Prompt' already exists")
    }
  })

  test('ChatErrors work correctly', () => {
    try {
      ChatErrors.notFound('chat-123')
    } catch (error: any) {
      expect(error.message).toBe('Chat chat-123 not found')
    }
  })

  test('FileErrors work correctly', () => {
    try {
      FileErrors.dbReadError(new Error('Disk full'), 'during upload')
    } catch (error: any) {
      expect(error.message).toBe('Failed to read File from database: during upload')
      expect(error.details?.originalError).toBe('Disk full')
    }
  })
})