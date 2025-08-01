import { z } from '@hono/zod-openapi'
import { ProjectIdParamsSchema } from './project.schemas'
import { unixTSOptionalSchemaSpec, unixTSSchemaSpec } from './schema-utils'

export const PromptSchema = z
  .object({
    id: unixTSSchemaSpec,
    name: z.string().openapi({ example: 'Code Refactoring Prompt', description: 'Prompt name' }),
    content: z.string().openapi({
      example: 'Refactor the following code to be more efficient: {code}',
      description: 'Prompt content template'
    }),
    projectId: unixTSOptionalSchemaSpec,
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('Prompt')

export const CreatePromptBodySchema = z
  .object({
    // Allow projectId to be optional during creation, linking can happen separately or via this field
    projectId: unixTSOptionalSchemaSpec,
    name: z.string().min(1).openapi({ example: 'My New Prompt' }),
    content: z.string().min(1).openapi({ example: 'Translate this text: {text}' })
  })
  .openapi('CreatePromptRequestBody')

export const UpdatePromptBodySchema = z
  .object({
    name: z.string().min(1).optional().openapi({ example: 'Updated Prompt Name' }),
    content: z.string().min(1).optional().openapi({ example: 'Updated content: {variable}' })
  })
  .refine((data) => data.name || data.content, {
    message: 'At least one of name or content must be provided for update'
  })
  .openapi('UpdatePromptRequestBody')

// --- Request Parameter Schemas ---
export const PromptIdParamsSchema = z
  .object({
    promptId: unixTSSchemaSpec.openapi({ param: { name: 'promptId', in: 'path' } })
  })
  .openapi('PromptIdParams')

export const ProjectAndPromptIdParamsSchema = z
  .object({
    projectId: unixTSSchemaSpec.openapi({ param: { name: 'projectId', in: 'path' } }),
    promptId: unixTSSchemaSpec.openapi({ param: { name: 'promptId', in: 'path' } })
  })
  .openapi('ProjectAndPromptIdParams')

export const PromptResponseSchema = z
  .object({
    success: z.literal(true),
    data: PromptSchema
  })
  .openapi('PromptResponse')

export const PromptListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(PromptSchema)
  })
  .openapi('PromptListResponse')

// Export types if needed elsewhere
export type CreatePromptBody = z.infer<typeof CreatePromptBodySchema>
export type UpdatePromptBody = z.infer<typeof UpdatePromptBodySchema>
export type PromptIdParams = z.infer<typeof PromptIdParamsSchema>
export type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>
export type ProjectAndPromptIdParams = z.infer<typeof ProjectAndPromptIdParamsSchema>

// --- Request Body Schema ---
export const OptimizeUserInputRequestSchema = z
  .object({
    projectId: unixTSSchemaSpec,
    userContext: z.string().min(1).openapi({
      example: 'Make my login form better.',
      description: "The user's initial prompt or context to be optimized."
    })
  })
  .openapi('OptimizePromptRequest')

export const OptimizePromptResponseSchema = z
  .object({
    success: z.literal(true).openapi({ description: 'Indicates successful optimization' }),
    data: z.object({
      optimizedPrompt: z.string().openapi({
        example:
          'Optimize the user experience for the login form, focusing on clarity, security, and accessibility. Suggest improvements for field labels, error handling, password requirements display, and button text.',
        description: 'The optimized prompt generated by the service.'
      })
    })
  })
  .openapi('OptimizePromptResponse')

export const PromptProjectSchema = z.object({
  id: unixTSSchemaSpec,
  promptId: unixTSSchemaSpec,
  projectId: unixTSSchemaSpec
})

// --- Suggest Prompts Schemas ---
export const SuggestPromptsRequestSchema = z
  .object({
    userInput: z.string().min(1).openapi({
      example: 'help me implement authentication',
      description: 'The user input describing what they want to accomplish'
    }),
    limit: z.number().int().positive().max(10).optional().default(5).openapi({
      example: 5,
      description: 'Maximum number of prompts to suggest (default: 5, max: 10)'
    })
  })
  .openapi('SuggestPromptsRequest')

export const SuggestPromptsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      prompts: z.array(PromptSchema).openapi({
        description: 'Array of suggested prompts ordered by relevance (most relevant first)'
      })
    })
  })
  .openapi('SuggestPromptsResponse')

// Export types if needed elsewhere
export type OptimizePromptRequest = z.infer<typeof OptimizeUserInputRequestSchema>
export type Prompt = z.infer<typeof PromptSchema>
export type PromptListResponse = z.infer<typeof PromptListResponseSchema>
export type PromptResponse = z.infer<typeof PromptResponseSchema>
export type PromptProject = z.infer<typeof PromptProjectSchema>
export type SuggestPromptsRequest = z.infer<typeof SuggestPromptsRequestSchema>
export type SuggestPromptsResponse = z.infer<typeof SuggestPromptsResponseSchema>
