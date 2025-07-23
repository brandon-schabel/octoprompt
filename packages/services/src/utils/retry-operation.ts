import { ApiError } from '@octoprompt/shared'

export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  shouldRetry?: (error: any, attempt: number) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // Retry on network errors, rate limits, and temporary failures
    if (error instanceof ApiError) {
      return error.code === 'RATE_LIMIT_EXCEEDED' || 
             error.code === 'PROVIDER_UNAVAILABLE' ||
             error.status >= 500
    }
    // Retry on common network errors
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           error.code === 'ENOTFOUND'
  }
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any
  let delay = opts.initialDelay

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      // Check if we should retry
      if (attempt >= opts.maxAttempts || !opts.shouldRetry(error, attempt)) {
        throw error
      }

      // Log retry attempt
      console.warn(
        `[RetryOperation] Attempt ${attempt}/${opts.maxAttempts} failed:`,
        error instanceof Error ? error.message : String(error),
        `Retrying in ${delay}ms...`
      )

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError
}