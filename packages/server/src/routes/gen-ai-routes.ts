import { createRoute, z } from '@hono/zod-openapi';

import { ApiError, } from 'shared';
import {
    ApiErrorResponseSchema,
    OperationSuccessResponseSchema
} from 'shared/src/schemas/common.schemas';
import {
    ModelsQuerySchema,
} from "shared/src/schemas/chat.schemas";
import {
    AiGenerateTextRequestSchema,
    AiGenerateTextResponseSchema,
    AiGenerateStructuredRequestSchema,
    AiGenerateStructuredResponseSchema,
    StructuredDataSchemaConfig,
    ModelsListResponseSchema,
    FileSummaryListResponseSchema,
    RemoveSummariesResponseSchema,
    SummarizeFilesResponseSchema,
    SuggestFilesResponseSchema,
    FileSuggestionsZodSchema,
} from "shared/src/schemas/gen-ai.schemas";

import { OpenAPIHono } from '@hono/zod-openapi';
import { generateSingleText, generateStructuredData, genTextStream } from '@/services/gen-ai-services'; // Import the service instance
import { APIProviders, ProviderKey } from 'shared/src/schemas/provider-key.schemas';
import { ProviderKeysConfig, ModelFetcherService } from '@/services/model-providers/model-fetcher-service';
import { OLLAMA_BASE_URL, LMSTUDIO_BASE_URL } from '@/services/model-providers/provider-defaults';
import { providerKeyService } from '@/services/model-providers/provider-key-service';
import { stream } from 'hono/streaming';



// Define the Zod schema for filename suggestions
const FilenameSuggestionSchema = z.object({
    suggestions: z.array(z.string()).length(5).openapi({
        description: "An array of exactly 5 suggested filenames.",
        example: ["stringUtils.ts", "textHelpers.ts", "stringManipulators.ts", "strUtils.ts", "stringLib.ts"]
    }),
    reasoning: z.string().optional().openapi({
        description: "Brief reasoning for the suggestions.",
        example: "Suggestions focus on clarity and common naming conventions for utility files."
    })
}).openapi("FilenameSuggestionOutput");

// Define other schemas as needed...
// const CodeReviewSchema = z.object({ ... });

// Central object mapping keys to structured task configurations
// Place this here or in a separate config file (e.g., gen-ai-config.ts) and import it
const structuredDataSchemas: Record<string, StructuredDataSchemaConfig<any>> = {
    filenameSuggestion: {
        // These fields match BaseStructuredDataConfigSchema
        name: "Filename Suggestion",
        description: "Suggests 5 suitable filenames based on a description of the file's content.",
        promptTemplate: "Based on the following file description, suggest 5 suitable and conventional filenames. File Description: {userInput}",
        systemPrompt: "You are an expert programmer specializing in clear code organization and naming conventions. Provide concise filename suggestions.",
        modelSettings: {
            model: "gpt-4o",
            temperature: 0.5,
        },
        // This field is part of the interface, but not the base Zod schema
        schema: FilenameSuggestionSchema, // The actual Zod schema instance
    },
    // Example of another entry
    basicSummary: {
        name: "Basic Summary",
        description: "Generates a short summary of the input text.",
        promptTemplate: "Summarize the following text concisely: {userInput}",
        systemPrompt: "You are a summarization expert.",
        modelSettings: { model: "gpt-4o", temperature: 0.6, maxTokens: 150 },
        schema: z.object({ // Define the schema directly here
            summary: z.string().openapi({ description: "The generated summary." })
        }).openapi("BasicSummaryOutput")
    }
    // Add more structured tasks here...
};


// GET /models
const getModelsRoute = createRoute({
    method: 'get',
    path: '/models',
    tags: ['AI'],
    summary: 'List available AI models for a provider',
    request: {
        query: ModelsQuerySchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: ModelsListResponseSchema } },
            description: 'Successfully retrieved model list',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Invalid provider or configuration error',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    }
});


// --- Original Chat Routes (/chats) ---


// --- NEW GenAI Routes ---

// POST /api/gen-ai/text (Simple Text Generation)
const generateTextRoute = createRoute({
    method: 'post',
    path: '/api/gen-ai/text',
    tags: ['GenAI'],
    summary: 'Generate text using a specified model and prompt',
    request: {
        body: {
            content: { 'application/json': { schema: AiGenerateTextRequestSchema } },
            required: true,
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: AiGenerateTextResponseSchema } },
            description: 'Successfully generated text',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error (invalid input)',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error or AI Provider Error',
        },
    },
});

