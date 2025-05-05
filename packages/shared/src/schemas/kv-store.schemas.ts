import { z } from '@hono/zod-openapi';
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from './common.schemas'; // Assuming common schemas exist
import { appSettingsSchema, createInitialGlobalState, projectTabsStateRecordSchema } from './global-state-schema';

export const KVKeyEnum = {
    appSettings: 'appSettings',
    projectTabs: 'projectTabs',
    activeProjectTabId: 'activeProjectTabId',
    activeChatId: 'activeChatId',
} as const;

export type KVKey = typeof KVKeyEnum[keyof typeof KVKeyEnum];

export const kvKeyEnumSchema = z.enum(
    Object.values(KVKeyEnum) as [KVKey, ...KVKey[]]
);

export const KvSchemas = {
    [KVKeyEnum.appSettings]: appSettingsSchema,
    [KVKeyEnum.projectTabs]: projectTabsStateRecordSchema,
    [KVKeyEnum.activeProjectTabId]: z.string().nullable().default('defaultTab'),
    [KVKeyEnum.activeChatId]: z.string().nullable().default(''),
} as const;

const initialGlobalState = createInitialGlobalState();

export const KVDefaultValues: { [K in KVKey]: KVValue<K> } = {
    activeChatId: initialGlobalState.activeChatId,
    activeProjectTabId: initialGlobalState.projectActiveTabId,
    appSettings: initialGlobalState.appSettings,
    projectTabs: initialGlobalState.projectTabs,
}

export type KVValue<K extends KVKey> = z.infer<typeof KvSchemas[K]>;

// --- OpenAPI Schemas ---

// Request Schemas
export const KvKeyQuerySchema = z.object({
    key: kvKeyEnumSchema.openapi({
        param: { name: 'key', in: 'query' },
        description: 'The key to retrieve or delete.',
        example: KVKeyEnum.appSettings,
    }),
}).openapi('KvKeyQuery');

export const KvSetBodySchema = z.object({
    value: z.any().openapi({ // Specific validation happens in the route handler
        description: 'The value to store for the key. Must conform to the key\'s specific schema.',
        example: { theme: 'dark', language: 'en' },
    }),
}).openapi('KvSetBody');


// Response Schemas
export const KvGetResponseSchema = z.object({
    success: z.literal(true),
    key: kvKeyEnumSchema.openapi({
        description: 'The key whose value was retrieved.',
        example: KVKeyEnum.appSettings,
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
        example: KVKeyEnum.appSettings,
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