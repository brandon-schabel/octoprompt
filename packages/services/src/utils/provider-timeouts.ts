import type { APIProviders } from '@promptliano/schemas'

/**
 * Provider-specific timeout configurations
 * Different providers have different response times and reliability
 */

export interface TimeoutConfig {
  default: number
  validation: number
  chat: number
  structured: number
}

// Timeout configurations per provider (in milliseconds)
export const PROVIDER_TIMEOUTS: Record<APIProviders, TimeoutConfig> = {
  // Fast cloud providers
  openai: {
    default: 30000,    // 30 seconds
    validation: 5000,  // 5 seconds for validation
    chat: 60000,       // 60 seconds for chat
    structured: 45000  // 45 seconds for structured generation
  },
  anthropic: {
    default: 30000,
    validation: 5000,
    chat: 60000,
    structured: 45000
  },
  
  // Medium speed providers
  google_gemini: {
    default: 35000,
    validation: 7000,
    chat: 60000,
    structured: 50000
  },
  groq: {
    default: 25000,
    validation: 5000,
    chat: 45000,
    structured: 40000
  },
  xai: {
    default: 30000,
    validation: 6000,
    chat: 60000,
    structured: 45000
  },
  together: {
    default: 35000,
    validation: 7000,
    chat: 60000,
    structured: 50000
  },
  
  // Router/proxy providers (may have additional latency)
  openrouter: {
    default: 40000,
    validation: 8000,
    chat: 90000,
    structured: 60000
  },
  
  // Local providers (can be slower, especially first run)
  ollama: {
    default: 60000,     // 60 seconds
    validation: 15000,  // 15 seconds for validation
    chat: 120000,       // 2 minutes for chat
    structured: 90000   // 90 seconds for structured
  },
  lmstudio: {
    default: 60000,
    validation: 15000,
    chat: 120000,
    structured: 90000
  },
  
  // Custom providers (conservative timeouts)
  custom: {
    default: 45000,
    validation: 10000,
    chat: 90000,
    structured: 60000
  }
}

/**
 * Get timeout for a specific provider and operation
 */
export function getProviderTimeout(
  provider: APIProviders,
  operation: keyof TimeoutConfig = 'default'
): number {
  const config = PROVIDER_TIMEOUTS[provider]
  if (!config) {
    // Fallback to custom provider timeouts if unknown
    return PROVIDER_TIMEOUTS.custom[operation]
  }
  return config[operation]
}

/**
 * Create an AbortSignal with provider-specific timeout
 */
export function createProviderTimeout(
  provider: APIProviders,
  operation: keyof TimeoutConfig = 'default'
): AbortSignal {
  const timeout = getProviderTimeout(provider, operation)
  return AbortSignal.timeout(timeout)
}

/**
 * Timeout configurations for batch operations
 */
export const BATCH_TIMEOUTS = {
  // Maximum time for testing all providers
  allProviders: 120000, // 2 minutes
  
  // Maximum time per provider in batch
  perProvider: 15000, // 15 seconds
  
  // Maximum concurrent tests
  maxConcurrent: 5
}

/**
 * Retry configuration per provider
 */
export const PROVIDER_RETRY_CONFIG: Record<APIProviders, { maxRetries: number; backoffMs: number }> = {
  openai: { maxRetries: 3, backoffMs: 1000 },
  anthropic: { maxRetries: 3, backoffMs: 1000 },
  google_gemini: { maxRetries: 2, backoffMs: 1500 },
  groq: { maxRetries: 3, backoffMs: 500 },
  xai: { maxRetries: 2, backoffMs: 1000 },
  together: { maxRetries: 2, backoffMs: 1500 },
  openrouter: { maxRetries: 2, backoffMs: 2000 },
  ollama: { maxRetries: 1, backoffMs: 2000 },
  lmstudio: { maxRetries: 1, backoffMs: 2000 },
  custom: { maxRetries: 2, backoffMs: 1500 }
}

/**
 * Get retry configuration for a provider
 */
export function getProviderRetryConfig(provider: APIProviders) {
  return PROVIDER_RETRY_CONFIG[provider] || PROVIDER_RETRY_CONFIG.custom
}