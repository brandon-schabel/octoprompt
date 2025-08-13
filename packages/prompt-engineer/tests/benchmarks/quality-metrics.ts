// ============================================================================
// Quality Metrics for Prompt Optimization
// ============================================================================

export interface QualityDimensions {
  clarity: number // 0-100: How clear and unambiguous
  completeness: number // 0-100: How complete the response
  accuracy: number // 0-100: How accurate/correct
  relevance: number // 0-100: How relevant to the task
  structure: number // 0-100: How well structured
  efficiency: number // 0-100: How efficient/concise
}

export interface ResponseEvaluation {
  overallQuality: number
  dimensions: QualityDimensions
  issues: string[]
  strengths: string[]
}

export class QualityMetrics {
  // Evaluate response quality
  evaluateResponse(originalPrompt: string, response: string, optimizationType: string): number {
    const evaluation = this.analyzeResponse(originalPrompt, response, optimizationType)
    return evaluation.overallQuality
  }

  // Comprehensive response analysis
  analyzeResponse(originalPrompt: string, response: string, optimizationType: string): ResponseEvaluation {
    const dimensions = this.evaluateDimensions(originalPrompt, response, optimizationType)
    const issues = this.identifyIssues(response)
    const strengths = this.identifyStrengths(response, optimizationType)

    // Calculate weighted overall quality
    const overallQuality = this.calculateOverallQuality(dimensions)

    return {
      overallQuality,
      dimensions,
      issues,
      strengths
    }
  }

  // Evaluate individual quality dimensions
  private evaluateDimensions(originalPrompt: string, response: string, optimizationType: string): QualityDimensions {
    return {
      clarity: this.evaluateClarity(response),
      completeness: this.evaluateCompleteness(originalPrompt, response),
      accuracy: this.evaluateAccuracy(response),
      relevance: this.evaluateRelevance(originalPrompt, response),
      structure: this.evaluateStructure(response, optimizationType),
      efficiency: this.evaluateEfficiency(response)
    }
  }

  // Evaluate clarity
  private evaluateClarity(response: string): number {
    let score = 100

    // Check for ambiguous language
    const ambiguousWords = ['maybe', 'possibly', 'might', 'could be', 'sometimes', 'it depends']
    ambiguousWords.forEach((word) => {
      if (response.toLowerCase().includes(word)) score -= 5
    })

    // Check for clear structure markers
    const structureMarkers = ['first', 'second', 'then', 'finally', 'step', 'specifically']
    structureMarkers.forEach((marker) => {
      if (response.toLowerCase().includes(marker)) score += 2
    })

    // Check sentence complexity
    const sentences = response.split(/[.!?]+/).filter((s) => s.trim())
    const avgLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length

    if (avgLength > 30) score -= 10 // Too complex
    if (avgLength < 5) score -= 5 // Too simple

    return Math.max(0, Math.min(100, score))
  }

  // Evaluate completeness
  private evaluateCompleteness(originalPrompt: string, response: string): number {
    let score = 70 // Base score

    // Extract key concepts from original prompt
    const keywords = this.extractKeywords(originalPrompt)

    // Check how many keywords are addressed in response
    let addressedCount = 0
    keywords.forEach((keyword) => {
      if (response.toLowerCase().includes(keyword.toLowerCase())) {
        addressedCount++
      }
    })

    const coverage = keywords.length > 0 ? (addressedCount / keywords.length) * 30 : 15
    score += coverage

    // Check for common completeness indicators
    if (response.includes('example') || response.includes('for instance')) score += 5
    if (response.includes('edge case') || response.includes('exception')) score += 5
    if (response.includes('error') || response.includes('handle')) score += 5

    // Penalize very short responses
    if (response.length < 50) score -= 20

    return Math.max(0, Math.min(100, score))
  }

