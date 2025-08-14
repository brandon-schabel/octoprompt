/**
 * Advanced Metrics for Prompt Optimization Benchmarking
 * Implements state-of-the-art metrics for code generation evaluation
 */

import { E, pipe } from '../../src/fp'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PassAtKResult {
  k: number
  n: number
  c: number
  passRate: number
  confidence: {
    lower: number
    upper: number
  }
  variance: number
}

export interface CodeBLEUScore {
  bleu: number
  astMatch: number
  dataflowMatch: number
  overall: number
  components: {
    ngram: number[]
    syntactic: number
    semantic: number
  }
}

export interface CyclomaticComplexity {
  complexity: number
  maintainabilityIndex: number
  cognitiveComplexity: number
  halsteadMetrics: {
    difficulty: number
    volume: number
    effort: number
    time: number
    bugs: number
  }
}

export interface SemanticSimilarity {
  score: number
  method: 'jaccard' | 'cosine' | 'embedding'
  confidence: number
}

export interface ChrFScore {
  precision: number
  recall: number
  fScore: number
  charNgrams: number[]
}

export interface EffectSize {
  cohensD: number
  interpretation: 'negligible' | 'small' | 'medium' | 'large'
  confidence: number
  powerAnalysis: {
    achievedPower: number
    requiredSampleSize: number
  }
}

// ============================================================================
// Pass@k Metric Implementation
// ============================================================================

export class PassAtKMetric {
  /**
   * Calculate pass@k metric with numerically stable computation
   * Based on the formula from "Evaluating Large Language Models Trained on Code"
   */
  static calculate(n: number, c: number, k: number): PassAtKResult {
    if (n < k) {
      throw new Error(`n (${n}) must be >= k (${k})`)
    }
    if (c > n) {
      throw new Error(`c (${c}) must be <= n (${n})`)
    }

    // Numerically stable computation using log space
    const passRate = 1.0 - this.combLog(n - c, k) / this.combLog(n, k)

    // Calculate confidence intervals using Wilson score interval
    const confidence = this.wilsonScoreInterval(c, n, 0.95)

    // Calculate variance for reliability
    const variance = this.calculateVariance(n, c, k)

    return {
      k,
      n,
      c,
      passRate: Math.round(passRate * 10000) / 10000,
      confidence,
      variance
    }
  }

  /**
   * Compute binomial coefficient in log space for numerical stability
   */
  private static combLog(n: number, k: number): number {
    if (k > n || k < 0) return -Infinity
    if (k === 0 || k === n) return 0

    k = Math.min(k, n - k) // Take advantage of symmetry

    let logSum = 0
    for (let i = 0; i < k; i++) {
      logSum += Math.log(n - i) - Math.log(i + 1)
    }

    return logSum
  }

  /**
   * Wilson score interval for confidence bounds
   */
  private static wilsonScoreInterval(
    successes: number,
    trials: number,
    confidence: number
  ): { lower: number; upper: number } {
    if (trials === 0) return { lower: 0, upper: 0 }

    const z = this.getZScore(confidence)
    const phat = successes / trials
    const denominator = 1 + (z * z) / trials

    const center = (phat + (z * z) / (2 * trials)) / denominator
    const spread = (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * trials)) / trials)) / denominator

    return {
      lower: Math.max(0, center - spread),
      upper: Math.min(1, center + spread)
    }
  }

  /**
   * Get Z-score for confidence level
   */
  private static getZScore(confidence: number): number {
    const zScores: Record<number, number> = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576
    }
    return zScores[confidence] || 1.96
  }

  /**
   * Calculate variance for pass@k
   */
  private static calculateVariance(n: number, c: number, k: number): number {
    const p = c / n
    const variance = (p * (1 - p)) / n
    return Math.round(variance * 10000) / 10000
  }

  /**
   * Generate multiple samples and calculate pass@k
   */
  static calculateFromSamples(results: boolean[], k: number): PassAtKResult {
    const n = results.length
    const c = results.filter((r) => r).length
    return this.calculate(n, c, k)
  }
}

// ============================================================================
// CodeBLEU Implementation
// ============================================================================

