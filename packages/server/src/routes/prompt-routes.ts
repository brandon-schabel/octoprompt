import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ApiError } from 'shared';
import {
    ApiErrorResponseSchema,
    OperationSuccessResponseSchema
} from 'shared/src/schemas/common.schemas';
import {
    CreatePromptBodySchema,
    UpdatePromptBodySchema,
    PromptIdParamsSchema,
    ProjectIdParamsSchema,
    ProjectAndPromptIdParamsSchema,
    PromptResponseSchema,
    PromptListResponseSchema,
    PromptSchema,
    type Prompt,
    OptimizePromptResponseSchema,
    OptimizePromptRequestSchema
} from "shared/src/schemas/prompt.schemas";
import { addPromptToProject, createPrompt, deletePrompt, getPromptById, listAllPrompts, listPromptsByProject, removePromptFromProject, updatePrompt, optimizePrompt } from "@/services/prompt-service";


// --- Route Definitions ---
const createPromptRoute = createRoute({
    method: 'post',
    path: '/api/prompts',
    tags: ['Prompts'],
    summary: 'Create a new prompt',
    request: {
        body: {
            content: { 'application/json': { schema: CreatePromptBodySchema } },
            required: true,
        },
    },
    responses: {
        201: {
            content: { 'application/json': { schema: PromptResponseSchema } },
            description: 'Prompt created successfully',
        },
        422: { // Validation Error
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        404: { // Project not found if projectId is provided and invalid
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Referenced project not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const listAllPromptsRoute = createRoute({
    method: 'get',
    path: '/api/prompts',
    tags: ['Prompts'],
    summary: 'List all available prompts',
    responses: {
        200: {
            content: { 'application/json': { schema: PromptListResponseSchema } },
            description: 'Successfully retrieved all prompts',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const listProjectPromptsRoute = createRoute({
    method: 'get',
    path: '/api/projects/{projectId}/prompts',
    tags: ['Projects', 'Prompts'],
    summary: 'List prompts associated with a specific project',
    request: {
        params: ProjectIdParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: PromptListResponseSchema } },
            description: 'Successfully retrieved project prompts',
        },
        404: { // Project not found
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Project not found',
        },
        422: { // Validation Error on projectId format
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const addPromptToProjectRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/prompts/{promptId}',
    tags: ['Projects', 'Prompts'],
    summary: 'Associate a prompt with a project',
    request: {
        params: ProjectAndPromptIdParamsSchema,
    },
    responses: {
        200: { // Or 201 if you prefer for creating a link
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Prompt successfully associated with project',
        },
        404: { // Project or Prompt not found
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Project or Prompt not found',
        },
        422: { // Validation Error
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const removePromptFromProjectRoute = createRoute({
    method: 'delete',
    path: '/api/projects/{projectId}/prompts/{promptId}',
    tags: ['Projects', 'Prompts'],
    summary: 'Disassociate a prompt from a project',
    request: {
        params: ProjectAndPromptIdParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Prompt successfully disassociated from project',
        },
        404: { // Project or Prompt not found, or link doesn't exist
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Project or Prompt not found, or association does not exist',
        },
        422: { // Validation Error
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const getPromptByIdRoute = createRoute({
    method: 'get',
    path: '/api/prompts/{promptId}',
    tags: ['Prompts'],
    summary: 'Get a specific prompt by its ID',
    request: {
        params: PromptIdParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: PromptResponseSchema } },
            description: 'Successfully retrieved prompt',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Prompt not found',
        },
        422: { // Validation Error
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const updatePromptRoute = createRoute({
    method: 'patch',
    path: '/api/prompts/{promptId}',
    tags: ['Prompts'],
    summary: 'Update a prompt\'s details',
    request: {
        params: PromptIdParamsSchema,
        body: {
            content: { 'application/json': { schema: UpdatePromptBodySchema } },
            required: true,
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: PromptResponseSchema } },
            description: 'Prompt updated successfully',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Prompt not found',
        },
        422: { // Validation Error
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

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

const deletePromptRoute = createRoute({
    method: 'delete',
    path: '/api/prompts/{promptId}',
    tags: ['Prompts'],
    summary: 'Delete a prompt',
    request: {
        params: PromptIdParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Prompt deleted successfully',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Prompt not found',
        },
        422: { // Validation Error
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
export const promptRoutes = new OpenAPIHono() // <--- Use OpenAPIHono
    // Create new prompt
    .openapi(createPromptRoute, async (c) => { // <--- Use .openapi() and route name
        const body = c.req.valid('json'); // <--- Get validated data

        try {
            // 1) Create the prompt
            const createdPrompt = await createPrompt({
                name: body.name,
                content: body.content
            });

            // 2) If projectId was given, link it to the project:
            if (body.projectId) {
                try {
                    await addPromptToProject(createdPrompt.id, body.projectId);
                } catch (linkError: any) {
                    // If linking fails (e.g., project not found), we might still consider prompt creation successful,
                    // but log the error or potentially roll back / delete the prompt if atomicity is crucial.
                    console.error(`Failed to link prompt ${createdPrompt.id} to project ${body.projectId}: ${linkError.message}`);
                    // Depending on requirements, you might throw an error here
                    // throw new ApiError(404, `Referenced project with ID ${body.projectId} not found`, 'PROJECT_NOT_FOUND');
                }
            }
            return c.json({ success: true, data: createdPrompt } satisfies z.infer<typeof PromptResponseSchema>, 201);
        } catch (error: any) {
            console.error("Error creating prompt:", error);
            // Handle specific errors if needed, otherwise let global handler manage
            throw error; // Re-throw for global handler
        }
    })

    // List all prompts
    .openapi(listAllPromptsRoute, async (c) => {
        // TODO: Determine if projectId should be included here (likely null or omitted)
        return c.json({ success: true, data: await listAllPrompts() } satisfies z.infer<typeof PromptListResponseSchema>, 200);
    })

    // List prompts for a project
    .openapi(listProjectPromptsRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        try {
            const projectPrompts = await listPromptsByProject(projectId);
            return c.json({ success: true, data: projectPrompts } satisfies z.infer<typeof PromptListResponseSchema>, 200);
        } catch (error: any) {
            // Handle potential "project not found" errors from the service
            if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                throw new ApiError(404, `Project with ID ${projectId} not found`, 'PROJECT_NOT_FOUND');
            }
            throw error; // Re-throw for global handler
        }
    })

    // Add prompt to project
    .openapi(addPromptToProjectRoute, async (c) => {
        const { promptId, projectId } = c.req.valid('param');
        try {
            await addPromptToProject(promptId, projectId);
            return c.json({ success: true, message: "Prompt linked to project." } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
        } catch (error: any) {
            // Handle potential "not found" errors
            if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                // Could be either prompt or project
                throw new ApiError(404, `Prompt or Project not found`, 'NOT_FOUND');
            }
            throw error;
        }
    })

    // Remove prompt from project
    .openapi(removePromptFromProjectRoute, async (c) => {
        const { promptId, projectId } = c.req.valid('param');
        try {
            await removePromptFromProject(promptId, projectId);
            return c.json({ success: true, message: "Prompt unlinked from project." } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
        } catch (error: any) {
            if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                // Could be either prompt or project or the link itself
                throw new ApiError(404, `Prompt or Project not found, or link does not exist`, 'NOT_FOUND');
            }
            throw error;
        }
    })

    // Get prompt by ID
    .openapi(getPromptByIdRoute, async (c) => {
        const { promptId } = c.req.valid('param');
        const prompt = await getPromptById(promptId);
        if (!prompt) {
            throw new ApiError(404, "Prompt not found", "PROMPT_NOT_FOUND");
        }
        // TODO: Decide if we need to fetch associated project ID here, or if it's okay to omit/be null
        return c.json({ success: true, data: prompt } satisfies z.infer<typeof PromptResponseSchema>, 200);
    })

    // Update a prompt
    .openapi(updatePromptRoute, async (c) => {
        const { promptId } = c.req.valid('param');
        const body = c.req.valid('json');
        try {
            const updatedPrompt = await updatePrompt(promptId, body);
            // Ensure updatedPrompt is not null before calling mapPromptToResponse
            if (!updatedPrompt) {
                throw new ApiError(404, `Prompt with ID ${promptId} not found`, 'PROMPT_NOT_FOUND');
            }
            return c.json({ success: true, data: updatedPrompt } satisfies z.infer<typeof PromptResponseSchema>, 200);
        } catch (error: any) {
            if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                throw new ApiError(404, `Prompt with ID ${promptId} not found`, 'PROMPT_NOT_FOUND');
            }
            throw error;
        }
    })

    // Delete a prompt
    .openapi(deletePromptRoute, async (c) => {
        const { promptId } = c.req.valid('param');
        try {
            await deletePrompt(promptId);
            // deletePrompt service should handle not found (e.g., return false or throw)
            return c.json({ success: true, message: "Prompt deleted successfully." } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
        } catch (error: any) {
            if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                throw new ApiError(404, `Prompt with ID ${promptId} not found`, 'PROMPT_NOT_FOUND');
            }
            throw error;
        }
    })
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

export type PromptRouteTypes = typeof promptRoutes;