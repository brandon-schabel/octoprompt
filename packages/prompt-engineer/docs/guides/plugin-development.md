# Plugin Development Guide

## Overview

The @promptliano/prompt-engineer package uses a powerful plugin architecture that allows you to extend its functionality without modifying the core code. This guide will walk you through creating custom plugins for optimizers, providers, storage adapters, and more.

## Table of Contents

1. [Plugin Architecture](#plugin-architecture)
2. [Creating Your First Plugin](#creating-your-first-plugin)
3. [Plugin Types](#plugin-types)
4. [Lifecycle Hooks](#lifecycle-hooks)
5. [Testing Plugins](#testing-plugins)
6. [Publishing Plugins](#publishing-plugins)
7. [Best Practices](#best-practices)
8. [Examples](#examples)

## Plugin Architecture

### Core Concepts

Plugins in @promptliano/prompt-engineer follow these principles:

- **Zero Dependencies**: Plugins should not require the core package
- **Effect-TS Based**: Use Effect for async operations and error handling
- **Type-Safe**: Full TypeScript support with strict typing
- **Lifecycle-Aware**: Hooks for initialization, cleanup, and events
- **Composable**: Plugins can work together seamlessly

### Plugin Interface

```typescript
import { Effect } from 'effect'

interface Plugin<T = any> {
  // Required fields
  name: string
  version: string
  
  // Optional metadata
  description?: string
  author?: string
  license?: string
  
  // Lifecycle methods
  initialize?: () => Effect.Effect<T, Error, never>
  cleanup?: () => Effect.Effect<void, Error, never>
  
  // Event hooks
  beforeOptimize?: (prompt: string) => Effect.Effect<void, Error, never>
  afterOptimize?: (result: OptimizationResult) => Effect.Effect<void, Error, never>
  
  // The plugin's main functionality
  api?: T
}
```

## Creating Your First Plugin

Let's create a simple optimizer plugin that adds emphasis to key terms:

```typescript
import { Effect } from 'effect'
import type { Plugin, OptimizerPlugin, OptimizationResult } from '@promptliano/prompt-engineer'

export const emphasisOptimizer: Plugin<OptimizerPlugin> = {
  name: 'emphasis-optimizer',
  version: '1.0.0',
  description: 'Adds emphasis to important terms in prompts',
  
  async initialize() {
    return Effect.succeed({
      optimize: (prompt: string, options?: any) => 
        Effect.gen(function* (_) {
          // Find key terms (simplified example)
          const keyTerms = prompt.match(/\b(important|critical|essential|key)\b/gi) || []
          
          // Add emphasis
          let optimized = prompt
          keyTerms.forEach(term => {
            optimized = optimized.replace(
              new RegExp(`\\b${term}\\b`, 'gi'),
              `**${term.toUpperCase()}**`
            )
          })
          
          // Calculate improvement score
          const score = keyTerms.length > 0 ? 0.1 * keyTerms.length : 0
          
          return {
            original: prompt,
            improved: optimized,
            score: Math.min(score, 1),
            metadata: {
              termsEmphasized: keyTerms.length,
              technique: 'emphasis'
            }
          } as OptimizationResult
        })
    })
  }
}
```

### Using Your Plugin

```typescript
import { PromptEngineer } from '@promptliano/prompt-engineer'
import { emphasisOptimizer } from './emphasis-optimizer'

const engineer = new PromptEngineer({
  plugins: [emphasisOptimizer]
})

const result = await engineer.optimize(
  'This is an important task that requires critical thinking',
  { optimizers: ['emphasis-optimizer'] }
)

console.log(result.improved)
// Output: This is an **IMPORTANT** task that requires **CRITICAL** thinking
```

## Plugin Types

### 1. Optimizer Plugins

Enhance prompt quality through various techniques:

```typescript
interface OptimizerPlugin {
  optimize: (
    prompt: string,
    options?: OptimizerOptions
  ) => Effect.Effect<OptimizationResult, Error, never>
  
  // Optional methods
  analyzeComplexity?: (prompt: string) => Effect.Effect<number, Error, never>
  suggestImprovements?: (prompt: string) => Effect.Effect<string[], Error, never>
}

// Example: Domain-specific optimizer
export const technicalOptimizer: Plugin<OptimizerPlugin> = {
  name: 'technical-optimizer',
  version: '1.0.0',
  
  async initialize() {
    return Effect.succeed({
      optimize: (prompt: string) => 
        Effect.gen(function* (_) {
          // Add technical context
          const technicalContext = `
            [Technical Context]
            - Use precise terminology
            - Include relevant specifications
            - Provide implementation details
          `
          
          const improved = `${technicalContext}\n\n${prompt}`
          
          return {
            original: prompt,
            improved,
            score: 0.25,
            metadata: { domain: 'technical' }
          }
        })
    })
  }
}
```

### 2. Provider Plugins

Connect to different LLM providers:

```typescript
interface ProviderPlugin {
  generateCompletion: (
    prompt: string,
    options?: GenerationOptions
  ) => Effect.Effect<string, Error, never>
  
  streamCompletion?: (
    prompt: string,
    options?: GenerationOptions
  ) => Effect.Effect<AsyncIterable<string>, Error, never>
  
  getModelInfo?: () => Effect.Effect<ModelInfo, Error, never>
}

// Example: Custom API provider
export const customAPIProvider: Plugin<ProviderPlugin> = {
  name: 'custom-api-provider',
  version: '1.0.0',
  
  async initialize() {
    const apiKey = process.env.CUSTOM_API_KEY
    const baseURL = process.env.CUSTOM_API_URL || 'https://api.example.com'
    
    return Effect.succeed({
      generateCompletion: (prompt: string, options?: any) =>
        Effect.tryPromise({
          try: async () => {
            const response = await fetch(`${baseURL}/completions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                prompt,
                max_tokens: options?.maxTokens || 1000,
                temperature: options?.temperature || 0.7
              })
            })
            
            const data = await response.json()
            return data.completion
          },
          catch: (error) => new Error(`API call failed: ${error}`)
        }),
        
      getModelInfo: () => 
        Effect.succeed({
          name: 'custom-model',
          version: '1.0',
          contextWindow: 4096,
          capabilities: ['text-generation']
        })
    })
  }
}
```

### 3. Storage Plugins

Implement custom caching and persistence:

```typescript
interface StoragePlugin {
  get: (key: string) => Effect.Effect<any, Error, never>
  set: (key: string, value: any) => Effect.Effect<void, Error, never>
  delete: (key: string) => Effect.Effect<void, Error, never>
  clear: () => Effect.Effect<void, Error, never>
  