export class CodeBLEUMetric {
  /**
   * Calculate CodeBLEU score combining BLEU with AST and dataflow matching
   * Simplified implementation for TypeScript code
   */
  static calculate(
    reference: string,
    candidate: string,
    language: 'typescript' | 'javascript' = 'typescript'
  ): CodeBLEUScore {
    // Calculate n-gram BLEU
    const ngramScores = this.calculateNgramBLEU(reference, candidate)
    const bleuScore = this.geometricMean(ngramScores)

    // Calculate AST match (simplified - using token similarity)
    const astMatch = this.calculateASTMatch(reference, candidate)

    // Calculate dataflow match (simplified - using variable/function tracking)
    const dataflowMatch = this.calculateDataflowMatch(reference, candidate)

    // Combine scores with weights (BLEU: 0.25, AST: 0.25, Dataflow: 0.5)
    const overall = bleuScore * 0.25 + astMatch * 0.25 + dataflowMatch * 0.5

    return {
      bleu: bleuScore,
      astMatch,
      dataflowMatch,
      overall: Math.round(overall * 1000) / 1000,
      components: {
        ngram: ngramScores,
        syntactic: astMatch,
        semantic: dataflowMatch
      }
    }
  }

  /**
   * Calculate n-gram BLEU scores
   */
  private static calculateNgramBLEU(reference: string, candidate: string): number[] {
    const scores: number[] = []

    for (let n = 1; n <= 4; n++) {
      const refNgrams = this.getNgrams(reference, n)
      const candNgrams = this.getNgrams(candidate, n)

      let matches = 0
      const candNgramCounts = new Map<string, number>()

      // Count candidate n-grams
      candNgrams.forEach((ngram) => {
        candNgramCounts.set(ngram, (candNgramCounts.get(ngram) || 0) + 1)
      })

      // Count matches with clipping
      refNgrams.forEach((ngram) => {
        const count = candNgramCounts.get(ngram) || 0
        if (count > 0) {
          matches++
          candNgramCounts.set(ngram, count - 1)
        }
      })

      const precision = candNgrams.length > 0 ? matches / candNgrams.length : 0
      scores.push(precision)
    }

    return scores
  }

  /**
   * Extract n-grams from text
   */
  private static getNgrams(text: string, n: number): string[] {
    const tokens = text.toLowerCase().split(/\s+/)
    const ngrams: string[] = []

    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '))
    }

    return ngrams
  }

  /**
   * Calculate geometric mean
   */
  private static geometricMean(values: number[]): number {
    const product = values.reduce((acc, val) => acc * val, 1)
    return Math.pow(product, 1 / values.length)
  }

  /**
   * Simplified AST matching using structural patterns
   */
  private static calculateASTMatch(reference: string, candidate: string): number {
    const refPatterns = this.extractStructuralPatterns(reference)
    const candPatterns = this.extractStructuralPatterns(candidate)

    const intersection = new Set([...refPatterns].filter((x) => candPatterns.has(x)))
    const union = new Set([...refPatterns, ...candPatterns])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * Extract structural patterns from code
   */
  private static extractStructuralPatterns(code: string): Set<string> {
    const patterns = new Set<string>()

    // Function declarations
    const functions = code.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(/g) || []
    functions.forEach((f) => patterns.add('func'))

    // Control structures
    if (code.includes('if')) patterns.add('conditional')
    if (code.includes('for') || code.includes('while')) patterns.add('loop')
    if (code.includes('try')) patterns.add('error-handling')
    if (code.includes('return')) patterns.add('return')

    // Type patterns
    if (code.includes('interface') || code.includes('type')) patterns.add('types')
    if (code.includes('class')) patterns.add('class')
    if (code.includes('async') || code.includes('await')) patterns.add('async')

    return patterns
  }

  /**
   * Simplified dataflow matching
   */
  private static calculateDataflowMatch(reference: string, candidate: string): number {
    const refVars = this.extractVariables(reference)
    const candVars = this.extractVariables(candidate)

    const refFlow = this.extractDataflow(reference)
    const candFlow = this.extractDataflow(candidate)

    // Variable name similarity
    const varSimilarity = this.calculateSetSimilarity(refVars, candVars)

    // Flow pattern similarity
    const flowSimilarity = this.calculateSetSimilarity(refFlow, candFlow)

    return (varSimilarity + flowSimilarity) / 2
  }

  /**
   * Extract variable names
   */
  private static extractVariables(code: string): Set<string> {
    const vars = new Set<string>()
    const patterns = [
      /(?:const|let|var)\s+(\w+)/g,
      /function\s+(\w+)/g,
      /(\w+)\s*:/g // Object properties
    ]

    patterns.forEach((pattern) => {
      const matches = code.matchAll(pattern)
      for (const match of matches) {
        if (match[1] && !['function', 'const', 'let', 'var'].includes(match[1])) {
          vars.add(match[1])
        }
      }
    })

    return vars
  }

  /**
   * Extract dataflow patterns
   */
  private static extractDataflow(code: string): Set<string> {
    const flows = new Set<string>()

    // Assignment patterns
    if (code.match(/\w+\s*=\s*\w+/)) flows.add('assignment')
    if (code.match(/\w+\s*\+=|-=|\*=|\/=/)) flows.add('compound-assignment')

    // Function calls
    if (code.match(/\w+\s*\(/)) flows.add('function-call')
    if (code.match(/\.\w+\s*\(/)) flows.add('method-call')

    // Returns
    if (code.match(/return\s+\w+/)) flows.add('return-value')
    if (code.match(/throw\s+/)) flows.add('throw')

    return flows
  }

  /**
   * Calculate Jaccard similarity between sets
   */
  private static calculateSetSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter((x) => set2.has(x)))
    const union = new Set([...set1, ...set2])
    return union.size > 0 ? intersection.size / union.size : 0
  }
}

