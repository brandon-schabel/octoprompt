import { describe, it, expect } from 'bun:test'
import {
  TestProviderRequestSchema,
  TestProviderResponseSchema,
  BatchTestProviderRequestSchema,
  BatchTestProviderResponseSchema,
  ProviderHealthStatusSchema,
  ProviderModelSchema,
  ProviderStatusEnum,
  ProviderHealthStatusEnum
} from './provider-key.schemas'

describe('Provider Testing Schemas', () => {
  describe('ProviderModelSchema', () => {
    it('should validate a basic model', () => {
      const model = {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini'
      }
      const result = ProviderModelSchema.safeParse(model)
      expect(result.success).toBe(true)
    })

    it('should validate a model with description', () => {
      const model = {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast and efficient GPT-4 model optimized for speed'
      }
      const result = ProviderModelSchema.safeParse(model)
      expect(result.success).toBe(true)
    })
  })

  describe('TestProviderRequestSchema', () => {
    it('should validate API provider test request', () => {
      const request = {
        provider: 'openai',
        apiKey: 'sk-xxxxxxxxxxxxxxxxxxxx',
        timeout: 10000
      }
      const result = TestProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.timeout).toBe(10000)
      }
    })

    it('should validate local provider test request', () => {
      const request = {
        provider: 'ollama',
        url: 'http://localhost:11434'
      }
      const result = TestProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.timeout).toBe(10000) // default value
      }
    })

    it('should use default timeout when not provided', () => {
      const request = {
        provider: 'anthropic',
        apiKey: 'sk-ant-xxxxxxxx'
      }
      const result = TestProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.timeout).toBe(10000)
      }
    })

    it('should reject invalid URL', () => {
      const request = {
        provider: 'ollama',
        url: 'invalid-url'
      }
      const result = TestProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })
  })

  describe('TestProviderResponseSchema', () => {
    it('should validate successful response', () => {
      const response = {
        success: true,
        provider: 'openai',
        status: 'connected' as const,
        models: [
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'gpt-4o', name: 'GPT-4o', description: 'Most advanced GPT-4 model' }
        ],
        responseTime: 1250,
        testedAt: 1716537600000
      }
      const result = TestProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate error response', () => {
      const response = {
        success: false,
        provider: 'openai',
        status: 'error' as const,
        models: [],
        responseTime: 500,
        error: 'Invalid API key',
        testedAt: 1716537600000
      }
      const result = TestProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })
  })

  describe('BatchTestProviderRequestSchema', () => {
    it('should validate batch test request', () => {
      const request = {
        providers: [
          { provider: 'openai', apiKey: 'sk-xxx' },
          { provider: 'ollama', url: 'http://localhost:11434' }
        ],
        parallel: true
      }
      const result = BatchTestProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should use default parallel value', () => {
      const request = {
        providers: [{ provider: 'openai', apiKey: 'sk-xxx' }]
      }
      const result = BatchTestProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.parallel).toBe(true)
      }
    })

    it('should reject empty providers array', () => {
      const request = {
        providers: []
      }
      const result = BatchTestProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })
  })

  describe('BatchTestProviderResponseSchema', () => {
    it('should validate batch test response', () => {
      const response = {
        results: [
          {
            success: true,
            provider: 'openai',
            status: 'connected' as const,
            models: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }],
            responseTime: 1250,
            testedAt: 1716537600000
          }
        ],
        summary: {
          connected: 1,
          disconnected: 0,
          error: 0
        },
        totalTime: 1250
      }
      const result = BatchTestProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })
  })

  describe('ProviderHealthStatusSchema', () => {
    it('should validate health status', () => {
      const status = {
        provider: 'openai',
        status: 'healthy' as const,
        lastChecked: 1716537600000,
        uptime: 99.8,
        averageResponseTime: 850,
        modelCount: 12
      }
      const result = ProviderHealthStatusSchema.safeParse(status)
      expect(result.success).toBe(true)
    })

    it('should reject invalid uptime percentage', () => {
      const status = {
        provider: 'openai',
        status: 'healthy' as const,
        lastChecked: 1716537600000,
        uptime: 150, // Invalid: over 100%
        averageResponseTime: 850,
        modelCount: 12
      }
      const result = ProviderHealthStatusSchema.safeParse(status)
      expect(result.success).toBe(false)
    })
  })

  describe('Enum Schemas', () => {
    it('should validate provider status enum values', () => {
      expect(ProviderStatusEnum.safeParse('connected').success).toBe(true)
      expect(ProviderStatusEnum.safeParse('disconnected').success).toBe(true)
      expect(ProviderStatusEnum.safeParse('error').success).toBe(true)
      expect(ProviderStatusEnum.safeParse('invalid').success).toBe(false)
    })

    it('should validate health status enum values', () => {
      expect(ProviderHealthStatusEnum.safeParse('healthy').success).toBe(true)
      expect(ProviderHealthStatusEnum.safeParse('degraded').success).toBe(true)
      expect(ProviderHealthStatusEnum.safeParse('unhealthy').success).toBe(true)
      expect(ProviderHealthStatusEnum.safeParse('unknown').success).toBe(true)
      expect(ProviderHealthStatusEnum.safeParse('invalid').success).toBe(false)
    })
  })
})
