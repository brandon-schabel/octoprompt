/**
 * Test utilities and helpers for prompt engineer testing
 */

import type { OptimizedPrompt, PromptAnalysis, Optimizer } from '../src/types'
import type { SolutionGenerator } from '../src/optimizers/self-consistency'
import { E, TE } from '../src/fp'

// Custom test matchers
export const customMatchers = {
  toBeValidOptimizedPrompt(received: any): {
    pass: boolean
    message: () => string
  } {
    const hasRequiredFields =
      'originalPrompt' in received &&
      'optimizedPrompt' in received &&
      'systemPrompt' in received &&
      'userPrompt' in received &&
      'reasoningStructure' in received &&
      'optimizationStrategy' in received &&
      'estimatedTokens' in received &&
      'improvementScore' in received &&
      'metadata' in received

    return {
      pass: hasRequiredFields,
      message: () =>
        hasRequiredFields
          ? 'Expected not to be a valid OptimizedPrompt'
          : 'Expected to be a valid OptimizedPrompt with all required fields'
    }
  },

  toHaveImprovementScoreInRange(
    received: OptimizedPrompt,
    min: number,
    max: number
  ): {
    pass: boolean
    message: () => string
  } {
    const score = received.improvementScore
    const pass = score >= min && score <= max

    return {
      pass,
      message: () =>
        pass
          ? `Expected improvement score not to be between ${min} and ${max}, but got ${score}`
          : `Expected improvement score to be between ${min} and ${max}, but got ${score}`
    }
  },

  toHaveTokensInRange(
    received: OptimizedPrompt,
    min: number,
    max: number
  ): {
    pass: boolean
    message: () => string
  } {
    const tokens = received.estimatedTokens
    const pass = tokens >= min && tokens <= max

    return {
      pass,
      message: () =>
        pass
          ? `Expected token count not to be between ${min} and ${max}, but got ${tokens}`
          : `Expected token count to be between ${min} and ${max}, but got ${tokens}`
    }
  }
}

// Mock solution generator for testing
export class MockSolutionGenerator implements SolutionGenerator<string> {
  private responses: Map<string, string[]> = new Map()
  private callCount: Map<string, number> = new Map()
  private delay: number = 0

  constructor(delay: number = 0) {
    this.delay = delay
  }

  setResponses(prompt: string, responses: string[]): void {
    this.responses.set(prompt, responses)
    this.callCount.set(prompt, 0)
  }

  async generate(prompt: string, temperature: number, topP: number): Promise<string> {
    // Simulate delay
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay))
    }

    const responses = this.responses.get(prompt) || [`Mock response for: ${prompt}`]
    const count = this.callCount.get(prompt) || 0

    // Rotate through responses to simulate variation
    const response = responses[count % responses.length]
    this.callCount.set(prompt, count + 1)

    // Add variation based on temperature
    const variation = temperature > 0.5 ? ' (varied)' : ''

    return response + variation
  }

  getCallCount(prompt: string): number {
    return this.callCount.get(prompt) || 0
  }

  reset(): void {
    this.callCount.clear()
  }
}

// Deterministic mock optimizer for testing
export class MockOptimizer implements Optimizer {
  name = 'Mock Optimizer'
  private improvementScore: number = 20
  private shouldFail: boolean = false

  setImprovementScore(score: number): void {
    this.improvementScore = score
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail
  }

  optimize(prompt: string, context?: any): E.Either<Error, OptimizedPrompt> {
    if (this.shouldFail) {
      return E.left(new Error('Mock optimization failed'))
    }

    const optimized: OptimizedPrompt = {
      originalPrompt: prompt,
      optimizedPrompt: `OPTIMIZED: ${prompt}`,
      systemPrompt: 'Mock system prompt',
      userPrompt: `Mock user prompt for: ${prompt}`,
      reasoningStructure: {
        sequences: [],
        branches: [],
        loops: [],
        dataFlow: [],
        complexity: {
          cognitive: 5,
          computational: 5,
          structural: 5,
          overall: 5
        }
      },
      optimizationStrategy: {
        name: 'Mock Strategy',
        techniques: ['mocking'],
        parameters: { mocked: true },
        confidence: 0.8
      },
      estimatedTokens: 100,
      improvementScore: this.improvementScore,
      metadata: {
        optimizerId: 'mock',
        timestamp: Date.now(),
        duration: 10,
        cacheable: true
      }
    }

    return E.right(optimized)
  }

  optimizeAsync(prompt: string, context?: any): TE.TaskEither<Error, OptimizedPrompt> {
    return TE.fromEither(this.optimize(prompt, context))
  }

