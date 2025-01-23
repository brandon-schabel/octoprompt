import { json } from '@bnk/router';
import { z } from 'zod';

import {
    getKvValue,
    setKvValue,
    deleteKvKey,
} from '@/services/kv-service';

import { KVKeyEnum, KvSchemas } from 'shared/src/kv-validators';
import { router } from 'server-router';
import { ApiError } from 'shared/index';

/**
 * Query param or request body might have an object like:
 * {
 *   key: "userProfile",
 *   value: { name: "Bob", age: 28 }
 * }
 */
const kvSetSchema = z.object({
    key: z.enum([KVKeyEnum.userProfile, KVKeyEnum.featureFlags]),
    value: z.any(), // We'll re-validate with the correct schema in our route
});

/**
 * GET /api/kv?key=userProfile
 * Retrieve the typed value for that key from the store.
 */
router.get(
    '/api/kv',
    {
        validation: {
            query: z.object({
                key: z.enum([KVKeyEnum.userProfile, KVKeyEnum.featureFlags]),
            }),
        },
    },
    async (_, { query }) => {
        const { key } = query;
        const value = await getKvValue(key);
        return json({ success: true, key, value });
    }
);

/**
 * POST /api/kv
 * Body: { key, value }
 * Sets the typed value for that key.
 */
router.post(
    '/api/kv',
    {
        validation: {
            body: kvSetSchema,
        },
    },
    async (req, { body }) => {
        const { key, value } = body;

        try {
            // Validate the "value" with the correct Zod schema for that key
            const validatedValue = KvSchemas[key].parse(value);

            await setKvValue(key, validatedValue);
            return json({ success: true });
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new ApiError('Invalid value for key: ' + error.message, 400);
            }
            throw error;
        }
    }
);

/**
 * DELETE /api/kv/:key
 * Removes the given key from the store.
 */
router.delete(
    '/api/kv/:key',
    {
        validation: {
            params: z.object({
                key: z.enum([KVKeyEnum.userProfile, KVKeyEnum.featureFlags]),
            }),
        },
    },
    async (_, { params }) => {
        const { key } = params;
        await deleteKvKey(key);
        return json({ success: true, key });
    }
); 