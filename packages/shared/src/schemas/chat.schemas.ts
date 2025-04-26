import { z } from '@hono/zod-openapi';
import { AI_API_PROVIDERS } from './provider-key.schemas';
import { AiSdkOptionsSchema, UnifiedModelSchema } from './gen-ai.schemas';
import  { MessageRoleEnum } from './common.schemas';


export type MessageRole = z.infer<typeof MessageRoleEnum>; // Export the type if needed elsewhere

const baseModelOptionsSchema = z.object({
    model: z.string().optional(),
    max_tokens: z.number().optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    frequency_penalty: z.number().optional(),
    presence_penalty: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
});

export type ModelOptions = z.infer<typeof baseModelOptionsSchema>;

// Base schemas for chat entities
export const ChatSchema = z.object({
    id: z.string().openapi({ example: 'chat_1a2b3c4d' }),
    title: z.string(),
    createdAt: z.string().datetime().openapi({ example: '2024-03-10T10:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-03-10T10:05:00.000Z' }),
}).openapi('Chat');

export const ChatMessageSchema = z.object({
    id: z.string().min(1).openapi({ example: 'msg-m1a2b3c4', description: 'Message ID' }),
    chatId: z.string().min(1).openapi({ example: 'chat-a1b2c3d4', description: 'Parent Chat ID' }),
    role: MessageRoleEnum.openapi({ example: 'user', description: 'Role of the message sender' }),
    content: z.string().openapi({ example: 'Hello, world!', description: 'Message content' }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T12:00:05.000Z', description: 'Creation timestamp (ISO 8601)' })
}).openapi('ChatMessage');

// Request Parameter Schemas
export const ChatIdParamsSchema = z.object({
    chatId: z.string().min(1).openapi({
        param: { name: 'chatId', in: 'path' },
        example: 'chat_1a2b3c4d',
        description: 'The ID of the chat'
    })
}).openapi('ChatIdParams');

// Request Body Schemas
export const CreateChatBodySchema = z.object({
    title: z.string().min(1).openapi({ example: 'New Chat Session' }),
    copyExisting: z.boolean().optional().openapi({ description: 'Copy messages from currentChatId if true' }),
    currentChatId: z.string().min(1).optional().openapi({ example: 'chat-a1b2c3d4' })
}).openapi('CreateChatRequestBody');

export const UpdateChatBodySchema = z.object({
    title: z.string().min(1).openapi({ example: 'Updated Chat Title' }),
}).openapi('UpdateChatRequestBody');

export const CreateChatMessageBodySchema = z.object({
    role: z.string().openapi({ example: 'user', description: 'Message role (user, assistant, system)' }),
    content: z.string().min(1).openapi({ example: 'How can I implement authentication?' }),
}).openapi('CreateChatMessageRequestBody');

// Response Schemas
export const ChatResponseSchema = z.object({
    success: z.literal(true),
    data: ChatSchema
}).openapi('ChatResponse');

export const ChatListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(ChatSchema)
}).openapi('ChatListResponse');

export const ChatMessageResponseSchema = z.object({
    success: z.literal(true),
    data: ChatMessageSchema
}).openapi('ChatMessageResponse');

export const ChatMessagesListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(ChatMessageSchema)
}).openapi('ChatMessagesListResponse');


export const MessageListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(ChatMessageSchema)
}).openapi('MessageListResponse');


export const ModelListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(UnifiedModelSchema)
}).openapi('ModelListResponse');


export const GetMessagesParamsSchema = z.object({
    chatId: z.string().min(1).openapi({
        param: { name: 'chatId', in: 'path' },
        example: 'chat-a1b2c3d4',
        description: 'The ID of the chat to retrieve messages for'
    })
}).openapi('GetMessagesParams');


export const ForkChatParamsSchema = z.object({
    chatId: z.string().min(1).openapi({
        param: { name: 'chatId', in: 'path' },
        example: 'chat-a1b2c3d4',
        description: 'The ID of the chat to fork'
    })
}).openapi('ForkChatParams');


export const ForkChatBodySchema = z.object({
    excludedMessageIds: z.array(z.string().min(1)).default([]).openapi({
        description: 'Optional list of message IDs to exclude from the fork',
        example: ['msg-m1a2b3c4']
    })
}).openapi('ForkChatRequestBody');

// --- UPDATED: ForkChatFromMessageParamsSchema ---
export const ForkChatFromMessageParamsSchema = z.object({
    chatId: z.string().min(1).openapi({
        param: { name: 'chatId', in: 'path' },
        example: 'chat-a1b2c3d4',
        description: 'The ID of the chat to fork'
    }),
    messageId: z.string().min(1).openapi({
        param: { name: 'messageId', in: 'path' },
        example: 'msg-m1a2b3c4',
        description: 'The ID of the message to fork from'
    })
}).openapi('ForkChatFromMessageParams');


