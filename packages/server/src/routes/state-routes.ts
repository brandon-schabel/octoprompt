import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
    globalStateSchema,
    type GlobalState,
    appSettingsSchema,
    projectTabsStateRecordSchema,
    projectTabStateSchema,
    type AppSettings,
    type ProjectTabsStateRecord,
    type ProjectTabState,
} from "shared/src/schemas/global-state-schema"; // Import necessary items from shared
import { ApiErrorResponseSchema } from "shared/src/schemas/common.schemas";
import * as stateService from "@/services/state/state-service"; // Import the state service
import { ApiError } from 'shared/src/error/api-error';
import { Context } from 'hono';

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
            example: 'tab_new_id_123', // Example for projectActiveTabId
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

// --- Specific Request/Response Schemas ---

// POST /api/state/settings
const UpdateSettingsBodySchema = appSettingsSchema.partial().openapi('UpdateSettingsBody', {
    description: 'A partial AppSettings object containing the keys and new values to update.'
});

// POST /api/state/active-project-tab
const SetActiveProjectTabBodySchema = z.object({
    tabId: z.string().nullable().openapi({ description: 'The ID of the project tab to set as active, or null.' })
}).openapi('SetActiveProjectTabBody');

// POST /api/state/active-chat
const SetActiveChatBodySchema = z.object({
    chatId: z.string().nullable().openapi({ description: 'The ID of the chat session to set as active, or null.' })
}).openapi('SetActiveChatBody');

// POST /api/state/project-tabs (Create)
const CreateProjectTabBodySchema = projectTabStateSchema.omit({ sortOrder: true }).partial().extend({
    projectId: z.string().openapi({ description: 'The required ID of the project this tab belongs to.' }),
    displayName: z.string().optional().openapi({ description: 'Optional initial display name for the tab.' })
}).openapi('CreateProjectTabBody', {
    description: 'Initial data for creating a new project tab. A unique ID will be generated.'
});

const CreateProjectTabResponseSchema = z.object({
    success: z.literal(true),
    tabId: z.string().openapi({ description: 'The ID of the newly created project tab.' }),
    data: globalStateSchema // Return the full state including the new tab
}).openapi('CreateProjectTabResponse');

// POST /api/state/project-tabs/{tabId} (Update)
const UpdateSingleProjectTabBodySchema = projectTabStateSchema.partial().openapi('UpdateSingleProjectTabBody', {
    description: 'A partial ProjectTabState object containing the fields to update for the specified tab.'
});

// DELETE /api/state/project-tabs/{tabId}
// No specific body/response needed beyond standard success/error, returns updated GlobalState.

