/**
 * Local Model Provider Plugin
 * Support for LMStudio, Ollama, and other local model servers
 */

import { Effect, Stream, Schema, pipe, Ref } from 'effect'
import type { ProviderPlugin, GenerationOptions, GenerationResult, ProviderError as ProviderErrorType } from '../types'
import { ProviderError, ValidationError } from '../types'

type LocalModelType = 'lmstudio' | 'ollama' | 'llamacpp' | 'custom'

interface LocalProviderConfig {
  type: LocalModelType
  endpoint?: string
  model?: string
  defaultOptions?: GenerationOptions
  healthCheckInterval?: number // ms
  autoSelectModel?: boolean // Auto-select best available model
  customHeaders?: Record<string, string>
}

interface ModelInfo {
  name: string
  size: number // bytes
  quantization?: string
  contextLength?: number
  available: boolean
}

export class LocalProviderPlugin implements ProviderPlugin {
  readonly name: string
  readonly version = '1.0.0'
  readonly capabilities = ['streaming', 'model-switching', 'health-check']

  private config: LocalProviderConfig
  private availableModels: Ref.Ref<ModelInfo[]>
  private currentModel: Ref.Ref<string | null>
  private isHealthy: Ref.Ref<boolean>
  private healthCheckTimer: NodeJS.Timeout | null = null

  constructor(config: LocalProviderConfig) {
    this.name = `local-${config.type}`

    // Set default endpoints based on type
    const defaultEndpoints: Record<LocalModelType, string> = {
      lmstudio: 'http://localhost:1234/v1',
      ollama: 'http://localhost:11434/api',
      llamacpp: 'http://localhost:8080',
      custom: 'http://localhost:8080'
    }

    this.config = {
      endpoint: config.endpoint || defaultEndpoints[config.type],
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      autoSelectModel: config.autoSelectModel ?? true,
      ...config
    }

    this.availableModels = Ref.unsafeMake([])
    this.currentModel = Ref.unsafeMake(config.model || null)
    this.isHealthy = Ref.unsafeMake(false)
  }

  initialize(): Effect.Effect<void, ProviderError> {
    return Effect.gen(
      function* (_) {
        // Check server health
        const healthy = yield* _(this.checkHealth())

        if (!healthy) {
          return yield* _(
            Effect.fail(
              new ProviderError({
                provider: this.name,
                message: `Local model server at ${this.config.endpoint} is not responding`,
                code: 'SERVER_UNAVAILABLE',
                retryable: true
              })
            )
          )
        }

        // Get available models
        yield* _(this.refreshModels())

        // Auto-select model if needed
        if (this.config.autoSelectModel && !this.config.model) {
          yield* _(this.autoSelectBestModel())
        }

        // Start health check timer
        if (this.config.healthCheckInterval && this.config.healthCheckInterval > 0) {
          this.startHealthCheck()
        }
      }.bind(this)
    )
  }

