/**
 * LMStudio provider for integration testing
 */

import type { SolutionGenerator } from '../../src/types'
import { LMSTUDIO_CONFIG, isLMStudioAvailable } from '../fixtures/llm-configs'

export class LMStudioProvider implements SolutionGenerator<string> {
  private baseUrl: string
  private model: string
  private timeout: number
  private available: boolean = false

  constructor() {
    this.baseUrl = LMSTUDIO_CONFIG.baseUrl
    this.model = LMSTUDIO_CONFIG.model
    this.timeout = LMSTUDIO_CONFIG.timeout
  }

  async initialize(): Promise<boolean> {
    this.available = await isLMStudioAvailable()
    return this.available
  }

  async generate(
    prompt: string,
    temperature: number,
    topP: number
  ): Promise<string> {
    if (!this.available) {
      throw new Error('LMStudio is not available. Please ensure it is running at ' + this.baseUrl)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that provides clear, concise solutions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature,
          top_p: topP,
          max_tokens: LMSTUDIO_CONFIG.maxTokens,
          stream: false
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`LMStudio API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from LMStudio')
      }

      return data.choices[0].message.content
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`LMStudio request timed out after ${this.timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Stream generation for more advanced use cases
  async *generateStream(
    prompt: string,
    temperature: number,
    topP: number
  ): AsyncGenerator<string, void, unknown> {
    if (!this.available) {
      throw new Error('LMStudio is not available')
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        top_p: topP,
        max_tokens: LMSTUDIO_CONFIG.maxTokens,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`LMStudio API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          
          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            
            if (content) {
              yield content
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  // Get model information
  async getModelInfo(): Promise<{
    id: string
    context_length: number
    capabilities: string[]
  }> {
    if (!this.available) {
      throw new Error('LMStudio is not available')
    }

    const response = await fetch(`${this.baseUrl}/models`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch model info')
    }

    const data = await response.json()
    const models = data.data || []
    const model = models.find((m: any) => m.id === this.model) || models[0]

    return {
      id: model?.id || 'unknown',
      context_length: model?.context_length || 4096,
      capabilities: model?.capabilities || []
    }
  }
}

// Factory function for creating LMStudio provider with validation
export async function createLMStudioProvider(): Promise<LMStudioProvider | null> {
  const provider = new LMStudioProvider()
  const available = await provider.initialize()
  
  if (!available) {
    console.log('LMStudio is not available. Skipping LMStudio tests.')
    return null
  }
  
  return provider
}