// ============================================================================
// @promptliano/prompt-engineer
// Advanced prompt optimization package for the Promptliano ecosystem
// ============================================================================

export * from './types'
export * from './optimizers'
export * from './strategies'
export * from './plugins'
export * from './providers'
// export * from './analyzers' // TODO: implement
// export * from './templates' // TODO: implement

// ============================================================================
// Main API
// ============================================================================

import { createSCoTOptimizer } from './optimizers/scot'
import { createSelfConsistencyOptimizer } from './optimizers/self-consistency'
import { createContextOptimizer } from './optimizers/context'
import { createPromptWizardOptimizer } from './optimizers/prompt-wizard'
import type { Optimizer, OptimizedPrompt, PromptAnalysis } from './types'
import type { PromptEngineerPlugin, ProviderPlugin, StoragePlugin } from './plugins/types'
import { getPluginSystem, type PluginSystem } from './plugins'
import { getProviderManager, type ProviderManager } from './providers'
import { Effect } from 'effect'

export interface PromptEngineerConfig {
  optimizers?: string[]
  defaultOptimizer?: string
  enableCaching?: boolean
  parallelOptimization?: boolean
  plugins?: (string | PromptEngineerPlugin)[]
}

export class PromptEngineer {
  private optimizers: Map<string, Optimizer> = new Map()
  private defaultOptimizer: string = 'scot'
  private config: PromptEngineerConfig
  private pluginSystem: PluginSystem | null = null
  private providerManager: ProviderManager | null = null
  private initialized: boolean = false

  constructor(config?: PromptEngineerConfig) {
    this.config = config || {}

    // Initialize default optimizers
    this.registerOptimizer('scot', createSCoTOptimizer())
    this.registerOptimizer('self-consistency', createSelfConsistencyOptimizer())
    this.registerOptimizer('context', createContextOptimizer())
    this.registerOptimizer('prompt-wizard', createPromptWizardOptimizer())

    if (config?.defaultOptimizer) {
      this.defaultOptimizer = config.defaultOptimizer
    }
  }

  /**
   * Initialize the prompt engineer with plugins
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Initialize plugin system
    this.pluginSystem = getPluginSystem()
    await this.pluginSystem.initialize(this.config.plugins)

    // Initialize provider manager
    this.providerManager = getProviderManager()
    await this.providerManager.initialize()

    // Register provider plugins with the provider manager
    const providerPlugins = await this.pluginSystem.listPlugins()
    for (const plugin of providerPlugins) {
      if ('generate' in plugin) {
        const providerPlugin = plugin as ProviderPlugin
        await this.providerManager.register(plugin.name, {
          name: plugin.name,
          models: [],
          generate: (messages, options) => providerPlugin.generate(messages.map((m) => m.content).join('\n'), options),
          stream: providerPlugin.stream,
          generateStructured: providerPlugin.generateStructured
        } as any)
      }
    }

    this.initialized = true
  }

  registerOptimizer(name: string, optimizer: Optimizer): void {
    this.optimizers.set(name, optimizer)
  }

  async optimize(
    prompt: string,
    options?: {
      optimizer?: string
      context?: any
      provider?: string
      cache?: boolean
    }
  ): Promise<OptimizedPrompt> {
    // Initialize if needed
    if (!this.initialized && (options?.provider || options?.cache)) {
      await this.initialize()
    }

    const optimizerName = options?.optimizer || this.defaultOptimizer
    const optimizer = this.optimizers.get(optimizerName)

    if (!optimizer) {
      throw new Error(`Optimizer '${optimizerName}' not found`)
    }

    // Check cache if enabled
    if (options?.cache && this.pluginSystem) {
      const storage = await this.pluginSystem.getStorage()
      if (storage) {
        const cacheKey = `optimize:${optimizerName}:${prompt}`
        const cached = await Effect.runPromise(
          storage.get<OptimizedPrompt>(cacheKey).pipe(Effect.catchAll(() => Effect.succeed(null)))
        )
        if (cached && cached.value) {
          return cached.value
        }
      }
    }

    const result = await optimizer.optimizeAsync(prompt, options?.context)()

    if (result._tag === 'Left') {
      throw result.left
    }

    const optimized = result.right

    // Cache result if enabled
    if (options?.cache && this.pluginSystem) {
      const storage = await this.pluginSystem.getStorage()
      if (storage) {
        const cacheKey = `optimize:${optimizerName}:${prompt}`
        await Effect.runPromise(
          storage.set(cacheKey, optimized, 3600000).pipe(
            // 1 hour TTL
            Effect.catchAll(() => Effect.succeed(undefined))
          )
        )
      }
    }

    return optimized
  }

  analyze(prompt: string, optimizer?: string): PromptAnalysis {
    const optimizerName = optimizer || this.defaultOptimizer
    const opt = this.optimizers.get(optimizerName)

    if (!opt) {
      throw new Error(`Optimizer '${optimizerName}' not found`)
    }

    const result = opt.analyze(prompt)

    if (result._tag === 'Left') {
      throw result.left
    }

    return result.right
  }

  listOptimizers(): string[] {
    return Array.from(this.optimizers.keys())
  }

  supportsFeature(feature: string, optimizer?: string): boolean {
    const optimizerName = optimizer || this.defaultOptimizer
    const opt = this.optimizers.get(optimizerName)

    return opt ? opt.supports(feature) : false
  }

  /**
   * Register a plugin
   */
  async registerPlugin(plugin: PromptEngineerPlugin): Promise<void> {
    if (!this.pluginSystem) {
      await this.initialize()
    }
    await this.pluginSystem!.register(plugin)
  }

  /**
   * Get the plugin system
   */
  getPluginSystem(): PluginSystem | null {
    return this.pluginSystem
  }

  /**
   * Get the provider manager
   */
  getProviderManager(): ProviderManager | null {
    return this.providerManager
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.pluginSystem) {
      await this.pluginSystem.cleanup()
    }
    this.initialized = false
  }
}

// Export default instance
export const promptEngineer = new PromptEngineer()

// ============================================================================
// Quick Setup Functions
// ============================================================================

/**
 * Create a configured PromptEngineer instance
 */
export async function createPromptEngineer(config?: PromptEngineerConfig): Promise<PromptEngineer> {
  const engineer = new PromptEngineer(config)
  if (config?.plugins || config?.enableCaching) {
    await engineer.initialize()
  }
  return engineer
}

/**
 * Quick optimization function
 */
export async function optimizePrompt(
  prompt: string,
  options?: {
    optimizer?: string
    provider?: string
    cache?: boolean
  }
): Promise<OptimizedPrompt> {
  return promptEngineer.optimize(prompt, options)
}

/**
 * Quick analysis function
 */
export function analyzePrompt(prompt: string, optimizer?: string): PromptAnalysis {
  return promptEngineer.analyze(prompt, optimizer)
}
