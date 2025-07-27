import { ApiError } from '@promptliano/shared'

interface ProviderErrorDetails {
  code?: string | number
  message: string
  metadata?: any
  retryable?: boolean
}

export function parseProviderError(error: any, provider: string): ProviderErrorDetails {
  // Handle AI SDK errors
  if (error?.name === 'AI_APICallError') {
    const statusCode = error.statusCode
    const responseBody = error.responseBody

    // Try to parse response body
    let parsedBody: any = {}
    try {
      if (typeof responseBody === 'string') {
        parsedBody = JSON.parse(responseBody)
      } else {
        parsedBody = responseBody
      }
    } catch {
      // Keep original if parse fails
    }

    // Extract error details from parsed body
    const errorMessage = parsedBody?.error?.message || parsedBody?.message || error.message
    const errorCode = parsedBody?.error?.code || parsedBody?.code || statusCode
    const metadata = parsedBody?.error?.metadata || parsedBody?.metadata

    return {
      code: errorCode,
      message: errorMessage,
      metadata,
      retryable: statusCode >= 500 || statusCode === 429
    }
  }

  // Generic error parsing
  return {
    code: error?.code || error?.statusCode || 500,
    message: error?.message || 'Unknown error occurred',
    metadata: error?.details || error?.data,
    retryable: false
  }
}

export function mapProviderErrorToApiError(error: any, provider: string, operation: string): ApiError {
  const details = parseProviderError(error, provider)

  // Check for specific error patterns
  if (details.message.includes('API key') || details.message.includes('api key')) {
    return new ApiError(401, `${provider} API key is missing or invalid`, `${provider.toUpperCase()}_KEY_INVALID`, {
      provider,
      originalError: details.message
    })
  }

  if (details.code === 429 || details.message.includes('rate limit')) {
    return new ApiError(
      429,
      `${provider} rate limit exceeded. Please wait before trying again.`,
      'RATE_LIMIT_EXCEEDED',
      {
        provider,
        retryAfter: details.metadata?.retryAfter,
        originalError: details.message
      }
    )
  }

  if (details.message.includes('context length') || details.message.includes('maximum context')) {
    const tokenMatch = details.message.match(/(\d+)\s*tokens/)
    const maxMatch = details.message.match(/maximum.*?(\d+)/)

    return new ApiError(
      400,
      `Context length exceeded for ${provider}. ${tokenMatch ? `Requested: ${tokenMatch[1]} tokens.` : ''} ${maxMatch ? `Maximum: ${maxMatch[1]} tokens.` : ''}`,
      'CONTEXT_LENGTH_EXCEEDED',
      {
        provider,
        requestedTokens: tokenMatch ? parseInt(tokenMatch[1]) : undefined,
        maxTokens: maxMatch ? parseInt(maxMatch[1]) : undefined,
        originalError: details.message
      }
    )
  }

  if (
    details.message.includes('model') &&
    (details.message.includes('not found') || details.message.includes('invalid'))
  ) {
    return new ApiError(400, `Invalid or unavailable model for ${provider}`, 'INVALID_MODEL', {
      provider,
      originalError: details.message
    })
  }

  if (details.code >= 500 || details.retryable) {
    return new ApiError(503, `${provider} service temporarily unavailable. Please try again.`, 'PROVIDER_UNAVAILABLE', {
      provider,
      retryable: true,
      originalError: details.message
    })
  }

  // Default error
  return new ApiError(
    (details.code as number) || 500,
    `${provider} error during ${operation}: ${details.message}`,
    `${provider.toUpperCase()}_${operation.toUpperCase()}_FAILED`,
    {
      provider,
      operation,
      originalError: details.message,
      metadata: details.metadata
    }
  )
}
