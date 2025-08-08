import type { ModelConfig, ModelOptionsWithProvider } from '../types'

export const LOW_MODEL_CONFIG: ModelOptionsWithProvider = {
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxTokens: 20000,
  temperature: 0.7,
  topP: 0,
  topK: 0,
  provider: 'lmstudio',
  model: 'gpt-oss:20b'
  // model: 'gemma3:1b'
}

export const MEDIUM_MODEL_CONFIG: ModelOptionsWithProvider = {
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxTokens: 25000,
  temperature: 0.7,
  topP: 0,
  topK: 0,
  provider: 'openrouter',
  model: 'google/gemini-2.5-flash'
}

export const HIGH_MODEL_CONFIG: ModelOptionsWithProvider = {
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxTokens: 200000,
  temperature: 0.7,
  topP: 0,
  topK: 0,
  provider: 'openrouter',
  model: 'google/gemini-2.5-pro'
}

export const PLANNING_MODEL_CONFIG: ModelOptionsWithProvider = {
  ...HIGH_MODEL_CONFIG,
  model: 'google/gemini-2.5-flash'
}

export const modelsConfig: ModelConfig = {
  low: LOW_MODEL_CONFIG,
  medium: MEDIUM_MODEL_CONFIG,
  high: HIGH_MODEL_CONFIG,
  planning: PLANNING_MODEL_CONFIG
}
