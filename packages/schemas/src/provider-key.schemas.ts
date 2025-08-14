import { z } from '@hono/zod-openapi'
import { unixTSSchemaSpec, entityIdSchema } from './schema-utils'

export const AI_API_PROVIDERS = [
  'openai',
  'openrouter',
  'lmstudio',
  'ollama',
  'xai',
  'google_gemini',
  'anthropic',
  'groq',
  'together',
  'custom' // Support for custom OpenAI-compatible providers
] as const
export const aiProviderSchema = z.enum(AI_API_PROVIDERS)

export const providerSchema = z.enum(AI_API_PROVIDERS)
export type APIProviders = z.infer<typeof providerSchema>

export const ProviderKeySchema = z
  .object({
    id: entityIdSchema,
    name: z.string().openapi({ example: 'My OpenAI Key', description: 'User-defined name for the key' }),
    provider: z
      .string()
      .openapi({ example: 'openai', description: 'AI Provider identifier (e.g., openai, anthropic, custom)' }),
    // NOTE: We intentionally DO NOT include the 'key' field in the response schema for security.
    // The full key might be returned on creation/update but shouldn't be listed.
    // This comment is misleading if ProviderKeySchema is used for full details.
    // For list views, the key will be masked by the service.
    key: z
      .string()
      .openapi({ example: 'sk-xxxxxxxxxxxxxxxxxxxx', description: 'The actual API Key (handle with care)' }),
    encrypted: z.boolean().default(false).openapi({ example: true, description: 'Whether this key is encrypted' }),
    iv: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: 'base64string', description: 'Initialization vector for encryption' }),
    tag: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: 'base64string', description: 'Authentication tag for AES-GCM' }),
    salt: z.string().nullable().optional().openapi({ example: 'base64string', description: 'Salt for key derivation' }),
    // Custom provider configuration
    baseUrl: z
      .string()
      .url()
      .optional()
      .openapi({ example: 'https://api.example.com/v1', description: 'Base URL for custom OpenAI-compatible providers' }),
    customHeaders: z
      .record(z.string())
      .optional()
      .openapi({ example: { 'X-Custom-Header': 'value' }, description: 'Optional custom headers for the provider' }),
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
    baseUrl: z.string().url().optional().openapi({ example: 'https://api.example.com/v1', description: 'Base URL for custom providers' }),
    customHeaders: z.record(z.string()).optional().openapi({ example: { 'X-Custom-Header': 'value' }, description: 'Custom headers' }),
    isDefault: z.boolean().optional().openapi({ example: true })
  })
  .openapi('CreateProviderKeyRequestBody')

export const UpdateProviderKeyBodySchema = z
  .object({
    name: z.string().min(1).optional().openapi({ example: 'My Updated Key Name' }),
    provider: z.string().min(1).optional().openapi({ example: 'google' }),
    key: z.string().min(1).optional().openapi({ example: 'aizaxxxxxxxxxxxxx' }),
    baseUrl: z.string().url().optional().openapi({ example: 'https://api.example.com/v1', description: 'Base URL for custom providers' }),
    customHeaders: z.record(z.string()).optional().openapi({ example: { 'X-Custom-Header': 'value' }, description: 'Custom headers' }),
    isDefault: z.boolean().optional().openapi({ example: false })
  })
  .refine((data) => data.name || data.provider || data.key || data.baseUrl || data.customHeaders || typeof data.isDefault === 'boolean', {
    message: 'At least one field (name, provider, key, baseUrl, customHeaders, isDefault) must be provided for update'
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

// --- Provider Testing Schemas ---

export const ProviderModelSchema = z
  .object({
    id: z.string().openapi({ example: 'gpt-4o-mini', description: 'Model identifier' }),
    name: z.string().openapi({ example: 'GPT-4o Mini', description: 'Human-readable model name' }),
    description: z
      .string()
      .optional()
      .openapi({ example: 'Fast and efficient GPT-4 model optimized for speed', description: 'Model description' })
  })
  .openapi('ProviderModel')

export const ProviderStatusEnum = z.enum(['connected', 'disconnected', 'error']).openapi({
  description: 'Provider connection status',
  example: 'connected'
})

export const TestProviderRequestSchema = z
  .object({
    provider: z
      .string()
      .min(1)
      .openapi({ example: 'openai', description: 'Provider identifier to test connection for' }),
    apiKey: z
      .string()
      .optional()
      .openapi({
        example: 'sk-xxxxxxxxxxxxxxxxxxxx',
        description: 'API key for API-based providers (OpenAI, Anthropic)'
      }),
    url: z
      .string()
      .url()
      .optional()
      .openapi({ example: 'http://localhost:11434', description: 'Base URL for local providers (Ollama, LMStudio)' }),
    timeout: z
      .number()
      .int()
      .positive()
      .default(10000)
      .openapi({ example: 10000, description: 'Timeout in milliseconds for the test request' })
  })
  .openapi('TestProviderRequest')

export const TestProviderResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true, description: 'Whether the provider test was successful' }),
    provider: z.string().openapi({ example: 'openai', description: 'Provider identifier that was tested' }),
    status: ProviderStatusEnum,
    models: z
      .array(ProviderModelSchema)
      .openapi({
        description: 'Available models from the provider',
        example: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }]
      }),
    responseTime: z.number().nonnegative().openapi({ example: 1250, description: 'Response time in milliseconds' }),
    error: z
      .string()
      .optional()
      .openapi({ example: 'Invalid API key', description: 'Error message if the test failed' }),
    testedAt: z.number().openapi({ example: 1716537600000, description: 'Timestamp when the test was performed' })
  })
  .openapi('TestProviderResponse')

