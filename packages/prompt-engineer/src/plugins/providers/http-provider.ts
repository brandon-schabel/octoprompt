/**
 * HTTP Provider Plugin
 * Generic HTTP/REST API adapter with retry logic and rate limiting
 */

import { Effect, Stream, Schema, pipe, Schedule, Duration, Ref } from 'effect'
import type { 
  ProviderPlugin, 
  GenerationOptions, 
  GenerationResult,
  ProviderError as ProviderErrorType
} from '../types'
import { ProviderError, ValidationError } from '../types'

interface HTTPProviderConfig {
  endpoint: string
  apiKey?: string
  headers?: Record<string, string>
  model?: string
  timeout?: number // ms
  retryConfig?: {
    maxAttempts?: number
    initialDelay?: number // ms
    maxDelay?: number // ms
    backoffFactor?: number
  }
  rateLimit?: {
    requestsPerMinute?: number
    tokensPerMinute?: number
  }
  requestTransform?: (prompt: string, options?: GenerationOptions) => any
  responseTransform?: (response: any) => GenerationResult
  streamTransform?: (chunk: any) => string
}

interface RateLimitState {
  requests: number
  tokens: number
  windowStart: number
}

export class HTTPProviderPlugin implements ProviderPlugin {
  readonly name: string
  readonly version = '1.0.0'
  readonly capabilities = ['streaming', 'retry', 'rate-limiting']
  
  private config: HTTPProviderConfig
  private rateLimitState: Ref.Ref<RateLimitState>
  
  constructor(config: HTTPProviderConfig) {
    this.name = config.endpoint.includes('openai') ? 'http-openai' :
                 config.endpoint.includes('anthropic') ? 'http-anthropic' :
                 config.endpoint.includes('cohere') ? 'http-cohere' :
                 'http-provider'
    
    this.config = {
      timeout: 30000, // 30 seconds default
      retryConfig: {
        maxAttempts: config.retryConfig?.maxAttempts || 3,
        initialDelay: config.retryConfig?.initialDelay || 1000,
        maxDelay: config.retryConfig?.maxDelay || 10000,
        backoffFactor: config.retryConfig?.backoffFactor || 2,
        ...config.retryConfig
      },
      ...config
    }
    
    this.rateLimitState = Ref.unsafeMake({
      requests: 0,
      tokens: 0,
      windowStart: Date.now()
    })
  }

  initialize(): Effect.Effect<void, ProviderError> {
    return Effect.gen(function* (_) {
      // Test connection
      const testResponse = yield* _(
        this.testConnection().pipe(
          Effect.catchAll((error) => 
            Effect.succeed(false) // Connection test failed, but initialization continues
          )
        )
      )
      
      if (!testResponse) {
        console.warn(`HTTP Provider: Unable to verify connection to ${this.config.endpoint}`)
      }
    }.bind(this))
  }

  generate(
    prompt: string,
    options?: GenerationOptions
  ): Effect.Effect<GenerationResult, ProviderError> {
    return Effect.gen(function* (_) {
      // Check rate limits
      yield* _(this.checkRateLimit(prompt))
      
      // Prepare request
      const requestBody = this.prepareRequest(prompt, options)
      
      // Make HTTP request with retry
      const response = yield* _(
        this.makeRequest(requestBody).pipe(
          Effect.retry(this.getRetrySchedule()),
          Effect.timeout(Duration.millis(this.config.timeout!))
        )
      )
      
      // Transform response
      const result = this.transformResponse(response)
      
      // Update rate limit counters
      yield* _(this.updateRateLimits(result))
      
      return result
    }.bind(this))
  }

  stream(
    prompt: string,
    options?: GenerationOptions
  ): Stream.Stream<string, ProviderError> {
    return Stream.gen(function* (_) {
      // Check rate limits
      yield* _(Stream.fromEffect(this.checkRateLimit(prompt)))
      
      // Prepare request for streaming
      const requestBody = {
        ...this.prepareRequest(prompt, options),
        stream: true
      }
      
      // Make streaming request
      const response = yield* _(Stream.fromEffect(
        this.makeStreamingRequest(requestBody)
      ))
      
      // Process SSE stream
      yield* _(this.processSSEStream(response))
    }.bind(this)).pipe(
      Stream.catchAll((error) => 
        Stream.fail(new ProviderError({
          provider: this.name,
          message: `Stream error: ${error}`,
          code: 'STREAM_ERROR',
          retryable: false
        }))
      )
    )
  }

