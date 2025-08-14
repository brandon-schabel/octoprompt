import { describe, test, expect, beforeEach } from 'bun:test'
import { PromptEngineer } from '../../../src'
import { MockOptimizer } from '../../test-utils'
import { TEST_PROMPTS } from '../../fixtures/prompts'
import type { OptimizedPrompt, PromptAnalysis } from '../../../src/types'

describe('PromptEngineer Class', () => {
  let engineer: PromptEngineer
  let mockOptimizer: MockOptimizer

  beforeEach(() => {
    engineer = new PromptEngineer()
    mockOptimizer = new MockOptimizer()
  })

  describe('Constructor and Configuration', () => {
    test('should initialize with default optimizers', () => {
      const optimizers = engineer.listOptimizers()

      expect(optimizers).toContain('scot')
      expect(optimizers).toContain('self-consistency')
      expect(optimizers).toContain('context')
      expect(optimizers.length).toBe(3)
    })

    test('should use scot as default optimizer', async () => {
      const result = await engineer.optimize(TEST_PROMPTS.simple.sorting)

      expect(result.optimizationStrategy.name).toContain('Chain-of-Thought')
    })

    test('should accept custom configuration', () => {
      const customEngineer = new PromptEngineer({
        defaultOptimizer: 'context',
        enableCaching: true,
        parallelOptimization: true
      })

      const optimizers = customEngineer.listOptimizers()
      expect(optimizers).toContain('context')
    })

    test('should allow custom default optimizer', async () => {
      const customEngineer = new PromptEngineer({
        defaultOptimizer: 'self-consistency'
      })

      const result = await customEngineer.optimize(TEST_PROMPTS.simple.greeting)
      expect(result.optimizationStrategy.name).toContain('Self-Consistency')
    })
  })

  describe('Optimizer Registration', () => {
    test('should register new optimizer', () => {
      engineer.registerOptimizer('mock', mockOptimizer)

      const optimizers = engineer.listOptimizers()
      expect(optimizers).toContain('mock')
    })

    test('should override existing optimizer', () => {
      const customMock = new MockOptimizer()
      customMock.setImprovementScore(50)

      engineer.registerOptimizer('scot', customMock)

      const result = engineer.analyze(TEST_PROMPTS.simple.sorting, 'scot')
      expect(result.improvementPotential).toBe(50)
    })

    test('should use registered optimizer for optimization', async () => {
      mockOptimizer.setImprovementScore(42)
      engineer.registerOptimizer('custom', mockOptimizer)

      const result = await engineer.optimize(TEST_PROMPTS.simple.greeting, {
        optimizer: 'custom'
      })

      expect(result.improvementScore).toBe(42)
      expect(result.optimizationStrategy.name).toBe('Mock Strategy')
    })
  })

  describe('Optimization Methods', () => {
    test('should optimize with default optimizer', async () => {
      const result = await engineer.optimize(TEST_PROMPTS.algorithmic.binarySearch)

      expect(result).toBeDefined()
      expect(result.originalPrompt).toBe(TEST_PROMPTS.algorithmic.binarySearch)
      expect(result.optimizedPrompt).toBeDefined()
      expect(result.improvementScore).toBeGreaterThan(0)
    })

    test('should optimize with specified optimizer', async () => {
      const result = await engineer.optimize(TEST_PROMPTS.decisionMaking.architecture, {
        optimizer: 'self-consistency'
      })

      expect(result.optimizationStrategy.name).toContain('Self-Consistency')
    })

    test('should pass context to optimizer', async () => {
      const context = {
        language: 'typescript',
        constraints: ['Type-safe', 'Performant'],
        examples: [{ input: '[3,1,2]', output: '[1,2,3]' }]
      }

      const result = await engineer.optimize(TEST_PROMPTS.simple.sorting, {
        context
      })

      expect(result.systemPrompt).toContain('TypeScript')
      expect(result.userPrompt).toContain('Type-safe')
    })

    test('should throw error for unknown optimizer', async () => {
      await expect(
        engineer.optimize(TEST_PROMPTS.simple.greeting, {
          optimizer: 'non-existent'
        })
      ).rejects.toThrow("Optimizer 'non-existent' not found")
    })

    test('should handle optimizer errors gracefully', async () => {
      mockOptimizer.setShouldFail(true)
      engineer.registerOptimizer('failing', mockOptimizer)

      await expect(
        engineer.optimize(TEST_PROMPTS.simple.greeting, {
          optimizer: 'failing'
        })
      ).rejects.toThrow('Mock optimization failed')
    })
  })

  describe('Analysis Methods', () => {
    test('should analyze prompt with default optimizer', () => {
      const analysis = engineer.analyze(TEST_PROMPTS.complex.dataProcessing)

      expect(analysis).toBeDefined()
      expect(analysis.structure).toBeDefined()
      expect(analysis.complexity).toBeDefined()
      expect(analysis.tokenCount).toBeGreaterThan(0)
    })

    test('should analyze with specified optimizer', () => {
      mockOptimizer.setImprovementScore(33)
      engineer.registerOptimizer('mock', mockOptimizer)

      const analysis = engineer.analyze(TEST_PROMPTS.simple.calculation, 'mock')

      expect(analysis.improvementPotential).toBe(33)
    })

    test('should throw error for unknown optimizer in analysis', () => {
      expect(() => {
        engineer.analyze(TEST_PROMPTS.simple.greeting, 'unknown')
      }).toThrow("Optimizer 'unknown' not found")
    })

    test('should handle analysis errors', () => {
      mockOptimizer.setShouldFail(true)
      engineer.registerOptimizer('failing', mockOptimizer)

      expect(() => {
        engineer.analyze(TEST_PROMPTS.simple.greeting, 'failing')
      }).toThrow('Mock analysis failed')
    })
  })

  describe('Feature Support', () => {
    test('should check feature support for default optimizer', () => {
      const supportsSequence = engineer.supportsFeature('sequence-analysis')
      const supportsUnknown = engineer.supportsFeature('unknown-feature')

      expect(supportsSequence).toBe(true) // SCoT supports this
      expect(supportsUnknown).toBe(false)
    })

    test('should check feature support for specific optimizer', () => {
      const supportsMultiSampling = engineer.supportsFeature('multi-sampling', 'self-consistency')
      const supportsContext = engineer.supportsFeature('context-optimization', 'context')

      expect(supportsMultiSampling).toBe(true)
      expect(supportsContext).toBe(true)
    })

    test('should return false for unknown optimizer', () => {
      const supports = engineer.supportsFeature('any-feature', 'unknown')
      expect(supports).toBe(false)
    })
  })

  describe('List Optimizers', () => {
    test('should list all registered optimizers', () => {
      const optimizers = engineer.listOptimizers()

      expect(Array.isArray(optimizers)).toBe(true)
      expect(optimizers.length).toBeGreaterThan(0)
      expect(optimizers).toContain('scot')
      expect(optimizers).toContain('self-consistency')
      expect(optimizers).toContain('context')
    })

    test('should update list after registration', () => {
      const before = engineer.listOptimizers()
      engineer.registerOptimizer('new-optimizer', mockOptimizer)
      const after = engineer.listOptimizers()

      expect(after.length).toBe(before.length + 1)
      expect(after).toContain('new-optimizer')
    })
  })

  describe('Complex Scenarios', () => {
    test('should handle empty prompts', async () => {
      const result = await engineer.optimize('')

      expect(result.originalPrompt).toBe('')
      expect(result.optimizedPrompt).toBeDefined()
    })

    test('should handle very long prompts', async () => {
      const longPrompt = TEST_PROMPTS.edgeCases.veryLong
      const result = await engineer.optimize(longPrompt)

      expect(result.originalPrompt).toBe(longPrompt)
      expect(result.estimatedTokens).toBeGreaterThan(1000)
    })

    test('should handle special characters', async () => {
      const specialPrompt = TEST_PROMPTS.edgeCases.specialChars
      const result = await engineer.optimize(specialPrompt)

      expect(result.originalPrompt).toBe(specialPrompt)
      expect(result.optimizedPrompt).toBeDefined()
    })

    test('should handle unicode content', async () => {
      const unicodePrompt = TEST_PROMPTS.edgeCases.unicode
      const result = await engineer.optimize(unicodePrompt)

      expect(result.originalPrompt).toBe(unicodePrompt)
      expect(result.optimizedPrompt).toBeDefined()
    })
  })

  describe('Optimizer Switching', () => {
    test('should switch between optimizers seamlessly', async () => {
      const prompt = TEST_PROMPTS.algorithmic.fibonacci

      // Try all optimizers
      const scotResult = await engineer.optimize(prompt, { optimizer: 'scot' })
      const consistencyResult = await engineer.optimize(prompt, { optimizer: 'self-consistency' })
      const contextResult = await engineer.optimize(prompt, { optimizer: 'context' })

      // Each should produce different strategies
      expect(scotResult.optimizationStrategy.name).toContain('Chain-of-Thought')
      expect(consistencyResult.optimizationStrategy.name).toContain('Self-Consistency')
      expect(contextResult.optimizationStrategy.name).toContain('Context')

      // But all should optimize the same prompt
      expect(scotResult.originalPrompt).toBe(prompt)
      expect(consistencyResult.originalPrompt).toBe(prompt)
      expect(contextResult.originalPrompt).toBe(prompt)
    })
  })

  describe('Error Recovery', () => {
    test('should provide meaningful error messages', async () => {
      try {
        await engineer.optimize(TEST_PROMPTS.simple.greeting, {
          optimizer: 'non-existent'
        })
      } catch (error: any) {
        expect(error.message).toContain('Optimizer')
        expect(error.message).toContain('not found')
      }
    })

    test('should maintain state after errors', async () => {
      // Cause an error
      try {
        await engineer.optimize(TEST_PROMPTS.simple.greeting, {
          optimizer: 'unknown'
        })
      } catch {
        // Expected error
      }

      // Should still work normally
      const result = await engineer.optimize(TEST_PROMPTS.simple.greeting)
      expect(result).toBeDefined()
      expect(result.optimizedPrompt).toBeDefined()
    })
  })

  describe('Performance', () => {
    test('should optimize simple prompts quickly', async () => {
      const startTime = performance.now()
      await engineer.optimize(TEST_PROMPTS.simple.sorting)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(1000) // Under 1 second
    })

    test('should handle multiple optimizations efficiently', async () => {
      const prompts = [TEST_PROMPTS.simple.sorting, TEST_PROMPTS.simple.greeting, TEST_PROMPTS.simple.calculation]

      const startTime = performance.now()
      const results = await Promise.all(prompts.map((p) => engineer.optimize(p)))
      const duration = performance.now() - startTime

      expect(results).toHaveLength(3)
      expect(duration).toBeLessThan(2000) // Under 2 seconds for all
    })
  })

  describe('Default Instance', () => {
    test('should export a default instance', async () => {
      const { promptEngineer } = await import('../../../src')

      expect(promptEngineer).toBeDefined()
      expect(promptEngineer).toBeInstanceOf(PromptEngineer)

      const optimizers = promptEngineer.listOptimizers()
      expect(optimizers).toContain('scot')
    })
  })
})
