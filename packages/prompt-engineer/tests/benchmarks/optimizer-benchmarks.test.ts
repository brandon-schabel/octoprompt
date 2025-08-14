import { describe, test, expect, beforeAll } from 'bun:test'
import { createBenchmarkRunner, type BenchmarkSuite } from './benchmark-runner'
import { createSCoTOptimizer, createSelfConsistencyOptimizer, createContextOptimizer } from '../../src/optimizers'
import { TEST_PROMPTS } from '../fixtures/prompts'

// ============================================================================
// Benchmark Configuration
// ============================================================================

const BENCHMARK_CONFIG = {
  iterations: 5,
  warmupRuns: 2,
  timeoutMs: 10000,
  llmEndpoint: process.env.LLM_ENDPOINT || 'http://192.168.1.38:1234',
  llmModel: process.env.LLM_MODEL || 'local-model',
  verbose: process.env.VERBOSE === 'true'
}

// Skip LLM tests if no endpoint configured
const skipLLMTests = !process.env.LLM_ENDPOINT

// ============================================================================
// Benchmark Suites
// ============================================================================

const BENCHMARK_SUITES: BenchmarkSuite[] = [
  {
    name: 'Simple Prompts',
    prompts: [TEST_PROMPTS.simple.sorting, TEST_PROMPTS.simple.greeting, TEST_PROMPTS.simple.calculation],
    expectedImprovement: 10,
    acceptableVariance: 5
  },
  {
    name: 'Algorithmic Problems',
    prompts: [
      TEST_PROMPTS.algorithmic.fibonacci,
      TEST_PROMPTS.algorithmic.palindrome,
      TEST_PROMPTS.algorithmic.quickSort
    ],
    expectedImprovement: 20,
    acceptableVariance: 7
  },
  {
    name: 'Complex Tasks',
    prompts: [TEST_PROMPTS.complex.systemDesign, TEST_PROMPTS.complex.apiDesign, TEST_PROMPTS.complex.dataProcessing],
    expectedImprovement: 30,
    acceptableVariance: 10
  }
]

// ============================================================================
// Benchmark Tests
// ============================================================================