  generateStructured<T>(
    prompt: string,
    schema: Schema.Schema<T, any>,
    options?: GenerationOptions
  ): Effect.Effect<T, ProviderError | ValidationError> {
    return Effect.gen(function* (_) {
      // Generate with JSON mode hint
      const jsonPrompt = `${prompt}\n\nRespond with valid JSON that matches the expected schema.`
      const jsonOptions = {
        ...options,
        responseFormat: { type: 'json_object' } // OpenAI-style JSON mode
      }
      
      const result = yield* _(this.generate(jsonPrompt, jsonOptions))
      
      // Try to parse JSON from response
      const jsonText = this.extractJSON(result.text)
      const parsed = yield* _(
        Effect.try({
          try: () => JSON.parse(jsonText),
          catch: (error) => new ValidationError({
            field: 'response',
            message: `Failed to parse JSON: ${error}`,
            value: jsonText
          })
        })
      )
      
      // Validate against schema
      return yield* _(
        Schema.decodeUnknown(schema)(parsed).pipe(
          Effect.catchAll((error) => 
            Effect.fail(new ValidationError({
              field: 'response',
              message: `Schema validation failed: ${error}`,
              value: parsed
            }))
          )
        )
      )
    }.bind(this))
  }

  // Helper methods

  private testConnection(): Effect.Effect<boolean, ProviderError> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(this.config.endpoint, {
          method: 'GET',
          headers: this.getHeaders()
        })
        return response.ok || response.status === 401 // 401 means auth works but no key
      },
      catch: (error) => new ProviderError({
        provider: this.name,
        message: `Connection test failed: ${error}`,
        code: 'CONNECTION_ERROR',
        retryable: false
      })
    })
  }

  private prepareRequest(prompt: string, options?: GenerationOptions): any {
    if (this.config.requestTransform) {
      return this.config.requestTransform(prompt, options)
    }
    
    // Default OpenAI-style request
    return {
      model: options?.model || this.config.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      frequency_penalty: options?.frequencyPenalty,
      presence_penalty: options?.presencePenalty,
      stop: options?.stopSequences
    }
  }

  private makeRequest(body: any): Effect.Effect<any, ProviderError> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body)
        })
        
        if (!response.ok) {
          const error = await response.text()
          throw new Error(`HTTP ${response.status}: ${error}`)
        }
        
        return response.json()
      },
      catch: (error: any) => new ProviderError({
        provider: this.name,
        message: `Request failed: ${error.message}`,
        code: error.message.includes('429') ? 'RATE_LIMIT' : 'REQUEST_ERROR',
        retryable: error.message.includes('429') || error.message.includes('500')
      })
    })
  }

  private makeStreamingRequest(body: any): Effect.Effect<ReadableStream, ProviderError> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body)
        })
        
        if (!response.ok) {
          const error = await response.text()
          throw new Error(`HTTP ${response.status}: ${error}`)
        }
        
        if (!response.body) {
          throw new Error('No response body for streaming')
        }
        
        return response.body
      },
      catch: (error: any) => new ProviderError({
        provider: this.name,
        message: `Streaming request failed: ${error.message}`,
        code: 'STREAM_REQUEST_ERROR',
        retryable: false
      })
    })
  }

  private processSSEStream(stream: ReadableStream): Stream.Stream<string, ProviderError> {
    return Stream.async<string>((emit) => {
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      const read = async () => {
        try {
          const { done, value } = await reader.read()
          
          if (done) {
            emit.end()
            return
          }
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                emit.end()
                return
              }
              
              try {
                const parsed = JSON.parse(data)
                const chunk = this.extractStreamChunk(parsed)
                if (chunk) {
                  emit.single(chunk)
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
          
          read()
        } catch (error) {
          emit.fail(new ProviderError({
            provider: this.name,
            message: `Stream processing error: ${error}`,
            code: 'STREAM_PROCESS_ERROR',
            retryable: false
          }))
        }
      }
      
      read()
    })
  }

  private extractStreamChunk(data: any): string | null {
    if (this.config.streamTransform) {
      return this.config.streamTransform(data)
    }
    
    // Default OpenAI-style extraction
    return data.choices?.[0]?.delta?.content || 
           data.choices?.[0]?.text ||
           data.content || 
           null
  }

  private transformResponse(response: any): GenerationResult {
    if (this.config.responseTransform) {
      return this.config.responseTransform(response)
    }
    
    // Default OpenAI-style response
    const choice = response.choices?.[0]
    const text = choice?.message?.content || choice?.text || ''
    
    return {
      text,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined,
      finishReason: choice?.finish_reason as any,
      model: response.model
    }
  }

  private extractJSON(text: string): string {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return jsonMatch[0]
    }
    
    // Try array format
    const arrayMatch = text.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      return arrayMatch[0]
    }
    
    // Assume entire response is JSON
    return text
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers
    }
    
    if (this.config.apiKey) {
      // Try common auth header patterns
      if (this.config.endpoint.includes('openai')) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      } else if (this.config.endpoint.includes('anthropic')) {
        headers['x-api-key'] = this.config.apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else if (this.config.endpoint.includes('cohere')) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      } else {
        // Generic auth
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }
    }
    
    return headers
  }

  private checkRateLimit(prompt: string): Effect.Effect<void, ProviderError> {
    if (!this.config.rateLimit) {
      return Effect.succeed(undefined)
    }
    
    return Effect.gen(function* (_) {
      const now = Date.now()
      const state = yield* _(Ref.get(this.rateLimitState))
      
      // Reset window if needed
      if (now - state.windowStart > 60000) {
        yield* _(Ref.set(this.rateLimitState, {
          requests: 0,
          tokens: 0,
          windowStart: now
        }))
        return
      }
      
      // Check limits
      const { requestsPerMinute, tokensPerMinute } = this.config.rateLimit
      
      if (requestsPerMinute && state.requests >= requestsPerMinute) {
        const waitTime = 60000 - (now - state.windowStart)
        return yield* _(Effect.fail(new ProviderError({
          provider: this.name,
          message: `Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)}s`,
          code: 'RATE_LIMIT',
          retryable: true
        })))
      }
      
      const estimatedTokens = Math.ceil(prompt.length / 4)
      if (tokensPerMinute && state.tokens + estimatedTokens > tokensPerMinute) {
        const waitTime = 60000 - (now - state.windowStart)
        return yield* _(Effect.fail(new ProviderError({
          provider: this.name,
          message: `Token limit exceeded. Wait ${Math.ceil(waitTime / 1000)}s`,
          code: 'TOKEN_LIMIT',
          retryable: true
        })))
      }
      
      // Update counters
      yield* _(Ref.update(this.rateLimitState, (s) => ({
        ...s,
        requests: s.requests + 1,
        tokens: s.tokens + estimatedTokens
      })))
    }.bind(this))
  }

  private updateRateLimits(result: GenerationResult): Effect.Effect<void, never> {
    if (!this.config.rateLimit || !result.usage) {
      return Effect.succeed(undefined)
    }
    
    return Ref.update(this.rateLimitState, (state) => ({
      ...state,
      tokens: state.tokens + (result.usage?.totalTokens || 0)
    }))
  }

  private getRetrySchedule() {
    const config = this.config.retryConfig!
    
    return Schedule.exponential(Duration.millis(config.initialDelay!), config.backoffFactor!).pipe(
      Schedule.either(Schedule.spaced(Duration.millis(config.maxDelay!))),
      Schedule.whileInput<any, ProviderError>((error) => error.retryable),
      Schedule.upTo(Duration.millis(config.maxDelay! * config.maxAttempts!))
    )
  }
}

/**
 * Create an HTTP provider plugin
 */
export function createHTTPProvider(config: HTTPProviderConfig): HTTPProviderPlugin {
  return new HTTPProviderPlugin(config)
}

/**
 * Create provider for OpenAI API
 */
export function createOpenAIProvider(apiKey: string, options?: Partial<HTTPProviderConfig>): HTTPProviderPlugin {
  return new HTTPProviderPlugin({
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey,
    model: 'gpt-3.5-turbo',
    ...options
  })
}

/**
 * Create provider for Anthropic API
 */
export function createAnthropicProvider(apiKey: string, options?: Partial<HTTPProviderConfig>): HTTPProviderPlugin {
  return new HTTPProviderPlugin({
    endpoint: 'https://api.anthropic.com/v1/messages',
    apiKey,
    model: 'claude-3-sonnet-20240229',
    requestTransform: (prompt, options) => ({
      model: options?.model || 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || 1024
    }),
    responseTransform: (response) => ({
      text: response.content?.[0]?.text || '',
      usage: {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      finishReason: response.stop_reason,
      model: response.model
    }),
    ...options
  })
}