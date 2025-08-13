/**
 * Plugin System Main Entry Point
 * Exports all plugin-related functionality
 */

export * from './types'
export * from './registry'

import { Effect, Layer, pipe } from 'effect'
import type {
  PromptEngineerPlugin,
  PluginManager,
  PluginRegistry,
  PluginConfig,
  ProviderPlugin,
  StoragePlugin,
  DatasetPlugin,
  MonitoringPlugin
} from './types'
import {
  PluginManagerTag,
  PluginRegistryTag
} from './types'
import {
  createPluginManager,
  createPluginRegistry,
  PluginManagerLive,
  PluginRegistryLive
} from './registry'

// ============================================================================
// Plugin System Facade
// ============================================================================

export class PluginSystem {
  private manager: PluginManager | null = null
  private registry: PluginRegistry | null = null
  private runtime: any = null

  /**
   * Initialize the plugin system
   */
  async initialize(
    plugins?: (string | PromptEngineerPlugin)[]
  ): Promise<void> {
    const program = Effect.gen(function* (_) {
      // Create registry and manager
      const registry = yield* _(createPluginRegistry())
      const manager = yield* _(createPluginManager(registry))
      
      // Store references
      this.registry = registry
      this.manager = manager
      
      // Load initial plugins if provided
      if (plugins && plugins.length > 0) {
        yield* _(manager.loadPlugins(plugins))
      }
      
      // Initialize all plugins
      yield* _(manager.initializeAll())
    }.bind(this))
    
    await Effect.runPromise(program)
  }

  /**
   * Register a plugin
   */
  async register(plugin: PromptEngineerPlugin): Promise<void> {
    if (!this.manager) {
      throw new Error('Plugin system not initialized')
    }
    
    await Effect.runPromise(this.manager.loadPlugin(plugin))
  }

  /**
   * Get a plugin by name
   */
  async getPlugin<T extends PromptEngineerPlugin>(
    name: string
  ): Promise<T | null> {
    if (!this.manager) {
      throw new Error('Plugin system not initialized')
    }
    
    return Effect.runPromise(
      pipe(
        this.manager.getPlugin<T>(name),
        Effect.catchAll(() => Effect.succeed(null))
      )
    )
  }

  /**
   * Get provider plugin
   */
  async getProvider(name?: string): Promise<ProviderPlugin | null> {
    if (!this.manager) return null
    
    if (name) {
      return this.getPlugin<ProviderPlugin>(name)
    }
    
    // Get first available provider
    const providers = await Effect.runPromise(
      this.manager.getPlugins<ProviderPlugin>('provider')
    )
    
    return providers[0] || null
  }

  /**
   * Get storage plugin
   */
  async getStorage(name?: string): Promise<StoragePlugin | null> {
    if (!this.manager) return null
    
    if (name) {
      return this.getPlugin<StoragePlugin>(name)
    }
    
    // Get first available storage
    const storages = await Effect.runPromise(
      this.manager.getPlugins<StoragePlugin>('storage')
    )
    
    return storages[0] || null
  }

  /**
   * Get dataset plugin
   */
  async getDataset(name: string): Promise<DatasetPlugin | null> {
    return this.getPlugin<DatasetPlugin>(name)
  }

  /**
   * Get monitoring plugin
   */
  async getMonitoring(): Promise<MonitoringPlugin | null> {
    if (!this.manager) return null
    
    const monitors = await Effect.runPromise(
      this.manager.getPlugins<MonitoringPlugin>('monitoring')
    )
    
    return monitors[0] || null
  }

  /**
   * List all plugins
   */
  async listPlugins(): Promise<PromptEngineerPlugin[]> {
    if (!this.manager) return []
    
    return Effect.runPromise(this.manager.getPlugins())
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    if (!this.manager) return
    
    await Effect.runPromise(this.manager.cleanupAll())
    this.manager = null
    this.registry = null
  }
}

// ============================================================================
// Global Plugin System Instance
// ============================================================================

let globalPluginSystem: PluginSystem | null = null

/**
 * Get or create the global plugin system
 */
export function getPluginSystem(): PluginSystem {
  if (!globalPluginSystem) {
    globalPluginSystem = new PluginSystem()
  }
  return globalPluginSystem
}

/**
 * Initialize the global plugin system
 */
export async function initializePluginSystem(
  plugins?: (string | PromptEngineerPlugin)[]
): Promise<PluginSystem> {
  const system = getPluginSystem()
  await system.initialize(plugins)
  return system
}

// ============================================================================
// Plugin Helpers
// ============================================================================

/**
 * Create a basic plugin
 */
export function createPlugin(
  name: string,
  version: string,
  capabilities: string[] = []
): PromptEngineerPlugin {
  return {
    name,
    version,
    capabilities,
    initialize: () => Effect.succeed(undefined)
  }
}

/**
 * Check if a plugin is a provider
 */
export function isProviderPlugin(
  plugin: PromptEngineerPlugin
): plugin is ProviderPlugin {
  return 'generate' in plugin
}

/**
 * Check if a plugin is a storage plugin
 */
export function isStoragePlugin(
  plugin: PromptEngineerPlugin
): plugin is StoragePlugin {
  return 'get' in plugin && 'set' in plugin
}

/**
 * Check if a plugin is a dataset plugin
 */
export function isDatasetPlugin(
  plugin: PromptEngineerPlugin
): plugin is DatasetPlugin {
  return 'datasetName' in plugin
}

/**
 * Check if a plugin is a monitoring plugin
 */
export function isMonitoringPlugin(
  plugin: PromptEngineerPlugin
): plugin is MonitoringPlugin {
  return 'record' in plugin
}

// ============================================================================
// Re-export Layer definitions for advanced usage
// ============================================================================

export {
  PluginManagerLive,
  PluginRegistryLive,
  PluginManagerTag,
  PluginRegistryTag
}