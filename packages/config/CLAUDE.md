# Config Package - Centralized Configuration Management

You are an expert TypeScript developer working on the @promptliano/config package. This package provides centralized configuration management with Zod validation, environment variable handling, and default configurations for the entire Promptliano ecosystem.

## Package Overview

The @promptliano/config package manages:

- AI model configurations and defaults
- Provider settings and API configurations
- Rate limiting and performance settings
- Server and client configurations
- Environment-specific overrides
- Configuration validation with Zod schemas

### Architecture

```
packages/config/
├── src/
│   ├── configs/                 # Configuration modules
│   │   ├── model.config.ts     # AI model configurations
│   │   ├── providers.config.ts # Provider settings
│   │   ├── rate-limit.config.ts # Rate limiting settings
│   │   ├── server.config.ts    # Server configurations
│   │   └── client.config.ts    # Client configurations
│   ├── schemas/                 # Zod validation schemas
│   │   ├── config.schemas.ts   # Configuration schemas
│   │   └── env.schemas.ts      # Environment variable schemas
│   ├── utils/                   # Configuration utilities
│   │   ├── config-loader.ts    # Configuration loading logic
│   │   ├── env-parser.ts       # Environment variable parsing
│   │   └── config-merger.ts    # Configuration merging
│   ├── defaults/                # Default configurations
│   └── index.ts                # Package exports
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze configuration patterns and validation logic
   - Ensure proper schema validation and type safety

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on configuration organization and reusability

3. **Package-Specific Agents**
   - Use `zod-schema-architect` for validation schema design
   - Use `configuration-expert` for configuration patterns
   - Use `environment-expert` for environment variable handling
   - Use `typescript-expert` for advanced type patterns

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about configuration requirements
- Use multiple agents concurrently for maximum efficiency
- Document all configuration options and defaults

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Configuration validation schemas (this package)
2. **Storage layer** - N/A for config
3. **Services** - Uses configurations
4. **MCP tools** - Uses configurations
5. **API routes** - Uses configurations
6. **API client** - Uses configurations
7. **React hooks** - N/A for config
8. **UI components** - N/A for config
9. **Page integration** - N/A for config
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package provides the configuration foundation for all Promptliano packages, ensuring consistent settings, proper validation, and environment-aware configuration management.

## Configuration Schema Patterns

### Base Configuration Schema

Define configurations with Zod:

```typescript
import { z } from 'zod'

// Base model configuration schema
export const ModelConfigSchema = z
  .object({
    provider: z.enum(['openai', 'anthropic', 'google', 'groq', 'ollama', 'lmstudio']),
    model: z.string().min(1),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().default(4096),
    topP: z.number().min(0).max(1).default(1),
    frequencyPenalty: z.number().min(-2).max(2).default(0),
    presencePenalty: z.number().min(-2).max(2).default(0),
    stream: z.boolean().default(true),
    // Provider-specific overrides
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    organization: z.string().optional()
  })
  .strict()

export type ModelConfig = z.infer<typeof ModelConfigSchema>
```

### Hierarchical Configuration

Support configuration inheritance:

```typescript
// Define configuration levels
export const ConfigLevels = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  ULTRA: 'ultra'
} as const

// Model presets for different use cases
export const MODEL_PRESETS = {
  [ConfigLevels.LOW]: {
    provider: 'openai' as const,
    model: 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 2048,
    topP: 0.9
  },
  [ConfigLevels.MEDIUM]: {
    provider: 'openai' as const,
    model: 'gpt-4-turbo',
    temperature: 0.5,
    maxTokens: 4096,
    topP: 0.95
  },
  [ConfigLevels.HIGH]: {
    provider: 'anthropic' as const,
    model: 'claude-3-sonnet-20240229',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1
  },
  [ConfigLevels.ULTRA]: {
    provider: 'anthropic' as const,
    model: 'claude-3-opus-20240229',
    temperature: 0.7,
    maxTokens: 16384,
    topP: 1
  }
} satisfies Record<string, Partial<ModelConfig>>