  // Optional batch operations
  getBatch?: (keys: string[]) => Effect.Effect<Map<string, any>, Error, never>
  setBatch?: (entries: Map<string, any>) => Effect.Effect<void, Error, never>
}

// Example: Redis storage plugin
export const redisStoragePlugin: Plugin<StoragePlugin> = {
  name: 'redis-storage',
  version: '1.0.0',
  
  async initialize() {
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379')
    })
    
    return Effect.succeed({
      get: (key: string) =>
        Effect.tryPromise({
          try: async () => {
            const value = await redis.get(key)
            return value ? JSON.parse(value) : null
          },
          catch: (error) => new Error(`Redis get failed: ${error}`)
        }),
        
      set: (key: string, value: any) =>
        Effect.tryPromise({
          try: () => redis.set(key, JSON.stringify(value)),
          catch: (error) => new Error(`Redis set failed: ${error}`)
        }),
        
      delete: (key: string) =>
        Effect.tryPromise({
          try: () => redis.del(key),
          catch: (error) => new Error(`Redis delete failed: ${error}`)
        }),
        
      clear: () =>
        Effect.tryPromise({
          try: () => redis.flushdb(),
          catch: (error) => new Error(`Redis clear failed: ${error}`)
        })
    })
  },
  
  async cleanup() {
    // Close Redis connection
    return Effect.succeed(undefined)
  }
}
```

### 4. Analyzer Plugins

Add custom analysis capabilities:

```typescript
interface AnalyzerPlugin {
  analyze: (prompt: string) => Effect.Effect<AnalysisResult, Error, never>
  
