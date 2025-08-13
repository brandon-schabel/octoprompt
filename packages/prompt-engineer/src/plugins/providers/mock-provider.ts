/**
 * Mock Provider Plugin
 * Deterministic responses for testing
 */

import { Effect, Stream, Schema, pipe, Chunk } from 'effect'
import type { ProviderPlugin, GenerationOptions, GenerationResult, ProviderError as ProviderErrorType } from '../types'
import { ProviderError, ValidationError } from '../types'

interface MockProviderConfig {
  responses?: Map<string, string>
  delay?: number // Simulated delay in ms
  errorRate?: number // Probability of error (0-1)
  streamChunkSize?: number
  deterministicSeed?: number
  mockModel?: string
}

export class MockProviderPlugin implements ProviderPlugin {
  readonly name = 'mock-provider'
  readonly version = '1.0.0'
  readonly capabilities = ['streaming', 'structured-generation', 'deterministic']

  private config: MockProviderConfig
  private callCount: number = 0
  private responses: Map<string, string>

  constructor(config: MockProviderConfig = {}) {
    this.config = {
      delay: config.delay || 100,
      errorRate: config.errorRate || 0,
      streamChunkSize: config.streamChunkSize || 10,
      deterministicSeed: config.deterministicSeed || 42,
      mockModel: config.mockModel || 'mock-model-v1',
      ...config
    }

    this.responses = config.responses || this.createDefaultResponses()
  }

  initialize(): Effect.Effect<void, ProviderError> {
    return Effect.succeed(undefined)
  }

  generate(prompt: string, options?: GenerationOptions): Effect.Effect<GenerationResult, ProviderError> {
    return Effect.gen(
      function* (_) {
        this.callCount++

        // Simulate delay
        if (this.config.delay && this.config.delay > 0) {
          yield* _(Effect.sleep(this.config.delay))
        }

        // Simulate errors
        if (this.config.errorRate && Math.random() < this.config.errorRate) {
          return yield* _(
            Effect.fail(
              new ProviderError({
                provider: this.name,
                message: 'Simulated provider error',
                code: 'MOCK_ERROR',
                retryable: true
              })
            )
          )
        }

        // Generate response
        const response = this.generateResponse(prompt, options)
        const tokens = this.estimateTokens(prompt, response)

        return {
          text: response,
          usage: {
            promptTokens: tokens.prompt,
            completionTokens: tokens.completion,
            totalTokens: tokens.prompt + tokens.completion
          },
          finishReason: 'stop',
          model: options?.model || this.config.mockModel
        }
      }.bind(this)
    )
  }

  stream(prompt: string, options?: GenerationOptions): Stream.Stream<string, ProviderError> {
    const response = this.generateResponse(prompt, options)
    const chunks = this.chunkResponse(response, this.config.streamChunkSize!)

    // Create stream from chunks
    return pipe(
      Stream.fromIterable(chunks),
      Stream.tap(() =>
        this.config.delay ? Effect.sleep(Math.floor(this.config.delay / 10)) : Effect.succeed(undefined)
      ),
      Stream.catchAll(() => {
        if (this.config.errorRate && Math.random() < this.config.errorRate) {
          return Stream.fail(
            new ProviderError({
              provider: this.name,
              message: 'Simulated stream error',
              code: 'MOCK_STREAM_ERROR',
              retryable: true
            })
          )
        }
        return Stream.empty
      })
    )
  }

  generateStructured<T>(
    prompt: string,
    schema: Schema.Schema<T, any>,
    options?: GenerationOptions
  ): Effect.Effect<T, ProviderError | ValidationError> {
    return Effect.gen(
      function* (_) {
        // Generate JSON response
        const jsonResponse = this.generateStructuredResponse(prompt, schema)

        // Parse and validate with schema
        const parsed = yield* _(
          Schema.decodeUnknown(schema)(jsonResponse).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new ValidationError({
                  field: 'response',
                  message: `Schema validation failed: ${error}`,
                  value: jsonResponse
                })
              )
            )
          )
        )

