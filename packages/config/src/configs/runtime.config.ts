import type { RuntimeConfig } from '../types'

// Check if we're in a browser environment
const isBrowser = typeof globalThis !== 'undefined' && 'window' in globalThis

// Safe environment variable access
const getEnvVar = (key: string, defaultValue?: string): string | undefined => {
  if (isBrowser) {
    return defaultValue
  }
  return process?.env?.[key] || defaultValue
}

const nodeEnv = getEnvVar('NODE_ENV', 'development')
const isDevEnv = nodeEnv === 'development' || nodeEnv === undefined
const isTestEnv = nodeEnv === 'test'

export const runtimeConfig: RuntimeConfig = {
  // Logging
  logLevel: (getEnvVar('LOG_LEVEL', isDevEnv ? 'debug' : 'info') as RuntimeConfig['logLevel']),
  debugMode: getEnvVar('DEBUG', String(isDevEnv)) === 'true',

  // Performance
  maxRequestSize: getEnvVar('MAX_REQUEST_SIZE', '50mb') || '50mb',
  timeout: Number(getEnvVar('REQUEST_TIMEOUT', '30000')), // 30 seconds default
  compression: getEnvVar('COMPRESSION_ENABLED', 'true') === 'true',

  // Feature flags
  features: {
    mcp: getEnvVar('MCP_ENABLED', 'true') === 'true',
    websocket: getEnvVar('WEBSOCKET_ENABLED', 'true') === 'true',
    jobQueue: getEnvVar('JOB_QUEUE_ENABLED', 'true') === 'true',
    aiSummarization: getEnvVar('AI_SUMMARIZATION_ENABLED', 'true') === 'true'
  }
}