  // Optional specialized analyses
  analyzeSentiment?: (prompt: string) => Effect.Effect<SentimentResult, Error, never>
  analyzeComplexity?: (prompt: string) => Effect.Effect<ComplexityResult, Error, never>
  analyzeToxicity?: (prompt: string) => Effect.Effect<ToxicityResult, Error, never>
}

// Example: Readability analyzer
export const readabilityAnalyzer: Plugin<AnalyzerPlugin> = {
  name: 'readability-analyzer',
  version: '1.0.0',
  
  async initialize() {
    return Effect.succeed({
      analyze: (prompt: string) =>
        Effect.gen(function* (_) {
          // Calculate readability metrics
          const words = prompt.split(/\s+/).length
          const sentences = prompt.split(/[.!?]+/).length
          const syllables = countSyllables(prompt)
          
          // Flesch Reading Ease
          const fleschScore = 206.835 - 
            1.015 * (words / sentences) - 
            84.6 * (syllables / words)
          
          // Flesch-Kincaid Grade Level
          const gradeLevel = 0.39 * (words / sentences) + 
            11.8 * (syllables / words) - 15.59
          
          return {
            metrics: {
              fleschReadingEase: Math.max(0, Math.min(100, fleschScore)),
              gradeLevel: Math.max(0, gradeLevel),
              wordCount: words,
              sentenceCount: sentences
            },
            recommendations: getReadabilityRecommendations(fleschScore),
            summary: `Grade level ${gradeLevel.toFixed(1)}, ${getReadabilityLevel(fleschScore)}`
          }
        })
    })
  }
}
```

## Lifecycle Hooks

Plugins can hook into various lifecycle events:

```typescript
export const lifecyclePlugin: Plugin = {
  name: 'lifecycle-example',
  version: '1.0.0',
  
  // Called when plugin is loaded
  async initialize() {
    console.log('Plugin initializing...')
    
    // Setup resources, connections, etc.
    const resources = await setupResources()
    
    return Effect.succeed({
      // Plugin API
      doSomething: () => Effect.succeed('done')
    })
  },
  
  // Called before each optimization
  async beforeOptimize(prompt: string) {
    return Effect.gen(function* (_) {
      console.log(`Starting optimization of: ${prompt.substring(0, 50)}...`)
      
      // Pre-processing, validation, etc.
      yield* _(validatePrompt(prompt))
    })
  },
  
  // Called after each optimization
  async afterOptimize(result: OptimizationResult) {
    return Effect.gen(function* (_) {
      console.log(`Optimization complete. Score: ${result.score}`)
      
      // Post-processing, logging, metrics, etc.
      yield* _(logMetrics(result))
    })
  },
  
  // Called when plugin is unloaded
  async cleanup() {
    return Effect.gen(function* (_) {
      console.log('Plugin cleaning up...')
      
      // Close connections, free resources, etc.
      yield* _(cleanupResources())
    })
  }
}
```

## Testing Plugins

### Unit Testing

```typescript
import { describe, it, expect } from 'bun:test'
import { Effect } from 'effect'
import { emphasisOptimizer } from './emphasis-optimizer'

describe('EmphasisOptimizer', () => {
  it('should emphasize key terms', async () => {
    const plugin = await Effect.runPromise(emphasisOptimizer.initialize!())
    const result = await Effect.runPromise(
      plugin.optimize('This is important information')
    )
    
    expect(result.improved).toContain('**IMPORTANT**')
    expect(result.score).toBeGreaterThan(0)
  })
  
  it('should handle prompts without key terms', async () => {
    const plugin = await Effect.runPromise(emphasisOptimizer.initialize!())
    const result = await Effect.runPromise(
      plugin.optimize('This is regular text')
    )
    
    expect(result.improved).toBe('This is regular text')
    expect(result.score).toBe(0)
  })
})
```

### Integration Testing

```typescript
import { PromptEngineer } from '@promptliano/prompt-engineer'
import { myCustomPlugin } from './my-custom-plugin'