// Export typed configs
export const LOW_MODEL_CONFIG = ModelConfigSchema.parse(MODEL_PRESETS.low)
export const MEDIUM_MODEL_CONFIG = ModelConfigSchema.parse(MODEL_PRESETS.medium)
export const HIGH_MODEL_CONFIG = ModelConfigSchema.parse(MODEL_PRESETS.high)
export const ULTRA_MODEL_CONFIG = ModelConfigSchema.parse(MODEL_PRESETS.ultra)
```

## Provider Configuration

### Provider Settings

Manage provider-specific configurations:

```typescript
export const ProviderConfigSchema = z.object({
  openai: z
    .object({
      apiKey: z.string().optional(),
      organization: z.string().optional(),
      baseUrl: z.string().url().default('https://api.openai.com/v1')
    })
    .optional(),

  anthropic: z
    .object({
      apiKey: z.string().optional(),
      baseUrl: z.string().url().default('https://api.anthropic.com')
    })
    .optional(),

  google: z
    .object({
      apiKey: z.string().optional(),
      baseUrl: z.string().url().default('https://generativelanguage.googleapis.com')
    })
    .optional(),

  ollama: z
    .object({
      baseUrl: z.string().url().default('http://localhost:11434')
    })
    .optional(),

  lmstudio: z
    .object({
      baseUrl: z.string().url().default('http://localhost:1234')
    })
    .optional()
})

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

// Provider feature support
export const PROVIDER_FEATURES = {
  openai: {
    streaming: true,
    functions: true,
    vision: true,
    embeddings: true,
    jsonMode: true
  },
  anthropic: {
    streaming: true,
    functions: false,
    vision: true,
    embeddings: false,
    jsonMode: false
  },
  ollama: {
    streaming: true,
    functions: false,
    vision: false,
    embeddings: true,
    jsonMode: false
  }
} as const
```

## Rate Limiting Configuration

### Rate Limit Settings

Configure API rate limiting:

```typescript
export const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(true),

  // Global limits
  global: z.object({
    requestsPerMinute: z.number().int().positive().default(60),
    requestsPerHour: z.number().int().positive().default(1000),
    tokensPerMinute: z.number().int().positive().default(90000),
    tokensPerHour: z.number().int().positive().default(1000000)
  }),

  // Per-provider limits
  providers: z
    .record(
      z.string(),
      z.object({
        requestsPerMinute: z.number().int().positive(),
        tokensPerMinute: z.number().int().positive(),
        concurrentRequests: z.number().int().positive().default(5)
      })
    )
    .default({}),

  // Per-user limits
  users: z.object({
    requestsPerMinute: z.number().int().positive().default(20),
    requestsPerHour: z.number().int().positive().default(100),
    tokensPerDay: z.number().int().positive().default(100000)
  }),

  // Retry configuration
  retry: z.object({
    maxAttempts: z.number().int().min(1).max(10).default(3),
    initialDelay: z.number().int().positive().default(1000),
    maxDelay: z.number().int().positive().default(30000),
    backoffFactor: z.number().min(1).max(5).default(2)
  })
})

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>
```

## Server Configuration

### Server Settings

Configure server behavior:

```typescript
export const ServerConfigSchema = z.object({
  // Server basics
  port: z.number().int().min(1).max(65535).default(3579),
  host: z.string().default('0.0.0.0'),
  environment: z.enum(['development', 'staging', 'production']).default('development'),

  // Database
  database: z.object({
    path: z.string().default('./promptliano.db'),
    backupEnabled: z.boolean().default(true),
    backupInterval: z.number().int().positive().default(3600000), // 1 hour
    maxBackups: z.number().int().positive().default(10)
  }),

  // Security
  security: z.object({
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string()).default(['http://localhost:1420']),
      credentials: z.boolean().default(true)
    }),
    encryption: z.object({
      enabled: z.boolean().default(true),
      algorithm: z.string().default('aes-256-gcm')
    }),
    rateLimit: RateLimitConfigSchema
  }),

  // Logging
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    format: z.enum(['json', 'pretty']).default('pretty'),
    file: z.string().optional(),
    maxSize: z.string().default('10m'),
    maxFiles: z.number().int().positive().default(5)
  }),

  // Performance
  performance: z.object({
    maxRequestSize: z.string().default('50mb'),
    timeout: z.number().int().positive().default(30000),
    compression: z.boolean().default(true),
    cache: z.object({
      enabled: z.boolean().default(true),
      ttl: z.number().int().positive().default(3600000)
    })
  })
})

