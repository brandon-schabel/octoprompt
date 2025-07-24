import { z } from 'zod'

// Define provider schema locally to avoid circular dependency
const providerSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'groq',
  'openrouter',
  'xai',
  'together',
  'lmstudio',
  'ollama'
])

export const modelOptionsWithProviderSchema = z.object({
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  provider: providerSchema,
  model: z.string()
})

export const modelConfigSchema = z.object({
  low: modelOptionsWithProviderSchema,
  medium: modelOptionsWithProviderSchema,
  high: modelOptionsWithProviderSchema,
  planning: modelOptionsWithProviderSchema
})

export const providerUrlSchema = z.object({
  baseURL: z.string().url()
})

export const providerConfigSchema = z.object({
  openai: providerUrlSchema,
  anthropic: providerUrlSchema,
  google: providerUrlSchema,
  openrouter: providerUrlSchema,
  groq: providerUrlSchema,
  ollama: providerUrlSchema,
  lmstudio: providerUrlSchema
})

export const filesConfigSchema = z.object({
  allowedExtensions: z.array(z.string()),
  defaultExclusions: z.array(z.string()),
  maxFileSizeForSummary: z.number().positive(),
  maxTokensForSummary: z.number().positive(),
  charsPerTokenEstimate: z.number().positive()
})

export const corsConfigSchema = z.object({
  origin: z.union([z.string(), z.array(z.string())]),
  allowMethods: z.array(z.string()),
  credentials: z.boolean(),
  allowHeaders: z.array(z.string())
})

export const serverConfigSchema = z.object({
  corsOrigin: z.string(),
  corsConfig: corsConfigSchema,
  serverHost: z.string(),
  serverPort: z.union([z.string(), z.number()]),
  devPort: z.number(),
  prodPort: z.number(),
  clientPort: z.number(),
  clientUrl: z.string().url(),
  apiUrl: z.string().url(),
  isDevEnv: z.boolean(),
  isTestEnv: z.boolean(),
  isProdEnv: z.boolean()
})

export const appConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string()
})

export const globalConfigSchema = z.object({
  app: appConfigSchema,
  server: serverConfigSchema,
  models: modelConfigSchema,
  providers: providerConfigSchema,
  files: filesConfigSchema
})

export type ValidatedGlobalConfig = z.infer<typeof globalConfigSchema>
export type ValidatedModelConfig = z.infer<typeof modelConfigSchema>
export type ValidatedProviderConfig = z.infer<typeof providerConfigSchema>
export type ValidatedFilesConfig = z.infer<typeof filesConfigSchema>
export type ValidatedServerConfig = z.infer<typeof serverConfigSchema>
export type ValidatedAppConfig = z.infer<typeof appConfigSchema>
