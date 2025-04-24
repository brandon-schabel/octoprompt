// packages/server/src/routes/state-routes.ts
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
    createInitialGlobalState,
    globalStateSchema,
    type GlobalState,
    // Assuming ApiErrorResponseSchema and ApiError are correctly imported from shared
    ApiError,
} from "shared"; // Import necessary items from shared
import { ApiErrorResponseSchema } from "shared/src/schemas/common.schemas";
import * as stateService from "@/services/state/state-service"; // Import the state service

// --- Schema Definitions for State Routes ---

// Response schema for successful GET, POST (update), and PUT (replace) operations
const StateResponseSchema = z.object({
    success: z.literal(true),
    data: globalStateSchema // Reference the detailed globalStateSchema
}).openapi('StateResponse', {
    description: 'Standard success response containing the complete current global application state.'
});

// Request body schema for updating a single top-level key/value pair
const UpdateStatePartialBodySchema = z.object({
    key: z.string().min(1)
        .openapi({
            example: 'projectActiveTabId',
            description: 'The top-level key within the GlobalState object to update (e.g., "settings", "projectActiveTabId").'
        }),
    value: z.any() // Keep as z.any() due to diverse value types, service layer handles validation
        .openapi({
            example: 'tab_new_uuid_123', // Example for projectActiveTabId
            // Add more examples if specific keys are common:
            // example: { theme: 'dark', language: 'fr' }, // Example for updating part of 'settings' (though 'settings' itself is the key here)
            description: 'The new value for the specified key. The type must match the expected type for that key in the GlobalState schema.'
        })
}).openapi('UpdateStatePartialBody', {
    description: 'Specifies a single top-level key and its new value for performing a partial update on the global state.'
});

// Request body schema for replacing the entire state.
// Simply alias globalStateSchema with a specific OpenAPI name for this context.
const ReplaceStateBodySchema = globalStateSchema.openapi('ReplaceStateBody', {
    description: 'The complete GlobalState object that will replace the current application state.'
});


// --- Route Definitions ---

const getStateRoute = createRoute({
    method: 'get',
    path: '/api/state',
    tags: ['State'],
    summary: 'Get Global State',
    description: 'Retrieves the entire current global application state object.',
    responses: {
        200: {
            content: { 'application/json': { schema: StateResponseSchema } },
            description: 'Successfully retrieved the current global state.'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to read or parse the state from storage.'
        },
    },
});

// Using POST for partial updates as it changes server state
const updateStatePartialRoute = createRoute({
    method: 'post',
    path: '/api/state/update', // Specific path to avoid ambiguity with PUT replace
    tags: ['State'],
    summary: 'Update State Partially',
    description: 'Updates a single top-level key within the global application state with the provided value. Returns the complete updated state.',
    request: {
        body: {
            content: { 'application/json': { schema: UpdateStatePartialBodySchema } },
            required: true,
            description: 'The key-value pair to update in the global state.',
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: StateResponseSchema } },
            description: 'Successfully updated the state key and returned the new complete global state.'
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Bad Request: Validation Error. Occurs if the provided key is invalid, the value type is incorrect for the key, or the resulting state object fails validation according to the GlobalState schema.'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed during state update or persistence.'
        },
    },
});

// Route to replace the entire state (using PUT)
const replaceStateRoute = createRoute({
    method: 'put', // PUT is appropriate for replacing the entire resource
    path: '/api/state',
    tags: ['State'],
    summary: 'Replace Global State',
    description: 'Replaces the entire existing global application state with the provided state object. The provided object must conform to the GlobalState schema.',
    request: {
        body: {
            content: { 'application/json': { schema: ReplaceStateBodySchema } }, // Use the full global state schema
            required: true,
            description: 'The complete new global state object.'
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: StateResponseSchema } },
            description: 'Successfully replaced the global state and returned the new state.'
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Bad Request: Validation Error. The provided request body does not conform to the required GlobalState schema structure.'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to write the new state to storage.'
        },
    },
});


// --- Hono Router Implementation ---

export const stateRoutes = new OpenAPIHono()
    // GET /api/state
    .openapi(getStateRoute, async (c) => {
        try {
            console.log("[State Route - GET] Fetching current state...");
            const currentState = await stateService.getCurrentState();
            const payload: z.infer<typeof StateResponseSchema> = {
                success: true,
                data: currentState
            };
            return c.json(payload, 200);
        } catch (error: any) {
            console.error("[State Route - GET] Error fetching state:", error);
            // Let the global error handler catch ApiError or wrap others
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, "Failed to retrieve application state", "STATE_FETCH_ERROR");
        }
    })

    // POST /api/state/update
    .openapi(updateStatePartialRoute, async (c) => {
        const { key, value } = c.req.valid('json'); // Input already validated by Hono middleware against UpdateStatePartialBodySchema
        try {
            console.log(`[State Route - POST Update] Updating key: ${key}`);

            // Optional: Basic check if key exists in initial state, though service validation is primary
            const initialStateKeys = Object.keys(createInitialGlobalState());
            if (!initialStateKeys.includes(key)) {
                console.warn(`[State Route - POST Update] Attempted to update potentially unknown top-level key: ${key}. Relying on service validation.`);
                // If you want to strictly enforce keys:
                // throw new ApiError(400, `Invalid state key provided: ${key}. Key must be one of [${initialStateKeys.join(', ')}]`, "VALIDATION_ERROR");
            }

            // The service handles the core logic: fetching current, updating, validating the *new* state, and writing
            const updatedState = await stateService.updateStateByKey(key as keyof GlobalState, value);

            const payload: z.infer<typeof StateResponseSchema> = {
                success: true,
                data: updatedState // Return the full updated state
            };
            return c.json(payload, 200);
        } catch (error: any) {
            console.error(`[State Route - POST Update] Error updating state key "${key}":`, error);
            // Handle specific ZodError from the service layer (validation of the *resulting* state)
            if (error instanceof z.ZodError) {
                throw new ApiError(400, "Validation failed for the updated state object.", "VALIDATION_ERROR", error.flatten());
            }
            // Handle other ApiErrors thrown intentionally
            if (error instanceof ApiError) throw error;
            // Throw generic internal server error for other issues (e.g., file write errors)
            throw new ApiError(500, `Failed to update state key "${key}": ${error.message || 'Unknown error'}`, "STATE_UPDATE_ERROR");
        }
    })

    // PUT /api/state
    .openapi(replaceStateRoute, async (c) => {
        const newState = c.req.valid('json'); // Input already validated by Hono middleware against ReplaceStateBodySchema (GlobalStateSchema)
        try {
            console.log("[State Route - PUT Replace] Replacing entire state...");
            // Service validates the incoming state again (defense-in-depth) and writes it
            const validatedState = await stateService.replaceState(newState); // `replaceState` should handle Zod validation internally

            const payload: z.infer<typeof StateResponseSchema> = {
                success: true,
                data: validatedState,
            };
            return c.json(payload, 200);
        } catch (error: any) {
            console.error("[State Route - PUT Replace] Error replacing state:", error);
            // Handle specific ZodError from the service layer
            if (error instanceof z.ZodError) {
                throw new ApiError(400, "Validation failed for the provided state object.", "VALIDATION_ERROR", error.flatten());
            }
            // Handle other ApiErrors thrown intentionally
            if (error instanceof ApiError) throw error;
            // Throw generic internal server error for other issues
            throw new ApiError(500, `Failed to replace state: ${error.message || 'Unknown error'}`, "STATE_REPLACE_ERROR");
        }
    });

// Export the type for the frontend client generator
export type StateRouteTypes = typeof stateRoutes;