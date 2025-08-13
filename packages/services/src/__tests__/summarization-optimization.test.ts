import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { SmartTruncation } from '../utils/smart-truncation'
import {
  SummarizationPrompts,
  selectPromptStrategy,
  type SummarizationContext
} from '../prompt-templates/summarization-prompts'
import { summarizationCache } from '../caching/summarization-cache'
import { summarizationMetrics } from '../metrics/summarization-metrics'
import { BatchSummarizationOptimizer } from '../file-services/batch-summarization-optimizer'
import type { ProjectFile } from '@promptliano/schemas'
import { MAX_TOKENS_FOR_SUMMARY, PROMPT_OVERHEAD_TOKENS, RESPONSE_BUFFER_TOKENS } from '@promptliano/config'

describe('Smart Truncation Service', () => {
  describe('Token Estimation', () => {
    test('should accurately estimate tokens for code', () => {
      const code = `
        function hello() {
          console.log("Hello, World!");
        }
      `
      const tokens = SmartTruncation.estimateTokens(code)
      // Rough estimate: ~15-20 tokens for this simple function
      expect(tokens).toBeGreaterThan(10)
      expect(tokens).toBeLessThan(30)
    })

    test('should adjust for code density', () => {
      const sparseCode = '    \n    \n    \n    ' // Lots of whitespace
      const denseCode = 'const a=1;const b=2;const c=3;' // Dense code

      const sparseTokens = SmartTruncation.estimateTokens(sparseCode)
      const denseTokens = SmartTruncation.estimateTokens(denseCode)

      // Dense code should have more tokens per character
      expect(denseTokens / denseCode.length).toBeGreaterThan(sparseTokens / sparseCode.length)
    })
  })

  describe('Content Truncation', () => {
    test('should not truncate content that fits within limits', () => {
      const content = 'Small content that fits'
      const result = SmartTruncation.truncate(content, { maxTokens: 1000 })

      expect(result.wasTruncated).toBe(false)
      expect(result.content).toBe(content)
      expect(result.preservedSections).toEqual(['full'])
    })

    test('should preserve imports when truncating', () => {
      const content = `
import React from 'react'
import { useState } from 'react'
import './styles.css'

// Lots of code here...
${'x'.repeat(100000)}
      `

      const result = SmartTruncation.truncate(content, {
        maxTokens: 100,
        preserveImports: true
      })

      expect(result.wasTruncated).toBe(true)
      expect(result.content).toContain('import React')
      expect(result.content).toContain('import { useState }')
      expect(result.preservedSections).toContain('imports')
    })

    test('should preserve exports when truncating', () => {
      const content = `
function internalFunction() {
  ${'// internal code '.repeat(10000)}
}

export function publicFunction() {
  return 'public'
}

export default class MainClass {
  constructor() {}
}
      `

      const result = SmartTruncation.truncate(content, {
        maxTokens: 200,
        preserveExports: true
      })

      expect(result.wasTruncated).toBe(true)
      expect(result.content).toContain('export function publicFunction')
      expect(result.content).toContain('export default class MainClass')
    })

    test('should prioritize content correctly', () => {
      const content = `
import { critical } from 'critical-module'

export class PublicAPI {
  method() {}
}

// Low priority comment
// Another comment

function helperFunction() {
  // Helper code
}
      `

      const result = SmartTruncation.truncate(content, {
        maxTokens: 50,
        preserveImports: true,
        preserveExports: true,
        preserveClasses: true
      })

      expect(result.content).toContain('import')
      expect(result.content).toContain('export class PublicAPI')
      expect(result.content).not.toContain('Low priority comment')
    })
  })

  describe('Truncation Summary', () => {
    test('should generate accurate truncation summary', () => {
      const result = {
        content: 'truncated',
        wasTruncated: true,
        originalTokens: 1000,
        truncatedTokens: 300,
        preservedSections: ['imports', 'exports', 'class:MyClass']
      }

      const summary = SmartTruncation.getTruncationSummary(result)

      expect(summary).toContain('70%') // 70% reduction
      expect(summary).toContain('imports, exports, class:MyClass')
      expect(summary).toContain('1000 tokens')
      expect(summary).toContain('300 tokens')
    })
  })
})