// POST /api/gen-ai/stream (Streaming Text Generation)
const generateStreamRoute = createRoute({
    method: 'post',
    path: '/api/gen-ai/stream',
    tags: ['GenAI'],
    summary: 'Generate text using a specified model and prompt',
    request: {
        body: {
            content: { 'application/json': { schema: AiGenerateTextRequestSchema } },
            required: true,
        },
    },
    responses: {
        200: {
            content: {
                'text/event-stream': { // Standard content type for SSE/streaming text
                    schema: z.string().openapi({ description: "Stream of response tokens (Vercel AI SDK format)" })
                }
            },
            description: 'Successfully initiated AI response stream.',
        },

    },
});


// POST /api/gen-ai/structured (Structured Data Generation)
const generateStructuredRoute = createRoute({
    method: 'post',
    path: '/api/gen-ai/structured',
    tags: ['GenAI'],
    summary: 'Generate structured data based on a predefined schema key and user input',
    request: {
        body: {
            content: { 'application/json': { schema: AiGenerateStructuredRequestSchema } },
            required: true,
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: AiGenerateStructuredResponseSchema } }, // Uses the generic response schema
            description: 'Successfully generated structured data',
        },
        400: { // Bad Request for invalid schemaKey
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Bad Request: Invalid or unknown schemaKey provided.',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error (invalid input)',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error or AI Provider Error',
        },
    },
});

// --- NEW: Definition for POST /ai/generate/text (One-off Text Generation) ---
const postAiGenerateTextRoute = createRoute({
    method: 'post',
    path: '/ai/generate/text',
    tags: ['AI'],
    summary: 'Generate text (one-off, non-streaming)',
    description: 'Generates text based on a prompt using the specified provider and model. Does not use chat history or save messages.',
    request: {
        body: {
            content: {
                'application/json': { schema: AiGenerateTextRequestSchema } // Use the NEW schema
            },
            required: true,
            description: 'Prompt, provider, model, and options for text generation.',
        },
    },
    responses: {
        200: {
            content: {
                'application/json': { schema: AiGenerateTextResponseSchema } // Use the NEW response schema
            },
            description: 'Successfully generated text response.',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error (invalid request body)',
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Bad Request (e.g., missing API key, invalid provider/model)',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error or AI provider communication error',
        },
    },
});

