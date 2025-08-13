/**
 * Providers Module
 * Export provider abstraction and utilities
 */

export * from './types'
export * from './abstraction'

import { Effect, Layer, pipe } from 'effect'
import type {
  ProviderService,
  ProviderRegistry,
  GenerationOptions,
  GenerationResult,
  Message,
  ProviderError
} from './types'
import {
  ProviderRegistryTag
} from './types'
import {
  ProviderRegistryLive,
  createMockProvider
} from './abstraction'

// ============================================================================
// Provider Manager
// ============================================================================

export class ProviderManager {
  private registry: ProviderRegistry | null = null
  
  /**
   * Initialize the provider manager
   */
  async initialize(providers?: Record<string, ProviderService>): Promise<void> {
    const program = Effect.gen(function* (_) {
      const layer = ProviderRegistryLive
      const registry = yield* _(ProviderRegistryTag.pipe(
        Effect.provide(layer)
      ))
      
      this.registry = registry
      
      // Register initial providers if provided
      if (providers) {
        for (const [name, provider] of Object.entries(providers)) {
          yield* _(registry.register(name, provider))
        }
      }
    }.bind(this))
    
    await Effect.runPromise(program)
  }
  
  /**
   * Register a provider
   */
  async register(name: string, provider: ProviderService): Promise<void> {
    if (!this.registry) {
      throw new Error('Provider manager not initialized')
    }
    
    await Effect.runPromise(this.registry.register(name, provider))
  }
  
  /**
   * Get a provider by name
   */
  async getProvider(name?: string): Promise<ProviderService | null> {
    if (!this.registry) {
      throw new Error('Provider manager not initialized')
    }
    
    const program = name
      ? this.registry.get(name)
      : this.registry.getDefault()
    
    return Effect.runPromise(
      pipe(
        program,
        Effect.catchAll(() => Effect.succeed(null))
      )
    )
  }
  
  /**
   * Generate text using a provider
   */
  async generate(
    messages: Message[],
    options?: GenerationOptions & { provider?: string }
  ): Promise<GenerationResult> {
    if (!this.registry) {
      throw new Error('Provider manager not initialized')
    }
    
    const program = Effect.gen(function* (_) {
      const provider = options?.provider
        ? yield* _(this.registry!.get(options.provider))
        : yield* _(this.registry!.getDefault())
      
      return yield* _(provider.generate(messages, options))
    })
    
    return Effect.runPromise(program)
  }
  
  /**
   * List available providers
   */
  async listProviders(): Promise<string[]> {
    if (!this.registry) {
      return []
    }
    
    return Effect.runPromise(this.registry.list())
  }
  
  /**
   * Set default provider
   */
  async setDefaultProvider(name: string): Promise<void> {
    if (!this.registry) {
      throw new Error('Provider manager not initialized')
    }
    
    await Effect.runPromise(this.registry.setDefault(name))
  }
}

// ============================================================================
// Global Provider Manager
// ============================================================================

let globalProviderManager: ProviderManager | null = null

/**
 * Get or create the global provider manager
 */
export function getProviderManager(): ProviderManager {
  if (!globalProviderManager) {
    globalProviderManager = new ProviderManager()
  }
  return globalProviderManager
}

/**
 * Initialize the global provider manager
 */
export async function initializeProviders(
  providers?: Record<string, ProviderService>
): Promise<ProviderManager> {
  const manager = getProviderManager()
  await manager.initialize(providers)
  return manager
}

// ============================================================================
// Quick Setup Helpers
// ============================================================================

/**
 * Setup providers with mock for testing
 */
export async function setupTestProviders(): Promise<ProviderManager> {
  const manager = getProviderManager()
  await manager.initialize({
    mock: createMockProvider('mock', 'Test response')
  })
  return manager
}

/**
 * Simple generation helper
 */
export async function generateText(
  prompt: string,
  options?: GenerationOptions & { provider?: string }
): Promise<string> {
  const manager = getProviderManager()
  const result = await manager.generate(
    [{ role: 'user', content: prompt }],
    options
  )
  return result.text
}

/**
 * Chat generation helper
 */
export async function chat(
  messages: Message[],
  options?: GenerationOptions & { provider?: string }
): Promise<GenerationResult> {
  const manager = getProviderManager()
  return manager.generate(messages, options)
}