describe('Summarization Prompts', () => {
  const mockFile: ProjectFile = {
    id: 1,
    projectId: 1,
    name: 'test.ts',
    path: '/src/test.ts',
    extension: '.ts',
    size: 1000,
    content: 'test content',
    created: Date.now(),
    updated: Date.now()
  }

  describe('Prompt Strategy Selection', () => {
    test('should select chain-of-thought for complex files', () => {
      const largeFile = { ...mockFile, size: 60000, path: '/src/user-service.ts' }
      const context: SummarizationContext = {}

      const strategy = selectPromptStrategy(largeFile, context)

      expect(strategy.useChainOfThought).toBe(true)
      expect(strategy.depth).toBe('detailed')
    })

    test('should select few-shot for common file types', () => {
      const tsxFile = { ...mockFile, extension: '.tsx' }
      const context: SummarizationContext = {}

      const strategy = selectPromptStrategy(tsxFile, context)

      expect(strategy.includeExamples).toBe(true)
      expect(strategy.format).toBe('structured')
    })

    test('should adjust strategy based on context', () => {
      const context: SummarizationContext = {
        relatedFiles: [
          { name: 'related1.ts', summary: 'Related file 1' },
          { name: 'related2.ts', summary: 'Related file 2' }
        ]
      }

      const strategy = selectPromptStrategy(mockFile, context)

      expect(strategy.depth).toBe('standard')
    })
  })

  describe('Prompt Generation', () => {
    test('should generate structured prompt', () => {
      const context: SummarizationContext = {
        fileType: '.ts',
        importsContext: 'Imports: react, lodash',
        exportsContext: 'Exports: MyComponent, utils'
      }

      const prompt = SummarizationPrompts.getStructuredPrompt(mockFile, context)

      expect(prompt).toContain('Code File Analysis Task')
      expect(prompt).toContain('PURPOSE:')
      expect(prompt).toContain('TYPE:')
      expect(prompt).toContain('DEPS:')
      expect(prompt).toContain('Imports: react, lodash')
    })

    test('should generate chain-of-thought prompt', () => {
      const context: SummarizationContext = {
        projectContext: 'E-commerce platform'
      }

      const prompt = SummarizationPrompts.getChainOfThoughtPrompt(mockFile, context)

      expect(prompt).toContain('Step 1:')
      expect(prompt).toContain('Step 2:')
      expect(prompt).toContain('E-commerce platform')
    })

    test('should include few-shot examples', () => {
      const context: SummarizationContext = {}

      const prompt = SummarizationPrompts.getFewShotPrompt(mockFile, context)

      expect(prompt).toContain('Example')
      expect(prompt).toContain('PURPOSE:')
      expect(prompt).toContain('TYPE:')
    })
  })
})