describe('Optimizer Benchmarks', () => {
  let runner: ReturnType<typeof createBenchmarkRunner>

  beforeAll(() => {
    runner = createBenchmarkRunner(BENCHMARK_CONFIG)
  })

  describe('SCoT Optimizer Benchmarks', () => {
    const optimizer = createSCoTOptimizer({
      depth: 'detailed',
      includeExamples: true,
      includePerformanceAnalysis: true
    })

    test('should meet improvement thresholds for simple prompts', async () => {
      const suite = BENCHMARK_SUITES[0]
      const results = await runner.runBenchmark(optimizer, suite)

      expect(results.length).toBe(suite.prompts.length)

      results.forEach((result) => {
        console.log(`SCoT Simple - ${result.prompt.substring(0, 30)}... : ${result.actualImprovement.toFixed(2)}%`)

        // Check that improvement is within expected range
        expect(result.actualImprovement).toBeGreaterThan(0)

        // Check token reduction
        expect(result.metrics.avgTokenReduction).toBeGreaterThanOrEqual(0)

        // Check consistency
        expect(result.metrics.consistency).toBeGreaterThan(70)
      })

      // Average improvement should be close to expected
      const avgImprovement = results.reduce((sum, r) => sum + r.actualImprovement, 0) / results.length
      expect(Math.abs(avgImprovement - suite.expectedImprovement)).toBeLessThan(suite.acceptableVariance * 2)
    })

    test('should meet improvement thresholds for algorithmic problems', async () => {
      const suite = BENCHMARK_SUITES[1]
      const results = await runner.runBenchmark(optimizer, suite)

      expect(results.length).toBe(suite.prompts.length)

      results.forEach((result) => {
        console.log(`SCoT Algorithmic - ${result.prompt.substring(0, 30)}... : ${result.actualImprovement.toFixed(2)}%`)

        // Algorithmic problems should show significant improvement
        expect(result.actualImprovement).toBeGreaterThan(10)

        // Should have good quality scores
        expect(result.metrics.qualityScore).toBeGreaterThan(60)
      })

      // Check pass rate
      const passCount = results.filter((r) => r.passesThreshold).length
      expect(passCount).toBeGreaterThan(0)
    })

    test('should handle complex tasks effectively', async () => {
      const suite = BENCHMARK_SUITES[2]
      const results = await runner.runBenchmark(optimizer, suite)

      expect(results.length).toBe(suite.prompts.length)

      results.forEach((result) => {
        console.log(`SCoT Complex - ${result.prompt.substring(0, 30)}... : ${result.actualImprovement.toFixed(2)}%`)

        // Complex tasks benefit most from structure
        expect(result.actualImprovement).toBeGreaterThan(15)

        // Should maintain reasonable performance
        expect(result.metrics.avgDuration).toBeLessThan(5000)
      })
    })

    test('should maintain consistency across iterations', async () => {
      const prompt = TEST_PROMPTS.algorithmic.fibonacci
      const suite: BenchmarkSuite = {
        name: 'Consistency Test',
        prompts: [prompt],
        expectedImprovement: 20,
        acceptableVariance: 5
      }

      const results = await runner.runBenchmark(optimizer, suite)
      const result = results[0]

      // Check that improvements are consistent
      expect(result.metrics.consistency).toBeGreaterThan(80)

      // Check variance in raw improvements
      const improvements = result.raw.improvements
      const max = Math.max(...improvements)
      const min = Math.min(...improvements)
      const range = max - min

      expect(range).toBeLessThan(10) // Should not vary by more than 10%
    })
  })

  describe('Self-Consistency Optimizer Benchmarks', () => {
    const optimizer = createSelfConsistencyOptimizer(undefined, {
      samples: 5,
      votingStrategy: 'weighted'
    })

    test('should meet improvement thresholds for simple prompts', async () => {
      const suite = BENCHMARK_SUITES[0]
      const results = await runner.runBenchmark(optimizer, suite)

      expect(results.length).toBe(suite.prompts.length)

      results.forEach((result) => {
        console.log(
          `Self-Consistency Simple - ${result.prompt.substring(0, 30)}... : ${result.actualImprovement.toFixed(2)}%`
        )

        // Self-consistency should provide moderate improvement
        expect(result.actualImprovement).toBeGreaterThan(5)

        // Should have high consistency
        expect(result.metrics.consistency).toBeGreaterThan(75)
      })
    })

    test('should excel at ambiguous problems', async () => {
      const ambiguousPrompts = [
        'What is the best programming language?',
        'How should I structure my application?',
        'What database should I use?'
      ]

      const suite: BenchmarkSuite = {
        name: 'Ambiguous Problems',
        prompts: ambiguousPrompts,
        expectedImprovement: 25,
        acceptableVariance: 8
      }

      const results = await runner.runBenchmark(optimizer, suite)

      results.forEach((result) => {
        console.log(
          `Self-Consistency Ambiguous - ${result.prompt.substring(0, 30)}... : ${result.actualImprovement.toFixed(2)}%`
        )

        // Self-consistency should excel at ambiguous problems
        expect(result.actualImprovement).toBeGreaterThan(15)
      })
    })

    test.skip('should handle async operations properly', async () => {
      // Skip if no LLM endpoint
      if (skipLLMTests) return

      const suite = BENCHMARK_SUITES[1]
      const results = await runner.runBenchmark(optimizer, suite)

      expect(results.length).toBe(suite.prompts.length)

      results.forEach((result) => {
        // Should complete without timeouts
        expect(result.metrics.avgDuration).toBeLessThan(BENCHMARK_CONFIG.timeoutMs)

        // Should have valid results
        expect(result.actualImprovement).toBeGreaterThan(0)
      })
    })
  })

  describe('Context Optimizer Benchmarks', () => {
    const optimizer = createContextOptimizer({
      maxTokens: 2048,
      priorityStrategy: 'hybrid',
      chunkingStrategy: 'adaptive',
      compressionLevel: 'moderate'
    })

    test('should meet improvement thresholds for long prompts', async () => {
      const longPrompts = [
        TEST_PROMPTS.edgeCases.veryLong,
        TEST_PROMPTS.complex.systemDesign,
        TEST_PROMPTS.complex.dataProcessing
      ]

      const suite: BenchmarkSuite = {
        name: 'Long Prompts',
        prompts: longPrompts,
        expectedImprovement: 15,
        acceptableVariance: 7
      }

      const results = await runner.runBenchmark(optimizer, suite)

      results.forEach((result) => {
        console.log(`Context Long - ${result.prompt.substring(0, 30)}... : ${result.actualImprovement.toFixed(2)}%`)

        // Should reduce tokens significantly
        expect(result.metrics.avgTokenReduction).toBeGreaterThan(10)

        // Should maintain quality
        expect(result.metrics.qualityScore).toBeGreaterThan(50)
      })
    })

    test('should handle token limits effectively', async () => {
      const limitedOptimizer = createContextOptimizer({
        maxTokens: 500,
        compressionLevel: 'aggressive'
      })

      const suite: BenchmarkSuite = {
        name: 'Token Limited',
        prompts: [TEST_PROMPTS.edgeCases.veryLong],
        expectedImprovement: 10,
        acceptableVariance: 5
      }

      const results = await runner.runBenchmark(limitedOptimizer, suite)
      const result = results[0]

      console.log(`Context Limited - Token reduction: ${result.metrics.avgTokenReduction.toFixed(2)}%`)

      // Should achieve significant token reduction
      expect(result.metrics.avgTokenReduction).toBeGreaterThan(50)

      // Should still maintain some quality
      expect(result.metrics.qualityScore).toBeGreaterThan(40)
    })

    test('should preserve important content', async () => {
      const technicalPrompt = `
        Implement a binary search tree with the following methods:
        1. insert(value) - adds a value
        2. delete(value) - removes a value
        3. search(value) - finds a value
        4. inorder() - returns sorted array
        Handle edge cases and ensure O(log n) average complexity.
      `

      const suite: BenchmarkSuite = {
        name: 'Technical Content',
        prompts: [technicalPrompt],
        expectedImprovement: 10,
        acceptableVariance: 5
      }

      const results = await runner.runBenchmark(optimizer, suite)
      const result = results[0]

      // Should preserve technical accuracy
      expect(result.metrics.qualityScore).toBeGreaterThan(70)

      // Should not lose critical information
      expect(result.actualImprovement).toBeGreaterThan(0)
    })
  })

  describe('Comparative Benchmarks', () => {
    const optimizers = [
      { name: 'SCoT', instance: createSCoTOptimizer() },
      { name: 'Self-Consistency', instance: createSelfConsistencyOptimizer() },
      { name: 'Context', instance: createContextOptimizer() }
    ]

    test('should compare performance across all optimizers', async () => {
      const suite = BENCHMARK_SUITES[1] // Algorithmic problems
      const allResults: Record<string, any> = {}

      for (const { name, instance } of optimizers) {
        const results = await runner.runBenchmark(instance, suite)
        allResults[name] = results

        const avgImprovement = results.reduce((sum, r) => sum + r.actualImprovement, 0) / results.length
        const avgDuration = results.reduce((sum, r) => sum + r.metrics.avgDuration, 0) / results.length

        console.log(
          `${name}: Avg Improvement = ${avgImprovement.toFixed(2)}%, Avg Duration = ${avgDuration.toFixed(0)}ms`
        )
      }

      // Each optimizer should provide some improvement
      for (const [name, results] of Object.entries(allResults)) {
        const avgImprovement = results.reduce((sum: number, r: any) => sum + r.actualImprovement, 0) / results.length
        expect(avgImprovement).toBeGreaterThan(0)
      }
    })

    test('should identify best optimizer for each prompt type', async () => {
      const promptTypes = [
        { type: 'simple', prompts: [TEST_PROMPTS.simple.sorting] },
        { type: 'algorithmic', prompts: [TEST_PROMPTS.algorithmic.fibonacci] },
        { type: 'complex', prompts: [TEST_PROMPTS.complex.systemDesign] }
      ]

      for (const { type, prompts } of promptTypes) {
        const suite: BenchmarkSuite = {
          name: type,
          prompts,
          expectedImprovement: 20,
          acceptableVariance: 10
        }

        let bestOptimizer = ''
        let bestImprovement = 0

        for (const { name, instance } of optimizers) {
          const results = await runner.runBenchmark(instance, suite)
          const improvement = results[0].actualImprovement

          if (improvement > bestImprovement) {
            bestImprovement = improvement
            bestOptimizer = name
          }
        }

        console.log(`Best for ${type}: ${bestOptimizer} (${bestImprovement.toFixed(2)}%)`)
        expect(bestImprovement).toBeGreaterThan(0)
      }
    })
  })

  describe('Performance Benchmarks', () => {
    test('should complete optimizations within time limits', async () => {
      const optimizer = createSCoTOptimizer()
      const suite = BENCHMARK_SUITES[0]

      const startTime = Date.now()
      const results = await runner.runBenchmark(optimizer, suite)
      const totalDuration = Date.now() - startTime

      // Should complete all benchmarks quickly
      expect(totalDuration).toBeLessThan(30000) // 30 seconds for all

      // Each optimization should be fast
      results.forEach((result) => {
        expect(result.metrics.avgDuration).toBeLessThan(1000) // Under 1 second average
      })
    })

    test('should handle concurrent optimizations', async () => {
      const optimizer = createContextOptimizer()
      const prompts = [TEST_PROMPTS.simple.sorting, TEST_PROMPTS.simple.greeting, TEST_PROMPTS.simple.calculation]

      const startTime = Date.now()

      // Run concurrently
      const promises = prompts.map((prompt) => optimizer.optimizeAsync(prompt)())

      const results = await Promise.all(promises)
      const duration = Date.now() - startTime

      // Should complete faster than sequential
      expect(duration).toBeLessThan(prompts.length * 500)

      // All should succeed
      results.forEach((result) => {
        expect(result._tag).toBe('Right')
      })
    })
  })

  describe('Report Generation', () => {
    test('should generate comprehensive benchmark report', async () => {
      const optimizer = createSCoTOptimizer()
      const suite = BENCHMARK_SUITES[0]

      const results = await runner.runBenchmark(optimizer, suite)
      const report = runner.generateReport(results)

      // Report should include all sections
      expect(report).toContain('# Benchmark Report')
      expect(report).toContain('## Summary')
      expect(report).toContain('## Structured Chain-of-Thought')
      expect(report).toContain('## Performance Comparison')

      // Should include metrics
      expect(report).toContain('Actual Improvement')
      expect(report).toContain('Token Reduction')
      expect(report).toContain('Quality Score')
      expect(report).toContain('Consistency')

      // Should show pass/fail status
      expect(report).toMatch(/✅|❌/)

      console.log('\n=== Sample Report ===\n')
      console.log(report.substring(0, 1000) + '...')
    })
  })
})
