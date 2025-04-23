// packages/server/src/routes/promptimizer-routes.ts
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'; // <--- Import createRoute and OpenAPIHono
import {
    OptimizePromptRequestSchema,
    OptimizePromptResponseSchema
} from 'shared/src/validation/promptimizer-api-validation'; // <--- Import specific schemas
import { ApiErrorResponseSchema } from 'shared/src/validation/chat-api-validation'; // For error response
import { optimizePrompt } from '@/services/promptimizer-service';
import { ApiError } from 'shared'; // Import ApiError


// --- Route Definition ---
const optimizePromptRoute = createRoute({
    method: 'post',
    path: '/api/prompt/optimize',
    tags: ['Prompts', 'AI'],
    summary: 'Optimize a user-provided prompt using an AI model',
    request: {
        body: {
            content: { 'application/json': { schema: OptimizePromptRequestSchema } },
            required: true,
            description: 'The user prompt context to optimize',
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OptimizePromptResponseSchema } },
            description: 'Successfully optimized the prompt',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error or AI provider error during optimization',
        },
        // Add other potential errors like 400 Bad Request if the underlying service requires specific inputs
    },
});

// --- Hono App Instance ---
export const promptimizerRoutes = new OpenAPIHono() // <--- Use OpenAPIHono
    .openapi(optimizePromptRoute, async (c) => { // <--- Use .openapi()
        const { userContext } = c.req.valid('json'); // <--- Get validated data
        try {
            const optimized = await optimizePrompt(userContext);
            // Structure the response according to OptimizePromptResponseSchema
            const responseData = { optimizedPrompt: optimized };
            return c.json({ success: true, data: responseData } satisfies z.infer<typeof OptimizePromptResponseSchema>, 200);
        } catch (error) {
            console.error('Prompt optimize route error:', error);
            // Throw a structured ApiError for the global handler
            const message = error instanceof Error ? error.message : String(error);
            throw new ApiError(500, `Failed to optimize prompt: ${message}`, 'PROMPT_OPTIMIZE_ERROR');
        }
    });

// Export the type for the frontend client
export type PromptimizerRouteTypes = typeof promptimizerRoutes;