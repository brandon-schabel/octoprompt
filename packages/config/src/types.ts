// Define types locally to avoid circular dependency with @octoprompt/schemas

export type APIProviders =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'openrouter'
  | 'xai'
  | 'together'
  | 'lmstudio'
  | 'ollama'

export interface ModelOptions {
  frequencyPenalty?: number
  presencePenalty?: number
  maxTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  model: string
}

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
  ollama: {
    baseURL: string
  }
  lmstudio: {
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

export interface CorsConfig {
  origin: string | string[]
  allowMethods: string[]
  credentials: boolean
  allowHeaders: string[]
}

export interface RateLimitConfig {
  enabled: boolean
  windowMs: number
  maxRequests: number
  aiWindowMs: number
  aiMaxRequests: number
}

export interface ServerConfig {
  corsOrigin: string
  corsConfig: CorsConfig
  serverHost: string
  serverPort: string | number
  devPort: number
  prodPort: number
  clientPort: number
  clientUrl: string
  apiUrl: string
  isDevEnv: boolean
  isTestEnv: boolean
  isProdEnv: boolean
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
  rateLimit: RateLimitConfig
}
