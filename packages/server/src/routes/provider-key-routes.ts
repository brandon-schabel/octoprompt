import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'; //
import { ApiError } from 'shared';
import {
    CreateProviderKeyBodySchema,
    UpdateProviderKeyBodySchema,
    ProviderKeyIdParamsSchema,
    ProviderKeyResponseSchema,
    ProviderKeyListResponseSchema,
    ProviderKey, 
} from "shared/src/schemas/provider-key.schemas";
import { providerKeyService } from "@/services/model-providers/provider-key-service";
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
            content: { 'application/json': { schema: ProviderKeyResponseSchema } }, 
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
            content: { 'application/json': { schema: ProviderKeyListResponseSchema } }, 
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
            content: { 'application/json': { schema: ProviderKeyResponseSchema } }, 
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
            content: { 'application/json': { schema: ProviderKeyResponseSchema } }, 
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

export const providerKeyRoutes = new OpenAPIHono()
    .openapi(createProviderKeyRoute, async (c) => {
        const body = c.req.valid('json');
        const newKey = await providerKeyService.createKey(body);
        return c.json({ success: true, data: newKey } satisfies z.infer<typeof ProviderKeyResponseSchema>, 201);
    })

    .openapi(listProviderKeysRoute, async (c) => {
        const keys = await providerKeyService.listKeys();
        return c.json({ success: true, data: keys } satisfies z.infer<typeof ProviderKeyListResponseSchema>, 200);
    })

    .openapi(getProviderKeyByIdRoute, async (c) => {
        const { keyId } = c.req.valid('param');
        const key = await providerKeyService.getKeyById(keyId);
        if (!key) {
            throw new ApiError(404, 'Provider key not found', 'PROVIDER_KEY_NOT_FOUND');
        }
        return c.json({ success: true, data: key } satisfies z.infer<typeof ProviderKeyResponseSchema>, 200);
    })

    .openapi(updateProviderKeyRoute, async (c) => {
        const { keyId } = c.req.valid('param');
        const body = c.req.valid('json');
        const updatedKey = await providerKeyService.updateKey(keyId, body);
        return c.json({ success: true, data: updatedKey } satisfies z.infer<typeof ProviderKeyResponseSchema>, 200);
    })

    .openapi(deleteProviderKeyRoute, async (c) => {
        const { keyId } = c.req.valid('param');
        await providerKeyService.deleteKey(keyId);
        return c.json({ success: true, message: "Key deleted successfully." } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
    });

export type ProviderKeyRouteTypes = typeof providerKeyRoutes;