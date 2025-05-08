import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { TypedResponse } from 'hono'; // For explicit response types

import {
    getKvValue,
    setKvValue,
    deleteKvKey,
    updateKVStore,
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
    KVKey,
    KVDefaultValues,
    KVValue,
} from 'shared/src/schemas/kv-store.schemas';
import {
    ApiErrorResponseSchema,
    OperationSuccessResponseSchema,
} from 'shared/src/schemas/common.schemas';
import { getSchemaDefaults } from 'shared/src/utils/zod-utils';
import { ZodError } from 'zod';

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
    path: '/api/kv/:key',
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
        let value: KVValue<KVKey>;
        try {
            value = await getKvValue(key);
        } catch (error: any) {
            if (error instanceof ApiError && error.code === 'KV_KEY_NOT_FOUND') {
                // Key not found, initialize with default value
                console.log(`[KV Route] Key '${key}' not found. Initializing with default.`);
                const defaultValue = KVDefaultValues[key];
                if (defaultValue === undefined) {
                    // This case should ideally not happen if KVDefaultValues is comprehensive for all KVKey
                    console.error(`[KV Route] No default value defined for key: ${key}`);
                    throw new ApiError(500, `Internal Error: No default value specified for key '${key}'.`, 'KV_MISSING_DEFAULT');
                }
                try {
                    await setKvValue(key, defaultValue); // setKvValue will validate and store
                    value = defaultValue; // Use the defaultValue directly as it's now set
                    console.log(`[KV Route] Key '${key}' initialized successfully with default value.`);
                } catch (setError: any) {
                    console.error(`[KV Route] Error setting default value for key '${key}':`, setError);
                    throw new ApiError(500, `Internal Error: Failed to initialize state for key: ${key}. Reason: ${setError.message || 'Unknown error'}`, 'KV_INIT_DEFAULT_FAILED', { originalError: setError });
                }
            } else {
                // Re-throw other errors (e.g., corrupt data, parse error from getKvValue)
                throw error;
            }
        }

        const payload = { success: true, key, value } satisfies z.infer<typeof KvGetResponseSchema>;        
        return c.json(payload, 200);
    })


    .openapi(deleteKvKeyRoute, async (c) => {
        const { key } = c.req.valid('query');
        await deleteKvKey(key); // Service now throws ApiError if key not found
        const payload = { success: true, message: `Key '${key}' deleted successfully.` } satisfies z.infer<typeof KvDeleteResponseSchema>;
        return c.json(payload, 200);
    })
    .post('/api/kv/:key', async (c) => {
        const key = c.req.param('key') as KVKey;
        const body = await c.req.json(); // Assuming body is { value: ... }

        if (!body || typeof body.value === 'undefined') {
            throw new ApiError(400, "Request body must include a 'value' property.", "INVALID_REQUEST_BODY");
        }
        const valueToSet = body.value;

        const schema = KvSchemas[key];
        if (!schema) {
            // This indicates a programming error or misconfiguration if a key is exposed but has no schema
            console.error(`[KV Route] No schema defined for key: ${key}`);
            throw new ApiError(500, `Internal Configuration Error: No schema defined for key: ${key}`, 'KV_SCHEMA_MISSING');
        }

        let validatedValue: KVValue<KVKey>;
        try {
            // Validate the incoming value against the schema for the key
            validatedValue = await schema.parseAsync(valueToSet);
        } catch (error: any) {
            console.error(`[KV Route] Validation failed for key '${key}':`, error);
            if (error instanceof ZodError) {
                throw new ApiError(400, `Validation Error: Value for key '${key}' is invalid. Issues: ${error.errors.map(e => e.message).join(', ')}`, 'KV_INVALID_VALUE', { issues: error.errors });
            }
            throw new ApiError(400, `Validation Error: Value for key '${key}' is invalid.`, 'KV_INVALID_VALUE');
        }

        // Use updateKVStore if partial update semantics are desired, or setKvValue for overwrite.
        // The current logic in the original file was to call updateKVStore.
        // If it was meant to be a simple set, it should be setKvValue(key, validatedValue).
        // Let's assume the intention was a full update/overwrite of the value based on the input being `json.value` not partial.
        // If `updateKVStore` is intended for partial updates, then the body structure might need to be different.
        // Given the original POST route handled the full value, `setKvValue` is more direct.
        await setKvValue(key, validatedValue);
        
        console.log(`[KV Route] Value set for key '${key}':`, validatedValue);
        // The response should reflect the successfully validated and stored value.
        // Ensure the generic type for KvSetResponseSchema aligns with this structure.
        const responsePayload = { success: true, key, value: validatedValue } as z.infer<typeof KvSetResponseSchema>;
        return c.json(responsePayload, 200);
    });

// Export the type for potential use in client generation or other integrations
export type KvRouteTypes = typeof kvRoutes; 