import type { RateLimitConfig } from '../types'

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'

// Safe environment variable access
const getEnvVar = (key: string, defaultValue?: string): string | undefined => {
  if (isBrowser) {
    return defaultValue
  }
  return process?.env?.[key] || defaultValue
}

// Environment detection (same as server.config.ts)
const nodeEnv = getEnvVar('NODE_ENV', 'development')
const isDevEnv = nodeEnv === 'development' || nodeEnv === undefined

// Default rate limit values
const DEFAULT_WINDOW_MS = 900000 // 15 minutes
const DEFAULT_MAX_REQUESTS = 500
const DEFAULT_AI_WINDOW_MS = 600000 // 10 minutes
const DEFAULT_AI_MAX_REQUESTS = 100

export const rateLimitConfig: RateLimitConfig = {
  // Rate limiting is disabled in development by default
  enabled: getEnvVar('RATE_LIMIT_ENABLED', 'true') === 'true' && !isDevEnv,

  // General rate limit settings
  windowMs: parseInt(getEnvVar('RATE_LIMIT_WINDOW_MS', String(DEFAULT_WINDOW_MS)) || String(DEFAULT_WINDOW_MS), 10),
  maxRequests: parseInt(
    getEnvVar('RATE_LIMIT_MAX_REQUESTS', String(DEFAULT_MAX_REQUESTS)) || String(DEFAULT_MAX_REQUESTS),
    10
  ),

  // AI-specific rate limit settings
  aiWindowMs: parseInt(
    getEnvVar('AI_RATE_LIMIT_WINDOW_MS', String(DEFAULT_AI_WINDOW_MS)) || String(DEFAULT_AI_WINDOW_MS),
    10
  ),
  aiMaxRequests: parseInt(
    getEnvVar('AI_RATE_LIMIT_MAX_REQUESTS', String(DEFAULT_AI_MAX_REQUESTS)) || String(DEFAULT_AI_MAX_REQUESTS),
    10
  )
}