// ============================================================================
// Cyclomatic Complexity
// ============================================================================

export class ComplexityAnalyzer {
  /**
   * Calculate cyclomatic complexity and related metrics
   */
  static analyze(code: string): CyclomaticComplexity {
    const complexity = this.calculateCyclomaticComplexity(code)
    const cognitiveComplexity = this.calculateCognitiveComplexity(code)
    const halstead = this.calculateHalsteadMetrics(code)
    const maintainability = this.calculateMaintainabilityIndex(complexity, halstead.volume, code.split('\n').length)

    return {
      complexity,
      maintainabilityIndex: maintainability,
      cognitiveComplexity,
      halsteadMetrics: halstead
    }
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   */
  private static calculateCyclomaticComplexity(code: string): number {
    let complexity = 1 // Base complexity

    // Decision points
    const decisionPatterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*[^:]+:/g, // Ternary operators
      /&&/g,
      /\|\|/g
    ]

    decisionPatterns.forEach((pattern) => {
      const matches = code.match(pattern)
      if (matches) {
        complexity += matches.length
      }
    })

    return complexity
  }

  /**
   * Calculate cognitive complexity (simplified)
   */
  private static calculateCognitiveComplexity(code: string): number {
    let complexity = 0
    let nestingLevel = 0

    const lines = code.split('\n')

    lines.forEach((line) => {
      // Track nesting
      if (line.includes('{')) nestingLevel++
      if (line.includes('}')) nestingLevel = Math.max(0, nestingLevel - 1)

      // Add complexity for control structures with nesting penalty
      if (/\b(if|for|while|switch)\b/.test(line)) {
        complexity += 1 + nestingLevel
      }

      // Add for logical operators
      if (line.includes('&&') || line.includes('||')) {
        complexity += 1
      }

      // Add for early returns in nested contexts
      if (line.includes('return') && nestingLevel > 0) {
        complexity += 1
      }
    })

    return complexity
  }

