// packages/shared/src/kv-validators.ts
import { z } from 'zod';

/**
 * Example #1: 'userProfile' key
 * Suppose we store a user's profile (name, age, etc.)
 */
export const userProfileSchema = z.object({
    name: z.string(),
    age: z.number().int().min(0).max(120),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * Example #2: 'featureFlags' key
 * Suppose we store an array of feature flags (just a demonstration).
 */
export const featureFlagsSchema = z.array(z.string());
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

/**
 * KVKey is an enum-like type for all possible keys in our KV store.
 */
export const KVKeyEnum = {
    userProfile: 'userProfile',
    featureFlags: 'featureFlags',
} as const;
export type KVKey = typeof KVKeyEnum[keyof typeof KVKeyEnum];

/**
 * We map each key to its Zod schema here for easy reference.
 * If you add a new key, add its schema here.
 */
export const KvSchemas = {
    [KVKeyEnum.userProfile]: userProfileSchema,
    [KVKeyEnum.featureFlags]: featureFlagsSchema,
} as const;

/**
 * A generic helper type: given the key "K", infer the correct type from the KvSchemas map.
 */
export type KVValue<K extends KVKey> = z.infer<typeof KvSchemas[K]>;