describe('Summarization Cache', () => {
  beforeEach(() => {
    summarizationCache.clear()
  })

  test('should cache and retrieve summaries', () => {
    const file: ProjectFile = {
      id: 1,
      projectId: 1,
      name: 'test.ts',
      path: '/test.ts',
      content: 'test content',
      size: 100,
      created: Date.now(),
      updated: Date.now()
    }

    const summary = 'This is a test summary'

    // Cache miss initially
    expect(summarizationCache.get(file)).toBeNull()

    // Store in cache
    summarizationCache.set(file, summary, { tokenCount: 10 })

    // Cache hit
    const cached = summarizationCache.get(file)
    expect(cached).not.toBeNull()
    expect(cached?.summary).toBe(summary)
    expect(cached?.tokenCount).toBe(10)
  })

  test('should invalidate cache on content change', () => {
    const file: ProjectFile = {
      id: 1,
      projectId: 1,
      name: 'test.ts',
      path: '/test.ts',
      content: 'original content',
      size: 100,
      created: Date.now(),
      updated: Date.now()
    }

    summarizationCache.set(file, 'Original summary')

    // Change content
    const modifiedFile = { ...file, content: 'modified content' }

    // Should get cache miss due to content change
    expect(summarizationCache.get(modifiedFile)).toBeNull()
  })

  test('should track cache statistics', () => {
    const file: ProjectFile = {
      id: 1,
      projectId: 1,
      name: 'test.ts',
      path: '/test.ts',
      content: 'test',
      size: 100,
      created: Date.now(),
      updated: Date.now()
    }

    // Miss
    summarizationCache.get(file)

    // Store
    summarizationCache.set(file, 'Summary')

    // Hit
    summarizationCache.get(file)
    summarizationCache.get(file)

    const stats = summarizationCache.getStats()
    expect(stats.totalEntries).toBe(1)
    expect(stats.hitRate).toBeGreaterThan(0.5) // 2 hits, 1 miss
    expect(stats.missRate).toBeLessThan(0.5)
  })

  test('should invalidate project cache', () => {
    const file1: ProjectFile = {
      id: 1,
      projectId: 1,
      name: 'file1.ts',
      path: '/file1.ts',
      content: 'content1',
      size: 100,
      created: Date.now(),
      updated: Date.now()
    }

    const file2: ProjectFile = {
      id: 2,
      projectId: 1,
      name: 'file2.ts',
      path: '/file2.ts',
      content: 'content2',
      size: 100,
      created: Date.now(),
      updated: Date.now()
    }

    summarizationCache.set(file1, 'Summary 1')
    summarizationCache.set(file2, 'Summary 2')

    const invalidated = summarizationCache.invalidateProject(1)
    expect(invalidated).toBe(2)

    expect(summarizationCache.get(file1)).toBeNull()
    expect(summarizationCache.get(file2)).toBeNull()
  })
})

describe('Summarization Metrics', () => {
  beforeEach(() => {
    summarizationMetrics.clearMetrics()
  })

  test('should record file metrics', () => {
    const file: ProjectFile = {
      id: 1,
      projectId: 1,
      name: 'test.ts',
      path: '/test.ts',
      content: 'test',
      size: 100,
      created: Date.now(),
      updated: Date.now()
    }

    summarizationMetrics.recordFileMetrics(file, {
      tokensUsed: 500,
      tokensAvailable: 1000,
      processingTime: 100,
      cacheHit: false,
      truncated: false,
      promptStrategy: 'structured',
      modelUsed: 'gpt-oss-20b'
    })

    const metrics = summarizationMetrics.getProjectMetrics(1)
    expect(metrics.totalFiles).toBe(1)
    expect(metrics.totalTokensUsed).toBe(500)
    expect(metrics.averageUtilizationRate).toBe(0.5)
    expect(metrics.averageProcessingTime).toBe(100)
  })

  test('should calculate token savings', () => {
    const file: ProjectFile = {
      id: 1,
      projectId: 1,
      name: 'test.ts',
      path: '/test.ts',
      content: 'test',
      size: 100,
      created: Date.now(),
      updated: Date.now()
    }

    // Simulate using fewer tokens than old limit
    summarizationMetrics.recordFileMetrics(file, {
      tokensUsed: 5000,
      tokensAvailable: 28000,
      processingTime: 100,
      cacheHit: false,
      truncated: false,
      promptStrategy: 'structured',
      modelUsed: 'gpt-oss-20b'
    })

    const metrics = summarizationMetrics.getProjectMetrics(1)
    // Old limit was 8000, we used 5000, saved 3000
    expect(metrics.tokensSaved).toBe(3000)
    expect(metrics.costSavings).toBeGreaterThan(0)
  })

  test('should generate optimization recommendations', () => {
    const file: ProjectFile = {
      id: 1,
      projectId: 1,
      name: 'test.ts',
      path: '/test.ts',
      content: 'test',
      size: 100,
      created: Date.now(),
      updated: Date.now()
    }

    // Simulate poor performance
    for (let i = 0; i < 10; i++) {
      summarizationMetrics.recordFileMetrics(file, {
        tokensUsed: 1000,
        tokensAvailable: 28000, // Very low utilization
        processingTime: 10000, // Slow
        cacheHit: false, // No cache hits
        truncated: true, // High truncation
        promptStrategy: 'structured',
        modelUsed: 'gpt-oss-20b'
      })
    }

    const recommendations = summarizationMetrics.getOptimizationRecommendations(1)

    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations.some((r) => r.includes('Low token utilization'))).toBe(true)
    expect(recommendations.some((r) => r.includes('Low cache hit rate'))).toBe(true)
    expect(recommendations.some((r) => r.includes('Slow average processing time'))).toBe(true)
  })
})