  /**
   * Calculate Halstead metrics
   */
  private static calculateHalsteadMetrics(code: string): CyclomaticComplexity['halsteadMetrics'] {
    // Extract operators and operands (simplified)
    const operators = new Set<string>()
    const operands = new Set<string>()
    const operatorCount = new Map<string, number>()
    const operandCount = new Map<string, number>()

    // Common operators
    const operatorPatterns = [
      '+',
      '-',
      '*',
      '/',
      '%',
      '=',
      '==',
      '===',
      '!=',
      '!==',
      '<',
      '>',
      '<=',
      '>=',
      '&&',
      '||',
      '!',
      '++',
      '--',
      'if',
      'else',
      'for',
      'while',
      'return',
      'function',
      'const',
      'let',
      'var'
    ]

    operatorPatterns.forEach((op) => {
      const regex = new RegExp(op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const matches = code.match(regex)
      if (matches) {
        operators.add(op)
        operatorCount.set(op, matches.length)
      }
    })

    // Extract identifiers as operands (simplified)
    const identifiers = code.match(/\b[a-zA-Z_]\w*\b/g) || []
    identifiers.forEach((id) => {
      if (!operatorPatterns.includes(id)) {
        operands.add(id)
        operandCount.set(id, (operandCount.get(id) || 0) + 1)
      }
    })

    const n1 = operators.size // Unique operators
    const n2 = operands.size // Unique operands
    const N1 = Array.from(operatorCount.values()).reduce((a, b) => a + b, 0) // Total operators
    const N2 = Array.from(operandCount.values()).reduce((a, b) => a + b, 0) // Total operands

    const vocabulary = n1 + n2
    const length = N1 + N2
    const volume = length * Math.log2(vocabulary || 1)
    const difficulty = (n1 / 2) * (N2 / (n2 || 1))
    const effort = difficulty * volume
    const time = effort / 18 // Seconds to understand
    const bugs = volume / 3000 // Estimated bugs

    return {
      difficulty: Math.round(difficulty * 100) / 100,
      volume: Math.round(volume * 100) / 100,
      effort: Math.round(effort * 100) / 100,
      time: Math.round(time * 100) / 100,
      bugs: Math.round(bugs * 1000) / 1000
    }
  }

  /**
   * Calculate maintainability index
   */
  private static calculateMaintainabilityIndex(
    cyclomaticComplexity: number,
    halsteadVolume: number,
    linesOfCode: number
  ): number {
    // Microsoft's Maintainability Index formula
    const mi = Math.max(
      0,
      ((171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)) * 100) / 171
    )

    return Math.round(mi * 100) / 100
  }
}

// ============================================================================
// Semantic Similarity
// ============================================================================

export class SemanticSimilarityMetric {
  /**
   * Calculate semantic similarity between two code snippets
   */
  static calculate(
    reference: string,
    candidate: string,
    method: 'jaccard' | 'cosine' | 'embedding' = 'cosine'
  ): SemanticSimilarity {
    let score: number
    let confidence: number

    switch (method) {
      case 'jaccard':
        score = this.jaccardSimilarity(reference, candidate)
        confidence = 0.7 // Jaccard is less confident for semantic similarity
        break
      case 'cosine':
        score = this.cosineSimilarity(reference, candidate)
        confidence = 0.8
        break
      case 'embedding':
        score = this.embeddingSimilarity(reference, candidate)
        confidence = 0.9
        break
    }

    return {
      score: Math.round(score * 1000) / 1000,
      method,
      confidence
    }
  }

  /**
   * Jaccard similarity
   */
  private static jaccardSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/))
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)))
    const union = new Set([...tokens1, ...tokens2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * Cosine similarity using TF-IDF
   */
  private static cosineSimilarity(text1: string, text2: string): number {
    const tokens1 = text1.toLowerCase().split(/\s+/)
    const tokens2 = text2.toLowerCase().split(/\s+/)

    // Create vocabulary
    const vocabulary = new Set([...tokens1, ...tokens2])

    // Create vectors
    const vector1 = this.createVector(tokens1, vocabulary)
    const vector2 = this.createVector(tokens2, vocabulary)

    // Calculate cosine similarity
    const dotProduct = this.dotProduct(vector1, vector2)
    const magnitude1 = this.magnitude(vector1)
    const magnitude2 = this.magnitude(vector2)

    return magnitude1 * magnitude2 > 0 ? dotProduct / (magnitude1 * magnitude2) : 0
  }

  /**
   * Create TF vector
   */
  private static createVector(tokens: string[], vocabulary: Set<string>): number[] {
    const tokenCounts = new Map<string, number>()
    tokens.forEach((token) => {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1)
    })

    return Array.from(vocabulary).map((word) => tokenCounts.get(word) || 0)
  }

  /**
   * Calculate dot product
   */
  private static dotProduct(v1: number[], v2: number[]): number {
    return v1.reduce((sum, val, i) => sum + val * v2[i], 0)
  }

  /**
   * Calculate magnitude
   */
  private static magnitude(v: number[]): number {
    return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0))
  }

  /**
   * Simplified embedding similarity (using character n-grams as proxy)
   */
  private static embeddingSimilarity(text1: string, text2: string): number {
    // Use character trigrams as a simple embedding proxy
    const trigrams1 = this.getCharNgrams(text1, 3)
    const trigrams2 = this.getCharNgrams(text2, 3)

    return this.cosineSimilarityForSets(trigrams1, trigrams2)
  }

  /**
   * Get character n-grams
   */
  private static getCharNgrams(text: string, n: number): Map<string, number> {
    const ngrams = new Map<string, number>()
    const normalized = text.toLowerCase().replace(/\s+/g, ' ')

    for (let i = 0; i <= normalized.length - n; i++) {
      const ngram = normalized.slice(i, i + n)
      ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1)
    }

    return ngrams
  }

  /**
   * Cosine similarity for frequency maps
   */
  private static cosineSimilarityForSets(map1: Map<string, number>, map2: Map<string, number>): number {
    const keys = new Set([...map1.keys(), ...map2.keys()])

    let dotProduct = 0
    let magnitude1 = 0
    let magnitude2 = 0

    keys.forEach((key) => {
      const val1 = map1.get(key) || 0
      const val2 = map2.get(key) || 0
      dotProduct += val1 * val2
      magnitude1 += val1 * val1
      magnitude2 += val2 * val2
    })

    const denominator = Math.sqrt(magnitude1) * Math.sqrt(magnitude2)
    return denominator > 0 ? dotProduct / denominator : 0
  }
}

