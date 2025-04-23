// packages/shared/src/validation/chat-api-validation.ts
import { z } from '@hono/zod-openapi';
import { AI_API_PROVIDERS, type APIProviders } from '../global-state/global-state-schema';
import type { ModelOptions } from './model-options-schema';
// Remove direct import of DB schemas if they aren't used elsewhere in this file
// import { ChatReadSchema, ChatMessageReadSchema } from "../utils/database/db-schemas";


// --- Reusable Base Schemas ---
export const ApiErrorResponseSchema = z.object({
    success: z.literal(false).openapi({ description: 'Indicates the request was unsuccessful' }),
    error: z.string().openapi({ example: 'Resource not found', description: 'A description of the error' }),
    code: z.string().optional().openapi({ example: 'NOT_FOUND', description: 'An optional error code' }),
    details: z.any().optional().openapi({ description: 'Optional details, e.g., validation errors' }),
}).openapi('ApiErrorResponse');

export const OperationSuccessResponseSchema = z.object({
    success: z.literal(true).openapi({ description: 'Indicates if the request was successful' }),
    message: z.string().optional().openapi({ example: 'Operation successful', description: 'An optional success message' })
}).openapi('OperationSuccessResponse');

// --- Schemas for API Data (Dates as Strings) ---

const ApiChatSchema = z.object({
    id: z.string().min(1).openapi({ example: 'chat-a1b2c3d4', description: 'Chat ID' }),
    title: z.string().openapi({ example: 'My Chat Session', description: 'Chat title' }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T12:00:00.000Z', description: 'Creation timestamp (ISO 8601)' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T12:05:00.000Z', description: 'Last update timestamp (ISO 8601)' })
}).openapi('ApiChat');

// Explicitly define the allowed roles for better type safety
const MessageRoleEnum = z.enum(['system', 'user', 'assistant', 'tool', 'function', 'data']);
export type MessageRole = z.infer<typeof MessageRoleEnum>; // Export the type if needed elsewhere
export { MessageRoleEnum }; // Export the enum itself

const ApiChatMessageSchema = z.object({
    id: z.string().min(1).openapi({ example: 'msg-m1a2b3c4', description: 'Message ID' }),
    chatId: z.string().min(1).openapi({ example: 'chat-a1b2c3d4', description: 'Parent Chat ID' }),
    role: MessageRoleEnum.openapi({ example: 'user', description: 'Role of the message sender' }),
    content: z.string().openapi({ example: 'Hello, world!', description: 'Message content' }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T12:00:05.000Z', description: 'Creation timestamp (ISO 8601)' })
    // Add other fields like 'name', 'tool_call_id' if they are returned by mapMessageToResponse
}).openapi('ApiChatMessage');

// Define the schema for a single model in the list
// *** Adjust this schema based on the actual structure returned by your service ***
const UnifiedModelSchema = z.object({
    id: z.string().openapi({ example: 'gpt-4-turbo', description: 'Model identifier' }),
    name: z.string().openapi({ example: 'GPT-4 Turbo', description: 'User-friendly model name' }),
    provider: z.string().openapi({ example: 'openai', description: 'Provider ID' }),
    context_length: z.number().optional().openapi({ example: 128000, description: 'Context window size' }),
    // Add other relevant fields like 'description', 'capabilities', etc.
}).openapi('UnifiedModel');

export { UnifiedModelSchema }; // Export the schema

// --- Specific Response Schemas ---
export const ChatResponseSchema = z.object({
    success: z.literal(true),
    data: ApiChatSchema
}).openapi('ChatResponse');

export const ChatListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(ApiChatSchema)
}).openapi('ChatListResponse');

export const MessageListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(ApiChatMessageSchema)
}).openapi('MessageListResponse');

// --- NEW: Define Models List Response Schema ---
export const ModelsListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(UnifiedModelSchema) // Use the newly defined model schema
}).openapi('ModelsListResponse'); // Register as component