export const BatchTestProviderRequestSchema = z
  .object({
    providers: z
      .array(TestProviderRequestSchema)
      .min(1)
      .openapi({ description: 'Array of provider test requests to execute' }),
    parallel: z
      .boolean()
      .default(true)
      .openapi({ example: true, description: 'Whether to run tests in parallel or sequentially' })
  })
  .openapi('BatchTestProviderRequest')

export const BatchTestSummarySchema = z
  .object({
    connected: z
      .number()
      .nonnegative()
      .openapi({ example: 2, description: 'Number of successfully connected providers' }),
    disconnected: z.number().nonnegative().openapi({ example: 0, description: 'Number of disconnected providers' }),
    error: z.number().nonnegative().openapi({ example: 1, description: 'Number of providers with errors' })
  })
  .openapi('BatchTestSummary')

export const BatchTestProviderResponseSchema = z
  .object({
    results: z.array(TestProviderResponseSchema).openapi({ description: 'Array of test results for each provider' }),
    summary: BatchTestSummarySchema,
    totalTime: z
      .number()
      .nonnegative()
      .openapi({ example: 3500, description: 'Total time taken for all tests in milliseconds' })
  })
  .openapi('BatchTestProviderResponse')

export const ProviderHealthStatusEnum = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']).openapi({
  description: 'Provider health status',
  example: 'healthy'
})

export const ProviderHealthStatusSchema = z
  .object({
    provider: z.string().openapi({ example: 'openai', description: 'Provider identifier' }),
    status: ProviderHealthStatusEnum,
    lastChecked: z.number().openapi({ example: 1716537600000, description: 'Timestamp of last health check' }),
    uptime: z
      .number()
      .min(0)
      .max(100)
      .openapi({ example: 99.8, description: 'Uptime percentage over the monitoring period' }),
    averageResponseTime: z
      .number()
      .nonnegative()
      .openapi({ example: 850, description: 'Average response time in milliseconds' }),
    modelCount: z.number().nonnegative().openapi({ example: 12, description: 'Number of available models' })
  })
  .openapi('ProviderHealthStatus')

// Response wrapper schemas for API endpoints
export const TestProviderApiResponseSchema = z
  .object({
    success: z.literal(true),
    data: TestProviderResponseSchema
  })
  .openapi('TestProviderApiResponse')

export const BatchTestProviderApiResponseSchema = z
  .object({
    success: z.literal(true),
    data: BatchTestProviderResponseSchema
  })
  .openapi('BatchTestProviderApiResponse')

export const ProviderHealthStatusListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ProviderHealthStatusSchema)
  })
  .openapi('ProviderHealthStatusListResponse')

// --- Custom Provider Validation Schemas ---

export const ValidateCustomProviderRequestSchema = z
  .object({
    baseUrl: z.string().url().openapi({ example: 'https://api.example.com/v1', description: 'Base URL to validate' }),
    apiKey: z.string().min(1).openapi({ example: 'sk-xxxxxxxx', description: 'API key for authentication' }),
    customHeaders: z
      .record(z.string())
      .optional()
      .openapi({ example: { 'X-Custom-Header': 'value' }, description: 'Optional custom headers' })
  })
  .openapi('ValidateCustomProviderRequest')

export const CustomProviderFeaturesSchema = z
  .object({
    streaming: z.boolean().openapi({ example: true, description: 'Supports streaming responses' }),
    functionCalling: z.boolean().openapi({ example: false, description: 'Supports function/tool calling' }),
    structuredOutput: z.boolean().openapi({ example: true, description: 'Supports structured JSON output' }),
    vision: z.boolean().openapi({ example: false, description: 'Supports image inputs' }),
    embeddings: z.boolean().openapi({ example: false, description: 'Provides embedding endpoints' })
  })
  .openapi('CustomProviderFeatures')

export const ValidateCustomProviderResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      compatible: z.boolean().openapi({ example: true, description: 'Whether the endpoint is OpenAI-compatible' }),
      models: z.array(ProviderModelSchema).openapi({ description: 'Available models from the provider' }),
      features: CustomProviderFeaturesSchema.openapi({ description: 'Detected provider capabilities' }),
      baseUrl: z.string().url().openapi({ example: 'https://api.example.com/v1', description: 'Validated base URL' })
    })
  })
  .openapi('ValidateCustomProviderResponse')

// Type exports
export type ProviderModel = z.infer<typeof ProviderModelSchema>
export type ProviderStatus = z.infer<typeof ProviderStatusEnum>
export type TestProviderRequest = z.infer<typeof TestProviderRequestSchema>
export type TestProviderResponse = z.infer<typeof TestProviderResponseSchema>
export type BatchTestProviderRequest = z.infer<typeof BatchTestProviderRequestSchema>
export type BatchTestProviderResponse = z.infer<typeof BatchTestProviderResponseSchema>
export type BatchTestSummary = z.infer<typeof BatchTestSummarySchema>
export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>
export type ProviderHealthStatusType = z.infer<typeof ProviderHealthStatusEnum>
export type ValidateCustomProviderRequest = z.infer<typeof ValidateCustomProviderRequestSchema>
export type ValidateCustomProviderResponse = z.infer<typeof ValidateCustomProviderResponseSchema>
export type CustomProviderFeatures = z.infer<typeof CustomProviderFeaturesSchema>
