import { describe, test, expect, beforeEach } from 'bun:test'
import {
  createContextOptimizer,
  TokenCounter,
  ContentPrioritizer,
  ContentChunker,
  ChunkingStrategy
} from '../../../src/optimizers/context'
import { E } from '../../../src/fp'
import { TEST_PROMPTS } from '../../fixtures/prompts'
import { EXPECTED_IMPROVEMENTS, validators } from '../../fixtures/expected-outputs'
import { estimateTokens } from '../../test-utils'

describe('Context Optimizer', () => {
  let optimizer: ReturnType<typeof createContextOptimizer>

  beforeEach(() => {
    optimizer = createContextOptimizer({
      maxTokens: 4096,
      priorityStrategy: 'relevance',
      chunkingStrategy: 'semantic',
      overlapRatio: 0.1,
      compressionLevel: 'light'
    })
  })

  describe('Basic Functionality', () => {
    test('should optimize a simple prompt', () => {
      const prompt = TEST_PROMPTS.simple.sorting
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.originalPrompt).toBe(prompt)
        expect(optimized.optimizationStrategy.name).toContain('Context')
        expect(optimized.improvementScore).toBeGreaterThan(0)
      }
    })

    test('should include context optimization techniques', () => {
      const prompt = TEST_PROMPTS.complex.systemDesign
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        const techniques = optimized.optimizationStrategy.techniques
        expect(
          techniques.some((t) => t.includes('prioritization') || t.includes('chunking') || t.includes('compression'))
        ).toBe(true)
      }
    })

    test('should validate output structure', () => {
      const prompt = TEST_PROMPTS.algorithmic.quickSort
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(validators.validateContextOutput(optimized)).toBe(true)
      }
    })
  })

  describe('Token Management', () => {
    test('should respect max token limit', () => {
      const longPrompt = TEST_PROMPTS.edgeCases.veryLong
      const result = optimizer.optimize(longPrompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.estimatedTokens).toBeLessThanOrEqual(4096)
      }
    })

    test('should compress content when needed', () => {
      const customOptimizer = createContextOptimizer({
        maxTokens: 500, // Very limited context
        priorityStrategy: 'relevance',
        chunkingStrategy: 'semantic',
        overlapRatio: 0.1,
        compressionLevel: 'aggressive'
      })

      const longPrompt = TEST_PROMPTS.complex.apiDesign
      const result = customOptimizer.optimize(longPrompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.estimatedTokens).toBeLessThanOrEqual(500)
        expect(optimized.userPrompt.length).toBeLessThan(longPrompt.length)
      }
    })

    test('should not modify short prompts unnecessarily', () => {
      const shortPrompt = TEST_PROMPTS.simple.greeting
      const result = optimizer.optimize(shortPrompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        // Short prompts should mostly remain intact
        expect(optimized.userPrompt).toContain(shortPrompt.trim())
      }
    })
  })

  describe('TokenCounter Utility', () => {
    test('should estimate tokens accurately', () => {
      const text = 'This is a sample text for token counting.'
      const tokens = TokenCounter.count(text)

      // Approximately 1 token per 4 characters
      const expectedTokens = Math.ceil(text.length / 4)
      expect(tokens).toBeCloseTo(expectedTokens, 5)
    })

    test('should handle code differently', () => {
      const code = 'function test() { return "hello"; }'
      const plainText = 'This is plain text without any code'

      const codeTokens = TokenCounter.count(code)
      const textTokens = TokenCounter.count(plainText)

      // Code should have slightly more tokens due to symbols
      const codeRatio = codeTokens / code.length
      const textRatio = textTokens / plainText.length

      expect(codeRatio).toBeGreaterThanOrEqual(textRatio)
    })

    test('should fit text to token limit', () => {
      const longText = TEST_PROMPTS.edgeCases.veryLong
      const maxTokens = 100

      const fitted = TokenCounter.fitToLimit(longText, maxTokens)
      const fittedTokens = TokenCounter.count(fitted)

      expect(fittedTokens).toBeLessThanOrEqual(maxTokens)
      expect(fitted.length).toBeLessThan(longText.length)
    })

    test('should preserve sentence boundaries when possible', () => {
      const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.'
      const fitted = TokenCounter.fitToLimit(text, 10)

      // Should try to cut at sentence boundary
      expect(fitted.endsWith('.') || fitted.endsWith('...')).toBe(true)
    })
  })

  describe('Content Prioritization', () => {
    test('should score content by relevance', () => {
      const content = 'This text contains important keywords like optimize and performance.'
      const keywords = ['optimize', 'performance', 'efficiency']

      const score = ContentPrioritizer.scoreByRelevance(content, keywords)

      expect(score).toBeGreaterThan(0)
      // Should find 2 keywords (optimize and performance)
      expect(score).toBe(20)
    })

    test('should prioritize by recency', () => {
      const segments = [
        { content: 'Old content', timestamp: Date.now() - 86400000 }, // 1 day old
        { content: 'Recent content', timestamp: Date.now() - 3600000 }, // 1 hour old
        { content: 'Very recent', timestamp: Date.now() - 60000 } // 1 minute old
      ]

      const scores = ContentPrioritizer.scoreByRecency(segments)

      // More recent content should have higher scores
      expect(scores[2]).toBeGreaterThan(scores[1])
      expect(scores[1]).toBeGreaterThan(scores[0])
    })

    test('should prioritize by importance markers', () => {
      const contents = [
        'Regular content',
        'IMPORTANT: Critical information',
        'NOTE: Additional details',
        'WARNING: Security concern'
      ]

      const scores = contents.map((c) => ContentPrioritizer.scoreByImportance(c))

      // Content with importance markers should score higher
      expect(scores[1]).toBeGreaterThan(scores[0]) // IMPORTANT
      expect(scores[3]).toBeGreaterThan(scores[0]) // WARNING
    })

    test('should use hybrid prioritization', () => {
      const segment = {
        content: 'IMPORTANT: Optimize performance with caching',
        keywords: ['optimize', 'performance', 'caching'],
        timestamp: Date.now() - 3600000
      }

      const score = ContentPrioritizer.hybridScore(segment)

      // Should combine multiple scoring factors
      expect(score).toBeGreaterThan(0)
      expect(score).toBeGreaterThan(ContentPrioritizer.scoreByRelevance(segment.content, segment.keywords))
    })
  })

  describe('Chunking Strategies', () => {
    test('should chunk by semantic boundaries', () => {
      const text = `First paragraph about topic A.
      
      Second paragraph about topic B.
      
      Third paragraph about topic C.`

      const chunks = ChunkingStrategy.semantic(text, 50)

      expect(chunks.length).toBe(3)
      expect(chunks[0]).toContain('topic A')
      expect(chunks[1]).toContain('topic B')
      expect(chunks[2]).toContain('topic C')
    })

    test('should chunk by fixed size', () => {
      const text = TEST_PROMPTS.complex.dataProcessing
      const chunkSize = 100

      const chunks = ChunkingStrategy.fixed(text, chunkSize)

      chunks.forEach((chunk, index) => {
        if (index < chunks.length - 1) {
          expect(chunk.length).toBeLessThanOrEqual(chunkSize)
        }
      })
    })

    test('should chunk by structural patterns', () => {
      const text = `1. First item
      2. Second item
      3. Third item`

      const chunks = ChunkingStrategy.structural(text)

      expect(chunks.length).toBe(3)
      expect(chunks[0]).toContain('First item')
      expect(chunks[1]).toContain('Second item')
      expect(chunks[2]).toContain('Third item')
    })

    test('should use adaptive chunking', () => {
      const shortText = 'Short content'
      const longText = TEST_PROMPTS.complex.systemDesign

      const shortChunks = ChunkingStrategy.adaptive(shortText)
      const longChunks = ChunkingStrategy.adaptive(longText)

      // Adaptive should handle different text lengths appropriately
      expect(shortChunks.length).toBe(1)
      expect(longChunks.length).toBeGreaterThan(1)
    })
  })

  describe('Compression Strategies', () => {
    test('should apply light compression', () => {
      const text = 'This is a very very very long and repetitive repetitive text with many many unnecessary words.'
      const compressed = optimizer.compress(text, 'light')

      expect(compressed.length).toBeLessThan(text.length)
      // Light compression should preserve most content
      expect(compressed).toContain('long')
      expect(compressed).toContain('repetitive')
    })

    test('should apply aggressive compression', () => {
      const text = TEST_PROMPTS.complex.apiDesign
      const compressed = optimizer.compress(text, 'aggressive')

      expect(compressed.length).toBeLessThan(text.length / 2)
      // Should preserve key concepts
      expect(compressed.toLowerCase()).toContain('api')
    })

    test('should not compress when level is none', () => {
      const text = 'Original text content'
      const compressed = optimizer.compress(text, 'none')

      expect(compressed).toBe(text)
    })
  })

  describe('Configuration Options', () => {
    test('should respect priority strategy configuration', () => {
      const relevanceOptimizer = createContextOptimizer({
        maxTokens: 4096,
        priorityStrategy: 'relevance',
        chunkingStrategy: 'semantic',
        overlapRatio: 0.1,
        compressionLevel: 'light'
      })

      const recencyOptimizer = createContextOptimizer({
        maxTokens: 4096,
        priorityStrategy: 'recency',
        chunkingStrategy: 'semantic',
        overlapRatio: 0.1,
        compressionLevel: 'light'
      })

      const prompt = TEST_PROMPTS.complex.dataProcessing
      const relevanceResult = relevanceOptimizer.optimize(prompt)
      const recencyResult = recencyOptimizer.optimize(prompt)

      expect(E.isRight(relevanceResult)).toBe(true)
      expect(E.isRight(recencyResult)).toBe(true)

      if (E.isRight(relevanceResult) && E.isRight(recencyResult)) {
        // Different strategies should produce different outputs
        expect(relevanceResult.right.userPrompt).not.toBe(recencyResult.right.userPrompt)
      }
    })

    test('should respect chunking strategy configuration', () => {
      const semanticOptimizer = createContextOptimizer({
        maxTokens: 1000,
        priorityStrategy: 'relevance',
        chunkingStrategy: 'semantic',
        overlapRatio: 0.1,
        compressionLevel: 'light'
      })

      const fixedOptimizer = createContextOptimizer({
        maxTokens: 1000,
        priorityStrategy: 'relevance',
        chunkingStrategy: 'fixed',
        overlapRatio: 0.1,
        compressionLevel: 'light'
      })

      const prompt = TEST_PROMPTS.complex.systemDesign
      const semanticResult = semanticOptimizer.optimize(prompt)
      const fixedResult = fixedOptimizer.optimize(prompt)

      expect(E.isRight(semanticResult)).toBe(true)
      expect(E.isRight(fixedResult)).toBe(true)
    })

    test('should handle overlap ratio', () => {
      const noOverlapOptimizer = createContextOptimizer({
        maxTokens: 2000,
        priorityStrategy: 'relevance',
        chunkingStrategy: 'fixed',
        overlapRatio: 0,
        compressionLevel: 'none'
      })

      const overlapOptimizer = createContextOptimizer({
        maxTokens: 2000,
        priorityStrategy: 'relevance',
        chunkingStrategy: 'fixed',
        overlapRatio: 0.2,
        compressionLevel: 'none'
      })

      const prompt = TEST_PROMPTS.complex.dataProcessing
      const noOverlapResult = noOverlapOptimizer.optimize(prompt)
      const overlapResult = overlapOptimizer.optimize(prompt)

      expect(E.isRight(noOverlapResult)).toBe(true)
      expect(E.isRight(overlapResult)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('should handle empty prompts', () => {
      const result = optimizer.optimize('')

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.originalPrompt).toBe('')
        expect(optimized.estimatedTokens).toBe(0)
      }
    })

    test('should handle prompts with special characters', () => {
      const prompt = TEST_PROMPTS.edgeCases.specialChars
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.originalPrompt).toBe(prompt)
      }
    })

    test('should handle unicode content', () => {
      const prompt = TEST_PROMPTS.edgeCases.unicode
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.userPrompt).toBeDefined()
      }
    })
  })

  describe('Performance', () => {
    test('should optimize quickly for simple prompts', () => {
      const startTime = performance.now()
      const result = optimizer.optimize(TEST_PROMPTS.simple.sorting)
      const duration = performance.now() - startTime

      expect(E.isRight(result)).toBe(true)
      expect(duration).toBeLessThan(100) // Should be very fast for simple prompts
    })

    test('should handle large prompts efficiently', () => {
      const startTime = performance.now()
      const result = optimizer.optimize(TEST_PROMPTS.edgeCases.veryLong)
      const duration = performance.now() - startTime

      expect(E.isRight(result)).toBe(true)
      expect(duration).toBeLessThan(500) // Should still be reasonably fast
    })
  })

  describe('Feature Support', () => {
    test('should correctly report supported features', () => {
      expect(optimizer.supports('context-optimization')).toBe(true)
      expect(optimizer.supports('token-management')).toBe(true)
      expect(optimizer.supports('prioritization')).toBe(true)
      expect(optimizer.supports('chunking')).toBe(true)
      expect(optimizer.supports('compression')).toBe(true)
      expect(optimizer.supports('unknown-feature')).toBe(false)
    })
  })

  describe('Improvement Score Validation', () => {
    test('should generate improvement scores within expected range', () => {
      const prompts = [
        TEST_PROMPTS.simple.sorting,
        TEST_PROMPTS.algorithmic.palindrome,
        TEST_PROMPTS.complex.systemDesign
      ]

      prompts.forEach((prompt) => {
        const result = optimizer.optimize(prompt)

        expect(E.isRight(result)).toBe(true)
        if (E.isRight(result)) {
          const optimized = result.right
          expect(validators.validateImprovementScore(optimized.improvementScore, 'context')).toBe(true)
        }
      })
    })
  })

  describe('Async Operations', () => {
    test('should optimize asynchronously', async () => {
      const prompt = TEST_PROMPTS.complex.apiDesign
      const result = await optimizer.optimizeAsync(prompt)()

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.metadata.duration).toBeGreaterThanOrEqual(0)
        expect(optimized.metadata.optimizerId).toContain('context')
      }
    })
  })
})