// Example: Create Chat Body
export const CreateChatBodySchema = z.object({
    title: z.string().min(1).openapi({ example: 'My New Chat Session' }),
    copyExisting: z.boolean().optional().openapi({ description: 'Copy messages from currentChatId if true' }),
    currentChatId: z.string().min(1).optional().openapi({ example: 'chat-a1b2c3d4' })
}).openapi('CreateChatRequestBody');



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

export const UpdateChatBodySchema = z.object({
    title: z.string().min(1).openapi({ example: 'Updated Chat Title' })
}).openapi('UpdateChatRequestBody');

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
export const messageSchema = z.object({
    role: MessageRoleEnum,
    content: z.string(),
    id: z.string().optional(),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
}).openapi('AiMessage');

// --- Schema for AI SDK Options ---
// Make sure this aligns with what Vercel/your provider actually accepts/uses
export const aiSdkOptionsSchema = z.object({
    model: z.string().optional().openapi({ example: 'gpt-4-turbo', description: 'Model ID to use' }),
    temperature: z.number().min(0).max(2).optional().openapi({ example: 0.7 }),
    maxTokens: z.number().int().positive().optional().openapi({ example: 1024 }),
    topP: z.number().min(0).max(1).optional().openapi({ example: 1 }),
    frequencyPenalty: z.number().optional().openapi({ example: 0 }),
    presencePenalty: z.number().optional().openapi({ example: 0 }),
    topK: z.number().int().positive().optional().openapi({ example: -1 }),
    response_format: z.any().optional().openapi({ description: 'Provider-specific response format options' }), // Use z.any() if structure varies greatly
    structuredOutputMode: z.enum(['auto', 'tool', 'json']).optional().openapi({ description: "Mode for structured output (if supported)" }),
    schemaName: z.string().optional().openapi({ description: "Name for structured output schema" }),
    schemaDescription: z.string().optional().openapi({ description: "Description for structured output schema" }),
    outputStrategy: z.enum(['object', 'array', 'enum', 'no-schema']).optional().openapi({ description: "Strategy for structured output generation" }),
}).partial().optional().openapi('AiSdkOptions');

// --- Updated AiChatRequestSchema ---
export const AiChatRequestSchema = z.object({
    messages: z.array(messageSchema).min(1, { message: "Conversation must have at least one message." }).openapi({
        description: 'Array of messages forming the conversation history.'
    }),
    chatId: z.string({ required_error: "chatId is required in the request body." })
        .min(1, { message: "chatId cannot be empty." }).openapi({
            example: 'chat-a1b2c3d4',
            description: 'The ID of the chat session this request belongs to.'
        }),
    provider: z.enum(AI_API_PROVIDERS).or(z.string()).optional().openapi({
        example: 'openai',
        description: 'The AI provider to use (e.g., openai, anthropic) or a custom identifier.'
    }),
    options: aiSdkOptionsSchema.openapi({
        description: 'Optional parameters for the AI model.'
    }),
    tempId: z.string().optional().openapi({
        example: 'temp_msg_123',
        description: 'Temporary client-side ID for optimistic updates.'
    }),
    systemMessage: z.string().optional().openapi({
        example: 'You are a helpful assistant.',
        description: 'Optional system message to guide the AI.'
    }),
    schema: z.any().optional().openapi({
        description: 'Optional Zod schema (or JSON schema representation) for structured output.'
    }),
    enumValues: z.array(z.string()).optional().openapi({
        description: 'Optional array of enum values for specific structured output strategies.'
    }),
}).openapi('AiChatRequestBody');

export const ModelListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(UnifiedModelSchema)
}).openapi('ModelListResponse');


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


export type CreateMessageBodyGeneric<TProvider extends APIProviders> = {
    message: string;
    chatId: string;
    excludedMessageIds?: string[];
    tempId?: string;
} & ModelOptions<TProvider>;

