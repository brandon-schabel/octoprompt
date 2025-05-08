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

    ProjectAndPromptIdParamsSchema,
    PromptResponseSchema,
    PromptListResponseSchema,
    OptimizePromptResponseSchema,
    OptimizePromptRequestSchema
} from "shared/src/schemas/prompt.schemas";
import { addPromptToProject, createPrompt, deletePrompt, getPromptById, listAllPrompts, listPromptsByProject, removePromptFromProject, updatePrompt, optimizePrompt } from "@/services/prompt-service";
import { ProjectIdParamsSchema } from 'shared/src/schemas/project.schemas';


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
        // Service will throw ApiError if project (referenced by body.projectId) or prompt creation fails.
        const createdPrompt = await createPrompt({
            name: body.name,
            content: body.content,
            projectId: body.projectId // Pass projectId directly to service
        });
        return c.json({ success: true, data: createdPrompt } satisfies z.infer<typeof PromptResponseSchema>, 201);
    })

    // List all prompts
    .openapi(listAllPromptsRoute, async (c) => {
        // TODO: Determine if projectId should be included here (likely null or omitted)
        return c.json({ success: true, data: await listAllPrompts() } satisfies z.infer<typeof PromptListResponseSchema>, 200);
    })

    // List prompts for a project
    .openapi(listProjectPromptsRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        // listPromptsByProject can return empty array if project exists but has no prompts.
        // If project itself doesn't exist, this should ideally be checked before, 
        // or the service should throw if it's meant to validate project existence.
        // For now, assuming project existence is handled or service allows it.
        const projectPrompts = await listPromptsByProject(projectId);
        return c.json({ success: true, data: projectPrompts } satisfies z.infer<typeof PromptListResponseSchema>, 200);
    })

    // Add prompt to project
    .openapi(addPromptToProjectRoute, async (c) => {
        const { promptId, projectId } = c.req.valid('param');
        // Service now throws ApiError if prompt or project not found, or linking fails.
        await addPromptToProject(promptId, projectId);
        return c.json({ success: true, message: "Prompt linked to project." } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
    })

    // Remove prompt from project
    .openapi(removePromptFromProjectRoute, async (c) => {
        const { promptId, projectId } = c.req.valid('param');
        // Service now throws ApiError if prompt/project not found or link doesn't exist.
        await removePromptFromProject(promptId, projectId);
        return c.json({ success: true, message: "Prompt unlinked from project." } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
    })

    // Get prompt by ID
    .openapi(getPromptByIdRoute, async (c) => {
        const { promptId } = c.req.valid('param');
        // getPromptById service now throws ApiError if not found.
        const prompt = await getPromptById(promptId);
        return c.json({ success: true, data: prompt } satisfies z.infer<typeof PromptResponseSchema>, 200);
    })

    // Update a prompt
    .openapi(updatePromptRoute, async (c) => {
        const { promptId } = c.req.valid('param');
        const body = c.req.valid('json');
        // updatePrompt service now throws ApiError if not found or update fails.
        const updatedPrompt = await updatePrompt(promptId, body);
        return c.json({ success: true, data: updatedPrompt } satisfies z.infer<typeof PromptResponseSchema>, 200);
    })

    // Delete a prompt
    .openapi(deletePromptRoute, async (c) => {
        const { promptId } = c.req.valid('param');
        // deletePrompt service now throws ApiError if not found.
        await deletePrompt(promptId);
        return c.json({ success: true, message: "Prompt deleted successfully." } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
    })
    .openapi(optimizePromptRoute, async (c) => { // <--- Use .openapi()
        const { userContext } = c.req.valid('json'); // <--- Get validated data
        // optimizePrompt service now throws ApiError on failure.
        const optimized = await optimizePrompt(userContext);
        const responseData = { optimizedPrompt: optimized };
        return c.json({ success: true, data: responseData } satisfies z.infer<typeof OptimizePromptResponseSchema>, 200);
    });

export type PromptRouteTypes = typeof promptRoutes;