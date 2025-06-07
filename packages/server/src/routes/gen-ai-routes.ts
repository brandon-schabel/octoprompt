import { createRoute, z } from '@hono/zod-openapi'

import { ApiError } from '@octoprompt/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@octoprompt/schemas'
import { ModelsQuerySchema } from '@octoprompt/schemas'
import {
  AiGenerateTextRequestSchema,
  AiGenerateTextResponseSchema,
  AiGenerateStructuredRequestSchema,
  AiGenerateStructuredResponseSchema,
  StructuredDataSchemaConfig,
  ModelsListResponseSchema
} from '@octoprompt/schemas'

import { OpenAPIHono } from '@hono/zod-openapi'
import { generateSingleText, generateStructuredData, genTextStream, providerKeyService } from '@octoprompt/services' // Import the service instance
import { APIProviders, ProviderKey } from '@octoprompt/schemas'
import { ProviderKeysConfig, ModelFetcherService } from '@octoprompt/services/src/model-providers/model-fetcher-service'
import { OLLAMA_BASE_URL, LMSTUDIO_BASE_URL } from '@octoprompt/services/src/model-providers/provider-defaults'
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

// Central object mapping keys to structured task configurations
// Place this here or in a separate config file (e.g., gen-ai-config.ts) and import it
const structuredDataSchemas: Record<string, StructuredDataSchemaConfig<any>> = {
  filenameSuggestion: {
    name: 'Filename Suggestion',
    description: "Suggests 5 suitable filenames based on a description of the file's content.",
    promptTemplate:
      'Based on the following file description, suggest 5 suitable and conventional filenames. File Description: {userInput}',
    systemPrompt:
      'You are an expert programmer specializing in clear code organization and naming conventions. Provide concise filename suggestions.',
    modelSettings: {
      model: 'gpt-4o',
      temperature: 0.5
    },
    schema: FilenameSuggestionSchema
  },
  basicSummary: {
    name: 'Basic Summary',
    description: 'Generates a short summary of the input text.',
    promptTemplate: 'Summarize the following text concisely: {userInput}',
    systemPrompt: 'You are a summarization expert.',
    modelSettings: { model: 'gpt-4o', temperature: 0.6, maxTokens: 150 },
    schema: z
      .object({
        summary: z.string().openapi({ description: 'The generated summary.' })
      })
      .openapi('BasicSummaryOutput')
  }
}

const getModelsRoute = createRoute({
  method: 'get',
  path: '/api/models',
  tags: ['AI'],
  summary: 'List available AI models for a provider',
  request: {
    query: ModelsQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ModelsListResponseSchema } },
      description: 'Successfully retrieved model list'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation error'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid provider or configuration error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: AiGenerateTextResponseSchema } },
      description: 'Successfully generated text'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error (invalid input)'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error or AI Provider Error'
    }
  }
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
  responses: {
    200: {
      content: { 'application/json': { schema: AiGenerateStructuredResponseSchema } }, // Uses the generic response schema
      description: 'Successfully generated structured data'
    },
    400: {
      // Bad Request for invalid schemaKey
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request: Invalid or unknown schemaKey provided.'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error (invalid input)'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error or AI Provider Error'
    }
  }
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
  responses: {
    200: {
      content: {
        'application/json': { schema: AiGenerateTextResponseSchema } // Use the NEW response schema
      },
      description: 'Successfully generated text response.'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation error (invalid request body)'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request (e.g., missing API key, invalid provider/model)'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error or AI provider communication error'
    }
  }
})

export const genAiRoutes = new OpenAPIHono()
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

    return c.json(
      {
        success: true,
        data: { text: generatedText }
      } satisfies z.infer<typeof AiGenerateTextResponseSchema>,
      200
    )
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

    return c.json(
      {
        success: true,
        data: { output: result.object }
      } satisfies z.infer<typeof AiGenerateStructuredResponseSchema>,
      200
    )
  })
  .openapi(getModelsRoute, async (c) => {
    const { provider } = c.req.valid('query')

    const keys: ProviderKey[] = await providerKeyService.listKeysUncensored()
    const providerKeysConfig: ProviderKeysConfig = keys.reduce((acc, key) => {
      acc[`${key.provider}Key`] = key.key
      return acc
    }, {} as any)

    const modelFetcherService = new ModelFetcherService(providerKeysConfig)
    const listOptions = { ollamaBaseUrl: OLLAMA_BASE_URL, lmstudioBaseUrl: LMSTUDIO_BASE_URL }

    const models = await modelFetcherService.listModels(provider as APIProviders, listOptions)

    const modelData = models.map((model) => ({
      id: model.id,
      name: model.name,
      provider
    }))

    return c.json(
      {
        success: true,
        data: modelData
      } satisfies z.infer<typeof ModelsListResponseSchema>,
      200
    )
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

    const responsePayload: z.infer<typeof AiGenerateTextResponseSchema> = {
      success: true,
      data: { text: generatedText }
    }
    return c.json(responsePayload, 200)
  })
