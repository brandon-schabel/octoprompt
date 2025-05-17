import { z } from '@hono/zod-openapi'

export const AI_API_PROVIDERS = [
  'openai',
  'openrouter',
  'lmstudio',
  'ollama',
  'xai',
  'google_gemini',
  'anthropic',
  'groq',
  'together'
] as const
export const aiProviderSchema = z.enum(AI_API_PROVIDERS)

// ------------------------------------------------------------------
// Provider enum
// ------------------------------------------------------------------
export const providerSchema = z.enum(AI_API_PROVIDERS)
export type APIProviders = z.infer<typeof providerSchema>

// --- Base Schema for a Provider Key ---
// Represents the structure of a single ProviderKey object as returned by the API (excluding the sensitive key itself)
export const ProviderKeySchema = z
  .object({
    id: z.string().min(1).openapi({ example: 'key-1a2b3c4d', description: 'Provider Key ID' }),
    provider: z
      .string()
      .openapi({ example: 'openai', description: 'AI Provider identifier (e.g., openai, anthropic)' }),
    // NOTE: We intentionally DO NOT include the 'key' field in the response schema for security.
    // The full key might be returned on creation/update but shouldn't be listed.
    key: z
      .string()
      .openapi({ example: 'sk-xxxxxxxxxxxxxxxxxxxx', description: 'The actual API Key (handle with care)' }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: '2024-03-01T11:00:00.000Z', description: 'Creation timestamp (ISO 8601)' }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ example: '2024-03-01T11:05:00.000Z', description: 'Last update timestamp (ISO 8601)' })
  })
  .openapi('ProviderKey')

// Schema for the data needed to CREATE a key (omits generated fields)
export const CreateProviderKeyInputSchema = ProviderKeySchema.omit({
  id: true, // ID is also typically generated
  createdAt: true,
  updatedAt: true
})

// Type for the input data
export type CreateProviderKeyInput = z.infer<typeof CreateProviderKeyInputSchema>

// Schema for responses that include the key (e.g., after creation/update)
export const ProviderKeyWithSecretSchema = ProviderKeySchema.extend({
  key: z.string().openapi({ example: 'sk-xxxxxxxxxxxxxxxxxxxx', description: 'The actual API Key (handle with care)' })
}).openapi('ProviderKeyWithSecret')

// --- Request Body Schemas ---
export const CreateProviderKeyBodySchema = z
  .object({
    provider: z.string().min(1).openapi({ example: 'anthropic' }),
    key: z.string().min(1).openapi({ example: 'sk-ant-xxxxxxxx' })
  })
  .openapi('CreateProviderKeyRequestBody')

export const UpdateProviderKeyBodySchema = z
  .object({
    // Allow updating only provider, only key, or both
    provider: z.string().min(1).optional().openapi({ example: 'google' }),
    key: z.string().min(1).optional().openapi({ example: 'aizaxxxxxxxxxxxxx' })
  })
  .refine((data) => data.provider || data.key, {
    message: 'At least one of provider or key must be provided for update'
  })
  .openapi('UpdateProviderKeyRequestBody')

// --- Request Parameter Schemas ---
export const ProviderKeyIdParamsSchema = z
  .object({
    keyId: z
      .string()
      .min(1)
      .openapi({
        param: { name: 'keyId', in: 'path' },
        example: 'key-1a2b3c4d',
        description: 'The ID of the provider key'
      })
  })
  .openapi('ProviderKeyIdParams')

// --- Response Schemas ---
export const ProviderKeyResponseSchema = z
  .object({
    success: z.literal(true),
    // Use the schema WITH the secret key for single-item responses (create, getById, update)
    data: ProviderKeyWithSecretSchema
  })
  .openapi('ProviderKeyResponse')

export const ProviderKeyListResponseSchema = z
  .object({
    success: z.literal(true),
    // Use the schema WITHOUT the secret key for list responses
    data: z.array(ProviderKeySchema)
  })
  .openapi('ProviderKeyListResponse')

// --- Original structure (optional, might be redundant) ---
export const providerKeyApiValidation = {
  create: {
    body: CreateProviderKeyBodySchema // Use OpenAPI schema
  },
  update: {
    params: ProviderKeyIdParamsSchema, // Use OpenAPI schema
    body: UpdateProviderKeyBodySchema // Use OpenAPI schema
  },
  getOrDelete: {
    params: ProviderKeyIdParamsSchema // Use OpenAPI schema
  }
} as const

// Export types if needed elsewhere
export type CreateProviderKeyBody = z.infer<typeof CreateProviderKeyBodySchema>
export type UpdateProviderKeyBody = z.infer<typeof UpdateProviderKeyBodySchema>
export type ProviderKeyIdParams = z.infer<typeof ProviderKeyIdParamsSchema>

export type ProviderKey = z.infer<typeof ProviderKeySchema>

// Explicit type for the input to the updateKey service method
export type UpdateProviderKeyInput = z.infer<typeof UpdateProviderKeyBodySchema>
