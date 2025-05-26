import { unixTimestampSchema } from "../utils/unix-ts-utils";
import { z } from "@hono/zod-openapi";

export const unixTSSchemaSpec = unixTimestampSchema.openapi({ example: 1716537600000, description: 'ID or Timestamp in unix timestamp (milliseconds)' })
export const unixTSOptionalSchemaSpec = unixTSSchemaSpec.optional().openapi({ example: 1716537600000, description: 'Optional ID or Timestamp in unix timestamp (milliseconds)' })
export const unixTSArraySchemaSpec = z.array(unixTSSchemaSpec).openapi({ example: [1716537600000, 1716537600001], description: 'Array of IDs or Timestamps in unix timestamp (milliseconds)' })
export const unixTSArrayOptionalSchemaSpec = z.array(unixTSOptionalSchemaSpec).openapi({ example: [1716537600000, 1716537600001], description: 'Array of Optional IDs or Timestamps in unix timestamp (milliseconds)' })

// Special schemas for ID fields that can accept -1 as "null" value
export const idSchemaSpec = z.number().int().refine(
    (val) => val === -1 || (val >= 0 && val <= 2524608000000), // -1 or valid timestamp range
    { message: 'ID must be -1 (null) or a valid timestamp' }
).openapi({
    example: 1716537600000,
    description: 'ID field that accepts -1 as null or valid unix timestamp (milliseconds)'
})

export const idArraySchemaSpec = z.array(idSchemaSpec).openapi({
    example: [1716537600000, 1716537600001],
    description: 'Array of ID fields that accept -1 as null or valid unix timestamps (milliseconds)'
})
