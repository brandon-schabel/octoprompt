// Legacy test configuration (for backward compatibility)
export const TEST_API_URL = 'http://localhost:3147'

// Test database configuration
export const TEST_DB_PATH = process.env.TEST_DB_PATH || '/tmp/promptliano-test.db'

// Test encryption key
export const TEST_ENCRYPTION_KEY = process.env.PROMPTLIANO_ENCRYPTION_KEY || 'test-key-for-automated-tests-only-not-secure'

// Test server configuration
export const TEST_SERVER_CONFIG = {
  baseUrl: TEST_API_URL,
  timeout: 30000,
  retries: 3
}

// Enhanced test configuration
export interface EnhancedTestConfig {
  /** Server configuration */
  server: {
    /** Whether to use isolated test server (recommended) */
    useIsolated: boolean
    /** External server URL (when not using isolated) */
    externalUrl: string
    /** Port configuration for isolated server */
    port: {
      /** Use dynamic port assignment (0 = OS assigns) */
      dynamic: boolean
      /** Fixed port (when not using dynamic) */
      fixed: number
    }
  }
  /** Database configuration */
  database: {
    /** Use in-memory database for faster tests */
    useMemory: boolean
    /** Database file path */
    path: string
    /** Reset database between test suites */
    resetBetweenSuites: boolean
  }
  /** AI service configuration */
  ai: {
    /** LMStudio configuration */
    lmstudio: {
      /** Enable LMStudio tests */
      enabled: boolean
      /** LMStudio server URL */
      baseUrl: string
      /** Target model name */
      model: string
      /** Request timeout for AI operations */
      timeout: number
      /** Skip tests if server unavailable */
      skipWhenUnavailable: boolean
    }
    /** Mock configuration */
    mocks: {
      /** Use mocks when AI services unavailable */
      enabled: boolean
      /** Mock response delay (ms) */
      delay: number
    }
  }
  /** Test execution settings */
  execution: {
    /** API request timeout */
    apiTimeout: number
    /** Enable rate limiting during tests */
    enableRateLimit: boolean
    /** Parallel test execution */
    parallel: boolean
    /** Log level during tests */
    logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug'
    /** Retry configuration */
    retries: {
      /** Max retry attempts */
      max: number
      /** Retry delay (ms) */
      delay: number
      /** Exponential backoff */
      backoff: boolean
    }
  }
  /** Environment detection */
  environment: {
    /** Force CI mode */
    forceCI: boolean
    /** Force local mode */
    forceLocal: boolean
    /** Enable debug mode */
    debug: boolean
  }
}

/**
 * Gets enhanced test configuration based on environment
 */
export function getEnhancedTestConfig(): EnhancedTestConfig {
  const isCI = !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.BUILDKITE ||
    process.env.JENKINS_URL
  )

  const isLocal = !isCI && !process.env.FORCE_CI_MODE
  const enableLMStudio = isLocal && process.env.SKIP_AI_TESTS !== 'true'

  return {
    server: {
      useIsolated: process.env.TEST_USE_EXTERNAL_SERVER !== 'true',
      externalUrl: process.env.TEST_API_URL || TEST_API_URL,
      port: {
        dynamic: process.env.TEST_FIXED_PORT !== 'true',
        fixed: parseInt(process.env.TEST_PORT || '3147', 10)
      }
    },
    database: {
      useMemory: isCI || process.env.TEST_USE_MEMORY_DB === 'true',
      path: process.env.TEST_DB_PATH || (isCI ? ':memory:' : '/tmp/promptliano-test.db'),
      resetBetweenSuites: process.env.TEST_KEEP_DB !== 'true'
    },
    ai: {
      lmstudio: {
        enabled: enableLMStudio,
        baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://192.168.1.38:1234',
        model: process.env.LMSTUDIO_MODEL || 'openai/gpt-oss-20b',
        timeout: parseInt(process.env.AI_TEST_TIMEOUT || '30000', 10),
        skipWhenUnavailable: process.env.AI_FAIL_WHEN_UNAVAILABLE !== 'true'
      },
      mocks: {
        enabled: process.env.AI_USE_MOCKS !== 'false',
        delay: parseInt(process.env.AI_MOCK_DELAY || '100', 10)
      }
    },
    execution: {
      apiTimeout: parseInt(process.env.TEST_API_TIMEOUT || (isCI ? '15000' : '30000'), 10),
      enableRateLimit: process.env.TEST_ENABLE_RATE_LIMIT === 'true',
      parallel: process.env.TEST_PARALLEL !== 'false' && !isCI,
      logLevel: (process.env.TEST_LOG_LEVEL as any) || (isCI ? 'error' : 'warn'),
      retries: {
        max: parseInt(process.env.TEST_RETRIES || '3', 10),
        delay: parseInt(process.env.TEST_RETRY_DELAY || '1000', 10),
        backoff: process.env.TEST_RETRY_BACKOFF !== 'false'
      }
    },
    environment: {
      forceCI: process.env.FORCE_CI_MODE === 'true',
      forceLocal: process.env.FORCE_LOCAL_MODE === 'true',
      debug: process.env.TEST_DEBUG === 'true'
    }
  }
}

