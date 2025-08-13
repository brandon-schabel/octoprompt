import { describe, test, expect, beforeEach } from 'bun:test'
import { createSelfConsistencyOptimizer } from '../../../src/optimizers/self-consistency'
import { MockSolutionGenerator } from '../../test-utils'
import { E } from '../../../src/fp'
import { TEST_PROMPTS } from '../../fixtures/prompts'
import { EXPECTED_IMPROVEMENTS, validators } from '../../fixtures/expected-outputs'

describe('Self-Consistency Optimizer', () => {
  let mockGenerator: MockSolutionGenerator
  let optimizer: ReturnType<typeof createSelfConsistencyOptimizer>

  beforeEach(() => {
    mockGenerator = new MockSolutionGenerator(10) // 10ms delay
    optimizer = createSelfConsistencyOptimizer(mockGenerator as any, {
      samples: 5,
      temperatureRange: [0.3, 0.9],
      topPRange: [0.8, 0.95],
      votingStrategy: 'majority',
      maxRetries: 3,
      timeoutMs: 5000
    })
  })

  describe('Basic Functionality', () => {
    test('should optimize a simple prompt', () => {
      const prompt = TEST_PROMPTS.simple.sorting
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.originalPrompt).toBe(prompt)
        expect(optimized.optimizationStrategy.name).toContain('Self-Consistency')
        expect(optimized.improvementScore).toBeGreaterThan(0)
      }
    })

    test('should include multi-sampling in techniques', () => {
      const prompt = TEST_PROMPTS.decisionMaking.architecture
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.optimizationStrategy.techniques).toContain('multi-sampling')
        expect(optimized.optimizationStrategy.techniques).toContain('voting')
      }
    })

    test('should validate output structure', () => {
      const prompt = TEST_PROMPTS.algorithmic.binarySearch
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(validators.validateSelfConsistencyOutput(optimized)).toBe(true)
      }
    })
  })

  describe('Consistency Verification', () => {
    test('should generate multiple samples', async () => {
      // Set up mock responses that vary
      mockGenerator.setResponses(TEST_PROMPTS.simple.greeting, [
        'Hello, user!',
        'Greetings, user!',
        'Welcome, user!',
        'Hi there, user!',
        'Hey, user!'
      ])

      const result = await optimizer.optimizeAsync(TEST_PROMPTS.simple.greeting)()

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        // Check that multiple samples were generated
        expect(mockGenerator.getCallCount(TEST_PROMPTS.simple.greeting)).toBe(5)
      }
    })

    test('should handle consistent responses', async () => {
      // All responses are the same
      mockGenerator.setResponses(TEST_PROMPTS.simple.calculation, [
        'return a + b',
        'return a + b',
        'return a + b',
        'return a + b',
        'return a + b'
      ])

      const result = await optimizer.optimizeAsync(TEST_PROMPTS.simple.calculation)()

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        // High consistency should result in higher confidence
        expect(optimized.optimizationStrategy.confidence).toBeGreaterThan(0.8)
      }
    })

    test('should handle divergent responses', async () => {
      // All responses are different
      mockGenerator.setResponses(TEST_PROMPTS.decisionMaking.technology, [
        'Choose React for its ecosystem',
        'Vue is better for simplicity',
        'Consider Angular for enterprise',
        'Svelte offers best performance',
        'Solid.js is the future'
      ])

      const result = await optimizer.optimizeAsync(TEST_PROMPTS.decisionMaking.technology)()

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        // Low consistency should result in lower confidence
        expect(optimized.optimizationStrategy.confidence).toBeLessThan(0.5)
      }
    })
  })

  describe('Configuration Options', () => {
    test('should respect sample count configuration', async () => {
      const customOptimizer = createSelfConsistencyOptimizer(mockGenerator as any, {
        samples: 3, // Only 3 samples
        temperatureRange: [0.5, 0.5],
        topPRange: [0.9, 0.9],
        votingStrategy: 'majority',
        maxRetries: 1,
        timeoutMs: 1000
      })

      mockGenerator.setResponses(TEST_PROMPTS.simple.sorting, ['Solution 1', 'Solution 2', 'Solution 3'])

      const result = await customOptimizer.optimizeAsync(TEST_PROMPTS.simple.sorting)()

      expect(E.isRight(result)).toBe(true)
      expect(mockGenerator.getCallCount(TEST_PROMPTS.simple.sorting)).toBe(3)
    })

    test('should vary temperature across samples', async () => {
      const prompt = TEST_PROMPTS.complex.apiDesign
      const result = await optimizer.optimizeAsync(prompt)()

      expect(E.isRight(result)).toBe(true)
      // Temperature variation should be reflected in the optimization strategy
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.optimizationStrategy.parameters).toHaveProperty('temperatureRange')
      }
    })

    test('should handle timeout configuration', async () => {
      const slowGenerator = new MockSolutionGenerator(2000) // 2 second delay per call
      const fastTimeoutOptimizer = createSelfConsistencyOptimizer(slowGenerator as any, {
        samples: 5,
        temperatureRange: [0.7, 0.7],
        topPRange: [0.9, 0.9],
        votingStrategy: 'majority',
        maxRetries: 1,
        timeoutMs: 1000 // 1 second timeout
      })

      const result = await fastTimeoutOptimizer.optimizeAsync(TEST_PROMPTS.simple.greeting)()

      // Should handle timeout gracefully
      expect(E.isRight(result)).toBe(true)
    })
  })

  describe('Voting Strategies', () => {
    test('should use majority voting by default', () => {
      const result = optimizer.optimize(TEST_PROMPTS.algorithmic.fibonacci)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.optimizationStrategy.parameters.votingStrategy).toBe('majority')
      }
    })

    test('should support weighted voting', () => {
      const weightedOptimizer = createSelfConsistencyOptimizer(mockGenerator as any, {
        samples: 5,
        temperatureRange: [0.3, 0.9],
        topPRange: [0.8, 0.95],
        votingStrategy: 'weighted',
        maxRetries: 3,
        timeoutMs: 5000
      })

      const result = weightedOptimizer.optimize(TEST_PROMPTS.complex.dataProcessing)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.optimizationStrategy.parameters.votingStrategy).toBe('weighted')
      }
    })
  })

  describe('Error Handling', () => {
    test('should handle generator failures gracefully', async () => {
      const failingGenerator = new MockSolutionGenerator()
      // Make it throw an error
      failingGenerator.generate = async () => {
        throw new Error('Generator failed')
      }

      const failOptimizer = createSelfConsistencyOptimizer(failingGenerator as any, {
        samples: 3,
        temperatureRange: [0.5, 0.5],
        topPRange: [0.9, 0.9],
        votingStrategy: 'majority',
        maxRetries: 1,
        timeoutMs: 1000
      })

      const result = await failOptimizer.optimizeAsync(TEST_PROMPTS.simple.greeting)()

      // Should still return a result (possibly with fewer samples)
      expect(E.isRight(result)).toBe(true)
    })

    test('should handle empty prompts', () => {
      const result = optimizer.optimize('')

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.originalPrompt).toBe('')
      }
    })

    test('should handle very long prompts', () => {
      const longPrompt = TEST_PROMPTS.edgeCases.veryLong
      const result = optimizer.optimize(longPrompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.estimatedTokens).toBeGreaterThan(1000)
      }
    })
  })

  describe('Performance', () => {
    test('should complete optimization within reasonable time', async () => {
      const startTime = performance.now()
      const result = await optimizer.optimizeAsync(TEST_PROMPTS.simple.sorting)()
      const duration = performance.now() - startTime

      expect(E.isRight(result)).toBe(true)
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second for simple prompt
    })

    test('should cache results when appropriate', async () => {
      const prompt = TEST_PROMPTS.simple.greeting

      // First call
      const result1 = await optimizer.optimizeAsync(prompt)()
      expect(E.isRight(result1)).toBe(true)

      // Reset mock to track new calls
      mockGenerator.reset()

      // Second call with same prompt (should potentially use cache)
      const result2 = await optimizer.optimizeAsync(prompt)()
      expect(E.isRight(result2)).toBe(true)

      // If caching is implemented, second call should not generate new samples
      // For now, this test documents expected behavior
    })
  })

  describe('Feature Support', () => {
    test('should correctly report supported features', () => {
      expect(optimizer.supports('multi-sampling')).toBe(true)
      expect(optimizer.supports('voting')).toBe(true)
      expect(optimizer.supports('confidence-scoring')).toBe(true)
      expect(optimizer.supports('async-only')).toBe(true)
      expect(optimizer.supports('unknown-feature')).toBe(false)
    })
  })

  describe('Improvement Score Validation', () => {
    test('should generate improvement scores within expected range', () => {
      const prompts = [
        TEST_PROMPTS.simple.sorting,
        TEST_PROMPTS.algorithmic.palindrome,
        TEST_PROMPTS.complex.systemDesign
      ]

      prompts.forEach((prompt) => {
        const result = optimizer.optimize(prompt)

        expect(E.isRight(result)).toBe(true)
        if (E.isRight(result)) {
          const optimized = result.right
          expect(validators.validateImprovementScore(optimized.improvementScore, 'selfConsistency')).toBe(true)
        }
      })
    })
  })
})
