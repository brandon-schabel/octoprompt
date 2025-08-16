// Define types locally to avoid circular dependency with @promptliano/schemas

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
  | 'custom'

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
  custom?: {
    baseURL?: string
    headers?: Record<string, string>
  }
}

export interface FilesConfig {
  allowedExtensions: string[]
  defaultExclusions: string[]
  maxFileSizeForSummary: number
  maxTokensForSummary: number
  charsPerTokenEstimate: number
  optimalTokensForBatch?: number
  promptOverheadTokens?: number
  responseBufferTokens?: number
  maxFilesPerBatch?: number
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
  // Core server settings
  host: string
  port: number
  basePath: string
  staticPath: string
  idleTimeout: number
  
  // CORS configuration
  corsOrigin: string
  corsConfig: CorsConfig
  
  // Environment-specific
  environment: 'development' | 'test' | 'production'
  isDevEnv: boolean
  isTestEnv: boolean
  isProdEnv: boolean
  
  // Legacy compatibility (will be removed in future)
  serverHost: string
  serverPort: string | number
  devPort: number
  prodPort: number
  clientPort: number
  clientUrl: string
  apiUrl: string
}

export interface DatabaseConfig {
  // Database file configuration
  path: string
  dataDir: string
  
  // Backup configuration
  backupEnabled: boolean
  backupInterval: number // milliseconds
  maxBackups: number
  
  // Performance settings
  walMode: boolean
  cacheSize: number // MB
  tempStore: 'memory' | 'file'
  mmapSize: number // bytes
  
  // Platform-specific paths
  platformDefaults: {
    darwin: string // macOS
    win32: string // Windows
    linux: string // Linux
    fallback: string // Other
  }
}

export interface RuntimeConfig {
  // Logging
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace'
  debugMode: boolean
  
  // Performance
  maxRequestSize: string // e.g., '50mb'
  timeout: number // milliseconds
  compression: boolean
  
  // Feature flags
  features: {
    mcp: boolean
    websocket: boolean
    jobQueue: boolean
    aiSummarization: boolean
  }
}

export interface AppConfig {
  name: string
  version: string
  description: string
}

export interface GlobalConfig {
  app: AppConfig
  server: ServerConfig
  database: DatabaseConfig
  runtime: RuntimeConfig
  models: ModelConfig
  providers: ProviderConfig
  files: FilesConfig
  rateLimit: RateLimitConfig
}
