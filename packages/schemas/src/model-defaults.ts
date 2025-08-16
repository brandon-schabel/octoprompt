// Model defaults for schema examples and fallbacks
// These values are duplicated from config package to avoid backend dependencies in schemas

export const DEFAULT_MODEL_EXAMPLES = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4000,
  topP: 1,
  topK: 40,
  frequencyPenalty: 0.2,
  presencePenalty: 0.1
} as const