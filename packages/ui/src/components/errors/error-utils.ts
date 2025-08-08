import type { AIErrorType } from './ai-error-display'

interface ParsedError {
  type: AIErrorType
  message: string
  details?: string
  provider?: string
  retryable?: boolean
}

export function parseAIError(error: any, provider?: string): ParsedError {
  // Handle string errors
  if (typeof error === 'string') {
    return parseErrorMessage(error, provider)
  }

  // Handle error objects
  const errorMessage = error?.message || error?.error?.message || 'An unexpected error occurred'
  const errorCode = error?.code || error?.error?.code
  const details = error?.details || error?.error?.details || error?.stack

  // Check for specific error patterns
  if (errorMessage.includes('API key') || errorMessage.includes('api key') || errorCode === 'MISSING_API_KEY') {
    return {
      type: 'MISSING_API_KEY',
      message: 'Please configure your API key in settings',
      provider,
      retryable: false
    }
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('Rate limit') || errorCode === 429) {
    return {
      type: 'RATE_LIMIT',
      message: 'You have exceeded the rate limit. Please wait a moment before trying again.',
      provider,
      retryable: true
    }
  }

  if (
    errorMessage.includes('context length') ||
    errorMessage.includes('Context length') ||
    errorMessage.includes('maximum context') ||
    errorMessage.includes('tokens')
  ) {
    const tokenMatch = errorMessage.match(/(\d+)\s*tokens/)
    const contextMatch = errorMessage.match(/maximum.*?(\d+)/)

    return {
      type: 'CONTEXT_LENGTH_EXCEEDED',
      message: `The message is too long. ${tokenMatch ? `You requested ${tokenMatch[1]} tokens` : ''} ${contextMatch ? `but the maximum is ${contextMatch[1]}` : ''}. Please reduce the length of your message.`,
      details: errorMessage,
      provider,
      retryable: false
    }
  }

  if (errorMessage.includes('model') || errorMessage.includes('Model')) {
    return {
      type: 'INVALID_MODEL',
      message: 'The selected model is not available or invalid',
      details: errorMessage,
      provider,
      retryable: false
    }
  }

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('Network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('ECONNREFUSED')
  ) {
    return {
      type: 'NETWORK_ERROR',
      message: 'Network error occurred. Please check your connection and try again.',
      provider,
      retryable: true
    }
  }

  // Provider-specific error handling
  if (provider) {
    return {
      type: 'PROVIDER_ERROR',
      message: `Error from ${provider}: ${errorMessage}`,
      details,
      provider,
      retryable: true
    }
  }

  // Default unknown error
  return {
    type: 'UNKNOWN',
    message: errorMessage,
    details,
    provider,
    retryable: true
  }
}

function parseErrorMessage(message: string, provider?: string): ParsedError {
  // Similar parsing logic for string messages
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('api key')) {
    return {
      type: 'MISSING_API_KEY',
      message: 'Please configure your API key in settings',
      provider,
      retryable: false
    }
  }

  if (lowerMessage.includes('rate limit')) {
    return {
      type: 'RATE_LIMIT',
      message: 'Rate limit exceeded. Please wait before trying again.',
      provider,
      retryable: true
    }
  }

  if (lowerMessage.includes('context') || lowerMessage.includes('token')) {
    return {
      type: 'CONTEXT_LENGTH_EXCEEDED',
      message: 'Message is too long. Please reduce the length.',
      provider,
      retryable: false
    }
  }

  return {
    type: 'UNKNOWN',
    message,
    provider,
    retryable: true
  }
}

// Extract provider name from error or URL
export function extractProviderName(error: any): string | undefined {
  if (error?.provider) return error.provider

  const url = error?.url || error?.error?.url
  if (!url) return undefined

  if (url.includes('openai')) return 'OpenAI'
  if (url.includes('anthropic')) return 'Anthropic'
  if (url.includes('openrouter')) return 'OpenRouter'
  if (url.includes('groq')) return 'Groq'
  if (url.includes('google')) return 'Google'

  return undefined
}
