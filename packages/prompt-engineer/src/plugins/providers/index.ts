/**
 * Provider Plugin Exports
 * Collection of LLM provider adapters
 */

export * from './mock-provider'
export * from './http-provider'
export * from './local-provider'

import { Effect } from 'effect'
import type { ProviderPlugin } from '../types'
import { createMockProvider } from './mock-provider'
import { createHTTPProvider, createOpenAIProvider, createAnthropicProvider } from './http-provider'
import { createLMStudioProvider, createOllamaProvider, createLlamaCppProvider } from './local-provider'

/**
 * Provider registry for managing multiple providers
 */
export class ProviderRegistry {
  private providers: Map<string, ProviderPlugin> = new Map()
  private defaultProvider: string | null = null

  /**
   * Register a provider
   */
  register(name: string, provider: ProviderPlugin): void {
    this.providers.set(name, provider)

    // Set as default if it's the first provider
    if (!this.defaultProvider) {
      this.defaultProvider = name
    }
  }

  /**
   * Get a provider by name
   */
  get(name: string): ProviderPlugin | undefined {
    return this.providers.get(name)
  }

  /**
   * Get the default provider
   */
  getDefault(): ProviderPlugin | undefined {
    return this.defaultProvider ? this.providers.get(this.defaultProvider) : undefined
  }

  /**
   * Set the default provider
   */
  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' not found`)
    }
    this.defaultProvider = name
  }

  /**
   * List all registered providers
   */
  list(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Initialize all providers
   */
  async initializeAll(): Promise<void> {
    const initializations = Array.from(this.providers.values()).map((provider) =>
      Effect.runPromise(provider.initialize().pipe(Effect.catchAll(() => Effect.succeed(undefined))))
    )

    await Promise.all(initializations)
  }

  /**
   * Cleanup all providers
   */
  async cleanupAll(): Promise<void> {
    const cleanups = Array.from(this.providers.values()).map((provider) =>
      provider.cleanup ? Effect.runPromise(provider.cleanup()) : Promise.resolve()
    )

    await Promise.all(cleanups)
  }
}

/**
 * Auto-detect and create the best available provider
 */
export async function createAutoProvider(): Promise<ProviderPlugin> {
  // Check environment variables
  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (openaiKey) {
    return createOpenAIProvider(openaiKey)
  }

  if (anthropicKey) {
    return createAnthropicProvider(anthropicKey)
  }

  // Check for local model servers
  const lmstudioAvailable = await checkLocalServer('http://localhost:1234/v1/models')
  if (lmstudioAvailable) {
    return createLMStudioProvider()
  }

  const ollamaAvailable = await checkLocalServer('http://localhost:11434/api/tags')
  if (ollamaAvailable) {
    return createOllamaProvider()
  }

  const llamacppAvailable = await checkLocalServer('http://localhost:8080/health')
  if (llamacppAvailable) {
    return createLlamaCppProvider()
  }

  // Fallback to mock provider
  console.warn('No LLM provider available, using mock provider')
  return createMockProvider()
}

/**
 * Check if a local server is available
 */
async function checkLocalServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(1000)
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Create a provider from environment configuration
 */
export function createProviderFromEnv(): ProviderPlugin | null {
  const providerType = process.env.LLM_PROVIDER

  switch (providerType) {
    case 'openai':
      const openaiKey = process.env.OPENAI_API_KEY
      if (!openaiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required')
      }
      return createOpenAIProvider(openaiKey, {
        model: process.env.OPENAI_MODEL
      })

    case 'anthropic':
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (!anthropicKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required')
      }
      return createAnthropicProvider(anthropicKey, {
        model: process.env.ANTHROPIC_MODEL
      })

    case 'lmstudio':
      return createLMStudioProvider({
        endpoint: process.env.LMSTUDIO_ENDPOINT,
        model: process.env.LMSTUDIO_MODEL
      })

    case 'ollama':
      return createOllamaProvider(process.env.OLLAMA_MODEL, {
        endpoint: process.env.OLLAMA_ENDPOINT
      })

    case 'mock':
      return createMockProvider()

    default:
      return null
  }
}

/**
 * Create a multi-provider that tries multiple providers in sequence
 */
export class MultiProvider implements ProviderPlugin {
  readonly name = 'multi-provider'
  readonly version = '1.0.0'
  readonly capabilities = ['fallback', 'load-balancing']

  constructor(
    private providers: ProviderPlugin[],
    private strategy: 'fallback' | 'round-robin' | 'least-latency' = 'fallback'
  ) {
    if (providers.length === 0) {
      throw new Error('At least one provider is required')
    }
  }

  initialize(): Effect.Effect<void, any> {
    return Effect.gen(
      function* (_) {
        // Try to initialize each provider
        for (const provider of this.providers) {
          yield* _(provider.initialize().pipe(Effect.catchAll(() => Effect.succeed(undefined))))
        }
      }.bind(this)
    )
  }

  cleanup(): Effect.Effect<void, never> {
    return Effect.gen(
      function* (_) {
        for (const provider of this.providers) {
          if (provider.cleanup) {
            yield* _(provider.cleanup())
          }
        }
      }.bind(this)
    )
  }

  generate(prompt: string, options?: any): Effect.Effect<any, any> {
    if (this.strategy === 'fallback') {
      // Try each provider in sequence until one succeeds
      return this.providers.reduce(
        (effect, provider) => effect.pipe(Effect.catchAll(() => provider.generate(prompt, options))),
        Effect.fail(new Error('All providers failed'))
      )
    }

    // Other strategies would be implemented here
    return this.providers[0].generate(prompt, options)
  }

  stream(prompt: string, options?: any): any {
    // Delegate to first available provider for now
    return this.providers[0].stream(prompt, options)
  }

  generateStructured<T>(prompt: string, schema: any, options?: any): Effect.Effect<T, any> {
    if (this.providers[0].generateStructured) {
      return this.providers[0].generateStructured(prompt, schema, options)
    }

    // Fallback to regular generation
    return this.generate(prompt, options).pipe(
      Effect.map((result) => result.text),
      Effect.flatMap((text) => Effect.try(() => JSON.parse(text)))
    )
  }
}

/**
 * Create a multi-provider with fallback
 */
export function createMultiProvider(
  providers: ProviderPlugin[],
  strategy?: 'fallback' | 'round-robin' | 'least-latency'
): MultiProvider {
  return new MultiProvider(providers, strategy)
}
