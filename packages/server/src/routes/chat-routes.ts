import { createRoute, z } from '@hono/zod-openapi'

import { createChatService } from '@/services/chat-service';
import { ApiError, } from 'shared';
import {
    ApiErrorResponseSchema,
    MessageRoleEnum,
    OperationSuccessResponseSchema
} from 'shared/src/schemas/common.schemas';
import {
    ChatListResponseSchema,
    ChatResponseSchema,
    CreateChatBodySchema,
    DeleteChatParamsSchema,
    DeleteMessageParamsSchema,
    ForkChatBodySchema,
    ForkChatFromMessageBodySchema,
    ForkChatFromMessageParamsSchema,
    ForkChatParamsSchema,
    GetMessagesParamsSchema,
    MessageListResponseSchema,
    ModelsQuerySchema,
    UpdateChatBodySchema,
    UpdateChatParamsSchema,
    AiChatStreamRequestSchema,
} from "shared/src/schemas/chat.schemas";

import { OpenAPIHono } from '@hono/zod-openapi';
import { APIProviders, ProviderKey } from 'shared/src/schemas/provider-key.schemas';
import { stream } from 'hono/streaming';
import { handleChatMessage } from '@/services/gen-ai-services';

const chatService = createChatService();


// --- Model Routes (/models) ---

