import type { TestServerInstance } from './test-server'
import { createTestServer } from './test-server'

export interface TestEnvironmentConfig {
  /** Whether to use an isolated test server (recommended) */
  useIsolatedServer?: boolean
  /** Base URL for external server (when not using isolated server) */
  externalServerUrl?: string
  /** Test database configuration */
  database?: {
    /** Use in-memory database for faster tests */
    useMemory?: boolean
    /** Custom database path */
    path?: string
  }
  /** AI service configuration */
  ai?: {
    /** LMStudio configuration */
    lmstudio?: {
      enabled?: boolean
      baseUrl?: string
      model?: string
      timeout?: number
    }
    /** Whether to use mock responses when AI services unavailable */
    useMockWhenUnavailable?: boolean
  }
  /** Test execution configuration */
  execution?: {
    /** Timeout for API requests in tests */
    apiTimeout?: number
    /** Whether to enable rate limiting during tests */
    enableRateLimit?: boolean
    /** Log level for test execution */
    logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug'
  }
  /** Performance monitoring configuration */
  monitoring?: {
    /** Enable memory usage tracking */
    enableMemoryTracking?: boolean
    /** Enable CPU usage tracking */
    enableCpuTracking?: boolean
    /** Enable garbage collection tracking */
    enableGcTracking?: boolean
    /** Sample interval for monitoring metrics (ms) */
    sampleIntervalMs?: number
    /** Enable performance timeline recording */
    enableTimelineRecording?: boolean
    /** Maximum number of performance samples to store */
    maxSamples?: number
  }
}

export interface TestEnvironment {
  /** The test server instance (if using isolated server) */
  server?: TestServerInstance
  /** Base URL for API requests */
  baseUrl: string
  /** Test configuration */
  config: Required<TestEnvironmentConfig>
  /** Environment detection */
  isCI: boolean
  isLocal: boolean
  /** Cleanup function */
  cleanup: () => Promise<void>
}

/**
 * Detects the current environment
 */
export function detectEnvironment(): { isCI: boolean; isLocal: boolean } {
  const isCI = !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.BUILDKITE ||
    process.env.JENKINS_URL
  )
  
  return {
    isCI,
    isLocal: !isCI
  }
}

/**
 * Gets default configuration based on environment
 */
export function getDefaultTestConfig(): TestEnvironmentConfig {
  const { isCI, isLocal } = detectEnvironment()
  
  // Base configuration
  const config: TestEnvironmentConfig = {
    useIsolatedServer: true,
    database: {
      useMemory: isCI, // Use memory DB in CI for speed
      path: isLocal ? '/tmp/promptliano-test.db' : ':memory:'
    },
    ai: {
      lmstudio: {
        enabled: isLocal, // Only enable in local development
        baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://192.168.1.38:1234',
        model: 'openai/gpt-oss-20b',
        timeout: 30000
      },
      useMockWhenUnavailable: true
    },
    execution: {
      apiTimeout: isCI ? 15000 : 30000, // Shorter timeout in CI
      enableRateLimit: false, // Disable rate limiting in tests
      logLevel: isCI ? 'error' : 'warn'
    },
    monitoring: {
      enableMemoryTracking: false, // Disabled by default for regular tests
      enableCpuTracking: false,
      enableGcTracking: false,
      sampleIntervalMs: 1000,
      enableTimelineRecording: false,
      maxSamples: 1000
    }
  }
  
  return config
}

/**
 * Creates a test environment with proper configuration
 */
export async function createTestEnvironment(userConfig?: TestEnvironmentConfig): Promise<TestEnvironment> {
  const { isCI, isLocal } = detectEnvironment()
  const defaultConfig = getDefaultTestConfig()
  
  // Merge configurations with proper defaults
  const config: Required<TestEnvironmentConfig> = {
    useIsolatedServer: userConfig?.useIsolatedServer ?? defaultConfig.useIsolatedServer!,
    externalServerUrl: userConfig?.externalServerUrl ?? 'http://localhost:3147',
    database: {
      useMemory: userConfig?.database?.useMemory ?? defaultConfig.database!.useMemory!,
      path: userConfig?.database?.path ?? defaultConfig.database!.path!
    },
    ai: {
      lmstudio: {
        enabled: userConfig?.ai?.lmstudio?.enabled ?? defaultConfig.ai!.lmstudio!.enabled!,
        baseUrl: userConfig?.ai?.lmstudio?.baseUrl ?? defaultConfig.ai!.lmstudio!.baseUrl!,
        model: userConfig?.ai?.lmstudio?.model ?? defaultConfig.ai!.lmstudio!.model!,
        timeout: userConfig?.ai?.lmstudio?.timeout ?? defaultConfig.ai!.lmstudio!.timeout!
      },
      useMockWhenUnavailable: userConfig?.ai?.useMockWhenUnavailable ?? defaultConfig.ai!.useMockWhenUnavailable!
    },
    execution: {
      apiTimeout: userConfig?.execution?.apiTimeout ?? defaultConfig.execution!.apiTimeout!,
      enableRateLimit: userConfig?.execution?.enableRateLimit ?? defaultConfig.execution!.enableRateLimit!,
      logLevel: userConfig?.execution?.logLevel ?? defaultConfig.execution!.logLevel!
    },
    monitoring: {
      enableMemoryTracking: userConfig?.monitoring?.enableMemoryTracking ?? defaultConfig.monitoring!.enableMemoryTracking!,
      enableCpuTracking: userConfig?.monitoring?.enableCpuTracking ?? defaultConfig.monitoring!.enableCpuTracking!,
      enableGcTracking: userConfig?.monitoring?.enableGcTracking ?? defaultConfig.monitoring!.enableGcTracking!,
      sampleIntervalMs: userConfig?.monitoring?.sampleIntervalMs ?? defaultConfig.monitoring!.sampleIntervalMs!,
      enableTimelineRecording: userConfig?.monitoring?.enableTimelineRecording ?? defaultConfig.monitoring!.enableTimelineRecording!,
      maxSamples: userConfig?.monitoring?.maxSamples ?? defaultConfig.monitoring!.maxSamples!
    }
  }
  
  let server: TestServerInstance | undefined
  let baseUrl: string
  let cleanup: () => Promise<void>
  
  if (config.useIsolatedServer) {
    // Create isolated test server
    server = await createTestServer({
      databasePath: config.database.useMemory ? ':memory:' : config.database.path,
      enableRateLimit: config.execution.enableRateLimit,
      logLevel: config.execution.logLevel
    })
    baseUrl = server.baseUrl
    cleanup = server.cleanup
  } else {
    // Use external server
    baseUrl = config.externalServerUrl
    cleanup = async () => {
      // No cleanup needed for external server
    }
  }
  
  return {
    server,
    baseUrl,
    config,
    isCI,
    isLocal,
    cleanup
  }
}

