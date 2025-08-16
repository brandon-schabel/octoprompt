import { z } from 'zod'
import { ApiError } from '@promptliano/shared'
import { zodToJsonSchema } from '../utils/zod-to-json-schema'
import { getProviderUrl } from '../provider-settings-service'
import type { CoreMessage } from 'ai'
import type { AiSdkOptions } from '@promptliano/schemas'

export interface LMStudioGenerateOptions {
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  systemMessage?: string
  debug?: boolean
}

/**
 * Custom LM Studio provider that supports native structured outputs
 * via the response_format.json_schema API
 */
export class LMStudioProvider {
  private baseUrl: string
  private debug: boolean

  constructor(options: AiSdkOptions & { debug?: boolean }) {
    // Priority: options > provider settings > default
    const url = options.lmstudioUrl || getProviderUrl('lmstudio') || 'http://localhost:1234'

    // Ensure URL ends with /v1 for OpenAI compatibility
    this.baseUrl = url.endsWith('/v1') ? url : url.replace(/\/$/, '') + '/v1'
    this.debug = options.debug || false

    if (this.debug) {
      console.log(`[LMStudioProvider] Initialized with URL: ${this.baseUrl}`)
    }
  }

  /**
   * Generate structured data using LM Studio's native json_schema support
   */
  async generateObject<T extends z.ZodType<any>>(
    schema: T,
    prompt: string,
    options: LMStudioGenerateOptions
  ): Promise<{
    object: z.infer<T>
    usage: { completionTokens: number; promptTokens: number; totalTokens: number }
    finishReason: string
  }> {
    try {
      // Convert Zod schema to JSON Schema format
      const jsonSchema = zodToJsonSchema(schema)

      if (this.debug) {
        console.log('[LMStudioProvider] Converted Zod schema to JSON Schema:', JSON.stringify(jsonSchema, null, 2))
      }

      // Build messages array
      const messages: Array<{ role: string; content: string }> = []

      if (options.systemMessage) {
        messages.push({ role: 'system', content: options.systemMessage })
      }

      messages.push({ role: 'user', content: prompt })

      // Prepare request body
      const requestBody = {
        model: options.model,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_response',
            schema: jsonSchema,
            strict: true
          }
        },
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0
      }

      if (this.debug) {
        console.log('[LMStudioProvider] Sending request to LM Studio:', {
          url: `${this.baseUrl}/chat/completions`,
          model: requestBody.model,
          responseFormat: requestBody.response_format.type
        })
      }

      // Make API request
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer lm-studio' // LM Studio doesn't need a real API key
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        if (this.debug) {
          console.error('[LMStudioProvider] API error:', response.status, errorText)
        }

        throw new ApiError(response.status, `LM Studio API error: ${errorText}`, 'LMSTUDIO_API_ERROR', {
          status: response.status,
          error: errorText
        })
      }

      const data = await response.json() as {
        choices?: Array<{
          finish_reason?: string;
          message?: { content?: string };
        }>;
        usage?: {
          completion_tokens?: number;
          prompt_tokens?: number;
          total_tokens?: number;
        };
      }

      if (this.debug) {
        console.log('[LMStudioProvider] Received response:', {
          finishReason: data.choices?.[0]?.finish_reason,
          usage: data.usage
        })
      }

      // Extract content from response
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new ApiError(500, 'No content in LM Studio response', 'LMSTUDIO_EMPTY_RESPONSE')
      }

      // Parse JSON response
      let parsedObject: any
      try {
        // Try to extract JSON from the content (LMStudio sometimes adds text before/after)
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsedObject = JSON.parse(jsonMatch[0])
        } else {
          // Fallback to direct parse if no JSON object found
          parsedObject = JSON.parse(content)
        }
      } catch (parseError) {
        if (this.debug) {
          console.error('[LMStudioProvider] Failed to parse JSON response:', content)
        }
        throw new ApiError(500, 'Failed to parse JSON from LM Studio response', 'LMSTUDIO_JSON_PARSE_ERROR', {
          response: content
        })
      }

      // Validate against Zod schema
      const validatedObject = schema.parse(parsedObject)

      // Return in the same format as Vercel AI SDK's generateObject
      return {
        object: validatedObject,
        usage: {
          completionTokens: data.usage?.completion_tokens ?? 0,
          promptTokens: data.usage?.prompt_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0
        },
        finishReason: data.choices?.[0]?.finish_reason ?? 'stop'
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }

      if (error instanceof z.ZodError) {
        throw new ApiError(400, 'LM Studio response failed schema validation', 'LMSTUDIO_VALIDATION_ERROR', {
          errors: error.errors
        })
      }

      throw new ApiError(
        500,
        `LM Studio provider error: ${error instanceof Error ? error.message : String(error)}`,
        'LMSTUDIO_PROVIDER_ERROR'
      )
    }
  }

  /**
   * Generate text (non-structured) using LM Studio
   */
  async generateText(prompt: string, options: LMStudioGenerateOptions): Promise<string> {
    try {
      const messages: Array<{ role: string; content: string }> = []

      if (options.systemMessage) {
        messages.push({ role: 'system', content: options.systemMessage })
      }

      messages.push({ role: 'user', content: prompt })

      const requestBody = {
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer lm-studio'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new ApiError(response.status, `LM Studio API error: ${errorText}`, 'LMSTUDIO_API_ERROR')
      }

      const data = await response.json() as {
        choices?: Array<{
          message?: { content?: string };
        }>;
      }
      return data.choices?.[0]?.message?.content ?? ''
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }

      throw new ApiError(
        500,
        `LM Studio provider error: ${error instanceof Error ? error.message : String(error)}`,
        'LMSTUDIO_PROVIDER_ERROR'
      )
    }
  }

  /**
   * Check if LM Studio is available and responding
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer lm-studio'
        }
      })

      return response.ok
    } catch {
      return false
    }
  }
}
