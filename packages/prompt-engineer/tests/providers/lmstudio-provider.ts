// ============================================================================
// LMStudio Provider for Testing
// ============================================================================

export interface LMStudioConfig {
  endpoint: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface LMStudioProvider {
  complete: (prompt: string) => Promise<string>
  chat: (messages: Array<{ role: string; content: string }>) => Promise<string>
}

export function createLMStudioProvider(config: LMStudioConfig): LMStudioProvider {
  const baseURL = config.endpoint.replace(/\/$/, '')

  return {
    async complete(prompt: string): Promise<string> {
      try {
        const response = await fetch(`${baseURL}/v1/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: config.model,
            prompt,
            temperature: config.temperature || 0.7,
            max_tokens: config.maxTokens || 500,
            stream: false
          })
        })

        if (!response.ok) {
          throw new Error(`LMStudio error: ${response.statusText}`)
        }

        const data = await response.json()
        return data.choices?.[0]?.text || ''
      } catch (error) {
        // Return mock response if LMStudio is not available
        return `Mock response for: ${prompt.substring(0, 50)}...`
      }
    },

    async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
      try {
        const response = await fetch(`${baseURL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: config.temperature || 0.7,
            max_tokens: config.maxTokens || 500,
            stream: false
          })
        })

        if (!response.ok) {
          throw new Error(`LMStudio error: ${response.statusText}`)
        }

        const data = await response.json()
        return data.choices?.[0]?.message?.content || ''
      } catch (error) {
        // Return mock response if LMStudio is not available
        const lastMessage = messages[messages.length - 1]
        return `Mock chat response for: ${lastMessage?.content?.substring(0, 50)}...`
      }
    }
  }
}

// Mock provider for testing without LMStudio
export function createMockProvider(): LMStudioProvider {
  return {
    async complete(prompt: string): Promise<string> {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Generate response based on prompt content
      if (prompt.includes('sort')) {
        return 'To sort an array, you can use the quicksort algorithm with O(n log n) average complexity.'
      }
      if (prompt.includes('fibonacci')) {
        return 'The Fibonacci sequence can be calculated recursively or iteratively, with the iterative approach being more efficient.'
      }
      if (prompt.includes('algorithm')) {
        return 'When implementing algorithms, consider time and space complexity, edge cases, and optimization opportunities.'
      }

      return `Processed: ${prompt.substring(0, 100)}...`
    },

    async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
      await new Promise((resolve) => setTimeout(resolve, 100))

      const lastMessage = messages[messages.length - 1]
      const content = lastMessage?.content || ''

      if (content.includes('optimize')) {
        return 'Optimization involves improving performance through better algorithms, caching, and reducing redundant operations.'
      }
      if (content.includes('test')) {
        return 'Testing should include unit tests, integration tests, and edge case validation.'
      }

      return `Chat response: ${content.substring(0, 100)}...`
    }
  }
}
