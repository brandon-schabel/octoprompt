import { z } from 'zod'

// Import only the actual types we need (not response schemas)
import type {
    CreateChatBody, UpdateChatBody, AiChatStreamRequest,
    Chat,
    ChatMessage
} from 'shared/src/schemas/chat.schemas'

import type {
    CreateProjectBody, Project, ProjectFile, UpdateProjectBody
} from 'shared/src/schemas/project.schemas'

import type {
    CreatePromptBody, UpdatePromptBody, OptimizePromptRequest,
    Prompt
} from 'shared/src/schemas/prompt.schemas'

import type {
    CreateProviderKeyBody, ProviderKey, UpdateProviderKeyBody
} from 'shared/src/schemas/provider-key.schemas'

import type {
    CreateTicketBody, UpdateTicketBody,
    CreateTaskBody, UpdateTaskBody, ReorderTasksBody,
    Ticket,
    TicketTask,
    TicketWithTaskCount,
    TicketWithTasks
} from 'shared/src/schemas/ticket.schemas'

// Import the actual schemas for validation
import {
    ChatResponseSchema as ChatResponseSchemaZ,
    ChatListResponseSchema as ChatListResponseSchemaZ,
    ChatMessagesListResponseSchema as ChatMessagesListResponseSchemaZ,
    CreateChatBodySchema, UpdateChatBodySchema, ForkChatBodySchema,
    ForkChatFromMessageBodySchema, AiChatStreamRequestSchema
} from 'shared/src/schemas/chat.schemas'

import {
    ProjectResponseSchema as ProjectResponseSchemaZ,
    ProjectListResponseSchema as ProjectListResponseSchemaZ,
    FileListResponseSchema as FileListResponseSchemaZ,
    ProjectSummaryResponseSchema as ProjectSummaryResponseSchemaZ,
    CreateProjectBodySchema, UpdateProjectBodySchema,
    SummarizeFilesBodySchema, RemoveSummariesBodySchema,
    SuggestFilesBodySchema, RefreshQuerySchema
} from 'shared/src/schemas/project.schemas'

import {
    PromptResponseSchema as PromptResponseSchemaZ,
    PromptListResponseSchema as PromptListResponseSchemaZ,
    OptimizePromptResponseSchema as OptimizePromptResponseSchemaZ,
    CreatePromptBodySchema, UpdatePromptBodySchema,
    OptimizeUserInputRequestSchema
} from 'shared/src/schemas/prompt.schemas'

import {
    ProviderKeyResponseSchema as ProviderKeyResponseSchemaZ,
    ProviderKeyListResponseSchema as ProviderKeyListResponseSchemaZ,
    CreateProviderKeyBodySchema, UpdateProviderKeyBodySchema
} from 'shared/src/schemas/provider-key.schemas'

import {
    TicketResponseSchema as TicketResponseSchemaZ,
    TicketListResponseSchema as TicketListResponseSchemaZ,
    TaskResponseSchema as TaskResponseSchemaZ,
    TaskListResponseSchema as TaskListResponseSchemaZ,
    LinkedFilesResponseSchema as LinkedFilesResponseSchemaZ,
    SuggestedTasksResponseSchema as SuggestedTasksResponseSchemaZ,
    SuggestedFilesResponseSchema as SuggestedFilesResponseSchemaZ,
    TicketWithTaskCountListResponseSchema as TicketWithTaskCountListResponseSchemaZ,
    TicketWithTasksListResponseSchema as TicketWithTasksListResponseSchemaZ,
    BulkTasksResponseSchema as BulkTasksResponseSchemaZ,
    CreateTicketBodySchema, UpdateTicketBodySchema,
    createTaskSchema, updateTaskSchema, reorderTasksSchema,
    linkFilesSchema, suggestTasksSchema
} from 'shared/src/schemas/ticket.schemas'

import {
    OperationSuccessResponseSchema as OperationSuccessResponseSchemaZ,
    ApiErrorResponseSchema as ApiErrorResponseSchemaZ
} from 'shared/src/schemas/common.schemas'

