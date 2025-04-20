import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@/utils/database';
import { createChatService } from '@/services/model-providers/chat/chat-service';
import { AI_API_PROVIDERS, ApiError, APIProviders } from 'shared';
import { unifiedProvider } from '@/services/model-providers/providers/unified-provider-service';
import { streamSSE, SSEStreamingApi } from 'hono/streaming';

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
        return c.json({ data: userChats });
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
const modelsValidator = z.object({
    provider: z.string().refine(val => apiProviders.includes(val as any), {
        message: "Invalid provider"
    })
});

// Fork chat from a specific message
app.post('/api/chats/:chatId/fork-from-message/:messageId',
    zValidator('param', z.object({
        chatId: z.string(),
        messageId: z.string()
    })),
    zValidator('json', z.object({
        excludedMessageIds: z.array(z.string()).optional()
    })),
    async (c) => {
        try {
            const { chatId, messageId } = c.req.valid('param');
            const { excludedMessageIds = [] } = await c.req.valid('json');
            const forkedChat = await chatService.forkChatFromMessage(chatId, messageId, excludedMessageIds);
            return c.json({ success: true, chat: forkedChat });
        } catch (error) {
            console.error(`Failed to fork chat ${c.req.param('chatId')} from message ${c.req.param('messageId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Schema for individual messages (aligns with Vercel AI SDK CoreMessage)
const messageSchema = z.object({
    // Required fields by Vercel AI SDK core
    role: z.enum([
        'system',
        'user',
        'assistant',
        'tool',     // For tool usage
        'function', // Legacy/Compatibility for function calls
        'data'      // For custom data payloads (often with Data Stream)
    ]),
    content: z.string(),

    // Optional fields potentially included by useChat or needed for processing
    id: z.string().optional(),           // Added by useChat hook
    name: z.string().optional(),         // Often used with role: 'tool'
    tool_call_id: z.string().optional(), // Used with role: 'tool' for results
    // Add other optional CoreMessage fields if your frontend sends them
    // (requires `sendExtraMessageFields: true` in useChat or specific SDK features)
    // data: z.record(z.unknown()).optional(), // Example for arbitrary data
    // annotations: z.array(z.any()).optional(), // Example for annotations
});

// Schema for AI SDK Options (based on your unified-provider-types.ts)
const aiSdkOptionsSchema = z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(), // Added typical constraints
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    topK: z.number().int().positive().optional(),

    // For OpenRouter structured outputs (keep if used)
    response_format: z.any().optional(), // Define more strictly if needed

    // For AI SDK structured outputs (keep if used)
    structuredOutputMode: z.enum(['auto', 'tool', 'json']).optional(),
    schemaName: z.string().optional(),
    schemaDescription: z.string().optional(),
    outputStrategy: z.enum(['object', 'array', 'enum', 'no-schema']).optional(),
})
    .partial() // Makes all fields within the object optional
    .optional(); // Makes the entire 'options' object optional


const chatRequestSchema = z.object({
    // --- Primary field from useChat hook ---
    // This array contains the entire conversation history + the latest user message
    messages: z.array(messageSchema)
        .min(1, { message: "Conversation must have at least one message." }),

    // --- Fields expected to be passed via `body` option in useChat ---
    chatId: z.string({ required_error: "chatId is required in the request body." })
        .uuid({ message: "chatId must be a valid UUID." }), // Or adjust if using different ID format

    // Optional provider selection (defaults handled in backend)
    provider: z.enum(AI_API_PROVIDERS) // Use z.enum(['openai', ...]) if it's a union type
        .or(z.string()) // Allow plain string if enum not available/strict
        .optional(),

    // Optional AI model parameters
    options: aiSdkOptionsSchema,

    // Optional temporary ID for optimistic UI updates
    tempId: z.string().optional(),

    // Optional system message override (though usually better added to `messages` array)
    systemMessage: z.string().optional(),

    // --- Optional fields for advanced use cases (like structured output) ---
    // Pass schema definition or identifier if generating structured output via streamObject
    schema: z.any().optional(), // Consider a more specific type if passing schema definitions

    // Pass enum values if using the 'enum' output strategy with streamObject/generateObject
    enumValues: z.array(z.string()).optional(),
});

// --- Export ---

// If using the factory pattern (as filename suggests):
export function createMessageBodySchema() {
    // Potentially add logic here if the schema needs to vary dynamically,
    // otherwise, just return the static schema.
    return chatRequestSchema;
}

// Export the inferred TypeScript type for convenience
export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

const ChatRequestSchema = createMessageBodySchema(); // Use the factory


app.post('/api/ai/chat', zValidator('json', ChatRequestSchema), async (c) => {
    const body = c.req.valid('json');

    // Extract necessary parameters for unifiedProvider.processMessage
    const {
        chatId,
        provider = 'openai', // Default or determine from body/config
        options,
        tempId,
        systemMessage,
        messages: frontendMessages, // Get the message history from the request
        schema,
        enumValues, // Renamed from 'enum'
    } = body;

    // --- Extract the last user message ---
    // Vercel AI SDK sends the full history including the latest message.
    // We assume the last message is the one the user just sent.
    const userMessageContent = frontendMessages[frontendMessages.length - 1]?.content;
    if (!userMessageContent) {
        // Handle case where messages array is empty or last message has no content
        console.error(`[Hono Route] /api/ai/chat Error: No user message content found in request for chatId ${chatId}`);
        return c.json({ success: false, error: 'No user message content found.' }, 400);
    }

    try {
        console.log(`[Hono Route] /api/ai/chat received for chatId: ${chatId}`);

        // Call your unified provider service
        const streamResult = await unifiedProvider.processMessage({
            chatId,
            userMessage: userMessageContent, // Pass the string content directly
            provider: provider as APIProviders, // Cast provider type
            options: options ?? {}, // Pass options if provided
            tempId,
            systemMessage,
            schema, // Pass Zod schema if provided for structured output
            enum: enumValues, // Pass enum values if provided
        });

        // --- Return the stream with Vercel AI SDK Data Stream headers ---
        // Since unifiedProvider.processMessage returns a raw ReadableStream<Uint8Array>
        // from streamText or streamObject, we need to manually set the headers
        // and use Hono's stream helper.

        c.header('Content-Type', 'text/plain; charset=utf-8');
        c.header('X-Vercel-AI-Data-Stream', 'v1'); // MANDATORY for Data Stream

        console.log(`[Hono Route] Returning stream for chatId: ${chatId}`);
        // Pipe the stream from the unified provider directly
        // Use streamSSE for SSE/Data Stream compatibility
        return streamSSE(c, async (streamWriter: SSEStreamingApi) => {
            await streamWriter.pipe(streamResult);
        });

    } catch (error: any) {
        console.error(`[Hono Route] /api/ai/chat Error for chatId ${chatId}:`, error);
        // Return an error JSON response
        // Avoid leaking internal details in production
        const errorMessage = error.message || 'Failed to process chat request';
        const statusCode = error.status || 500;
        return c.json({ success: false, error: errorMessage }, statusCode);
    }
});

// Export the app if it's in a separate file
// export default chatApp;
// Or ensure this route is registered with your main Hono app instance.