// GET /chats
const getAllChatsRoute = createRoute({
    method: 'get',
    path: '/chats',
    tags: ['Chats'],
    summary: 'Get all chat sessions',
    responses: {
        200: {
            content: { 'application/json': { schema: ChatListResponseSchema } },
            description: 'Successfully retrieved all chats',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

// POST /chats
const createChatRoute = createRoute({
    method: 'post',
    path: '/chats',
    tags: ['Chats'],
    summary: 'Create a new chat session',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateChatBodySchema,
                },
            },
            required: true,
            description: 'Data for the new chat session',
        },
    },
    responses: {
        201: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Chat created successfully',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Referenced chat not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

// GET /chats/:chatId/messages
const getChatMessagesRoute = createRoute({
    method: 'get',
    path: '/chats/{chatId}/messages',
    tags: ['Chats'],
    summary: 'Get messages for a specific chat',
    request: {
        params: GetMessagesParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: MessageListResponseSchema } },
            description: 'Successfully retrieved messages',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

const postAiChatSdkRoute = createRoute({
    method: 'post',
    path: '/ai/chat', // Keeping the path
    tags: ['AI'],
    summary: 'Chat completion (streaming, chat-associated)',
    description: 'Continues a chat session identified by chatId, streams response using Vercel AI SDK via UnifiedProviderService.',
    request: {
        body: {
            content: {
                'application/json': { schema: AiChatStreamRequestSchema } // Use the REVISED schema
            },
            required: true,
            description: 'Chat ID, user message, provider, model, and options for the streaming AI chat completion.',
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
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error (invalid request body)',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat session (chatId) not found.',
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Bad Request (e.g., missing API key for provider, invalid provider/model)',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error or AI provider communication error',
        },
    },
});



// POST /chats/{chatId}/fork
const forkChatRoute = createRoute({
    method: 'post',
    path: '/chats/{chatId}/fork',
    tags: ['Chats'],
    summary: 'Fork a chat session',
    request: {
        params: ForkChatParamsSchema,
        body: {
            content: { 'application/json': { schema: ForkChatBodySchema } },
            required: true,
            description: 'Optional message IDs to exclude from the fork',
        },
    },
    responses: {
        201: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Chat forked successfully',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Original chat not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

// POST /chats/{chatId}/fork/{messageId}
const forkChatFromMessageRoute = createRoute({
    method: 'post',
    path: '/chats/{chatId}/fork/{messageId}',
    tags: ['Chats'],
    summary: 'Fork a chat session from a specific message',
    request: {
        params: ForkChatFromMessageParamsSchema,
        body: {
            content: { 'application/json': { schema: ForkChatFromMessageBodySchema } },
            required: true,
            description: 'Optional message IDs to exclude from the fork',
        },
    },
    responses: {
        201: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Chat forked successfully from message',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Original chat or message not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

// DELETE /messages/{messageId}
const deleteMessageRoute = createRoute({
    method: 'delete',
    path: '/messages/{messageId}',
    tags: ['Messages'],
    summary: 'Delete a specific message',
    request: {
        params: DeleteMessageParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Message deleted successfully',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Message not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

// PATCH /chats/{chatId}
const updateChatRoute = createRoute({
    method: 'patch',
    path: '/chats/{chatId}',
    tags: ['Chats'],
    summary: 'Update chat properties (e.g., title)',
    request: {
        params: UpdateChatParamsSchema,
        body: {
            content: { 'application/json': { schema: UpdateChatBodySchema } },
            required: true,
            description: 'Data to update for the chat',
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Chat updated successfully',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

// DELETE /chats/{chatId}
const deleteChatRoute = createRoute({
    method: 'delete',
    path: '/chats/{chatId}',
    tags: ['Chats'],
    summary: 'Delete a chat session and its messages',
    request: {
        params: DeleteChatParamsSchema,
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Chat deleted successfully',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error',
        },
    },
});

export const chatRoutes = new OpenAPIHono()
    // GET /chats
    .openapi(getAllChatsRoute, async (c) => {
        const userChats = await chatService.getAllChats();
        const responseData = userChats.map(chat => ({
            ...chat,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
        }));

        return c.json({
            success: true,
            data: responseData,
        } satisfies z.infer<typeof ChatListResponseSchema>, 200);
    })

    // POST /chats
    .openapi(createChatRoute, async (c) => {
        const body = c.req.valid('json');

        if (body.copyExisting && body.currentChatId) {
            // Check if the chat exists by trying to get messages
            try {
                await chatService.getChatMessages(body.currentChatId);
            } catch (error) {
                throw new ApiError(404, `Referenced chat with ID ${body.currentChatId} not found`, 'REFERENCED_CHAT_NOT_FOUND');
            }
        }

        const chat = await chatService.createChat(body.title, {
            copyExisting: body.copyExisting,
            currentChatId: body.currentChatId
        });

        return c.json({
            success: true,
            data: {
                ...chat,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt
            }
        } satisfies z.infer<typeof ChatResponseSchema>, 201);
    })

    // GET /chats/:chatId/messages
    .openapi(getChatMessagesRoute, async (c) => {
        const { chatId } = c.req.valid('param');

        try {
            const messages = await chatService.getChatMessages(chatId);
            return c.json({
                success: true,
                data: messages.map(msg => ({
                    ...msg,
                    createdAt: msg.createdAt,
                    role: msg.role as z.infer<typeof MessageRoleEnum>,
                }))
            } satisfies z.infer<typeof MessageListResponseSchema>, 200);
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                throw new ApiError(404, `Chat with ID ${chatId} not found`, 'CHAT_NOT_FOUND');
            }
            throw error;
        }
    })

    // GET /models



    // POST /ai/chat
    // Get All Provider Keys
    // Get Provider Keys Config
    // Right now it is getting the open router instance, however I need to swap this out for the 
    // unified provider service,
    // no matter what model or provider I'm using, the service should be updated
    // to use the aisdk for streaming and then just like i do in the route below 
    // pipe the result from the aisdk to the client to be compatible with react ai sdk
    .openapi(postAiChatSdkRoute, async (c) => {
        const {
            chatId,
            userMessage,
            options, // Contains optional temp, maxTokens, etc.
            systemMessage, // Optional system message override
            tempId // Optional tempId for UI
        } = c.req.valid('json');

        const provider = options?.provider as APIProviders
        const model = options?.model as string

        console.log(`[Hono AI Chat] /ai/chat request: ChatID=${chatId}, Provider=${provider}, Model=${model}`);

        try {
            // Ensure the chat exists (optional, unifiedProvider might handle it)
            // You could add a quick check here using chatService if needed:
            // await chatService.getChatMessages(chatId); // Throws if chat not found

            // Combine model and other options for the unified service
            const unifiedOptions = { ...options, model }; // Pass model within options

            // Set headers for SSE
            c.header('Content-Type', 'text/event-stream; charset=utf-8');
            c.header('Cache-Control', 'no-cache');
            c.header('Connection', 'keep-alive');

            // Call the unified provider's processMessage function
            // This handles history fetching, message saving, AI call, and final update
            const readableStream = await handleChatMessage({
                chatId,
                userMessage,
                options: unifiedOptions,
                // TODO: System Message should be on the chat, and not 
                // need to be passed in on each request 
                systemMessage,
                tempId,
                // messages: undefined, // History fetched internally by processMessage
                // schema: undefined, // Not using structured output in this basic streaming route
            });


            // Use Hono's stream helper to pipe the ReadableStream from the AI SDK
            return stream(c, async (stream) => {
                await stream.pipe(readableStream.toDataStream());
            });

        } catch (error: any) {
            console.error(`[Hono AI Chat] /ai/chat Error:`, error);

            if (error instanceof ApiError) { // Handle custom API errors
                throw error;
            }
            // Check for specific error types if needed (e.g., chat not found)
            if (error.message?.includes('not found')) { // Example check
                throw new ApiError(404, `Chat session with ID ${chatId} not found.`, 'CHAT_NOT_FOUND');
            }
            // Check for API key errors (unifiedProvider might throw these)
            if (error.message?.toLowerCase().includes('api key')) {
                throw new ApiError(400, error.message, 'MISSING_API_KEY');
            }

            // Default to 500 for other errors
            throw new ApiError(500, error.message || 'Error processing AI chat stream');
        }
    })


    // POST /chats/:chatId/fork
    .openapi(forkChatRoute, async (c) => {
        const { chatId } = c.req.valid('param');
        const { excludedMessageIds } = c.req.valid('json');

        try {
            const newChat = await chatService.forkChat(chatId, excludedMessageIds);
            return c.json({
                success: true,
                data: {
                    ...newChat,
                    createdAt: newChat.createdAt,
                    updatedAt: newChat.updatedAt
                }
            } satisfies z.infer<typeof ChatResponseSchema>, 201);
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                throw new ApiError(404, `Chat with ID ${chatId} not found`, 'CHAT_NOT_FOUND');
            }
            throw error;
        }
    })

    // POST /chats/:chatId/fork/:messageId
    .openapi(forkChatFromMessageRoute, async (c) => {
        const { chatId, messageId } = c.req.valid('param');
        const { excludedMessageIds } = c.req.valid('json');

        try {
            const newChat = await chatService.forkChatFromMessage(chatId, messageId, excludedMessageIds);
            return c.json({
                success: true,
                data: {
                    ...newChat,
                    createdAt: newChat.createdAt,
                    updatedAt: newChat.updatedAt
                }
            } satisfies z.infer<typeof ChatResponseSchema>, 201);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('Chat not found')) {
                    throw new ApiError(404, `Chat with ID ${chatId} not found`, 'CHAT_NOT_FOUND');
                } else if (error.message.includes('Message not found')) {
                    throw new ApiError(404, `Message with ID ${messageId} not found`, 'MESSAGE_NOT_FOUND');
                }
            }
            throw error;
        }
    })

    // DELETE /messages/:messageId
    .openapi(deleteMessageRoute, async (c) => {
        const { messageId } = c.req.valid('param');

        try {
            await chatService.deleteMessage(messageId);
            return c.json({
                success: true,
                message: 'Message deleted successfully'
            } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                throw new ApiError(404, `Message with ID ${messageId} not found`, 'MESSAGE_NOT_FOUND');
            }
            throw error;
        }
    })

    // PATCH /chats/:chatId
    .openapi(updateChatRoute, async (c) => {
        const { chatId } = c.req.valid('param');
        const { title } = c.req.valid('json');

        try {
            const updatedChat = await chatService.updateChat(chatId, title);
            return c.json({
                success: true,
                data: {
                    ...updatedChat,
                    createdAt: updatedChat.createdAt,
                    updatedAt: updatedChat.updatedAt
                }
            } satisfies z.infer<typeof ChatResponseSchema>, 200);
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                throw new ApiError(404, `Chat with ID ${chatId} not found`, 'CHAT_NOT_FOUND');
            }
            throw error;
        }
    })

    // DELETE /chats/:chatId
    .openapi(deleteChatRoute, async (c) => {
        const { chatId } = c.req.valid('param');

        try {
            await chatService.deleteChat(chatId);
            return c.json({
                success: true,
                message: 'Chat deleted successfully'
            } satisfies z.infer<typeof OperationSuccessResponseSchema>, 200);
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                throw new ApiError(404, `Chat with ID ${chatId} not found`, 'CHAT_NOT_FOUND');
            }
            throw error;
        }
    });

export type ChatRouteTypes = typeof chatRoutes;