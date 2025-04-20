import app from "@/server-router";
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createChatService } from '@/services/model-providers/chat/chat-service';
import { AI_API_PROVIDERS, ApiError, apiProviders, APIProviders } from 'shared';
import { unifiedProvider } from '@/services/model-providers/providers/unified-provider-service';
import { streamSSE, SSEStreamingApi } from 'hono/streaming';
import { chatApiValidation } from "shared/src/validation/chat-api-validation";
import { ModelFetcherService, ProviderKeysConfig } from '@/services/model-providers/providers/model-fetcher-service';
import { providerKeyService } from '@/services/model-providers/providers/provider-key-service';
import { ProviderKey } from 'shared/schema';
import { OLLAMA_BASE_URL, LMSTUDIO_BASE_URL } from "@/services/model-providers/providers/provider-defaults";

const chatService = createChatService();

// Helper function to handle errors with appropriate status codes
function handleError(error: unknown) {
    console.error('API Error:', error);

    // Handle ApiError instances with their specific status codes
    if (error instanceof ApiError) {
        return {
            success: false,
            error: error.message,
            code: error.code
        };
    }

    // Handle "not found" errors
    if (error instanceof Error &&
        (error.message.includes('not found') ||
            error.message.toLowerCase().includes('cannot find') ||
            error.message.toLowerCase().includes('does not exist'))) {
        return {
            success: false,
            error: error.message,
            code: 'NOT_FOUND'
        };
    }

    // Specific handling for API key errors from ModelFetcherService
    if (error instanceof Error && error.message.includes('API key not found')) {
        return {
            success: false,
            error: error.message,
            code: 'MISSING_API_KEY' // Or another appropriate code
        };
    }

    // Default error response
    return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        code: 'INTERNAL_ERROR'
    };
}

