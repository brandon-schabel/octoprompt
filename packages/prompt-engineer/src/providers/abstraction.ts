/**
 * Provider Abstraction Implementation
 * Base classes and utilities for provider integration
 */

import { Effect, Stream, Schema, Ref, Layer, pipe } from 'effect'
import type {
  ProviderService,
  ProviderError,
  ValidationError,
  GenerationOptions,
  GenerationResult,
  Message,
  StreamChunk,
  ToolDefinition,
  ModelInfo,
  ProviderRegistry,
  ProviderConfig,
  ProviderFactory,
  TokenUsage
} from './types'
import { ProviderRegistryTag } from './types'

// ============================================================================
// Base Provider Service
// ============================================================================

export abstract class BaseProviderService implements ProviderService {
  abstract readonly name: string
  abstract readonly models: readonly ModelInfo[]

  abstract generate(
    messages: readonly Message[],
    options?: GenerationOptions
  ): Effect.Effect<GenerationResult, ProviderError>

  stream(messages: readonly Message[], options?: GenerationOptions): Stream.Stream<StreamChunk, ProviderError> {
    // Default implementation: convert single generation to stream
    return Stream.fromEffect(this.generate(messages, options)).pipe(
      Stream.flatMap((result) =>
        Stream.fromIterable([
          { type: 'text' as const, content: result.text },
          {
            type: 'finish' as const,
            finishReason: result.finishReason,
            usage: result.usage
          }
        ])
      )
    )
  }

  generateStructured<T>(
    messages: readonly Message[],
    schema: Schema.Schema<T, any>,
    options?: GenerationOptions
  ): Effect.Effect<T, ProviderError | ValidationError> {
    return Effect.gen(
      function* (_) {
        // Add JSON instruction to messages
        const structuredMessages: Message[] = [
          ...messages,
          {
            role: 'system',
            content: `You must respond with valid JSON that matches the following schema:\n${JSON.stringify(Schema.to(schema), null, 2)}\n\nRespond ONLY with the JSON object, no explanation.`
          }
        ]

        // Generate with JSON format
        const result = yield* _(
          this.generate(structuredMessages, {
            ...options,
            responseFormat: 'json'
          })
        )

        // Parse and validate
        try {
          const parsed = JSON.parse(result.text)
          const validated = Schema.decodeUnknownSync(schema)(parsed)
          return validated
        } catch (error) {
          return yield* _(
            Effect.fail(
              new ValidationError({
                field: 'response',
                message: `Failed to parse or validate JSON: ${error}`,
                value: result.text
              })
            )
          )
        }
      }.bind(this)
    )
  }

  generateWithTools(
    messages: readonly Message[],
    tools: readonly ToolDefinition[],
    options?: GenerationOptions
  ): Effect.Effect<GenerationResult, ProviderError> {
    // Default implementation: use regular generation with tool descriptions
    const toolDescriptions = tools
      .map(
        (tool) =>
          `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${JSON.stringify(Schema.to(tool.parameters))}`
      )
      .join('\n\n')

    const enhancedMessages: Message[] = [
      {
        role: 'system',
        content: `You have access to the following tools:\n\n${toolDescriptions}\n\nTo use a tool, respond with a JSON object containing "tool_call" with "name" and "arguments" fields.`
      },
      ...messages
    ]

    return this.generate(enhancedMessages, options)
  }

  validateModel(modelId: string): Effect.Effect<boolean, never> {
    return Effect.succeed(this.models.some((model) => model.id === modelId))
  }

  estimateTokens(text: string): Effect.Effect<number, never> {
    // Simple estimation: ~4 characters per token
    return Effect.succeed(Math.ceil(text.length / 4))
  }

  listModels(): Effect.Effect<readonly ModelInfo[], ProviderError> {
    return Effect.succeed(this.models)
  }
}

// ============================================================================
// Provider Registry Implementation
// ============================================================================

class ProviderRegistryImpl implements ProviderRegistry {
  constructor(
    private readonly providers: Ref.Ref<Map<string, ProviderService>>,
    private readonly defaultProvider: Ref.Ref<string | null>
  ) {}

  register(name: string, provider: ProviderService): Effect.Effect<void, ProviderError> {
    return Effect.gen(
      function* (_) {
        const current = yield* _(Ref.get(this.providers))

        if (current.has(name)) {
          return yield* _(
            Effect.fail(
              new ProviderError({
                provider: name,
                message: `Provider '${name}' is already registered`,
                retryable: false
              })
            )
          )
        }

        const updated = new Map(current)
        updated.set(name, provider)
        yield* _(Ref.set(this.providers, updated))

        // Set as default if it's the first provider
        const currentDefault = yield* _(Ref.get(this.defaultProvider))
        if (!currentDefault) {
          yield* _(Ref.set(this.defaultProvider, name))
        }
      }.bind(this)
    )
  }

  get(name: string): Effect.Effect<ProviderService, ProviderError> {
    return Effect.gen(
      function* (_) {
        const providers = yield* _(Ref.get(this.providers))
        const provider = providers.get(name)

        if (!provider) {
          return yield* _(
            Effect.fail(
              new ProviderError({
                provider: name,
                message: `Provider '${name}' not found`,
                retryable: false
              })
            )
          )
        }

        return provider
      }.bind(this)
    )
  }

  list(): Effect.Effect<readonly string[], never> {
    return Effect.gen(
      function* (_) {
        const providers = yield* _(Ref.get(this.providers))
        return Array.from(providers.keys())
      }.bind(this)
    )
  }