  analyze(prompt: string): E.Either<Error, PromptAnalysis> {
    if (this.shouldFail) {
      return E.left(new Error('Mock analysis failed'))
    }

    const analysis: PromptAnalysis = {
      structure: {
        sequences: [],
        branches: [],
        loops: [],
        dataFlow: [],
        complexity: {
          cognitive: 5,
          computational: 5,
          structural: 5,
          overall: 5
        }
      },
      complexity: {
        cognitive: 5,
        computational: 5,
        structural: 5,
        overall: 5
      },
      tokenCount: 100,
      estimatedCost: 0.01,
      recommendedOptimizations: ['mock optimization'],
      potentialIssues: [],
      improvementPotential: this.improvementScore
    }

    return E.right(analysis)
  }

  supports(feature: string): boolean {
    return ['mocking', 'testing'].includes(feature)
  }
}

// Test helper for async operations
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout])
}

// Retry helper for flaky tests
export async function retryTest<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    shouldRetry?: (error: any) => boolean
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3
  const delay = options.delay || 1000
  const shouldRetry = options.shouldRetry || (() => true)

  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt < maxAttempts && shouldRetry(error)) {
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

// Performance measurement utilities
export class PerformanceMeasurer {
  private startTime: number = 0
  private startMemory: NodeJS.MemoryUsage | null = null

  start(): void {
    this.startTime = performance.now()
    this.startMemory = process.memoryUsage()
  }

  end(): {
    duration: number
    memoryDelta: {
      heapUsed: number
      external: number
      rss: number
    }
  } {
    const duration = performance.now() - this.startTime
    const endMemory = process.memoryUsage()

    const memoryDelta = this.startMemory
      ? {
          heapUsed: endMemory.heapUsed - this.startMemory.heapUsed,
          external: endMemory.external - this.startMemory.external,
          rss: endMemory.rss - this.startMemory.rss
        }
      : {
          heapUsed: 0,
          external: 0,
          rss: 0
        }

    return { duration, memoryDelta }
  }
}

// Token counting utilities (simplified)
export function estimateTokens(text: string): number {
  // Simple approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

export function compareTokenReduction(
  original: string,
  optimized: string
): {
  originalTokens: number
  optimizedTokens: number
  reduction: number
  percentage: number
} {
  const originalTokens = estimateTokens(original)
  const optimizedTokens = estimateTokens(optimized)
  const reduction = originalTokens - optimizedTokens
  const percentage = (reduction / originalTokens) * 100

  return {
    originalTokens,
    optimizedTokens,
    reduction,
    percentage: Math.round(percentage * 100) / 100
  }
}

// Snapshot testing helper
export function createSnapshot(optimizer: string, prompt: string, output: OptimizedPrompt): string {
  return JSON.stringify(
    {
      optimizer,
      prompt: prompt.substring(0, 100),
      systemPrompt: output.systemPrompt.substring(0, 100),
      userPromptPrefix: output.userPrompt.substring(0, 100),
      improvementScore: output.improvementScore,
      tokenCount: output.estimatedTokens,
      techniques: output.optimizationStrategy.techniques,
      timestamp: new Date().toISOString()
    },
    null,
    2
  )
}

// Test data generators
export function generateTestPrompt(options: {
  length?: 'short' | 'medium' | 'long'
  complexity?: 'simple' | 'moderate' | 'complex'
  includeExamples?: boolean
  includeConstraints?: boolean
}): string {
  const { length = 'medium', complexity = 'moderate', includeExamples = false, includeConstraints = false } = options

  let prompt = ''

  // Base prompt based on complexity
  switch (complexity) {
    case 'simple':
      prompt = 'Write a function to add two numbers'
      break
    case 'moderate':
      prompt = 'Implement a binary search algorithm that handles edge cases'
      break
    case 'complex':
      prompt = 'Design a distributed caching system with consistency guarantees'
      break
  }

  // Add length
  if (length === 'long') {
    prompt +=
      '. The implementation should be production-ready with comprehensive error handling, logging, and monitoring. Consider performance implications and scalability concerns.'
  } else if (length === 'short') {
    prompt = prompt.split(' ').slice(0, 5).join(' ')
  }

  // Add examples
  if (includeExamples) {
    prompt += '\n\nExample: Input: [1,2,3], Output: 6'
  }

  // Add constraints
  if (includeConstraints) {
    prompt += '\n\nConstraints: O(log n) time complexity, O(1) space complexity'
  }

  return prompt
}

// Assert helpers for common patterns
export const assertHelpers = {
  assertSequences(analysis: PromptAnalysis, minCount: number = 1): void {
    if (analysis.structure.sequences.length < minCount) {
      throw new Error(`Expected at least ${minCount} sequences, got ${analysis.structure.sequences.length}`)
    }
  },

  assertBranches(analysis: PromptAnalysis, minCount: number = 1): void {
    if (analysis.structure.branches.length < minCount) {
      throw new Error(`Expected at least ${minCount} branches, got ${analysis.structure.branches.length}`)
    }
  },

  assertComplexityInRange(complexity: number, min: number, max: number, type: string = 'overall'): void {
    if (complexity < min || complexity > max) {
      throw new Error(`Expected ${type} complexity between ${min} and ${max}, got ${complexity}`)
    }
  }
}
