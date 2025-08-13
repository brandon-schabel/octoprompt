/**
 * LLM configuration for testing
 */

export interface TestLLMConfig {
  provider: 'lmstudio' | 'mock' | 'openai' | 'anthropic'
  baseUrl: string
  model: string
  apiKey?: string
  timeout: number
  maxRetries: number
  temperature?: number
  maxTokens?: number
}

// LMStudio configuration for local testing
export const LMSTUDIO_CONFIG: TestLLMConfig = {
  provider: 'lmstudio',
  baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://192.168.1.38:1234/v1',
  model: process.env.LMSTUDIO_MODEL || 'gpt-oss:20b',
  timeout: 30000,
  maxRetries: 3,
  temperature: 0.7,
  maxTokens: 2000
}

// Mock provider for deterministic testing
export const MOCK_CONFIG: TestLLMConfig = {
  provider: 'mock',
  baseUrl: 'mock://localhost',
  model: 'mock-model',
  timeout: 100,
  maxRetries: 1,
  temperature: 0,
  maxTokens: 1000
}

// OpenAI configuration (requires API key)
export const OPENAI_CONFIG: TestLLMConfig = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 3,
  temperature: 0.7,
  maxTokens: 2000
}

// Anthropic configuration (requires API key)
export const ANTHROPIC_CONFIG: TestLLMConfig = {
  provider: 'anthropic',
  baseUrl: 'https://api.anthropic.com/v1',
  model: 'claude-3-haiku-20240307',
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60000,
  maxRetries: 3,
  temperature: 0.7,
  maxTokens: 2000
}

// Check if LMStudio is available
export async function isLMStudioAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LMSTUDIO_CONFIG.baseUrl}/models`, {
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      console.log('LMStudio not responding correctly:', response.status)
      return false
    }

    const data = await response.json()
    const models = data.data || []

    // Check if any model is loaded
    if (models.length === 0) {
      console.log('No models loaded in LMStudio')
      return false
    }

    console.log('LMStudio available with models:', models.map((m: any) => m.id).join(', '))
    return true
  } catch (error) {
    console.log('LMStudio not available:', error)
    return false
  }
}

// Check if provider is configured
export function isProviderConfigured(provider: 'openai' | 'anthropic'): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    default:
      return false
  }
}

// Get active test configuration
export async function getTestConfig(): Promise<TestLLMConfig> {
  // Priority order: LMStudio > OpenAI > Anthropic > Mock

  if (await isLMStudioAvailable()) {
    console.log('Using LMStudio for testing')
    return LMSTUDIO_CONFIG
  }

  if (isProviderConfigured('openai')) {
    console.log('Using OpenAI for testing')
    return OPENAI_CONFIG
  }

  if (isProviderConfigured('anthropic')) {
    console.log('Using Anthropic for testing')
    return ANTHROPIC_CONFIG
  }

  console.log('Using mock provider for testing')
  return MOCK_CONFIG
}

// Test timeout configurations
export const TEST_TIMEOUTS = {
  unit: 5000, // 5 seconds for unit tests
  integration: 30000, // 30 seconds for integration tests
  e2e: 60000, // 60 seconds for end-to-end tests
  performance: 120000 // 2 minutes for performance tests
}

// Retry configuration for flaky tests
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2,
  shouldRetry: (error: any) => {
    // Retry on network errors or timeouts
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('timeout') ||
      error.message?.includes('rate limit')
    )
  }
}
