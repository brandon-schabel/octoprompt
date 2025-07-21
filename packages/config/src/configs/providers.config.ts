import type { ProviderConfig } from '../types'

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
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  },
  lmstudio: {
    baseURL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
  }
}