// ============================================================================
// ChrF Metric
// ============================================================================

export class ChrFMetric {
  /**
   * Calculate ChrF score (Character n-gram F-score)
   */
  static calculate(
    reference: string,
    candidate: string,
    ngramSizes: number[] = [1, 2, 3, 4, 5, 6],
    beta: number = 2
  ): ChrFScore {
    const scores: number[] = []
    let totalPrecision = 0
    let totalRecall = 0

    ngramSizes.forEach((n) => {
      const refNgrams = this.getCharNgrams(reference, n)
      const candNgrams = this.getCharNgrams(candidate, n)

      const { precision, recall } = this.calculatePrecisionRecall(refNgrams, candNgrams)

      scores.push(this.calculateFScore(precision, recall, beta))
      totalPrecision += precision
      totalRecall += recall
    })

    const avgPrecision = totalPrecision / ngramSizes.length
    const avgRecall = totalRecall / ngramSizes.length
    const avgFScore = this.calculateFScore(avgPrecision, avgRecall, beta)

    return {
      precision: Math.round(avgPrecision * 1000) / 1000,
      recall: Math.round(avgRecall * 1000) / 1000,
      fScore: Math.round(avgFScore * 1000) / 1000,
      charNgrams: scores.map((s) => Math.round(s * 1000) / 1000)
    }
  }

  /**
   * Get character n-grams
   */
  private static getCharNgrams(text: string, n: number): Map<string, number> {
    const ngrams = new Map<string, number>()
    const normalized = text.toLowerCase()

    for (let i = 0; i <= normalized.length - n; i++) {
      const ngram = normalized.slice(i, i + n)
      ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1)
    }

    return ngrams
  }

  /**
   * Calculate precision and recall
   */
  private static calculatePrecisionRecall(
    reference: Map<string, number>,
    candidate: Map<string, number>
  ): { precision: number; recall: number } {
    let matches = 0
    let totalRef = 0
    let totalCand = 0

    reference.forEach((count, ngram) => {
      totalRef += count
      const candCount = candidate.get(ngram) || 0
      matches += Math.min(count, candCount)
    })

    candidate.forEach((count) => {
      totalCand += count
    })

    const precision = totalCand > 0 ? matches / totalCand : 0
    const recall = totalRef > 0 ? matches / totalRef : 0

    return { precision, recall }
  }

  /**
   * Calculate F-score
   */
  private static calculateFScore(precision: number, recall: number, beta: number): number {
    if (precision + recall === 0) return 0
    const betaSquared = beta * beta
    return ((1 + betaSquared) * precision * recall) / (betaSquared * precision + recall)
  }
}

// ============================================================================
// Effect Size Calculations
// ============================================================================

