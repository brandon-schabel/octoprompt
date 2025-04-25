import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'; //
import { ApiError } from 'shared';
import {
    CreateProviderKeyBodySchema,
    UpdateProviderKeyBodySchema,
    ProviderKeyIdParamsSchema,
    ProviderKeyResponseSchema,
    ProviderKeyListResponseSchema,
} from "shared/src/schemas/provider-key.schemas";
import { providerKeyService } from "@/services/model-providers/providers/provider-key-service";
import type { ProviderKey } from 'shared/src/schemas/provider-key.schemas';
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from 'shared/src/schemas/common.schemas';

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
export const providerKeyRoutes = new OpenAPIHono()
    .openapi(createProviderKeyRoute, async (c) => {
        const body = c.req.valid('json'); // <--- Get validated data
        try {
            return c.json({ success: true, data: await providerKeyService.createKey(body) } satisfies z.infer<typeof ProviderKeyResponseSchema>, 201);
        } catch (error) {
            console.error("Error creating key:", error);
            // Let global handler manage, or add specific checks (e.g., duplicate provider?)
            throw error;
        }
    })

    .openapi(listProviderKeysRoute, async (c) => {
        try {
            return c.json({ success: true, data: await providerKeyService.listKeys() } satisfies z.infer<typeof ProviderKeyListResponseSchema>, 200);
        } catch (error) {
            console.error("Error listing keys:", error);
            throw error; // Let global handler manage
        }
    })

    .openapi(getProviderKeyByIdRoute, async (c) => {
        const { keyId } = c.req.valid('param');
        try {
            const k = await providerKeyService.getKeyById(keyId);
            // Check for null *before* mapping
            if (k === null) {
                throw new ApiError(404, "Key not found", "KEY_NOT_FOUND");
            }
            // 'k' is guaranteed non-null here, assert it for TS
            return c.json({ success: true, data: k as ProviderKey } satisfies z.infer<typeof ProviderKeyResponseSchema>, 200);
        } catch (error: any) {
            console.error(`Error getting key ${keyId}:`, error);
            // Catch the specific ApiError for 404
            if (error instanceof ApiError && error.status === 404) {
                return c.json({
                    success: false, error: {
                        message: error.message,
                        code: error.code,
                        details: error.details ?? error.message
                    }
                } satisfies z.infer<typeof ApiErrorResponseSchema>, 404);
            }
            // Handle other errors (could be validation 422 or internal 500)
            return c.json({
                success: false, error: {
                    message: "Internal Server Error",
                    code: "INTERNAL_ERROR",
                    details: {}
                }
            } satisfies z.infer<typeof ApiErrorResponseSchema>, 500);
        }
    })

    .openapi(updateProviderKeyRoute, async (c) => {
        const { keyId } = c.req.valid('param');
        const body = c.req.valid('json');
        try {
            const updated = await providerKeyService.updateKey(keyId, body);
            // Check for null *before* mapping
            if (updated === null) {
                throw new ApiError(404, "Key not found", "KEY_NOT_FOUND");
            }
            // 'updated' is guaranteed non-null here, assert it for TS
            return c.json({ success: true, data: updated as ProviderKey } satisfies z.infer<typeof ProviderKeyResponseSchema>, 200);
        } catch (error: any) {
            console.error(`Error updating key ${keyId}:`, error);
            // Catch the specific ApiError for 404
            if (error instanceof ApiError && error.status === 404) {
                return c.json({
                    success: false, error: {
                        message: error.message,
                        code: error.code,
                        details: error.details ?? error.message
                    }
                } satisfies z.infer<typeof ApiErrorResponseSchema>, 404);
            }
            // Handle other errors (could be validation 422 or internal 500)
            return c.json({
                success: false, error: {
                    message: "Internal Server Error",
                    code: "INTERNAL_ERROR",
                    details: {}
                }
            } satisfies z.infer<typeof ApiErrorResponseSchema>, 500);
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