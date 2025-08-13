/**
 * Mock LLM provider for deterministic testing
 */

import type { SolutionGenerator } from '../../src/types'

export interface MockResponse {
  pattern: RegExp | string
  response: string | ((prompt: string) => string)
  delay?: number
}

export class MockLLMProvider implements SolutionGenerator<string> {
  private responses: MockResponse[] = []
  private defaultResponse: string = 'Default mock response'
  private callHistory: Array<{
    prompt: string
    temperature: number
    topP: number
    response: string
    timestamp: number
  }> = []
  private errorRate: number = 0
  private latency: number = 0

  constructor(
    options: {
      defaultResponse?: string
      errorRate?: number
      latency?: number
    } = {}
  ) {
    this.defaultResponse = options.defaultResponse || this.defaultResponse
    this.errorRate = options.errorRate || 0
    this.latency = options.latency || 0
  }

  // Add a response pattern
  addResponse(pattern: RegExp | string, response: string | ((prompt: string) => string), delay?: number): void {
    this.responses.push({ pattern, response, delay })
  }

  // Generate response based on patterns
  async generate(prompt: string, temperature: number, topP: number): Promise<string> {
    // Simulate error rate
    if (Math.random() < this.errorRate) {
      throw new Error('Mock LLM error: Service temporarily unavailable')
    }

    // Simulate latency
    if (this.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latency))
    }

    // Find matching response pattern
    let response = this.defaultResponse
    let customDelay = 0

    for (const mockResponse of this.responses) {
      const matches =
        typeof mockResponse.pattern === 'string'
          ? prompt.includes(mockResponse.pattern)
          : mockResponse.pattern.test(prompt)

      if (matches) {
        response = typeof mockResponse.response === 'function' ? mockResponse.response(prompt) : mockResponse.response
        customDelay = mockResponse.delay || 0
        break
      }
    }

    // Apply custom delay if specified
    if (customDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, customDelay))
    }

    // Apply temperature variation (simulate randomness)
    if (temperature > 0.7) {
      const variations = [' (high temperature variation)', ' (creative response)', ' (alternative approach)']
      response += variations[Math.floor(Math.random() * variations.length)]
    }

    // Record call history
    this.callHistory.push({
      prompt,
      temperature,
      topP,
      response,
      timestamp: Date.now()
    })

    return response
  }

  // Get call history for assertions
  getCallHistory() {
    return [...this.callHistory]
  }

  // Clear history
  reset(): void {
    this.callHistory = []
  }

  // Get call count
  getCallCount(): number {
    return this.callHistory.length
  }

  // Set error rate for testing error handling
  setErrorRate(rate: number): void {
    this.errorRate = Math.max(0, Math.min(1, rate))
  }

  // Set latency for performance testing
  setLatency(ms: number): void {
    this.latency = Math.max(0, ms)
  }
}

// Pre-configured mock providers for different scenarios
export const mockProviders = {
  // Deterministic provider for unit tests
  deterministic: () => {
    const provider = new MockLLMProvider({
      defaultResponse: 'Deterministic response'
    })

    // Add specific patterns for common test cases
    provider.addResponse(
      /sort.*array/i,
      `
function sortArray(arr) {
  return arr.sort((a, b) => a - b);
}
    `
    )

    provider.addResponse(
      /binary.*search/i,
      `
function binarySearch(arr, target) {
  let left = 0, right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
    `
    )

    provider.addResponse(
      /palindrome/i,
      `
function longestPalindrome(s) {
  let longest = "";
  for (let i = 0; i < s.length; i++) {
    for (let j = i; j < s.length; j++) {
      const substr = s.slice(i, j + 1);
      if (isPalindrome(substr) && substr.length > longest.length) {
        longest = substr;
      }
    }
  }
  return longest;
}
    `
    )

    return provider
  },

  // Variable provider for self-consistency testing
  variable: () => {
    const provider = new MockLLMProvider()
    let callCount = 0

    provider.addResponse(/.*/, (prompt) => {
      callCount++
      const variations = [
        'Solution approach A',
        'Solution approach B',
        'Solution approach C',
        'Solution approach A', // Repeat to test consistency
        'Solution approach B'
      ]
      return variations[callCount % variations.length]
    })

    return provider
  },

  // Slow provider for timeout testing
  slow: () => {
    return new MockLLMProvider({
      latency: 5000 // 5 second delay
    })
  },

  // Unreliable provider for retry testing
  unreliable: () => {
    return new MockLLMProvider({
      errorRate: 0.5 // 50% error rate
    })
  },

  // Context-aware provider
  contextAware: () => {
    const provider = new MockLLMProvider()

    provider.addResponse(/typescript/i, (prompt) => {
      return `
// TypeScript implementation
interface Solution {
  execute(): void;
}

class TypeScriptSolution implements Solution {
  execute(): void {
    console.log("TypeScript solution");
  }
}
      `
    })

    provider.addResponse(/python/i, (prompt) => {
      return `
# Python implementation
class PythonSolution:
    def execute(self):
        print("Python solution")
      `
    })

    provider.addResponse(/rust/i, (prompt) => {
      return `
// Rust implementation
struct RustSolution;

impl RustSolution {
    fn execute(&self) {
        println!("Rust solution");
    }
}
      `
    })

    return provider
  }
}

// LMStudio API mock for integration testing
export class LMStudioMock {
  private provider: MockLLMProvider
  private models: string[] = ['gpt-oss:20b', 'llama-2-7b', 'mistral-7b']

  constructor() {
    this.provider = mockProviders.deterministic()
  }

  // Mock /v1/chat/completions endpoint
  async chatCompletion(request: {
    model: string
    messages: Array<{ role: string; content: string }>
    temperature?: number
    max_tokens?: number
    top_p?: number
  }): Promise<{
    choices: Array<{
      message: { role: string; content: string }
      finish_reason: string
    }>
    usage: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
  }> {
    const lastMessage = request.messages[request.messages.length - 1]
    const response = await this.provider.generate(lastMessage.content, request.temperature || 0.7, request.top_p || 0.9)

    const promptTokens = Math.ceil(lastMessage.content.length / 4)
    const completionTokens = Math.ceil(response.length / 4)

    return {
      choices: [
        {
          message: { role: 'assistant', content: response },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    }
  }

  // Mock /v1/models endpoint
  async listModels(): Promise<{
    data: Array<{ id: string; object: string }>
  }> {
    return {
      data: this.models.map((id) => ({ id, object: 'model' }))
    }
  }

  // Add a model to the list
  addModel(modelId: string): void {
    if (!this.models.includes(modelId)) {
      this.models.push(modelId)
    }
  }

  // Set the underlying provider
  setProvider(provider: MockLLMProvider): void {
    this.provider = provider
  }
}
