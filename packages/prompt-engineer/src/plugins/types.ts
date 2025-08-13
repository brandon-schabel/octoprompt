/**
 * Plugin System Types and Interfaces
 * Core plugin architecture for the prompt-engineer package
 */

import { Context, Effect, Layer, Stream, Schema } from 'effect'

// ============================================================================
// Core Plugin Types
// ============================================================================

export class PluginError extends Schema.TaggedError<PluginError>("PluginError")(
  "PluginError",
  {
    plugin: Schema.String,
    reason: Schema.String,
    recoverable: Schema.Boolean
  }
) {}

export class PluginNotFoundError extends Schema.TaggedError<PluginNotFoundError>("PluginNotFoundError")(
  "PluginNotFoundError", 
  {
    pluginName: Schema.String,
    availablePlugins: Schema.Array(Schema.String)
  }
) {}

export interface PromptEngineerPlugin {
  readonly name: string
  readonly version: string
  readonly capabilities: readonly string[]
  readonly initialize: () => Effect.Effect<void, PluginError>
  readonly cleanup?: () => Effect.Effect<void, never>
}

// ============================================================================
// Provider Plugin Interface
// ============================================================================

export class ProviderError extends Schema.TaggedError<ProviderError>("ProviderError")(
  "ProviderError",
  {
    provider: Schema.String,
    message: Schema.String,
    code: Schema.optional(Schema.String),
    retryable: Schema.Boolean
  }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>("ValidationError")(
  "ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
    value: Schema.Unknown
  }
) {}

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
}

export interface GenerationResult {
  readonly text: string
  readonly usage?: {
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
  }
  readonly finishReason?: 'stop' | 'length' | 'error' | 'cancel'
  readonly model?: string
}

export interface ProviderPlugin extends PromptEngineerPlugin {
  readonly generate: (
    prompt: string, 
    options?: GenerationOptions
  ) => Effect.Effect<GenerationResult, ProviderError>
  
  readonly stream?: (
    prompt: string, 
    options?: GenerationOptions
  ) => Stream.Stream<string, ProviderError>
  
  readonly generateStructured?: <T>(
    prompt: string,
    schema: Schema.Schema<T, any>,
    options?: GenerationOptions
  ) => Effect.Effect<T, ProviderError | ValidationError>
}

// ============================================================================
// Storage Plugin Interface
// ============================================================================

export class StorageError extends Schema.TaggedError<StorageError>("StorageError")(
  "StorageError",
  {
    operation: Schema.Literal('read', 'write', 'delete', 'clear'),
    key: Schema.optional(Schema.String),
    message: Schema.String
  }
) {}

export interface CacheEntry<T> {
  readonly value: T
  readonly timestamp: number
  readonly ttl?: number
  readonly metadata?: Record<string, unknown>
}

export interface StoragePlugin extends PromptEngineerPlugin {
  readonly get: <T>(key: string) => Effect.Effect<CacheEntry<T> | null, StorageError>
  readonly set: <T>(key: string, value: T, ttl?: number) => Effect.Effect<void, StorageError>
  readonly delete: (key: string) => Effect.Effect<void, StorageError>
  readonly clear: () => Effect.Effect<void, StorageError>
  readonly has: (key: string) => Effect.Effect<boolean, StorageError>
  readonly keys: () => Effect.Effect<readonly string[], StorageError>
}

// ============================================================================
// Dataset Plugin Interface
// ============================================================================

export class DatasetError extends Schema.TaggedError<DatasetError>("DatasetError")(
  "DatasetError",
  {
    dataset: Schema.String,
    operation: Schema.String,
    message: Schema.String
  }
) {}

export interface BenchmarkTask {
  readonly id: string
  readonly prompt: string
  readonly expectedOutput?: string
  readonly metadata?: Record<string, unknown>
  readonly tags?: readonly string[]
}

export interface EvaluationResult {
  readonly taskId: string
  readonly score: number
  readonly metrics: Record<string, number>
  readonly passed: boolean
  readonly details?: string
}

