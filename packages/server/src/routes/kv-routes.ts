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
        let value = await getKvValue(key);

        // if value is undefined then initialize the State
        if (!value) {
            console.log(`Initializing state for key: ${key}`)
            // Initialize with the schema's default value
            const defaultValue = KVDefaultValues[key];
            console.log("attempting to set default value for key", key, defaultValue)
            await setKvValue(key, defaultValue);

            value = await getKvValue(key);

            if (value === null) {
                throw new ApiError(500, `Internal Error: Failed to initialize state for key: ${key}`, 'INTERNAL_STATE_INITIALIZATION_FAILED');
            }
        }

        // Note: Service currently returns null if not found, doesn't throw 404.
        // Adjust service or this handler if 404 on not found is desired.
        const payload = { success: true, key, value } satisfies z.infer<typeof KvGetResponseSchema>;
        return c.json(payload, 200);
    })


    .openapi(deleteKvKeyRoute, async (c) => {
        const { key } = c.req.valid('query');
        await deleteKvKey(key);
        // Note: Service doesn't indicate if key existed before delete.
        const payload = { success: true, message: `Key '${key}' deleted successfully.` } satisfies z.infer<typeof KvDeleteResponseSchema>;
        return c.json(payload, 200);
    })
    .post('/api/kv/:key', async (c) => {
        const key = c.req.param('key') as KVKey
        const json = await c.req.json()


        console.log({ key, json })

        // parse the value against the scheam for the key
        const schema = KvSchemas[key];

        if (!schema) {
            throw new ApiError(400, `Internal Error: No schema defined for key: ${key}`, 'INTERNAL_SCHEMA_MISSING');
        }


        let validatedValue: KVValue<KVKey>

        try {
            validatedValue = schema.parse(json.value);
        } catch (error) {
            console.error(error)
            throw new ApiError(400, `Validation Error: Value does not match schema for key: ${key}`, 'INVALID_VALUE_FOR_SCHEMA');
        }

        // update copies the previous state, whereas set completely overwrites it

        console.log({ key, validatedValue })
        const updatedResult = await updateKVStore(key, validatedValue);

        console.log({ updatedResult })
        return c.json({ success: true, key, value: validatedValue }, 200)
    })

// Export the type for potential use in client generation or other integrations
export type KvRouteTypes = typeof kvRoutes; 