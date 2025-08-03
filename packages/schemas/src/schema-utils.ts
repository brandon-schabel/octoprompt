import { unixTimestampSchema } from './unix-ts-utils'
import { z } from '@hono/zod-openapi'

export const unixTSSchemaSpec = unixTimestampSchema.openapi({
  example: 1716537600000,
  description: 'ID or Timestamp in unix timestamp (milliseconds)'
})
export const unixTSOptionalSchemaSpec = unixTSSchemaSpec
  .optional()
  .openapi({ example: 1716537600000, description: 'Optional ID or Timestamp in unix timestamp (milliseconds)' })
export const unixTSArraySchemaSpec = z.array(unixTSSchemaSpec).openapi({
  example: [1716537600000, 1716537600001],
  description: 'Array of IDs or Timestamps in unix timestamp (milliseconds)'
})
export const unixTSArrayOptionalSchemaSpec = z.array(unixTSOptionalSchemaSpec).openapi({
  example: [1716537600000, 1716537600001],
  description: 'Array of Optional IDs or Timestamps in unix timestamp (milliseconds)'
})

// Special schemas for ID fields that can accept -1 as "null" value
export const idSchemaSpec = z
  .number()
  .int()
  .refine(
    (val) => val === -1 || (val >= 0 && val <= 2524608000000), // -1 or valid timestamp range
    { message: 'ID must be -1 (null) or a valid timestamp' }
  )
  .openapi({
    example: 1716537600000,
    description: 'ID field that accepts -1 as null or valid unix timestamp (milliseconds)'
  })

export const idArraySchemaSpec = z.array(idSchemaSpec).openapi({
  example: [1716537600000, 1716537600001],
  description: 'Array of ID fields that accept -1 as null or valid unix timestamps (milliseconds)'
})

// Entity ID schema - for database record IDs that should NOT be converted
// This schema accepts positive integers without any timestamp preprocessing
export const entityIdSchema = z
  .number()
  .int('ID must be an integer')
  .positive('ID must be positive')
  .max(2524608000000, 'ID exceeds maximum allowed value')
  .openapi({
    type: 'integer',
    format: 'int64',
    example: 1716537600000,
    description: 'Entity ID - positive integer without timestamp conversion'
  })

// Optional entity ID schema
export const entityIdOptionalSchema = entityIdSchema.optional().openapi({
  type: 'integer',
  format: 'int64',
  example: 1716537600000,
  description: 'Optional entity ID - positive integer without timestamp conversion'
})

// Nullable optional entity ID schema
export const entityIdNullableOptionalSchema = entityIdSchema.nullable().optional().openapi({
  type: 'integer',
  format: 'int64',
  example: 1716537600000,
  description: 'Nullable optional entity ID - positive integer without timestamp conversion'
})

// Array of entity IDs
export const entityIdArraySchema = z.array(entityIdSchema).openapi({
  example: [1716537600000, 1716537600001],
  description: 'Array of entity IDs'
})
