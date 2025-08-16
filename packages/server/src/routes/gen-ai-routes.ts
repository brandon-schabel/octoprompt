import { createRoute, z } from '@hono/zod-openapi'

import { ApiError } from '@promptliano/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { createStandardResponses, successResponse } from '../utils/route-helpers'
import { ModelsQuerySchema } from '@promptliano/schemas'
import {
  AiGenerateTextRequestSchema,
  AiGenerateTextResponseSchema,
  AiGenerateStructuredRequestSchema,
  AiGenerateStructuredResponseSchema,
  type StructuredDataSchemaConfig,
  ModelsListResponseSchema,
  structuredDataSchemas
} from '@promptliano/schemas'

import { OpenAPIHono } from '@hono/zod-openapi'
import {
  generateSingleText,
  generateStructuredData,
  genTextStream,
  providerKeyService,
  updateProviderSettings
} from '@promptliano/services' // Import the service instance
import { type APIProviders, type ProviderKey } from '@promptliano/schemas'
import {
  type ProviderKeysConfig,
  ModelFetcherService
} from '@promptliano/services/src/model-providers/model-fetcher-service'
import { OLLAMA_BASE_URL, LMSTUDIO_BASE_URL } from '@promptliano/services/src/model-providers/provider-defaults'
import { stream } from 'hono/streaming'

// Define the Zod schema for filename suggestions
const FilenameSuggestionSchema = z
  .object({
    suggestions: z
      .array(z.string())
      .length(5)
      .openapi({
        description: 'An array of exactly 5 suggested filenames.',
        example: ['stringUtils.ts', 'textHelpers.ts', 'stringManipulators.ts', 'strUtils.ts', 'stringLib.ts']
      }),
    reasoning: z.string().optional().openapi({
      description: 'Brief reasoning for the suggestions.',
      example: 'Suggestions focus on clarity and common naming conventions for utility files.'
    })
  })
  .openapi('FilenameSuggestionOutput')

const ProvidersListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    isCustom: z.boolean().optional(),
    baseUrl: z.string().optional()
  }))
}).openapi('ProvidersListResponse')

// Use the imported structuredDataSchemas from @promptliano/schemas
// which now includes all our asset generators

const getProvidersRoute = createRoute({
  method: 'get',
  path: '/api/providers',
  tags: ['AI'],
  summary: 'Get all available providers including custom ones',
  responses: createStandardResponses(ProvidersListResponseSchema)
})

const getModelsRoute = createRoute({
  method: 'get',
  path: '/api/models',
  tags: ['AI'],
  summary: 'List available AI models for a provider',
  request: {
    query: ModelsQuerySchema
  },
  responses: createStandardResponses(ModelsListResponseSchema)
})

const generateTextRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/text',
  tags: ['GenAI'],
  summary: 'Generate text using a specified model and prompt',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateTextRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(AiGenerateTextResponseSchema)
})

const generateStreamRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/stream',
  tags: ['GenAI'],
  summary: 'Generate text using a specified model and prompt',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateTextRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'text/event-stream': {
          // Standard content type for SSE/streaming text
          schema: z.string().openapi({ description: 'Stream of response tokens (Vercel AI SDK format)' })
        }
      },
      description: 'Successfully initiated AI response stream.'
    }
  }
})

const generateStructuredRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/structured',
  tags: ['GenAI'],
  summary: 'Generate structured data based on a predefined schema key and user input',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateStructuredRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(AiGenerateStructuredResponseSchema)
})

const postAiGenerateTextRoute = createRoute({
  method: 'post',
  path: '/api/ai/generate/text',
  tags: ['AI'],
  summary: 'Generate text (one-off, non-streaming)',
  description:
    'Generates text based on a prompt using the specified provider and model. Does not use chat history or save messages.',
  request: {
    body: {
      content: {
        'application/json': { schema: AiGenerateTextRequestSchema } // Use the NEW schema
      },
      required: true,
      description: 'Prompt, provider, model, and options for text generation.'
    }
  },
  responses: createStandardResponses(AiGenerateTextResponseSchema)
})

// Schema for updating provider settings
const UpdateProviderSettingsSchema = z
  .object({
    ollamaUrl: z.string().url().optional(),
    lmstudioUrl: z.string().url().optional()
  })
  .openapi('UpdateProviderSettings')

