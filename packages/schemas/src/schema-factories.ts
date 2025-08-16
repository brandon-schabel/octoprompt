import { z } from 'zod'

/**
 * Schema factories to reduce repetitive schema definitions
 */

/**
 * Create a standard API response schema
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  name: string
) {
  return z
    .object({
      success: z.literal(true),
      data: dataSchema
    })
    .openapi(name)
}

/**
 * Create a list response schema
 */
export function createListResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string
) {
  return z
    .object({
      success: z.literal(true),
      data: z.array(itemSchema)
    })
    .openapi(name)
}

/**
 * Create a paginated response schema
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string
) {
  return z
    .object({
      success: z.literal(true),
      data: z.array(itemSchema),
      pagination: z.object({
        page: z.number().int().positive(),
        limit: z.number().int().positive().max(100),
        total: z.number().int().min(0),
        hasMore: z.boolean()
      })
    })
    .openapi(name)
}

/**
 * Create standard CRUD validation schemas
 */
export function createCrudValidationSchemas<
  TCreate extends z.ZodTypeAny,
  TUpdate extends z.ZodTypeAny
>(
  createSchema: TCreate,
  updateSchema: TUpdate,
  idSchema: z.ZodTypeAny = z.string().transform(val => parseInt(val, 10))
) {
  return {
    create: {
      body: createSchema
    },
    update: {
      params: z.object({ id: idSchema }),
      body: updateSchema
    },
    get: {
      params: z.object({ id: idSchema })
    },
    delete: {
      params: z.object({ id: idSchema })
    },
    list: {
      query: z.object({
        page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
        search: z.string().optional()
      }).optional()
    }
  }
}

/**
 * Create timestamp fields schema
 */
export function createTimestampFields() {
  return {
    created: z.number().int().positive().describe('Unix timestamp in milliseconds'),
    updated: z.number().int().positive().describe('Unix timestamp in milliseconds')
  }
}

/**
 * Create base entity schema with common fields
 */
export function createBaseEntitySchema<T extends z.ZodRawShape>(
  fields: T,
  name: string
) {
  return z
    .object({
      id: z.number().int().positive(),
      ...createTimestampFields(),
      ...fields
    })
    .openapi(name)
}

/**
 * Create search/filter query schema
 */
