import { z } from '@hono/zod-openapi'
import { zValidator } from '@hono/zod-validator';
import { OpenAPIHono } from '@hono/zod-openapi';
import {
    getKvValue,
    setKvValue,
    deleteKvKey,
} from '@/services/kv-service';

import { kvKeyEnumSchema, KvSchemas } from 'shared/src/kv-validators';
import { ApiError } from 'shared/index';

const kvSetSchema = z.object({
    key: kvKeyEnumSchema,
    value: z.any(), // We'll re-validate with the correct schema in the route
});

export const kvRoutes = new OpenAPIHono()
    // Get a KV value
    .get('/api/kv',
        zValidator('query', z.object({
            key: kvKeyEnumSchema,
        })),
        async (c) => {
            const { key } = c.req.valid('query');
            const value = await getKvValue(key);
            return c.json({ success: true, key, value });
        }
    )
    // Set a KV value
    .post('/api/kv',
        zValidator('json', kvSetSchema),
        async (c) => {
            const { key, value } = c.req.valid('json');

            // Get the specific schema for this key
            const schema = KvSchemas[key];
            if (!schema) {
                throw new ApiError(400, `No schema defined for key: ${key}`, 'VALIDATION_ERROR');
            }

            // Validate value against its schema
            try {
                const validatedValue = schema.parse(value);
                await setKvValue(key, validatedValue);
                return c.json({ success: true, key, value: validatedValue });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return c.json({
                        success: false,
                        error: 'Validation Error',
                        details: error.errors
                    }, 400);
                }
                throw error;
            }
        }
    )
    // Delete a KV key
    .delete('/api/kv',
        zValidator('query', z.object({
            key: kvKeyEnumSchema,
        })),
        async (c) => {
            const { key } = c.req.valid('query');
            await deleteKvKey(key);
            return c.json({ success: true, key });
        }
    );



export type KvRouteTypes = typeof kvRoutes; 