  getDefault(): Effect.Effect<ProviderService, ProviderError> {
    return Effect.gen(
      function* (_) {
        const defaultName = yield* _(Ref.get(this.defaultProvider))

        if (!defaultName) {
          return yield* _(
            Effect.fail(
              new ProviderError({
                provider: 'default',
                message: 'No default provider set',
                retryable: false
              })
            )
          )
        }

        return yield* _(this.get(defaultName))
      }.bind(this)
    )
  }

  setDefault(name: string): Effect.Effect<void, ProviderError> {
    return Effect.gen(
      function* (_) {
        // Verify provider exists
        yield* _(this.get(name))

        // Set as default
        yield* _(Ref.set(this.defaultProvider, name))
      }.bind(this)
    )
  }
}

// ============================================================================
// Provider Registry Layer
// ============================================================================

export const ProviderRegistryLive = Layer.effect(
  ProviderRegistryTag,
  Effect.gen(function* (_) {
    const providers = yield* _(Ref.make(new Map<string, ProviderService>()))
    const defaultProvider = yield* _(Ref.make<string | null>(null))
    return new ProviderRegistryImpl(providers, defaultProvider)
  })
)

// ============================================================================
// Provider Utilities
// ============================================================================

/**
 * Create a simple provider from functions
 */
export function createProvider(
  name: string,
  models: ModelInfo[],
  generateFn: (messages: readonly Message[], options?: GenerationOptions) => Promise<GenerationResult>
): ProviderService {
  return new (class extends BaseProviderService {
    readonly name = name
    readonly models = models

    generate(
      messages: readonly Message[],
      options?: GenerationOptions
    ): Effect.Effect<GenerationResult, ProviderError> {
      return Effect.tryPromise({
        try: () => generateFn(messages, options),
        catch: (error) =>
          new ProviderError({
            provider: name,
            message: `Generation failed: ${error}`,
            retryable: true
          })
      })
    }
  })()
}

/**
 * Combine multiple providers into one with fallback
 */
export function createFallbackProvider(providers: readonly ProviderService[]): ProviderService {
  return new (class extends BaseProviderService {
    readonly name = 'fallback'
    readonly models = providers.flatMap((p) => p.models)

    generate(
      messages: readonly Message[],
      options?: GenerationOptions
    ): Effect.Effect<GenerationResult, ProviderError> {
      return Effect.gen(function* (_) {
        let lastError: ProviderError | null = null

        for (const provider of providers) {
          const result = yield* _(
            pipe(
              provider.generate(messages, options),
              Effect.catchAll((error) => {
                lastError = error
                return Effect.fail(error)
              }),
              Effect.option
            )
          )

          if (result._tag === 'Some') {
            return result.value
          }
        }

        return yield* _(
          Effect.fail(
            lastError ||
              new ProviderError({
                provider: 'fallback',
                message: 'All providers failed',
                retryable: false
              })
          )
        )
      })
    }
  })()
}

/**
 * Create a provider with retry logic
 */
export function withRetry(provider: ProviderService, maxRetries: number = 3, delay: number = 1000): ProviderService {
  return new (class extends BaseProviderService {
    readonly name = `${provider.name}-with-retry`
    readonly models = provider.models

    generate(
      messages: readonly Message[],
      options?: GenerationOptions
    ): Effect.Effect<GenerationResult, ProviderError> {
      return pipe(
        provider.generate(messages, options),
        Effect.retry({
          times: maxRetries,
          schedule: Effect.sleep(delay),
          while: (error) => error.retryable
        })
      )
    }
  })()
}

/**
 * Create a provider with caching
 */
export function withCache(
  provider: ProviderService,
  ttl: number = 60000 // 1 minute default
): ProviderService {
  const cache = new Map<string, { result: GenerationResult; timestamp: number }>()

  return new (class extends BaseProviderService {
    readonly name = `${provider.name}-cached`
    readonly models = provider.models

    generate(
      messages: readonly Message[],
      options?: GenerationOptions
    ): Effect.Effect<GenerationResult, ProviderError> {
      return Effect.gen(function* (_) {
        const cacheKey = JSON.stringify({ messages, options })
        const cached = cache.get(cacheKey)

        if (cached && Date.now() - cached.timestamp < ttl) {
          return cached.result
        }

        const result = yield* _(provider.generate(messages, options))
        cache.set(cacheKey, { result, timestamp: Date.now() })

        // Cleanup old entries
        for (const [key, entry] of cache.entries()) {
          if (Date.now() - entry.timestamp > ttl) {
            cache.delete(key)
          }
        }

        return result
      })
    }
  })()
}

/**
 * Create a mock provider for testing
 */
export function createMockProvider(name: string = 'mock', response: string = 'Mock response'): ProviderService {
  return new (class extends BaseProviderService {
    readonly name = name
    readonly models = [
      {
        id: 'mock-model',
        name: 'Mock Model',
        provider: name,
        contextWindow: 8192,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: false,
          maxTokens: 4096,
          contextWindow: 8192
        }
      }
    ]

    generate(
      messages: readonly Message[],
      options?: GenerationOptions
    ): Effect.Effect<GenerationResult, ProviderError> {
      return Effect.succeed({
        text: response,
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15
        },
        finishReason: 'stop',
        model: 'mock-model',
        provider: name
      })
    }
  })()
}
