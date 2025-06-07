import { z } from '@hono/zod-openapi'
// TODO: Replace with Mastra schemas when ready
// Temporary minimal schemas until Mastra integration is complete

import { MessageRoleEnum } from './common.schemas'
import { LOW_MODEL_CONFIG } from './constants/model-default-configs'

import { unixTSArraySchemaSpec, unixTSSchemaSpec } from './schema-utils'
import { AiSdkOptionsSchema, UnifiedModelSchema } from './gen-ai.schemas'

export type MessageRole = z.infer<typeof MessageRoleEnum> // Export the type if needed elsewhere

const baseModelOptionsSchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional()
})

export type ModelOptions = z.infer<typeof baseModelOptionsSchema>

// Base schemas for chat entities
export const ChatSchema = z
  .object({
    id: unixTSSchemaSpec,
    title: z.string(),
    // unix timestamp in milliseconds
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('Chat')

// Schema for chat message attachments
export const ChatMessageAttachmentSchema = z
  .object({
    id: unixTSSchemaSpec.describe('Unique ID for the attachment itself.'),
    fileName: z.string().openapi({ description: 'Original name of the uploaded file.' }),
    mimeType: z.string().openapi({ description: 'MIME type of the file.' }),
    size: z.number().int().positive().openapi({ description: 'File size in bytes.' }),
    url: z.string().url().openapi({ description: 'URL to access/download the attachment.' }),
    created: unixTSSchemaSpec
  })
  .openapi('ChatMessageAttachment')

export const ChatMessageSchema = z
  .object({
    id: unixTSSchemaSpec,
    chatId: unixTSSchemaSpec,
    role: MessageRoleEnum.openapi({ example: 'user', description: 'Role of the message sender' }),
    content: z.string().openapi({ example: 'Hello, world!', description: 'Message content' }),
    created: unixTSSchemaSpec,
    attachments: z
      .array(ChatMessageAttachmentSchema)
      .optional()
      .openapi({ description: 'Optional list of attachments for the message.' })
  })
  .openapi('ChatMessage')

// Request Parameter Schemas
export const ChatIdParamsSchema = z
  .object({
    chatId: unixTSSchemaSpec.openapi({ param: { name: 'chatId', in: 'path' } })
  })
  .openapi('ChatIdParams')

// Request Body Schemas
export const CreateChatBodySchema = z
  .object({
    title: z.string().min(1).openapi({ example: 'New Chat Session' }),
    copyExisting: z.boolean().optional().openapi({ description: 'Copy messages from currentChatId if true' }),
    currentChatId: unixTSSchemaSpec.optional()
  })
  .openapi('CreateChatRequestBody')

export const UpdateChatBodySchema = z
  .object({
    title: z.string().min(1).openapi({ example: 'Updated Chat Title' })
  })
  .openapi('UpdateChatRequestBody')

export const CreateChatMessageBodySchema = z
  .object({
    role: z.string().openapi({ example: 'user', description: 'Message role (user, assistant, system)' }),
    content: z.string().min(1).openapi({ example: 'How can I implement authentication?' })
  })
  .openapi('CreateChatMessageRequestBody')

// File upload schemas
export const UploadFileParamsSchema = z
  .object({
    chatId: unixTSSchemaSpec
  })
  .openapi('UploadFileParams')

export const FileUploadResponseSchema = z
  .object({
    success: z.literal(true),
    data: ChatMessageAttachmentSchema
  })
  .openapi('FileUploadResponse')

// Response Schemas
export const ChatResponseSchema = z
  .object({
    success: z.literal(true),
    data: ChatSchema
  })
  .openapi('ChatResponse')

export const ChatListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ChatSchema)
  })
  .openapi('ChatListResponse')

export const ChatMessageResponseSchema = z
  .object({
    success: z.literal(true),
    data: ChatMessageSchema
  })
  .openapi('ChatMessageResponse')

export const ChatMessagesListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ChatMessageSchema)
  })
  .openapi('ChatMessagesListResponse')

export const MessageListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ChatMessageSchema)
  })
  .openapi('MessageListResponse')

export const ModelListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(UnifiedModelSchema)
  })
  .openapi('ModelListResponse')

export const GetMessagesParamsSchema = z
  .object({
    chatId: unixTSSchemaSpec.openapi({ param: { name: 'chatId', in: 'path' } })
  })
  .openapi('GetMessagesParams')

export const ForkChatParamsSchema = z
  .object({
    chatId: unixTSSchemaSpec.openapi({ param: { name: 'chatId', in: 'path' } })
  })
  .openapi('ForkChatParams')

export const ForkChatBodySchema = z
  .object({
    excludedMessageIds: unixTSArraySchemaSpec
  })
  .openapi('ForkChatRequestBody')