// POST /api/state/project-tabs/replace-all (Using a different path for clarity)
const ReplaceProjectTabsBodySchema = projectTabsStateRecordSchema.openapi('ReplaceProjectTabsBody', {
    description: 'The complete record of project tabs (ID -> ProjectTabState) to replace the existing ones.'
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

// POST /api/state/settings
const updateSettingsRoute = createRoute({
    method: 'post',
    path: '/api/state/settings',
    tags: ['State Actions'],
    summary: 'Update Settings Partially',
    description: 'Merges the provided partial settings object with the current settings. Returns the complete updated state.',
    request: {
        body: { content: { 'application/json': { schema: UpdateSettingsBodySchema } }, required: true }
    },
    responses: {
        200: { content: { 'application/json': { schema: StateResponseSchema } }, description: 'Settings updated successfully.' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Bad Request: Invalid partial settings data.' },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to update settings.'
        },
    }
});

// POST /api/state/active-project-tab
const setActiveProjectTabRoute = createRoute({
    method: 'post',
    path: '/api/state/active-project-tab',
    tags: ['State Actions'],
    summary: 'Set Active Project Tab',
    description: 'Sets the currently active project tab ID. Returns the complete updated state.',
    request: {
        body: { content: { 'application/json': { schema: SetActiveProjectTabBodySchema } }, required: true }
    },
    responses: {
        200: { content: { 'application/json': { schema: StateResponseSchema } }, description: 'Active project tab updated successfully.' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Bad Request: Invalid request body.' },
        // 404 Not Found could be added if service strictly enforces tab existence
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to set active project tab.'
        },
    }
});

// POST /api/state/active-chat
const setActiveChatRoute = createRoute({
    method: 'post',
    path: '/api/state/active-chat',
    tags: ['State Actions'],
    summary: 'Set Active Chat',
    description: 'Sets the currently active chat session ID. Returns the complete updated state.',
    request: {
        body: { content: { 'application/json': { schema: SetActiveChatBodySchema } }, required: true }
    },
    responses: {
        200: { content: { 'application/json': { schema: StateResponseSchema } }, description: 'Active chat updated successfully.' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Bad Request: Invalid request body.' },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to set active chat.'
        },
    }
});

// POST /api/state/project-tabs (Create)
const createProjectTabRoute = createRoute({
    method: 'post',
    path: '/api/state/project-tabs',
    tags: ['State Actions', 'Project Tabs'],
    summary: 'Create Project Tab',
    description: 'Creates a new project tab with the provided initial data (merged with defaults). Returns the new tab ID and the complete updated state.',
    request: {
        body: { content: { 'application/json': { schema: CreateProjectTabBodySchema } }, required: true }
    },
    responses: {
        201: { content: { 'application/json': { schema: CreateProjectTabResponseSchema } }, description: 'Project tab created successfully.' }, // Use 201 Created
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Bad Request: Invalid initial tab data.' },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to create project tab.'
        },
    }
});

// POST /api/state/project-tabs/{tabId} (Update)
const updateSingleProjectTabRoute = createRoute({
    method: 'post',
    path: '/api/state/project-tabs/{tabId}', // Use POST for partial update
    tags: ['State Actions', 'Project Tabs'],
    summary: 'Update Single Project Tab',
    description: 'Merges the provided partial data with the specified project tab state. Returns the complete updated state.',
    request: {
        params: z.object({ tabId: z.string().openapi({ description: 'ID of the project tab to update.' }) }),
        body: { content: { 'application/json': { schema: UpdateSingleProjectTabBodySchema } }, required: true }
    },
    responses: {
        200: { content: { 'application/json': { schema: StateResponseSchema } }, description: 'Project tab updated successfully.' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Bad Request: Invalid partial tab data or invalid tab ID format.' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Not Found: Project tab with the specified ID does not exist.' },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to update project tab.'
        },
    }
});

// DELETE /api/state/project-tabs/{tabId}
const deleteProjectTabRoute = createRoute({
    method: 'delete',
    path: '/api/state/project-tabs/{tabId}',
    tags: ['State Actions', 'Project Tabs'],
    summary: 'Delete Project Tab',
    description: 'Deletes the specified project tab. Returns the complete updated state.',
    request: {
        params: z.object({ tabId: z.string().openapi({ description: 'ID of the project tab to delete.' }) })
    },
    responses: {
        200: { content: { 'application/json': { schema: StateResponseSchema } }, description: 'Project tab deleted successfully.' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Bad Request: Invalid tab ID format.' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Not Found: Project tab with the specified ID does not exist (or was already deleted).' },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to delete project tab.'
        },
    }
});

// POST /api/state/project-tabs/replace-all
const replaceProjectTabsRoute = createRoute({
    method: 'post',
    path: '/api/state/project-tabs/replace-all',
    tags: ['State Actions', 'Project Tabs'],
    summary: 'Replace All Project Tabs',
    description: 'Replaces the entire set of project tabs with the provided record. Returns the complete updated state.',
    request: {
        body: { content: { 'application/json': { schema: ReplaceProjectTabsBodySchema } }, required: true }
    },
    responses: {
        200: { content: { 'application/json': { schema: StateResponseSchema } }, description: 'Project tabs replaced successfully.' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Bad Request: Invalid project tabs record.' },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error: Failed to replace project tabs.'
        },
    }
});


// --- Deprecated Routes ---