export type ServerConfig = z.infer<typeof ServerConfigSchema>
```

## Environment Variable Handling

### Environment Schema

Validate environment variables:

```typescript
export const EnvSchema = z.object({
  // Required environment variables
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),

  // Server configuration
  PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)).optional(),
  HOST: z.string().optional(),

  // Database
  DATABASE_PATH: z.string().optional(),
  DATABASE_BACKUP_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .optional(),

  // API Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // URLs
  OLLAMA_BASE_URL: z.string().url().optional(),
  LMSTUDIO_BASE_URL: z.string().url().optional(),

  // Security
  ENCRYPTION_KEY: z.string().min(32).optional(),
  JWT_SECRET: z.string().min(32).optional(),

  // Feature flags
  FEATURE_MCP_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  FEATURE_QUEUE_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .optional()
})

export type Env = z.infer<typeof EnvSchema>

// Parse and validate environment
export function parseEnv(): Env {
  try {
    return EnvSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:')
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`)
      })
      process.exit(1)
    }
    throw error
  }
}
```

## Configuration Loading

### Configuration Loader

Load and merge configurations:

```typescript
export class ConfigLoader {
  private static instance: ConfigLoader
  private config: CompleteConfig
  private env: Env

  private constructor() {
    this.env = parseEnv()
    this.config = this.loadConfig()
  }

  static getInstance(): ConfigLoader {
    if (!this.instance) {
      this.instance = new ConfigLoader()
    }
    return this.instance
  }

  private loadConfig(): CompleteConfig {
    // Start with defaults
    let config = this.getDefaults()

    // Load from config file if exists
    const configFile = this.loadConfigFile()
    if (configFile) {
      config = this.mergeConfig(config, configFile)
    }

    // Apply environment overrides
    config = this.applyEnvOverrides(config)

    // Validate final configuration
    return CompleteConfigSchema.parse(config)
  }

  private getDefaults(): CompleteConfig {
    return {
      models: {
        low: LOW_MODEL_CONFIG,
        medium: MEDIUM_MODEL_CONFIG,
        high: HIGH_MODEL_CONFIG,
        ultra: ULTRA_MODEL_CONFIG
      },
      providers: {},
      server: ServerConfigSchema.parse({}),
      client: ClientConfigSchema.parse({})
    }
  }

  private loadConfigFile(): Partial<CompleteConfig> | null {
    const configPaths = ['./promptliano.config.json', './promptliano.config.js', './.promptlianorc']

    for (const path of configPaths) {
      if (fs.existsSync(path)) {
        const content = fs.readFileSync(path, 'utf-8')

        if (path.endsWith('.js')) {
          return require(path)
        } else {
          return JSON.parse(content)
        }
      }
    }

    return null
  }

  private applyEnvOverrides(config: CompleteConfig): CompleteConfig {
    // Apply environment variable overrides
    if (this.env.PORT) {
      config.server.port = this.env.PORT
    }

    if (this.env.OPENAI_API_KEY) {
      config.providers.openai = {
        ...config.providers.openai,
        apiKey: this.env.OPENAI_API_KEY
      }
    }

    // ... apply other overrides

    return config
  }

  private mergeConfig(base: CompleteConfig, override: Partial<CompleteConfig>): CompleteConfig {
    return deepMerge(base, override)
  }

  get<K extends keyof CompleteConfig>(key: K): CompleteConfig[K] {
    return this.config[key]
  }

  getAll(): CompleteConfig {
    return this.config
  }
}

// Export singleton getter
export function getConfig(): ConfigLoader {
  return ConfigLoader.getInstance()
}
```

## Feature Flags

### Feature Flag Management

Control feature availability:

```typescript
export const FeatureFlagSchema = z.object({
  // Core features
  mcp: z.object({
    enabled: z.boolean().default(true),
    tools: z.array(z.string()).default(['*']),
    resources: z.array(z.string()).default(['*'])
  }),

  queue: z.object({
    enabled: z.boolean().default(true),
    maxQueues: z.number().int().positive().default(10),
    maxItemsPerQueue: z.number().int().positive().default(1000)
  }),

  ai: z.object({
    streaming: z.boolean().default(true),
    structuredOutput: z.boolean().default(true),
    functionCalling: z.boolean().default(true),
    vision: z.boolean().default(false)
  }),

  experimental: z.object({
    newUI: z.boolean().default(false),
    betaFeatures: z.array(z.string()).default([])
  })
})

export type FeatureFlags = z.infer<typeof FeatureFlagSchema>

export class FeatureManager {
  private flags: FeatureFlags

  constructor(overrides?: Partial<FeatureFlags>) {
    this.flags = FeatureFlagSchema.parse(overrides || {})
  }

  isEnabled(feature: string): boolean {
    const parts = feature.split('.')
    let current: any = this.flags

    for (const part of parts) {
      current = current?.[part]
      if (current === undefined) return false
    }

    return current === true
  }

  getFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
    return this.flags[key]
  }
}
```

## Configuration Validation

### Runtime Validation

Validate configurations at runtime:

```typescript
export class ConfigValidator {
  static validate<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
    try {
      return schema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = this.formatError(error, context)
        throw new Error(message)
      }
      throw error
    }
  }

  private static formatError(error: z.ZodError, context?: string): string {
    const prefix = context ? `Configuration error in ${context}:` : 'Configuration error:'
    const issues = error.errors.map((err) => `  - ${err.path.join('.')}: ${err.message}`).join('\n')

    return `${prefix}\n${issues}`
  }

  static async validateAsync<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): Promise<T> {
    try {
      return await schema.parseAsync(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = this.formatError(error, context)
        throw new Error(message)
      }
      throw error
    }
  }
}
```

## Testing Configuration

### Configuration Testing

Test configuration loading and validation:

```typescript
import { describe, test, expect, beforeEach } from 'bun:test'
import { ConfigLoader } from '../config-loader'
import { ModelConfigSchema } from '../schemas'

describe('ConfigLoader', () => {
  let loader: ConfigLoader

  beforeEach(() => {
    // Reset singleton
    ConfigLoader['instance'] = undefined

    // Set test environment
    process.env.NODE_ENV = 'test'
    process.env.PORT = '3000'
  })

  test('loads default configuration', () => {
    loader = ConfigLoader.getInstance()
    const config = loader.getAll()

    expect(config.models.low).toBeDefined()
    expect(config.server.port).toBe(3000) // From env
  })

  test('validates model configuration', () => {
    const validConfig = {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7
    }

    expect(() => ModelConfigSchema.parse(validConfig)).not.toThrow()
  })

  test('rejects invalid configuration', () => {
    const invalidConfig = {
      provider: 'invalid-provider',
      model: '',
      temperature: 3 // Out of range
    }

    expect(() => ModelConfigSchema.parse(invalidConfig)).toThrow()
  })

  test('merges configurations correctly', () => {
    const base = { a: 1, b: { c: 2 } }
    const override = { b: { c: 3, d: 4 } }
    const merged = loader['mergeConfig'](base, override)

    expect(merged).toEqual({
      a: 1,
      b: { c: 3, d: 4 }
    })
  })
})
```

## Best Practices

### 1. Schema Design

- Use strict schemas with `.strict()`
- Provide sensible defaults
- Validate ranges and formats
- Use discriminated unions for variants
- Document all configuration options

### 2. Environment Handling

- Validate environment variables
- Provide clear error messages
- Support multiple config sources
- Use type-safe transformations
- Document required variables

### 3. Configuration Loading

- Load configs lazily
- Cache parsed configurations
- Support hot reloading in development
- Validate at startup
- Provide migration paths

### 4. Error Handling

- Fail fast on invalid config
- Provide helpful error messages
- Include validation context
- Log configuration issues
- Suggest fixes

### 5. Testing

- Test all configuration scenarios
- Test environment overrides
- Test validation errors
- Test default values
- Test config merging

## Common Pitfalls to Avoid

1. **Runtime Type Errors** - Always validate with Zod
2. **Missing Defaults** - Provide defaults for optional fields
3. **Environment Confusion** - Clear precedence rules
4. **Invalid Merging** - Deep merge carefully
5. **Circular Dependencies** - Avoid config dependencies
6. **Secret Exposure** - Never log sensitive config
7. **Type Mismatches** - Keep schemas and types in sync

## Integration with Other Packages

- Used by **all packages** for configuration
- **Server** uses server configurations
- **Client** uses client configurations
- **Services** use model and provider configs
- **MCP tools** use feature flags

The config package ensures consistent, validated configuration across the entire Promptliano ecosystem, making it easy to manage settings across different environments and deployment scenarios.
