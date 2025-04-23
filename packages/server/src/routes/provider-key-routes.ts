// packages/server/src/routes/provider-key-routes.ts
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'; // <--- Import createRoute and OpenAPIHono
import { ApiError } from 'shared';
import {
    // Request Schemas
    CreateProviderKeyBodySchema,
    UpdateProviderKeyBodySchema,
    ProviderKeyIdParamsSchema,
    // Response Schemas
    ProviderKeyResponseSchema,
    ProviderKeyListResponseSchema,
    ProviderKeySchema, // Base schema without secret
    ProviderKeyWithSecretSchema, // Schema with secret
    // Common Schemas
} from "shared/src/validation/provider-key-api-validation"; // <--- Import specific schemas
import { providerKeyService } from "@/services/model-providers/providers/provider-key-service";
import { ProviderKey } from 'shared/schema'; // For typing DB results
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from 'shared/src/validation/chat-api-validation';

// Helper to map DB key to API response (without secret)
const mapProviderKeyToPublicResponse = (dbKey: ProviderKey): z.infer<typeof ProviderKeySchema> => ({
    id: dbKey.id,
    provider: dbKey.provider,
    createdAt: dbKey.createdAt.toISOString(),
    updatedAt: dbKey.updatedAt.toISOString(),
});

// Helper to map DB key to API response (with secret)
const mapProviderKeyToSecretResponse = (dbKey: ProviderKey): z.infer<typeof ProviderKeyWithSecretSchema> => ({
    id: dbKey.id,
    provider: dbKey.provider,
    key: dbKey.key, // Include the key
    createdAt: dbKey.createdAt.toISOString(),
    updatedAt: dbKey.updatedAt.toISOString(),
});


// --- Route Definitions ---

const createProviderKeyRoute = createRoute({
    method: 'post',
    path: '/api/keys',
    tags: ['Provider Keys'],
    summary: 'Add a new API key for an AI provider',
    request: {
        body: {
            content: { 'application/json': { schema: CreateProviderKeyBodySchema } },
            required: true,
        },
    },
    responses: {
        201: {
            content: { 'application/json': { schema: ProviderKeyResponseSchema } }, // Returns key with secret
            description: 'Provider key created successfully',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const listProviderKeysRoute = createRoute({
    method: 'get',
    path: '/api/keys',
    tags: ['Provider Keys'],
    summary: 'List all configured provider keys (excluding secrets)',
    responses: {
        200: {
            content: { 'application/json': { schema: ProviderKeyListResponseSchema } }, // Returns list without secrets
            description: 'Successfully retrieved provider keys',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const getProviderKeyByIdRoute = createRoute({
    method: 'get',
    path: '/api/keys/{keyId}',
    tags: ['Provider Keys'],
    summary: 'Get a specific provider key by ID (including secret)',
    request: {
        params: ProviderKeyIdParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: ProviderKeyResponseSchema } }, // Returns key with secret
            description: 'Successfully retrieved provider key',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Provider key not found',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const updateProviderKeyRoute = createRoute({
    method: 'patch',
    path: '/api/keys/{keyId}',
    tags: ['Provider Keys'],
    summary: 'Update a provider key\'s details',
    request: {
        params: ProviderKeyIdParamsSchema,
        body: {
            content: { 'application/json': { schema: UpdateProviderKeyBodySchema } },
            required: true,
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: ProviderKeyResponseSchema } }, // Returns updated key with secret
            description: 'Provider key updated successfully',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Provider key not found',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const deleteProviderKeyRoute = createRoute({
    method: 'delete',
    path: '/api/keys/{keyId}',
    tags: ['Provider Keys'],
    summary: 'Delete a provider key',
    request: {
        params: ProviderKeyIdParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Provider key deleted successfully',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Provider key not found',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

// --- Hono App Instance ---
export const providerKeyRoutes = new OpenAPIHono() // <--- Use OpenAPIHono
    .openapi(createProviderKeyRoute, async (c) => { // <--- Use .openapi()
        const body = c.req.valid('json'); // <--- Get validated data
        try {
            const newKey = await providerKeyService.createKey(body);
            const responseData = mapProviderKeyToSecretResponse(newKey);
            return c.json({ success: true, data: responseData } satisfies z.infer<typeof ProviderKeyResponseSchema>, 201);
        } catch (error) {
            console.error("Error creating key:", error);
            // Let global handler manage, or add specific checks (e.g., duplicate provider?)
            throw error;
        }
    })

    .openapi(listProviderKeysRoute, async (c) => {
        try {
            const keys = await providerKeyService.listKeys();
            const responseData = keys.map(mapProviderKeyToPublicResponse); // Use public mapping
            return c.json({ success: true, data: responseData } satisfies z.infer<typeof ProviderKeyListResponseSchema>, 200);
        } catch (error) {
            console.error("Error listing keys:", error);
            throw error; // Let global handler manage
        }
    })

    .openapi(getProviderKeyByIdRoute, async (c) => {
        const { keyId } = c.req.valid('param');
        try {
            const k = await providerKeyService.getKeyById(keyId);
            // Service should throw if not found
            const responseData = mapProviderKeyToSecretResponse(k);
            return c.json({ success: true, data: responseData } satisfies z.infer<typeof ProviderKeyResponseSchema>, 200);
        } catch (error: any) {
            console.error(`Error getting key ${keyId}:`, error);
            if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                throw new ApiError(404, "Key not found", "KEY_NOT_FOUND");
            }
            throw error;
        }
    })

    .openapi(updateProviderKeyRoute, async (c) => {
        const { keyId } = c.req.valid('param');
        const body = c.req.valid('json');
        try {
            const updated = await providerKeyService.updateKey(keyId, body);
            // Service should throw if not found
            const responseData = mapProviderKeyToSecretResponse(updated);
            return c.json({ success: true, data: responseData } satisfies z.infer<typeof ProviderKeyResponseSchema>, 200);
        } catch (error: any) {
            console.error(`Error updating key ${keyId}:`, error);
            if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                throw new ApiError(404, "Key not found", "KEY_NOT_FOUND");
            }
            throw error;
        }
    })

    .openapi(deleteProviderKeyRoute, async (c) => {
        const { keyId } = c.req.valid('param');
        try {
            await providerKeyService.deleteKey(keyId);
            // Service should handle not found appropriately (e.g., throw)
            return c.json({ success: true, message: "Key deleted successfully." } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
        } catch (error: any) {
            console.error(`Error deleting key ${keyId}:`, error);
            if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                throw new ApiError(404, "Key not found", "KEY_NOT_FOUND");
            }
            throw error;
        }
    });

// Export the type for the frontend client
export type ProviderKeyRouteTypes = typeof providerKeyRoutes;