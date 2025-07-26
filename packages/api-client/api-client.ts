import { z } from 'zod'

// Import only the actual types we need (not response schemas)
import type { CreateChatBody, UpdateChatBody, AiChatStreamRequest, Chat, ChatMessage } from '@octoprompt/schemas'

import type { CreateProjectBody, Project, ProjectFile, UpdateProjectBody, ProjectStatistics } from '@octoprompt/schemas'

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
  FileResponseSchema as FileResponseSchemaZ,
  ProjectSummaryResponseSchema as ProjectSummaryResponseSchemaZ,
  ProjectFileWithoutContentListResponseSchema as ProjectFileWithoutContentListResponseSchemaZ,
  ProjectStatisticsResponseSchema as ProjectStatisticsResponseSchemaZ,
  CreateProjectBodySchema,
  UpdateProjectBodySchema,
  RefreshQuerySchema
} from '@octoprompt/schemas'

import {
  PromptResponseSchema as PromptResponseSchemaZ,
  PromptListResponseSchema as PromptListResponseSchemaZ,
  OptimizePromptResponseSchema as OptimizePromptResponseSchemaZ,
  SuggestPromptsRequestSchema,
  SuggestPromptsResponseSchema as SuggestPromptsResponseSchemaZ,
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

// Browse Directory imports
import type { BrowseDirectoryRequest, BrowseDirectoryResponse } from '@octoprompt/schemas'
import { BrowseDirectoryRequestSchema, BrowseDirectoryResponseSchema } from '@octoprompt/schemas'

// MCP imports
import type {
  CreateMCPServerConfigBody,
  UpdateMCPServerConfigBody,
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPResource,
  MCPToolExecutionRequest,
  MCPToolExecutionResult
} from '@octoprompt/schemas'
import {
  CreateMCPServerConfigBodySchema,
  UpdateMCPServerConfigBodySchema,
  MCPServerConfigResponseSchema,
  MCPServerConfigListResponseSchema,
  MCPToolListResponseSchema,
  MCPResourceListResponseSchema,
  MCPToolExecutionRequestSchema,
  MCPToolExecutionResultResponseSchema,
  MCPServerStateSchema
} from '@octoprompt/schemas'

// Ticket imports
import type {
  CreateTicketBody,
  UpdateTicketBody,
  CreateTaskBody,
  UpdateTaskBody,
  ReorderTasksBody,
  Ticket,
  TicketTask,
  TicketWithTasks,
  TicketWithTaskCount
} from '@octoprompt/schemas'
import {
  CreateTicketBodySchema,
  UpdateTicketBodySchema,
  CreateTaskBodySchema,
  UpdateTaskBodySchema,
  ReorderTasksBodySchema,
  TicketSchema,
  TicketTaskSchema,
  TicketWithTasksSchema,
  TicketWithTaskCountSchema,
  SuggestTasksBodySchema,
  TicketSuggestFilesBodySchema,
  SuggestFilesBodySchema
} from '@octoprompt/schemas'

// Git imports
import type {
  GitStatusResult,
  GetProjectGitStatusResponse,
  GitOperationResponse,
  GitDiffResponse,
  GitBranch,
  GitLogEntry,
  GitCommit,
  GitDiff,
  GitRemote,
  GitTag,
  GitStash,
  GitBlame,
  GitLogEnhancedRequest,
  GitLogEnhancedResponse,
  GitBranchListEnhancedResponse,
  GitCommitDetailResponse,
  GitWorktree,
  GitWorktreeListResponse,
  GitWorktreeAddRequest,
  GitWorktreeRemoveRequest,
  GitWorktreeLockRequest,
  GitWorktreePruneRequest,
  GitWorktreePruneResponse
} from '@octoprompt/schemas'

import {
  getProjectGitStatusResponseSchema,
  stageFilesRequestSchema,
  unstageFilesRequestSchema,
  gitOperationResponseSchema,
  gitDiffRequestSchema,
  gitDiffResponseSchema,
  gitBranchListResponseSchema,
  gitLogResponseSchema,
  gitCreateBranchRequestSchema,
  gitSwitchBranchRequestSchema,
  gitMergeBranchRequestSchema,
  gitPushRequestSchema,
  gitResetRequestSchema,
  gitCommitSchema,
  gitRemoteSchema,
  gitTagSchema,
  gitStashSchema,
  gitBlameSchema,
  gitLogEnhancedRequestSchema,
  gitLogEnhancedResponseSchema,
  gitBranchListEnhancedResponseSchema,
  gitCommitDetailResponseSchema,
  gitWorktreeListResponseSchema,
  gitWorktreeAddRequestSchema,
  gitWorktreeRemoveRequestSchema,
  gitWorktreeLockRequestSchema,
  gitWorktreePruneRequestSchema,
  gitWorktreePruneResponseSchema
} from '@octoprompt/schemas'

// MCP Analytics imports
import type {
  MCPExecutionQuery,
  MCPAnalyticsRequest,
  MCPAnalyticsOverview,
  MCPToolExecution,
  MCPToolStatistics,
  MCPExecutionTimeline,
  MCPToolPattern
} from '@octoprompt/schemas'

import {
  mcpExecutionQuerySchema,
  mcpAnalyticsRequestSchema,
  mcpAnalyticsOverviewSchema,
  mcpToolExecutionSchema,
  mcpToolStatisticsSchema,
  mcpExecutionTimelineSchema,
  mcpToolPatternSchema
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
  customFetch?: typeof fetch
}

// Base API client with common functionality
class BaseApiClient {
  protected baseUrl: string
  protected timeout: number
  protected headers: Record<string, string>
  protected customFetch: typeof fetch

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.timeout = config.timeout || 30000
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
    // Ensure fetch maintains its context
    if (config.customFetch) {
      // Wrap the custom fetch to ensure it maintains context
      this.customFetch = config.customFetch
    } else {
      // Bind default fetch to window context
      // @ts-ignore
      this.customFetch =
        typeof window !== 'undefined' && window.fetch
          ? // @ts-ignore
            window.fetch.bind(window)
          : fetch
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
      const response = await this.customFetch(url.toString(), {
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

  // Build query string from object
  protected buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    }
    const queryString = searchParams.toString()
    return queryString ? `?${queryString}` : ''
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

  // Get project files without content for performance optimization
  async getProjectFilesWithoutContent(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/files/metadata`, {
      responseSchema: ProjectFileWithoutContentListResponseSchemaZ
    })
    return result as DataResponseSchema<Omit<ProjectFile, 'content'>[]>
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
    return result as DataResponseSchema<ProjectFile>
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

  async suggestFiles(projectId: number, data: { prompt: string; limit?: number }) {
    const result = await this.request('POST', `/projects/${projectId}/suggest-files`, {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.array(z.unknown())
      })
    })
    return result as DataResponseSchema<ProjectFile[]>
  }

  async summarizeFiles(projectId: number, data: { fileIds: number[]; force?: boolean }) {
    const result = await this.request('POST', `/projects/${projectId}/files/summarize`, {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          included: z.number(),
          skipped: z.number(),
          updatedFiles: z.array(z.unknown())
        })
      })
    })
    return result as DataResponseSchema<{
      included: number
      skipped: number
      updatedFiles: ProjectFile[]
    }>
  }

  async removeSummariesFromFiles(projectId: number, data: { fileIds: number[] }) {
    const result = await this.request('POST', `/projects/${projectId}/files/remove-summaries`, {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          removedCount: z.number(),
          message: z.string()
        })
      })
    })
    return result as DataResponseSchema<{
      removedCount: number
      message: string
    }>
  }

  async getProjectStatistics(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/statistics`, {
      responseSchema: ProjectStatisticsResponseSchemaZ
    })
    return result as DataResponseSchema<ProjectStatistics>
  }

  // Active Tab methods
  async getActiveTab(projectId: number, clientId?: string) {
    const result = await this.request('GET', `/projects/${projectId}/active-tab`, {
      params: clientId ? { clientId } : undefined,
      responseSchema: z.object({
        success: z.literal(true),
        data: z
          .object({
            activeTabId: z.number(),
            lastUpdated: z.number(),
            clientId: z.string().optional(),
            tabMetadata: z
              .object({
                displayName: z.string().optional(),
                selectedFiles: z.array(z.number()).optional(),
                selectedPrompts: z.array(z.number()).optional(),
                userPrompt: z.string().optional(),
                fileSearch: z.string().optional(),
                contextLimit: z.number().optional(),
                preferredEditor: z.enum(['vscode', 'cursor', 'webstorm']).optional(),
                suggestedFileIds: z.array(z.number()).optional(),
                ticketSearch: z.string().optional(),
                ticketSort: z.enum(['created_asc', 'created_desc', 'status', 'priority']).optional(),
                ticketStatusFilter: z.enum(['all', 'open', 'in_progress', 'closed']).optional(),
                // Additional fields from ProjectTabState for complete synchronization
                searchByContent: z.boolean().optional(),
                resolveImports: z.boolean().optional(),
                bookmarkedFileGroups: z.record(z.string(), z.array(z.number())).optional(),
                sortOrder: z.number().optional(),
                promptsPanelCollapsed: z.boolean().optional(),
                selectedFilesCollapsed: z.boolean().optional()
              })
              .optional()
          })
          .nullable()
      })
    })
    return result
  }

  async setActiveTab(
    projectId: number,
    data: {
      tabId: number
      clientId?: string
      tabMetadata?: {
        displayName?: string
        selectedFiles?: number[]
        selectedPrompts?: number[]
        userPrompt?: string
        fileSearch?: string
        contextLimit?: number
        preferredEditor?: 'vscode' | 'cursor' | 'webstorm'
        suggestedFileIds?: number[]
        ticketSearch?: string
        ticketSort?: 'created_asc' | 'created_desc' | 'status' | 'priority'
        ticketStatusFilter?: 'all' | 'open' | 'in_progress' | 'closed'
        // Additional fields from ProjectTabState for complete synchronization
        searchByContent?: boolean
        resolveImports?: boolean
        bookmarkedFileGroups?: Record<string, number[]>
        sortOrder?: number
        promptsPanelCollapsed?: boolean
        selectedFilesCollapsed?: boolean
      }
    }
  ) {
    const result = await this.request('POST', `/projects/${projectId}/active-tab`, {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          activeTabId: z.number(),
          lastUpdated: z.number(),
          clientId: z.string().optional(),
          tabMetadata: z
            .object({
              displayName: z.string().optional(),
              selectedFiles: z.array(z.number()).optional(),
              selectedPrompts: z.array(z.number()).optional(),
              userPrompt: z.string().optional(),
              fileSearch: z.string().optional(),
              contextLimit: z.number().optional(),
              preferredEditor: z.enum(['vscode', 'cursor', 'webstorm']).optional(),
              suggestedFileIds: z.array(z.number()).optional(),
              ticketSearch: z.string().optional(),
              ticketSort: z.enum(['created_asc', 'created_desc', 'status', 'priority']).optional(),
              ticketStatusFilter: z.enum(['all', 'open', 'in_progress', 'closed']).optional(),
              // Additional fields from ProjectTabState for complete synchronization
              searchByContent: z.boolean().optional(),
              resolveImports: z.boolean().optional(),
              bookmarkedFileGroups: z.record(z.string(), z.array(z.number())).optional(),
              sortOrder: z.number().optional(),
              promptsPanelCollapsed: z.boolean().optional(),
              selectedFilesCollapsed: z.boolean().optional()
            })
            .optional()
        })
      })
    })
    return result
  }

  async clearActiveTab(projectId: number, clientId?: string) {
    const result = await this.request('DELETE', `/projects/${projectId}/active-tab`, {
      params: clientId ? { clientId } : undefined,
      responseSchema: z.object({
        success: z.literal(true),
        message: z.string()
      })
    })
    return result
  }

  async generateProjectTabName(tabId: number, data: {
    projectId: number
    tabData?: {
      selectedFiles?: number[]
      userPrompt?: string
    }
    existingNames?: string[]
  }) {
    const validatedData = this.validateBody(z.object({
      projectId: z.number(),
      tabData: z.object({
        selectedFiles: z.array(z.number()).optional(),
        userPrompt: z.string().optional()
      }).optional(),
      existingNames: z.array(z.string()).optional()
    }), data)
    
    const result = await this.request('POST', `/project-tabs/${tabId}/generate-name`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          name: z.string(),
          status: z.enum(['success', 'fallback']),
          generatedAt: z.string()
        })
      })
    })
    return result
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

  async suggestPrompts(projectId: number, data: { userInput: string; limit?: number }) {
    const validatedData = this.validateBody(SuggestPromptsRequestSchema, data)
    const result = await this.request('POST', `/projects/${projectId}/suggest-prompts`, {
      body: validatedData,
      responseSchema: SuggestPromptsResponseSchemaZ
    })
    return result as DataResponseSchema<{ prompts: Prompt[] }>
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
      const response = await this.customFetch(url.toString(), {
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

// System Service (for browsing directories, etc.)
export class SystemService extends BaseApiClient {
  async browseDirectory(data?: BrowseDirectoryRequest) {
    const validatedData = data ? this.validateBody(BrowseDirectoryRequestSchema, data) : {}
    const result = await this.request('POST', '/browse-directory', {
      body: validatedData,
      responseSchema: BrowseDirectoryResponseSchema
    })
    return result as BrowseDirectoryResponse
  }
}

// MCP Service
export class MCPService extends BaseApiClient {
  // MCP Server Config operations
  async createServerConfig(projectId: number, data: CreateMCPServerConfigBody) {
    const validatedData = this.validateBody(CreateMCPServerConfigBodySchema, data)
    const result = await this.request('POST', `/projects/${projectId}/mcp-servers`, {
      body: validatedData,
      responseSchema: MCPServerConfigResponseSchema
    })
    return result as DataResponseSchema<MCPServerConfig>
  }

  async listServerConfigs(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/mcp-servers`, {
      responseSchema: MCPServerConfigListResponseSchema
    })
    return result as DataResponseSchema<MCPServerConfig[]>
  }

  async getServerConfig(projectId: number, configId: number) {
    const result = await this.request('GET', `/projects/${projectId}/mcp-servers/${configId}`, {
      responseSchema: MCPServerConfigResponseSchema
    })
    return result as DataResponseSchema<MCPServerConfig>
  }

  async updateServerConfig(projectId: number, configId: number, data: UpdateMCPServerConfigBody) {
    const validatedData = this.validateBody(UpdateMCPServerConfigBodySchema, data)
    const result = await this.request('PATCH', `/projects/${projectId}/mcp-servers/${configId}`, {
      body: validatedData,
      responseSchema: MCPServerConfigResponseSchema
    })
    return result as DataResponseSchema<MCPServerConfig>
  }

  async deleteServerConfig(projectId: number, configId: number): Promise<boolean> {
    await this.request('DELETE', `/projects/${projectId}/mcp-servers/${configId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  // MCP Server Management operations
  async startServer(projectId: number, configId: number) {
    const result = await this.request('POST', `/projects/${projectId}/mcp-servers/${configId}/start`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: MCPServerStateSchema
      })
    })
    return result as DataResponseSchema<MCPServerState>
  }

  async stopServer(projectId: number, configId: number) {
    const result = await this.request('POST', `/projects/${projectId}/mcp-servers/${configId}/stop`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: MCPServerStateSchema
      })
    })
    return result as DataResponseSchema<MCPServerState>
  }

  async getServerState(projectId: number, configId: number) {
    const result = await this.request('GET', `/projects/${projectId}/mcp-servers/${configId}/state`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: MCPServerStateSchema
      })
    })
    return result as DataResponseSchema<MCPServerState>
  }

  // MCP Tool operations
  async listTools(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/mcp-tools`, {
      responseSchema: MCPToolListResponseSchema
    })
    return result as DataResponseSchema<MCPTool[]>
  }

  async executeTool(projectId: number, request: MCPToolExecutionRequest) {
    const validatedData = this.validateBody(MCPToolExecutionRequestSchema, request)
    const result = await this.request('POST', `/projects/${projectId}/mcp-tools/execute`, {
      body: validatedData,
      responseSchema: MCPToolExecutionResultResponseSchema
    })
    return result as DataResponseSchema<MCPToolExecutionResult>
  }

  // MCP Resource operations
  async listResources(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/mcp-resources`, {
      responseSchema: MCPResourceListResponseSchema
    })
    return result as DataResponseSchema<MCPResource[]>
  }

  async readResource(projectId: number, serverId: number, uri: string) {
    const result = await this.request('GET', `/projects/${projectId}/mcp-resources/${serverId}`, {
      params: { uri },
      responseSchema: z.object({
        success: z.boolean(),
        data: z.any()
      })
    })
    return result as DataResponseSchema<any>
  }

  // MCP Testing operations
  async testConnection(projectId: number, url: string) {
    const result = await this.request('POST', `/projects/${projectId}/mcp/test-connection`, {
      body: { url },
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          connected: z.boolean(),
          responseTime: z.number(),
          error: z.string().optional(),
          serverInfo: z.any().optional()
        })
      })
    })
    return result as DataResponseSchema<{
      connected: boolean
      responseTime: number
      error?: string
      serverInfo?: any
    }>
  }

  async testInitialize(projectId: number, url: string) {
    const result = await this.request('POST', `/projects/${projectId}/mcp/test-initialize`, {
      body: { url },
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          initialized: z.boolean(),
          sessionId: z.string().optional(),
          capabilities: z.any().optional(),
          serverInfo: z.any().optional(),
          error: z.string().optional()
        })
      })
    })
    return result as DataResponseSchema<{
      initialized: boolean
      sessionId?: string
      capabilities?: any
      serverInfo?: any
      error?: string
    }>
  }

  async testMethod(projectId: number, url: string, method: string, params: any, sessionId?: string) {
    const result = await this.request('POST', `/projects/${projectId}/mcp/test-method`, {
      body: { url, method, params, sessionId },
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          request: z.any(),
          response: z.any(),
          responseTime: z.number(),
          error: z.string().optional()
        })
      })
    })
    return result as DataResponseSchema<{
      request: any
      response: any
      responseTime: number
      error?: string
    }>
  }

  async getTestData(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/mcp/test-data`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          projectId: z.number(),
          projectName: z.string(),
          mcpEndpoints: z.object({
            main: z.string(),
            projectSpecific: z.string()
          }),
          sampleMethods: z.array(
            z.object({
              method: z.string(),
              description: z.string(),
              params: z.any(),
              example: z.any()
            })
          ),
          sampleFiles: z
            .array(
              z.object({
                path: z.string(),
                name: z.string(),
                id: z.number()
              })
            )
            .optional()
        })
      })
    })
    return result as DataResponseSchema<{
      projectId: number
      projectName: string
      mcpEndpoints: {
        main: string
        projectSpecific: string
      }
      sampleMethods: Array<{
        method: string
        description: string
        params: any
        example: any
      }>
      sampleFiles?: Array<{
        path: string
        name: string
        id: number
      }>
    }>
  }

  async getMCPSessions() {
    const result = await this.request('GET', '/mcp/sessions', {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(
          z.object({
            id: z.string(),
            projectId: z.number().optional(),
            createdAt: z.number(),
            lastActivity: z.number()
          })
        )
      })
    })
    return result as DataResponseSchema<
      Array<{
        id: string
        projectId?: number
        createdAt: number
        lastActivity: number
      }>
    >
  }

  async closeMCPSession(sessionId: string) {
    const result = await this.request('DELETE', `/mcp/sessions/${sessionId}`, {
      responseSchema: z.object({
        success: z.boolean()
      })
    })
    return result as { success: boolean }
  }
}

// Ticket Service
export class TicketService extends BaseApiClient {
  async listTickets(projectId: number, status?: string) {
    const params: Record<string, any> = {}
    if (status) params.status = status

    const result = await this.request('GET', `/projects/${projectId}/tickets`, {
      params,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketSchema)
      })
    })
    return result as DataResponseSchema<Ticket[]>
  }

  async createTicket(data: CreateTicketBody) {
    const validatedData = this.validateBody(CreateTicketBodySchema, data)
    const result = await this.request('POST', '/tickets', {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketSchema
      })
    })
    return result as DataResponseSchema<Ticket>
  }

  async getTicket(ticketId: number) {
    const result = await this.request('GET', `/tickets/${ticketId}`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketSchema
      })
    })
    return result as DataResponseSchema<Ticket>
  }

  async updateTicket(ticketId: number, data: UpdateTicketBody) {
    const validatedData = this.validateBody(UpdateTicketBodySchema, data)
    const result = await this.request('PATCH', `/tickets/${ticketId}`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketSchema
      })
    })
    return result as DataResponseSchema<Ticket>
  }

  async deleteTicket(ticketId: number): Promise<boolean> {
    await this.request('DELETE', `/tickets/${ticketId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  // Task operations
  async getTasks(ticketId: number) {
    const result = await this.request('GET', `/tickets/${ticketId}/tasks`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketTaskSchema)
      })
    })
    return result as DataResponseSchema<TicketTask[]>
  }

  async createTask(ticketId: number, data: CreateTaskBody) {
    const validatedData = this.validateBody(CreateTaskBodySchema, data)
    const result = await this.request('POST', `/tickets/${ticketId}/tasks`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketTaskSchema
      })
    })
    return result as DataResponseSchema<TicketTask>
  }

  async updateTask(ticketId: number, taskId: number, data: UpdateTaskBody) {
    const validatedData = this.validateBody(UpdateTaskBodySchema, data)
    const result = await this.request('PATCH', `/tickets/${ticketId}/tasks/${taskId}`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketTaskSchema
      })
    })
    return result as DataResponseSchema<TicketTask>
  }

  async deleteTask(ticketId: number, taskId: number): Promise<boolean> {
    await this.request('DELETE', `/tickets/${ticketId}/tasks/${taskId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  async reorderTasks(ticketId: number, data: ReorderTasksBody) {
    const validatedData = this.validateBody(ReorderTasksBodySchema, data)
    const result = await this.request('PATCH', `/tickets/${ticketId}/tasks/reorder`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketTaskSchema)
      })
    })
    return result as DataResponseSchema<TicketTask[]>
  }

  // AI-powered operations
  async suggestTasks(ticketId: number, userContext?: string) {
    const validatedData = this.validateBody(SuggestTasksBodySchema, { userContext })
    const result = await this.request('POST', `/tickets/${ticketId}/suggest-tasks`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          suggestedTasks: z.array(z.string())
        })
      })
    })
    return result as { success: boolean; data: { suggestedTasks: string[] } }
  }

  async autoGenerateTasks(ticketId: number) {
    const result = await this.request('POST', `/tickets/${ticketId}/auto-generate-tasks`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketTaskSchema)
      })
    })
    return result as DataResponseSchema<TicketTask[]>
  }

  async suggestFiles(ticketId: number, extraUserInput?: string) {
    const validatedData = this.validateBody(TicketSuggestFilesBodySchema, { extraUserInput })
    const result = await this.request('POST', `/tickets/${ticketId}/suggest-files`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          recommendedFileIds: z.array(z.string()),
          combinedSummaries: z.string().optional(),
          message: z.string().optional()
        })
      })
    })
    return result as {
      success: boolean
      data: {
        recommendedFileIds: string[]
        combinedSummaries?: string
        message?: string
      }
    }
  }

  // Bulk operations
  async getTicketsWithCounts(projectId: number, status?: string) {
    const params: Record<string, any> = {}
    if (status) params.status = status

    const result = await this.request('GET', `/projects/${projectId}/tickets-with-count`, {
      params,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketWithTaskCountSchema)
      })
    })
    return result as DataResponseSchema<TicketWithTaskCount[]>
  }

  async getTicketsWithTasks(projectId: number, status?: string) {
    const params: Record<string, any> = {}
    if (status) params.status = status

    const result = await this.request('GET', `/projects/${projectId}/tickets-with-tasks`, {
      params,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketWithTasksSchema)
      })
    })
    return result as DataResponseSchema<TicketWithTasks[]>
  }
}

// MCP Analytics Service
export class MCPAnalyticsService extends BaseApiClient {
  async getExecutions(projectId: number, query?: MCPExecutionQuery) {
    const result = await this.request('GET', `/projects/${projectId}/mcp/analytics/executions`, {
      params: query as any,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          executions: z.array(mcpToolExecutionSchema),
          total: z.number(),
          page: z.number(),
          pageSize: z.number()
        })
      })
    })
    return result as DataResponseSchema<{
      executions: MCPToolExecution[]
      total: number
      page: number
      pageSize: number
    }>
  }

  async getOverview(projectId: number, request?: MCPAnalyticsRequest) {
    const result = await this.request('POST', `/projects/${projectId}/mcp/analytics/overview`, {
      body: request || {},
      responseSchema: z.object({
        success: z.boolean(),
        data: mcpAnalyticsOverviewSchema
      })
    })
    return result as DataResponseSchema<MCPAnalyticsOverview>
  }

  async getStatistics(projectId: number, request?: MCPAnalyticsRequest) {
    const result = await this.request('POST', `/projects/${projectId}/mcp/analytics/statistics`, {
      body: request || {},
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(mcpToolStatisticsSchema)
      })
    })
    return result as DataResponseSchema<MCPToolStatistics[]>
  }

  async getTimeline(projectId: number, request?: MCPAnalyticsRequest) {
    const result = await this.request('POST', `/projects/${projectId}/mcp/analytics/timeline`, {
      body: request || {},
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(mcpExecutionTimelineSchema)
      })
    })
    return result as DataResponseSchema<MCPExecutionTimeline[]>
  }

  async getErrorPatterns(projectId: number, request?: MCPAnalyticsRequest) {
    const result = await this.request('POST', `/projects/${projectId}/mcp/analytics/error-patterns`, {
      body: request || {},
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(mcpToolPatternSchema)
      })
    })
    return result as DataResponseSchema<MCPToolPattern[]>
  }
}

// Git Service
export class GitService extends BaseApiClient {
  async getProjectGitStatus(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/git/status`, {
      responseSchema: getProjectGitStatusResponseSchema
    })
    return result as GetProjectGitStatusResponse
  }

  async stageFiles(projectId: number, filePaths: string[]) {
    const validatedData = this.validateBody(stageFilesRequestSchema, { filePaths })
    const result = await this.request('POST', `/projects/${projectId}/git/stage`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async unstageFiles(projectId: number, filePaths: string[]) {
    const validatedData = this.validateBody(unstageFilesRequestSchema, { filePaths })
    const result = await this.request('POST', `/projects/${projectId}/git/unstage`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async stageAll(projectId: number) {
    const result = await this.request('POST', `/projects/${projectId}/git/stage-all`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async unstageAll(projectId: number) {
    const result = await this.request('POST', `/projects/${projectId}/git/unstage-all`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async commitChanges(projectId: number, message: string) {
    const validatedData = this.validateBody(z.object({ message: z.string().min(1) }), { message })
    const result = await this.request('POST', `/projects/${projectId}/git/commit`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async getFileDiff(projectId: number, filePath: string, options?: { staged?: boolean; commit?: string }) {
    const queryParams = new URLSearchParams({ filePath })
    if (options?.staged) queryParams.append('staged', 'true')
    if (options?.commit) queryParams.append('commit', options.commit)

    const result = await this.request('GET', `/projects/${projectId}/git/diff?${queryParams}`, {
      responseSchema: gitDiffResponseSchema
    })
    return result as GitDiffResponse
  }

  // Branch Management
  async getBranches(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/git/branches`, {
      responseSchema: gitBranchListResponseSchema
    })
    return result as DataResponseSchema<GitBranch[]>
  }

  async createBranch(projectId: number, name: string, startPoint?: string) {
    const validatedData = this.validateBody(gitCreateBranchRequestSchema, { name, startPoint })
    const result = await this.request('POST', `/projects/${projectId}/git/branches`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async switchBranch(projectId: number, name: string) {
    const validatedData = this.validateBody(gitSwitchBranchRequestSchema, { name })
    const result = await this.request('POST', `/projects/${projectId}/git/branches/switch`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async deleteBranch(projectId: number, branchName: string, force?: boolean) {
    const result = await this.request('DELETE', `/projects/${projectId}/git/branches/${encodeURIComponent(branchName)}`, {
      params: force ? { force: 'true' } : undefined,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Commit History
  async getCommitLog(projectId: number, options?: { limit?: number; skip?: number; branch?: string; file?: string }) {
    const params: Record<string, any> = {}
    if (options?.limit) params.limit = options.limit
    if (options?.skip) params.skip = options.skip
    if (options?.branch) params.branch = options.branch
    if (options?.file) params.file = options.file

    const result = await this.request('GET', `/projects/${projectId}/git/log`, {
      params,
      responseSchema: gitLogResponseSchema
    })
    return result as DataResponseSchema<GitLogEntry[]> & { hasMore?: boolean }
  }

  // Remote Operations
  async getRemotes(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/git/remotes`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(gitRemoteSchema).optional(),
        message: z.string().optional()
      })
    })
    return result as DataResponseSchema<GitRemote[]>
  }

  async push(
    projectId: number,
    remote?: string,
    branch?: string,
    options?: { force?: boolean; setUpstream?: boolean }
  ) {
    const validatedData = this.validateBody(gitPushRequestSchema, {
      remote: remote || 'origin',
      branch,
      force: options?.force,
      setUpstream: options?.setUpstream
    })
    const result = await this.request('POST', `/projects/${projectId}/git/push`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async fetch(projectId: number, remote?: string, prune?: boolean) {
    const result = await this.request('POST', `/projects/${projectId}/git/fetch`, {
      body: { remote: remote || 'origin', prune },
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async pull(projectId: number, remote?: string, branch?: string, rebase?: boolean) {
    const result = await this.request('POST', `/projects/${projectId}/git/pull`, {
      body: { remote: remote || 'origin', branch, rebase },
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Tag Management
  async getTags(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/git/tags`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(gitTagSchema).optional(),
        message: z.string().optional()
      })
    })
    return result as DataResponseSchema<GitTag[]>
  }

  async createTag(projectId: number, name: string, options?: { message?: string; ref?: string }) {
    const result = await this.request('POST', `/projects/${projectId}/git/tags`, {
      body: { name, message: options?.message, ref: options?.ref },
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Stash Management
  async stash(projectId: number, message?: string) {
    const result = await this.request('POST', `/projects/${projectId}/git/stash`, {
      body: { message },
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async getStashList(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/git/stash`, {
      responseSchema: z.object({
        success: z.literal(true),
        data: z.array(gitStashSchema)
      })
    })
    return result as DataResponseSchema<GitStash[]>
  }

  async stashApply(projectId: number, ref: string = 'stash@{0}') {
    const result = await this.request('POST', `/projects/${projectId}/git/stash/${encodeURIComponent(ref)}/apply`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async stashPop(projectId: number, ref: string = 'stash@{0}') {
    const result = await this.request('POST', `/projects/${projectId}/git/stash/${encodeURIComponent(ref)}/pop`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  async stashDrop(projectId: number, ref: string = 'stash@{0}') {
    const result = await this.request('DELETE', `/projects/${projectId}/git/stash/${encodeURIComponent(ref)}`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Reset
  async reset(projectId: number, ref: string, mode?: 'soft' | 'mixed' | 'hard') {
    const validatedData = this.validateBody(gitResetRequestSchema, { ref, mode: mode || 'mixed' })
    const result = await this.request('POST', `/projects/${projectId}/git/reset`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Enhanced Git Methods
  async getCommitLogEnhanced(projectId: number, params?: GitLogEnhancedRequest) {
    const validatedParams = params ? this.validateBody(gitLogEnhancedRequestSchema, params) : undefined
    const result = await this.request('GET', `/projects/${projectId}/git/log/enhanced`, {
      params: validatedParams as any,
      responseSchema: gitLogEnhancedResponseSchema
    })
    return result as GitLogEnhancedResponse
  }

  async getBranchesEnhanced(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/git/branches/enhanced`, {
      responseSchema: gitBranchListEnhancedResponseSchema
    })
    return result as GitBranchListEnhancedResponse
  }

  async getCommitDetail(projectId: number, hash: string, includeFileContents?: boolean) {
    const result = await this.request('GET', `/projects/${projectId}/git/commits/${hash}`, {
      params: includeFileContents ? { includeFileContents } : undefined,
      responseSchema: gitCommitDetailResponseSchema
    })
    return result as GitCommitDetailResponse
  }

  // Worktree Management
  worktrees = {
    list: async (projectId: number) => {
      const result = await this.request('GET', `/projects/${projectId}/git/worktrees`, {
        responseSchema: gitWorktreeListResponseSchema
      })
      return result as GitWorktreeListResponse
    },

    add: async (projectId: number, params: GitWorktreeAddRequest) => {
      const validatedData = this.validateBody(gitWorktreeAddRequestSchema, params)
      const result = await this.request('POST', `/projects/${projectId}/git/worktrees`, {
        body: validatedData,
        responseSchema: gitOperationResponseSchema
      })
      return result as GitOperationResponse
    },

    remove: async (projectId: number, params: GitWorktreeRemoveRequest) => {
      const validatedData = this.validateBody(gitWorktreeRemoveRequestSchema, params)
      const result = await this.request('DELETE', `/projects/${projectId}/git/worktrees`, {
        body: validatedData,
        responseSchema: gitOperationResponseSchema
      })
      return result as GitOperationResponse
    },

    lock: async (projectId: number, params: GitWorktreeLockRequest) => {
      const validatedData = this.validateBody(gitWorktreeLockRequestSchema, params)
      const result = await this.request('POST', `/projects/${projectId}/git/worktrees/lock`, {
        body: validatedData,
        responseSchema: gitOperationResponseSchema
      })
      return result as GitOperationResponse
    },

    unlock: async (projectId: number, params: { path: string }) => {
      const validatedData = this.validateBody(z.object({ path: z.string() }), params)
      const result = await this.request('POST', `/projects/${projectId}/git/worktrees/unlock`, {
        body: validatedData,
        responseSchema: gitOperationResponseSchema
      })
      return result as GitOperationResponse
    },
    prune: async (projectId: number, params: { dryRun?: boolean } = {}) => {
      const validatedData = this.validateBody(gitWorktreePruneRequestSchema, params)
      const result = await this.request('POST', `/projects/${projectId}/git/worktrees/prune`, {
        body: validatedData,
        responseSchema: gitWorktreePruneResponseSchema
      })
      return result as GitWorktreePruneResponse
    }
  }
}

// Job Service
export class JobService extends BaseApiClient {
  async listJobs(filter?: any) {
    const result = await this.request('GET', '/jobs', {
      params: filter,
      responseSchema: z.object({
        success: z.boolean(),
        jobs: z.array(z.any())
      })
    })
    return result.jobs
  }

  async getJob(jobId: number) {
    const result = await this.request('GET', `/jobs/${jobId}`, {
      responseSchema: z.any()
    })
    return result
  }

  async getProjectJobs(projectId: number) {
    const result = await this.request('GET', `/jobs/project/${projectId}`, {
      responseSchema: z.object({
        success: z.boolean(),
        jobs: z.array(z.any())
      })
    })
    return result.jobs
  }

  async cancelJob(jobId: number) {
    const result = await this.request('POST', `/jobs/${jobId}/cancel`, {
      responseSchema: z.object({
        success: z.boolean()
      })
    })
    return result
  }

  async retryJob(jobId: number) {
    const result = await this.request('POST', `/jobs/${jobId}/retry`, {
      responseSchema: z.any()
    })
    return result
  }

  async cleanupJobs(olderThanDays?: number) {
    const result = await this.request('POST', '/jobs/cleanup', {
      body: { olderThanDays },
      responseSchema: z.object({
        success: z.boolean(),
        deletedCount: z.number(),
        message: z.string()
      })
    })
    return result
  }
}

// Main OctoPrompt Client
export class OctoPromptClient {
  public readonly chats: ChatService
  public readonly projects: ProjectService
  public readonly prompts: PromptService
  public readonly keys: ProviderKeyService
  public readonly genAi: GenAiService
  public readonly system: SystemService
  public readonly mcp: MCPService
  public readonly tickets: TicketService
  public readonly git: GitService
  public readonly mcpAnalytics: MCPAnalyticsService
  public readonly jobs: JobService

  constructor(config: ApiConfig) {
    this.chats = new ChatService(config)
    this.projects = new ProjectService(config)
    this.prompts = new PromptService(config)
    this.keys = new ProviderKeyService(config)
    this.genAi = new GenAiService(config)
    this.system = new SystemService(config)
    this.mcp = new MCPService(config)
    this.tickets = new TicketService(config)
    this.git = new GitService(config)
    this.mcpAnalytics = new MCPAnalyticsService(config)
    this.jobs = new JobService(config)
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
