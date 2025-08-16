import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { z } from '@hono/zod-openapi'
import { ApiError } from '@promptliano/shared'
import type { Context } from 'hono'
import {
  createSuccessResponseSchema,
  createListResponseSchema,
  createPaginatedResponseSchema,
  standardResponses,
  createStandardResponses,
  createStandardResponsesWithStatus,
  withErrorHandling,
  validateRouteParam,
  successResponse,
  operationSuccessResponse,
  createRouteHandler,
  validateEntities,
  createCrudRoutes
} from './route-helpers'

// Mock schemas for testing
const mockSchema = z.object({
  id: z.number(),
  name: z.string()
}).openapi('MockEntity')

const mockItemSchema = z.object({
  id: z.number(),
  title: z.string()
}).openapi('MockItem')

// Mock Hono Context
function createMockContext(overrides: Partial<Context> = {}): Context {
  const mockContext = {
    req: {
      param: mock(() => undefined),
      valid: mock(() => undefined)
    },
    json: mock(() => ({ success: true })),
    ...overrides
  } as unknown as Context
  
  return mockContext
}

describe('Route Helpers', () => {
  describe('Schema Factories', () => {
    describe('createSuccessResponseSchema', () => {
      it('should create a success response schema with data property', () => {
        const schema = createSuccessResponseSchema(mockSchema, 'TestSuccess')
        
        const result = schema.parse({
          success: true,
          data: { id: 1, name: 'test' }
        })
        
        expect(result.success).toBe(true)
        expect(result.data.id).toBe(1)
        expect(result.data.name).toBe('test')
      })
      
      it('should fail validation when success is not true', () => {
        const schema = createSuccessResponseSchema(mockSchema, 'TestSuccess')
        
        expect(() => {
          schema.parse({
            success: false,
            data: { id: 1, name: 'test' }
          })
        }).toThrow()
      })
      
      it('should fail validation when data does not match schema', () => {
        const schema = createSuccessResponseSchema(mockSchema, 'TestSuccess')
        
        expect(() => {
          schema.parse({
            success: true,
            data: { id: 'invalid', name: 'test' }
          })
        }).toThrow()
      })
      
      it('should add OpenAPI metadata with correct name', () => {
        const schema = createSuccessResponseSchema(mockSchema, 'TestSuccess')
        
        // Check that the schema has OpenAPI metadata with correct refId
        expect(schema._def.openapi).toBeDefined()
        expect(schema._def.openapi._internal.refId).toBe('TestSuccess')
      })
    })
    
    describe('createListResponseSchema', () => {
      it('should create a list response schema with array data', () => {
        const schema = createListResponseSchema(mockItemSchema, 'TestList')
        
        const result = schema.parse({
          success: true,
          data: [
            { id: 1, title: 'test1' },
            { id: 2, title: 'test2' }
          ]
        })
        
        expect(result.success).toBe(true)
        expect(result.data).toHaveLength(2)
        expect(result.data[0].id).toBe(1)
        expect(result.data[1].title).toBe('test2')
      })
      
      it('should accept empty arrays', () => {
        const schema = createListResponseSchema(mockItemSchema, 'TestList')
        
        const result = schema.parse({
          success: true,
          data: []
        })
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual([])
      })
      
      it('should fail validation with non-array data', () => {
        const schema = createListResponseSchema(mockItemSchema, 'TestList')
        
        expect(() => {
          schema.parse({
            success: true,
            data: { id: 1, title: 'test' }
          })
        }).toThrow()
      })
    })
    
    describe('createPaginatedResponseSchema', () => {
      it('should create a paginated response schema with pagination metadata', () => {
        const schema = createPaginatedResponseSchema(mockItemSchema, 'TestPaginated')
        
        const result = schema.parse({
          success: true,
          data: [{ id: 1, title: 'test' }],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            hasMore: false
          }
        })
        
        expect(result.success).toBe(true)
        expect(result.data).toHaveLength(1)
        expect(result.pagination.page).toBe(1)
        expect(result.pagination.limit).toBe(10)
        expect(result.pagination.total).toBe(1)
        expect(result.pagination.hasMore).toBe(false)
      })
      
      it('should fail validation with missing pagination', () => {
        const schema = createPaginatedResponseSchema(mockItemSchema, 'TestPaginated')
        
        expect(() => {
          schema.parse({
            success: true,
            data: [{ id: 1, title: 'test' }]
          })
        }).toThrow()
      })
      
      it('should fail validation with invalid pagination types', () => {
        const schema = createPaginatedResponseSchema(mockItemSchema, 'TestPaginated')
        
        expect(() => {
          schema.parse({
            success: true,
            data: [{ id: 1, title: 'test' }],
            pagination: {
              page: '1', // Should be number
              limit: 10,
              total: 1,
              hasMore: false
            }
          })
        }).toThrow()
      })
    })
  })
  
  describe('Response Factories', () => {
    describe('standardResponses', () => {
      it('should contain all expected error status codes', () => {
        expect(standardResponses).toHaveProperty('400')
        expect(standardResponses).toHaveProperty('404')
        expect(standardResponses).toHaveProperty('422')
        expect(standardResponses).toHaveProperty('500')
      })
      
      it('should have proper structure for each error response', () => {
        Object.values(standardResponses).forEach(response => {
          expect(response).toHaveProperty('content')
          expect(response).toHaveProperty('description')
          expect(response.content).toHaveProperty('application/json')
          expect(response.content['application/json']).toHaveProperty('schema')
        })
      })
    })
    
    describe('createStandardResponses', () => {
      it('should create responses with 200 success and standard errors', () => {
        const responses = createStandardResponses(mockSchema)
        
        expect(responses).toHaveProperty('200')
        expect(responses).toHaveProperty('400')
        expect(responses).toHaveProperty('404')
        expect(responses).toHaveProperty('422')
        expect(responses).toHaveProperty('500')
        
        expect(responses[200].description).toBe('Success')
        expect(responses[200].content['application/json'].schema).toBe(mockSchema)
      })
      
      it('should include all standard error responses', () => {
        const responses = createStandardResponses(mockSchema)
        
        expect(responses[400]).toEqual(standardResponses[400])
        expect(responses[404]).toEqual(standardResponses[404])
        expect(responses[422]).toEqual(standardResponses[422])
        expect(responses[500]).toEqual(standardResponses[500])
      })
    })
    
    describe('createStandardResponsesWithStatus', () => {
      it('should create responses with custom status code and description', () => {
        const responses = createStandardResponsesWithStatus(mockSchema, 201, 'Created')
        
        expect(responses).toHaveProperty('201')
        expect(responses[201].description).toBe('Created')
        expect(responses[201].content['application/json'].schema).toBe(mockSchema)
      })
      
      it('should use default 200 status when not specified', () => {
        const responses = createStandardResponsesWithStatus(mockSchema)
        
        expect(responses).toHaveProperty('200')
        expect(responses[200].description).toBe('Success')
      })
      
      it('should include standard error responses with custom status', () => {
        const responses = createStandardResponsesWithStatus(mockSchema, 201, 'Created')
        
        expect(responses).toHaveProperty('400')
        expect(responses).toHaveProperty('404')
        expect(responses).toHaveProperty('422')
        expect(responses).toHaveProperty('500')
      })
    })
  })
  
  describe('Error Handling', () => {
    describe('withErrorHandling', () => {
      const mockContext = createMockContext()
      
      it('should return handler result when no error occurs', async () => {
        const handler = mock(() => Promise.resolve({ success: true }))
        const wrappedHandler = withErrorHandling(handler)
        
        const result = await wrappedHandler(mockContext)
        
        expect(result).toEqual({ success: true })
        expect(handler).toHaveBeenCalledWith(mockContext)
      })
      
      it('should re-throw ApiError instances without modification', async () => {
        const apiError = new ApiError(404, 'Not found', 'NOT_FOUND')
        const handler = mock(() => Promise.reject(apiError))
        const wrappedHandler = withErrorHandling(handler)
        
        await expect(wrappedHandler(mockContext)).rejects.toThrow(apiError)
      })
      
      it('should wrap Error instances in ApiError', async () => {
        const error = new Error('Something went wrong')
        const handler = mock(() => Promise.reject(error))
        const wrappedHandler = withErrorHandling(handler)
        
        await expect(wrappedHandler(mockContext)).rejects.toThrow(ApiError)
        
        try {
          await wrappedHandler(mockContext)
        } catch (e) {
          expect(e).toBeInstanceOf(ApiError)
          expect((e as ApiError).status).toBe(500)
          expect((e as ApiError).message).toBe('Something went wrong')
          expect((e as ApiError).code).toBe('INTERNAL_ERROR')
        }
      })
      
      it('should wrap non-Error instances in ApiError with generic message', async () => {
        const handler = mock(() => Promise.reject('string error'))
        const wrappedHandler = withErrorHandling(handler)
        
        try {
          await wrappedHandler(mockContext)
        } catch (e) {
          expect(e).toBeInstanceOf(ApiError)
          expect((e as ApiError).status).toBe(500)
          expect((e as ApiError).message).toBe('An unexpected error occurred')
          expect((e as ApiError).code).toBe('INTERNAL_ERROR')
        }
      })
      
      it('should pass through additional arguments to handler', async () => {
        const handler = mock((c: Context, arg1: string, arg2: number) => 
          Promise.resolve({ arg1, arg2 }))
        const wrappedHandler = withErrorHandling(handler)
        
        const result = await wrappedHandler(mockContext, 'test', 42)
        
        expect(result).toEqual({ arg1: 'test', arg2: 42 })
        expect(handler).toHaveBeenCalledWith(mockContext, 'test', 42)
      })
    })
  })
  
  describe('Parameter Validation', () => {
    describe('validateRouteParam', () => {
      it('should return string param when type is string', () => {
        const mockContext = createMockContext({
          req: {
            param: mock((name: string) => name === 'id' ? 'test-id' : undefined),
            valid: mock(() => undefined)
          }
        } as any)
        
        const result = validateRouteParam(mockContext, 'id', 'string')
        
        expect(result).toBe('test-id')
      })
      
      it('should return parsed number when type is number', () => {
        const mockContext = createMockContext({
          req: {
            param: mock((name: string) => name === 'id' ? '42' : undefined),
            valid: mock(() => undefined)
          }
        } as any)
        
        const result = validateRouteParam(mockContext, 'id', 'number')
        
        expect(result).toBe(42)
      })
      
      it('should default to number type when type not specified', () => {
        const mockContext = createMockContext({
          req: {
            param: mock((name: string) => name === 'id' ? '123' : undefined),
            valid: mock(() => undefined)
          }
        } as any)
        
        const result = validateRouteParam(mockContext, 'id')
        
        expect(result).toBe(123)
      })
      
      it('should throw ApiError when param is missing', () => {
        const mockContext = createMockContext({
          req: {
            param: mock(() => undefined),
            valid: mock(() => undefined)
          }
        } as any)
        
        expect(() => {
          validateRouteParam(mockContext, 'id')
        }).toThrow(ApiError)
        
        try {
          validateRouteParam(mockContext, 'id')
        } catch (e) {
          expect((e as ApiError).status).toBe(400)
          expect((e as ApiError).message).toBe('Missing required parameter: id')
          expect((e as ApiError).code).toBe('MISSING_PARAM')
        }
      })
      
      it('should throw ApiError when number param is invalid', () => {
        const mockContext = createMockContext({
          req: {
            param: mock((name: string) => name === 'id' ? 'not-a-number' : undefined),
            valid: mock(() => undefined)
          }
        } as any)
        
        expect(() => {
          validateRouteParam(mockContext, 'id', 'number')
        }).toThrow(ApiError)
        
        try {
          validateRouteParam(mockContext, 'id', 'number')
        } catch (e) {
          expect((e as ApiError).status).toBe(400)
          expect((e as ApiError).message).toBe('Invalid id: must be a number')
          expect((e as ApiError).code).toBe('INVALID_PARAM')
        }
      })
      
      it('should handle empty string as missing param', () => {
        const mockContext = createMockContext({
          req: {
            param: mock((name: string) => name === 'id' ? '' : undefined),
            valid: mock(() => undefined)
          }
        } as any)
        
        expect(() => {
          validateRouteParam(mockContext, 'id')
        }).toThrow(ApiError)
      })
    })
  })
  
  describe('Response Helpers', () => {
    describe('successResponse', () => {
      it('should create success response with data', () => {
        const data = { id: 1, name: 'test' }
        const result = successResponse(data)
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual(data)
      })
      
      it('should work with null data', () => {
        const result = successResponse(null)
        
        expect(result.success).toBe(true)
        expect(result.data).toBeNull()
      })
      
      it('should work with array data', () => {
        const data = [1, 2, 3]
        const result = successResponse(data)
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual(data)
      })
    })
    
    describe('operationSuccessResponse', () => {
      it('should create operation success response with default message', () => {
        const result = operationSuccessResponse()
        
        expect(result.success).toBe(true)
        expect(result.message).toBe('Operation completed successfully')
      })
      
      it('should create operation success response with custom message', () => {
        const result = operationSuccessResponse('Custom success message')
        
        expect(result.success).toBe(true)
        expect(result.message).toBe('Custom success message')
      })
    })
  })
  
  describe('Route Handler Factory', () => {
    describe('createRouteHandler', () => {
      const mockJsonResponse = mock(() => new Response())
      const mockContext = createMockContext({
        json: mockJsonResponse
      })
      
      beforeEach(() => {
        mockJsonResponse.mockClear()
      })
      
      it('should call handler with extracted params, query, body, and context', async () => {
        const mockHandler = mock(async ({ params, query, body, c }) => ({ params, query, body }))
        const mockParams = { id: '123' }
        const mockQuery = { search: 'test' }
        const mockBody = { name: 'test' }
        
        const mockContextWithData = createMockContext({
          req: {
            valid: mock((type: string) => {
              if (type === 'param') return mockParams
              if (type === 'query') return mockQuery
              if (type === 'json') return mockBody
              return undefined
            })
          },
          json: mockJsonResponse
        } as any)
        
        const routeHandler = createRouteHandler(mockHandler)
        await routeHandler(mockContextWithData)
        
        expect(mockHandler).toHaveBeenCalledWith({
          params: mockParams,
          query: mockQuery,
          body: mockBody,
          c: mockContextWithData
        })
      })
      
      it('should return JSON response with handler result', async () => {
        const handlerResult = { data: 'test result' }
        const mockHandler = mock(async () => handlerResult)
        
        const routeHandler = createRouteHandler(mockHandler)
        await routeHandler(mockContext)
        
        expect(mockJsonResponse).toHaveBeenCalledWith(handlerResult)
      })
      
      it('should handle errors through withErrorHandling wrapper', async () => {
        const error = new Error('Test error')
        const mockHandler = mock(async () => { throw error })
        
        const routeHandler = createRouteHandler(mockHandler)
        
        await expect(routeHandler(mockContext)).rejects.toThrow(ApiError)
      })
    })
  })
  
  describe('Entity Validation', () => {
    describe('validateEntities', () => {
      it('should pass when all entities are valid', async () => {
        const entities = [{ id: 1 }, { id: 2 }, { id: 3 }]
        const validator = mock((entity: any) => entity.id > 0)
        
        await expect(validateEntities(entities, validator, 'item')).resolves.toBeUndefined()
        expect(validator).toHaveBeenCalledTimes(3)
      })
      
      it('should handle async validator', async () => {
        const entities = [{ id: 1 }, { id: 2 }]
        const validator = mock(async (entity: any) => {
          await new Promise(resolve => setTimeout(resolve, 1))
          return entity.id > 0
        })
        
        await expect(validateEntities(entities, validator, 'item')).resolves.toBeUndefined()
        expect(validator).toHaveBeenCalledTimes(2)
      })
      
      it('should throw ApiError when validation fails', async () => {
        const entities = [{ id: 1 }, { id: -1 }, { id: 3 }]
        const validator = mock((entity: any) => entity.id > 0)
        
        await expect(validateEntities(entities, validator, 'item')).rejects.toThrow(ApiError)
        
        try {
          await validateEntities(entities, validator, 'item')
        } catch (e) {
          expect((e as ApiError).status).toBe(400)
          expect((e as ApiError).message).toBe('Validation failed for 1 item(s)')
          expect((e as ApiError).code).toBe('BATCH_VALIDATION_ERROR')
          expect((e as ApiError).details).toHaveProperty('failures')
          expect((e as ApiError).details?.failures).toHaveLength(1)
        }
      })
      
      it('should include all failures in error details', async () => {
        const entities = [{ id: -1 }, { id: 2 }, { id: -3 }]
        const validator = mock((entity: any) => entity.id > 0)
        
        try {
          await validateEntities(entities, validator, 'product')
        } catch (e) {
          expect((e as ApiError).message).toBe('Validation failed for 2 product(s)')
          expect((e as ApiError).details?.failures).toHaveLength(2)
          expect((e as ApiError).details?.failures[0].index).toBe(0)
          expect((e as ApiError).details?.failures[1].index).toBe(2)
        }
      })
      
      it('should handle validator exceptions', async () => {
        const entities = [{ id: 1 }, { id: 2 }]
        const validator = mock((entity: any) => {
          if (entity.id === 2) throw new Error('Validator error')
          return true
        })
        
        try {
          await validateEntities(entities, validator, 'item')
        } catch (e) {
          expect((e as ApiError).message).toBe('Validation failed for 1 item(s)')
          expect((e as ApiError).details?.failures[0].error).toBeDefined()
        }
      })
    })
  })
  
  describe('CRUD Route Factory', () => {
    describe('createCrudRoutes', () => {
      const mockService = {
        list: mock(() => Promise.resolve([{ id: 1 }, { id: 2 }])),
        get: mock((id: number) => Promise.resolve(id === 1 ? { id: 1, name: 'test' } : null)),
        create: mock((data: any) => Promise.resolve({ id: 1, ...data })),
        update: mock((id: number, data: any) => Promise.resolve({ id, ...data })),
        delete: mock((id: number) => Promise.resolve(id === 1))
      }
      
      beforeEach(() => {
        Object.values(mockService).forEach(mock => mock.mockClear())
      })
      
      describe('list route', () => {
        it('should return list of entities', async () => {
          const routes = createCrudRoutes('user', mockService)
          const mockContext = createMockContext({
            req: { valid: mock(() => undefined) },
            json: mock(data => data)
          } as any)
          
          const result = await routes.list(mockContext)
          
          expect(mockService.list).toHaveBeenCalled()
          // Result structure will depend on how the route handler processes the data
        })
      })
      
      describe('get route', () => {
        it('should return single entity when found', async () => {
          const routes = createCrudRoutes('user', mockService)
          const mockContext = createMockContext({
            req: { valid: mock(() => ({ id: '1' })) },
            json: mock(data => data)
          } as any)
          
          const result = await routes.get(mockContext)
          
          expect(mockService.get).toHaveBeenCalledWith(1)
        })
        
        it('should throw ApiError when entity not found', async () => {
          const routes = createCrudRoutes('user', mockService)
          const mockContext = createMockContext({
            req: { valid: mock(() => ({ id: '999' })) },
            json: mock(data => data)
          } as any)
          
          await expect(routes.get(mockContext)).rejects.toThrow(ApiError)
          
          try {
            await routes.get(mockContext)
          } catch (e) {
            expect((e as ApiError).status).toBe(404)
            expect((e as ApiError).message).toBe('user not found')
            expect((e as ApiError).code).toBe('USER_NOT_FOUND')
          }
        })
      })
      
      describe('create route', () => {
        it('should create and return new entity', async () => {
          const routes = createCrudRoutes('user', mockService)
          const createData = { name: 'new user' }
          const mockContext = createMockContext({
            req: { valid: mock(() => createData) },
            json: mock(data => data)
          } as any)
          
          const result = await routes.create(mockContext)
          
          expect(mockService.create).toHaveBeenCalledWith(createData)
        })
      })
      
      describe('update route', () => {
        it('should update and return entity', async () => {
          const routes = createCrudRoutes('user', mockService)
          const updateData = { name: 'updated user' }
          const mockContext = createMockContext({
            req: { 
              valid: mock((type: string) => {
                if (type === 'param') return { id: '1' }
                return updateData
              })
            },
            json: mock(data => data)
          } as any)
          
          const result = await routes.update(mockContext)
          
          expect(mockService.update).toHaveBeenCalledWith(1, updateData)
        })
      })
      
      describe('delete route', () => {
        it('should delete entity and return success message', async () => {
          const routes = createCrudRoutes('user', mockService)
          const mockContext = createMockContext({
            req: { valid: mock(() => ({ id: '1' })) },
            json: mock(data => data)
          } as any)
          
          const result = await routes.delete(mockContext)
          
          expect(mockService.delete).toHaveBeenCalledWith(1)
        })
        
        it('should throw ApiError when entity not found for deletion', async () => {
          const routes = createCrudRoutes('user', mockService)
          const mockContext = createMockContext({
            req: { valid: mock(() => ({ id: '999' })) },
            json: mock(data => data)
          } as any)
          
          await expect(routes.delete(mockContext)).rejects.toThrow(ApiError)
          
          try {
            await routes.delete(mockContext)
          } catch (e) {
            expect((e as ApiError).status).toBe(404)
            expect((e as ApiError).message).toBe('user not found')
            expect((e as ApiError).code).toBe('USER_NOT_FOUND')
          }
        })
      })
    })
  })
  
  describe('Performance Tests', () => {
    describe('Schema Factory Performance', () => {
      it('should create schemas efficiently', () => {
        const startTime = performance.now()
        
        for (let i = 0; i < 1000; i++) {
          createSuccessResponseSchema(mockSchema, `Test${i}`)
          createListResponseSchema(mockItemSchema, `TestList${i}`)
          createPaginatedResponseSchema(mockItemSchema, `TestPaginated${i}`)
        }
        
        const endTime = performance.now()
        const duration = endTime - startTime
        
        // Schema creation should be fast (under 100ms for 1000 schemas)
        expect(duration).toBeLessThan(100)
      })
    })
    
    describe('Response Factory Performance', () => {
      it('should create standard responses efficiently', () => {
        const startTime = performance.now()
        
        for (let i = 0; i < 1000; i++) {
          createStandardResponses(mockSchema)
          createStandardResponsesWithStatus(mockSchema, 201, 'Created')
        }
        
        const endTime = performance.now()
        const duration = endTime - startTime
        
        // Response creation should be fast (under 50ms for 1000 iterations)
        expect(duration).toBeLessThan(50)
      })
    })
    
    describe('Wrapper Function Performance', () => {
      it('should wrap handlers efficiently', async () => {
        const mockHandler = mock(() => Promise.resolve({ success: true }))
        const mockContext = createMockContext()
        
        const startTime = performance.now()
        
        for (let i = 0; i < 100; i++) {
          const wrappedHandler = withErrorHandling(mockHandler)
          await wrappedHandler(mockContext)
        }
        
        const endTime = performance.now()
        const duration = endTime - startTime
        
        // Error handling wrapper should be fast (under 50ms for 100 calls)
        expect(duration).toBeLessThan(50)
      })
    })
  })
  
  describe('Type Safety Tests', () => {
    it('should maintain type safety in success response', () => {
      const data = { id: 1, name: 'test' }
      const response = successResponse(data)
      
      // TypeScript should infer the correct types
      expect(typeof response.success).toBe('boolean')
      expect(response.success).toBe(true)
      expect(response.data.id).toBe(1)
      expect(response.data.name).toBe('test')
    })
    
    it('should maintain type safety in schema factories', () => {
      const schema = createSuccessResponseSchema(mockSchema, 'Test')
      const validData = { success: true as const, data: { id: 1, name: 'test' } }
      
      const result = schema.parse(validData)
      
      // TypeScript should infer correct types from schema
      expect(result.success).toBe(true)
      expect(typeof result.data.id).toBe('number')
      expect(typeof result.data.name).toBe('string')
    })
  })
  
  describe('Edge Cases', () => {
    describe('Empty and Null Values', () => {
      it('should handle empty arrays in list response', () => {
        const schema = createListResponseSchema(mockItemSchema, 'EmptyList')
        const result = schema.parse({ success: true, data: [] })
        
        expect(result.data).toEqual([])
      })
      
      it('should handle null data in success response', () => {
        const response = successResponse(null)
        
        expect(response.success).toBe(true)
        expect(response.data).toBeNull()
      })
      
      it('should handle undefined context parameters gracefully', () => {
        const mockContext = createMockContext({
          req: {
            valid: mock(() => undefined)
          }
        } as any)
        
        const handler = createRouteHandler(async ({ params, query, body }) => {
          return { params, query, body }
        })
        
        // Should not throw when extracting undefined values
        expect(async () => await handler(mockContext)).not.toThrow()
      })
    })
    
    describe('Large Data Sets', () => {
      it('should handle large arrays in list response', () => {
        const largeArray = Array.from({ length: 10000 }, (_, i) => ({ id: i, title: `Item ${i}` }))
        const schema = createListResponseSchema(mockItemSchema, 'LargeList')
        
        const result = schema.parse({ success: true, data: largeArray })
        
        expect(result.data).toHaveLength(10000)
        expect(result.data[9999].id).toBe(9999)
      })
      
      it('should handle batch validation with many entities', async () => {
        const entities = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
        const validator = mock((entity: any) => entity.id >= 0)
        
        await expect(validateEntities(entities, validator, 'item')).resolves.toBeUndefined()
        expect(validator).toHaveBeenCalledTimes(1000)
      })
    })
    
    describe('Error Boundary Cases', () => {
      it('should handle concurrent error handling', async () => {
        const handler = mock(() => Promise.reject(new Error('Concurrent error')))
        const wrappedHandler = withErrorHandling(handler)
        const mockContext = createMockContext()
        
        const promises = Array.from({ length: 10 }, () => 
          wrappedHandler(mockContext).catch(e => e)
        )
        
        const results = await Promise.all(promises)
        
        results.forEach(result => {
          expect(result).toBeInstanceOf(ApiError)
          expect((result as ApiError).message).toBe('Concurrent error')
        })
      })
    })
  })
})