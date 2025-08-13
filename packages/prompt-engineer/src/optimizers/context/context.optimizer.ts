import { pipe, E, TE, A, O } from '../../fp'
import {
  type ContextConfig,
  type ContextWindow,
  type ContextMetadata,
  type OptimizedPrompt,
  type Optimizer,
  type OptimizationStrategy,
  type PromptAnalysis
} from '../../types'

// ============================================================================
// Context Optimizer Configuration
// ============================================================================

const defaultConfig: ContextConfig = {
  maxTokens: 4096,
  priorityStrategy: 'relevance',
  chunkingStrategy: 'semantic',
  overlapRatio: 0.1,
  compressionLevel: 'light'
}

// ============================================================================
// Token Counting Utilities
// ============================================================================

export class TokenCounter {
  // Approximate token counting (1 token ≈ 4 characters for English)
  // For production, integrate with tiktoken or model-specific tokenizers
  static count(text: string): number {
    // Basic approximation with adjustments for common patterns
    const baseCount = text.length / 4

    // Adjust for code (usually more tokens due to symbols)
    const codeMultiplier = text.includes('function') || text.includes('class') ? 1.2 : 1

    // Adjust for whitespace and formatting
    const whitespaceRatio = (text.match(/\s/g) || []).length / text.length
    const whitespaceMultiplier = 1 - (whitespaceRatio * 0.2)

    return Math.ceil(baseCount * codeMultiplier * whitespaceMultiplier)
  }

  static estimateTokens(segments: string[]): number {
    return segments.reduce((sum, segment) => sum + this.count(segment), 0)
  }

  static fitToLimit(text: string, maxTokens: number): string {
    const tokens = this.count(text)
    if (tokens <= maxTokens) return text

    // Binary search for the right cutoff point
    let left = 0
    let right = text.length
    let result = text

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const candidate = text.substring(0, mid)
      const candidateTokens = this.count(candidate)

      if (candidateTokens <= maxTokens) {
        result = candidate
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    // Try to cut at a sentence boundary if possible
    const lastPeriod = result.lastIndexOf('.')
    const lastNewline = result.lastIndexOf('\n')
    const cutPoint = Math.max(lastPeriod, lastNewline)

    if (cutPoint > result.length * 0.8) {
      return result.substring(0, cutPoint + 1)
    }

    return result + '...'
  }
}

// ============================================================================
// Content Prioritization
// ============================================================================

export class ContentPrioritizer {
  static scoreByRelevance(content: string, keywords: string[]): number {
    let score = 0
    const lowerContent = content.toLowerCase()

    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase()
      const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'g')
      const matches = lowerContent.match(regex)
      score += (matches?.length || 0) * 10

      // Bonus for exact case match
      if (content.includes(keyword)) {
        score += 5
      }
    })

    // Bonus for being at the beginning
    if (keywords.some(k => lowerContent.startsWith(k.toLowerCase()))) {
      score += 20
    }

    return score
  }

  static scoreByRecency(content: string, index: number, total: number): number
  static scoreByRecency(segments: Array<{ content: string; timestamp: number }>): number[]
  static scoreByRecency(
    contentOrSegments: string | Array<{ content: string; timestamp: number }>,
    index?: number,
    total?: number
  ): number | number[] {
    if (typeof contentOrSegments === 'string') {
      // Original implementation for single content
      return (index! / total!) * 100
    } else {
      // Array implementation for segments
      const now = Date.now()
      const segments = contentOrSegments
      return segments.map(seg => {
        const ageInHours = (now - seg.timestamp) / (1000 * 60 * 60)
        // Newer content gets higher score
        return Math.max(0, 100 - ageInHours * 2)
      })
    }
  }

  static scoreByImportance(content: string): number {
    let score = 0

    // Keywords that indicate importance
    const importantPatterns = [
      { pattern: /^#+ /gm, weight: 15 }, // Headings
      { pattern: /\*\*.*?\*\*/g, weight: 10 }, // Bold text
      { pattern: /TODO|FIXME|IMPORTANT|WARNING/gi, weight: 20 },
      { pattern: /function|class|interface|type/gi, weight: 15 },
      { pattern: /export|public/gi, weight: 12 },
      { pattern: /error|exception|critical/gi, weight: 18 }
    ]

    importantPatterns.forEach(({ pattern, weight }) => {
      const matches = content.match(pattern)
      score += (matches?.length || 0) * weight
    })

    return score
  }

  static hybridScore(
    content: string,
    index: number,
    total: number,
    keywords: string[]
  ): number {
    const relevance = this.scoreByRelevance(content, keywords) * 0.4
    const recency = this.scoreByRecency(content, index, total) * 0.2
    const importance = this.scoreByImportance(content) * 0.4

    return relevance + recency + importance
  }
}

