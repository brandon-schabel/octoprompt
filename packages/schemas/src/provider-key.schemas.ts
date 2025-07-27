import { z } from '@hono/zod-openapi'
import { unixTSSchemaSpec } from './schema-utils'

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
    id: unixTSSchemaSpec,
    name: z.string().openapi({ example: 'My OpenAI Key', description: 'User-defined name for the key' }),
    provider: z
      .string()
      .openapi({ example: 'openai', description: 'AI Provider identifier (e.g., openai, anthropic)' }),
    // NOTE: We intentionally DO NOT include the 'key' field in the response schema for security.
    // The full key might be returned on creation/update but shouldn't be listed.
    // This comment is misleading if ProviderKeySchema is used for full details.
    // For list views, the key will be masked by the service.
    key: z
      .string()
      .openapi({ example: 'sk-xxxxxxxxxxxxxxxxxxxx', description: 'The actual API Key (handle with care)' }),
    encrypted: z.boolean().default(false).openapi({ example: true, description: 'Whether this key is encrypted' }),
    iv: z.string().optional().openapi({ example: 'base64string', description: 'Initialization vector for encryption' }),
    tag: z.string().optional().openapi({ example: 'base64string', description: 'Authentication tag for AES-GCM' }),
    salt: z.string().optional().openapi({ example: 'base64string', description: 'Salt for key derivation' }),
    isDefault: z
      .boolean()
      .default(false)
      .openapi({ example: false, description: 'Whether this key is the default for its provider' }),
    isActive: z.boolean().default(true).openapi({ example: true, description: 'Whether this key is currently active' }),
    environment: z
      .string()
      .default('production')
      .openapi({ example: 'production', description: 'Environment this key is for (production, staging, etc.)' }),
    description: z
      .string()
      .optional()
      .openapi({ example: 'Main production key', description: 'Optional description of the key' }),
    expiresAt: z.number().optional().openapi({ example: 1716537600000, description: 'Optional expiration timestamp' }),
    lastUsed: z.number().optional().openapi({ example: 1716537600000, description: 'Last time this key was used' }),
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
    name: z.string().min(1).openapi({ example: 'My OpenAI Key' }),
    provider: z.string().min(1).openapi({ example: 'anthropic' }),
    key: z.string().min(1).openapi({ example: 'sk-ant-xxxxxxxx' }),
    isDefault: z.boolean().optional().openapi({ example: true })
  })
  .openapi('CreateProviderKeyRequestBody')

export const UpdateProviderKeyBodySchema = z
  .object({
    name: z.string().min(1).optional().openapi({ example: 'My Updated Key Name' }),
    provider: z.string().min(1).optional().openapi({ example: 'google' }),
    key: z.string().min(1).optional().openapi({ example: 'aizaxxxxxxxxxxxxx' }),
    isDefault: z.boolean().optional().openapi({ example: false })
  })
  .refine((data) => data.name || data.provider || data.key || typeof data.isDefault === 'boolean', {
    message: 'At least one field (name, provider, key, isDefault) must be provided for update'
  })
  .openapi('UpdateProviderKeyRequestBody')

// --- Request Parameter Schemas ---
export const ProviderKeyIdParamsSchema = z
  .object({
    keyId: unixTSSchemaSpec.openapi({ param: { name: 'keyId', in: 'path' } })
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