const updateProviderSettingsRoute = createRoute({
  method: 'post',
  path: '/api/provider-settings',
  tags: ['AI'],
  summary: 'Update provider settings',
  description: 'Updates custom URLs for local AI providers like Ollama and LMStudio',
  request: {
    body: {
      content: {
        'application/json': { schema: UpdateProviderSettingsSchema }
      },
      required: true,
      description: 'Provider settings to update'
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema.extend({
    data: UpdateProviderSettingsSchema
  }))
})

export const genAiRoutes = new OpenAPIHono()
  .openapi(getProvidersRoute, async (c) => {
    try {
      // Get predefined providers
      const predefinedProviders = [
        { id: 'openai', name: 'OpenAI', isCustom: false },
        { id: 'anthropic', name: 'Anthropic', isCustom: false },
        { id: 'google_gemini', name: 'Google Gemini', isCustom: false },
        { id: 'groq', name: 'Groq', isCustom: false },
        { id: 'together', name: 'Together', isCustom: false },
        { id: 'xai', name: 'XAI', isCustom: false },
        { id: 'openrouter', name: 'OpenRouter', isCustom: false },
        { id: 'lmstudio', name: 'LMStudio', isCustom: false },
        { id: 'ollama', name: 'Ollama', isCustom: false }
      ]
      
      // Get custom providers
      const customProviders = await providerKeyService.getCustomProviders()
      const formattedCustomProviders = customProviders.map(cp => ({
        id: cp.id,
        name: cp.name,
        isCustom: true,
        baseUrl: cp.baseUrl
      }))
      
      // Combine both lists
      const allProviders = [...predefinedProviders, ...formattedCustomProviders]
      
      return c.json(successResponse(allProviders))
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      throw new ApiError(500, 'Failed to fetch providers', 'PROVIDERS_FETCH_ERROR')
    }
  })
  .openapi(generateStreamRoute, async (c) => {
    const body = c.req.valid('json')
    const { prompt, options, systemMessage } = body

    const aiSDKStream = await genTextStream({
      prompt,
      ...(options && {
        options: options
      }),
      systemMessage
    })

    return stream(c, async (streamInstance) => {
      await streamInstance.pipe(aiSDKStream.toDataStream())
    })
  })
  .openapi(generateTextRoute, async (c) => {
    const body = c.req.valid('json')

    const generatedText = await generateSingleText({
      prompt: body.prompt,
      ...(body.options && {
        options: body.options
      }),
      systemMessage: body.systemMessage
    })

    return c.json(successResponse({ text: generatedText }))
  })
  .openapi(generateStructuredRoute, async (c) => {
    const body = c.req.valid('json')
    const { schemaKey, userInput, options } = body

    const config: StructuredDataSchemaConfig<z.ZodTypeAny> =
      structuredDataSchemas[schemaKey as keyof typeof structuredDataSchemas]
    if (!config) {
      throw new ApiError(
        400,
        `Invalid schemaKey provided: ${schemaKey}. Valid keys are: ${Object.keys(structuredDataSchemas).join(', ')}`,
        'INVALID_SCHEMA_KEY'
      )
    }

    const finalPrompt = config?.promptTemplate?.replace('{userInput}', userInput)
    const finalModel = options?.model ?? config?.modelSettings?.model ?? 'gpt-4o'
    const finalOptions = { ...config.modelSettings, ...options, model: finalModel }
    const finalSystemPrompt = config.systemPrompt

    const result = await generateStructuredData({
      prompt: finalPrompt ?? '',
      schema: config.schema,
      options: finalOptions,
      systemMessage: finalSystemPrompt
    })

    return c.json(successResponse({ output: result.object }))
  })
  .openapi(getModelsRoute, async (c) => {
    const { provider } = c.req.valid('query')

    // Check if this is a custom provider with format "custom_<keyId>"
    if (provider.startsWith('custom_')) {
      const keyId = parseInt(provider.replace('custom_', ''), 10)
      if (!isNaN(keyId)) {
        // Get the specific custom provider key
        const customKey = await providerKeyService.getKeyById(keyId)
        if (customKey && customKey.provider === 'custom' && customKey.baseUrl) {
          const modelFetcherService = new ModelFetcherService({})
          
          try {
            const models = await modelFetcherService.listCustomProviderModels({
              baseUrl: customKey.baseUrl,
              apiKey: customKey.key
            })
            
            const modelData = models.map((model) => ({
              id: model.id,
              name: model.name,
              provider
            }))
            
            return c.json(successResponse(modelData))
          } catch (error) {
            console.error(`Failed to fetch models for custom provider ${keyId}:`, error)
            return c.json(successResponse([]))
          }
        }
      }
    }

    // Handle standard providers
    const keys: ProviderKey[] = await providerKeyService.listKeysUncensored()
    const providerKeysConfig: ProviderKeysConfig = keys.reduce((acc, key) => {
      acc[`${key.provider}Key`] = key.key
      return acc
    }, {} as any)

    const modelFetcherService = new ModelFetcherService(providerKeysConfig)

    // Get custom URLs from query params if provided, otherwise use defaults
    const ollamaUrl = c.req.query('ollamaUrl') || OLLAMA_BASE_URL
    const lmstudioUrl = c.req.query('lmstudioUrl') || LMSTUDIO_BASE_URL

    // Update provider settings if custom URLs are provided
    if (c.req.query('ollamaUrl') || c.req.query('lmstudioUrl')) {
      const settings: any = {}
      if (c.req.query('ollamaUrl')) settings.ollamaUrl = ollamaUrl
      if (c.req.query('lmstudioUrl')) settings.lmstudioUrl = lmstudioUrl
      updateProviderSettings(settings)
    }

    const listOptions = { ollamaBaseUrl: ollamaUrl, lmstudioBaseUrl: lmstudioUrl }

    const models = await modelFetcherService.listModels(provider as APIProviders, listOptions)

    const modelData = models.map((model) => ({
      id: model.id,
      name: model.name,
      provider
    }))

    return c.json(successResponse(modelData))
  })
  .openapi(postAiGenerateTextRoute, async (c) => {
    const { prompt, options, systemMessage } = c.req.valid('json')

    console.log(`[Hono AI Generate] /ai/generate/text request: Provider=${options?.provider}, Model=${options?.model}`)

    const generatedText = await generateSingleText({
      prompt,
      ...(options && {
        options: options
      }),
      systemMessage
    })

    return c.json(successResponse({ text: generatedText }))
  })
  .openapi(updateProviderSettingsRoute, async (c) => {
    const body = c.req.valid('json')

    // Update the provider settings
    const updatedSettings = updateProviderSettings(body)

    // Also update the settings when models are fetched with custom URLs
    if (body.ollamaUrl || body.lmstudioUrl) {
      console.log('[GenAI Routes] Provider settings updated:', body)
    }

    return c.json(successResponse(updatedSettings))
  })
