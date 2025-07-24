import type { ProviderConfig } from '../types'

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'

// Safe environment variable access
const getEnvVar = (key: string, defaultValue: string): string => {
  if (isBrowser) {
    return defaultValue
  }
  return process?.env?.[key] || defaultValue
}

export const providersConfig: ProviderConfig = {
  openai: {
    baseURL: 'https://api.openai.com/v1'
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1'
  },
  google: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta'
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1'
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1'
  },
  ollama: {
    baseURL: getEnvVar('OLLAMA_BASE_URL', 'http://localhost:11434')
  },
  lmstudio: {
    baseURL: getEnvVar('LMSTUDIO_BASE_URL', 'http://localhost:1234/v1')
  }
}