// POST /api/state/update (Marked as deprecated)
const updateStatePartialRoute = createRoute({
    method: 'post',
    path: '/api/state/update',
    tags: ['State', 'Deprecated'], // Add Deprecated tag
    summary: 'DEPRECATED: Update State Partially',
    description: 'DEPRECATED: Use specific endpoints like /api/state/settings, /api/state/project-tabs/{id}, etc. instead. Updates a single top-level key within the global application state.',
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

// Helper function to handle standard state service calls and responses
async function handleStateUpdate(c: Context, serviceCall: Promise<GlobalState | { newState: GlobalState, [key: string]: any }>, successStatus: number = 200) {
    try {
        const result = await serviceCall;
        let responsePayload: any;
        let stateToReturn: GlobalState;

        // Check if the result includes extra data (like newTabId)
        if (result && typeof result === 'object' && 'newState' in result && 'newTabId' in result) {
            // Specifically handle createProjectTab result
            stateToReturn = result.newState;
            responsePayload = {
                success: true,
                tabId: result.newTabId, // Include newTabId directly
                data: stateToReturn
            };
        } else {
            // Handle standard GlobalState result
            stateToReturn = result as GlobalState;
            responsePayload = {
                success: true,
                data: stateToReturn
            };
        }

        return c.json(responsePayload, successStatus as any); // Use 'as any' for status code type if needed
    } catch (error: any) {
        console.error(`[State Route Handler] Error:`, error);
        if (error instanceof z.ZodError) {
            throw new ApiError(400, "Validation Error", "VALIDATION_ERROR", error.flatten());
        }
        if (error instanceof ApiError) {
            // Ensure status code is set correctly before re-throwing
            c.status(error.status as any); // Use 'as any' for status code type if needed
            throw error; // Re-throw known API errors
        }
        // Wrap unknown errors
        throw new ApiError(500, `Internal Server Error: ${error.message || 'Unknown error'}`, "INTERNAL_SERVER_ERROR");
    }
}

export const stateRoutes = new OpenAPIHono()
    // GET /api/state
    .openapi(getStateRoute, async (c) => {
        return handleStateUpdate(c, stateService.getCurrentState());
    })

    // --- New Specific Routes ---

    // POST /api/state/settings
    .openapi(updateSettingsRoute, async (c) => {
        const partialSettings = c.req.valid('json') as Partial<AppSettings>; // Type assertion
        return handleStateUpdate(c, stateService.updateSettings(partialSettings));
    })

    // POST /api/state/active-project-tab
    .openapi(setActiveProjectTabRoute, async (c) => {
        const { tabId } = c.req.valid('json');
        return handleStateUpdate(c, stateService.setActiveProjectTab(tabId));
    })

    // POST /api/state/active-chat
    .openapi(setActiveChatRoute, async (c) => {
        const { chatId } = c.req.valid('json');
        return handleStateUpdate(c, stateService.setActiveChat(chatId));
    })

    // POST /api/state/project-tabs (Create)
    .openapi(createProjectTabRoute, async (c) => {
        const initialData = c.req.valid('json') as Partial<ProjectTabState> & { projectId: string; displayName?: string }; // Type assertion
        return handleStateUpdate(c, stateService.createProjectTab(initialData), 201);
    })

    // POST /api/state/project-tabs/{tabId} (Update)
    .openapi(updateSingleProjectTabRoute, async (c) => {
        const { tabId } = c.req.valid('param');
        const partialTabData = c.req.valid('json') as Partial<ProjectTabState>; // Type assertion
        return handleStateUpdate(c, stateService.updateSingleProjectTab(tabId, partialTabData));
    })

    // DELETE /api/state/project-tabs/{tabId}
    .openapi(deleteProjectTabRoute, async (c) => {
        const { tabId } = c.req.valid('param');
        return handleStateUpdate(c, stateService.deleteProjectTab(tabId));
    })

    // POST /api/state/project-tabs/replace-all
    .openapi(replaceProjectTabsRoute, async (c) => {
        const newTabs = c.req.valid('json') as ProjectTabsStateRecord; // Type assertion
        return handleStateUpdate(c, stateService.updateProjectTabs(newTabs));
    })


    // --- Keeping PUT /api/state for full replacement ---
    .openapi(replaceStateRoute, async (c) => {
        const newState = c.req.valid('json') as GlobalState; // Type assertion
        return handleStateUpdate(c, stateService.replaceState(newState));
    })

    // --- Deprecated Route Handler (Responds with error) ---
    .openapi(updateStatePartialRoute, async (c) => {
        console.warn("[State Route - DEPRECATED POST /api/state/update] Route accessed.");
        c.status(410);
        throw new ApiError(410, "This endpoint is deprecated. Use specific state update endpoints instead.", "DEPRECATED_ENDPOINT");
    });


// Export the type for the frontend client generator
export type StateRouteTypes = typeof stateRoutes;