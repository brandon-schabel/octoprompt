import { z } from 'zod'
import { BaseApiClient, PromptlianoError } from '../base-client'
import type { 
  CreateChatBody,
  UpdateChatBody,
  AiChatStreamRequest,
  Chat,
  ChatMessage,
  DataResponseSchema
} from '../types'

// Import response schemas
import {
  ChatResponseSchema as ChatResponseSchemaZ,
  ChatListResponseSchema as ChatListResponseSchemaZ,
  ChatMessagesListResponseSchema as ChatMessagesListResponseSchemaZ,
  CreateChatBodySchema,
  UpdateChatBodySchema,
  ForkChatBodySchema,
  ForkChatFromMessageBodySchema,
  AiChatStreamRequestSchema,
  OperationSuccessResponseSchema as OperationSuccessResponseSchemaZ
} from '@promptliano/schemas'

/**
 * Chat API client for managing chats, messages, and AI streaming
 */
export class ChatClient extends BaseApiClient {
  /**
   * List all chats
   */
  async listChats(): Promise<DataResponseSchema<Chat[]>> {
    const result = await this.request('GET', '/chats', { 
      responseSchema: ChatListResponseSchemaZ 
    })
    return result as DataResponseSchema<Chat[]>
  }

  /**
   * Create a new chat
   */
  async createChat(data: CreateChatBody): Promise<DataResponseSchema<Chat>> {
    const validatedData = this.validateBody(CreateChatBodySchema, data)
    const result = await this.request('POST', '/chats', {
      body: validatedData,
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  /**
   * Get a chat by ID
   */
  async getChat(chatId: number): Promise<DataResponseSchema<Chat>> {
    const result = await this.request('GET', `/chats/${chatId}`, {
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  /**
   * Update a chat
   */
  async updateChat(chatId: number, data: UpdateChatBody): Promise<DataResponseSchema<Chat>> {
    const validatedData = this.validateBody(UpdateChatBodySchema, data)
    const result = await this.request('PATCH', `/chats/${chatId}`, {
      body: validatedData,
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  /**
   * Delete a chat
   */
  async deleteChat(chatId: number): Promise<boolean> {
    await this.request('DELETE', `/chats/${chatId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  /**
   * Get all messages for a chat
   */
  async getMessages(chatId: number): Promise<DataResponseSchema<ChatMessage[]>> {
    const result = await this.request('GET', `/chats/${chatId}/messages`, {
      responseSchema: ChatMessagesListResponseSchemaZ
    })
    return result as DataResponseSchema<ChatMessage[]>
  }

  /**
   * Fork a chat to create a new conversation branch
   */
  async forkChat(chatId: number, data: z.infer<typeof ForkChatBodySchema>): Promise<DataResponseSchema<Chat>> {
    const validatedData = this.validateBody(ForkChatBodySchema, data)
    const result = await this.request('POST', `/chats/${chatId}/fork`, {
      body: validatedData,
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  /**
   * Fork a chat from a specific message
   */
  async forkChatFromMessage(
    chatId: number, 
    messageId: number, 
    data: z.infer<typeof ForkChatFromMessageBodySchema>
  ): Promise<DataResponseSchema<Chat>> {
    const validatedData = this.validateBody(ForkChatFromMessageBodySchema, data)
    const result = await this.request('POST', `/chats/${chatId}/fork/${messageId}`, {
      body: validatedData,
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  /**
   * Delete a specific message from a chat
   */
  async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    await this.request('DELETE', `/chats/${chatId}/messages/${messageId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  /**
   * Stream AI chat response - returns ReadableStream for processing chunks
   */
  async streamChat(data: AiChatStreamRequest): Promise<ReadableStream> {
    const validatedData = this.validateBody(AiChatStreamRequestSchema, data)
    const url = this.baseUrl
      ? new URL('/api/ai/chat', this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/')
      : new URL('/api/ai/chat', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3579')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await this.customFetch(url.toString(), {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(validatedData),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: any
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          throw new PromptlianoError(`Stream request failed: ${response.status}`, response.status)
        }

        if (errorData?.error) {
          throw new PromptlianoError(
            errorData.error.message || 'Stream request failed',
            response.status,
            errorData.error.code,
            errorData.error.details
          )
        }
        throw new PromptlianoError(`Stream request failed: ${response.status}`, response.status)
      }

      if (!response.body) {
        throw new PromptlianoError('No response body for stream')
      }

      return response.body
    } catch (e) {
      if (e instanceof PromptlianoError) throw e
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new PromptlianoError('Stream request timeout', undefined, 'TIMEOUT')
        }
        throw new PromptlianoError(`Stream request failed: ${e.message}`)
      }
      throw new PromptlianoError('Unknown error occurred during stream request')
    }
  }
}