export function createSearchQuerySchema(
  additionalFields: z.ZodRawShape = {}
) {
  return z.object({
    q: z.string().optional().describe('Search query'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    ...additionalFields
  })
}

/**
 * Create enum field with default
 */
export function createEnumField<T extends readonly [string, ...string[]]>(
  values: T,
  defaultValue: T[number],
  description?: string
) {
  return z.enum(values).default(defaultValue).describe(description || `One of: ${values.join(', ')}`)
}

/**
 * Create optional array field with default empty array
 */
export function createArrayField<T extends z.ZodTypeAny>(
  itemSchema: T,
  description?: string
) {
  return z
    .array(itemSchema)
    .default([])
    .describe(description || 'Array of items')
}

/**
 * Create nullable optional field
 */
export function createNullableField<T extends z.ZodTypeAny>(
  schema: T,
  description?: string
) {
  return schema.nullable().optional().describe(description || 'Optional nullable field')
}

/**
 * Create a field that accepts multiple input types but normalizes to one
 */
export function createFlexibleField<T>(
  targetType: z.ZodType<T>,
  preprocessor: (value: unknown) => T
) {
  return z.preprocess(preprocessor, targetType)
}

/**
 * Common field schemas that are reused across entities
 */
export const commonFields = {
  id: z.number().int().positive().describe('Unique identifier'),
  
  name: z.string().min(1).max(255).describe('Name of the entity'),
  
  description: z.string().default('').describe('Optional description'),
  
  status: createEnumField(
    ['active', 'inactive', 'pending', 'archived'] as const,
    'active',
    'Entity status'
  ),
  
  priority: createEnumField(
    ['low', 'normal', 'high', 'urgent'] as const,
    'normal',
    'Priority level'
  ),
  
  tags: createArrayField(z.string(), 'Tags for categorization'),
  
  metadata: z.record(z.any()).default({}).describe('Additional metadata'),
  
  ...createTimestampFields()
}

/**
 * Create entity CRUD schemas following standard patterns
 */
export function createEntitySchemas<T extends z.ZodRawShape>(
  name: string,
  baseFields: T,
  options: {
    createExcludes?: string[]
    updateExcludes?: string[]
  } = {}
) {
  const { createExcludes = [], updateExcludes = [] } = options
  
  // Base entity with timestamps and ID
  const baseSchema = createBaseEntitySchema(baseFields, name)
  
  // Create schema (exclude ID and timestamps, plus any specified excludes)
  const createExcludeKeys = ['id', 'created', 'updated', ...createExcludes]
  const createOmitObj = Object.fromEntries(createExcludeKeys.map(key => [key, true])) as Record<string, true>
  const createSchema = baseSchema.omit(createOmitObj as any).openapi(`Create${name}`)
  
  // Update schema (partial, exclude ID and timestamps, plus any specified excludes)
  const updateExcludeKeys = ['id', 'created', 'updated', ...updateExcludes]
  const updateOmitObj = Object.fromEntries(updateExcludeKeys.map(key => [key, true])) as Record<string, true>
  const updateSchema = baseSchema.omit(updateOmitObj as any).partial().openapi(`Update${name}`)
  
  return {
    base: baseSchema,
    create: createSchema,
    update: updateSchema
  }
}

/**
 * Create standard CRUD schemas with response wrappers
 */
export function createCrudSchemas<T extends z.ZodRawShape>(
  name: string,
  baseFields: T,
  options: {
    createExcludes?: string[]
    updateExcludes?: string[]
  } = {}
) {
  const entities = createEntitySchemas(name, baseFields, options)
  
  return {
    ...entities,
    responses: {
      single: createApiResponseSchema(entities.base, `${name}Response`),
      list: createListResponseSchema(entities.base, `${name}ListResponse`),
      paginated: createPaginatedResponseSchema(entities.base, `${name}PaginatedResponse`)
    }
  }
}

/**
 * Create paginated schema (alias for existing function)
 */
export function createPaginatedSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string
) {
  return createPaginatedResponseSchema(itemSchema, name)
}

/**
 * Create response schemas factory
 */
export function createResponseSchemas<T extends z.ZodTypeAny>(
  dataSchema: T,
  name: string
) {
  return {
    single: createApiResponseSchema(dataSchema, `${name}Response`),
    list: createListResponseSchema(dataSchema, `${name}ListResponse`),
    paginated: createPaginatedResponseSchema(dataSchema, `${name}PaginatedResponse`)
  }
}

/**
 * Create validation error details schema
 */
export function createValidationErrorSchema() {
  return z.object({
    field: z.string(),
    message: z.string(),
    code: z.string().optional()
  })
}

/**
 * Standard error response schema
 */
export const standardErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.any().optional(),
    validationErrors: z.array(createValidationErrorSchema()).optional()
  })
})

/**
 * Create batch operation request schema
 */
export function createBatchRequestSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  maxItems: number = 100
) {
  return z.object({
    items: z.array(itemSchema).min(1).max(maxItems),
    continueOnError: z.boolean().default(false)
  })
}

/**
 * Create batch operation response schema
 */
export function createBatchResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T
) {
  return z.object({
    success: z.literal(true),
    data: z.object({
      successful: z.array(itemSchema),
      failed: z.array(z.object({
        item: itemSchema.optional(),
        error: z.string(),
        index: z.number()
      })),
      total: z.number(),
      successCount: z.number(),
      failureCount: z.number()
    })
  })
}

/**
 * Export all factories for convenience
 */
export const schemaFactories = {
  apiResponse: createApiResponseSchema,
  listResponse: createListResponseSchema,
  paginatedResponse: createPaginatedResponseSchema,
  crudValidation: createCrudValidationSchemas,
  baseEntity: createBaseEntitySchema,
  entitySchemas: createEntitySchemas,
  crudSchemas: createCrudSchemas,
  responseSchemas: createResponseSchemas,
  paginatedSchema: createPaginatedSchema,
  searchQuery: createSearchQuerySchema,
  enumField: createEnumField,
  arrayField: createArrayField,
  nullableField: createNullableField,
  flexibleField: createFlexibleField,
  batchRequest: createBatchRequestSchema,
  batchResponse: createBatchResponseSchema
}