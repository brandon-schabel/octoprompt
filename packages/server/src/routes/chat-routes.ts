import { createRoute, z } from '@hono/zod-openapi'
import { streamSSE, SSEStreamingApi } from 'hono/streaming';

import { createChatService } from '@/services/model-providers/chat/chat-service';
import { ApiError, } from 'shared';
import {
    ApiErrorResponseSchema,
    OperationSuccessResponseSchema
} from 'shared/src/schemas/common.schemas';
import { unifiedProvider } from '@/services/model-providers/providers/unified-provider-service';
import { MessageRoleEnum, AiChatRequestSchema, ChatListResponseSchema, ChatResponseSchema, CreateChatBodySchema, DeleteChatParamsSchema, DeleteMessageParamsSchema, ForkChatBodySchema, ForkChatFromMessageBodySchema, ForkChatFromMessageParamsSchema, ForkChatParamsSchema, GetMessagesParamsSchema, MessageListResponseSchema, ModelsListResponseSchema, ModelsQuerySchema, UpdateChatBodySchema, UpdateChatParamsSchema } from "shared/src/schemas/chat.schemas";

import { ModelFetcherService, ProviderKeysConfig } from '@/services/model-providers/providers/model-fetcher-service';
import { providerKeyService } from '@/services/model-providers/providers/provider-key-service';
import { OLLAMA_BASE_URL, LMSTUDIO_BASE_URL } from "@/services/model-providers/providers/provider-defaults";
import { OpenAPIHono } from '@hono/zod-openapi';
import { APIProviders, ProviderKey } from 'shared/src/schemas/provider-key.schemas';

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

// POST /ai/chat (Streaming Example)
const postAiChatRoute = createRoute({
    method: 'post',
    path: '/ai/chat',
    tags: ['AI'],
    summary: 'Send message to AI for chat completion (streaming)',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: AiChatRequestSchema,
                },
            },
            required: true,
            description: 'Chat context and message to send to the AI',
        },
    },
    responses: {
        200: {
            content: { 'text/event-stream': { schema: z.string().openapi({ description: "Streamed AI response chunks" }) } },
            description: 'Successfully initiated AI response stream.',
            headers: z.object({
                'X-Vercel-AI-Data-Stream': z.string().openapi({ example: 'v1' }),
                'X-Provider': z.string().openapi({ example: 'openai' }),
            }).openapi('AiStreamHeaders')
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error',
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Invalid input or missing user message',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error or AI provider error',
        },
    },
});

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

    // POST /ai/chat
    .openapi(postAiChatRoute, async (c) => {
        const { chatId, provider = 'openai', options, tempId, systemMessage, messages: frontendMessages, schema, enumValues } = c.req.valid('json');
        const userMessageContent = frontendMessages[frontendMessages.length - 1]?.content;

        if (!userMessageContent) {
            throw new ApiError(400, 'No user message content found', 'MISSING_MESSAGE_CONTENT');
        }

        try {
            console.log(`[Hono Route] /ai/chat received for chatId: ${chatId}, provider: ${provider}`);
            const streamResult = await unifiedProvider.processMessage({
                chatId,
                userMessage: userMessageContent,
                provider: provider as APIProviders,
                options: options ?? {},
                tempId,
                systemMessage,
                schema,
                enum: enumValues
            });

            c.header('Content-Type', 'text/event-stream; charset=utf-8');
            c.header('X-Vercel-AI-Data-Stream', 'v1');
            c.header('X-Provider', provider);
            console.log(`[Hono Route] Returning stream for chatId: ${chatId}`);

            return streamSSE(c, async (streamWriter: SSEStreamingApi) => {
                try {
                    await streamWriter.pipe(streamResult);
                } catch (streamError: any) {
                    console.error(`[Hono Route] Stream Error for chatId ${chatId}:`, streamError);
                }
            });
        } catch (error: any) {
            console.error(`[Hono Route] /ai/chat Error for chatId ${chatId}:`, error);
            const isApiKeyError = error.message?.includes('API key not found');

            if (isApiKeyError) {
                throw new ApiError(400, error.message || 'API key not found', 'MISSING_API_KEY');
            } else {
                throw new ApiError(500, error.message || 'Error processing AI message', 'PROVIDER_ERROR');
            }
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