// Process a chat message (streaming)
app.post('/api/chat',
    zValidator('json', chatApiValidation.create.body),
    async (c) => {
        try {
            const body = await c.req.valid('json');

            const stream = await unifiedProvider.processMessage({
                chatId: body.chatId,
                userMessage: body.message,
                provider: body.provider,
                options: body.options as any,
                tempId: body.tempId,
            });

            const headers = {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Provider': body.provider
            };

            return c.body(stream, { headers });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Create a new chat
app.post('/api/chats',
    zValidator('json', chatApiValidation.createChat.body),
    async (c) => {
        try {
            const body = await c.req.valid('json');
            const chat = await chatService.createChat(body.title, {
                copyExisting: body.copyExisting,
                currentChatId: body.currentChatId
            });
            return c.json({ data: chat });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Get all chats
app.get('/api/chats', async (c) => {
    try {
        const userChats = await chatService.getAllChats();
        return c.json(userChats);
    } catch (error) {
        const errorResponse = handleError(error);
        return c.json(errorResponse, 500 as any);
    }
});

// Get chat messages by chat ID
app.get('/api/chats/:chatId/messages',
    zValidator('param', z.object({
        chatId: z.string()
    })),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const messages = await chatService.getChatMessages(chatId);
            return c.json({ data: messages });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Fork a chat
app.post('/api/chats/:chatId/fork',
    zValidator('param', chatApiValidation.forkChat.params),
    zValidator('json', chatApiValidation.forkChat.body),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const { excludedMessageIds } = await c.req.valid('json');
            const newChat = await chatService.forkChat(chatId, excludedMessageIds);
            return c.json({ data: newChat });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Fork chat from a specific message
app.post('/api/chats/:chatId/fork/:messageId',
    zValidator('param', chatApiValidation.forkChatFromMessage.params),
    zValidator('json', chatApiValidation.forkChatFromMessage.body),
    async (c) => {
        try {
            const { chatId, messageId } = c.req.valid('param');
            const { excludedMessageIds } = await c.req.valid('json');
            const newChat = await chatService.forkChatFromMessage(
                chatId,
                messageId,
                excludedMessageIds
            );
            return c.json({ data: newChat });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Update a chat
app.patch('/api/chats/:chatId',
    zValidator('param', chatApiValidation.updateChat.params),
    zValidator('json', chatApiValidation.updateChat.body),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const { title } = await c.req.valid('json');
            const updatedChat = await chatService.updateChat(chatId, title);
            return c.json({ data: updatedChat });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Delete a chat
app.delete('/api/chats/:chatId',
    zValidator('param', chatApiValidation.deleteChat.params),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            await chatService.deleteChat(chatId);
            return c.json({ success: true });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Delete a message
app.delete('/api/messages/:messageId',
    zValidator('param', chatApiValidation.deleteMessage.params),
    async (c) => {
        try {
            const { messageId } = c.req.valid('param');
            await chatService.deleteMessage(messageId);
            return c.json({ success: true });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Get models for a provider
const modelsQuerySchema = z.object({
    provider: z.string().refine(val => apiProviders.includes(val as APIProviders), {
        message: "Invalid provider specified"
    })
});

app.get('/api/models',
    zValidator('query', modelsQuerySchema),
    async (c) => {
        try {
            const { provider } = c.req.valid('query');

            // 1. Fetch all API keys from the database
            const keys: ProviderKey[] = await providerKeyService.listKeys();

            // 2. Transform keys into the ProviderKeysConfig format needed by ModelFetcherService
            const providerKeysConfig: ProviderKeysConfig = keys.reduce((acc, key) => {
                switch (key.provider) {
                    case 'openai': acc.openaiKey = key.key; break;
                    case 'anthropic': acc.anthropicKey = key.key; break;
                    case 'google_gemini': acc.googleGeminiKey = key.key; break;
                    case 'groq': acc.groqKey = key.key; break;
                    case 'together': acc.togetherKey = key.key; break;
                    case 'xai': acc.xaiKey = key.key; break;
                    case 'openrouter': acc.openRouterKey = key.key; break;
                    // Add other mappings if your ProviderKeysConfig interface includes more keys
                }
                return acc;
            }, {} as ProviderKeysConfig);

            // 3. Instantiate the ModelFetcherService with the fetched keys
            const modelFetcherService = new ModelFetcherService(providerKeysConfig);

            // 4. Define options (e.g., base URLs for local providers)
            const listOptions = {
                ollamaBaseUrl: OLLAMA_BASE_URL, // Use default or get from config
                lmstudioBaseUrl: LMSTUDIO_BASE_URL // Use default or get from config
            };

            // 5. Call the listModels method
            const models = await modelFetcherService.listModels(provider as APIProviders, listOptions);

            // 6. Return the list of models
            return c.json({ success: true, data: models });

        } catch (error) {
            const errorResponse = handleError(error);
            let statusCode = 500;
            if (errorResponse.code === 'NOT_FOUND') statusCode = 404;
            if (errorResponse.code === 'BAD_REQUEST' || error instanceof z.ZodError) statusCode = 400;
            if (errorResponse.code === 'MISSING_API_KEY') statusCode = 400; // Or 401/403 depending on policy

            // If Zod validation failed on query param
            if (error instanceof z.ZodError) {
                return c.json({
                    success: false,
                    error: "Invalid 'provider' query parameter.",
                    details: error.errors,
                    code: 'VALIDATION_ERROR'
                }, 400);
            }

            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Schema for individual messages (aligns with Vercel AI SDK CoreMessage)
const messageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool', 'function', 'data']),
    content: z.string(),
    id: z.string().optional(),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
});

// Schema for AI SDK Options
const aiSdkOptionsSchema = z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    topK: z.number().int().positive().optional(),
    response_format: z.any().optional(),
    structuredOutputMode: z.enum(['auto', 'tool', 'json']).optional(),
    schemaName: z.string().optional(),
    schemaDescription: z.string().optional(),
    outputStrategy: z.enum(['object', 'array', 'enum', 'no-schema']).optional(),
}).partial().optional();

// Main Request Schema for /api/ai/chat
const chatRequestSchema = z.object({
    messages: z.array(messageSchema).min(1, { message: "Conversation must have at least one message." }),
    chatId: z.string({ required_error: "chatId is required in the request body." })
        .uuid({ message: "chatId must be a valid UUID." }),
    provider: z.enum(AI_API_PROVIDERS).or(z.string()).optional(),
    options: aiSdkOptionsSchema,
    tempId: z.string().optional(),
    systemMessage: z.string().optional(),
    schema: z.any().optional(),
    enumValues: z.array(z.string()).optional(),
});

// Export the inferred TypeScript type for convenience
export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

// Endpoint Implementation
app.post('/api/ai/chat', zValidator('json', chatRequestSchema), async (c) => {
    const body = c.req.valid('json');
    const {
        chatId,
        provider = 'openai',
        options,
        tempId,
        systemMessage,
        messages: frontendMessages,
        schema,
        enumValues,
    } = body;

    const userMessageContent = frontendMessages[frontendMessages.length - 1]?.content;
    if (!userMessageContent) {
        console.error(`[Hono Route] /api/ai/chat Error: No user message content found in request for chatId ${chatId}`);
        return c.json({ success: false, error: 'No user message content found.' }, 400);
    }

    try {
        console.log(`[Hono Route] /api/ai/chat received for chatId: ${chatId}`);
        const streamResult = await unifiedProvider.processMessage({
            chatId,
            userMessage: userMessageContent,
            provider: provider as APIProviders,
            options: options ?? {},
            tempId,
            systemMessage,
            schema,
            enum: enumValues,
        });

        c.header('Content-Type', 'text/plain; charset=utf-8');
        c.header('X-Vercel-AI-Data-Stream', 'v1');

        console.log(`[Hono Route] Returning stream for chatId: ${chatId}`);
        return streamSSE(c, async (streamWriter: SSEStreamingApi) => {
            await streamWriter.pipe(streamResult);
        });

    } catch (error: any) {
        console.error(`[Hono Route] /api/ai/chat Error for chatId ${chatId}:`, error);
        const errorResponse = handleError(error); // Use unified error handler
        const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
            (errorResponse.code === 'BAD_REQUEST' ? 400 :
                (errorResponse.code === 'MISSING_API_KEY' ? 400 : 500)); // Adjust status for key errors if needed
        return c.json(errorResponse, statusCode as any);
    }
});

// Export the app if it's in a separate file
// export default app;
// Or ensure this route is registered with your main Hono app instance.
