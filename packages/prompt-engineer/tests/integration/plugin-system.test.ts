/**
 * Plugin System Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Effect, pipe, Schema } from 'effect'
import { PromptEngineer, createPromptEngineer } from '../../src'
import { createMemoryStorage } from '../../src/plugins/storage/memory-storage'
import { createFileStorage } from '../../src/plugins/storage/file-storage'
import { createMockProvider } from '../../src/plugins/providers/mock-provider'
import { getUnifiedMonitoring, initializeMonitoring, shutdownMonitoring } from '../../src/monitoring'
import type { OptimizedPrompt } from '../../src/types'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('Plugin System Integration', () => {
  let engineer: PromptEngineer
  const testCacheDir = path.join(process.cwd(), '.test-cache')
  
  beforeEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {}
    
    engineer = new PromptEngineer({
      defaultOptimizer: 'scot',
      enableCaching: true
    })
  })
  
  afterEach(async () => {
    await engineer.cleanup()
    
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {}
    
    // Shutdown monitoring
    await Effect.runPromise(shutdownMonitoring())
  })
  
  describe('Storage Plugins', () => {
    it('should initialize and use memory storage', async () => {
      const storage = createMemoryStorage({ maxSize: 10 })
      
      await Effect.runPromise(storage.initialize())
      
      // Test basic operations
      await Effect.runPromise(storage.set('test-key', { value: 'test' }, 1000))
      
      const result = await Effect.runPromise(storage.get('test-key'))
      expect(result).not.toBeNull()
      expect(result?.value).toEqual({ value: 'test' })
      
      // Test has
      const exists = await Effect.runPromise(storage.has('test-key'))
      expect(exists).toBe(true)
      
      // Test keys
      const keys = await Effect.runPromise(storage.keys())
      expect(keys).toContain('test-key')
      
      // Test delete
      await Effect.runPromise(storage.delete('test-key'))
      const afterDelete = await Effect.runPromise(storage.get('test-key'))
      expect(afterDelete).toBeNull()
      
      await Effect.runPromise(storage.cleanup?.() || Effect.succeed(undefined))
    })
    
    it('should handle TTL expiration in memory storage', async () => {
      const storage = createMemoryStorage()
      await Effect.runPromise(storage.initialize())
      
      // Set with short TTL
      await Effect.runPromise(storage.set('expire-key', 'value', 100))
      
      // Should exist immediately
      const immediate = await Effect.runPromise(storage.get('expire-key'))
      expect(immediate).not.toBeNull()
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Should be expired
      const expired = await Effect.runPromise(storage.get('expire-key'))
      expect(expired).toBeNull()
    })
    
    it('should initialize and use file storage', async () => {
      const storage = createFileStorage({
        directory: testCacheDir,
        compress: false,
        encrypt: false
      })
      
      await Effect.runPromise(storage.initialize())
      
      // Test operations
      const testData = { content: 'test file storage', timestamp: Date.now() }
      await Effect.runPromise(storage.set('file-test', testData))
      
      const result = await Effect.runPromise(storage.get('file-test'))
      expect(result).not.toBeNull()
      expect(result?.value).toEqual(testData)
      
      // Verify file exists
      const files = await fs.readdir(testCacheDir)
      expect(files.length).toBeGreaterThan(0)
      
      // Clear and verify
      await Effect.runPromise(storage.clear())
      const keysAfterClear = await Effect.runPromise(storage.keys())
      expect(keysAfterClear).toHaveLength(0)
      
      await Effect.runPromise(storage.cleanup?.() || Effect.succeed(undefined))
    })
    
    it('should handle encryption in file storage', async () => {
      const storage = createFileStorage({
        directory: testCacheDir,
        encrypt: true,
        encryptionKey: 'test-encryption-key-32-chars-long!!'
      })
      
      await Effect.runPromise(storage.initialize())
      
      const sensitiveData = { secret: 'confidential information' }
      await Effect.runPromise(storage.set('encrypted', sensitiveData))
      
      // Read back and verify
      const decrypted = await Effect.runPromise(storage.get('encrypted'))
      expect(decrypted?.value).toEqual(sensitiveData)
      
      // Verify file is actually encrypted
      const files = await fs.readdir(testCacheDir)
      const encryptedFile = files.find(f => f.includes('encrypted'))
      if (encryptedFile) {
        const rawContent = await fs.readFile(
          path.join(testCacheDir, encryptedFile),
          'utf-8'
        )
        expect(rawContent).not.toContain('confidential information')
        expect(rawContent).toContain('encrypted') // Should see encryption metadata
      }
    })
  })
  
  describe('Provider Plugins', () => {
    it('should initialize and use mock provider', async () => {
      const provider = createMockProvider({
        delay: 10,
        mockModel: 'test-model'
      })
      
      await Effect.runPromise(provider.initialize())
      
      // Test generation
      const result = await Effect.runPromise(
        provider.generate('Optimize this prompt', { temperature: 0.5 })
      )
      
      expect(result.text).toBeTruthy()
      expect(result.model).toBe('test-model')
      expect(result.usage).toBeDefined()
      expect(result.usage?.promptTokens).toBeGreaterThan(0)
    })
    
    it('should handle streaming with mock provider', async () => {
      const provider = createMockProvider({
        delay: 5,
        streamChunkSize: 3
      })
      
      await Effect.runPromise(provider.initialize())
      
      const chunks: string[] = []
      
      await Effect.runPromise(
        provider.stream('Generate a story').pipe(
          Effect.tap(chunk => Effect.sync(() => chunks.push(chunk))),
          Effect.runCollect
        )
      )
      
      expect(chunks.length).toBeGreaterThan(0)
      const fullText = chunks.join('')
      expect(fullText).toBeTruthy()
    })
    
    it('should handle structured generation', async () => {
      const provider = createMockProvider()
      await Effect.runPromise(provider.initialize())
      
      // Simple schema for testing
      const ResultSchema = Schema.Struct({
        result: Schema.String,
        data: Schema.Struct({
          value: Schema.Number,
          message: Schema.String
        })
      })
      
      const structured = await Effect.runPromise(
        provider.generateStructured(
          'Generate structured data',
          ResultSchema
        )
      )
      
      expect(structured.result).toBeDefined()
      expect(structured.data.value).toBeDefined()
      expect(structured.data.message).toBeDefined()
    })
    
    it('should handle provider errors', async () => {
      const provider = createMockProvider({ errorRate: 1 })
      await Effect.runPromise(provider.initialize())
      
      const result = await Effect.runPromise(
        provider.generate('Test').pipe(
          Effect.catchAll(error => Effect.succeed({ error: error.message }))
        )
      )
      
      expect(result).toHaveProperty('error')
    })
  })
  
  describe('Monitoring Integration', () => {
    it('should track optimization events', async () => {
      const monitoring = getUnifiedMonitoring({
        enabled: true,
        metrics: { enabled: true }
      })
      
      await Effect.runPromise(monitoring.initialize())
      
      // Create and monitor an optimization
      const engineer = new PromptEngineer()
      const prompt = 'Optimize this test prompt for clarity'
      
      // Wrap optimization with monitoring
      const optimized = await Effect.runPromise(
        monitoring.monitorOptimization(
          'scot',
          prompt,
          Effect.succeed({
            originalPrompt: prompt,
            optimizedPrompt: 'OPTIMIZED: ' + prompt,
            systemPrompt: 'System',
            userPrompt: 'User',
            reasoningStructure: {
              sequences: [],
              branches: [],
              loops: [],
              dataFlow: [],
              complexity: { cognitive: 5, computational: 5, structural: 5, overall: 5 }
            },
            optimizationStrategy: {
              name: 'test',
              techniques: ['test'],
              parameters: {},
              confidence: 0.8
            },
            estimatedTokens: 50,
            improvementScore: 25,
            metadata: {
              optimizerId: 'test',
              timestamp: Date.now(),
              duration: 100,
              cacheable: true
            }
          } as OptimizedPrompt)
        )
      )
      
      expect(optimized).toBeDefined()
      
      // Check dashboard data
      const dashboard = await Effect.runPromise(monitoring.getDashboard())
      expect(dashboard.events.length).toBeGreaterThan(0)
      expect(dashboard.health.status).toBe('healthy')
    })
    
    it('should track cache operations', async () => {
      const monitoring = getUnifiedMonitoring()
      const storage = createMemoryStorage()
      
      await Effect.runPromise(storage.initialize())
      await Effect.runPromise(monitoring.initialize())
      
      // Monitor cache operations
      await Effect.runPromise(
        monitoring.monitorCache(
          'set',
          'cache-key',
          'memory',
          storage.set('cache-key', 'value')
        )
      )
      
      // Cache hit
      await Effect.runPromise(
        monitoring.monitorCache(
          'get',
          'cache-key',
          'memory',
          storage.get('cache-key')
        )
      )
      
      // Cache miss
      await Effect.runPromise(
        monitoring.monitorCache(
          'get',
          'missing-key',
          'memory',
          storage.get('missing-key')
        )
      )
      
      const metrics = await Effect.runPromise(
        monitoring.getMonitoringService().getMetricsSnapshot()
      )
      
      expect(metrics['cache.hits']).toBeGreaterThanOrEqual(1)
      expect(metrics['cache.misses']).toBeGreaterThanOrEqual(1)
    })
  })
  
  describe('Full Plugin Integration', () => {
    it('should work with storage and provider plugins together', async () => {
      const storage = createMemoryStorage()
      const provider = createMockProvider({ delay: 10 })
      
      await Effect.runPromise(storage.initialize())
      await Effect.runPromise(provider.initialize())
      
      const engineer = await createPromptEngineer({
        plugins: [storage, provider],
        enableCaching: true
      })
      
      // First optimization (cache miss)
      const prompt = 'Test prompt for integration'
      const result1 = await engineer.optimize(prompt, {
        optimizer: 'scot',
        cache: true
      })
      
      expect(result1).toBeDefined()
      expect(result1.optimizedPrompt).toBeTruthy()
      
      // Second optimization (should be from cache)
      const result2 = await engineer.optimize(prompt, {
        optimizer: 'scot',
        cache: true
      })
      
      expect(result2).toEqual(result1)
      
      await engineer.cleanup()
    })
  })
})

describe('Plugin Error Handling', () => {
  it('should handle storage plugin initialization errors gracefully', async () => {
    const storage = createFileStorage({
      directory: '/invalid/path/that/does/not/exist'
    })
    
    const result = await Effect.runPromise(
      storage.initialize().pipe(
        Effect.catchAll(error => Effect.succeed({ error: error.message }))
      )
    )
    
    expect(result).toHaveProperty('error')
  })
  
  it('should handle provider plugin errors gracefully', async () => {
    const provider = createMockProvider()
    provider.simulateFailure()
    
    const result = await Effect.runPromise(
      provider.generate('test').pipe(
        Effect.catchAll(error => Effect.succeed({ error: error.message }))
      )
    )
    
    expect(result).toHaveProperty('error')
  })
})