/**
 * Checks if LMStudio is available for AI testing
 */
export async function checkLMStudioAvailability(config: TestEnvironmentConfig['ai']['lmstudio']): Promise<{
  available: boolean
  models: string[]
  message: string
}> {
  if (!config?.enabled || !config.baseUrl) {
    return {
      available: false,
      models: [],
      message: 'LMStudio testing is disabled'
    }
  }
  
  try {
    const baseUrl = config.baseUrl.replace(/\/v1$/, '')
    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(config.timeout || 10000)
    })
    
    if (!response.ok) {
      return {
        available: false,
        models: [],
        message: `LMStudio server returned ${response.status}: ${response.statusText}`
      }
    }
    
    const data = await response.json()
    const models = (data.data || []).map((m: any) => m.id)
    
    if (models.length === 0) {
      return {
        available: false,
        models: [],
        message: 'No models loaded in LMStudio'
      }
    }
    
    // Check if target model is available
    const hasTargetModel = models.some((m: string) => 
      m === config.model || m.includes('gpt-oss')
    )
    
    if (!hasTargetModel) {
      return {
        available: false,
        models,
        message: `Target model "${config.model}" not found. Available models: ${models.join(', ')}`
      }
    }
    
    return {
      available: true,
      models,
      message: `LMStudio available with ${models.length} models`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      available: false,
      models: [],
      message: `Failed to connect to LMStudio: ${errorMessage}`
    }
  }
}

/**
 * Sets up AI service environment variables for testing
 */
export function setupAITestEnvironment(config: TestEnvironmentConfig['ai']): void {
  if (config?.lmstudio?.enabled) {
    process.env.LMSTUDIO_BASE_URL = config.lmstudio.baseUrl
    process.env.PROMPTLIANO_LMSTUDIO_URL = config.lmstudio.baseUrl
    process.env.LMSTUDIO_MODEL = config.lmstudio.model
  }
  
  // Set test-specific AI configuration
  process.env.AI_TEST_MODE = 'true'
  process.env.AI_MOCK_WHEN_UNAVAILABLE = config?.useMockWhenUnavailable ? 'true' : 'false'
}

/**
 * Utility function for running tests with a configured environment
 */
export async function withTestEnvironment<T>(
  testFn: (env: TestEnvironment) => Promise<T>,
  config?: TestEnvironmentConfig
): Promise<T> {
  const env = await createTestEnvironment(config)
  
  try {
    // Setup AI environment
    setupAITestEnvironment(env.config.ai)
    
    return await testFn(env)
  } finally {
    await env.cleanup()
  }
}

/**
 * Prints environment information for debugging
 */
export function printTestEnvironmentInfo(env: TestEnvironment): void {
  const { config, isCI, isLocal, baseUrl } = env
  
  console.log('🧪 Test Environment Configuration:')
  console.log(`  Environment: ${isCI ? 'CI' : 'Local'}`)
  console.log(`  Base URL: ${baseUrl}`)
  console.log(`  Isolated Server: ${config.useIsolatedServer}`)
  console.log(`  Database: ${config.database.useMemory ? 'Memory' : config.database.path}`)
  console.log(`  LMStudio: ${config.ai.lmstudio.enabled ? 'Enabled' : 'Disabled'}`)
  if (config.ai.lmstudio.enabled) {
    console.log(`    URL: ${config.ai.lmstudio.baseUrl}`)
    console.log(`    Model: ${config.ai.lmstudio.model}`)
  }
  console.log(`  Rate Limiting: ${config.execution.enableRateLimit}`)
  console.log(`  Log Level: ${config.execution.logLevel}`)
  console.log(`  Performance Monitoring:`)
  console.log(`    Memory Tracking: ${config.monitoring.enableMemoryTracking}`)
  console.log(`    CPU Tracking: ${config.monitoring.enableCpuTracking}`)
  console.log(`    GC Tracking: ${config.monitoring.enableGcTracking}`)
  console.log(`    Sample Interval: ${config.monitoring.sampleIntervalMs}ms`)
}