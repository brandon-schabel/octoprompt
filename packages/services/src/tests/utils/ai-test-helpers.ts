import { LOCAL_MODEL_TEST_CONFIG } from '../local-model-test-config'

// Response validation helpers
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  metrics: {
    length: number
    tokenCount: number
    hasRequiredElements: boolean
    coherenceScore: number
  }
}

export function validateAIResponse(response: string, expectedElements: string[] = []): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for empty or invalid responses
  if (!response || response.trim().length === 0) {
    errors.push('Response is empty')
  }

  // Check for banned phrases that indicate failure
  const bannedPhrases = LOCAL_MODEL_TEST_CONFIG.quality.bannedPhrases
  for (const phrase of bannedPhrases) {
    if (response.includes(phrase)) {
      errors.push(`Response contains banned phrase: "${phrase}"`)
    }
  }

  // Check minimum length
  if (response.length < LOCAL_MODEL_TEST_CONFIG.quality.minSummaryLength) {
    errors.push(
      `Response too short: ${response.length} chars (min: ${LOCAL_MODEL_TEST_CONFIG.quality.minSummaryLength})`
    )
  }

  // Check maximum length
  if (response.length > LOCAL_MODEL_TEST_CONFIG.quality.maxSummaryLength) {
    warnings.push(
      `Response too long: ${response.length} chars (max: ${LOCAL_MODEL_TEST_CONFIG.quality.maxSummaryLength})`
    )
  }

  // Check for required elements
  const requiredElements =
    expectedElements.length > 0 ? expectedElements : LOCAL_MODEL_TEST_CONFIG.quality.requiredElements
  const hasRequiredElements = requiredElements.every((element) =>
    response.toUpperCase().includes(element.toUpperCase())
  )

  if (!hasRequiredElements) {
    const missing = requiredElements.filter((element) => !response.toUpperCase().includes(element.toUpperCase()))
    errors.push(`Missing required elements: ${missing.join(', ')}`)
  }

  // Calculate coherence score (simple heuristic)
  const coherenceScore = calculateCoherenceScore(response)
  if (coherenceScore < 0.5) {
    warnings.push(`Low coherence score: ${coherenceScore.toFixed(2)}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      length: response.length,
      tokenCount: estimateTokens(response),
      hasRequiredElements,
      coherenceScore
    }
  }
}

// Token counting utilities
export function estimateTokens(text: string): number {
  // Simple approximation: ~4 chars per token for English text
  // More accurate for code: ~3 chars per token
  const hasCode = /[{}\[\]();]/.test(text)
  const charsPerToken = hasCode ? 3 : 4
  return Math.ceil(text.length / charsPerToken)
}

export function calculateTokenEfficiency(input: string, output: string): number {
  const inputTokens = estimateTokens(input)
  const outputTokens = estimateTokens(output)
  const totalTokens = inputTokens + outputTokens

  // Efficiency = useful output / total tokens used
  // Assuming output is more valuable than input
  return outputTokens / totalTokens
}

// Summary quality metrics
export interface SummaryQualityMetrics {
  structure: {
    hasPurpose: boolean
    hasType: boolean
    hasExports: boolean
    hasImports: boolean
  }
  content: {
    lengthScore: number // 0-1, optimal length
    detailScore: number // 0-1, level of detail
    relevanceScore: number // 0-1, relevance to source
  }
  technical: {
    accuracyScore: number // 0-1, technical accuracy
    completenessScore: number // 0-1, coverage of source
  }
  overall: number // 0-1, weighted average
}

export function analyzeSummaryQuality(summary: string, sourceCode: string): SummaryQualityMetrics {
  // Check structural elements
  const structure = {
    hasPurpose: /PURPOSE:/i.test(summary),
    hasType: /TYPE:/i.test(summary),
    hasExports: /EXPORT/i.test(summary) || /export/i.test(summary),
    hasImports: /IMPORT/i.test(summary) || /import/i.test(summary)
  }

  // Calculate content scores
  const lengthScore = calculateLengthScore(summary.length)
  const detailScore = calculateDetailScore(summary)
  const relevanceScore = calculateRelevanceScore(summary, sourceCode)

  // Calculate technical scores
  const accuracyScore = calculateAccuracyScore(summary, sourceCode)
  const completenessScore = calculateCompletenessScore(summary, sourceCode)

  // Calculate overall score (weighted average)
  const structureScore = Object.values(structure).filter(Boolean).length / 4
  const contentScore = (lengthScore + detailScore + relevanceScore) / 3
  const technicalScore = (accuracyScore + completenessScore) / 2

  const overall = structureScore * 0.3 + contentScore * 0.4 + technicalScore * 0.3

  return {
    structure,
    content: {
      lengthScore,
      detailScore,
      relevanceScore
    },
    technical: {
      accuracyScore,
      completenessScore
    },
    overall
  }
}

// Performance tracking helpers
export interface PerformanceMetrics {
  responseTime: number
  tokensPerSecond: number
  totalTokensUsed: number
  memoryUsed?: number
  cacheHit: boolean
}

export class PerformanceTracker {
  private startTime: number = 0
  private endTime: number = 0
  private startMemory?: number
  private endMemory?: number

  start() {
    this.startTime = Date.now()
    if (typeof process !== 'undefined') {
      this.startMemory = process.memoryUsage().heapUsed
    }
  }

  end() {
    this.endTime = Date.now()
    if (typeof process !== 'undefined') {
      this.endMemory = process.memoryUsage().heapUsed
    }
  }

  getMetrics(tokensUsed: number, cacheHit: boolean = false): PerformanceMetrics {
    const responseTime = this.endTime - this.startTime
    const tokensPerSecond = (tokensUsed / responseTime) * 1000

    return {
      responseTime,
      tokensPerSecond,
      totalTokensUsed: tokensUsed,
      memoryUsed: this.endMemory && this.startMemory ? this.endMemory - this.startMemory : undefined,
      cacheHit
    }
  }

  isWithinThreshold(threshold: number): boolean {
    return this.endTime - this.startTime <= threshold
  }
}

// Helper functions for quality scoring
function calculateCoherenceScore(text: string): number {
  // Simple coherence check based on sentence structure
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  if (sentences.length === 0) return 0

  let score = 1.0

  // Penalize very short sentences
  const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
  if (avgLength < 20) score *= 0.7

  // Check for repetition
  const uniqueSentences = new Set(sentences.map((s) => s.trim().toLowerCase()))
  const repetitionRatio = uniqueSentences.size / sentences.length
  score *= repetitionRatio

  // Check for structure words
  const structureWords = ['however', 'therefore', 'additionally', 'furthermore', 'specifically']
  const hasStructure = structureWords.some((word) => text.toLowerCase().includes(word))
  if (hasStructure) score *= 1.1

  return Math.min(1.0, score)
}

function calculateLengthScore(length: number): number {
  const min = LOCAL_MODEL_TEST_CONFIG.quality.minSummaryLength
  const max = LOCAL_MODEL_TEST_CONFIG.quality.maxSummaryLength
  const optimal = (min + max) / 2

  if (length < min) return length / min
  if (length > max) return Math.max(0.5, 1 - (length - max) / max)

  // Score based on distance from optimal
  const distance = Math.abs(length - optimal)
  const maxDistance = optimal - min
  return 1 - (distance / maxDistance) * 0.3
}

function calculateDetailScore(summary: string): number {
  let score = 0.5 // Base score

  // Check for specific details
  const detailIndicators = [
    /\d+/, // Contains numbers
    /"[^"]+"|'[^']+'/, // Contains quoted strings
    /\([^)]+\)/, // Contains parenthetical information
    /:\s*\w+/, // Contains type/value specifications
    /,\s*\w+/ // Contains lists
  ]

  detailIndicators.forEach((pattern) => {
    if (pattern.test(summary)) score += 0.1
  })

  return Math.min(1.0, score)
}

function calculateRelevanceScore(summary: string, sourceCode: string): number {
  // Extract key identifiers from source code
  const identifiers = sourceCode.match(/\b(class|function|const|export|import)\s+(\w+)/g) || []
  const uniqueIdentifiers = [
    ...new Set(
      identifiers.map((id) => {
        const match = id.match(/\w+$/)
        return match ? match[0].toLowerCase() : ''
      })
    )
  ].filter(Boolean)

  if (uniqueIdentifiers.length === 0) return 0.5

  // Check how many identifiers are mentioned in summary
  const summaryLower = summary.toLowerCase()
  const mentionedCount = uniqueIdentifiers.filter((id) => summaryLower.includes(id)).length

  return mentionedCount / uniqueIdentifiers.length
}

function calculateAccuracyScore(summary: string, sourceCode: string): number {
  // Check for hallucinations (mentions of things not in source)
  let score = 1.0

  // Common hallucination patterns
  const hallucinations = [
    { pattern: /database/i, penalty: 0.2 },
    { pattern: /API/i, penalty: 0.1 },
    { pattern: /server/i, penalty: 0.15 },
    { pattern: /authentication/i, penalty: 0.2 }
  ]

  hallucinations.forEach(({ pattern, penalty }) => {
    if (pattern.test(summary) && !pattern.test(sourceCode)) {
      score -= penalty
    }
  })

  return Math.max(0, score)
}

function calculateCompletenessScore(summary: string, sourceCode: string): number {
  // Check if major code elements are covered
  const codeElements = {
    hasClasses: /class\s+\w+/.test(sourceCode),
    hasFunctions: /function\s+\w+/.test(sourceCode),
    hasExports: /export\s+/.test(sourceCode),
    hasImports: /import\s+/.test(sourceCode),
    hasTypes: /type\s+\w+|interface\s+\w+/.test(sourceCode)
  }

  let coveredElements = 0
  let totalElements = 0

  Object.entries(codeElements).forEach(([key, exists]) => {
    if (exists) {
      totalElements++
      const elementName = key.replace('has', '').toLowerCase()
      if (summary.toLowerCase().includes(elementName)) {
        coveredElements++
      }
    }
  })

  return totalElements > 0 ? coveredElements / totalElements : 1.0
}

// Mock response generator for testing without LMStudio
export function generateMockSummary(sourceCode: string): string {
  const hasClass = /class\s+(\w+)/.test(sourceCode)
  const hasFunction = /function\s+(\w+)/.test(sourceCode)
  const hasExports = /export/.test(sourceCode)

  const fileType = hasClass ? 'class' : hasFunction ? 'utility' : 'module'

  return `PURPOSE: Mock summary for testing
TYPE: ${fileType}
${hasExports ? 'EXPORTS: Mock exports listed here' : ''}
This is a mock summary generated for testing purposes when LMStudio is not available.`
}

// Retry helper for flaky network requests
export async function retryWithBackoff<T>(fn: () => Promise<T>, options = LOCAL_MODEL_TEST_CONFIG.retry): Promise<T> {
  let lastError: Error | undefined
  let delay = options.initialDelay

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === options.maxAttempts) {
        throw error
      }

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))

      delay = Math.min(delay * options.backoffFactor, options.maxDelay)
    }
  }

  throw lastError || new Error('Retry failed')
}