export class EffectSizeCalculator {
  /**
   * Calculate Cohen's d effect size
   */
  static calculateCohensD(
    group1: number[],
    group2: number[],
    options: {
      corrected?: boolean
      confidence?: number
    } = {}
  ): EffectSize {
    const { corrected = true, confidence = 0.95 } = options

    const mean1 = this.mean(group1)
    const mean2 = this.mean(group2)
    const pooledSD = this.pooledStandardDeviation(group1, group2, corrected)

    const cohensD = pooledSD > 0 ? (mean2 - mean1) / pooledSD : 0

    // Interpret effect size
    const interpretation = this.interpretCohensD(Math.abs(cohensD))

    // Power analysis
    const powerAnalysis = this.powerAnalysis(cohensD, group1.length, group2.length)

    return {
      cohensD: Math.round(cohensD * 1000) / 1000,
      interpretation,
      confidence,
      powerAnalysis
    }
  }

  /**
   * Calculate mean
   */
  private static mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * Calculate pooled standard deviation
   */
  private static pooledStandardDeviation(group1: number[], group2: number[], corrected: boolean): number {
    const n1 = group1.length
    const n2 = group2.length

    const var1 = this.variance(group1)
    const var2 = this.variance(group2)

    let pooledVar: number
    if (corrected) {
      // Hedges' correction for small samples
      pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)
    } else {
      pooledVar = (var1 + var2) / 2
    }

    return Math.sqrt(pooledVar)
  }

  /**
   * Calculate variance
   */
  private static variance(values: number[]): number {
    const m = this.mean(values)
    const squaredDiffs = values.map((val) => Math.pow(val - m, 2))
    return this.mean(squaredDiffs)
  }

  /**
   * Interpret Cohen's d value
   */
  private static interpretCohensD(d: number): EffectSize['interpretation'] {
    if (d < 0.2) return 'negligible'
    if (d < 0.5) return 'small'
    if (d < 0.8) return 'medium'
    return 'large'
  }

  /**
   * Simple power analysis
   */
  private static powerAnalysis(effectSize: number, n1: number, n2: number): EffectSize['powerAnalysis'] {
    // Simplified power calculation
    const alpha = 0.05
    const df = n1 + n2 - 2
    const ncp = Math.abs(effectSize) * Math.sqrt((n1 * n2) / (n1 + n2))

    // Approximate power using normal distribution
    const z = 1.96 // Critical value for alpha = 0.05
    const power = 1 - this.normalCDF(z - ncp)

    // Calculate required sample size for 80% power
    const targetPower = 0.8
    const requiredNCP = 2.8 // Approximate for 80% power
    const requiredN = Math.ceil(2 * Math.pow(requiredNCP / Math.abs(effectSize), 2))

    return {
      achievedPower: Math.round(power * 1000) / 1000,
      requiredSampleSize: requiredN
    }
  }

  /**
   * Normal CDF approximation
   */
  private static normalCDF(x: number): number {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x < 0 ? -1 : 1
    x = Math.abs(x) / Math.sqrt(2.0)

    const t = 1.0 / (1.0 + p * x)
    const t2 = t * t
    const t3 = t2 * t
    const t4 = t3 * t
    const t5 = t4 * t

    const y = 1.0 - (a5 * t5 + a4 * t4 + a3 * t3 + a2 * t2 + a1 * t) * Math.exp(-x * x)

    return 0.5 * (1.0 + sign * y)
  }

  /**
   * Calculate Glass's delta (for unequal variances)
   */
  static calculateGlassDelta(control: number[], treatment: number[]): number {
    const meanControl = this.mean(control)
    const meanTreatment = this.mean(treatment)
    const sdControl = Math.sqrt(this.variance(control))

    return sdControl > 0 ? (meanTreatment - meanControl) / sdControl : 0
  }

  /**
   * Calculate Cliff's delta (non-parametric effect size)
   */
  static calculateCliffsDelta(group1: number[], group2: number[]): number {
    let dominance = 0

    for (const val1 of group1) {
      for (const val2 of group2) {
        if (val1 > val2) dominance++
        else if (val1 < val2) dominance--
      }
    }

    return dominance / (group1.length * group2.length)
  }
}

// ============================================================================
// Composite Metric Calculator
// ============================================================================