  // Evaluate accuracy (heuristic based)
  private evaluateAccuracy(response: string): number {
    let score = 80 // Base score (assume generally accurate)

    // Check for contradiction indicators
    const contradictions = ['but not', 'however not', 'except when', 'unless']
    contradictions.forEach((phrase) => {
      if (response.toLowerCase().includes(phrase)) score -= 3
    })

    // Check for confidence indicators
    const confident = ['definitely', 'certainly', 'always', 'ensures', 'guarantees']
    confident.forEach((word) => {
      if (response.toLowerCase().includes(word)) score += 2
    })

    // Check for uncertainty
    const uncertain = ['might not', 'may not work', 'could fail', 'not sure']
    uncertain.forEach((phrase) => {
      if (response.toLowerCase().includes(phrase)) score -= 5
    })

    return Math.max(0, Math.min(100, score))
  }

  // Evaluate relevance
  private evaluateRelevance(originalPrompt: string, response: string): number {
    const promptWords = originalPrompt.toLowerCase().split(/\s+/)
    const responseWords = response.toLowerCase().split(/\s+/)

    // Calculate overlap
    const promptSet = new Set(promptWords)
    const responseSet = new Set(responseWords)
    const intersection = new Set([...promptSet].filter((w) => responseSet.has(w)))

    // Base relevance on overlap
    const overlapRatio = intersection.size / Math.max(promptSet.size, 1)
    let score = 50 + overlapRatio * 50

    // Check for domain-specific relevance
    if (originalPrompt.includes('algorithm') && response.includes('complexity')) score += 10
    if (originalPrompt.includes('api') && response.includes('endpoint')) score += 10
    if (originalPrompt.includes('database') && response.includes('query')) score += 10

    return Math.max(0, Math.min(100, score))
  }

  // Evaluate structure based on optimization type
  private evaluateStructure(response: string, optimizationType: string): number {
    let score = 60 // Base score

    // Check for structure based on optimization type
    switch (optimizationType.toLowerCase()) {
      case 'structured chain-of-thought':
      case 'scot':
        if (response.includes('STEP')) score += 15
        if (response.includes('SEQUENCE')) score += 10
        if (response.includes('BRANCH')) score += 10
        if (response.includes('LOOP')) score += 5
        break

      case 'self-consistency':
        if (response.includes('approach')) score += 10
        if (response.includes('alternative')) score += 10
        if (response.includes('consensus')) score += 10
        if (response.includes('confidence')) score += 10
        break

      case 'context':
      case 'context optimization':
        if (response.includes('priorit')) score += 10
        if (response.includes('chunk')) score += 10
        if (response.includes('compress')) score += 10
        if (response.includes('token')) score += 10
        break

      default:
        // General structure checks
        if (response.includes('\n')) score += 5
        if (response.includes('- ')) score += 5
        if (response.includes('1.') || response.includes('2.')) score += 10
    }

    // Check for logical flow
    const flowWords = ['first', 'then', 'next', 'finally', 'therefore', 'thus']
    flowWords.forEach((word) => {
      if (response.toLowerCase().includes(word)) score += 3
    })

    return Math.max(0, Math.min(100, score))
  }

  // Evaluate efficiency
  private evaluateEfficiency(response: string): number {
    let score = 100

    // Check for redundancy
    const sentences = response.split(/[.!?]+/).filter((s) => s.trim())
    const uniqueSentences = new Set(sentences.map((s) => s.trim().toLowerCase()))

    if (uniqueSentences.size < sentences.length) {
      score -= (sentences.length - uniqueSentences.size) * 10
    }

    // Check for verbosity
    const words = response.split(/\s+/)
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length

    if (avgWordLength > 8) score -= 10 // Too many complex words

    // Check for filler words
    const fillers = ['basically', 'actually', 'really', 'very', 'just', 'quite']
    fillers.forEach((filler) => {
      const count = (response.toLowerCase().match(new RegExp(`\\b${filler}\\b`, 'g')) || []).length
      score -= count * 2
    })

    // Reward conciseness
    if (response.length < 200 && sentences.length > 2) score += 10

    return Math.max(0, Math.min(100, score))
  }

