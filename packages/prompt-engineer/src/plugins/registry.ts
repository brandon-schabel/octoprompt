/**
 * Plugin Registry Implementation
 * Manages plugin registration, lifecycle, and discovery
 */

import { Effect, Ref, Layer, Context, pipe } from 'effect'
import type { PromptEngineerPlugin, PluginRegistry, PluginType, PluginManager } from './types'
import { PluginError, PluginNotFoundError, PluginManagerTag, PluginRegistryTag, getPluginType } from './types'

// ============================================================================
// Plugin Registry Implementation
// ============================================================================

class PluginRegistryImpl implements PluginRegistry {
  constructor(private readonly plugins: Ref.Ref<Map<string, PromptEngineerPlugin>>) {}

  register(plugin: PromptEngineerPlugin): Effect.Effect<void, PluginError> {
    return Effect.gen(
      function* (_) {
        const current = yield* _(Ref.get(this.plugins))

        // Check for duplicate
        if (current.has(plugin.name)) {
          return yield* _(
            Effect.fail(
              new PluginError({
                plugin: plugin.name,
                reason: `Plugin '${plugin.name}' is already registered`,
                recoverable: true
              })
            )
          )
        }

        // Register the plugin
        const updated = new Map(current)
        updated.set(plugin.name, plugin)
        yield* _(Ref.set(this.plugins, updated))

        // Initialize plugin if it has an initialize method
        try {
          yield* _(plugin.initialize())
        } catch (error) {
          // Rollback registration on initialization failure
          const rolledBack = new Map(current)
          rolledBack.delete(plugin.name)
          yield* _(Ref.set(this.plugins, rolledBack))

          return yield* _(
            Effect.fail(
              new PluginError({
                plugin: plugin.name,
                reason: `Failed to initialize plugin: ${error}`,
                recoverable: false
              })
            )
          )
        }
      }.bind(this)
    )
  }

  unregister(name: string): Effect.Effect<void, PluginNotFoundError> {
    return Effect.gen(
      function* (_) {
        const current = yield* _(Ref.get(this.plugins))
        const plugin = current.get(name)

        if (!plugin) {
          return yield* _(
            Effect.fail(
              new PluginNotFoundError({
                pluginName: name,
                availablePlugins: Array.from(current.keys())
              })
            )
          )
        }

        // Cleanup plugin if it has a cleanup method
        if (plugin.cleanup) {
          yield* _(plugin.cleanup())
        }

        // Remove from registry
        const updated = new Map(current)
        updated.delete(name)
        yield* _(Ref.set(this.plugins, updated))
      }.bind(this)
    )
  }

  get(name: string): Effect.Effect<PromptEngineerPlugin, PluginNotFoundError> {
    return Effect.gen(
      function* (_) {
        const current = yield* _(Ref.get(this.plugins))
        const plugin = current.get(name)

        if (!plugin) {
          return yield* _(
            Effect.fail(
              new PluginNotFoundError({
                pluginName: name,
                availablePlugins: Array.from(current.keys())
              })
            )
          )
        }

        return plugin
      }.bind(this)
    )
  }

  getByType<T extends PromptEngineerPlugin>(type: PluginType): Effect.Effect<readonly T[], never> {
    return Effect.gen(
      function* (_) {
        const current = yield* _(Ref.get(this.plugins))
        const filtered = Array.from(current.values()).filter((plugin) => getPluginType(plugin) === type) as T[]

        return filtered
      }.bind(this)
    )
  }

  list(): Effect.Effect<readonly PromptEngineerPlugin[], never> {
    return Effect.gen(
      function* (_) {
        const current = yield* _(Ref.get(this.plugins))
        return Array.from(current.values())
      }.bind(this)
    )
  }

  has(name: string): Effect.Effect<boolean, never> {
    return Effect.gen(
      function* (_) {
        const current = yield* _(Ref.get(this.plugins))
        return current.has(name)
      }.bind(this)
    )
  }

  clear(): Effect.Effect<void, never> {
    return Effect.gen(
      function* (_) {
        const current = yield* _(Ref.get(this.plugins))

        // Cleanup all plugins
        for (const plugin of current.values()) {
          if (plugin.cleanup) {
            yield* _(plugin.cleanup())
          }
        }

        // Clear registry
        yield* _(Ref.set(this.plugins, new Map()))
      }.bind(this)
    )
  }
}

// ============================================================================
// Plugin Manager Implementation
// ============================================================================

