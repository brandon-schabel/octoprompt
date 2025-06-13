import { z } from 'zod'

// Import only the actual types we need (not response schemas)
import type {
  CreateChatBody,
  UpdateChatBody,
  AiChatStreamRequest,
  Chat,
  ChatMessage,
  FileVersion
} from '@octoprompt/schemas'

import type { CreateProjectBody, Project, ProjectFile, UpdateProjectBody } from '@octoprompt/schemas'

import type { CreatePromptBody, UpdatePromptBody, OptimizePromptRequest, Prompt } from '@octoprompt/schemas'

import type { CreateProviderKeyBody, ProviderKey, UpdateProviderKeyBody } from '@octoprompt/schemas'

// Import the actual schemas for validation
import {
  ChatResponseSchema as ChatResponseSchemaZ,
  ChatListResponseSchema as ChatListResponseSchemaZ,
  ChatMessagesListResponseSchema as ChatMessagesListResponseSchemaZ,
  CreateChatBodySchema,
  UpdateChatBodySchema,
  ForkChatBodySchema,
  ForkChatFromMessageBodySchema,
  AiChatStreamRequestSchema
} from '@octoprompt/schemas'

import {
  ProjectResponseSchema as ProjectResponseSchemaZ,
  ProjectListResponseSchema as ProjectListResponseSchemaZ,
  FileListResponseSchema as FileListResponseSchemaZ,
  ProjectSummaryResponseSchema as ProjectSummaryResponseSchemaZ,
  CreateProjectBodySchema,
  UpdateProjectBodySchema,
  RefreshQuerySchema,
  FileVersionListResponseSchema,
  RevertToVersionBodySchema
} from '@octoprompt/schemas'

import {
  PromptResponseSchema as PromptResponseSchemaZ,
  PromptListResponseSchema as PromptListResponseSchemaZ,
  OptimizePromptResponseSchema as OptimizePromptResponseSchemaZ,
  CreatePromptBodySchema,
  UpdatePromptBodySchema,
  OptimizeUserInputRequestSchema
} from '@octoprompt/schemas'

import {
  ProviderKeyResponseSchema as ProviderKeyResponseSchemaZ,
  ProviderKeyListResponseSchema as ProviderKeyListResponseSchemaZ,
  CreateProviderKeyBodySchema,
  UpdateProviderKeyBodySchema
} from '@octoprompt/schemas'

import {
  OperationSuccessResponseSchema as OperationSuccessResponseSchemaZ,
  ApiErrorResponseSchema as ApiErrorResponseSchemaZ
} from '@octoprompt/schemas'

import {
  AiGenerateTextRequestSchema,
  AiGenerateTextResponseSchema,
  AiGenerateStructuredRequestSchema,
  AiGenerateStructuredResponseSchema,
  ModelsListResponseSchema,
  type AiGenerateTextRequest,
  type UnifiedModel
} from '@octoprompt/schemas'


export type DataResponseSchema<T> = {
  success: boolean
  data: T
}

// Custom error class for API errors
export class OctoPromptError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'OctoPromptError'
  }
}

// Type for API configuration
interface ApiConfig {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
}

// Base API client with common functionality
class BaseApiClient {
  protected baseUrl: string
  protected timeout: number
  protected headers: Record<string, string>

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.timeout = config.timeout || 30000
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
  }

  protected async request<TResponse>(
    method: string,
    endpoint: string,
    options?: {
      body?: unknown
      params?: Record<string, string | number | boolean>
      responseSchema?: z.ZodType<TResponse>
      skipValidation?: boolean
    }
  ): Promise<TResponse> {
    const url = new URL(`${this.baseUrl}/api${endpoint}`)

    // Add query parameters
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: this.headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const responseText = await response.text()
      let responseData: any

      try {
        responseData = JSON.parse(responseText)
      } catch (e) {
        throw new OctoPromptError(`Invalid JSON response: ${responseText}`, response.status)
      }

      // Handle error responses
      if (!response.ok) {
        if (responseData?.error) {
          throw new OctoPromptError(
            responseData.error.message || 'Unknown error',
            response.status,
            responseData.error.code,
            responseData.error.details
          )
        }
        throw new OctoPromptError(`HTTP ${response.status}: ${response.statusText}`, response.status)
      }

      // Validate response if schema provided
      if (options?.responseSchema && !options.skipValidation) {
        try {
          return options.responseSchema.parse(responseData)
        } catch (e) {
          if (e instanceof z.ZodError) {
            throw new OctoPromptError(
              `Response validation failed: ${e.message}`,
              undefined,
              'VALIDATION_ERROR',
              e.errors
            )
          }
          throw e
        }
      }

      return responseData as TResponse
    } catch (e) {
      if (e instanceof OctoPromptError) throw e
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new OctoPromptError('Request timeout', undefined, 'TIMEOUT')
        }
        throw new OctoPromptError(`Request failed: ${e.message}`)
      }
      throw new OctoPromptError('Unknown error occurred')
    }
  }

  // Validate request body against schema
  protected validateBody<T>(schema: z.ZodType<T>, data: unknown): T {
    try {
      return schema.parse(data)
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new OctoPromptError(`Request validation failed: ${e.message}`, undefined, 'VALIDATION_ERROR', e.errors)
      }
      throw e
    }
  }
}

