import { describe, it, expect } from 'bun:test'
import {
  getGlobalConfig,
  getAppConfig,
  getModelsConfig,
  LOW_MODEL_CONFIG,
  MEDIUM_MODEL_CONFIG,
  HIGH_MODEL_CONFIG,
  filesConfig,
  providersConfig
} from './index'

describe('Config Package', () => {
  it('should export global config', () => {
    const config = getGlobalConfig()
    expect(config).toBeDefined()
    expect(config.app).toBeDefined()
    expect(config.server).toBeDefined()
    expect(config.models).toBeDefined()
    expect(config.providers).toBeDefined()
    expect(config.files).toBeDefined()
  })

  it('should export app config', () => {
    const app = getAppConfig()
    expect(app.name).toBe('Promptliano')
    expect(app.version).toBe('0.8.0')
  })

  it('should export model configs', () => {
    const models = getModelsConfig()
    expect(models.low).toEqual(LOW_MODEL_CONFIG)
    expect(models.medium).toEqual(MEDIUM_MODEL_CONFIG)
    expect(models.high).toEqual(HIGH_MODEL_CONFIG)
  })

  it('should export files config', () => {
    expect(filesConfig.allowedExtensions).toContain('.ts')
    expect(filesConfig.defaultExclusions).toContain('node_modules/')
  })

  it('should export providers config', () => {
    expect(providersConfig.openai.baseURL).toBe('https://api.openai.com/v1')
    expect(providersConfig.anthropic.baseURL).toBe('https://api.anthropic.com/v1')
  })
})
