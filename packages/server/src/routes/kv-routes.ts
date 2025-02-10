import { json } from '@bnk/router';
import { z } from 'zod';

import {
    getKvValue,
    setKvValue,
    deleteKvKey,
} from '@/services/kv-service';

import { kvKeyEnumSchema, KvSchemas } from 'shared/src/kv-validators';
import { router } from 'server-router';
import { ApiError } from 'shared/index';

const kvSetSchema = z.object({
    key: kvKeyEnumSchema,
    value: z.any(), // We'll re-validate with the correct schema in our route
});


router.get(
    '/api/kv',
    {
        validation: {
            query: z.object({
                key: kvKeyEnumSchema,
            }),
        },
    },
    async (_, { query }) => {
        const { key } = query;
        const value = await getKvValue(key);
        console.log('value', value);
        return json({ success: true, key, value });
    }
);

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

router.delete(
    '/api/kv/:key',
    {
        validation: {
            params: z.object({
                key: kvKeyEnumSchema,
            }),
        },
    },
    async (_, { params }) => {
        const { key } = params;
        await deleteKvKey(key);
        return json({ success: true, key });
    }
); 