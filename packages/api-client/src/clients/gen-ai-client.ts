import { z } from 'zod'
import { BaseApiClient, PromptlianoError } from '../base-client'
import type { DataResponseSchema } from '../types'

// Import schemas from @promptliano/schemas
import {
  AiGenerateTextRequestSchema,
  AiGenerateTextResponseSchema,
  AiGenerateStructuredRequestSchema,
  AiGenerateStructuredResponseSchema,
  ModelsListResponseSchema,
  ModelsQuerySchema,
  type AiGenerateTextRequest,
  type AiGenerateStructuredRequest,
  type UnifiedModel
} from '@promptliano/schemas'

// Import the providers schema from schemas package if available, otherwise define locally
const ProvidersListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    isCustom: z.boolean().optional(),
    baseUrl: z.string().optional()
  }))
})

export type Provider = {
  id: string
  name: string
  isCustom?: boolean
  baseUrl?: string
}

export type GetModelsOptions = {
  ollamaUrl?: string
  lmstudioUrl?: string
}

/**
 * GenAI API client for managing AI providers, models, and text generation
 */
export class GenAiClient extends BaseApiClient {
  /**
   * Get all available providers including custom ones
   */
  async getProviders(): Promise<DataResponseSchema<Provider[]>> {
    const result = await this.request('GET', '/providers', { 
      responseSchema: ProvidersListResponseSchema 
    })
    return result as DataResponseSchema<Provider[]>
  }

  /**
   * Get available models for a specific provider
   */
  async getModels(provider: string, options?: GetModelsOptions): Promise<DataResponseSchema<UnifiedModel[]>> {
    const params: Record<string, string> = { provider }
    
    // Add optional URL parameters if provided
    if (options?.ollamaUrl) {
      params.ollamaUrl = options.ollamaUrl
    }
    if (options?.lmstudioUrl) {
      params.lmstudioUrl = options.lmstudioUrl
    }

    const result = await this.request('GET', '/models', {
      params,
      responseSchema: ModelsListResponseSchema
    })
    return result as DataResponseSchema<UnifiedModel[]>
  }

  /**
   * Generate text using a specified model and prompt
   */
  async generateText(data: AiGenerateTextRequest): Promise<DataResponseSchema<{ text: string }>> {
    const validatedData = this.validateBody(AiGenerateTextRequestSchema, data)
    const result = await this.request('POST', '/gen-ai/text', {
      body: validatedData,
      responseSchema: AiGenerateTextResponseSchema
    })
    return result as DataResponseSchema<{ text: string }>
  }

  /**
   * Generate structured data based on a predefined schema key and user input
   */
  async generateStructured(data: AiGenerateStructuredRequest): Promise<DataResponseSchema<{ output: any }>> {
    const validatedData = this.validateBody(AiGenerateStructuredRequestSchema, data)
    const result = await this.request('POST', '/gen-ai/structured', {
      body: validatedData,
      responseSchema: AiGenerateStructuredResponseSchema
    })
    return result as DataResponseSchema<{ output: any }>
  }

  /**
   * Stream AI text response - returns ReadableStream for processing chunks
   */
  async streamText(data: AiGenerateTextRequest): Promise<ReadableStream> {
    const validatedData = this.validateBody(AiGenerateTextRequestSchema, data)
    const url = this.baseUrl
      ? new URL('/api/gen-ai/stream', this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/')
      : new URL('/api/gen-ai/stream', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3579')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await this.customFetch(url.toString(), {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(validatedData),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: any
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          throw new PromptlianoError(`Stream request failed: ${response.status}`, response.status)
        }

        if (errorData?.error) {
          throw new PromptlianoError(
            errorData.error.message || 'Stream request failed',
            response.status,
            errorData.error.code,
            errorData.error.details
          )
        }
        throw new PromptlianoError(`Stream request failed: ${response.status}`, response.status)
      }

      if (!response.body) {
        throw new PromptlianoError('No response body for stream')
      }

      return response.body
    } catch (e) {
      if (e instanceof PromptlianoError) throw e
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new PromptlianoError('Stream request timeout', undefined, 'TIMEOUT')
        }
        throw new PromptlianoError(`Stream request failed: ${e.message}`)
      }
      throw new PromptlianoError('Unknown error occurred during stream request')
    }
  }
}