describe('Custom Plugin Integration', () => {
  let engineer: PromptEngineer
  
  beforeEach(async () => {
    engineer = new PromptEngineer({
      plugins: [myCustomPlugin]
    })
    await engineer.initialize()
  })
  
  afterEach(async () => {
    await engineer.cleanup()
  })
  
  it('should work with PromptEngineer', async () => {
    const result = await engineer.optimize('Test prompt', {
      optimizers: ['my-custom-plugin']
    })
    
    expect(result).toBeDefined()
    expect(result.metadata.optimizer).toBe('my-custom-plugin')
  })
})
```

### Testing Utilities

```typescript
// test-utils.ts
import { Effect } from 'effect'
import type { Plugin } from '@promptliano/prompt-engineer'

export class PluginTestHarness {
  private plugin: Plugin
  private initialized: any
  
  constructor(plugin: Plugin) {
    this.plugin = plugin
  }
  
  async setup() {
    if (this.plugin.initialize) {
      this.initialized = await Effect.runPromise(this.plugin.initialize())
    }
    return this
  }
  
  async teardown() {
    if (this.plugin.cleanup) {
      await Effect.runPromise(this.plugin.cleanup())
    }
  }
  
  getAPI() {
    return this.initialized || this.plugin.api
  }
  
  async testOptimization(prompt: string) {
    const api = this.getAPI()
    if (api?.optimize) {
      return Effect.runPromise(api.optimize(prompt))
    }
    throw new Error('Plugin does not provide optimize method')
  }
}

// Usage
const harness = new PluginTestHarness(myPlugin)
await harness.setup()
const result = await harness.testOptimization('test')
await harness.teardown()
```

## Publishing Plugins

### Package Structure

```
my-prompt-engineer-plugin/
├── src/
│   ├── index.ts          # Main plugin export
│   ├── optimizer.ts      # Optimization logic
│   └── types.ts          # Type definitions
├── tests/
│   ├── unit.test.ts      # Unit tests
│   └── integration.test.ts # Integration tests
├── examples/
│   └── basic-usage.ts    # Usage examples
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

### Package.json Configuration

```json
{
  "name": "@yourorg/prompt-engineer-plugin-example",
  "version": "1.0.0",
  "description": "Example plugin for @promptliano/prompt-engineer",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "keywords": [
    "prompt-engineer",
    "prompt-engineer-plugin",
    "llm",
    "optimization"
  ],
  "peerDependencies": {
    "@promptliano/prompt-engineer": "^1.0.0",
    "effect": "^2.0.0"
  },
  "devDependencies": {
    "@promptliano/prompt-engineer": "^1.0.0",
    "effect": "^2.0.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "bun test",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

### Publishing Checklist

1. **Documentation**
   - [ ] Clear README with installation and usage
   - [ ] API documentation
   - [ ] Examples directory

2. **Testing**
   - [ ] Unit tests with >80% coverage
   - [ ] Integration tests
   - [ ] Test with multiple versions of core package

3. **Build**
   - [ ] TypeScript compilation
   - [ ] Bundle size optimization
   - [ ] Source maps for debugging

4. **Publishing**
   ```bash
   # Build and test
   npm run build
   npm test
   
   # Publish to npm
   npm publish --access public
   ```

## Best Practices

### 1. Error Handling

Always use Effect for error handling:

```typescript
// Good
const optimize = (prompt: string) =>
  Effect.gen(function* (_) {
    const validation = yield* _(validatePrompt(prompt))
    if (!validation.valid) {
      return yield* _(Effect.fail(new ValidationError(validation.errors)))
    }
    
    const result = yield* _(performOptimization(prompt))
    return result
  })

