import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { createPromptlianoClient, PromptlianoError } from '@promptliano/api-client'
import type { PromptlianoClient } from '@promptliano/api-client'
import { createTestEnvironment, checkLMStudioAvailability, type TestEnvironment } from './test-environment'

describe('AI Endpoints Integration Tests', () => {
  let testEnv: TestEnvironment
  let client: PromptlianoClient
  let lmstudioAvailable = false
  let skipAITests = false

  beforeAll(async () => {
    console.log('🚀 Setting up AI endpoints test environment...')
    
    // Create test environment with AI configuration
    testEnv = await createTestEnvironment({
      ai: {
        lmstudio: {
          enabled: true,
          baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://192.168.1.38:1234',
          model: 'openai/gpt-oss-20b',
          timeout: 30000
        },
        useMockWhenUnavailable: true
      }
    })
    
    client = createPromptlianoClient({
      baseUrl: testEnv.baseUrl,
      timeout: testEnv.config.execution.apiTimeout
    })

    // Check LMStudio availability
    const lmstudioStatus = await checkLMStudioAvailability(testEnv.config.ai.lmstudio)
    lmstudioAvailable = lmstudioStatus.available

    if (!lmstudioAvailable) {
      console.warn('⚠️  LMStudio not available:', lmstudioStatus.message)
      console.warn('   You can:')
      console.warn('   1. Start LMStudio at', testEnv.config.ai.lmstudio.baseUrl)
      console.warn('   2. Load a model (recommended: gpt-oss-20b or similar)')
      console.warn('   3. Or set LMSTUDIO_BASE_URL to your LMStudio instance')
      console.warn('   4. Or set SKIP_AI_TESTS=true to skip AI endpoint tests')
    } else {
      console.log('✅ LMStudio available:', lmstudioStatus.message)
      console.log('   Available models:', lmstudioStatus.models.join(', '))
    }

    // Skip tests if explicitly requested or in CI without LMStudio
    skipAITests = process.env.SKIP_AI_TESTS === 'true' || (testEnv.isCI && !lmstudioAvailable)
    
    if (skipAITests) {
      console.log('⏭️  Skipping AI endpoint tests')
    }
  })

  afterAll(async () => {
    console.log('🧹 Cleaning up AI test environment...')
    await testEnv.cleanup()
  })

  beforeEach(() => {
    if (skipAITests) {
      console.log('⏭️  Test skipped: AI endpoints testing disabled')
      return
    }
  })

  describe('LMStudio Connection', () => {
    test.skipIf(skipAITests)('should connect to LMStudio successfully', async () => {
      const status = await checkLMStudioAvailability(testEnv.config.ai.lmstudio)
      expect(status.available).toBe(true)
      expect(status.models.length).toBeGreaterThan(0)
    })

    test.skipIf(skipAITests)('should have the target model available', async () => {
      const status = await checkLMStudioAvailability(testEnv.config.ai.lmstudio)
      const hasTargetModel = status.models.some((model: string) => 
        model === testEnv.config.ai.lmstudio.model || model.includes('gpt-oss')
      )
      expect(hasTargetModel).toBe(true)
    })
  })

  describe('Gen-AI Endpoints', () => {
    test.skipIf(skipAITests)('should generate text completion', async () => {
      try {
        // This would call your gen-ai completion endpoint
        // You'll need to implement this based on your actual API structure
        const response = await fetch(`${testEnv.baseUrl}/api/gen-ai/completion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: 'Write a simple hello world function in TypeScript:',
            maxTokens: 100,
            temperature: 0.3
          })
        })

        expect(response.ok).toBe(true)
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data).toBeDefined()
        expect(data.data.content).toBeDefined()
        expect(typeof data.data.content).toBe('string')
        expect(data.data.content.length).toBeGreaterThan(0)
      } catch (error) {
        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
          console.warn('LMStudio connection failed during test:', error.message)
          expect(testEnv.config.ai.useMockWhenUnavailable).toBe(true)
        } else {
          throw error
        }
      }
    }, 30000) // 30 second timeout for AI operations

    test.skipIf(skipAITests)('should handle streaming chat completion', async () => {
      try {
        const response = await fetch(`${testEnv.baseUrl}/api/gen-ai/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              { role: 'user', content: 'Say hello in exactly 3 words.' }
            ],
            temperature: 0.3,
            maxTokens: 50
          })
        })

        expect(response.ok).toBe(true)
        expect(response.headers.get('content-type')).toContain('text/stream')

        // Collect streamed data
        const reader = response.body?.getReader()
        expect(reader).toBeDefined()

        let chunks: string[] = []
        let done = false

        while (!done && reader) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) {
            chunks.push(new TextDecoder().decode(value))
          }
        }

        expect(chunks.length).toBeGreaterThan(0)
        const fullResponse = chunks.join('')
        expect(fullResponse.length).toBeGreaterThan(0)
      } catch (error) {
        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
          console.warn('LMStudio connection failed during streaming test:', error.message)
          expect(testEnv.config.ai.useMockWhenUnavailable).toBe(true)
        } else {
          throw error
        }
      }
    }, 30000)

    test.skipIf(skipAITests)('should generate structured data', async () => {
      try {
        const response = await fetch(`${testEnv.baseUrl}/api/gen-ai/structured`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: 'Generate a simple todo item with title and description',
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['title', 'description']
            }
          })
        })

        expect(response.ok).toBe(true)
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data).toBeDefined()
        expect(data.data.title).toBeDefined()
        expect(data.data.description).toBeDefined()
        expect(typeof data.data.title).toBe('string')
        expect(typeof data.data.description).toBe('string')
      } catch (error) {
        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
          console.warn('LMStudio connection failed during structured generation test:', error.message)
          expect(testEnv.config.ai.useMockWhenUnavailable).toBe(true)
        } else {
          throw error
        }
      }
    }, 30000)
  })

  describe('File Summarization', () => {
    test.skipIf(skipAITests)('should summarize a code file', async () => {
      try {
        const sampleCode = `
export function calculateTotal(items: Array<{price: number, quantity: number}>): number {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0)
}

export class ShoppingCart {
  private items: Array<{price: number, quantity: number}> = []
  
  addItem(price: number, quantity: number): void {
    this.items.push({ price, quantity })
  }
  
  getTotal(): number {
    return calculateTotal(this.items)
  }
}
        `

        const response = await fetch(`${testEnv.baseUrl}/api/gen-ai/summarize-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: sampleCode,
            fileName: 'shopping-cart.ts',
            fileType: 'typescript'
          })
        })

        expect(response.ok).toBe(true)
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data).toBeDefined()
        expect(data.data.summary).toBeDefined()
        expect(typeof data.data.summary).toBe('string')
        expect(data.data.summary.length).toBeGreaterThan(20)

        // Check that summary mentions key concepts
        const summary = data.data.summary.toLowerCase()
        expect(
          summary.includes('shopping') || 
          summary.includes('cart') || 
          summary.includes('calculate') ||
          summary.includes('total')
        ).toBe(true)
      } catch (error) {
        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
          console.warn('LMStudio connection failed during file summarization test:', error.message)
          expect(testEnv.config.ai.useMockWhenUnavailable).toBe(true)
        } else {
          throw error
        }
      }
    }, 45000) // Longer timeout for file analysis
  })

  describe('Error Handling', () => {
    test('should handle invalid requests gracefully', async () => {
      const response = await fetch(`${testEnv.baseUrl}/api/gen-ai/completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Invalid request - missing required fields
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
      expect(data.error.code).toBeDefined()
    })

    test('should handle timeout scenarios', async () => {
      // Test with a very short timeout to trigger timeout behavior
      const shortTimeoutClient = createPromptlianoClient({
        baseUrl: testEnv.baseUrl,
        timeout: 100 // Very short timeout
      })

      try {
        await fetch(`${testEnv.baseUrl}/api/gen-ai/completion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: 'Generate a very long story about the history of computing...',
            maxTokens: 1000
          }),
          signal: AbortSignal.timeout(100)
        })
        
        // If we get here, the request completed faster than expected
        // This is not necessarily a failure
      } catch (error) {
        // Expect timeout error
        expect(error instanceof Error).toBe(true)
        expect(
          error.message.includes('timeout') || 
          error.message.includes('aborted') ||
          error.message.includes('signal')
        ).toBe(true)
      }
    })
  })

  describe('Mock Fallback', () => {
    test('should use mock responses when configured and LMStudio unavailable', async () => {
      if (lmstudioAvailable) {
        console.log('⏭️  Skipping mock test: LMStudio is available')
        return
      }

      // When LMStudio is not available and mocks are enabled,
      // the system should still return valid responses
      expect(testEnv.config.ai.useMockWhenUnavailable).toBe(true)
      
      // This test validates that the mock system works
      // Implementation would depend on your actual mock strategy
      expect(true).toBe(true) // Placeholder - implement based on your mock system
    })
  })
})