import type { ModelOptions, APIProviders } from '@octoprompt/schemas'

export type ModelOptionsWithProvider = ModelOptions & {
  provider: APIProviders
}

export interface ModelConfig {
  low: ModelOptionsWithProvider
  medium: ModelOptionsWithProvider
  high: ModelOptionsWithProvider
  planning: ModelOptionsWithProvider
}

export interface ProviderConfig {
  openai: {
    baseURL: string
  }
  anthropic: {
    baseURL: string
  }
  google: {
    baseURL: string
  }
  openrouter: {
    baseURL: string
  }
  groq: {
    baseURL: string
  }
}

export interface FilesConfig {
  allowedExtensions: string[]
  defaultExclusions: string[]
  maxFileSizeForSummary: number
  maxTokensForSummary: number
  charsPerTokenEstimate: number
}

export interface ServerConfig {
  corsOrigin: string
  serverHost: string
  serverPort: string | number
  clientUrl: string
  apiUrl: string
}

export interface AppConfig {
  name: string
  version: string
  description: string
}

export interface GlobalConfig {
  app: AppConfig
  server: ServerConfig
  models: ModelConfig
  providers: ProviderConfig
  files: FilesConfig
}