// Bad
const optimize = async (prompt: string) => {
  try {
    // Throws errors without proper handling
    const result = await performOptimization(prompt)
    return result
  } catch (error) {
    throw error // Lost error context
  }
}
```

### 2. Configuration

Make plugins configurable:

```typescript
interface PluginConfig {
  apiKey?: string
  baseURL?: string
  timeout?: number
  retries?: number
  debug?: boolean
}

export const createPlugin = (config: PluginConfig = {}): Plugin => ({
  name: 'configurable-plugin',
  version: '1.0.0',
  
  async initialize() {
    const finalConfig = {
      apiKey: config.apiKey || process.env.PLUGIN_API_KEY,
      baseURL: config.baseURL || 'https://api.example.com',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      debug: config.debug || false
    }
    
    // Use configuration
    return Effect.succeed({
      // Plugin implementation
    })
  }
})
```

### 3. Performance

Optimize for performance:

```typescript
// Cache expensive operations
const cache = new Map<string, OptimizationResult>()

const optimize = (prompt: string) =>
  Effect.gen(function* (_) {
    // Check cache first
    const cached = cache.get(prompt)
    if (cached) {
      return cached
    }
    
    // Perform optimization
    const result = yield* _(expensiveOptimization(prompt))
    
    // Cache result
    cache.set(prompt, result)
    
    // Implement cache eviction if needed
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }
    
    return result
  })
```

### 4. Type Safety

Leverage TypeScript's type system:

```typescript
// Define strict types
type OptimizationType = 'emphasis' | 'clarity' | 'conciseness'

interface StrictOptimizerOptions {
  type: OptimizationType
  level: 1 | 2 | 3 | 4 | 5
  preserveStyle: boolean
}

// Use branded types for safety
type PromptId = string & { readonly _brand: unique symbol }
type OptimizedPrompt = string & { readonly _brand: unique symbol }

// Enforce constraints at compile time
const optimize = <T extends OptimizationType>(
  prompt: string,
  options: StrictOptimizerOptions & { type: T }
): Effect.Effect<OptimizedPrompt, Error, never> => {
  // Type-safe implementation
}
```

## Examples

### Complete Plugin Example

Here's a complete example of a sentiment-aware optimizer:

```typescript
// sentiment-optimizer.ts
import { Effect, pipe } from 'effect'
import type { Plugin, OptimizerPlugin, OptimizationResult } from '@promptliano/prompt-engineer'

interface SentimentConfig {
  targetSentiment?: 'positive' | 'neutral' | 'negative'
  intensity?: number // 0-1
}

export const createSentimentOptimizer = (
  config: SentimentConfig = {}
): Plugin<OptimizerPlugin> => ({
  name: 'sentiment-optimizer',
  version: '1.0.0',
  description: 'Adjusts prompt sentiment for desired emotional tone',
  
  async initialize() {
    const targetSentiment = config.targetSentiment || 'neutral'
    const intensity = config.intensity || 0.5
    
    return Effect.succeed({
      optimize: (prompt: string) =>
        pipe(
          Effect.gen(function* (_) {
            // Analyze current sentiment
            const currentSentiment = yield* _(analyzeSentiment(prompt))
            
            // If already at target, return as-is
            if (currentSentiment.label === targetSentiment) {
              return {
                original: prompt,
                improved: prompt,
                score: 0,
                metadata: { alreadyOptimal: true }
              }
            }
            
            // Adjust sentiment
            const adjusted = yield* _(
              adjustSentiment(prompt, targetSentiment, intensity)
            )
            
            // Verify adjustment
            const newSentiment = yield* _(analyzeSentiment(adjusted))
            
            // Calculate improvement score
            const score = calculateSentimentImprovement(
              currentSentiment,
              newSentiment,
              targetSentiment
            )
            
            return {
              original: prompt,
              improved: adjusted,
              score,
              metadata: {
                originalSentiment: currentSentiment,
                newSentiment,
                targetSentiment
              }
            } as OptimizationResult
          }),
          Effect.catchAll((error) =>
            Effect.succeed({
              original: prompt,
              improved: prompt,
              score: 0,
              error: error.message
            } as OptimizationResult)
          )
        )
    })
  }
})

