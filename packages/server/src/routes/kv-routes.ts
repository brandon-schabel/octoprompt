import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { TypedResponse } from 'hono'; // For explicit response types

import {
    getKvValue,
    setKvValue,
    deleteKvKey,
} from '@/services/kv-service';

import {
    ApiError,
} from 'shared';
import {
    KvSchemas,
    kvKeyEnumSchema,
    KVKeyEnum,
    KvKeyQuerySchema,
    KvSetBodySchema,
    KvGetResponseSchema,
    KvSetResponseSchema,
    KvDeleteResponseSchema,
} from 'shared/src/schemas/kv-store.schemas';
import {
    ApiErrorResponseSchema,
    OperationSuccessResponseSchema,
} from 'shared/src/schemas/common.schemas';

// // Recent changes:
// 1. Switched to OpenAPIHono and createRoute.
// 2. Replaced zValidator with request schemas in createRoute.
// 3. Added explicit response schemas and validation.
// 4. Ensured responses `satisfy` Zod schemas.
// 5. Standardized error handling using ApiError.

// --- Route Definitions ---

const getKvValueRoute = createRoute({
    method: 'get',
    path: '/api/kv',
    tags: ['KV Store'],
    summary: 'Get a value from the KV store by key',
    request: {
        query: KvKeyQuerySchema,
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
        },
    }
});

const setKvValueRoute = createRoute({
    method: 'post',
    path: '/api/kv',
    tags: ['KV Store'],
    summary: 'Set a value in the KV store for a given key',
    request: {
        body: { content: { 'application/json': { schema: KvSetBodySchema } } },
    },
    responses: {
        200: { 
            content: { 'application/json': { schema: KvSetResponseSchema } }, 
            description: 'Successfully set the value' 
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
            description: 'Validation Error (Value doesn\'t match schema for the key)'
        },
        422: { 
            content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
            description: 'Validation Error (Invalid Request Body/Key Format)' 
        },
        500: { 
            content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
            description: 'Internal Server Error' 
        },
    }
});

const deleteKvKeyRoute = createRoute({
    method: 'delete',
    path: '/api/kv',
    tags: ['KV Store'],
    summary: 'Delete a key-value pair from the KV store',
    request: {
        query: KvKeyQuerySchema,
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
        },
    }
});

// --- Hono App Instance ---
export const kvRoutes = new OpenAPIHono()
    .openapi(getKvValueRoute, async (c) => {
        const { key } = c.req.valid('query');
        const value = await getKvValue(key);
        // Note: Service currently returns null if not found, doesn't throw 404.
        // Adjust service or this handler if 404 on not found is desired.
        const payload = { success: true, key, value } satisfies z.infer<typeof KvGetResponseSchema>;
        return c.json(payload, 200);
    })

    .openapi(setKvValueRoute, async (c) => {
        const { key, value } = c.req.valid('json');

        const schema = KvSchemas[key];
        if (!schema) {
            // This case should ideally be prevented by kvKeyEnumSchema validation, but good practice to check.
            throw new ApiError(400, `Internal Error: No schema defined for key: ${key}`, 'INTERNAL_SCHEMA_MISSING');
        }

        try {
            const validatedValue = schema.parse(value);
            await setKvValue(key, validatedValue);
            const payload = { success: true, key, value: validatedValue } satisfies z.infer<typeof KvSetResponseSchema>;
            return c.json(payload, 200);
        } catch (error) {
            if (error instanceof z.ZodError) {
                // Throw structured ApiError for Zod validation failures
                throw new ApiError(400, 'Value validation failed against schema for the key', 'VALIDATION_ERROR', error.flatten());
            }
            // Re-throw other unexpected errors
            console.error("Unexpected error during KV set:", error);
            throw new ApiError(500, 'An unexpected error occurred while setting the value.', 'KV_SET_FAILED');
        }
    })

    .openapi(deleteKvKeyRoute, async (c) => {
        const { key } = c.req.valid('query');
        await deleteKvKey(key);
        // Note: Service doesn't indicate if key existed before delete.
        const payload = { success: true, message: `Key '${key}' deleted successfully.` } satisfies z.infer<typeof KvDeleteResponseSchema>;
        return c.json(payload, 200);
    });

// Export the type for potential use in client generation or other integrations
export type KvRouteTypes = typeof kvRoutes; 