        return parsed
      }.bind(this)
    )
  }

  // Helper methods

  private createDefaultResponses(): Map<string, string> {
    const responses = new Map<string, string>()

    // Common patterns
    responses.set('optimize', 'Here is an optimized version of your prompt with improved clarity and structure.')
    responses.set('explain', 'This works by breaking down the problem into smaller, manageable steps.')
    responses.set('implement', 'Implementation involves several key components that work together.')
    responses.set('test', 'Testing should cover unit tests, integration tests, and edge cases.')
    responses.set('debug', 'To debug this issue, check the following potential causes.')
    responses.set('refactor', 'Refactoring improves code quality through better organization and patterns.')
    responses.set('algorithm', 'The algorithm uses an efficient approach with optimal time complexity.')
    responses.set('security', 'Security considerations include input validation and access control.')
    responses.set('performance', 'Performance can be improved through caching and optimization.')
    responses.set('architecture', 'The architecture follows established patterns and best practices.')

    return responses
  }

  private generateResponse(prompt: string, options?: GenerationOptions): string {
    // Check for exact match in responses
    for (const [pattern, response] of this.responses) {
      if (prompt.toLowerCase().includes(pattern.toLowerCase())) {
        return this.applyOptions(response, options)
      }
    }

    // Generate deterministic response based on prompt
    const hash = this.hashString(prompt + this.config.deterministicSeed)
    const templates = [
      `Based on the analysis of "${this.truncate(prompt, 50)}", the optimal approach involves systematic implementation.`,
      `To address "${this.truncate(prompt, 50)}", consider the following structured solution.`,
      `The solution for "${this.truncate(prompt, 50)}" requires careful consideration of multiple factors.`,
      `Implementing "${this.truncate(prompt, 50)}" effectively involves these key steps.`,
      `For "${this.truncate(prompt, 50)}", the recommended approach follows established patterns.`
    ]

    const template = templates[hash % templates.length]

    // Add more content based on options
    let response = template

    if (options?.temperature && options.temperature > 0.7) {
      response += '\n\nAdditional creative considerations may apply.'
    }

    if (options?.maxTokens && options.maxTokens > 100) {
      response +=
        '\n\n1. First, establish the foundation\n2. Then, build the core functionality\n3. Finally, optimize and refine'
    }

    return response
  }

  private generateStructuredResponse<T>(prompt: string, schema: Schema.Schema<T, any>): any {
    // Generate mock structured data based on schema
    // This is a simplified version - real implementation would analyze the schema

    const hash = this.hashString(prompt + JSON.stringify(schema))

    // Common structured responses
    const structures = [
      { result: 'success', data: { value: 42, message: 'Processed successfully' } },
      {
        status: 'complete',
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ]
      },
      { type: 'response', content: 'Structured content', metadata: { timestamp: Date.now() } },
      { answer: 'The solution', confidence: 0.95, reasoning: ['Step 1', 'Step 2'] },
      { output: { text: 'Generated text', score: 85, tags: ['tag1', 'tag2'] } }
    ]

    return structures[hash % structures.length]
  }

  private applyOptions(response: string, options?: GenerationOptions): string {
    if (!options) return response

    // Apply temperature variations
    if (options.temperature !== undefined) {
      if (options.temperature < 0.3) {
        response = response.replace(/may|might|could/g, 'will')
      } else if (options.temperature > 0.8) {
        response = response.replace(/will|must/g, 'might')
      }
    }

    // Apply max tokens truncation
    if (options.maxTokens) {
      const maxChars = options.maxTokens * 4 // Rough approximation
      if (response.length > maxChars) {
        response = response.substring(0, maxChars) + '...'
      }
    }

    // Apply stop sequences
    if (options.stopSequences) {
      for (const stop of options.stopSequences) {
        const index = response.indexOf(stop)
        if (index > -1) {
          response = response.substring(0, index)
        }
      }
    }

    return response
  }

  private chunkResponse(response: string, chunkSize: number): string[] {
    const words = response.split(' ')
    const chunks: string[] = []

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, Math.min(i + chunkSize, words.length))
      chunks.push(chunk.join(' ') + (i + chunkSize < words.length ? ' ' : ''))
    }

    return chunks
  }

  private estimateTokens(
    prompt: string,
    response: string
  ): {
    prompt: number
    completion: number
  } {
    return {
      prompt: Math.ceil(prompt.length / 4),
      completion: Math.ceil(response.length / 4)
    }
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength - 3) + '...'
  }

  // Additional testing utilities

  /**
   * Set a specific response for a prompt pattern
   */
  setResponse(pattern: string, response: string): void {
    this.responses.set(pattern, response)
  }

  /**
   * Get call count for testing
   */
  getCallCount(): number {
    return this.callCount
  }

  /**
   * Reset state for testing
   */
  reset(): void {
    this.callCount = 0
    this.responses = this.createDefaultResponses()
  }

  /**
   * Simulate network failure
   */
  simulateFailure(): void {
    this.config.errorRate = 1
  }

  /**
   * Restore normal operation
   */
  restoreNormal(): void {
    this.config.errorRate = 0
  }
}

/**
 * Create a mock provider plugin
 */
export function createMockProvider(config?: MockProviderConfig): MockProviderPlugin {
  return new MockProviderPlugin(config)
}

/**
 * Create a mock provider with predefined responses
 */
export function createPredefinedMockProvider(
  responses: Record<string, string>,
  config?: Omit<MockProviderConfig, 'responses'>
): MockProviderPlugin {
  return new MockProviderPlugin({
    ...config,
    responses: new Map(Object.entries(responses))
  })
}

/**
 * Create a mock provider that always fails
 */
export function createFailingMockProvider(errorMessage: string = 'Mock provider failure'): MockProviderPlugin {
  const provider = new MockProviderPlugin({ errorRate: 1 })

  // Override generate to always fail with specific message
  provider.generate = () =>
    Effect.fail(
      new ProviderError({
        provider: 'mock-provider',
        message: errorMessage,
        code: 'MOCK_FAILURE',
        retryable: false
      })
    )

  return provider
}