class PluginManagerImpl implements PluginManager {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly initialized: Ref.Ref<Set<string>>
  ) {}

  loadPlugin(pathOrPlugin: string | PromptEngineerPlugin): Effect.Effect<void, PluginError> {
    return Effect.gen(
      function* (_) {
        let plugin: PromptEngineerPlugin

        if (typeof pathOrPlugin === 'string') {
          // Dynamic import for path-based plugins
          try {
            const module = yield* _(
              Effect.tryPromise({
                try: () => import(pathOrPlugin),
                catch: (error) =>
                  new PluginError({
                    plugin: pathOrPlugin,
                    reason: `Failed to load plugin from path: ${error}`,
                    recoverable: false
                  })
              })
            )

            // Check for default export or named export
            plugin = module.default || module.plugin

            if (!plugin) {
              return yield* _(
                Effect.fail(
                  new PluginError({
                    plugin: pathOrPlugin,
                    reason: 'No valid plugin export found',
                    recoverable: false
                  })
                )
              )
            }
          } catch (error) {
            return yield* _(
              Effect.fail(
                new PluginError({
                  plugin: pathOrPlugin,
                  reason: `Failed to load plugin: ${error}`,
                  recoverable: false
                })
              )
            )
          }
        } else {
          plugin = pathOrPlugin
        }

        // Register the plugin
        yield* _(this.registry.register(plugin))
      }.bind(this)
    )
  }

  loadPlugins(paths: readonly (string | PromptEngineerPlugin)[]): Effect.Effect<void, PluginError> {
    return Effect.gen(
      function* (_) {
        // Load plugins in parallel but handle errors gracefully
        const results = yield* _(
          Effect.all(
            paths.map((p) =>
              pipe(
                this.loadPlugin(p),
                Effect.catchAll((error) => Effect.succeed({ error, path: p }))
              )
            ),
            { concurrency: 'unbounded' }
          )
        )

        // Check for any errors
        const errors = results.filter((r) => r && 'error' in r)
        if (errors.length > 0) {
          const firstError = errors[0].error as PluginError
          return yield* _(
            Effect.fail(
              new PluginError({
                plugin: 'multiple',
                reason: `Failed to load ${errors.length} plugin(s). First error: ${firstError.reason}`,
                recoverable: false
              })
            )
          )
        }
      }.bind(this)
    )
  }

  initializeAll(): Effect.Effect<void, PluginError> {
    return Effect.gen(
      function* (_) {
        const plugins = yield* _(this.registry.list())
        const initializedSet = yield* _(Ref.get(this.initialized))

        for (const plugin of plugins) {
          if (!initializedSet.has(plugin.name)) {
            try {
              yield* _(plugin.initialize())
              const updated = new Set(initializedSet)
              updated.add(plugin.name)
              yield* _(Ref.set(this.initialized, updated))
            } catch (error) {
              return yield* _(
                Effect.fail(
                  new PluginError({
                    plugin: plugin.name,
                    reason: `Failed to initialize: ${error}`,
                    recoverable: false
                  })
                )
              )
            }
          }
        }
      }.bind(this)
    )
  }

  cleanupAll(): Effect.Effect<void, never> {
    return Effect.gen(
      function* (_) {
        const plugins = yield* _(this.registry.list())

        // Cleanup in reverse order of initialization
        const reversed = [...plugins].reverse()

        for (const plugin of reversed) {
          if (plugin.cleanup) {
            yield* _(plugin.cleanup())
          }
        }

        // Clear initialized set
        yield* _(Ref.set(this.initialized, new Set()))

        // Clear registry
        yield* _(this.registry.clear())
      }.bind(this)
    )
  }

  getPlugin<T extends PromptEngineerPlugin>(name: string): Effect.Effect<T, PluginNotFoundError> {
    return this.registry.get(name) as Effect.Effect<T, PluginNotFoundError>
  }

  getPlugins<T extends PromptEngineerPlugin>(type?: PluginType): Effect.Effect<readonly T[], never> {
    if (type) {
      return this.registry.getByType<T>(type)
    }
    return this.registry.list() as Effect.Effect<readonly T[], never>
  }
}

// ============================================================================
// Layer Definitions
// ============================================================================

export const PluginRegistryLive = Layer.effect(
  PluginRegistryTag,
  Effect.gen(function* (_) {
    const plugins = yield* _(Ref.make(new Map<string, PromptEngineerPlugin>()))
    return new PluginRegistryImpl(plugins)
  })
)

export const PluginManagerLive = Layer.effect(
  PluginManagerTag,
  Effect.gen(function* (_) {
    const registry = yield* _(PluginRegistryTag)
    const initialized = yield* _(Ref.make(new Set<string>()))
    return new PluginManagerImpl(registry, initialized)
  })
).pipe(Layer.provide(PluginRegistryLive))

// ============================================================================
// Factory Functions
// ============================================================================

export function createPluginRegistry(): Effect.Effect<PluginRegistry, never> {
  return Effect.gen(function* (_) {
    const plugins = yield* _(Ref.make(new Map<string, PromptEngineerPlugin>()))
    return new PluginRegistryImpl(plugins)
  })
}

export function createPluginManager(registry?: PluginRegistry): Effect.Effect<PluginManager, never> {
  return Effect.gen(function* (_) {
    const reg = registry || (yield* _(createPluginRegistry()))
    const initialized = yield* _(Ref.make(new Set<string>()))
    return new PluginManagerImpl(reg, initialized)
  })
}