// Helper functions
const analyzeSentiment = (text: string) =>
  Effect.gen(function* (_) {
    // Simplified sentiment analysis
    const positiveWords = ['great', 'excellent', 'wonderful', 'fantastic']
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible']
    
    const words = text.toLowerCase().split(/\s+/)
    const positiveCount = words.filter(w => positiveWords.includes(w)).length
    const negativeCount = words.filter(w => negativeWords.includes(w)).length
    
    if (positiveCount > negativeCount) {
      return { label: 'positive' as const, score: positiveCount / words.length }
    } else if (negativeCount > positiveCount) {
      return { label: 'negative' as const, score: negativeCount / words.length }
    } else {
      return { label: 'neutral' as const, score: 0 }
    }
  })

const adjustSentiment = (
  text: string,
  target: 'positive' | 'neutral' | 'negative',
  intensity: number
) =>
  Effect.gen(function* (_) {
    const adjustments = {
      positive: {
        prefix: 'Please approach this positively: ',
        replacements: [
          ['problem', 'opportunity'],
          ['difficult', 'challenging'],
          ['cannot', 'have not yet']
        ]
      },
      neutral: {
        prefix: 'Please provide an objective view: ',
        replacements: [
          ['amazing', 'good'],
          ['terrible', 'suboptimal'],
          ['must', 'should consider']
        ]
      },
      negative: {
        prefix: 'Critical analysis needed: ',
        replacements: [
          ['good', 'acceptable'],
          ['great', 'adequate'],
          ['opportunity', 'risk']
        ]
      }
    }
    
    const adjustment = adjustments[target]
    let adjusted = text
    
    // Apply replacements based on intensity
    const replacementsToApply = Math.floor(adjustment.replacements.length * intensity)
    for (let i = 0; i < replacementsToApply; i++) {
      const [from, to] = adjustment.replacements[i]
      adjusted = adjusted.replace(new RegExp(from, 'gi'), to)
    }
    
    // Add prefix if high intensity
    if (intensity > 0.7) {
      adjusted = adjustment.prefix + adjusted
    }
    
    return adjusted
  })

const calculateSentimentImprovement = (
  current: any,
  updated: any,
  target: string
): number => {
  if (updated.label === target) {
    return 0.5 + (updated.score * 0.5)
  }
  return 0.1
}

// Usage
const sentimentOptimizer = createSentimentOptimizer({
  targetSentiment: 'positive',
  intensity: 0.8
})

const engineer = new PromptEngineer({
  plugins: [sentimentOptimizer]
})

const result = await engineer.optimize(
  'This is a difficult problem that cannot be solved',
  { optimizers: ['sentiment-optimizer'] }
)

console.log(result.improved)
// Output: "Please approach this positively: This is a challenging opportunity that have not yet been solved"
```

## Troubleshooting

### Common Issues

1. **Plugin not loading**
   - Check plugin name matches exactly
   - Ensure initialize() returns Effect.succeed()
   - Verify no import errors

2. **Type errors**
   - Update @promptliano/prompt-engineer to latest
   - Check Effect version compatibility
   - Use strict TypeScript settings

3. **Performance issues**
   - Implement caching for expensive operations
   - Use Effect.fork for parallel processing
   - Profile with Effect.timed

4. **Memory leaks**
   - Implement cleanup() method
   - Clear caches periodically
   - Use WeakMap for object references

## Resources

- [Effect Documentation](https://effect.website/)
- [Plugin Examples Repository](https://github.com/promptliano/prompt-engineer-plugins)
- [API Reference](../api/index.html)
- [Discord Community](https://discord.gg/promptliano)

## Next Steps

1. **Start Simple**: Begin with a basic optimizer plugin
2. **Test Thoroughly**: Write comprehensive tests
3. **Document Well**: Clear README and examples
4. **Share**: Publish to npm and share with community
5. **Iterate**: Gather feedback and improve

Happy plugin development! 🚀