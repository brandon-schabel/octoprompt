import { z } from '@hono/zod-openapi';
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from './common.schemas'; // Assuming common schemas exist

export const userProfileSchema = z.object({
    name: z.string().default(''),        // Use empty string if undefined
    age: z.number().int().min(0).max(120).default(0), // Default 0 if undefined
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const featureFlagsSchema = z.array(z.string()).default([]);
// Default empty array if undefined
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

export const counterSchema = z.number().int().min(0).default(0);
// Default 0 if undefined
export type Counter = z.infer<typeof counterSchema>;

export const KVKeyEnum = {
    userProfile: 'userProfile',
    featureFlags: 'featureFlags',
    counter: 'counter',
} as const;

export type KVKey = typeof KVKeyEnum[keyof typeof KVKeyEnum];

export const kvKeyEnumSchema = z.enum(
    Object.values(KVKeyEnum) as [KVKey, ...KVKey[]]
);

export const KvSchemas = {
    [KVKeyEnum.userProfile]: userProfileSchema,
    [KVKeyEnum.featureFlags]: featureFlagsSchema,
    [KVKeyEnum.counter]: counterSchema,
} as const;

export type KVValue<K extends KVKey> = z.infer<typeof KvSchemas[K]>;

// --- OpenAPI Schemas ---

// Request Schemas
export const KvKeyQuerySchema = z.object({
    key: kvKeyEnumSchema.openapi({
        param: { name: 'key', in: 'query' },
        description: 'The key to retrieve or delete.',
        example: KVKeyEnum.userProfile,
    }),
}).openapi('KvKeyQuery');

export const KvSetBodySchema = z.object({
    key: kvKeyEnumSchema.openapi({
        description: 'The key to set.',
        example: KVKeyEnum.featureFlags,
    }),
    value: z.any().openapi({ // Specific validation happens in the route handler
        description: 'The value to store for the key. Must conform to the key\'s specific schema.',
        example: ['new-feature', 'beta-test'],
    }),
}).openapi('KvSetBody');


// Response Schemas
export const KvGetResponseSchema = z.object({
    success: z.literal(true),
    key: kvKeyEnumSchema.openapi({
        description: 'The key whose value was retrieved.',
        example: KVKeyEnum.userProfile,
    }),
    value: z.any().openapi({ // Value type depends on the key
        description: 'The retrieved value associated with the key.',
        example: { name: 'Alice', age: 30 },
    }),
}).openapi('KvGetResponse');

export const KvSetResponseSchema = z.object({
    success: z.literal(true),
    key: kvKeyEnumSchema.openapi({
        description: 'The key that was set.',
        example: KVKeyEnum.featureFlags,
    }),
    value: z.any().openapi({ // Value type depends on the key
        description: 'The value that was stored.',
        example: ['new-feature', 'beta-test'],
    }),
}).openapi('KvSetResponse');

// Using common success schema for DELETE
export const KvDeleteResponseSchema = OperationSuccessResponseSchema.openapi('KvDeleteResponse');

// Re-export common error schema for consistency if needed elsewhere
export { ApiErrorResponseSchema };