export const ForkChatFromMessageBodySchema = z.object({
    excludedMessageIds: z.array(z.string().min(1)).default([]).openapi({
        description: 'Optional list of message IDs to exclude from the fork',
        example: ['msg-m1a2b3c4']
    })
}).openapi('ForkChatFromMessageRequestBody');


export const UpdateChatParamsSchema = z.object({
    chatId: z.string().min(1).openapi({
        param: { name: 'chatId', in: 'path' },
        example: 'chat-a1b2c3d4',
        description: 'The ID of the chat to update'
    })
}).openapi('UpdateChatParams');

export const DeleteChatParamsSchema = z.object({
    chatId: z.string().min(1).openapi({
        param: { name: 'chatId', in: 'path' },
        example: 'chat-a1b2c3d4',
        description: 'The ID of the chat to delete'
    })
}).openapi('DeleteChatParams');

export const DeleteMessageParamsSchema = z.object({
    messageId: z.string().min(1).openapi({
        param: { name: 'messageId', in: 'path' },
        example: 'msg-m1a2b3c4',
        description: 'The ID of the message to delete'
    })
}).openapi('DeleteMessageParams');


export const ModelsQuerySchema = z.object({
    provider: z.string().openapi({
        description: 'The provider to filter models by',
        example: 'openai'
    })
}).openapi('ModelsQuery');

// --- Schema for individual messages (aligns with Vercel AI SDK CoreMessage) ---
// --- Schema for individual messages (aligns with Vercel AI SDK CoreMessage) ---
export const messageSchema = z.object({
    role: MessageRoleEnum,
    content: z.string(),
    // Keep optional fields if needed internally, but often not needed for basic requests
    // id: z.string().optional(),
    // name: z.string().optional(),
    // tool_call_id: z.string().optional(),
}).openapi('AiMessage');


// --- REVISED: Schema for Streaming Chat Request ---
// Renamed for clarity and modified fields
export const AiChatStreamRequestSchema = z.object({
    chatId: z.string().min(1).openapi({
        example: 'chat-a1b2c3d4',
        description: 'Required ID of the chat session to continue.'
    }),
    userMessage: z.string().min(1, { message: "User message cannot be empty." }).openapi({
        description: 'The latest message content from the user.',
        example: 'Thanks! Can you elaborate on the E=mc^2 part?'
    }),
    provider: z.enum(AI_API_PROVIDERS).or(z.string()).openapi({
        example: 'openrouter',
        description: 'The AI provider to use (e.g., openai, openrouter).'
    }),
    model: z.string().min(1).openapi({
        example: 'deepseek/deepseek-chat-v3-0324:free',
        description: 'The model identifier to use.'
    }),
    options: AiSdkOptionsSchema.openapi({
        description: 'Optional parameters for the AI model.'
    }),
    systemMessage: z.string().optional().openapi({ // Allows overriding system message for this turn
        example: 'Respond concisely.',
        description: 'Optional system message override for this specific request.'
    }),
    tempId: z.string().optional().openapi({
        example: 'temp_msg_456',
        description: 'Temporary client-side ID for optimistic UI updates.'
    }),
    debug: z.boolean().optional().openapi({
        example: true,
        description: 'Enable debug mode for detailed logging.'
    }),
    // 'messages' array is removed - history will be fetched using chatId
    // Fields related to SDK native structured output (schema, enumValues, etc.) are removed
    // but could be added back if needed for the streaming endpoint via `options`.
}).openapi('AiChatStreamRequest');

export type CreateMessageBodyGeneric = {
    message: string;
    chatId: string;
    excludedMessageIds?: string[];
    tempId?: string;
} & ModelOptions

// --- Validation Schemas with OpenAPI Enhancements (Keep as is, looks good) ---
export const chatApiValidation = {
    createChat: {
        body: CreateChatBodySchema
    },
    getMessages: {
        params: GetMessagesParamsSchema
    },
    forkChat: {
        params: ForkChatParamsSchema,
        body: ForkChatBodySchema
    },
    forkChatFromMessage: {
        params: ForkChatFromMessageParamsSchema,
        body: ForkChatFromMessageBodySchema
    },
    updateChat: {
        params: UpdateChatParamsSchema,
        body: UpdateChatBodySchema
    },
    deleteChat: {
        params: DeleteChatParamsSchema
    },
    deleteMessage: {
        params: DeleteMessageParamsSchema
    }
} as const;

// Type exports
export type Chat = z.infer<typeof ChatSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type CreateChatBody = z.infer<typeof CreateChatBodySchema>;
export type UpdateChatBody = z.infer<typeof UpdateChatBodySchema>;
export type CreateChatMessageBody = z.infer<typeof CreateChatMessageBodySchema>;
export type ExtendedChatMessage = ChatMessage & {
    tempId?: string;
}
export type AiChatStreamRequest = z.infer<typeof AiChatStreamRequestSchema>;