/**
 * Environment variable documentation for test configuration
 */
export const TEST_ENV_VARS = {
  // Server configuration
  TEST_USE_EXTERNAL_SERVER: 'Set to "true" to use external server instead of isolated test server',
  TEST_API_URL: 'External server URL (default: http://localhost:3147)',
  TEST_FIXED_PORT: 'Set to "true" to use fixed port instead of dynamic assignment',
  TEST_PORT: 'Fixed port number for test server (default: 3147)',

  // Database configuration
  TEST_USE_MEMORY_DB: 'Set to "true" to force in-memory database',
  TEST_DB_PATH: 'Custom database file path',
  TEST_KEEP_DB: 'Set to "true" to preserve database between test suites',

  // AI configuration
  SKIP_AI_TESTS: 'Set to "true" to skip all AI endpoint tests',
  LMSTUDIO_BASE_URL: 'LMStudio server URL (default: http://192.168.1.38:1234)',
  LMSTUDIO_MODEL: 'Target model name (default: openai/gpt-oss-20b)',
  AI_TEST_TIMEOUT: 'Timeout for AI operations in ms (default: 30000)',
  AI_FAIL_WHEN_UNAVAILABLE: 'Set to "true" to fail tests when AI services unavailable',
  AI_USE_MOCKS: 'Set to "false" to disable mock responses',
  AI_MOCK_DELAY: 'Mock response delay in ms (default: 100)',

  // Execution configuration
  TEST_API_TIMEOUT: 'API request timeout in ms (default: 30000 local, 15000 CI)',
  TEST_ENABLE_RATE_LIMIT: 'Set to "true" to enable rate limiting during tests',
  TEST_PARALLEL: 'Set to "false" to disable parallel test execution',
  TEST_LOG_LEVEL: 'Log level: silent, error, warn, info, debug (default: warn)',
  TEST_RETRIES: 'Max retry attempts (default: 3)',
  TEST_RETRY_DELAY: 'Retry delay in ms (default: 1000)',
  TEST_RETRY_BACKOFF: 'Set to "false" to disable exponential backoff',

  // Environment control
  FORCE_CI_MODE: 'Set to "true" to force CI configuration',
  FORCE_LOCAL_MODE: 'Set to "true" to force local configuration',
  TEST_DEBUG: 'Set to "true" to enable debug output',

  // Legacy
  PROMPTLIANO_ENCRYPTION_KEY: 'Encryption key for provider keys (auto-generated if not set)'
} as const

/**
 * Prints current test configuration
 */
export function printTestConfig(config?: EnhancedTestConfig): void {
  const testConfig = config || getEnhancedTestConfig()
  
  console.log('🧪 Test Configuration:')
  console.log('  Server:')
  console.log(`    Isolated: ${testConfig.server.useIsolated}`)
  console.log(`    Port: ${testConfig.server.port.dynamic ? 'Dynamic' : testConfig.server.port.fixed}`)
  console.log('  Database:')
  console.log(`    Type: ${testConfig.database.useMemory ? 'Memory' : 'File'}`)
  console.log(`    Path: ${testConfig.database.path}`)
  console.log('  AI Services:')
  console.log(`    LMStudio: ${testConfig.ai.lmstudio.enabled ? 'Enabled' : 'Disabled'}`)
  if (testConfig.ai.lmstudio.enabled) {
    console.log(`      URL: ${testConfig.ai.lmstudio.baseUrl}`)
    console.log(`      Model: ${testConfig.ai.lmstudio.model}`)
  }
  console.log(`    Mocks: ${testConfig.ai.mocks.enabled ? 'Enabled' : 'Disabled'}`)
  console.log('  Execution:')
  console.log(`    Timeout: ${testConfig.execution.apiTimeout}ms`)
  console.log(`    Rate Limit: ${testConfig.execution.enableRateLimit}`)
  console.log(`    Log Level: ${testConfig.execution.logLevel}`)
}