export interface DatasetPlugin extends PromptEngineerPlugin {
  readonly datasetName: string
  readonly tasks: () => Effect.Effect<readonly BenchmarkTask[], DatasetError>
  readonly evaluate: (
    response: string,
    expected: string,
    task: BenchmarkTask
  ) => Effect.Effect<EvaluationResult, DatasetError>
  readonly metrics: readonly string[]
}

// ============================================================================
// Monitoring Plugin Interface
// ============================================================================

export interface MonitoringEvent {
  readonly type: 'optimization_start' | 'optimization_complete' | 'optimization_error' | 'cache_hit' | 'cache_miss'
  readonly timestamp: number
  readonly data: Record<string, unknown>
  readonly duration?: number
}

export interface MonitoringPlugin extends PromptEngineerPlugin {
  readonly record: (event: MonitoringEvent) => Effect.Effect<void, never>
  readonly flush: () => Effect.Effect<void, never>
  readonly getMetrics: () => Effect.Effect<Record<string, number>, never>
}

// ============================================================================
// Plugin Registry
// ============================================================================

export interface PluginRegistry {
  readonly register: (plugin: PromptEngineerPlugin) => Effect.Effect<void, PluginError>
  readonly unregister: (name: string) => Effect.Effect<void, PluginNotFoundError>
  readonly get: (name: string) => Effect.Effect<PromptEngineerPlugin, PluginNotFoundError>
  readonly getByType: <T extends PromptEngineerPlugin>(
    type: PluginType
  ) => Effect.Effect<readonly T[], never>
  readonly list: () => Effect.Effect<readonly PromptEngineerPlugin[], never>
  readonly has: (name: string) => Effect.Effect<boolean, never>
  readonly clear: () => Effect.Effect<void, never>
}

export const PluginRegistryTag = Context.GenericTag<PluginRegistry>("PluginRegistry")

export type PluginType = 'provider' | 'storage' | 'dataset' | 'monitoring' | 'custom'

export function getPluginType(plugin: PromptEngineerPlugin): PluginType {
  if ('generate' in plugin) return 'provider'
  if ('get' in plugin && 'set' in plugin) return 'storage'
  if ('datasetName' in plugin) return 'dataset'
  if ('record' in plugin) return 'monitoring'
  return 'custom'
}

// ============================================================================
// Plugin Lifecycle
// ============================================================================

export interface PluginLifecycle {
  readonly beforeInit?: () => Effect.Effect<void, never>
  readonly afterInit?: () => Effect.Effect<void, never>
  readonly beforeCleanup?: () => Effect.Effect<void, never>
  readonly afterCleanup?: () => Effect.Effect<void, never>
  readonly onError?: (error: unknown) => Effect.Effect<void, never>
}

// ============================================================================
// Plugin Configuration
// ============================================================================

export interface PluginConfig {
  readonly enabled: boolean
  readonly priority?: number
  readonly autoInitialize?: boolean
  readonly config?: Record<string, unknown>
}

export interface PluginManifest {
  readonly name: string
  readonly version: string
  readonly description?: string
  readonly author?: string
  readonly homepage?: string
  readonly repository?: string
  readonly keywords?: readonly string[]
  readonly engines?: {
    readonly node?: string
    readonly bun?: string
  }
  readonly peerDependencies?: Record<string, string>
  readonly config?: PluginConfig
}

// ============================================================================
// Plugin Manager Service
// ============================================================================

export interface PluginManager {
  readonly loadPlugin: (
    path: string | PromptEngineerPlugin
  ) => Effect.Effect<void, PluginError>
  readonly loadPlugins: (
    paths: readonly (string | PromptEngineerPlugin)[]
  ) => Effect.Effect<void, PluginError>
  readonly initializeAll: () => Effect.Effect<void, PluginError>
  readonly cleanupAll: () => Effect.Effect<void, never>
  readonly getPlugin: <T extends PromptEngineerPlugin>(
    name: string
  ) => Effect.Effect<T, PluginNotFoundError>
  readonly getPlugins: <T extends PromptEngineerPlugin>(
    type?: PluginType
  ) => Effect.Effect<readonly T[], never>
}

export const PluginManagerTag = Context.GenericTag<PluginManager>("PluginManager")