describe('Batch Summarization Optimizer', () => {
  const optimizer = new BatchSummarizationOptimizer()

  test('should create optimized batches', async () => {
    const files: ProjectFile[] = [
      {
        id: 1,
        projectId: 1,
        name: 'file1.ts',
        path: '/src/file1.ts',
        content: 'content1',
        size: 1000,
        created: Date.now(),
        updated: Date.now()
      },
      {
        id: 2,
        projectId: 1,
        name: 'file2.ts',
        path: '/src/file2.ts',
        content: 'content2',
        size: 1000,
        created: Date.now(),
        updated: Date.now()
      },
      {
        id: 3,
        projectId: 1,
        name: 'file3.ts',
        path: '/src/file3.ts',
        content: 'content3',
        size: 1000,
        created: Date.now(),
        updated: Date.now()
      }
    ]

    const batches = await optimizer.createOptimizedBatches(1, files, {
      maxFilesPerBatch: 2,
      groupingStrategy: 'directory'
    })

    expect(batches.length).toBeGreaterThan(0)
    expect(batches[0].files.length).toBeLessThanOrEqual(2)
    expect(batches[0].estimatedTokens).toBeGreaterThan(0)
  })

  test('should calculate optimal batch configuration', () => {
    const config = BatchSummarizationOptimizer.calculateOptimalBatchConfig(100, 5000)

    expect(config.maxFilesPerBatch).toBeGreaterThan(0)
    expect(config.maxTokensPerBatch).toBe(25000) // OPTIMAL_TOKENS_FOR_BATCH
    expect(config.groupingStrategy).toBeDefined()
    expect(config.priorityThreshold).toBeGreaterThan(0)
  })
})

describe('Integration Tests', () => {
  test('should optimize token usage compared to old system', () => {
    const largeContent = 'x'.repeat(120000) // ~30k tokens

    // Old system would truncate to 8k tokens
    const oldMaxChars = 8000 * 4
    const oldContent = largeContent.substring(0, oldMaxChars)
    const oldTokens = Math.ceil(oldContent.length / 4)

    // New system with smart truncation
    const newResult = SmartTruncation.truncate(largeContent, {
      maxTokens: MAX_TOKENS_FOR_SUMMARY - PROMPT_OVERHEAD_TOKENS - RESPONSE_BUFFER_TOKENS
    })
    const newTokens = SmartTruncation.estimateTokens(newResult.content)

    // Should use significantly more tokens
    expect(newTokens).toBeGreaterThan(oldTokens * 2)
    expect(newTokens).toBeLessThanOrEqual(MAX_TOKENS_FOR_SUMMARY)
  })

  test('should maintain summary quality with truncation', () => {
    const content = `
import React from 'react'
import { useState } from 'react'

export class MainComponent extends React.Component {
  render() {
    return <div>Main</div>
  }
}

// Lots of internal implementation
${'const x = 1;'.repeat(10000)}

export function helperFunction() {
  return 'helper'
}
    `

    const result = SmartTruncation.truncate(content, {
      maxTokens: 500,
      preserveImports: true,
      preserveExports: true,
      preserveClasses: true
    })

    // Should preserve all important parts
    expect(result.content).toContain('import React')
    expect(result.content).toContain('export class MainComponent')
    expect(result.content).toContain('export function helperFunction')
    expect(result.wasTruncated).toBe(true)

    // Should indicate truncation
    const summary = SmartTruncation.getTruncationSummary(result)
    expect(summary).toContain('truncated')
  })
})
