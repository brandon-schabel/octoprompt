import { describe, test, expect, beforeAll, beforeEach } from 'bun:test'
import { createSelfConsistencyOptimizer } from '../../src/optimizers/self-consistency'
import { createSCoTOptimizer } from '../../src/optimizers/scot'
import { createContextOptimizer } from '../../src/optimizers/context'
import { PromptEngineer } from '../../src'
import { LMStudioProvider, createLMStudioProvider } from './lmstudio-provider'
import { TEST_PROMPTS } from '../fixtures/prompts'
import { TEST_TIMEOUTS } from '../fixtures/llm-configs'
import { E } from '../../src/fp'

// Skip these tests if LMStudio is not available
const skipIfNoLMStudio = process.env.SKIP_LMSTUDIO_TESTS === 'true' || !process.env.LMSTUDIO_BASE_URL

describe.skipIf(skipIfNoLMStudio)('LMStudio Integration Tests', () => {
  let provider: LMStudioProvider | null
  let engineer: PromptEngineer

  beforeAll(async () => {
    console.log('Initializing LMStudio provider...')
    provider = await createLMStudioProvider()

    if (!provider) {
      console.log('LMStudio not available, skipping tests')
      return
    }

    // Get model info for debugging
    try {
      const modelInfo = await provider.getModelInfo()
      console.log('Using model:', modelInfo)
    } catch (error) {
      console.log('Could not get model info:', error)
    }
  })

  beforeEach(() => {
    engineer = new PromptEngineer()
  })

  describe('SCoT Optimizer with LMStudio', () => {
    test(
      'should optimize a simple prompt',
      async () => {
        if (!provider) return

        const optimizer = createSCoTOptimizer()
        const prompt = TEST_PROMPTS.simple.sorting

        const result = optimizer.optimize(prompt)

        expect(E.isRight(result)).toBe(true)
        if (E.isRight(result)) {
          const optimized = result.right

          // Generate actual solution using LMStudio
          const solution = await provider.generate(optimized.userPrompt, 0.7, 0.9)

          expect(solution).toBeDefined()
          expect(solution.length).toBeGreaterThan(0)
          console.log('Generated solution length:', solution.length)
        }
      },
      TEST_TIMEOUTS.integration
    )

    test(
      'should handle complex algorithmic prompts',
      async () => {
        if (!provider) return

        const optimizer = createSCoTOptimizer({
          depth: 'detailed',
          includeExamples: true,
          includePerformanceAnalysis: true
        })

        const prompt = TEST_PROMPTS.algorithmic.binarySearch
        const result = optimizer.optimize(prompt, {
          language: 'typescript',
          examples: [
            { input: '[1,2,3,4,5], 3', output: '2' },
            { input: '[1,2,3,4,5], 6', output: '-1' }
          ]
        })

        expect(E.isRight(result)).toBe(true)
        if (E.isRight(result)) {
          const optimized = result.right
          const solution = await provider.generate(
            optimized.userPrompt,
            0.5, // Lower temperature for more deterministic code
            0.9
          )

          // Check if solution contains expected elements
          expect(solution.toLowerCase()).toContain('function')
          expect(solution).toContain('binary')
          console.log('Binary search solution generated')
        }
      },
      TEST_TIMEOUTS.integration
    )
  })

  describe('Self-Consistency Optimizer with LMStudio', () => {
    test(
      'should generate multiple consistent solutions',
      async () => {
        if (!provider) return

        const optimizer = createSelfConsistencyOptimizer(provider as any, {
          samples: 3, // Fewer samples for faster testing
          temperatureRange: [0.5, 0.9],
          topPRange: [0.8, 0.95],
          votingStrategy: 'majority',
          maxRetries: 2,
          timeoutMs: TEST_TIMEOUTS.integration
        })

        const prompt = TEST_PROMPTS.simple.calculation
        const result = await optimizer.optimizeAsync(prompt)()

        expect(E.isRight(result)).toBe(true)
        if (E.isRight(result)) {
          const optimized = result.right
          expect(optimized.optimizationStrategy.confidence).toBeGreaterThan(0)
          console.log('Consistency confidence:', optimized.optimizationStrategy.confidence)
        }
      },
      TEST_TIMEOUTS.integration * 3
    ) // Multiple samples take longer

    test(
      'should handle decision-making prompts',
      async () => {
        if (!provider) return

        const optimizer = createSelfConsistencyOptimizer(provider as any, {
          samples: 3,
          temperatureRange: [0.7, 0.9],
          topPRange: [0.85, 0.95],
          votingStrategy: 'weighted',
          maxRetries: 2,
          timeoutMs: TEST_TIMEOUTS.integration
        })

        const prompt = TEST_PROMPTS.decisionMaking.technology
        const result = await optimizer.optimizeAsync(prompt)()

        expect(E.isRight(result)).toBe(true)
        if (E.isRight(result)) {
          const optimized = result.right

          // Generate final decision using the optimized prompt
          const decision = await provider.generate(optimized.userPrompt, 0.7, 0.9)

          expect(decision).toBeDefined()
          // Should mention at least one framework
          const mentionsFramework =
            decision.toLowerCase().includes('react') ||
            decision.toLowerCase().includes('vue') ||
            decision.toLowerCase().includes('angular')

          expect(mentionsFramework).toBe(true)
        }
      },
      TEST_TIMEOUTS.integration * 3
    )
  })

  describe('Context Optimizer with LMStudio', () => {
    test(
      'should optimize context for token limits',
      async () => {
        if (!provider) return

        const optimizer = createContextOptimizer({
          maxTokens: 1000, // Limited context
          priorityStrategy: 'relevance',
          chunkingStrategy: 'semantic',
          overlapRatio: 0.1,
          compressionLevel: 'moderate'
        })

        const prompt = TEST_PROMPTS.complex.systemDesign
        const result = optimizer.optimize(prompt)

        expect(E.isRight(result)).toBe(true)
        if (E.isRight(result)) {
          const optimized = result.right

          // Verify it fits in context and generates response
          const solution = await provider.generate(optimized.userPrompt, 0.7, 0.9)

          expect(solution).toBeDefined()
          expect(optimized.estimatedTokens).toBeLessThanOrEqual(1000)
          console.log('Context-optimized tokens:', optimized.estimatedTokens)
        }
      },
      TEST_TIMEOUTS.integration
    )
  })

  describe('PromptEngineer with LMStudio', () => {
    test(
      'should work with all optimizers',
      async () => {
        if (!provider) return

        const prompts = {
          scot: TEST_PROMPTS.algorithmic.fibonacci,
          'self-consistency': TEST_PROMPTS.decisionMaking.architecture,
          context: TEST_PROMPTS.complex.apiDesign
        }

        for (const [optimizer, prompt] of Object.entries(prompts)) {
          console.log(`Testing ${optimizer} optimizer...`)

          const result = await engineer.optimize(prompt, { optimizer })

          expect(result).toBeDefined()
          expect(result.optimizedPrompt).toBeDefined()

          // Generate solution with optimized prompt
          const solution = await provider.generate(result.userPrompt, 0.7, 0.9)

          expect(solution).toBeDefined()
          expect(solution.length).toBeGreaterThan(10)
        }
      },
      TEST_TIMEOUTS.integration * 3
    )
  })

  describe('Real-world Scenarios', () => {
    test(
      'should optimize code generation prompt',
      async () => {
        if (!provider) return

        const codePrompt = TEST_PROMPTS.languageSpecific.typescript.prompt
        const result = await engineer.optimize(codePrompt, {
          optimizer: 'scot',
          context: {
            language: 'typescript',
            constraints: TEST_PROMPTS.languageSpecific.typescript.constraints
          }
        })

        const code = await provider.generate(result.userPrompt, 0.3, 0.9)

        // Basic validation that it's TypeScript-like
        expect(code).toContain('class')
        expect(code.includes('<') || code.includes('T')).toBe(true) // Generic markers
        console.log('Generated TypeScript code')
      },
      TEST_TIMEOUTS.integration
    )

    test(
      'should optimize data processing prompt',
      async () => {
        if (!provider) return

        const result = await engineer.optimize(TEST_PROMPTS.complex.dataProcessing, {
          optimizer: 'context',
          context: {
            performance: 'Must handle large datasets efficiently'
          }
        })

        const solution = await provider.generate(result.userPrompt, 0.5, 0.9)

        expect(solution).toBeDefined()
        // Should mention processing steps
        const hasProcessingSteps =
          solution.toLowerCase().includes('load') ||
          solution.toLowerCase().includes('validate') ||
          solution.toLowerCase().includes('process') ||
          solution.toLowerCase().includes('transform')

        expect(hasProcessingSteps).toBe(true)
      },
      TEST_TIMEOUTS.integration
    )
  })

  describe('Performance Benchmarks', () => {
    test(
      'should measure optimization improvement',
      async () => {
        if (!provider) return

        const originalPrompt = 'Write code to sort array'
        const optimizedResult = await engineer.optimize(originalPrompt)

        // Generate with original prompt
        const originalSolution = await provider.generate(originalPrompt, 0.7, 0.9)

        // Generate with optimized prompt
        const optimizedSolution = await provider.generate(optimizedResult.userPrompt, 0.7, 0.9)

        // Optimized should generally be more detailed/structured
        console.log('Original solution length:', originalSolution.length)
        console.log('Optimized solution length:', optimizedSolution.length)
        console.log('Improvement score:', optimizedResult.improvementScore)

        expect(optimizedResult.improvementScore).toBeGreaterThan(10)
      },
      TEST_TIMEOUTS.integration * 2
    )

    test(
      'should handle streaming responses',
      async () => {
        if (!provider) return

        const prompt = TEST_PROMPTS.simple.greeting
        const result = await engineer.optimize(prompt)

        let streamedContent = ''
        for await (const chunk of provider.generateStream(result.userPrompt, 0.7, 0.9)) {
          streamedContent += chunk
        }

        expect(streamedContent).toBeDefined()
        expect(streamedContent.length).toBeGreaterThan(0)
        console.log('Streamed response length:', streamedContent.length)
      },
      TEST_TIMEOUTS.integration
    )
  })

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      if (!provider) return

      // Create provider with wrong URL
      const badProvider = new LMStudioProvider()
      ;(badProvider as any).baseUrl = 'http://localhost:9999' // Non-existent
      ;(badProvider as any).available = true // Force it to try

      await expect(badProvider.generate('Test prompt', 0.7, 0.9)).rejects.toThrow()
    })

    test('should handle timeout', async () => {
      if (!provider) return

      // Create provider with very short timeout
      const timeoutProvider = new LMStudioProvider()
      ;(timeoutProvider as any).timeout = 1 // 1ms timeout
      ;(timeoutProvider as any).available = true

      await expect(timeoutProvider.generate(TEST_PROMPTS.complex.systemDesign, 0.7, 0.9)).rejects.toThrow('timeout')
    })
  })
})