import {
    SuggestFilesResponseSchema as SuggestFilesResponseSchemaZ,
    SummarizeFilesResponseSchema as SummarizeFilesResponseSchemaZ,
    RemoveSummariesResponseSchema as RemoveSummariesResponseSchemaZ
} from 'shared/src/schemas/gen-ai.schemas'

// Import schemas and types for the new services
import {
    AgentCoderRunRequestSchema,
    AgentCoderRunResponseSchema,
    AgentDataLogSchema,
    type AgentCoderRunRequest,
    type AgentCoderRunResponse,
    type AgentDataLog
} from 'shared/src/schemas/agent-coder.schemas'

import {
    AIFileChangeRecordSchema,
    GenerateChangeBodySchema,
    type AIFileChangeRecord,
    type GenerateChangeBody
} from 'shared/src/schemas/ai-file-change.schemas'

import {
    AiGenerateTextRequestSchema,
    AiGenerateTextResponseSchema,
    AiGenerateStructuredRequestSchema,
    AiGenerateStructuredResponseSchema,
    ModelsListResponseSchema,
    type AiGenerateTextRequest,
    type UnifiedModel
} from 'shared/src/schemas/gen-ai.schemas'

// Admin schemas - local definitions since they may not be exported from admin routes
const AdminEnvInfoResponseSchema = z.object({
    success: z.literal(true),
    environment: z.object({
        NODE_ENV: z.string().nullable(),
        BUN_ENV: z.string().nullable(),
        SERVER_PORT: z.string().nullable()
    }),
    serverInfo: z.object({
        version: z.string(),
        bunVersion: z.string(),
        platform: z.string(),
        arch: z.string(),
        memoryUsage: z.object({
            rss: z.number(),
            heapTotal: z.number(),
            heapUsed: z.number(),
            external: z.number(),
            arrayBuffers: z.number()
        }),
        uptime: z.number()
    }),
    databaseStats: z.object({
        chats: z.object({ count: z.number() }),
        chat_messages: z.object({ count: z.number() }),
        projects: z.object({ count: z.number() }),
        files: z.object({ count: z.number() }),
        prompts: z.object({ count: z.number() }),
        prompt_projects: z.object({ count: z.number() }),
        provider_keys: z.object({ count: z.number() }),
        tickets: z.object({ count: z.number() }),
        ticket_files: z.object({ count: z.number() }),
        ticket_tasks: z.object({ count: z.number() }),
        file_changes: z.object({ count: z.number() })
    })
})

const AdminSystemStatusResponseSchema = z.object({
    success: z.literal(true),
    status: z.string(),
    checks: z.object({
        api: z.string(),
        timestamp: z.string()
    })
})

export type DataResponseSchema<T> = {
    success: boolean,
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
                throw new OctoPromptError(
                    `Invalid JSON response: ${responseText}`,
                    response.status
                )
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
                throw new OctoPromptError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status
                )
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
                throw new OctoPromptError(
                    `Request validation failed: ${e.message}`,
                    undefined,
                    'VALIDATION_ERROR',
                    e.errors
                )
            }
            throw e
        }
    }
}

// Chat Service
export class ChatService extends BaseApiClient {
    async listChats() {
        const result = await this.request(
            'GET',
            '/chats',
            { responseSchema: ChatListResponseSchemaZ }
        )
        return result as DataResponseSchema<Chat[]>
    }

    // TODO: adjust the apis to use the new 3 params setup
    async createChat(data: CreateChatBody) {
        const validatedData = this.validateBody(CreateChatBodySchema, data)
        const result = await this.request("POST", '/chats', {
            body: validatedData,
            responseSchema: ChatResponseSchemaZ
        })
        return result as DataResponseSchema<Chat>
    }

    async getChat(chatId: number) {
        const result = await this.request("GET", `/chats/${chatId}`, {
            responseSchema: ChatResponseSchemaZ
        })
        return result as DataResponseSchema<Chat>
    }

