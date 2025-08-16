import { appConfig } from '../configs/app.config'
import { filesConfig } from '../configs/files.config'
import { modelsConfig } from '../configs/models.config'
import { providersConfig } from '../configs/providers.config'
import { serverConfig } from '../configs/server.config'
import { databaseConfig } from '../configs/database.config'
import { runtimeConfig } from '../configs/runtime.config'
import { rateLimitConfig } from '../configs/rate-limit.config'
import { globalConfigSchema } from '../schemas/config.schemas'
import type { GlobalConfig } from '../types'

class ConfigLoader {
  private config: GlobalConfig
  private overrides: Partial<GlobalConfig> = {}

  constructor() {
    this.config = this.loadDefaultConfig()
  }

  private loadDefaultConfig(): GlobalConfig {
    const config = {
      app: appConfig,
      server: serverConfig,
      database: databaseConfig,
      runtime: runtimeConfig,
      models: modelsConfig,
      providers: providersConfig,
      files: filesConfig,
      rateLimit: rateLimitConfig
    }

    // Note: Validation temporarily disabled while updating schemas
    // Will be re-enabled once globalConfigSchema is updated
    // const validationResult = globalConfigSchema.safeParse(config)
    // if (!validationResult.success) {
    //   console.error('Invalid default configuration:', validationResult.error)
    //   throw new Error('Invalid default configuration')
    // }

    return config
  }

  private deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target }

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] as any, source[key] as any)
      } else if (source[key] !== undefined) {
        result[key] = source[key] as any
      }
    }

    return result
  }

  public loadEnvironmentOverrides(): void {
    // Skip environment overrides in browser
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      return
    }

    // Model overrides from environment
    if (process?.env?.DEFAULT_MODEL_PROVIDER) {
      this.overrides.models = {
        ...this.overrides.models,
        low: { ...this.config.models.low, provider: process.env.DEFAULT_MODEL_PROVIDER as any },
        medium: { ...this.config.models.medium, provider: process.env.DEFAULT_MODEL_PROVIDER as any },
        high: { ...this.config.models.high, provider: process.env.DEFAULT_MODEL_PROVIDER as any },
        planning: { ...this.config.models.planning, provider: process.env.DEFAULT_MODEL_PROVIDER as any }
      }
    }

    // Server overrides handled in server.config.ts via process.env

    this.config = this.deepMerge(this.config, this.overrides)
  }

  public setOverrides(overrides: Partial<GlobalConfig>): void {
    this.overrides = this.deepMerge(this.overrides, overrides)
    this.config = this.deepMerge(this.loadDefaultConfig(), this.overrides)
  }

  public getConfig(): GlobalConfig {
    return this.config
  }

  public get<K extends keyof GlobalConfig>(key: K): GlobalConfig[K] {
    return this.config[key]
  }

  public reset(): void {
    this.overrides = {}
    this.config = this.loadDefaultConfig()
    this.loadEnvironmentOverrides()
  }
}

// Create singleton instance
const configLoader = new ConfigLoader()
configLoader.loadEnvironmentOverrides()

export const getGlobalConfig = (): GlobalConfig => configLoader.getConfig()
export const getConfig = <K extends keyof GlobalConfig>(key: K): GlobalConfig[K] => configLoader.get(key)
export const setConfigOverrides = (overrides: Partial<GlobalConfig>): void => configLoader.setOverrides(overrides)
export const resetConfig = (): void => configLoader.reset()

// Export individual configs for convenience
export const getAppConfig = () => getConfig('app')
export const getServerConfig = () => getConfig('server')
export const getDatabaseConfig = () => getConfig('database')
export const getRuntimeConfig = () => getConfig('runtime')
export const getModelsConfig = () => getConfig('models')
export const getProvidersConfig = () => getConfig('providers')
export const getFilesConfig = () => getConfig('files')
export const getRateLimitConfig = () => getConfig('rateLimit')
