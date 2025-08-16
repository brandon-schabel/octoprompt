import { describe, test, expect } from 'bun:test'
import { z } from '@hono/zod-openapi'
import {
  createApiResponseSchema,
  createListResponseSchema,
  createPaginatedResponseSchema,
  createCrudValidationSchemas,
  createTimestampFields,
  createBaseEntitySchema,
  createSearchQuerySchema,
  createEnumField,
  createArrayField,
  createNullableField,
  createFlexibleField,
  createEntitySchemas,
  createCrudSchemas,
  createPaginatedSchema,
  createResponseSchemas,
  createValidationErrorSchema,
  standardErrorSchema,
  createBatchRequestSchema,
  createBatchResponseSchema,
  schemaFactories,
  commonFields
} from './schema-factories'

describe('schema-factories', () => {
  describe('createApiResponseSchema', () => {
    test('creates standard API response schema', () => {
      const dataSchema = z.object({ id: z.number(), name: z.string() })
      const responseSchema = createApiResponseSchema(dataSchema, 'TestResponse')
      
      const validData = { success: true, data: { id: 1, name: 'test' } }
      const result = responseSchema.parse(validData)
      
      expect(result.success).toBe(true)
      expect(result.data.id).toBe(1)
      expect(result.data.name).toBe('test')
    })

    test('enforces success literal true', () => {
      const dataSchema = z.object({ id: z.number() })
      const responseSchema = createApiResponseSchema(dataSchema, 'TestResponse')
      
      expect(() => responseSchema.parse({ success: false, data: { id: 1 } }))
        .toThrow()
    })

    test('validates data against provided schema', () => {
      const dataSchema = z.object({ id: z.number().positive() })
      const responseSchema = createApiResponseSchema(dataSchema, 'TestResponse')
      
      expect(() => responseSchema.parse({ success: true, data: { id: -1 } }))
        .toThrow()
      
      expect(() => responseSchema.parse({ success: true, data: { id: 'invalid' } }))
        .toThrow()
    })

    test('applies openapi name', () => {
      const dataSchema = z.string()
      const responseSchema = createApiResponseSchema(dataSchema, 'MyResponse')
      
      // The schema should have openapi metadata with refId
      expect(responseSchema._def.openapi?._internal?.refId).toBe('MyResponse')
    })
  })

  describe('createListResponseSchema', () => {
    test('creates list response schema', () => {
      const itemSchema = z.object({ id: z.number() })
      const listSchema = createListResponseSchema(itemSchema, 'TestList')
      
      const validData = {
        success: true,
        data: [{ id: 1 }, { id: 2 }]
      }
      
      const result = listSchema.parse(validData)
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data[0]?.id).toBe(1)
    })

    test('accepts empty array', () => {
      const itemSchema = z.object({ id: z.number() })
      const listSchema = createListResponseSchema(itemSchema, 'TestList')
      
      const result = listSchema.parse({ success: true, data: [] })
      expect(result.data).toHaveLength(0)
    })

    test('validates each item in array', () => {
      const itemSchema = z.object({ id: z.number().positive() })
      const listSchema = createListResponseSchema(itemSchema, 'TestList')
      
      expect(() => listSchema.parse({
        success: true,
        data: [{ id: 1 }, { id: -1 }]
      })).toThrow()
    })
  })

  describe('createPaginatedResponseSchema', () => {
    test('creates paginated response schema', () => {
      const itemSchema = z.object({ id: z.number() })
      const paginatedSchema = createPaginatedResponseSchema(itemSchema, 'TestPaginated')
      
      const validData = {
        success: true,
        data: [{ id: 1 }, { id: 2 }],
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          hasMore: true
        }
      }
      
      const result = paginatedSchema.parse(validData)
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.hasMore).toBe(true)
    })

    test('validates pagination fields', () => {
      const itemSchema = z.object({ id: z.number() })
      const paginatedSchema = createPaginatedResponseSchema(itemSchema, 'TestPaginated')
      
      // Page must be positive
      expect(() => paginatedSchema.parse({
        success: true,
        data: [],
        pagination: { page: 0, limit: 10, total: 0, hasMore: false }
      })).toThrow()
      
      // Limit must not exceed 100
      expect(() => paginatedSchema.parse({
        success: true,
        data: [],
        pagination: { page: 1, limit: 101, total: 0, hasMore: false }
      })).toThrow()
      
      // Total must be non-negative
      expect(() => paginatedSchema.parse({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: -1, hasMore: false }
      })).toThrow()
    })

    test('accepts valid pagination boundaries', () => {
      const itemSchema = z.object({ id: z.number() })
      const paginatedSchema = createPaginatedResponseSchema(itemSchema, 'TestPaginated')
      
      const result = paginatedSchema.parse({
        success: true,
        data: [],
        pagination: { page: 1, limit: 100, total: 0, hasMore: false }
      })
      
      expect(result.pagination.limit).toBe(100)
      expect(result.pagination.total).toBe(0)
    })
  })

  describe('createCrudValidationSchemas', () => {
    test('creates complete CRUD validation schemas', () => {
      const createSchema = z.object({ name: z.string() })
      const updateSchema = z.object({ name: z.string().optional() })
      
      const schemas = createCrudValidationSchemas(createSchema, updateSchema)
      
      expect(schemas).toHaveProperty('create')
      expect(schemas).toHaveProperty('update')
      expect(schemas).toHaveProperty('get')
      expect(schemas).toHaveProperty('delete')
      expect(schemas).toHaveProperty('list')
    })

    test('uses default ID schema for params', () => {
      const createSchema = z.object({ name: z.string() })
      const updateSchema = z.object({ name: z.string().optional() })
      
      const schemas = createCrudValidationSchemas(createSchema, updateSchema)
      
      // Should parse string to number
      const getResult = schemas.get.params.parse({ id: '123' })
      expect(getResult.id).toBe(123)
      expect(typeof getResult.id).toBe('number')
    })

    test('accepts custom ID schema', () => {
      const createSchema = z.object({ name: z.string() })
      const updateSchema = z.object({ name: z.string().optional() })
      const customIdSchema = z.string().uuid()
      
      const schemas = createCrudValidationSchemas(createSchema, updateSchema, customIdSchema)
      
      // Should validate as UUID string
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const getResult = schemas.get.params.parse({ id: uuid })
      expect(getResult.id).toBe(uuid)
    })

    test('validates create body schema', () => {
      const createSchema = z.object({ 
        name: z.string().min(1),
        email: z.string().email()
      })
      const updateSchema = z.object({ name: z.string().optional() })
      
      const schemas = createCrudValidationSchemas(createSchema, updateSchema)
      
      expect(() => schemas.create.body.parse({
        name: '',
        email: 'invalid-email'
      })).toThrow()
      
      const validResult = schemas.create.body.parse({
        name: 'John',
        email: 'john@example.com'
      })
      expect(validResult.name).toBe('John')
    })

    test('handles list query parameters', () => {
      const createSchema = z.object({ name: z.string() })
      const updateSchema = z.object({ name: z.string().optional() })
      
      const schemas = createCrudValidationSchemas(createSchema, updateSchema)
      
      // Default values
      const defaultResult = schemas.list.query!.parse({})
      expect(defaultResult?.page).toBe(1)
      expect(defaultResult?.limit).toBe(20)
      
      // Custom values
      const customResult = schemas.list.query!.parse({
        page: '3',
        limit: '50',
        search: 'test'
      })
      expect(customResult?.page).toBe(3)
      expect(customResult?.limit).toBe(50)
      expect(customResult?.search).toBe('test')
    })
  })

  describe('createTimestampFields', () => {
    test('creates timestamp fields with correct validation', () => {
      const fields = createTimestampFields()
      
      expect(fields).toHaveProperty('created')
      expect(fields).toHaveProperty('updated')
    })

    test('validates timestamps as positive integers', () => {
      const fields = createTimestampFields()
      const now = Date.now()
      
      expect(fields.created.parse(now)).toBe(now)
      expect(fields.updated.parse(now)).toBe(now)
      
      expect(() => fields.created.parse(-1)).toThrow()
      expect(() => fields.updated.parse(0)).toThrow()
      expect(() => fields.created.parse(1.5)).toThrow()
    })

    test('includes helpful descriptions', () => {
      const fields = createTimestampFields()
      
      expect(fields.created.description).toContain('Unix timestamp')
      expect(fields.updated.description).toContain('milliseconds')
    })
  })

  describe('createBaseEntitySchema', () => {
    test('creates entity schema with ID and timestamps', () => {
      const fields = {
        name: z.string(),
        status: z.enum(['active', 'inactive'])
      }
      
      const schema = createBaseEntitySchema(fields, 'TestEntity')
      
      const validData = {
        id: 1,
        created: Date.now(),
        updated: Date.now(),
        name: 'Test',
        status: 'active' as const
      }
      
      const result = schema.parse(validData)
      expect(result.id).toBe(1)
      expect(result.name).toBe('Test')
      expect(result.status).toBe('active')
    })

    test('requires all base fields', () => {
      const fields = { name: z.string() }
      const schema = createBaseEntitySchema(fields, 'TestEntity')
      
      expect(() => schema.parse({
        // Missing id, created, updated
        name: 'Test'
      })).toThrow()
    })

    test('applies openapi name', () => {
      const fields = { name: z.string() }
      const schema = createBaseEntitySchema(fields, 'MyEntity')
      
      expect(schema._def.openapi?._internal?.refId).toBe('MyEntity')
    })
  })

  describe('createSearchQuerySchema', () => {
    test('creates search schema with default parameters', () => {
      const schema = createSearchQuerySchema()
      
      const defaultResult = schema.parse({})
      expect(defaultResult.page).toBe(1)
      expect(defaultResult.limit).toBe(20)
      expect(defaultResult.sortOrder).toBe('asc')
    })

    test('accepts additional custom fields', () => {
      const additionalFields = {
        category: z.string(),
        status: z.enum(['active', 'inactive'])
      }
      
      const schema = createSearchQuerySchema(additionalFields)
      
      const result = schema.parse({
        q: 'test',
        category: 'tech',
        status: 'active'
      })
      
      expect(result.q).toBe('test')
      expect((result as any).category).toBe('tech')
      expect((result as any).status).toBe('active')
    })

    test('validates numeric constraints', () => {
      const schema = createSearchQuerySchema()
      
      // Page must be positive
      expect(() => schema.parse({ page: 0 })).toThrow()
      
      // Limit cannot exceed 100
      expect(() => schema.parse({ limit: 101 })).toThrow()
    })

    test('coerces string numbers', () => {
      const schema = createSearchQuerySchema()
      
      const result = schema.parse({
        page: '3',
        limit: '50'
      })
      
      expect(result.page).toBe(3)
      expect(result.limit).toBe(50)
    })
  })

  describe('createEnumField', () => {
    test('creates enum field with default value', () => {
      const priorities = ['low', 'normal', 'high'] as const
      const field = createEnumField(priorities, 'normal', 'Priority level')
      
      // Uses default
      expect(field.parse(undefined)).toBe('normal')
      
      // Accepts valid values
      expect(field.parse('high')).toBe('high')
      
      // Rejects invalid values
      expect(() => field.parse('invalid')).toThrow()
    })

    test('includes description', () => {
      const statuses = ['active', 'inactive'] as const
      const field = createEnumField(statuses, 'active')
      
      expect(field.description).toContain('active, inactive')
    })

    test('uses custom description when provided', () => {
      const types = ['A', 'B'] as const
      const field = createEnumField(types, 'A', 'Custom description')
      
      expect(field.description).toBe('Custom description')
    })
  })

  describe('createArrayField', () => {
    test('creates array field with default empty array', () => {
      const field = createArrayField(z.string())
      
      // Uses default
      expect(field.parse(undefined)).toEqual([])
      
      // Accepts arrays
      expect(field.parse(['a', 'b'])).toEqual(['a', 'b'])
    })

    test('validates array items', () => {
      const field = createArrayField(z.number().positive())
      
      expect(field.parse([1, 2, 3])).toEqual([1, 2, 3])
      
      expect(() => field.parse([1, -1, 3])).toThrow()
    })

    test('includes description', () => {
      const field = createArrayField(z.string(), 'List of tags')
      
      expect(field.description).toBe('List of tags')
    })
  })

  describe('createNullableField', () => {
    test('creates nullable optional field', () => {
      const field = createNullableField(z.string())
      
      expect(field.parse(undefined)).toBeUndefined()
      expect(field.parse(null)).toBeNull()
      expect(field.parse('value')).toBe('value')
    })

    test('validates underlying schema when value provided', () => {
      const field = createNullableField(z.string().min(3))
      
      expect(() => field.parse('ab')).toThrow()
      expect(field.parse('abc')).toBe('abc')
    })
  })

  describe('createFlexibleField', () => {
    test('preprocesses values before validation', () => {
      const field = createFlexibleField(
        z.number(),
        (value) => typeof value === 'string' ? parseInt(value, 10) : value as number
      )
      
      expect(field.parse('123')).toBe(123)
      expect(field.parse(456)).toBe(456)
    })

    test('runs validation after preprocessing', () => {
      const field = createFlexibleField(
        z.number().positive(),
        (value) => typeof value === 'string' ? parseInt(value, 10) : value as number
      )
      
      expect(() => field.parse('-123')).toThrow()
    })
  })

  describe('commonFields', () => {
    test('provides standard entity fields', () => {
      expect(commonFields).toHaveProperty('id')
      expect(commonFields).toHaveProperty('name')
      expect(commonFields).toHaveProperty('description')
      expect(commonFields).toHaveProperty('status')
      expect(commonFields).toHaveProperty('priority')
      expect(commonFields).toHaveProperty('tags')
      expect(commonFields).toHaveProperty('metadata')
      expect(commonFields).toHaveProperty('created')
      expect(commonFields).toHaveProperty('updated')
    })

    test('validates common field constraints', () => {
      expect(commonFields.id.parse(1)).toBe(1)
      expect(() => commonFields.id.parse(-1)).toThrow()
      
      expect(commonFields.name.parse('Test')).toBe('Test')
      expect(() => commonFields.name.parse('')).toThrow()
      
      expect(commonFields.description.parse(undefined)).toBe('')
      
      expect(commonFields.status.parse(undefined)).toBe('active')
      expect(commonFields.priority.parse(undefined)).toBe('normal')
      expect(commonFields.tags.parse(undefined)).toEqual([])
      expect(commonFields.metadata.parse(undefined)).toEqual({})
    })

    test('accepts valid enum values', () => {
      expect(commonFields.status.parse('inactive')).toBe('inactive')
      expect(commonFields.priority.parse('urgent')).toBe('urgent')
      
      expect(() => commonFields.status.parse('invalid')).toThrow()
      expect(() => commonFields.priority.parse('invalid')).toThrow()
    })
  })

  describe('createEntitySchemas', () => {
    test('creates base, create, and update schemas', () => {
      const baseFields = {
        name: z.string(),
        email: z.string().email()
      }
      
      const schemas = createEntitySchemas('User', baseFields)
      
      expect(schemas).toHaveProperty('base')
      expect(schemas).toHaveProperty('create')
      expect(schemas).toHaveProperty('update')
    })

    test('create schema excludes ID and timestamps', () => {
      const baseFields = { name: z.string() }
      const schemas = createEntitySchemas('User', baseFields)
      
      const createData = { name: 'John' }
      const result = schemas.create.parse(createData)
      
      expect((result as any).name).toBe('John')
      expect(result).not.toHaveProperty('id')
      expect(result).not.toHaveProperty('created')
      expect(result).not.toHaveProperty('updated')
    })

    test('update schema is partial and excludes ID/timestamps', () => {
      const baseFields = {
        name: z.string(),
        email: z.string().email()
      }
      const schemas = createEntitySchemas('User', baseFields)
      
      // Should accept partial updates
      const result = schemas.update.parse({ name: 'Jane' }) as any
      expect(result.name).toBe('Jane')
      expect(result.email).toBeUndefined()
    })

    test('respects custom exclude options', () => {
      const baseFields = {
        name: z.string(),
        password: z.string(),
        role: z.string()
      }
      
      const schemas = createEntitySchemas('User', baseFields, {
        createExcludes: ['role'],
        updateExcludes: ['password']
      })
      
      // Create should accept valid fields but exclude the role field from result
      const createResult = schemas.create.parse({
        name: 'John',
        password: 'secret',
        role: 'admin' // This will be omitted from the result
      })
      
      expect((createResult as any).name).toBe('John')
      expect((createResult as any).password).toBe('secret')
      expect(createResult).not.toHaveProperty('role')
      
      // Update should accept partial fields but exclude password from result
      const updateResult = schemas.update.parse({
        name: 'Jane',
        password: 'newpassword' // This will be omitted from the result
      })
      
      expect((updateResult as any).name).toBe('Jane')
      expect(updateResult).not.toHaveProperty('password')
    })

    test('applies correct openapi names', () => {
      const baseFields = { name: z.string() }
      const schemas = createEntitySchemas('User', baseFields)
      
      expect(schemas.base._def.openapi?._internal?.refId).toBe('User')
      expect(schemas.create._def.openapi?._internal?.refId).toBe('CreateUser')
      expect(schemas.update._def.openapi?._internal?.refId).toBe('UpdateUser')
    })
  })

  describe('createCrudSchemas', () => {
    test('creates entity schemas with response wrappers', () => {
      const baseFields = { name: z.string() }
      const schemas = createCrudSchemas('User', baseFields)
      
      expect(schemas).toHaveProperty('base')
      expect(schemas).toHaveProperty('create')
      expect(schemas).toHaveProperty('update')
      expect(schemas).toHaveProperty('responses')
      expect(schemas.responses).toHaveProperty('single')
      expect(schemas.responses).toHaveProperty('list')
      expect(schemas.responses).toHaveProperty('paginated')
    })

    test('response schemas wrap base entity', () => {
      const baseFields = { name: z.string() }
      const schemas = createCrudSchemas('User', baseFields)
      
      const user = {
        id: 1,
        name: 'John',
        created: Date.now(),
        updated: Date.now()
      }
      
      const singleResponse = schemas.responses.single.parse({
        success: true,
        data: user
      })
      
      expect(singleResponse.success).toBe(true)
      expect(singleResponse.data.name).toBe('John')
    })
  })

  describe('createResponseSchemas', () => {
    test('creates all response schema types', () => {
      const dataSchema = z.object({ id: z.number() })
      const schemas = createResponseSchemas(dataSchema, 'Item')
      
      expect(schemas).toHaveProperty('single')
      expect(schemas).toHaveProperty('list')
      expect(schemas).toHaveProperty('paginated')
    })

    test('uses consistent naming', () => {
      const dataSchema = z.object({ id: z.number() })
      const schemas = createResponseSchemas(dataSchema, 'Product')
      
      expect(schemas.single._def.openapi?._internal?.refId).toBe('ProductResponse')
      expect(schemas.list._def.openapi?._internal?.refId).toBe('ProductListResponse')
      expect(schemas.paginated._def.openapi?._internal?.refId).toBe('ProductPaginatedResponse')
    })
  })

  describe('createPaginatedSchema', () => {
    test('is alias for createPaginatedResponseSchema', () => {
      const itemSchema = z.object({ id: z.number() })
      
      const schema1 = createPaginatedSchema(itemSchema, 'Test')
      const schema2 = createPaginatedResponseSchema(itemSchema, 'Test')
      
      const testData = {
        success: true,
        data: [{ id: 1 }],
        pagination: { page: 1, limit: 10, total: 1, hasMore: false }
      }
      
      expect(schema1.parse(testData)).toEqual(schema2.parse(testData))
    })
  })

  describe('createValidationErrorSchema', () => {
    test('creates validation error structure', () => {
      const schema = createValidationErrorSchema()
      
      const error = schema.parse({
        field: 'email',
        message: 'Invalid email format',
        code: 'invalid_email'
      })
      
      expect(error.field).toBe('email')
      expect(error.message).toBe('Invalid email format')
      expect(error.code).toBe('invalid_email')
    })

    test('code is optional', () => {
      const schema = createValidationErrorSchema()
      
      const error = schema.parse({
        field: 'name',
        message: 'Required field'
      })
      
      expect(error.code).toBeUndefined()
    })
  })

  describe('standardErrorSchema', () => {
    test('validates standard error response structure', () => {
      const error = standardErrorSchema.parse({
        success: false,
        error: {
          message: 'Something went wrong',
          code: 'INTERNAL_ERROR'
        }
      })
      
      expect(error.success).toBe(false)
      expect(error.error.message).toBe('Something went wrong')
    })

    test('includes validation errors when present', () => {
      const error = standardErrorSchema.parse({
        success: false,
        error: {
          message: 'Validation failed',
          validationErrors: [
            { field: 'email', message: 'Invalid email' }
          ]
        }
      })
      
      expect(error.error.validationErrors).toHaveLength(1)
      expect(error.error.validationErrors![0]?.field).toBe('email')
    })

    test('enforces success literal false', () => {
      expect(() => standardErrorSchema.parse({
        success: true,
        error: { message: 'Error' }
      })).toThrow()
    })
  })

  describe('createBatchRequestSchema', () => {
    test('creates batch request schema with item validation', () => {
      const itemSchema = z.object({ name: z.string() })
      const batchSchema = createBatchRequestSchema(itemSchema)
      
      const request = batchSchema.parse({
        items: [{ name: 'Item 1' }, { name: 'Item 2' }],
        continueOnError: true
      })
      
      expect(request.items).toHaveLength(2)
      expect(request.continueOnError).toBe(true)
    })

    test('uses default values', () => {
      const itemSchema = z.object({ name: z.string() })
      const batchSchema = createBatchRequestSchema(itemSchema)
      
      const request = batchSchema.parse({
        items: [{ name: 'Item 1' }]
      })
      
      expect(request.continueOnError).toBe(false)
    })

    test('enforces item limits', () => {
      const itemSchema = z.object({ name: z.string() })
      const batchSchema = createBatchRequestSchema(itemSchema, 2)
      
      expect(() => batchSchema.parse({
        items: [{ name: '1' }, { name: '2' }, { name: '3' }]
      })).toThrow()
    })

    test('requires at least one item', () => {
      const itemSchema = z.object({ name: z.string() })
      const batchSchema = createBatchRequestSchema(itemSchema)
      
      expect(() => batchSchema.parse({ items: [] })).toThrow()
    })
  })

  describe('createBatchResponseSchema', () => {
    test('creates batch response with success and failure tracking', () => {
      const itemSchema = z.object({ id: z.number(), name: z.string() })
      const responseSchema = createBatchResponseSchema(itemSchema)
      
      const response = responseSchema.parse({
        success: true,
        data: {
          successful: [{ id: 1, name: 'Success' }],
          failed: [
            {
              item: { id: 2, name: 'Failed' },
              error: 'Validation error',
              index: 1
            }
          ],
          total: 2,
          successCount: 1,
          failureCount: 1
        }
      })
      
      expect(response.data.successful).toHaveLength(1)
      expect(response.data.failed).toHaveLength(1)
      expect(response.data.total).toBe(2)
    })

    test('handles empty results', () => {
      const itemSchema = z.object({ id: z.number() })
      const responseSchema = createBatchResponseSchema(itemSchema)
      
      const response = responseSchema.parse({
        success: true,
        data: {
          successful: [],
          failed: [],
          total: 0,
          successCount: 0,
          failureCount: 0
        }
      })
      
      expect(response.data.total).toBe(0)
    })

    test('failed items have optional item field', () => {
      const itemSchema = z.object({ id: z.number() })
      const responseSchema = createBatchResponseSchema(itemSchema)
      
      const response = responseSchema.parse({
        success: true,
        data: {
          successful: [],
          failed: [
            {
              error: 'Parse error',
              index: 0
              // item is optional when parsing failed
            }
          ],
          total: 1,
          successCount: 0,
          failureCount: 1
        }
      })
      
      expect(response.data.failed[0]?.item).toBeUndefined()
    })
  })

  describe('schemaFactories export', () => {
    test('exports all factory functions', () => {
      expect(schemaFactories).toHaveProperty('apiResponse')
      expect(schemaFactories).toHaveProperty('listResponse')
      expect(schemaFactories).toHaveProperty('paginatedResponse')
      expect(schemaFactories).toHaveProperty('crudValidation')
      expect(schemaFactories).toHaveProperty('baseEntity')
      expect(schemaFactories).toHaveProperty('entitySchemas')
      expect(schemaFactories).toHaveProperty('crudSchemas')
      expect(schemaFactories).toHaveProperty('responseSchemas')
      expect(schemaFactories).toHaveProperty('searchQuery')
      expect(schemaFactories).toHaveProperty('enumField')
      expect(schemaFactories).toHaveProperty('arrayField')
      expect(schemaFactories).toHaveProperty('nullableField')
      expect(schemaFactories).toHaveProperty('flexibleField')
      expect(schemaFactories).toHaveProperty('batchRequest')
      expect(schemaFactories).toHaveProperty('batchResponse')
    })

    test('factory functions work correctly', () => {
      const dataSchema = z.object({ id: z.number() })
      const response = schemaFactories.apiResponse(dataSchema, 'Test')
      
      const result = response.parse({ success: true, data: { id: 1 } })
      expect(result.data.id).toBe(1)
    })
  })

  describe('integration and real-world scenarios', () => {
    test('complete CRUD workflow', () => {
      // Define a realistic entity
      const baseFields = {
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(['user', 'admin']),
        isActive: z.boolean().default(true),
        tags: z.array(z.string()).default([]),
        metadata: z.record(z.any()).default({})
      }
      
      const schemas = createCrudSchemas('User', baseFields, {
        updateExcludes: ['email'] // Email cannot be updated
      })
      
      // Test create
      const createData = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user' as const
      }
      const createdUser = schemas.create.parse(createData)
      expect((createdUser as any).name).toBe('John Doe')
      expect((createdUser as any).isActive).toBe(true) // default
      
      // Test full entity
      const fullUser = {
        id: 1,
        created: Date.now(),
        updated: Date.now(),
        ...createData,
        isActive: true,
        tags: [],
        metadata: {}
      }
      const entityUser = schemas.base.parse(fullUser) as any
      expect(entityUser.id).toBe(1)
      
      // Test update (partial, no email)
      const updateUser = schemas.update.parse({ name: 'Jane Doe' }) as any
      expect(updateUser.name).toBe('Jane Doe')
      expect(updateUser.email).toBeUndefined()
      
      // Test responses
      const singleResponse = schemas.responses.single.parse({
        success: true,
        data: fullUser
      })
      expect(singleResponse.data.name).toBe('John Doe')
    })

    test('validation schemas for API endpoints', () => {
      const createSchema = z.object({
        title: z.string().min(1),
        content: z.string(),
        tags: z.array(z.string()).default([])
      })
      const updateSchema = z.object({
        title: z.string().min(1).optional(),
        content: z.string().optional()
      })
      
      const validation = createCrudValidationSchemas(createSchema, updateSchema)
      
      // Test list query parsing
      const listQuery = validation.list.query!.parse({
        page: '2',
        limit: '50',
        search: 'react'
      })
      expect(listQuery?.page).toBe(2)
      expect(listQuery?.search).toBe('react')
      
      // Test ID parsing
      const getParams = validation.get.params.parse({ id: '123' })
      expect(getParams.id).toBe(123)
    })

    test('search and filtering with custom fields', () => {
      const searchSchema = createSearchQuerySchema({
        category: z.string().optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        authorId: z.coerce.number().positive().optional()
      })
      
      const query = searchSchema.parse({
        q: 'react tutorial',
        category: 'programming',
        status: 'published',
        authorId: '456',
        sortBy: 'created',
        sortOrder: 'desc'
      })
      
      expect(query.q).toBe('react tutorial')
      expect((query as any).category).toBe('programming')
      expect((query as any).authorId).toBe(456)
      expect(query.sortOrder).toBe('desc')
    })

    test('batch operations workflow', () => {
      const itemSchema = z.object({
        name: z.string().min(1),
        value: z.number()
      })
      
      const batchRequest = createBatchRequestSchema(itemSchema, 5)
      const batchResponse = createBatchResponseSchema(itemSchema)
      
      // Valid batch request
      const request = batchRequest.parse({
        items: [
          { name: 'Item 1', value: 10 },
          { name: 'Item 2', value: 20 }
        ],
        continueOnError: true
      })
      
      // Mock response with mixed results
      const response = batchResponse.parse({
        success: true,
        data: {
          successful: [{ name: 'Item 1', value: 10 }],
          failed: [
            {
              item: { name: 'Item 2', value: 20 },
              error: 'Duplicate name',
              index: 1
            }
          ],
          total: 2,
          successCount: 1,
          failureCount: 1
        }
      })
      
      expect(response.data.successCount).toBe(1)
      expect(response.data.failureCount).toBe(1)
    })

    test('complex nested schemas', () => {
      const addressSchema = z.object({
        street: z.string(),
        city: z.string(),
        zipCode: z.string()
      })
      
      const baseFields = {
        name: z.string(),
        email: z.string().email(),
        addresses: createArrayField(addressSchema, 'User addresses'),
        primaryAddress: createNullableField(addressSchema, 'Primary address'),
        status: createEnumField(['active', 'suspended', 'deleted'] as const, 'active'),
        preferences: z.record(z.union([z.string(), z.number(), z.boolean()])).default({})
      }
      
      const schemas = createEntitySchemas('User', baseFields)
      
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        addresses: [
          { street: '123 Main St', city: 'Boston', zipCode: '02101' }
        ],
        primaryAddress: null,
        preferences: { theme: 'dark', notifications: true }
      }
      
      const user = schemas.create.parse(userData)
      expect((user as any).addresses).toHaveLength(1)
      expect((user as any).status).toBe('active') // default
      expect((user as any).preferences.theme).toBe('dark')
    })

    test('type inference and TypeScript integration', () => {
      const baseFields = {
        name: z.string(),
        count: z.number()
      }
      
      const schemas = createEntitySchemas('Item', baseFields)
      
      // Type inference should work
      type BaseItem = z.infer<typeof schemas.base>
      type CreateItem = z.infer<typeof schemas.create>
      type UpdateItem = z.infer<typeof schemas.update>
      
      // These should compile without errors
      const baseItem: BaseItem = {
        id: 1,
        created: Date.now(),
        updated: Date.now(),
        name: 'Test',
        count: 5
      }
      
      const createItem: CreateItem = {
        name: 'New Item',
        count: 10
      }
      
      const updateItem: UpdateItem = {
        name: 'Updated Name'
        // count is optional in update
      }
      
      expect(baseItem.id).toBe(1)
      expect((createItem as any).name).toBe('New Item')
      expect((updateItem as any).count).toBeUndefined()
    })

    test('error handling and validation messages', () => {
      const createSchema = z.object({
        email: z.string().email('Invalid email format'),
        age: z.number().min(0, 'Age must be non-negative').max(150, 'Age too high'),
        name: z.string().min(1, 'Name is required')
      })
      
      try {
        createSchema.parse({
          email: 'invalid-email',
          age: -5,
          name: ''
        })
        throw new Error('Should have thrown validation error')
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError)
        const zodError = error as z.ZodError
        expect(zodError.issues).toHaveLength(3)
        
        const emailIssue = zodError.issues.find(i => i.path.includes('email'))
        expect(emailIssue?.message).toContain('Invalid email')
      }
    })
  })
})