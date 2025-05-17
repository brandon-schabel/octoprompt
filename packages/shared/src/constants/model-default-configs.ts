import type { ModelOptions } from '../schemas/chat.schemas'
import type { APIProviders } from '../schemas/provider-key.schemas'

export type ModelOptionsWithProvider = ModelOptions & {
  provider: APIProviders
}

export const LOW_MODEL_CONFIG: ModelOptionsWithProvider = {
  frequencyPenalty: 0,
  presencePenalty: 0,
  // max output tokens
  maxTokens: 10000,
  temperature: 0.7,
  topP: 0,
  topK: 0,
  provider: 'openrouter',
  model: 'google/gemini-2.5-flash-preview'
  // model: "qwen/qwen3-235b-a22b",
}

export const MEDIUM_MODEL_CONFIG: ModelOptionsWithProvider = {
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxTokens: 25000,
  temperature: 0.7,
  topP: 0,
  topK: 0,
  provider: 'openrouter',
  model: 'google/gemini-2.5-flash-preview'
}

export const HIGH_MODEL_CONFIG: ModelOptionsWithProvider = {
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxTokens: 50000,
  temperature: 0.7,
  topP: 0,
  topK: 0,
  provider: 'openrouter',
  model: 'google/gemini-2.5-flash-preview'
}

export const PLANNING_MODEL_CONFIG: ModelOptionsWithProvider = {
  ...HIGH_MODEL_CONFIG,
  model: 'anthropic/claude-3.7-sonnet'
}
