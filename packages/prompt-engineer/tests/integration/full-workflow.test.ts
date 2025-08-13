/**
 * Integration Tests - Full Workflow
 * End-to-end testing of the prompt engineering pipeline
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { Effect } from 'effect'
import { PromptEngineer } from '../../src'
import { createMemoryStorage } from '../../src/plugins/storage'
import { createMockProvider } from '../../src/plugins/providers'
import { createSCoTOptimizer } from '../../src/optimizers/scot'
import { createSelfConsistencyOptimizer } from '../../src/optimizers/self-consistency'
import { createContextOptimizer } from '../../src/optimizers/context'
import { createSecurityManager } from '../../src/security'
import { createMultiModalManager } from '../../src/adapters/multimodal'
import { createBenchmarkRunner } from '../../src/benchmarks/datasets'

describe('Full Workflow Integration', () => {
  let engineer: PromptEngineer
  
  beforeEach(async () => {
    engineer = new PromptEngineer({
      plugins: [
        createMemoryStorage(),
        createMockProvider({
          responses: {
            'default': 'Test response',
            'optimized': 'Better response',
            'secure': 'Safe response'
          }
        })
      ]
    })
    
    await engineer.initialize()
  })
  
  describe('optimization pipeline', () => {
    it('should run complete optimization workflow', async () => {
      const prompt = 'Explain quantum computing to a beginner'
      
      // 1. Security check
      const security = createSecurityManager()
      const securityAnalysis = await Effect.runPromise(
        security.analyzePrompt(prompt)
      )
      expect(securityAnalysis.riskLevel).toBe('safe')
      
      // 2. Apply SCoT optimization
      const scotOptimizer = createSCoTOptimizer()
      const scotOptimized = await Effect.runPromise(
        scotOptimizer.optimize(prompt)
      )
      expect(scotOptimized.improved).toContain('Step 1:')
      
      // 3. Apply self-consistency
      const selfConsistency = createSelfConsistencyOptimizer()
      const consistentPrompt = await Effect.runPromise(
        selfConsistency.optimize(scotOptimized.improved)
      )
      expect(consistentPrompt.improved).toBeDefined()
      
      // 4. Context optimization
      const contextOptimizer = createContextOptimizer()
      const contextOptimized = await Effect.runPromise(
        contextOptimizer.optimize(consistentPrompt.improved, {
          maxTokens: 500,
          preserveIntent: true
        })
      )
      expect(contextOptimized.improved.length).toBeLessThanOrEqual(500)
      
      // 5. Final security validation
      const finalAnalysis = await Effect.runPromise(
        security.analyzePrompt(contextOptimized.improved)
      )
      expect(finalAnalysis.riskLevel).toBe('safe')
      
      // 6. Execute with provider
      const result = await engineer.executePrompt(contextOptimized.improved)
      expect(result.response).toBeDefined()
      expect(result.metadata.optimizationsApplied).toBeGreaterThan(0)
    })
    
    it('should handle prompt evolution workflow', async () => {
      const initialPrompt = 'Write a function to sort numbers'
      
      // Evolve through multiple iterations
      let currentPrompt = initialPrompt
      const evolution = []
      
      for (let i = 0; i < 3; i++) {
        const result = await engineer.evolvePrompt(currentPrompt, {
          strategy: 'performance',
          targetMetric: 'clarity'
        })
        
        evolution.push({
          iteration: i + 1,
          prompt: result.evolved,
          score: result.score
        })
        
        currentPrompt = result.evolved
        
        // Score should improve
        if (i > 0) {
          expect(result.score).toBeGreaterThan(evolution[i - 1].score)
        }
      }
      
      expect(evolution).toHaveLength(3)
      expect(evolution[2].score).toBeGreaterThan(evolution[0].score)
    })
  })
  
  describe('multi-modal pipeline', () => {
    it('should process multi-modal content end-to-end', async () => {
      const multiModal = createMultiModalManager()
      
      // Process different media types
      const items = [
        {
          data: Buffer.from('image-content'),
          type: 'image' as const,
          metadata: { id: 'img1' }
        },
        {
          data: Buffer.from('audio-content'),
          type: 'audio' as const,
          metadata: { id: 'audio1' }
        },
        {
          data: Buffer.from('document-content'),
          type: 'document' as const,
          metadata: { id: 'doc1' }
        }
      ]
      
      // Process individually
      const processedItems = await Effect.runPromise(
        multiModal.processBatch(items)
      )
      expect(processedItems).toHaveLength(3)
      
      // Analyze relationships
      const analysis = await Effect.runPromise(
        multiModal.analyzeMultiModal(items)
      )
      expect(analysis.relationships).toBeDefined()
      expect(analysis.insights).toBeDefined()
      
      // Extract unified content
      const unified = await Effect.runPromise(
        multiModal.extractUnifiedContent(items)
      )
      expect(unified.text).toBeDefined()
      expect(unified.entities).toBeDefined()
      
      // Generate prompt from multi-modal content
      const prompt = await engineer.generatePromptFromMedia(unified, {
        purpose: 'summarization',
        style: 'technical'
      })
      expect(prompt.text).toBeDefined()
      expect(prompt.metadata.sourceTypes).toContain('image')
      expect(prompt.metadata.sourceTypes).toContain('audio')
      expect(prompt.metadata.sourceTypes).toContain('document')
    })
  })
  
  describe('benchmark evaluation pipeline', () => {
    it('should run complete benchmark evaluation', async () => {
      const runner = createBenchmarkRunner()
      
      // Mock generation function
      const generateFn = async (task: any) => {
        // Simulate model generation
        return `def ${task.id}():\n    return "solution"`
      }
      
      // Run quick benchmark
      const quickResults = await runner.runDataset(
        'humaneval',
        generateFn,
        { maxTasks: 3 }
      )
      
      expect(quickResults.dataset).toBe('humaneval')
      expect(quickResults.results).toHaveLength(3)
      expect(quickResults.aggregateMetrics.passRate).toBeGreaterThanOrEqual(0)
      
      // Compare two models
      const model1Fn = async (task: any) => `# Model 1\n${task.prompt}`
      const model2Fn = async (task: any) => `# Model 2\n${task.prompt}`
      
      const comparison = await runner.runDataset('humaneval', model1Fn, { maxTasks: 2 })
      const comparison2 = await runner.runDataset('humaneval', model2Fn, { maxTasks: 2 })
      
      const comparisonResult = runner.compareResults(comparison, comparison2)
      expect(comparisonResult.improvement).toBeDefined()
      expect(comparisonResult.summary).toBeDefined()
    })
  })
  
  describe('complete engineering flow', () => {
    it('should handle full prompt engineering lifecycle', async () => {
      // 1. Start with raw prompt
      const rawPrompt = 'help me with coding'
      
      // 2. Security scan
      const security = createSecurityManager()
      const securityCheck = await Effect.runPromise(
        security.analyzePrompt(rawPrompt)
      )
      
      if (securityCheck.riskLevel !== 'safe') {
        const hardened = await Effect.runPromise(
          security.hardenPrompt(rawPrompt)
        )
        expect(hardened.prompt).toBeDefined()
      }
      
      // 3. Optimize for clarity
      const optimized = await engineer.optimizePrompt(rawPrompt, {
        optimizers: ['scot', 'context'],
        targetMetrics: ['clarity', 'specificity']
      })
      expect(optimized.final).not.toBe(rawPrompt)
      expect(optimized.improvements).toHaveLength(2)
      
      // 4. Store in cache
      await engineer.cachePrompt('coding-help', optimized.final, {
        tags: ['coding', 'help'],
        performance: { clarity: 0.8 }
      })
      
      // 5. Retrieve and reuse
      const cached = await engineer.getCachedPrompt('coding-help')
      expect(cached?.prompt).toBe(optimized.final)
      
      // 6. Track performance
      await engineer.trackPerformance('coding-help', {
        executionTime: 150,
        tokenCount: 50,
        userSatisfaction: 0.9
      })
      
      // 7. Analyze historical performance
      const analytics = await engineer.analyzePromptPerformance('coding-help')
      expect(analytics.averageExecutionTime).toBe(150)
      expect(analytics.averageSatisfaction).toBe(0.9)
      
      // 8. Suggest improvements based on analytics
      const suggestions = await engineer.suggestImprovements('coding-help')
      expect(suggestions).toBeDefined()
      expect(suggestions.recommendations).toBeDefined()
    })
  })
  
  describe('error handling and recovery', () => {
    it('should handle optimization failures gracefully', async () => {
      const problematicPrompt = 'a'.repeat(10000) // Very long prompt
      
      const result = await engineer.optimizePrompt(problematicPrompt, {
        optimizers: ['context'],
        fallbackStrategy: 'truncate'
      })
      
      expect(result.final.length).toBeLessThan(problematicPrompt.length)
      expect(result.warnings).toBeDefined()
      expect(result.warnings).toContain('truncated')
    })
    
    it('should handle provider failures with retry', async () => {
      let attempts = 0
      const unreliableProvider = createMockProvider({
        failureRate: 0.5,
        onRequest: () => { attempts++ }
      })
      
      const engineerWithRetry = new PromptEngineer({
        plugins: [unreliableProvider],
        config: {
          maxRetries: 3,
          retryDelay: 10
        }
      })
      
      await engineerWithRetry.initialize()
      
      const result = await engineerWithRetry.executePrompt('test', {
        retryOnFailure: true
      })
      
      expect(attempts).toBeGreaterThanOrEqual(1)
      expect(attempts).toBeLessThanOrEqual(4)
    })
    
    it('should handle multi-modal processing errors', async () => {
      const multiModal = createMultiModalManager()
      
      const corruptedImage = Buffer.from('corrupted')
      const result = await Effect.runPromise(
        Effect.either(multiModal.processMedia({
          data: corruptedImage,
          type: 'image'
        }))
      )
      
      if (result._tag === 'Left') {
        expect(result.left).toBeDefined()
      } else {
        expect(result.right.error).toBeDefined()
      }
    })
  })
  
  describe('performance and scalability', () => {
    it('should handle batch operations efficiently', async () => {
      const prompts = Array.from({ length: 10 }, (_, i) => 
        `Prompt ${i}: Explain concept ${i}`
      )
      
      const startTime = Date.now()
      const results = await engineer.optimizeBatch(prompts, {
        parallel: true,
        maxConcurrency: 5
      })
      const duration = Date.now() - startTime
      
      expect(results).toHaveLength(10)
      expect(duration).toBeLessThan(5000) // Should complete in reasonable time
      
      // All should be optimized
      results.forEach((result, i) => {
        expect(result.original).toBe(prompts[i])
        expect(result.optimized).not.toBe(prompts[i])
      })
    })
    
    it('should efficiently cache and retrieve prompts', async () => {
      // Store many prompts
      const cacheOperations = Array.from({ length: 100 }, (_, i) => 
        engineer.cachePrompt(`prompt-${i}`, `Optimized prompt ${i}`, {
          tags: [`tag-${i % 10}`]
        })
      )
      
      await Promise.all(cacheOperations)
      
      // Retrieve by tag should be fast
      const startTime = Date.now()
      const tagged = await engineer.searchCachedPrompts({ tags: ['tag-5'] })
      const searchDuration = Date.now() - startTime
      
      expect(tagged.length).toBe(10)
      expect(searchDuration).toBeLessThan(100)
    })
  })
})

describe('Plugin System Integration', () => {
  it('should integrate custom plugins', async () => {
    let customPluginCalled = false
    
    const customPlugin = {
      name: 'custom-optimizer',
      version: '1.0.0',
      initialize: async () => {
        return {
          optimize: async (prompt: string) => {
            customPluginCalled = true
            return { improved: `CUSTOM: ${prompt}`, score: 0.9 }
          }
        }
      }
    }
    
    const engineer = new PromptEngineer({
      plugins: [customPlugin]
    })
    
    await engineer.initialize()
    
    const result = await engineer.optimizePrompt('test', {
      optimizers: ['custom-optimizer']
    })
    
    expect(customPluginCalled).toBe(true)
    expect(result.final).toContain('CUSTOM:')
  })
  
  it('should handle plugin lifecycle correctly', async () => {
    const lifecycleEvents: string[] = []
    
    const lifecyclePlugin = {
      name: 'lifecycle-test',
      version: '1.0.0',
      initialize: async () => {
        lifecycleEvents.push('initialize')
        return {}
      },
      beforeOptimize: async () => {
        lifecycleEvents.push('beforeOptimize')
      },
      afterOptimize: async () => {
        lifecycleEvents.push('afterOptimize')
      },
      cleanup: async () => {
        lifecycleEvents.push('cleanup')
      }
    }
    
    const engineer = new PromptEngineer({
      plugins: [lifecyclePlugin]
    })
    
    await engineer.initialize()
    expect(lifecycleEvents).toContain('initialize')
    
    await engineer.optimizePrompt('test')
    expect(lifecycleEvents).toContain('beforeOptimize')
    expect(lifecycleEvents).toContain('afterOptimize')
    
    await engineer.cleanup()
    expect(lifecycleEvents).toContain('cleanup')
  })
})