export const genAiRoutes = new OpenAPIHono()
    .openapi(generateStreamRoute, async (c) => {
        const body = c.req.valid('json');
        const { prompt, options, systemMessage } = body;

        try {
            const aiSDKStream = await genTextStream({
                prompt,
                ...(options && {
                    options: options
                }),
                systemMessage,
            });

            return stream(c, async (stream) => {
                await stream.pipe(aiSDKStream.toDataStream());
            });
        } catch (error: any) {
            console.error("[GenAI Route Error - /stream]:", error);
            throw new ApiError(500, `Failed to generate text: ${error.message}`, 'TEXT_GENERATION_FAILED');
        }
    })
    // --- NEW: Simple Text Generation Handler ---
    .openapi(generateTextRoute, async (c) => {
        const body = c.req.valid('json');

        try {
            const generatedText = await generateSingleText({
                prompt: body.prompt,
                ...(body.options && {
                    options: body.options
                }),
                systemMessage: body.systemMessage,
                // debug: true // Optionally enable debug logging
            });

            // Structure matches AiGenerateTextResponseSchema
            return c.json({
                success: true,
                data: { text: generatedText }
            } satisfies z.infer<typeof AiGenerateTextResponseSchema>, 200);

        } catch (error: any) {
            console.error("[GenAI Route Error - /text]:", error);
            // Throw a structured error for the global handler
            throw new ApiError(500, `Failed to generate text: ${error.message}`, 'TEXT_GENERATION_FAILED');
        }
    })

    // --- NEW: Structured Data Generation Handler ---
    .openapi(generateStructuredRoute, async (c) => {
        const body = c.req.valid('json');
        const { schemaKey, userInput, options } = body;
        // 1. Find the configuration for the requested schemaKey
        const config: StructuredDataSchemaConfig<z.ZodTypeAny> = structuredDataSchemas[schemaKey as keyof typeof structuredDataSchemas]
        if (!config) {
            throw new ApiError(400, `Invalid schemaKey provided: ${schemaKey}. Valid keys are: ${Object.keys(structuredDataSchemas).join(', ')}`, 'INVALID_SCHEMA_KEY');
        }

        // 2. Prepare parameters for the AI service
        const finalPrompt = config?.promptTemplate?.replace('{userInput}', userInput);
        const finalModel = options?.model ?? config?.modelSettings?.model ?? 'gpt-4o'; // Define default model logic
        const finalOptions = { ...config.modelSettings, ...options, model: finalModel }; // Merge options, override wins
        const finalSystemPrompt = config.systemPrompt;

        try {
            const result = await generateStructuredData({
                prompt: finalPrompt ?? '',
                schema: config.schema, // Pass the Zod schema from config
                options: finalOptions,
                systemMessage: finalSystemPrompt,
            });

            // 3. Return the generated object
            // Structure matches AiGenerateStructuredResponseSchema
            return c.json({
                success: true,
                data: { output: result.object } // Extract the 'object' part from the service response
            } satisfies z.infer<typeof AiGenerateStructuredResponseSchema>, 200);

        } catch (error: any) {
            console.error(`[GenAI Route Error - /structured - ${schemaKey}]:`, error);
            // More specific error reporting
            const message = error.response?.data?.error?.message || error.message || String(error);
            throw new ApiError(500, `Failed to generate structured data for '${config.name}': ${message}`, 'STRUCTURED_GENERATION_FAILED');
        }
    })
    .openapi(getModelsRoute, async (c) => {
        const { provider } = c.req.valid('query');

        try {
            const keys: ProviderKey[] = await providerKeyService.listKeys();
            const providerKeysConfig: ProviderKeysConfig = keys.reduce((acc, key) => {
                acc[`${key.provider}Key`] = key.key;
                return acc;
            }, {} as any);

            const modelFetcherService = new ModelFetcherService(providerKeysConfig);
            const listOptions = { ollamaBaseUrl: OLLAMA_BASE_URL, lmstudioBaseUrl: LMSTUDIO_BASE_URL };
            const models = await modelFetcherService.listModels(provider as APIProviders, listOptions);

            // Create properly typed model data for response
            const modelData = models.map(model => ({
                id: model.id,
                name: model.name,
                provider, // Add the provider from the query parameter
                // context_length: model.context_length
            }));

            return c.json({
                success: true,
                data: modelData
            } satisfies z.infer<typeof ModelsListResponseSchema>, 200);
        } catch (error: any) {
            console.error(`[GET /models?provider=${provider}] Error:`, error);
            const isApiKeyError = error.message?.includes('API key not found');

            if (isApiKeyError) {
                throw new ApiError(400, error.message || 'API key not found', 'MISSING_API_KEY');
            } else {
                throw new ApiError(500, error.message || 'Error fetching models', 'PROVIDER_ERROR');
            }
        }
    })
    .openapi(postAiGenerateTextRoute, async (c) => {
        const {
            prompt,
            options,
            systemMessage
        } = c.req.valid('json');

        console.log(`[Hono AI Generate] /ai/generate/text request: Provider=${options?.provider}, Model=${options?.model}`);

        try {
            // Combine model and other options

            // Call the unified provider's non-streaming text generation function
            const generatedText = await generateSingleText({
                prompt,
                ...(options && {
                    options: options
                }),
                systemMessage,
                // messages: undefined, // Not passing history for this simple route
            });

            // Return the result in the defined JSON structure
            const responsePayload: z.infer<typeof AiGenerateTextResponseSchema> = {
                success: true,
                data: { text: generatedText }
            };
            return c.json(responsePayload, 200);

        } catch (error: any) {
            console.error(`[Hono AI Generate] /ai/generate/text Error:`, error);
            if (error instanceof ApiError) throw error;
            if (error.message?.toLowerCase().includes('api key')) {
                throw new ApiError(400, error.message, 'MISSING_API_KEY');
            }
            // Add more specific error handling if needed (e.g., model not found by provider)
            throw new ApiError(500, error.message || 'Error generating AI text response');
        }
    })
