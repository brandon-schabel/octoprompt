import { z } from '@hono/zod-openapi';

// --- Base Schema for a Prompt ---
// Represents the structure of a single Prompt object as returned by the API
export const PromptSchema = z.object({
    id: z.string().uuid().openapi({ example: 'p1a2b3c4-e5f6-7890-1234-567890abcdef', description: 'Prompt UUID' }),
    name: z.string().openapi({ example: 'Code Refactoring Prompt', description: 'Prompt name' }),
    content: z.string().openapi({ example: 'Refactor the following code to be more efficient: {code}', description: 'Prompt content template' }),
    projectId: z.string().min(1).optional().openapi({ example: 'project-123', description: 'Optional Project ID this prompt is linked to (contextual)' }), // Changed from uuid()
    createdAt: z.string().datetime().openapi({ example: '2024-02-01T10:00:00.000Z', description: 'Creation timestamp (ISO 8601)' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-02-01T10:05:00.000Z', description: 'Last update timestamp (ISO 8601)' })
}).openapi('Prompt');

// --- Request Body Schemas ---
export const CreatePromptBodySchema = z.object({
    // Allow projectId to be optional during creation, linking can happen separately or via this field
    projectId: z.string().min(1).optional().openapi({ example: 'project-456', description: 'Optional Project ID to link the prompt to upon creation' }), // Changed from uuid()
    name: z.string().min(1).openapi({ example: 'My New Prompt' }),
    content: z.string().min(1).openapi({ example: 'Translate this text: {text}' }),
}).openapi('CreatePromptRequestBody');

export const UpdatePromptBodySchema = z.object({
    name: z.string().min(1).optional().openapi({ example: 'Updated Prompt Name' }),
    content: z.string().min(1).optional().openapi({ example: 'Updated content: {variable}' }),
}).refine(data => data.name || data.content, {
    message: "At least one of name or content must be provided for update"
}).openapi('UpdatePromptRequestBody');

// --- Request Parameter Schemas ---
export const PromptIdParamsSchema = z.object({
    promptId: z.string().uuid().openapi({
        param: { name: 'promptId', in: 'path' },
        example: 'p1a2b3c4-e5f6-7890-1234-567890abcdef',
        description: 'The UUID of the prompt'
    })
}).openapi('PromptIdParams');

export const ProjectIdParamsSchema = z.object({
    projectId: z.string().min(1).openapi({ // Changed from uuid()
        param: { name: 'projectId', in: 'path' },
        example: 'project-789',
        description: 'The ID of the project'
    })
}).openapi('ProjectIdParams');

export const ProjectAndPromptIdParamsSchema = z.object({
    projectId: z.string().min(1).openapi({ // Changed from uuid()
        param: { name: 'projectId', in: 'path' },
        example: 'project-abc',
        description: 'The ID of the project'
    }),
    promptId: z.string().uuid().openapi({
        param: { name: 'promptId', in: 'path' },
        example: 'p1a2b3c4-e5f6-7890-1234-567890abcdef',
        description: 'The UUID of the prompt'
    })
}).openapi('ProjectAndPromptIdParams');


// --- Response Schemas ---
export const PromptResponseSchema = z.object({
    success: z.literal(true),
    data: PromptSchema // Use the base Prompt schema
}).openapi('PromptResponse');

export const PromptListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(PromptSchema) // Array of Prompt schemas
}).openapi('PromptListResponse');


// --- Keep the original structure for potential direct use (optional) ---
// This might be redundant now with the OpenAPI-enhanced schemas above
export const promptApiValidation = {
    create: {
        body: CreatePromptBodySchema // Use the OpenAPI schema
    },
    list: {
        params: ProjectIdParamsSchema // Use the OpenAPI schema
    },
    getOrDelete: {
        params: PromptIdParamsSchema // Use the OpenAPI schema
    },
    update: {
        params: PromptIdParamsSchema, // Use the OpenAPI schema
        body: UpdatePromptBodySchema // Use the OpenAPI schema
    },
    // Specific schemas for project/prompt linking
    addOrRemoveFromProject: {
        params: ProjectAndPromptIdParamsSchema // Use the combined schema
    }
} as const;

// Export types if needed elsewhere
export type CreatePromptBody = z.infer<typeof CreatePromptBodySchema>;
export type UpdatePromptBody = z.infer<typeof UpdatePromptBodySchema>;
export type PromptIdParams = z.infer<typeof PromptIdParamsSchema>;
export type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;
export type ProjectAndPromptIdParams = z.infer<typeof ProjectAndPromptIdParamsSchema>;