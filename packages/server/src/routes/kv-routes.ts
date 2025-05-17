import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

import { getKvValue, setKvValue, deleteKvKey, updateKVStore } from '@/services/kv-service'

import { ApiError } from 'shared'
import {
  KvSchemas,
  kvKeyEnumSchema,
  KVKeyEnum,
  KvKeyQuerySchema,
  KvSetBodySchema,
  KvGetResponseSchema,
  KvSetResponseSchema,
  KvDeleteResponseSchema,
  KVKey,
  KVDefaultValues,
  KVValue
} from 'shared/src/schemas/kv-store.schemas'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from 'shared/src/schemas/common.schemas'
import { getSchemaDefaults } from 'shared/src/utils/zod-utils'
import { ZodError } from 'zod'

const getKvValueRoute = createRoute({
  method: 'get',
  path: '/api/kv',
  tags: ['KV Store'],
  summary: 'Get a value from the KV store by key',
  request: {
    query: KvKeyQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: KvGetResponseSchema } },
      description: 'Successfully retrieved the value'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Key not found (though current service returns null)'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error (Invalid Key Format)'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// const updateKvValueRoute = createRoute({
//     method: 'patch',
//     path: '/api/kv/{key}',
//     tags: ['KV Store'],
//     summary: 'Partially update a value in the KV store by key',
//     request: {
//         params: z.object({ key: kvKeyEnumSchema }),
//         body: {
//             content: {
//                 'application/json': {
//                     schema: z.object({ value: z.any() }).openapi('KvPartialUpdateBody'),
//                 },
//             },
//         },
//     },
//     responses: {
//         200: {
//             content: { 'application/json': { schema: KvSetResponseSchema } },
//             description: 'Successfully updated the value'
//         },
//         400: {
//             content: { 'application/json': { schema: ApiErrorResponseSchema } },
//             description: 'Invalid request body or validation error'
//         },
//         404: {
//             content: { 'application/json': { schema: ApiErrorResponseSchema } },
//             description: 'Key not found'
//         },
//         500: {
//             content: { 'application/json': { schema: ApiErrorResponseSchema } },
//             description: 'Internal Server Error'
//         },
//     }
// });

// const setKvValueRoute = createRoute({
//     method: 'post',
//     path: '/api/kv/{key}',
//     tags: ['KV Store'],
//     summary: 'Set (overwrite) a value in the KV store by key',
//     request: {
//         params: z.object({ key: kvKeyEnumSchema }),
//         body: {
//             content: {
//                 'application/json': {
//                     schema: KvSetBodySchema,
//                 },
//             },
//         },
//     },
//     responses: {
//         200: {
//             content: { 'application/json': { schema: KvSetResponseSchema } },
//             description: 'Successfully set the value'
//         },
//         400: {
//             content: { 'application/json': { schema: ApiErrorResponseSchema } },
//             description: 'Invalid request body or validation error'
//         },
//         500: {
//             content: { 'application/json': { schema: ApiErrorResponseSchema } },
//             description: 'Internal Server Error'
//         },
//     }
// });

const deleteKvKeyRoute = createRoute({
  method: 'delete',
  path: '/api/kv',
  tags: ['KV Store'],
  summary: 'Delete a key-value pair from the KV store',
  request: {
    query: KvKeyQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: KvDeleteResponseSchema } },
      description: 'Successfully deleted the key'
    },
    // Note: deleteKvKey doesn't currently throw if key not found
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error (Invalid Key Format)'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

export const kvRoutes = new OpenAPIHono()
  .openapi(getKvValueRoute, async (c) => {
    const { key } = c.req.valid('query')
    let value: KVValue<KVKey>
    try {
      value = await getKvValue(key)
    } catch (error: any) {
      if (error instanceof ApiError && error.code === 'KV_KEY_NOT_FOUND') {
        console.log(`[KV Route] Key '${key}' not found. Initializing with default.`)
        const defaultValue = KVDefaultValues[key]
        if (defaultValue === undefined) {
          console.error(`[KV Route] No default value defined for key: ${key}`)
          throw new ApiError(500, `Internal Error: No default value specified for key '${key}'.`, 'KV_MISSING_DEFAULT')
        }
        try {
          await setKvValue(key, defaultValue)
          value = defaultValue
          console.log(`[KV Route] Key '${key}' initialized successfully with default value.`)
        } catch (setError: any) {
          console.error(`[KV Route] Error setting default value for key '${key}':`, setError)
          throw new ApiError(
            500,
            `Internal Error: Failed to initialize state for key: ${key}. Reason: ${setError.message || 'Unknown error'}`,
            'KV_INIT_DEFAULT_FAILED',
            { originalError: setError }
          )
        }
      } else {
        throw error
      }
    }

    const payload = { success: true, key, value } satisfies z.infer<typeof KvGetResponseSchema>
    return c.json(payload, 200)
  })
  .openapi(deleteKvKeyRoute, async (c) => {
    const { key } = c.req.valid('query')
    await deleteKvKey(key) // Service now throws ApiError if key not found
    const payload = { success: true, message: `Key '${key}' deleted successfully.` } satisfies z.infer<
      typeof KvDeleteResponseSchema
    >
    return c.json(payload, 200)
  })
  .post('/api/kv/:key', async (c) => {
    const key = c.req.param('key') as KVKey
    const body = await c.req.json()

    if (!body || typeof body.value === 'undefined') {
      throw new ApiError(400, "Request body must include a 'value' property.", 'INVALID_REQUEST_BODY')
    }
    const valueToSet = body.value

    const schema = KvSchemas[key]
    if (!schema) {
      console.error(`[KV Route - POST] No schema defined for key: ${key}`)
      throw new ApiError(500, `Internal Configuration Error: No schema defined for key: ${key}`, 'KV_SCHEMA_MISSING')
    }

    let validatedValue: KVValue<KVKey>
    try {
      validatedValue = await schema.parseAsync(valueToSet)
    } catch (error: any) {
      console.error(`[KV Route - POST] Validation failed for key '${key}':`, error)
      if (error instanceof ZodError) {
        throw new ApiError(
          400,
          `Validation Error: Value for key '${key}' is invalid. Issues: ${error.errors.map((e) => e.message).join(', ')}`,
          'KV_INVALID_VALUE',
          { issues: error.errors }
        )
      }
      throw new ApiError(400, `Validation Error: Value for key '${key}' is invalid.`, 'KV_INVALID_VALUE')
    }

    await setKvValue(key, validatedValue)

    console.log(`[KV Route - POST] Value set for key '${key}':`, validatedValue)

    const responsePayload = { success: true, key, value: validatedValue } satisfies z.infer<typeof KvSetResponseSchema>
    return c.json(responsePayload, 200)
  })
  .patch('/api/kv/:key', async (c) => {
    const key = c.req.param('key') as KVKey
    const body = await c.req.json()

    if (!body || typeof body.value === 'undefined') {
      throw new ApiError(
        400,
        "Request body must include a 'value' property containing the partial update.",
        'INVALID_REQUEST_BODY_PATCH'
      )
    }
    const partialValueToUpdate = body.value

    const baseSchema = KvSchemas[key]
    if (!baseSchema) {
      console.error(`[KV Route - PATCH] No schema defined for key: ${key}`)
      throw new ApiError(500, `Internal Configuration Error: No schema defined for key: ${key}`, 'KV_SCHEMA_MISSING')
    }

    // Handle ZodDefault by getting the inner schema
    const schemaToParse = 'removeDefault' in baseSchema ? baseSchema.removeDefault() : baseSchema

    let validatedPartialValue: Partial<KVValue<KVKey>>
    try {
      // Ensure schemaToParse is a ZodObject before calling .partial()
      if (!(schemaToParse instanceof z.ZodObject)) {
        console.error(
          `[KV Route - PATCH] Schema for key '${key}' is not a ZodObject and cannot be partially validated directly. Schema type: ${schemaToParse._def.typeName}`
        )
        // For non-object schemas, PATCH might mean full replacement or not be supported for partials.
        // Sticking to full parse for non-objects, or throw an error if partial is strictly required.
        // For simplicity here, we'll try to parse as is, but this might need refinement based on specific schema types.
        // Consider throwing new ApiError(400, `Partial updates are not supported for the schema type of key '${key}'.`, 'KV_PARTIAL_NOT_SUPPORTED');
        // If we want to allow full replacement on PATCH for non-objects, we'd parse with schemaToParse directly.
        // However, the expectation for PATCH is partial. Let's assume for now it must be an object for partial update.
        throw new ApiError(
          400,
          `Partial updates are only supported for object-based KV stores. Key '${key}' has a different schema type.`,
          'KV_PARTIAL_OBJECT_ONLY'
        )
      }
      // For PATCH, we validate a partial version of the schema.
      // .passthrough() allows other keys to be present if not defined in schema, which is fine for PATCH.
      validatedPartialValue = await schemaToParse.partial().passthrough().parseAsync(partialValueToUpdate)
    } catch (error: any) {
      console.error(`[KV Route - PATCH] Validation failed for key '${key}' with partial data:`, error)
      if (error instanceof ZodError) {
        throw new ApiError(
          400,
          `Validation Error: Partial value for key '${key}' is invalid. Issues: ${error.errors.map((e) => e.message).join(', ')}`,
          'KV_INVALID_PARTIAL_VALUE',
          { issues: error.errors }
        )
      }
      throw new ApiError(
        400,
        `Validation Error: Partial value for key '${key}' is invalid.`,
        'KV_INVALID_PARTIAL_VALUE'
      )
    }

    const updatedValue = await updateKVStore(key, validatedPartialValue)

    console.log(`[KV Route - PATCH] Value partially updated for key '${key}'. New full value:`, updatedValue)

    const responsePayload = { success: true, key, value: updatedValue } satisfies z.infer<typeof KvSetResponseSchema>
    return c.json(responsePayload, 200)
  })

// Export the type for potential use in client generation or other integrations
export type KvRouteTypes = typeof kvRoutes