// --- UPDATED: ForkChatFromMessageParamsSchema ---
export const ForkChatFromMessageParamsSchema = z
  .object({
    chatId: unixTSSchemaSpec.openapi({ param: { name: 'chatId', in: 'path' } }),
    messageId: unixTSSchemaSpec.openapi({ param: { name: 'messageId', in: 'path' } })
  })
  .openapi('ForkChatFromMessageParams')

export const ForkChatFromMessageBodySchema = z
  .object({
    excludedMessageIds: unixTSArraySchemaSpec
  })
  .openapi('ForkChatFromMessageRequestBody')

export const UpdateChatParamsSchema = z
  .object({
    chatId: unixTSSchemaSpec.openapi({ param: { name: 'chatId', in: 'path' } })
  })
  .openapi('UpdateChatParams')

export const DeleteChatParamsSchema = z
  .object({
    chatId: unixTSSchemaSpec.openapi({ param: { name: 'chatId', in: 'path' } })
  })
  .openapi('DeleteChatParams')

export const DeleteMessageParamsSchema = z
  .object({
    chatId: unixTSSchemaSpec.openapi({ param: { name: 'chatId', in: 'path' } }),
    messageId: unixTSSchemaSpec.openapi({ param: { name: 'messageId', in: 'path' } })
  })
  .openapi('DeleteMessageParams')

export const ModelsQuerySchema = z
  .object({
    provider: z.string().openapi({
      description: 'The provider to filter models by',
      example: LOW_MODEL_CONFIG.provider
    })
  })
  .openapi('ModelsQuery')

// --- Schema for individual messages (aligns with Vercel AI SDK CoreMessage) ---
// --- Schema for individual messages (aligns with Vercel AI SDK CoreMessage) ---
export const messageSchema = z
  .object({
    role: MessageRoleEnum,
    content: z.string()
    // Keep optional fields if needed internally, but often not needed for basic requests
    // id: z.string().optional(),
    // name: z.string().optional(),
    // tool_call_id: z.string().optional(),
  })
  .openapi('AiMessage')

// --- REVISED: Schema for Streaming Chat Request ---
// Renamed for clarity and modified fields
export const AiChatStreamRequestSchema = z
  .object({
    chatId: unixTSSchemaSpec,
    userMessage: z.string().min(1, { message: 'User message cannot be empty.' }).openapi({
      description: 'The latest message content from the user.',
      example: 'Thanks! Can you elaborate on the E=mc^2 part?'
    }),
    // ADD THIS FIELD:
    currentMessageAttachments: z
      .array(
        z.object({
          id: unixTSSchemaSpec.describe('ID of the pre-uploaded attachment.'),
          url: z.string().url().describe('Accessible URL of the attachment for the AI model.'),
          mimeType: z.string().describe('MIME type of the attachment.'),
          fileName: z.string().optional().describe('Original filename, if helpful for context.')
        })
      )
      .optional()
      .openapi({ description: 'Attachments specifically for the current user message being sent to the AI.' }),
    options: AiSdkOptionsSchema.optional().openapi({
      description: 'Optional parameters for the AI model.'
    }),
    systemMessage: z.string().optional().openapi({
      // Allows overriding system message for this turn
      example: 'Respond concisely.',
      description: 'Optional system message override for this specific request.'
    }),
    tempId: unixTSSchemaSpec.optional(),
    debug: z.boolean().optional().openapi({
      example: true,
      description: 'Enable debug mode for detailed logging.'
    })
    // 'messages' array is removed - history will be fetched using chatId
    // Fields related to SDK native structured output (schema, enumValues, etc.) are removed
    // but could be added back if needed for the streaming endpoint via `options`.
  })
  .openapi('AiChatStreamRequest')

export type CreateMessageBodyGeneric = {
  message: string
  chatId: number
  excludedMessageIds?: number[]
  tempId?: number
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
  },
  uploadFile: {
    params: UploadFileParamsSchema
  }
} as const

// Type exports
export type Chat = z.infer<typeof ChatSchema>
export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type ChatMessageAttachment = z.infer<typeof ChatMessageAttachmentSchema>
export type CreateChatBody = z.infer<typeof CreateChatBodySchema>
export type UpdateChatBody = z.infer<typeof UpdateChatBodySchema>
export type CreateChatMessageBody = z.infer<typeof CreateChatMessageBodySchema>
export type ExtendedChatMessage = ChatMessage & {
  tempId?: number
}
export type AiChatStreamRequest = z.infer<typeof AiChatStreamRequestSchema>
export type ForkChatRequestBody = z.infer<typeof ForkChatBodySchema>
