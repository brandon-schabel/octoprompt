import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { globalStateSchema, type GlobalState } from "shared";
import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";
import { ApiErrorResponseSchema } from "shared/src/schemas/common.schemas";

// Define response schemas
const StateResponseSchema = z.object({
    success: z.literal(true),
    data: globalStateSchema
}).openapi('StateResponse');

const UpdateStateBodySchema = z.object({
    key: z.string().min(1).openapi({ example: 'currentProjectId', description: 'State key to update' }),
    value: z.any().openapi({ example: 'proj-123', description: 'New value for the key' })
}).openapi('UpdateStateBody');

// Create route definitions
const getStateRoute = createRoute({
    method: 'get',
    path: '/api/state',
    tags: ['State'],
    summary: 'Get current application state',
    responses: {
        200: { content: { 'application/json': { schema: StateResponseSchema } }, description: 'Current application state' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const updateStateRoute = createRoute({
    method: 'post',
    path: '/api/state',
    tags: ['State'],
    summary: 'Update a single state property',
    request: {
        body: { content: { 'application/json': { schema: UpdateStateBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: StateResponseSchema } }, description: 'Updated state' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

export const stateRoutes = new OpenAPIHono()
    .openapi(getStateRoute, async (c) => {
        try {
            const currentState = websocketStateAdapter.getState();
            const payload: z.infer<typeof StateResponseSchema> = {
                success: true,
                data: currentState
            };
            return c.json(payload, 200);
        } catch (error) {
            console.error("Error fetching state:", error);
            const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                success: false,
                error: {
                    message: "Failed to fetch state",
                    code: "STATE_FETCH_ERROR",
                    details: {}
                }
            };
            return c.json(errorPayload, 500);
        }
    })
    .openapi(updateStateRoute, async (c) => {
        try {
            const { key, value } = c.req.valid('json');
            const currentState = websocketStateAdapter.getState();

            // Shallow update
            const newState = { ...currentState, [key]: value };
            const validated = globalStateSchema.parse(newState); // Zod validation might throw

            // Set & broadcast
            await websocketStateAdapter.setState(validated, true);

            const payload: z.infer<typeof StateResponseSchema> = {
                success: true,
                data: validated
            };
            return c.json(payload, 200);
        } catch (error) {
            console.error("Error updating state:", error);
            // Determine if it's a validation error (ZodError) or other internal error
            const isValidationError = error instanceof z.ZodError;
            const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                success: false,
                error: {
                    message: isValidationError ? "Invalid state update data" : "Failed to update state",
                    code: isValidationError ? "VALIDATION_ERROR" : "STATE_UPDATE_ERROR",
                    details: {}
                }
            };
            return c.json(errorPayload, isValidationError ? 400 : 500);
        }
    });