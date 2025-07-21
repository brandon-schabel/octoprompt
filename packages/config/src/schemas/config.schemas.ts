import { z } from 'zod'
import { providerSchema } from '@octoprompt/schemas'

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
  groq: providerUrlSchema
})

export const filesConfigSchema = z.object({
  allowedExtensions: z.array(z.string()),
  defaultExclusions: z.array(z.string()),
  maxFileSizeForSummary: z.number().positive(),
  maxTokensForSummary: z.number().positive(),
  charsPerTokenEstimate: z.number().positive()
})

export const serverConfigSchema = z.object({
  corsOrigin: z.string(),
  serverHost: z.string(),
  serverPort: z.union([z.string(), z.number()]),
  clientUrl: z.string().url(),
  apiUrl: z.string().url()
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