export class CompositeMetrics {
  /**
   * Calculate all metrics for comprehensive evaluation
   */
  static calculateAll(
    reference: string,
    candidates: string[],
    passResults?: boolean[]
  ): {
    passAtK?: PassAtKResult[]
    codeBLEU: CodeBLEUScore[]
    complexity: CyclomaticComplexity[]
    semanticSimilarity: SemanticSimilarity[]
    chrF: ChrFScore[]
    averageScores: {
      codeBLEU: number
      complexity: number
      similarity: number
      chrF: number
    }
  } {
    const codeBLEU = candidates.map((c) => CodeBLEUMetric.calculate(reference, c))
    const complexity = candidates.map((c) => ComplexityAnalyzer.analyze(c))
    const semanticSimilarity = candidates.map((c) => SemanticSimilarityMetric.calculate(reference, c))
    const chrF = candidates.map((c) => ChrFMetric.calculate(reference, c))

    // Calculate pass@k if results provided
    let passAtK: PassAtKResult[] | undefined
    if (passResults && passResults.length > 0) {
      passAtK = [1, 10, 100].map((k) => PassAtKMetric.calculateFromSamples(passResults, k))
    }

    // Calculate averages
    const averageScores = {
      codeBLEU: this.average(codeBLEU.map((s) => s.overall)),
      complexity: this.average(complexity.map((c) => c.maintainabilityIndex)),
      similarity: this.average(semanticSimilarity.map((s) => s.score)),
      chrF: this.average(chrF.map((c) => c.fScore))
    }

    return {
      passAtK,
      codeBLEU,
      complexity,
      semanticSimilarity,
      chrF,
      averageScores
    }
  }

  /**
   * Calculate average
   */
  private static average(values: number[]): number {
    if (values.length === 0) return 0
    const sum = values.reduce((a, b) => a + b, 0)
    return Math.round((sum / values.length) * 1000) / 1000
  }

  /**
   * Rank candidates by composite score
   */
  static rankCandidates(
    reference: string,
    candidates: string[],
    weights: {
      codeBLEU?: number
      complexity?: number
      similarity?: number
      chrF?: number
    } = {}
  ): Array<{ index: number; score: number; candidate: string }> {
    const defaultWeights = {
      codeBLEU: 0.3,
      complexity: 0.2,
      similarity: 0.25,
      chrF: 0.25
    }

    const finalWeights = { ...defaultWeights, ...weights }

    return candidates
      .map((candidate, index) => {
        const bleu = CodeBLEUMetric.calculate(reference, candidate).overall
        const comp = ComplexityAnalyzer.analyze(candidate).maintainabilityIndex / 100
        const sim = SemanticSimilarityMetric.calculate(reference, candidate).score
        const chrf = ChrFMetric.calculate(reference, candidate).fScore

        const score =
          bleu * finalWeights.codeBLEU +
          comp * finalWeights.complexity +
          sim * finalWeights.similarity +
          chrf * finalWeights.chrF

        return { index, score, candidate }
      })
      .sort((a, b) => b.score - a.score)
  }
}

// ============================================================================
// Export Utilities
// ============================================================================

export const AdvancedMetrics = {
  PassAtK: PassAtKMetric,
  CodeBLEU: CodeBLEUMetric,
  Complexity: ComplexityAnalyzer,
  Similarity: SemanticSimilarityMetric,
  ChrF: ChrFMetric,
  EffectSize: EffectSizeCalculator,
  Composite: CompositeMetrics
}

// Export factory functions for convenience
export function createMetricsCalculator() {
  return {
    passAtK: (n: number, c: number, k: number) => PassAtKMetric.calculate(n, c, k),
    codeBLEU: (ref: string, cand: string) => CodeBLEUMetric.calculate(ref, cand),
    complexity: (code: string) => ComplexityAnalyzer.analyze(code),
    similarity: (ref: string, cand: string) => SemanticSimilarityMetric.calculate(ref, cand),
    chrF: (ref: string, cand: string) => ChrFMetric.calculate(ref, cand),
    effectSize: (g1: number[], g2: number[]) => EffectSizeCalculator.calculateCohensD(g1, g2),
    composite: (ref: string, cands: string[]) => CompositeMetrics.calculateAll(ref, cands)
  }
}