  cleanup(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer)
        this.healthCheckTimer = null
      }
    })
  }

  generate(prompt: string, options?: GenerationOptions): Effect.Effect<GenerationResult, ProviderError> {
    return Effect.gen(
      function* (_) {
        // Check health
        const healthy = yield* _(Ref.get(this.isHealthy))
        if (!healthy) {
          // Try to reconnect
          const reconnected = yield* _(this.checkHealth())
          if (!reconnected) {
            return yield* _(
              Effect.fail(
                new ProviderError({
                  provider: this.name,
                  message: 'Local model server is not available',
                  code: 'SERVER_UNAVAILABLE',
                  retryable: true
                })
              )
            )
          }
        }

        // Get current model
        const model = yield* _(this.getCurrentModel())

        // Make request based on provider type
        const response = yield* _(this.makeRequest(prompt, model, options))

        return this.transformResponse(response, model)
      }.bind(this)
    )
  }

  stream(prompt: string, options?: GenerationOptions): Stream.Stream<string, ProviderError> {
    return Stream.gen(
      function* (_) {
        // Check health
        const healthy = yield* _(Stream.fromEffect(Ref.get(this.isHealthy)))
        if (!healthy) {
          yield* _(
            Stream.fail(
              new ProviderError({
                provider: this.name,
                message: 'Local model server is not available',
                code: 'SERVER_UNAVAILABLE',
                retryable: true
              })
            )
          )
        }

        // Get current model
        const model = yield* _(Stream.fromEffect(this.getCurrentModel()))

        // Stream based on provider type
        yield* _(this.makeStreamRequest(prompt, model, options))
      }.bind(this)
    )
  }

  generateStructured<T>(
    prompt: string,
    schema: Schema.Schema<T, any>,
    options?: GenerationOptions
  ): Effect.Effect<T, ProviderError | ValidationError> {
    return Effect.gen(
      function* (_) {
        // Add JSON instruction to prompt
        const jsonPrompt = this.createJSONPrompt(prompt, schema)

        // Generate with constrained output if supported
        const result = yield* _(
          this.generate(jsonPrompt, {
            ...options,
            temperature: 0.3, // Lower temperature for structured output
            topP: 0.9
          })
        )

        // Parse and validate
        const parsed = yield* _(this.parseJSON(result.text))

        return yield* _(
          Schema.decodeUnknown(schema)(parsed).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new ValidationError({
                  field: 'response',
                  message: `Schema validation failed: ${error}`,
                  value: parsed
                })
              )
            )
          )
        )
      }.bind(this)
    )
  }

  // Model management methods

  /**
   * List available models
   */
  listModels(): Effect.Effect<ModelInfo[], ProviderError> {
    return this.refreshModels().pipe(Effect.flatMap(() => Ref.get(this.availableModels)))
  }

  /**
   * Switch to a different model
   */
  switchModel(modelName: string): Effect.Effect<void, ProviderError> {
    return Effect.gen(
      function* (_) {
        const models = yield* _(Ref.get(this.availableModels))
        const model = models.find((m) => m.name === modelName)

        if (!model || !model.available) {
          return yield* _(
            Effect.fail(
              new ProviderError({
                provider: this.name,
                message: `Model ${modelName} is not available`,
                code: 'MODEL_NOT_FOUND',
                retryable: false
              })
            )
          )
        }

        yield* _(Ref.set(this.currentModel, modelName))

        // Load model if needed (Ollama)
        if (this.config.type === 'ollama') {
          yield* _(this.loadOllamaModel(modelName))
        }
      }.bind(this)
    )
  }

  // Private helper methods

  private checkHealth(): Effect.Effect<boolean, never> {
    return Effect.gen(
      function* (_) {
        try {
          const endpoint = this.getHealthEndpoint()
          const response = yield* _(
            Effect.tryPromise({
              try: () =>
                fetch(endpoint, {
                  method: 'GET',
                  headers: this.config.customHeaders
                }),
              catch: () => false
            })
          )

          const healthy = response && (response === true || (response as any).ok)
          yield* _(Ref.set(this.isHealthy, healthy))
          return healthy
        } catch {
          yield* _(Ref.set(this.isHealthy, false))
          return false
        }
      }.bind(this)
    )
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      Effect.runPromise(this.checkHealth()).catch(() => {})
    }, this.config.healthCheckInterval!)
  }

  private refreshModels(): Effect.Effect<void, ProviderError> {
    return Effect.gen(
      function* (_) {
        const endpoint = this.getModelsEndpoint()

        const response = yield* _(
          Effect.tryPromise({
            try: async () => {
              const res = await fetch(endpoint, {
                method: 'GET',
                headers: this.config.customHeaders
              })
              return res.json()
            },
            catch: (error) =>
              new ProviderError({
                provider: this.name,
                message: `Failed to fetch models: ${error}`,
                code: 'MODELS_FETCH_ERROR',
                retryable: true
              })
          })
        )

        const models = this.parseModelsResponse(response)
        yield* _(Ref.set(this.availableModels, models))
      }.bind(this)
    )
  }

  private autoSelectBestModel(): Effect.Effect<void, ProviderError> {
    return Effect.gen(
      function* (_) {
        const models = yield* _(Ref.get(this.availableModels))

        if (models.length === 0) {
          return yield* _(
            Effect.fail(
              new ProviderError({
                provider: this.name,
                message: 'No models available',
                code: 'NO_MODELS',
                retryable: false
              })
            )
          )
        }

        // Select based on criteria (prefer larger context, better quantization)
        const sorted = [...models].sort((a, b) => {
          // Prefer available models
          if (a.available !== b.available) return a.available ? -1 : 1

          // Prefer larger context
          const aContext = a.contextLength || 2048
          const bContext = b.contextLength || 2048
          if (aContext !== bContext) return bContext - aContext

          // Prefer certain quantizations
          const quantPriority: Record<string, number> = {
            f16: 4,
            q8_0: 3,
            q5_1: 2,
            q4_0: 1
          }
          const aQuant = quantPriority[a.quantization || ''] || 0
          const bQuant = quantPriority[b.quantization || ''] || 0

          return bQuant - aQuant
        })

        yield* _(Ref.set(this.currentModel, sorted[0].name))
      }.bind(this)
    )
  }

  private getCurrentModel(): Effect.Effect<string, ProviderError> {
    return Effect.gen(
      function* (_) {
        const model = yield* _(Ref.get(this.currentModel))

        if (!model) {
          // Try to auto-select
          yield* _(this.autoSelectBestModel())
          const selected = yield* _(Ref.get(this.currentModel))

          if (!selected) {
            return yield* _(
              Effect.fail(
                new ProviderError({
                  provider: this.name,
                  message: 'No model selected',
                  code: 'NO_MODEL_SELECTED',
                  retryable: false
                })
              )
            )
          }

          return selected
        }

        return model
      }.bind(this)
    )
  }

  private makeRequest(prompt: string, model: string, options?: GenerationOptions): Effect.Effect<any, ProviderError> {
    const endpoint = this.getCompletionEndpoint()
    const body = this.buildRequestBody(prompt, model, options)

    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.customHeaders
          },
          body: JSON.stringify(body)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        return response.json()
      },
      catch: (error: any) =>
        new ProviderError({
          provider: this.name,
          message: `Request failed: ${error.message}`,
          code: 'REQUEST_ERROR',
          retryable: true
        })
    })
  }

  private makeStreamRequest(
    prompt: string,
    model: string,
    options?: GenerationOptions
  ): Stream.Stream<string, ProviderError> {
    const endpoint = this.getCompletionEndpoint()
    const body = {
      ...this.buildRequestBody(prompt, model, options),
      stream: true
    }

    return Stream.async<string>((emit) => {
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.customHeaders
        },
        body: JSON.stringify(body)
      })
        .then((response) => {
          if (!response.ok || !response.body) {
            emit.fail(
              new ProviderError({
                provider: this.name,
                message: `Stream request failed: ${response.statusText}`,
                code: 'STREAM_ERROR',
                retryable: false
              })
            )
            return
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()

          const read = async () => {
            try {
              const { done, value } = await reader.read()

              if (done) {
                emit.end()
                return
              }

              const text = decoder.decode(value, { stream: true })
              const chunks = this.parseStreamChunks(text)

              for (const chunk of chunks) {
                emit.single(chunk)
              }

              read()
            } catch (error) {
              emit.fail(
                new ProviderError({
                  provider: this.name,
                  message: `Stream processing error: ${error}`,
                  code: 'STREAM_PROCESS_ERROR',
                  retryable: false
                })
              )
            }
          }

          read()
        })
        .catch((error) => {
          emit.fail(
            new ProviderError({
              provider: this.name,
              message: `Stream initialization error: ${error}`,
              code: 'STREAM_INIT_ERROR',
              retryable: false
            })
          )
        })
    })
  }

  private buildRequestBody(prompt: string, model: string, options?: GenerationOptions): any {
    switch (this.config.type) {
      case 'lmstudio':
        return {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 1000,
          stream: false
        }

      case 'ollama':
        return {
          model,
          prompt,
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 1000,
            top_p: options?.topP || 0.9
          },
          stream: false
        }

      case 'llamacpp':
        return {
          prompt,
          n_predict: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7,
          top_p: options?.topP || 0.9,
          stream: false
        }

      default:
        return {
          model,
          prompt,
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          stream: false
        }
    }
  }

  private transformResponse(response: any, model: string): GenerationResult {
    switch (this.config.type) {
      case 'lmstudio':
        return {
          text: response.choices?.[0]?.message?.content || '',
          usage: response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
              }
            : undefined,
          finishReason: response.choices?.[0]?.finish_reason,
          model
        }

      case 'ollama':
        return {
          text: response.response || '',
          usage: {
            promptTokens: response.prompt_eval_count || 0,
            completionTokens: response.eval_count || 0,
            totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
          },
          finishReason: response.done ? 'stop' : 'length',
          model
        }

      case 'llamacpp':
        return {
          text: response.content || '',
          usage: {
            promptTokens: response.tokens_evaluated || 0,
            completionTokens: response.tokens_predicted || 0,
            totalTokens: (response.tokens_evaluated || 0) + (response.tokens_predicted || 0)
          },
          finishReason: response.stopped_eos ? 'stop' : 'length',
          model
        }

      default:
        return {
          text: response.text || response.content || response.response || '',
          model
        }
    }
  }

  private parseStreamChunks(text: string): string[] {
    const chunks: string[] = []

    switch (this.config.type) {
      case 'lmstudio':
        // SSE format
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) chunks.push(content)
              } catch {}
            }
          }
        }
        break

      case 'ollama':
        // JSONL format
        const jsonLines = text.split('\n').filter((l) => l.trim())
        for (const line of jsonLines) {
          try {
            const parsed = JSON.parse(line)
            if (parsed.response) chunks.push(parsed.response)
          } catch {}
        }
        break

      case 'llamacpp':
        // Direct text chunks
        if (text) chunks.push(text)
        break

      default:
        if (text) chunks.push(text)
    }

    return chunks
  }

  private parseModelsResponse(response: any): ModelInfo[] {
    switch (this.config.type) {
      case 'lmstudio':
        return (response.data || []).map((m: any) => ({
          name: m.id,
          size: m.size || 0,
          available: true
        }))

      case 'ollama':
        return (response.models || []).map((m: any) => ({
          name: m.name,
          size: m.size || 0,
          quantization: m.details?.quantization_level,
          available: true
        }))

      case 'llamacpp':
        // llama.cpp doesn't have a models endpoint, return configured model
        return [
          {
            name: this.config.model || 'default',
            size: 0,
            available: true
          }
        ]

      default:
        return []
    }
  }

  private loadOllamaModel(modelName: string): Effect.Effect<void, ProviderError> {
    return Effect.tryPromise({
      try: async () => {
        await fetch(`${this.config.endpoint}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            prompt: '',
            options: { num_predict: 0 }
          })
        })
      },
      catch: (error) =>
        new ProviderError({
          provider: this.name,
          message: `Failed to load model ${modelName}: ${error}`,
          code: 'MODEL_LOAD_ERROR',
          retryable: true
        })
    })
  }

  private createJSONPrompt(prompt: string, schema: any): string {
    return `${prompt}

Respond with valid JSON that matches this structure:
${JSON.stringify(this.getSchemaExample(schema), null, 2)}

Important: Return only valid JSON, no additional text.`
  }

  private getSchemaExample(schema: any): any {
    // Generate example based on schema (simplified)
    return {
      _note: 'Replace with actual values matching the schema'
    }
  }

  private parseJSON(text: string): Effect.Effect<any, ValidationError> {
    return Effect.try({
      try: () => {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/)
        const jsonText = jsonMatch ? jsonMatch[0] : text
        return JSON.parse(jsonText)
      },
      catch: (error) =>
        new ValidationError({
          field: 'response',
          message: `Failed to parse JSON: ${error}`,
          value: text
        })
    })
  }

  private getHealthEndpoint(): string {
    switch (this.config.type) {
      case 'lmstudio':
        return `${this.config.endpoint}/models`
      case 'ollama':
        return `${this.config.endpoint}/tags`
      case 'llamacpp':
        return `${this.config.endpoint}/health`
      default:
        return `${this.config.endpoint}/health`
    }
  }

  private getModelsEndpoint(): string {
    switch (this.config.type) {
      case 'lmstudio':
        return `${this.config.endpoint}/models`
      case 'ollama':
        return `${this.config.endpoint}/tags`
      default:
        return `${this.config.endpoint}/models`
    }
  }

  private getCompletionEndpoint(): string {
    switch (this.config.type) {
      case 'lmstudio':
        return `${this.config.endpoint}/chat/completions`
      case 'ollama':
        return `${this.config.endpoint}/generate`
      case 'llamacpp':
        return `${this.config.endpoint}/completion`
      default:
        return `${this.config.endpoint}/completions`
    }
  }
}

/**
 * Create a local provider plugin
 */
export function createLocalProvider(config: LocalProviderConfig): LocalProviderPlugin {
  return new LocalProviderPlugin(config)
}

/**
 * Create LMStudio provider
 */
export function createLMStudioProvider(options?: Partial<LocalProviderConfig>): LocalProviderPlugin {
  return new LocalProviderPlugin({
    type: 'lmstudio',
    ...options
  })
}

/**
 * Create Ollama provider
 */
export function createOllamaProvider(model?: string, options?: Partial<LocalProviderConfig>): LocalProviderPlugin {
  return new LocalProviderPlugin({
    type: 'ollama',
    model,
    ...options
  })
}

/**
 * Create llama.cpp provider
 */
export function createLlamaCppProvider(options?: Partial<LocalProviderConfig>): LocalProviderPlugin {
  return new LocalProviderPlugin({
    type: 'llamacpp',
    ...options
  })
}
