// kv-validators.ts

import { z } from 'zod';

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