// ============================================================================
// Content Chunking Strategies
// ============================================================================

export class ContentChunker {
  static chunkBySemantic(text: string, targetChunkSize: number): string[] {
    const chunks: string[] = []

    // Split by major boundaries first (double newlines, then single)
    const paragraphs = text.split(/\n\n+/)
    let currentChunk = ''

    for (const paragraph of paragraphs) {
      const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph

      if (TokenCounter.count(potentialChunk) <= targetChunkSize) {
        currentChunk = potentialChunk
      } else {
        if (currentChunk) {
          chunks.push(currentChunk)
        }

        // If paragraph is too large, split it further
        if (TokenCounter.count(paragraph) > targetChunkSize) {
          const subChunks = this.chunkByStructural(paragraph, targetChunkSize)
          chunks.push(...subChunks)
          currentChunk = ''
        } else {
          currentChunk = paragraph
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  static chunkByStructural(text: string, targetChunkSize: number): string[] {
    const chunks: string[] = []

    // Split by sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    let currentChunk = ''

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence

      if (TokenCounter.count(potentialChunk) <= targetChunkSize) {
        currentChunk = potentialChunk
      } else {
        if (currentChunk) {
          chunks.push(currentChunk)
        }
        currentChunk = sentence
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  static chunkByFixed(text: string, chunkSize: number): string[] {
    const chunks: string[] = []
    const words = text.split(/\s+/)

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '))
    }

    return chunks
  }

  static chunkByAdaptive(text: string, targetChunkSize: number): string[] {
    // Analyze content type and choose appropriate strategy
    const codeBlockCount = (text.match(/```/g) || []).length / 2
    const paragraphCount = text.split(/\n\n+/).length
    const listCount = (text.match(/^\s*[-*]\s/gm) || []).length

    // Choose strategy based on content type
    if (codeBlockCount > 2) {
      // Code-heavy content: chunk by code blocks
      return this.chunkByCodeBlocks(text, targetChunkSize)
    } else if (listCount > 10) {
      // List-heavy content: chunk by list items
      return this.chunkByLists(text, targetChunkSize)
    } else if (paragraphCount > 5) {
      // Paragraph-heavy: use semantic chunking
      return this.chunkBySemantic(text, targetChunkSize)
    } else {
      // Default to structural
      return this.chunkByStructural(text, targetChunkSize)
    }
  }

  private static chunkByCodeBlocks(text: string, targetChunkSize: number): string[] {
    const chunks: string[] = []
    const codeBlockRegex = /```[\s\S]*?```/g
    let lastIndex = 0
    let match

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      const beforeCode = text.substring(lastIndex, match.index)
      if (beforeCode.trim()) {
        chunks.push(...this.chunkBySemantic(beforeCode, targetChunkSize))
      }

      // Add code block as single chunk (or split if too large)
      const codeBlock = match[0]
      if (TokenCounter.count(codeBlock) <= targetChunkSize) {
        chunks.push(codeBlock)
      } else {
        // Split large code blocks at function boundaries if possible
        chunks.push(...this.splitLargeCodeBlock(codeBlock, targetChunkSize))
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    const remaining = text.substring(lastIndex)
    if (remaining.trim()) {
      chunks.push(...this.chunkBySemantic(remaining, targetChunkSize))
    }

    return chunks
  }

  private static chunkByLists(text: string, targetChunkSize: number): string[] {
    const chunks: string[] = []
    const lines = text.split('\n')
    let currentChunk: string[] = []
    let currentTokens = 0

    for (const line of lines) {
      const lineTokens = TokenCounter.count(line)

      if (currentTokens + lineTokens <= targetChunkSize) {
        currentChunk.push(line)
        currentTokens += lineTokens
      } else {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'))
        }
        currentChunk = [line]
        currentTokens = lineTokens
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'))
    }

    return chunks
  }

  private static splitLargeCodeBlock(codeBlock: string, targetChunkSize: number): string[] {
    // Try to split at function boundaries
    const functionRegex = /^(function|const|let|var|class|export)\s+\w+/gm
    const lines = codeBlock.split('\n')
    const chunks: string[] = []
    let currentChunk: string[] = []
    let currentTokens = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineTokens = TokenCounter.count(line)

      // Check if this is a function boundary
      const isFunctionStart = functionRegex.test(line)

      if (isFunctionStart && currentChunk.length > 0 && currentTokens + lineTokens > targetChunkSize) {
        // Start new chunk at function boundary
        chunks.push(currentChunk.join('\n'))
        currentChunk = [line]
        currentTokens = lineTokens
      } else if (currentTokens + lineTokens <= targetChunkSize) {
        currentChunk.push(line)
        currentTokens += lineTokens
      } else {
        // Forced split
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'))
        }
        currentChunk = [line]
        currentTokens = lineTokens
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'))
    }

    return chunks
  }

  static addOverlap(chunks: string[], overlapRatio: number): string[] {
    if (chunks.length <= 1 || overlapRatio <= 0) return chunks

    const overlappedChunks: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        overlappedChunks.push(chunks[i])
      } else {
        const prevChunk = chunks[i - 1]
        const prevWords = prevChunk.split(/\s+/)
        const overlapSize = Math.floor(prevWords.length * overlapRatio)
        const overlap = prevWords.slice(-overlapSize).join(' ')
        overlappedChunks.push(overlap + ' ' + chunks[i])
      }
    }

    return overlappedChunks
  }
}

// ============================================================================
// Main Context Optimizer Factory
// ============================================================================

export const createContextOptimizer = (config?: Partial<ContextConfig>): Optimizer => {
  const finalConfig = { ...defaultConfig, ...config }

  // Optimize context to fit within token limits
  const optimizeContext = (
    content: string,
    keywords: string[] = []
  ): E.Either<Error, ContextWindow[]> => {
    try {
      // Chunk the content
      const chunks = chunkContent(content)

      // Score and prioritize chunks
      const scoredChunks = scoreChunks(chunks, keywords)

      // Select chunks that fit within token limit
      const selectedChunks = selectChunks(scoredChunks, finalConfig.maxTokens)

      // Create context windows
      const windows = createContextWindows(selectedChunks)

      return E.right(windows)
    } catch (error) {
      return E.left(new Error(`Context optimization failed: ${error}`))
    }
  }

  // Chunk content based on strategy
  const chunkContent = (content: string): string[] => {
    const targetChunkSize = Math.floor(finalConfig.maxTokens / 4) // Target 1/4 of max for flexibility

    let chunks: string[]
    switch (finalConfig.chunkingStrategy) {
      case 'semantic':
        chunks = ContentChunker.chunkBySemantic(content, targetChunkSize)
        break
      case 'structural':
        chunks = ContentChunker.chunkByStructural(content, targetChunkSize)
        break
      case 'fixed':
        chunks = ContentChunker.chunkByFixed(content, 100) // 100 words per chunk
        break
      case 'adaptive':
        chunks = ContentChunker.chunkByAdaptive(content, targetChunkSize)
        break
      default:
        chunks = ContentChunker.chunkBySemantic(content, targetChunkSize)
    }

    // Add overlap if configured
    if (finalConfig.overlapRatio > 0) {
      chunks = ContentChunker.addOverlap(chunks, finalConfig.overlapRatio)
    }

    return chunks
  }

  // Score chunks based on priority strategy
  const scoreChunks = (chunks: string[], keywords: string[]): Array<{ chunk: string; score: number }> => {
    return chunks.map((chunk, index) => {
      let score: number

      switch (finalConfig.priorityStrategy) {
        case 'relevance':
          score = ContentPrioritizer.scoreByRelevance(chunk, keywords)
          break
        case 'recency':
          score = ContentPrioritizer.scoreByRecency(chunk, index, chunks.length)
          break
        case 'importance':
          score = ContentPrioritizer.scoreByImportance(chunk)
          break
        case 'hybrid':
          score = ContentPrioritizer.hybridScore(chunk, index, chunks.length, keywords)
          break
        default:
          score = 0
      }

      return { chunk, score }
    })
  }

  // Select chunks that fit within token limit
  const selectChunks = (
    scoredChunks: Array<{ chunk: string; score: number }>,
    maxTokens: number
  ): Array<{ chunk: string; score: number }> => {
    // Sort by score (highest first)
    const sorted = [...scoredChunks].sort((a, b) => b.score - a.score)

    const selected: Array<{ chunk: string; score: number }> = []
    let totalTokens = 0

    for (const item of sorted) {
      const chunkTokens = TokenCounter.count(item.chunk)

      if (totalTokens + chunkTokens <= maxTokens) {
        selected.push(item)
        totalTokens += chunkTokens
      } else if (selected.length === 0) {
        // If no chunks fit, at least include a truncated version of the best one
        const truncated = TokenCounter.fitToLimit(item.chunk, maxTokens)
        selected.push({ chunk: truncated, score: item.score })
        break
      }
    }

    // Re-sort selected chunks by original order for coherence
    return selected
  }

  // Create context windows with metadata
  const createContextWindows = (
    selectedChunks: Array<{ chunk: string; score: number }>
  ): ContextWindow[] => {
    return selectedChunks.map((item, index) => ({
      content: item.chunk,
      tokens: TokenCounter.count(item.chunk),
      priority: item.score,
      metadata: {
        source: `chunk_${index}`,
        relevanceScore: item.score,
        semanticDensity: calculateSemanticDensity(item.chunk),
        compressed: false,
        originalTokens: TokenCounter.count(item.chunk)
      }
    }))
  }

  // Calculate semantic density (information per token)
  const calculateSemanticDensity = (text: string): number => {
    const tokens = TokenCounter.count(text)
    const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size
    const sentences = (text.match(/[.!?]+/g) || []).length

    // Higher unique word ratio and sentence count = higher density
    const uniqueRatio = uniqueWords / Math.max(tokens, 1)
    const sentenceRatio = sentences / Math.max(tokens / 10, 1)

    return Number((uniqueRatio * 0.7 + sentenceRatio * 0.3).toFixed(2))
  }

  // Build optimized prompt
  const buildOptimizedPrompt = (
    original: string,
    windows: ContextWindow[]
  ): OptimizedPrompt => {
    const optimizedContent = windows.map(w => w.content).join('\n\n')
    const totalTokens = windows.reduce((sum, w) => sum + w.tokens, 0)
    const reduction = ((TokenCounter.count(original) - totalTokens) / TokenCounter.count(original)) * 100

    const strategy: OptimizationStrategy = {
      name: 'Context Optimization',
      techniques: [
        `${finalConfig.chunkingStrategy} chunking`,
        `${finalConfig.priorityStrategy} prioritization`,
        `${finalConfig.compressionLevel} compression`
      ],
      parameters: {
        maxTokens: finalConfig.maxTokens,
        overlapRatio: finalConfig.overlapRatio,
        chunksSelected: windows.length
      },
      confidence: Math.min(windows[0]?.priority / 100 || 0, 1)
    }

    return {
      originalPrompt: original,
      optimizedPrompt: optimizedContent,
      systemPrompt: 'You are working with context-optimized content. Key information has been prioritized.',
      userPrompt: optimizedContent,
      reasoningStructure: {
        sequences: [],
        branches: [],
        loops: [],
        dataFlow: [],
        complexity: {
          cognitive: 0,
          computational: 0,
          structural: 0,
          overall: 0
        }
      },
      optimizationStrategy: strategy,
      estimatedTokens: totalTokens,
      improvementScore: Math.max(reduction, 0),
      metadata: {
        optimizerId: 'context-optimizer',
        timestamp: Date.now(),
        duration: 0,
        cacheable: true,
        ttl: 7200000 // 2 hours
      }
    }
  }

  // Helper method for compression (exposed for testing)
  const compress = (text: string, level: string): string => {
    switch (level) {
      case 'none':
        return text
      case 'light':
        return text.replace(/\s+/g, ' ').trim()
      case 'moderate':
        return text.replace(/\s+/g, ' ')
          .replace(/\b(the|a|an|is|are|was|were|been|being|be)\b/gi, '')
          .trim()
      case 'aggressive':
        // Keep only key words
        const words = text.split(/\s+/)
        const important = words.filter((_, i) => i % 2 === 0 || words[i].length > 5)
        return important.join(' ')
      default:
        return text
    }
  }

  // Public API implementation
  const optimizer: Optimizer & { compress: typeof compress } = {
    name: 'Context Optimizer',
    compress, // Expose for testing

    optimize: (prompt: string, context?: any): E.Either<Error, OptimizedPrompt> => {
      const keywords = context?.keywords || []
      const windowsResult = optimizeContext(prompt, keywords)

      if (E.isLeft(windowsResult)) {
        return windowsResult
      }

      return E.right(buildOptimizedPrompt(prompt, windowsResult.right))
    },

    optimizeAsync: (prompt: string, context?: any): TE.TaskEither<Error, OptimizedPrompt> => {
      return TE.tryCatch(
        async () => {
          const startTime = Date.now()
          const result = optimizer.optimize(prompt, context)

          if (E.isLeft(result)) {
            throw result.left
          }

          const optimized = result.right
          optimized.metadata.duration = Date.now() - startTime

          return optimized
        },
        (error) => new Error(`Async context optimization failed: ${error}`)
      )
    },

    analyze: (prompt: string): E.Either<Error, PromptAnalysis> => {
      const tokens = TokenCounter.count(prompt)
      const chunks = chunkContent(prompt)

      const analysis: PromptAnalysis = {
        structure: {
          sequences: [],
          branches: [],
          loops: [],
          dataFlow: [],
          complexity: {
            cognitive: 3,
            computational: 3,
            structural: 3,
            overall: 3
          }
        },
        complexity: {
          cognitive: 3,
          computational: 3,
          structural: 3,
          overall: 3
        },
        tokenCount: tokens,
        estimatedCost: tokens * 0.0001,
        recommendedOptimizations: [
          'Apply context window optimization',
          'Use prioritization strategy',
          tokens > finalConfig.maxTokens ? 'Compress content' : 'Content fits in context'
        ],
        potentialIssues: tokens > finalConfig.maxTokens ? ['Content exceeds context window'] : [],
        improvementPotential: tokens > finalConfig.maxTokens ? 20 : 10
      }

      return E.right(analysis)
    },

    supports: (feature: string): boolean => {
      const supportedFeatures = [
        'context-optimization',
        'token-management',
        'context-compression',
        'semantic-chunking',
        'priority-scoring',
        'overlap-handling',
        'adaptive-chunking',
        'prioritization',
        'chunking',
        'compression'
      ]
      return supportedFeatures.includes(feature.toLowerCase())
    }
  }

  return optimizer
}

// Export ChunkingStrategy namespace for tests
export const ChunkingStrategy = {
  semantic: (text: string, maxChunkSize: number = 500) => ContentChunker.chunkBySemantic(text, maxChunkSize),
  fixed: (text: string, chunkSize: number = 100) => ContentChunker.chunkByFixed(text, chunkSize),
  structural: (text: string, maxChunkSize: number = 500) => ContentChunker.chunkByStructural(text, maxChunkSize),
  adaptive: (text: string, maxChunkSize: number = 500) => ContentChunker.chunkByAdaptive(text, maxChunkSize)
}

// Export default instance
export const contextOptimizer = createContextOptimizer()