  // Calculate weighted overall quality
  private calculateOverallQuality(dimensions: QualityDimensions): number {
    const weights = {
      clarity: 0.2,
      completeness: 0.25,
      accuracy: 0.2,
      relevance: 0.15,
      structure: 0.1,
      efficiency: 0.1
    }

    let weightedSum = 0
    for (const [dimension, weight] of Object.entries(weights)) {
      weightedSum += dimensions[dimension as keyof QualityDimensions] * weight
    }

    return Math.round(weightedSum)
  }

  // Identify issues in response
  private identifyIssues(response: string): string[] {
    const issues: string[] = []

    if (response.length < 50) issues.push('Response too short')
    if (response.length > 2000) issues.push('Response too verbose')

    if (!response.includes('.') && !response.includes('!') && !response.includes('?')) {
      issues.push('Missing punctuation')
    }

    if (response.toLowerCase().includes("i don't know")) {
      issues.push('Contains uncertainty')
    }

    if (response.split(/[.!?]+/).filter((s) => s.trim()).length < 2) {
      issues.push('Lacks detail')
    }

    const codeBlockCount = (response.match(/```/g) || []).length
    if (codeBlockCount % 2 !== 0) {
      issues.push('Unclosed code block')
    }

    return issues
  }

  // Identify strengths in response
  private identifyStrengths(response: string, optimizationType: string): string[] {
    const strengths: string[] = []

    if (response.includes('```')) strengths.push('Includes code examples')
    if (response.includes('1.') || response.includes('- ')) strengths.push('Well structured')
    if (response.includes('example') || response.includes('e.g.')) strengths.push('Provides examples')

    // Type-specific strengths
    if (optimizationType.includes('chain') && response.includes('STEP')) {
      strengths.push('Clear step-by-step breakdown')
    }

    if (optimizationType.includes('consistency') && response.includes('alternative')) {
      strengths.push('Multiple approaches considered')
    }

    if (response.includes('edge case') || response.includes('error handling')) {
      strengths.push('Considers edge cases')
    }

    if (response.includes('O(') || response.includes('complexity')) {
      strengths.push('Includes complexity analysis')
    }

    return strengths
  }

  // Extract keywords from prompt
  private extractKeywords(prompt: string): string[] {
    // Remove common words
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'shall',
      'need'
    ])

    const words = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))

    // Get unique important words
    const wordFreq = new Map<string, number>()
    words.forEach((word) => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    })

    // Sort by frequency and take top keywords
    const sorted = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)

    return sorted
  }

  // Compare two responses
  compareResponses(
    originalPrompt: string,
    baselineResponse: string,
    optimizedResponse: string,
    optimizationType: string
  ): {
    improvement: number
    betterDimensions: string[]
    worseDimensions: string[]
  } {
    const baselineEval = this.analyzeResponse(originalPrompt, baselineResponse, 'baseline')
    const optimizedEval = this.analyzeResponse(originalPrompt, optimizedResponse, optimizationType)

    const improvement = optimizedEval.overallQuality - baselineEval.overallQuality

    const betterDimensions: string[] = []
    const worseDimensions: string[] = []

    for (const [dimension, baselineScore] of Object.entries(baselineEval.dimensions)) {
      const optimizedScore = optimizedEval.dimensions[dimension as keyof QualityDimensions]

      if (optimizedScore > baselineScore + 5) {
        betterDimensions.push(dimension)
      } else if (optimizedScore < baselineScore - 5) {
        worseDimensions.push(dimension)
      }
    }

    return {
      improvement,
      betterDimensions,
      worseDimensions
    }
  }
}

// Export factory function
export function createQualityMetrics(): QualityMetrics {
  return new QualityMetrics()
}
