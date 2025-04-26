import { createRoute, z } from '@hono/zod-openapi';

// *** UPDATED IMPORT ***
import { createChatService } from '@/services/chat-service'; // Keep if needed for other routes potentially
import { ApiError, LOW_MODEL_CONFIG, MEDIUM_MODEL_CONFIG, } from 'shared';
import {
    ApiErrorResponseSchema,
    OperationSuccessResponseSchema
} from 'shared/src/schemas/common.schemas';
// Import chat-specific schemas if needed for other routes in this file (e.g. original /chats)
import {
    ModelsQuerySchema,
} from "shared/src/schemas/chat.schemas";
// Import the NEW GenAI schemas
import {
    AiGenerateTextRequestSchema,
    AiGenerateTextResponseSchema,
    AiGenerateStructuredRequestSchema,
    AiGenerateStructuredResponseSchema,
    StructuredDataSchemaConfig,
    ModelsListResponseSchema,
    BaseStructuredDataConfigSchema,
    structuredDataSchemas
} from "shared/src/schemas/gen-ai.schemas";


import { OpenAPIHono } from '@hono/zod-openapi';
import { aiProviderInterface, generateStructuredData } from '@/services/model-providers/providers/ai-provider-interface-services'; // Import the service instance
import { APIProviders, ProviderKey } from 'shared/src/schemas/provider-key.schemas';
import { ProviderKeysConfig, ModelFetcherService } from '@/services/model-providers/providers/model-fetcher-service';
import { OLLAMA_BASE_URL, LMSTUDIO_BASE_URL } from '@/services/model-providers/providers/provider-defaults';
import { providerKeyService } from '@/services/model-providers/providers/provider-key-service';
import { getFullProjectSummary } from '@/utils/get-full-project-summary';
import { TypedResponse } from 'hono';
import { ProjectIdParamsSchema, SuggestFilesBodySchema, SuggestFilesResponseSchema, FileSuggestionsZodSchema, FileSuggestionsJsonSchema } from 'shared/src/schemas/project.schemas';



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

const suggestFilesRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/suggest-files',
    tags: ['Projects', 'Files', 'AI'],
    summary: 'Suggest relevant files based on user input and project context',
    request: {
        params: ProjectIdParamsSchema,
        body: { content: { 'application/json': { schema: SuggestFilesBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: SuggestFilesResponseSchema } }, description: 'Successfully suggested files' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error or AI processing error' },
    },
});

export const genAiRoutes = new OpenAPIHono()

    // --- NEW: Simple Text Generation Handler ---
    .openapi(generateTextRoute, async (c) => {
        const body = c.req.valid('json');

        try {
            const generatedText = await aiProviderInterface.generateSingleText({
                prompt: body.prompt,
                provider: body.provider as APIProviders, // Cast might be needed if schema allows any string
                model: body.model,
                options: body.options,
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
        const { schemaKey, userInput,
        } = body;

        // 1. Find the configuration for the requested schemaKey
        const config: StructuredDataSchemaConfig<z.ZodTypeAny> = structuredDataSchemas[schemaKey as keyof typeof structuredDataSchemas]
        if (!config) {
            throw new ApiError(400, `Invalid schemaKey provided: ${schemaKey}. Valid keys are: ${Object.keys(structuredDataSchemas).join(', ')}`, 'INVALID_SCHEMA_KEY');
        }

        // 2. Prepare parameters for the AI service
        const finalPrompt = config?.promptTemplate ? config?.promptTemplate.replace('{userInput}', userInput) : userInput;

        const finalSystemPrompt = config.systemPrompt;

        try {
            const result = await generateStructuredData({
                prompt: finalPrompt,
                schema: config.schema,
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
            provider,
            model,
            options,
            systemMessage
        } = c.req.valid('json');

        console.log(`[Hono AI Generate] /ai/generate/text request: Provider=${provider}, Model=${model}`);

        try {
            // Combine model and other options
            const unifiedOptions = { ...options, model };

            // Call the unified provider's non-streaming text generation function
            const generatedText = await aiProviderInterface.generateSingleText({
                prompt,
                provider: provider as APIProviders,
                options: unifiedOptions,
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
    .openapi(suggestFilesRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const { userInput } = c.req.valid('json');

        const projectSummary = await getFullProjectSummary(projectId);
        const systemPrompt = `
        You are a code assistant that recommends relevant files based on user input.
You have a list of file summaries and a user request.
Return only valid JSON with the shape: {"fileIds": ["uuid1", "uuid2"]}
Guidelines:
- For simple tasks: return max 5 files
- For complex tasks: return max 10 files
- For very complex tasks: return max 20 files
- Do not add comments in your response
- Strictly follow the JSON schema, do not add any additional properties or comments
        `

        const userMessage = `
User Query: ${userInput}
Below is a combined summary of project files:
${projectSummary}`;

        try {

            const result = await generateStructuredData({
                prompt: userMessage,
                schema: FileSuggestionsZodSchema,
                systemMessage: systemPrompt,
            })

            const payload = {
                success: true,
                recommendedFileIds: result.object.fileIds,
            } satisfies z.infer<typeof SuggestFilesResponseSchema>;

            return c.json(payload, 200);
        } catch (error: any) {
            console.error("[SuggestFiles Project] Error:", error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, `Failed to suggest files: ${error.message}`, "AI_SUGGESTION_ERROR");
        }
    })