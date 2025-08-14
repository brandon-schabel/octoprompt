/**
 * Provider Abstraction Types
 * Provider-agnostic interfaces for LLM integration
 */

import { Effect, Schema, Context, Stream } from 'effect'

// ============================================================================
// Model Information
// ============================================================================

export interface ModelInfo {
  readonly id: string
  readonly name: string
  readonly provider: string
  readonly contextWindow: number
  readonly maxOutputTokens?: number
  readonly pricing?: {
    readonly inputCostPer1k: number
    readonly outputCostPer1k: number
  }
  readonly capabilities: ModelCapabilities
  readonly deprecated?: boolean
}

export interface ModelCapabilities {
  readonly streaming: boolean
  readonly functionCalling: boolean
  readonly vision: boolean
  readonly audio?: boolean
  readonly video?: boolean
  readonly maxTokens: number
  readonly contextWindow: number
  readonly knowledgeCutoff?: string
  readonly languages?: readonly string[]
}

// ============================================================================
// Provider Service
// ============================================================================

export class ProviderError extends Schema.TaggedError<ProviderError>('ProviderError')('ProviderError', {
  provider: Schema.String,
  message: Schema.String,
  code: Schema.optional(Schema.String),
  retryable: Schema.Boolean,
  status: Schema.optional(Schema.Number)
}) {}

export class ValidationError extends Schema.TaggedError<ValidationError>('ValidationError')('ValidationError', {
  field: Schema.String,
  message: Schema.String,
  value: Schema.Unknown
}) {}

export interface GenerationOptions {
  readonly model?: string
  readonly temperature?: number
  readonly maxTokens?: number
  readonly topP?: number
  readonly topK?: number
  readonly frequencyPenalty?: number
  readonly presencePenalty?: number
  readonly stopSequences?: readonly string[]
  readonly seed?: number
  readonly responseFormat?: 'text' | 'json' | 'json_schema'
  readonly jsonSchema?: Schema.Schema<any>
  readonly systemPrompt?: string
  readonly tools?: readonly ToolDefinition[]
  readonly toolChoice?: 'auto' | 'none' | string
}

export interface GenerationResult {
  readonly text: string
  readonly usage?: TokenUsage
  readonly finishReason?: FinishReason
  readonly model?: string
  readonly provider?: string
  readonly toolCalls?: readonly ToolCall[]
}

export interface TokenUsage {
  readonly promptTokens: number
  readonly completionTokens: number
  readonly totalTokens: number
  readonly cachedTokens?: number
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | 'cancel'

// ============================================================================
// Tool Calling
// ============================================================================

export interface ToolDefinition {
  readonly name: string
  readonly description: string
  readonly parameters: Schema.Schema<any>
  readonly required?: readonly string[]
}

export interface ToolCall {
  readonly id: string
  readonly name: string
  readonly arguments: Record<string, unknown>
}

export interface ToolResult {
  readonly toolCallId: string
  readonly result: unknown
  readonly error?: string
}

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
  readonly role: 'system' | 'user' | 'assistant' | 'tool'
  readonly content: string | MessageContent[]
  readonly name?: string
  readonly toolCalls?: readonly ToolCall[]
  readonly toolCallId?: string
}

export type MessageContent = TextContent | ImageContent | AudioContent | VideoContent | ToolResultContent

export interface TextContent {
  readonly type: 'text'
  readonly text: string
}

export interface ImageContent {
  readonly type: 'image'
  readonly image: string | Uint8Array | URL
  readonly mimeType?: string
  readonly detail?: 'low' | 'high' | 'auto'
}

export interface AudioContent {
  readonly type: 'audio'
  readonly audio: string | Uint8Array | URL
  readonly mimeType?: string
  readonly transcript?: string
}

export interface VideoContent {
  readonly type: 'video'
  readonly video: string | Uint8Array | URL
  readonly mimeType?: string
  readonly duration?: number
}

export interface ToolResultContent {
  readonly type: 'tool_result'
  readonly toolCallId: string
  readonly result: unknown
}

// ============================================================================
// Provider Service Interface
// ============================================================================

export interface ProviderService {
  readonly name: string
  readonly models: readonly ModelInfo[]

  readonly generate: (
    messages: readonly Message[],
    options?: GenerationOptions
  ) => Effect.Effect<GenerationResult, ProviderError>

  readonly stream: (
    messages: readonly Message[],
    options?: GenerationOptions
  ) => Stream.Stream<StreamChunk, ProviderError>

  readonly generateStructured: <T>(
    messages: readonly Message[],
    schema: Schema.Schema<T, any>,
    options?: GenerationOptions
  ) => Effect.Effect<T, ProviderError | ValidationError>

  readonly generateWithTools: (
    messages: readonly Message[],
    tools: readonly ToolDefinition[],
    options?: GenerationOptions
  ) => Effect.Effect<GenerationResult, ProviderError>

  readonly validateModel?: (modelId: string) => Effect.Effect<boolean, never>
  readonly estimateTokens?: (text: string) => Effect.Effect<number, never>
  readonly listModels?: () => Effect.Effect<readonly ModelInfo[], ProviderError>
}

export const ProviderServiceTag = Context.GenericTag<ProviderService>('ProviderService')

// ============================================================================
// Stream Types
// ============================================================================

export interface StreamChunk {
  readonly type: 'text' | 'tool_call' | 'error' | 'finish'
  readonly content?: string
  readonly toolCall?: ToolCall
  readonly error?: string
  readonly finishReason?: FinishReason
  readonly usage?: TokenUsage
}

// ============================================================================
// Provider Registry
// ============================================================================

export interface ProviderRegistry {
  readonly register: (name: string, provider: ProviderService) => Effect.Effect<void, ProviderError>

  readonly get: (name: string) => Effect.Effect<ProviderService, ProviderError>

  readonly list: () => Effect.Effect<readonly string[], never>

  readonly getDefault: () => Effect.Effect<ProviderService, ProviderError>

  readonly setDefault: (name: string) => Effect.Effect<void, ProviderError>
}

export const ProviderRegistryTag = Context.GenericTag<ProviderRegistry>('ProviderRegistry')

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ProviderConfig {
  readonly apiKey?: string
  readonly baseUrl?: string
  readonly organization?: string
  readonly project?: string
  readonly defaultModel?: string
  readonly timeout?: number
  readonly maxRetries?: number
  readonly headers?: Record<string, string>
  readonly proxy?: {
    readonly host: string
    readonly port: number
    readonly auth?: {
      readonly username: string
      readonly password: string
    }
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

export interface ProviderFactory<T extends ProviderConfig = ProviderConfig> {
  readonly name: string
  readonly version: string
  readonly supportedModels: readonly string[]

  readonly create: (config: T) => Effect.Effect<ProviderService, ProviderError>

  readonly validateConfig: (config: T) => Effect.Effect<boolean, ValidationError>
}
