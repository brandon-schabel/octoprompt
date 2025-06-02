import { createRoute, z } from '@hono/zod-openapi'

import { createChatService } from '@/services/chat-service'
import { attachmentStorage } from '@/utils/storage/attachment-storage'
import { ApiError } from '@octoprompt/shared'
import {
    ApiErrorResponseSchema,
    MessageRoleEnum,
    OperationSuccessResponseSchema
} from '@octoprompt/schemas'
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
    UpdateChatBodySchema,
    UpdateChatParamsSchema,
    AiChatStreamRequestSchema,
    UploadFileParamsSchema,
    FileUploadResponseSchema
} from '@octoprompt/schemas'

import { OpenAPIHono } from '@hono/zod-openapi'
import { APIProviders, ProviderKey } from '@octoprompt/schemas'
import { stream } from 'hono/streaming'
import { handleChatMessage } from '@/services/gen-ai-services'

const chatService = createChatService()


// GET /chats
const getAllChatsRoute = createRoute({
    method: 'get',
    path: '/api/chats',
    tags: ['Chats'],
    summary: 'Get all chat sessions',
    responses: {
        200: {
            content: { 'application/json': { schema: ChatListResponseSchema } },
            description: 'Successfully retrieved all chats'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// POST /chats
const createChatRoute = createRoute({
    method: 'post',
    path: '/api/chats',
    tags: ['Chats'],
    summary: 'Create a new chat session',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateChatBodySchema
                }
            },
            required: true,
            description: 'Data for the new chat session'
        }
    },
    responses: {
        201: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Chat created successfully'
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Referenced chat not found'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// GET /chats/:chatId/messages
const getChatMessagesRoute = createRoute({
    method: 'get',
    path: '/api/chats/{chatId}/messages',
    tags: ['Chats'],
    summary: 'Get messages for a specific chat',
    request: {
        params: GetMessagesParamsSchema
    },
    responses: {
        200: {
            content: { 'application/json': { schema: MessageListResponseSchema } },
            description: 'Successfully retrieved messages'
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat not found'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

const postAiChatSdkRoute = createRoute({
    method: 'post',
    path: '/api/ai/chat', // Keeping the path
    tags: ['AI'],
    summary: 'Chat completion (streaming, chat-associated)',
    description:
        'Continues a chat session identified by chatId, streams response using Vercel AI SDK via UnifiedProviderService.',
    request: {
        body: {
            content: {
                'application/json': { schema: AiChatStreamRequestSchema } // Use the REVISED schema
            },
            required: true,
            description: 'Chat ID, user message, provider, model, and options for the streaming AI chat completion.'
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
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error (invalid request body)'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat session (chatId) not found.'
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Bad Request (e.g., missing API key for provider, invalid provider/model)'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error or AI provider communication error'
        }
    }
})

// POST /chats/{chatId}/fork
const forkChatRoute = createRoute({
    method: 'post',
    path: '/api/chats/{chatId}/fork',
    tags: ['Chats'],
    summary: 'Fork a chat session',
    request: {
        params: ForkChatParamsSchema,
        body: {
            content: { 'application/json': { schema: ForkChatBodySchema } },
            required: true,
            description: 'Optional message IDs to exclude from the fork'
        }
    },
    responses: {
        201: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Chat forked successfully'
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Original chat not found'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// POST /chats/{chatId}/fork/{messageId}
const forkChatFromMessageRoute = createRoute({
    method: 'post',
    path: '/api/chats/{chatId}/fork/{messageId}',
    tags: ['Chats'],
    summary: 'Fork a chat session from a specific message',
    request: {
        params: ForkChatFromMessageParamsSchema,
        body: {
            content: { 'application/json': { schema: ForkChatFromMessageBodySchema } },
            required: true,
            description: 'Optional message IDs to exclude from the fork'
        }
    },
    responses: {
        201: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Chat forked successfully from message'
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Original chat or message not found'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// DELETE /chats/{chatId}/messages/{messageId}
const deleteMessageRoute = createRoute({
    method: 'delete',
    path: '/api/chats/{chatId}/messages/{messageId}',
    tags: ['Messages'],
    summary: 'Delete a specific message',
    request: {
        params: DeleteMessageParamsSchema
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Message deleted successfully'
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Message not found'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// PATCH /chats/{chatId}
const updateChatRoute = createRoute({
    method: 'patch',
    path: '/api/chats/{chatId}',
    tags: ['Chats'],
    summary: 'Update chat properties (e.g., title)',
    request: {
        params: UpdateChatParamsSchema,
        body: {
            content: { 'application/json': { schema: UpdateChatBodySchema } },
            required: true,
            description: 'Data to update for the chat'
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Chat updated successfully'
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat not found'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// DELETE /chats/{chatId}
const deleteChatRoute = createRoute({
    method: 'delete',
    path: '/api/chats/{chatId}',
    tags: ['Chats'],
    summary: 'Delete a chat session and its messages',
    request: {
        params: DeleteChatParamsSchema
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Chat deleted successfully'
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation error'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat not found'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// DELETE /chats/{chatId}/messages/{messageId}/attachments/{attachmentId}
const deleteAttachmentParamsSchema = z.object({
    chatId: z.coerce.number().int().positive().openapi({ param: { name: 'chatId', in: 'path' } }),
    messageId: z.coerce.number().int().positive().openapi({ param: { name: 'messageId', in: 'path' } }),
    attachmentId: z.coerce.number().int().positive().openapi({ param: { name: 'attachmentId', in: 'path' } })
})

const deleteAttachmentRoute = createRoute({
    method: 'delete',
    path: '/api/chats/{chatId}/messages/{messageId}/attachments/{attachmentId}',
    tags: ['Chats', 'Attachments'],
    summary: 'Delete a file attachment from a chat message',
    request: {
        params: deleteAttachmentParamsSchema
    },
    responses: {
        200: {
            content: { 'application/json': { schema: OperationSuccessResponseSchema } },
            description: 'Attachment deleted successfully'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat, message, or attachment not found'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// POST /chats/{chatId}/upload
const uploadFileRoute = createRoute({
    method: 'post',
    path: '/api/chats/{chatId}/upload',
    tags: ['Chats'],
    summary: 'Upload a file attachment for a chat',
    request: {
        params: UploadFileParamsSchema,
        body: {
            content: { 'multipart/form-data': { schema: z.object({ file: z.any() }) } },
            required: true,
            description: 'File to upload as attachment'
        }
    },
    responses: {
        201: {
            content: { 'application/json': { schema: FileUploadResponseSchema } },
            description: 'File uploaded successfully'
        },
        400: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Bad request - no file provided or invalid file'
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Chat not found'
        },
        413: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'File too large'
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

export const chatRoutes = new OpenAPIHono()
    .openapi(getAllChatsRoute, async (c) => {
        const userChats = await chatService.getAllChats()
        // Assuming chatService.getAllChats now returns Chat[] with correct date strings
        // or mapDbRowToChat correctly formats them.
        return c.json(
            {
                success: true,
                data: userChats // No need to remap if service formats correctly
            } satisfies z.infer<typeof ChatListResponseSchema>,
            200
        )
    })
    .openapi(createChatRoute, async (c) => {
        const body = c.req.valid('json')
        const chat = await chatService.createChat(body.title, {
            copyExisting: body.copyExisting,
            currentChatId: body.currentChatId
        })
        return c.json(
            {
                success: true,
                data: chat
            } satisfies z.infer<typeof ChatResponseSchema>,
            201
        )
    })
    .openapi(getChatMessagesRoute, async (c) => {
        const { chatId } = c.req.valid('param')
        const messages = await chatService.getChatMessages(chatId)
        return c.json(
            {
                success: true,

                data: messages.map((msg) => ({
                    ...msg,
                    role: msg.role as z.infer<typeof MessageRoleEnum>
                }))
            } satisfies z.infer<typeof MessageListResponseSchema>,
            200
        )
    })
    .openapi(postAiChatSdkRoute, async (c) => {
        const { chatId, userMessage, options, systemMessage, tempId } = c.req.valid('json')

        const provider = options?.provider as APIProviders
        const model = options?.model as string

        console.log(`[Hono AI Chat] /ai/chat request: ChatID=${chatId}, Provider=${provider}, Model=${model}`)

        try {
            const unifiedOptions = { ...options, model }

            c.header('Content-Type', 'text/event-stream; charset=utf-8')
            c.header('Cache-Control', 'no-cache')
            c.header('Connection', 'keep-alive')

            const readableStream = await handleChatMessage({
                chatId,
                userMessage,
                options: unifiedOptions,
                systemMessage,
                tempId
            })

            return stream(c, async (streamInstance) => {
                await streamInstance.pipe(readableStream.toDataStream())
            })
        } catch (error: any) {
            console.error(`[Hono AI Chat] /ai/chat Error:`, error)
            if (error instanceof ApiError) {
                throw error
            }
            if (error.message?.includes('not found') || error.code === 'CHAT_NOT_FOUND') {
                // Check code too
                throw new ApiError(
                    404,
                    `Chat session with ID ${chatId} not found. Details: ${error.message}`,
                    'CHAT_NOT_FOUND',
                    { originalError: error.message }
                )
            }
            if (error.message?.toLowerCase().includes('api key') || error.code === 'MISSING_API_KEY') {
                throw new ApiError(400, error.message, 'MISSING_API_KEY', { originalError: error.message })
            }
            // Add more specific error conversions if identifiable from `handleChatMessage`
            throw new ApiError(500, error.message || 'Error processing AI chat stream', 'AI_STREAM_ERROR', {
                originalError: error.message
            })
        }
    })
    .openapi(forkChatRoute, async (c) => {
        const { chatId } = c.req.valid('param')
        const { excludedMessageIds } = c.req.valid('json')
        const newChat = await chatService.forkChat(chatId, excludedMessageIds)
        return c.json(
            {
                success: true,
                data: newChat
            } satisfies z.infer<typeof ChatResponseSchema>,
            201
        )
    })
    .openapi(forkChatFromMessageRoute, async (c) => {
        const { chatId, messageId } = c.req.valid('param')
        const { excludedMessageIds } = c.req.valid('json')
        const newChat = await chatService.forkChatFromMessage(chatId, messageId, excludedMessageIds)
        return c.json(
            {
                success: true,
                data: newChat
            } satisfies z.infer<typeof ChatResponseSchema>,
            201
        )
    })
    .openapi(deleteMessageRoute, async (c) => {
        const { messageId, chatId } = c.req.valid('param')
        await chatService.deleteMessage(chatId, messageId)
        return c.json(
            {
                success: true,
                message: 'Message deleted successfully'
            } satisfies z.infer<typeof OperationSuccessResponseSchema>,
            200
        )
    })
    .openapi(updateChatRoute, async (c) => {
        const { chatId } = c.req.valid('param')
        const { title } = c.req.valid('json')
        const updatedChat = await chatService.updateChat(chatId, title)
        return c.json(
            {
                success: true,
                data: updatedChat
            } satisfies z.infer<typeof ChatResponseSchema>,
            200
        )
    })
    .openapi(deleteChatRoute, async (c) => {
        const { chatId } = c.req.valid('param')
        await chatService.deleteChat(chatId)
        return c.json(
            {
                success: true,
                message: 'Chat deleted successfully'
            } satisfies z.infer<typeof OperationSuccessResponseSchema>,
            200
        )
    })
    .openapi(uploadFileRoute, async (c) => {
        const { chatId } = c.req.valid('param')
        
        // Check if chat exists
        const chat = await chatService.getChatById(chatId)
        if (!chat) {
            throw new ApiError(404, 'Chat not found', 'CHAT_NOT_FOUND')
        }
        
        // Get the uploaded file from form data
        const body = await c.req.parseBody()
        const file = body.file as File
        
        if (!file || !(file instanceof File)) {
            throw new ApiError(400, 'No file provided', 'NO_FILE_PROVIDED')
        }
        
        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
            throw new ApiError(413, 'File too large. Maximum size is 10MB', 'FILE_TOO_LARGE')
        }
        
        // Save the file and create attachment record
        // Use a temporary messageId (timestamp) since the actual message isn't created yet
        const tempMessageId = Date.now()
        const attachment = await attachmentStorage.saveFile(chatId, tempMessageId, file)
        
        // Generate the URL for accessing the file
        const fileUrl = `/api/files/chats/${chatId}/${tempMessageId}/${attachment.id}/${encodeURIComponent(attachment.fileName)}`
        
        // Create the response with the correct schema format
        const attachmentResponse = {
            id: attachment.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            size: attachment.size,
            url: fileUrl,
            created: attachment.created
        }
        
        return c.json(
            {
                success: true,
                data: attachmentResponse
            } satisfies z.infer<typeof FileUploadResponseSchema>,
            201
        )
    })
    .openapi(deleteAttachmentRoute, async (c) => {
        const { chatId, messageId, attachmentId } = c.req.valid('param')
        
        // Check if chat exists
        const chat = await chatService.getChatById(chatId)
        if (!chat) {
            throw new ApiError(404, 'Chat not found', 'CHAT_NOT_FOUND')
        }
        
        // For the delete operation, we need the fileName from the attachment
        // Since we don't have a direct way to get the fileName from just the IDs,
        // we'll need to either store attachment metadata or get it from the message
        // For now, we'll use a wildcard approach or require the fileName in the URL
        
        // Try to delete the file using a pattern match
        // This is a simplified approach - in a real implementation you might want to 
        // store attachment metadata in a database
        const success = await attachmentStorage.deleteFileById(chatId, messageId, attachmentId)
        
        if (!success) {
            throw new ApiError(404, 'Attachment not found', 'ATTACHMENT_NOT_FOUND')
        }
        
        return c.json(
            {
                success: true,
                message: 'Attachment deleted successfully'
            } satisfies z.infer<typeof OperationSuccessResponseSchema>,
            200
        )
    })

export type ChatRouteTypes = typeof chatRoutes