// Chat Service
export class ChatService extends BaseApiClient {
  async listChats() {
    const result = await this.request('GET', '/chats', { responseSchema: ChatListResponseSchemaZ })
    return result as DataResponseSchema<Chat[]>
  }

  async createChat(data: CreateChatBody) {
    const validatedData = this.validateBody(CreateChatBodySchema, data)
    const result = await this.request('POST', '/chats', {
      body: validatedData,
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  async getChat(chatId: number) {
    const result = await this.request('GET', `/chats/${chatId}`, {
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  async updateChat(chatId: number, data: UpdateChatBody) {
    const validatedData = this.validateBody(UpdateChatBodySchema, data)
    const result = await this.request('PATCH', `/chats/${chatId}`, {
      body: validatedData,
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  async deleteChat(chatId: number): Promise<boolean> {
    await this.request('DELETE', `/chats/${chatId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  async getMessages(chatId: number) {
    const result = await this.request('GET', `/chats/${chatId}/messages`, {
      responseSchema: ChatMessagesListResponseSchemaZ
    })
    return result as DataResponseSchema<ChatMessage[]>
  }

  async forkChat(chatId: number, data: z.infer<typeof ForkChatBodySchema>) {
    const validatedData = this.validateBody(ForkChatBodySchema, data)
    const result = await this.request('POST', `/chats/${chatId}/fork`, {
      body: validatedData,
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  async forkChatFromMessage(chatId: number, messageId: number, data: z.infer<typeof ForkChatFromMessageBodySchema>) {
    const validatedData = this.validateBody(ForkChatFromMessageBodySchema, data)
    const result = await this.request('POST', `/chats/${chatId}/fork/${messageId}`, {
      body: validatedData,
      responseSchema: ChatResponseSchemaZ
    })
    return result as DataResponseSchema<Chat>
  }

  async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    await this.request('DELETE', `/chats/${chatId}/messages/${messageId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  // Streaming endpoint - returns ReadableStream
  async streamChat(data: AiChatStreamRequest): Promise<ReadableStream> {
    const validatedData = this.validateBody(AiChatStreamRequestSchema, data)
    const url = new URL(`${this.baseUrl}/api/ai/chat`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
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
          throw new OctoPromptError(`Stream request failed: ${response.status}`, response.status)
        }

        if (errorData?.error) {
          throw new OctoPromptError(
            errorData.error.message || 'Stream request failed',
            response.status,
            errorData.error.code,
            errorData.error.details
          )
        }
        throw new OctoPromptError(`Stream request failed: ${response.status}`, response.status)
      }

      if (!response.body) {
        throw new OctoPromptError('No response body for stream')
      }

      return response.body
    } catch (e) {
      if (e instanceof OctoPromptError) throw e
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new OctoPromptError('Stream request timeout', undefined, 'TIMEOUT')
        }
        throw new OctoPromptError(`Stream request failed: ${e.message}`)
      }
      throw new OctoPromptError('Unknown error occurred during stream request')
    }
  }
}

// Project Service
export class ProjectService extends BaseApiClient {
  async listProjects() {
    const result = await this.request('GET', '/projects', {
      responseSchema: ProjectListResponseSchemaZ
    })
    return result as DataResponseSchema<Project[]>
  }

  async createProject(data: CreateProjectBody) {
    const validatedData = this.validateBody(CreateProjectBodySchema, data)
    const result = await this.request('POST', '/projects', {
      body: validatedData,
      responseSchema: ProjectResponseSchemaZ
    })
    return result as DataResponseSchema<Project>
  }

  async getProject(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}`, {
      responseSchema: ProjectResponseSchemaZ
    })
    return result as DataResponseSchema<Project>
  }

  async updateProject(projectId: number, data: UpdateProjectBody): Promise<DataResponseSchema<Project>> {
    const validatedData = this.validateBody(UpdateProjectBodySchema, data)
    const result = await this.request('PATCH', `/projects/${projectId}`, {
      body: validatedData,
      responseSchema: ProjectResponseSchemaZ
    })
    return result as DataResponseSchema<Project>
  }

  async deleteProject(projectId: number): Promise<boolean> {
    await this.request('DELETE', `/projects/${projectId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  async syncProject(projectId: number): Promise<boolean> {
    await this.request('POST', `/projects/${projectId}/sync`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  async getProjectFiles(projectId: number, includeAllVersions: boolean = false) {
    const result = await this.request('GET', `/projects/${projectId}/files`, {
      params: { includeAllVersions },
      responseSchema: FileListResponseSchemaZ
    })
    return result as DataResponseSchema<ProjectFile[]>
  }

  // NEW: Get project files without content for performance optimization
  async getProjectFilesWithoutContent(projectId: number, includeAllVersions: boolean = false) {
    const result = await this.request('GET', `/projects/${projectId}/files/metadata`, {
      params: { includeAllVersions },
      responseSchema: FileListResponseSchemaZ
    })
    return result as DataResponseSchema<Omit<ProjectFile, 'content'>[]>
  }

  // NEW: File versioning methods
  async getFileVersions(projectId: number, originalFileId: number) {
    const result = await this.request('GET', `/projects/${projectId}/files/${originalFileId}/versions`, {
      responseSchema: FileVersionListResponseSchema
    })
    return result as DataResponseSchema<FileVersion[]>
  }

  async getFileVersion(projectId: number, originalFileId: number, version?: number) {
    const params = version ? { version } : undefined
    const result = await this.request('GET', `/projects/${projectId}/files/${originalFileId}/version`, {
      params,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result as DataResponseSchema<ProjectFile>
  }

  async revertFileToVersion(projectId: number, fileId: number, targetVersion: number) {
    const validatedData = this.validateBody(RevertToVersionBodySchema, { version: targetVersion })
    const result = await this.request('POST', `/projects/${projectId}/files/${fileId}/revert`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result as DataResponseSchema<ProjectFile>
  }

  async refreshProject(projectId: number, query?: z.infer<typeof RefreshQuerySchema>) {
    const result = await this.request('POST', `/projects/${projectId}/refresh`, {
      params: query,
      responseSchema: FileListResponseSchemaZ
    })
    return result as DataResponseSchema<ProjectFile[]>
  }

  async getProjectSummary(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/summary`, {
      responseSchema: ProjectSummaryResponseSchemaZ
    })
    return result as {
      summary: string
      success: boolean
    }
  }







  async updateFileContent(projectId: number, fileId: number, content: string) {
    const result = await this.request('PUT', `/projects/${projectId}/files/${fileId}`, {
      body: { content },
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result
  }
  async bulkCreateFiles(
    projectId: number,
    files: Array<{
      path: string
      name: string
      extension: string
      content: string
      size: number
      checksum?: string
    }>
  ) {
    const result = await this.request('POST', `/projects/${projectId}/files/bulk`, {
      body: { files },
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result.data
  }

  async bulkUpdateFiles(projectId: number, updates: Array<{ fileId: number; content: string }>) {
    const result = await this.request('PUT', `/projects/${projectId}/files/bulk`, {
      body: { updates },
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result.data
  }
}

// Prompt Service
export class PromptService extends BaseApiClient {
  async listPrompts() {
    const result = await this.request('GET', '/prompts', {
      responseSchema: PromptListResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt[]>
  }

  async createPrompt(data: CreatePromptBody) {
    const validatedData = this.validateBody(CreatePromptBodySchema, data)
    const result = await this.request('POST', '/prompts', {
      body: validatedData,
      responseSchema: PromptResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt>
  }

  async getPrompt(promptId: number) {
    const result = await this.request('GET', `/prompts/${promptId}`, {
      responseSchema: PromptResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt>
  }

  async updatePrompt(promptId: number, data: UpdatePromptBody) {
    const validatedData = this.validateBody(UpdatePromptBodySchema, data)
    const result = await this.request('PATCH', `/prompts/${promptId}`, {
      body: validatedData,
      responseSchema: PromptResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt>
  }

  async deletePrompt(promptId: number): Promise<boolean> {
    await this.request('DELETE', `/prompts/${promptId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  async listProjectPrompts(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/prompts`, {
      responseSchema: PromptListResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt[]>
  }

  async addPromptToProject(projectId: number, promptId: number): Promise<boolean> {
    await this.request('POST', `/projects/${projectId}/prompts/${promptId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  async removePromptFromProject(projectId: number, promptId: number): Promise<boolean> {
    await this.request('DELETE', `/projects/${projectId}/prompts/${promptId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  async optimizeUserInput(data: OptimizePromptRequest) {
    const validatedData = this.validateBody(OptimizeUserInputRequestSchema, data)
    const result = await this.request('POST', '/prompt/optimize', {
      body: validatedData,
      responseSchema: OptimizePromptResponseSchemaZ
    })
    return result as DataResponseSchema<{ optimizedPrompt: string }>
  }
}

// Provider Key Service
export class ProviderKeyService extends BaseApiClient {
  async listKeys() {
    const result = await this.request('GET', '/keys', {
      responseSchema: ProviderKeyListResponseSchemaZ
    })
    return result as DataResponseSchema<ProviderKey[]>
  }

  async createKey(data: CreateProviderKeyBody) {
    const validatedData = this.validateBody(CreateProviderKeyBodySchema, data)
    const result = await this.request('POST', '/keys', {
      body: validatedData,
      responseSchema: ProviderKeyResponseSchemaZ
    })
    return result as DataResponseSchema<ProviderKey>
  }

  async getKey(keyId: number) {
    const result = await this.request('GET', `/keys/${keyId}`, {
      responseSchema: ProviderKeyResponseSchemaZ
    })
    return result as DataResponseSchema<ProviderKey>
  }

  async updateKey(keyId: number, data: UpdateProviderKeyBody) {
    const validatedData = this.validateBody(UpdateProviderKeyBodySchema, data)
    const result = await this.request('PATCH', `/keys/${keyId}`, {
      body: validatedData,
      responseSchema: ProviderKeyResponseSchemaZ
    })
    return result as DataResponseSchema<ProviderKey>
  }

  async deleteKey(keyId: number): Promise<boolean> {
    await this.request('DELETE', `/keys/${keyId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }
}

// Gen AI Service
export class GenAiService extends BaseApiClient {
  async generateText(data: AiGenerateTextRequest) {
    const validatedData = this.validateBody(AiGenerateTextRequestSchema, data)
    const result = await this.request('POST', '/gen-ai/text', {
      body: validatedData,
      responseSchema: AiGenerateTextResponseSchema
    })
    return result as { success: true; data: { text: string } }
  }

  async generateStructured(data: z.infer<typeof AiGenerateStructuredRequestSchema>) {
    const validatedData = this.validateBody(AiGenerateStructuredRequestSchema, data)
    const result = await this.request('POST', '/gen-ai/structured', {
      body: validatedData,
      responseSchema: AiGenerateStructuredResponseSchema
    })
    return result as { success: true; data: { output: any } }
  }

  async getModels(provider: string) {
    const result = await this.request('GET', '/models', {
      params: { provider },
      responseSchema: ModelsListResponseSchema
    })

    return result as { success: true; data: UnifiedModel[] }
  }

  async streamText(data: AiGenerateTextRequest): Promise<ReadableStream> {
    const validatedData = this.validateBody(AiGenerateTextRequestSchema, data)
    const url = new URL(`${this.baseUrl}/api/gen-ai/stream`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(validatedData),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new OctoPromptError(`Stream request failed: ${response.status}`, response.status)
      }

      if (!response.body) {
        throw new OctoPromptError('No response body for stream')
      }

      return response.body
    } catch (e) {
      if (e instanceof OctoPromptError) throw e
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new OctoPromptError('Stream request timeout', undefined, 'TIMEOUT')
        }
        throw new OctoPromptError(`Stream request failed: ${e.message}`)
      }
      throw new OctoPromptError('Unknown error occurred during stream request')
    }
  }
}

// Mastra Service removed - functionality consolidated into Claude Code

// Main OctoPrompt Client
export class OctoPromptClient {
  public readonly chats: ChatService
  public readonly projects: ProjectService
  public readonly prompts: PromptService
  public readonly keys: ProviderKeyService
  public readonly genAi: GenAiService

  constructor(config: ApiConfig) {
    this.chats = new ChatService(config)
    this.projects = new ProjectService(config)
    this.prompts = new PromptService(config)
    this.keys = new ProviderKeyService(config)
    this.genAi = new GenAiService(config)
  }
}

// Factory function for creating client
export function createOctoPromptClient(config: ApiConfig): OctoPromptClient {
  return new OctoPromptClient(config)
}

// Example usage:
/*
const client = createOctoPromptClient({
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Authorization': 'Bearer your-token-here'
  }
})

// All methods are type-safe and validate payloads
try {
  // Create a project with type-safe data
  const project = await client.projects.createProject({
    name: 'My Project',
    path: '/path/to/project',
    description: 'Optional description'
  })

  // Get project files
  const files = await client.projects.getProjectFiles(project.id)

  // Create a chat
  const chat = await client.chats.createChat({
    title: 'New Chat Session'
  })

  // Send a streaming message
  const stream = await client.chats.streamChat({
    chatId: chat.id,
    userMessage: 'Hello, AI!',
    options: {
      temperature: 0.7,
      maxTokens: 1000
    }
  })

  // Handle stream response
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // Process chunk
    console.log(new TextDecoder().decode(value))
  }

} catch (error) {
  if (error instanceof OctoPromptError) {
    console.error('API Error:', error.message)
    console.error('Status:', error.statusCode)
    console.error('Error Code:', error.errorCode)
    console.error('Details:', error.details)
  }
}
*/