    async updateChat(chatId: number, data: UpdateChatBody) {
        const validatedData = this.validateBody(UpdateChatBodySchema, data)
        const result = await this.request("PATCH", `/chats/${chatId}`, {
            body: validatedData,
            responseSchema: ChatResponseSchemaZ
        })
        return result as DataResponseSchema<Chat>
    }

    async deleteChat(chatId: number): Promise<boolean> {
        await this.request("DELETE", `/chats/${chatId}`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }

    async getMessages(chatId: number) {
        const result = await this.request("GET", `/chats/${chatId}/messages`, {
            responseSchema: ChatMessagesListResponseSchemaZ
        })
        return result as DataResponseSchema<ChatMessage[]>
    }

    async forkChat(chatId: number, data: z.infer<typeof ForkChatBodySchema>) {
        const validatedData = this.validateBody(ForkChatBodySchema, data)
        const result = await this.request("POST", `/chats/${chatId}/fork`, {
            body: validatedData,
            responseSchema: ChatResponseSchemaZ
        })
        return result as DataResponseSchema<Chat>
    }

    async forkChatFromMessage(
        chatId: number,
        messageId: number,
        data: z.infer<typeof ForkChatFromMessageBodySchema>
    ) {
        const validatedData = this.validateBody(ForkChatFromMessageBodySchema, data)
        const result = await this.request("POST", `/chats/${chatId}/fork/${messageId}`, {
            body: validatedData,
            responseSchema: ChatResponseSchemaZ
        })
        return result as DataResponseSchema<Chat>
    }

    async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
        await this.request("DELETE", `/chats/${chatId}/messages/${messageId}`, {
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

type SummarizeFilesResponse = z.infer<typeof SummarizeFilesResponseSchemaZ>

// Project Service
export class ProjectService extends BaseApiClient {
    async listProjects() {
        const result = await this.request("GET", "/projects", {
            responseSchema: ProjectListResponseSchemaZ
        })
        return result as DataResponseSchema<Project[]>
    }

    async createProject(data: CreateProjectBody) {
        const validatedData = this.validateBody(CreateProjectBodySchema, data)
        const result = await this.request("POST", "/projects", {
            body: validatedData,
            responseSchema: ProjectResponseSchemaZ
        })
        return result as DataResponseSchema<Project>
    }

    async getProject(projectId: number) {
        const result = await this.request("GET", `/projects/${projectId}`, {
            responseSchema: ProjectResponseSchemaZ
        })
        return result as DataResponseSchema<Project>
    }

    async updateProject(projectId: number, data: UpdateProjectBody): Promise<DataResponseSchema<Project>> {
        const validatedData = this.validateBody(UpdateProjectBodySchema, data)
        const result = await this.request("PATCH", `/projects/${projectId}`, {
            body: validatedData,
            responseSchema: ProjectResponseSchemaZ
        })
        return result as DataResponseSchema<Project>
    }

    async deleteProject(projectId: number): Promise<boolean> {
        await this.request("DELETE", `/projects/${projectId}`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }

    async syncProject(projectId: number): Promise<boolean> {
        await this.request("POST", `/projects/${projectId}/sync`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }

    async getProjectFiles(projectId: number) {
        const result = await this.request("GET", `/projects/${projectId}/files`, {
            responseSchema: FileListResponseSchemaZ
        })
        return result as DataResponseSchema<ProjectFile[]>
    }

    async refreshProject(projectId: number, query?: z.infer<typeof RefreshQuerySchema>) {
        const result = await this.request("POST", `/projects/${projectId}/refresh`, {
            params: query,
            responseSchema: FileListResponseSchemaZ
        })
        return result as DataResponseSchema<ProjectFile[]>
    }

    async getProjectSummary(projectId: number) {
        const result = await this.request("GET", `/projects/${projectId}/summary`, {
            responseSchema: ProjectSummaryResponseSchemaZ
        })
        return result as {
            summary: string,
            success: boolean
        }
    }

    async suggestFiles(projectId: number, data: z.infer<typeof SuggestFilesBodySchema>) {
        const validatedData = this.validateBody(SuggestFilesBodySchema, data)
        const result = await this.request("POST", `/projects/${projectId}/suggest-files`, {
            body: validatedData,
            responseSchema: SuggestFilesResponseSchemaZ
        })
        return result as {
            recommendedFileIds: number[],
            success: boolean
        }
    }

    async summarizeFiles(
        projectId: number,
        data: z.infer<typeof SummarizeFilesBodySchema>
    ) {
        const validatedData = this.validateBody(SummarizeFilesBodySchema, data)
        return await this.request("POST", `/projects/${projectId}/summarize`, {
            body: validatedData,
            responseSchema: SummarizeFilesResponseSchemaZ
        })
    }

    async removeSummaries(
        projectId: number,
        data: z.infer<typeof RemoveSummariesBodySchema>
    ) {
        const validatedData = this.validateBody(RemoveSummariesBodySchema, data)
        return await this.request("POST", `/projects/${projectId}/remove-summaries`, {
            body: validatedData,
            responseSchema: RemoveSummariesResponseSchemaZ
        })
    }

    async updateFileContent(
        projectId: number,
        fileId: number,
        content: string
    ) {
        const result = await this.request("PUT", `/projects/${projectId}/files/${fileId}`, {
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
        const result = await this.request("POST", `/projects/${projectId}/files/bulk`, {
            body: { files },
            responseSchema: z.object({
                success: z.literal(true),
                data: z.unknown()
            })
        })
        return result.data
    }

    async bulkUpdateFiles(
        projectId: number,
        updates: Array<{ fileId: number; content: string }>
    ) {
        const result = await this.request("PUT", `/projects/${projectId}/files/bulk`, {
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
        const result = await this.request("GET", "/prompts", {
            responseSchema: PromptListResponseSchemaZ
        })
        return result as DataResponseSchema<Prompt[]>
    }

    async createPrompt(data: CreatePromptBody) {
        const validatedData = this.validateBody(CreatePromptBodySchema, data)
        const result = await this.request("POST", "/prompts", {
            body: validatedData,
            responseSchema: PromptResponseSchemaZ
        })
        return result as DataResponseSchema<Prompt>
    }

    async getPrompt(promptId: number) {
        const result = await this.request("GET", `/prompts/${promptId}`, {
            responseSchema: PromptResponseSchemaZ
        })
        return result as DataResponseSchema<Prompt>
    }

    async updatePrompt(promptId: number, data: UpdatePromptBody) {
        const validatedData = this.validateBody(UpdatePromptBodySchema, data)
        const result = await this.request("PATCH", `/prompts/${promptId}`, {
            body: validatedData,
            responseSchema: PromptResponseSchemaZ
        })
        return result as DataResponseSchema<Prompt>
    }

    async deletePrompt(promptId: number): Promise<boolean> {
        await this.request("DELETE", `/prompts/${promptId}`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }

    async listProjectPrompts(projectId: number) {
        const result = await this.request("GET", `/projects/${projectId}/prompts`, {
            responseSchema: PromptListResponseSchemaZ
        })
        return result as DataResponseSchema<Prompt[]>
    }

    async addPromptToProject(projectId: number, promptId: number): Promise<boolean> {
        await this.request("POST", `/projects/${projectId}/prompts/${promptId}`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }

    async removePromptFromProject(projectId: number, promptId: number): Promise<boolean> {
        await this.request("DELETE", `/projects/${projectId}/prompts/${promptId}`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }

    async optimizeUserInput(data: OptimizePromptRequest) {
        const validatedData = this.validateBody(OptimizeUserInputRequestSchema, data)
        const result = await this.request("POST", "/prompt/optimize", {
            body: validatedData,
            responseSchema: OptimizePromptResponseSchemaZ
        })
        return result as DataResponseSchema<{ optimizedPrompt: string }>
    }
}

// Provider Key Service
export class ProviderKeyService extends BaseApiClient {
    async listKeys() {
        const result = await this.request("GET", "/keys", {
            responseSchema: ProviderKeyListResponseSchemaZ
        })
        return result as DataResponseSchema<ProviderKey[]>
    }

    async createKey(data: CreateProviderKeyBody) {
        const validatedData = this.validateBody(CreateProviderKeyBodySchema, data)
        const result = await this.request("POST", "/keys", {
            body: validatedData,
            responseSchema: ProviderKeyResponseSchemaZ
        })
        return result as DataResponseSchema<ProviderKey>
    }

    async getKey(keyId: number) {
        const result = await this.request("GET", `/keys/${keyId}`, {
            responseSchema: ProviderKeyResponseSchemaZ
        })
        return result as DataResponseSchema<ProviderKey>
    }

    async updateKey(keyId: number, data: UpdateProviderKeyBody) {
        const validatedData = this.validateBody(UpdateProviderKeyBodySchema, data)
        const result = await this.request("PATCH", `/keys/${keyId}`, {
            body: validatedData,
            responseSchema: ProviderKeyResponseSchemaZ
        })
        return result as DataResponseSchema<ProviderKey>
    }

    async deleteKey(keyId: number): Promise<boolean> {
        await this.request("DELETE", `/keys/${keyId}`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }
}

// Ticket Service
export class TicketService extends BaseApiClient {
    async createTicket(data: CreateTicketBody) {
        const validatedData = this.validateBody(CreateTicketBodySchema, data)
        const result = await this.request("POST", "/tickets", {
            body: validatedData,
            responseSchema: TicketResponseSchemaZ
        })
        return result as {
            ticket: Ticket,
            success: boolean
        }
    }

    async getTicket(ticketId: number) {
        const result = await this.request("GET", `/tickets/${ticketId}`, {
            responseSchema: TicketResponseSchemaZ
        })
        return result as {
            ticket: Ticket,
            success: boolean
        }
    }

    async updateTicket(ticketId: number, data: UpdateTicketBody) {
        const validatedData = this.validateBody(UpdateTicketBodySchema, data)
        const result = await this.request("PATCH", `/tickets/${ticketId}`, {
            body: validatedData,
            responseSchema: TicketResponseSchemaZ
        })
        return result as {
            ticket: Ticket,
            success: boolean
        }
    }

    async deleteTicket(ticketId: number): Promise<boolean> {
        await this.request("DELETE", `/tickets/${ticketId}`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }

    async listProjectTickets(projectId: number, status?: string) {
        const result = await this.request("GET", `/projects/${projectId}/tickets`, {
            params: status ? { status } : undefined,
            responseSchema: TicketListResponseSchemaZ
        })
        return result as {
            tickets: Ticket[],
            success: boolean
        }
    }

    async linkFilesToTicket(ticketId: number, fileIds: number[]) {
        const validatedData = this.validateBody(linkFilesSchema, { fileIds })
        const result = await this.request("POST", `/tickets/${ticketId}/link-files`, {
            body: validatedData,
            responseSchema: LinkedFilesResponseSchemaZ
        })
        return result as {
            linkedFiles: ProjectFile[],
            success: boolean
        }
    }

    async suggestFilesForTicket(
        ticketId: number,
        extraUserInput?: string
    ) {
        const body = extraUserInput ? { extraUserInput } : {}
        return await this.request("POST", `/tickets/${ticketId}/suggest-files`, {
            body,
            responseSchema: SuggestedFilesResponseSchemaZ
        })
    }

    async suggestTasksForTicket(
        ticketId: number,
        userContext?: string
    ) {
        const validatedData = this.validateBody(suggestTasksSchema, { userContext })
        const result = await this.request("POST", `/tickets/${ticketId}/suggest-tasks`, {
            body: validatedData,
            responseSchema: SuggestedTasksResponseSchemaZ
        })
        return result as {
            suggestedTasks: string[],
            success: boolean
        }
    }

    async createTask(ticketId: number, content: string) {
        const validatedData = this.validateBody(createTaskSchema, { content })
        const result = await this.request("POST", `/tickets/${ticketId}/tasks`, {
            body: validatedData,
            responseSchema: TaskResponseSchemaZ
        })
        return result as {
            task: TicketTask,
            success: boolean
        }
    }

    async getTasks(ticketId: number) {
        const result = await this.request("GET", `/tickets/${ticketId}/tasks`, {
            responseSchema: TaskListResponseSchemaZ
        })
        return result as {
            tasks: TicketTask[],
            success: boolean
        }
    }

    async updateTask(
        ticketId: number,
        taskId: number,
        data: UpdateTaskBody
    ) {
        const validatedData = this.validateBody(updateTaskSchema, data)
        const result = await this.request("PATCH", `/tickets/${ticketId}/tasks/${taskId}`, {
            body: validatedData,
            responseSchema: TaskResponseSchemaZ
        })
        return result as {
            task: TicketTask,
            success: boolean
        }
    }

    async deleteTask(ticketId: number, taskId: number): Promise<boolean> {
        await this.request("DELETE", `/tickets/${ticketId}/tasks/${taskId}`, {
            responseSchema: OperationSuccessResponseSchemaZ
        })
        return true
    }

    async reorderTasks(ticketId: number, data: ReorderTasksBody) {
        const validatedData = this.validateBody(reorderTasksSchema, data)
        const result = await this.request("PATCH", `/tickets/${ticketId}/tasks/reorder`, {
            body: validatedData,
            responseSchema: TaskListResponseSchemaZ
        })
        return result as {
            tasks: TicketTask[],
            success: boolean
        }
    }

    async getTasksForTickets(ticketIds: number[]) {
        const result = await this.request("GET", "/tickets/bulk-tasks", {
            params: { ids: ticketIds.join(',') },
            responseSchema: BulkTasksResponseSchemaZ
        })
        return result as {
            tasks: Record<string, TicketTask[]>,
            success: boolean
        }
    }

    async listTicketsWithTaskCount(
        projectId: number,
        status?: string
    ) {
        const result = await this.request("GET", `/projects/${projectId}/tickets-with-count`, {
            params: status ? { status } : undefined,
            responseSchema: TicketWithTaskCountListResponseSchemaZ
        })
        return result as {
            success: boolean,
            ticketsWithCount: TicketWithTaskCount[]
        }
    }

    async listTicketsWithTasks(
        projectId: number,
        status?: string
    ) {
        const result = await this.request("GET", `/projects/${projectId}/tickets-with-tasks`, {
            params: status ? { status } : undefined,
            responseSchema: TicketWithTasksListResponseSchemaZ
        })
        return result as {
            success: boolean,
            ticketsWithTasks: TicketWithTasks[]
        }
    }
}

// Admin Service
export class AdminService extends BaseApiClient {
    async getEnvironmentInfo() {
        const result = await this.request('GET', '/admin/env-info', {
            responseSchema: AdminEnvInfoResponseSchema
        })
        return result
    }

    async getSystemStatus() {
        const result = await this.request('GET', '/admin/system-status', {
            responseSchema: AdminSystemStatusResponseSchema
        })
        return result
    }
}

// Agent Coder Service
export class AgentCoderService extends BaseApiClient {
    async runAgentCoder(projectId: number, data: AgentCoderRunRequest) {
        const validatedData = this.validateBody(AgentCoderRunRequestSchema, data)
        const result = await this.request('POST', `/projects/${projectId}/agent-coder`, {
            body: validatedData,
            responseSchema: AgentCoderRunResponseSchema
        })
        return result as AgentCoderRunResponse
    }

    async listAgentRuns(projectId: number) {
        const result = await this.request('GET', `/agent-coder/project/${projectId}/runs`, {
            responseSchema: z.object({
                success: z.boolean(),
                data: z.array(z.number())
            })
        })
        return result as { success: boolean; data: number[] }
    }

    async getAgentRunLogs(projectId: number, agentJobId: number) {
        const result = await this.request('GET', `/agent-coder/project/${projectId}/runs/${agentJobId}/logs`, {
            responseSchema: z.array(z.record(z.unknown()))
        })
        return result as Array<Record<string, unknown>>
    }

    async getAgentRunData(projectId: number, agentJobId: number) {
        const result = await this.request('GET', `/agent-coder/project/${projectId}/runs/${agentJobId}/data`, {
            responseSchema: AgentDataLogSchema
        })
        return result as AgentDataLog
    }

    async confirmAgentRun(projectId: number, agentJobId: number) {
        const result = await this.request('POST', `/agent-coder/project/${projectId}/runs/${agentJobId}/confirm`, {
            responseSchema: z.object({
                success: z.literal(true),
                message: z.string(),
                writtenFiles: z.array(z.string())
            })
        })
        return result as { success: true; message: string; writtenFiles: string[] }
    }

    async deleteAgentRun(agentJobId: number) {
        const result = await this.request('DELETE', `/agent-coder/runs/${agentJobId}`, {
            responseSchema: z.object({
                success: z.literal(true),
                message: z.string()
            })
        })
        return result as { success: true; message: string }
    }
}

// AI File Change Service
export class AiFileChangeService extends BaseApiClient {
    async generateChange(projectId: number, data: Omit<GenerateChangeBody, 'projectId'>) {
        const validatedData = this.validateBody(GenerateChangeBodySchema.omit({ projectId: true }), data)
        const result = await this.request('POST', `/projects/${projectId}/ai-file-changes`, {
            body: validatedData,
            responseSchema: z.object({
                success: z.literal(true),
                result: AIFileChangeRecordSchema
            })
        })
        return result as { success: true; result: AIFileChangeRecord }
    }

    async getChange(projectId: number, changeId: number) {
        const result = await this.request('GET', `/projects/${projectId}/ai-file-changes/${changeId}`, {
            responseSchema: z.object({
                success: z.literal(true),
                fileChange: AIFileChangeRecordSchema
            })
        })
        return result as { success: true; fileChange: AIFileChangeRecord }
    }

    async confirmChange(projectId: number, changeId: number) {
        const result = await this.request('POST', `/projects/${projectId}/ai-file-changes/${changeId}/confirm`, {
            responseSchema: z.object({
                success: z.literal(true),
                result: z.object({
                    status: z.string(),
                    message: z.string()
                })
            })
        })
        return result as { success: true; result: { status: string; message: string } }
    }

    async rejectChange(projectId: number, changeId: number) {
        const result = await this.request('POST', `/projects/${projectId}/ai-file-changes/${changeId}/reject`, {
            responseSchema: z.object({
                success: z.literal(true),
                result: z.object({
                    status: z.string(),
                    message: z.string()
                })
            })
        })
        return result as { success: true; result: { status: string; message: string } }
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

// Main OctoPrompt Client
export class OctoPromptClient {
    public readonly chats: ChatService
    public readonly projects: ProjectService
    public readonly prompts: PromptService
    public readonly keys: ProviderKeyService
    public readonly tickets: TicketService
    public readonly admin: AdminService
    public readonly agentCoder: AgentCoderService
    public readonly aiFileChanges: AiFileChangeService
    public readonly genAi: GenAiService

    constructor(config: ApiConfig) {
        this.chats = new ChatService(config)
        this.projects = new ProjectService(config)
        this.prompts = new PromptService(config)
        this.keys = new ProviderKeyService(config)
        this.tickets = new TicketService(config)
        this.admin = new AdminService(config)
        this.agentCoder = new AgentCoderService(config)
        this.aiFileChanges = new AiFileChangeService(config)
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