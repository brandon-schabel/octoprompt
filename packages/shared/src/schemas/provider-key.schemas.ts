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

export const providerSchema = z.enum(AI_API_PROVIDERS)
export type APIProviders = z.infer<typeof providerSchema>

export const ProviderKeySchema = z
  .object({
    id: z.number().openapi({ example: 1716537600000, description: 'Provider Key ID' }),
    provider: z
      .string()
      .openapi({ example: 'openai', description: 'AI Provider identifier (e.g., openai, anthropic)' }),
    // NOTE: We intentionally DO NOT include the 'key' field in the response schema for security.
    // The full key might be returned on creation/update but shouldn't be listed.
    key: z
      .string()
      .openapi({ example: 'sk-xxxxxxxxxxxxxxxxxxxx', description: 'The actual API Key (handle with care)' }),
    created: z.number().openapi({ example: 1716537600000, description: 'Creation timestamp (ISO 8601)' }),
    updated: z.number().openapi({ example: 1716537600000, description: 'Last update timestamp (ISO 8601)' })
  })
  .openapi('ProviderKey')

export const CreateProviderKeyInputSchema = ProviderKeySchema.omit({
  id: true,
  created: true,
  updated: true
})

export type CreateProviderKeyInput = z.infer<typeof CreateProviderKeyInputSchema>

export const ProviderKeyWithSecretSchema = ProviderKeySchema.extend({
  key: z.string().openapi({ example: 'sk-xxxxxxxxxxxxxxxxxxxx', description: 'The actual API Key (handle with care)' })
}).openapi('ProviderKeyWithSecret')

export const CreateProviderKeyBodySchema = z
  .object({
    provider: z.string().min(1).openapi({ example: 'anthropic' }),
    key: z.string().min(1).openapi({ example: 'sk-ant-xxxxxxxx' })
  })
  .openapi('CreateProviderKeyRequestBody')

export const UpdateProviderKeyBodySchema = z
  .object({
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

export const ProviderKeyResponseSchema = z
  .object({
    success: z.literal(true),
    data: ProviderKeyWithSecretSchema
  })
  .openapi('ProviderKeyResponse')

export const ProviderKeyListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ProviderKeySchema)
  })
  .openapi('ProviderKeyListResponse')

export type CreateProviderKeyBody = z.infer<typeof CreateProviderKeyBodySchema>
export type UpdateProviderKeyBody = z.infer<typeof UpdateProviderKeyBodySchema>
export type ProviderKeyIdParams = z.infer<typeof ProviderKeyIdParamsSchema>

export type ProviderKey = z.infer<typeof ProviderKeySchema>

export type UpdateProviderKeyInput = z.infer<typeof UpdateProviderKeyBodySchema>
