/**
 * Expected outputs and baselines for testing
 */

import type { OptimizedPrompt, PromptAnalysis, ComplexityScore } from '../../src/types'

// Expected improvement scores for different optimizers
export const EXPECTED_IMPROVEMENTS = {
  scot: {
    min: 10, // Minimum 10% improvement
    avg: 20, // Average 20% improvement
    max: 35 // Maximum 35% improvement
  },
  selfConsistency: {
    min: 15,
    avg: 25,
    max: 40
  },
  context: {
    min: 5,
    avg: 15,
    max: 25
  }
}

// Expected complexity scores for different prompt types
export const EXPECTED_COMPLEXITY: Record<string, Partial<ComplexityScore>> = {
  simple: {
    cognitive: 2,
    computational: 2,
    structural: 1,
    overall: 1.7
  },
  moderate: {
    cognitive: 5,
    computational: 5,
    structural: 4,
    overall: 4.7
  },
  complex: {
    cognitive: 8,
    computational: 8,
    structural: 7,
    overall: 7.7
  }
}

// Expected token counts for optimized prompts
export const EXPECTED_TOKENS = {
  simple: { min: 50, max: 200 },
  moderate: { min: 200, max: 500 },
  complex: { min: 500, max: 1500 }
}

// Validation functions for optimizer outputs
export const validators = {
  // Validate SCoT optimizer output
  validateSCoTOutput(output: OptimizedPrompt): boolean {
    // Check required structure elements
    if (!output.reasoningStructure) return false
    if (!output.reasoningStructure.sequences) return false
    if (!output.reasoningStructure.complexity) return false

    // Check prompt structure
    const hasSequenceSection = output.userPrompt.includes('SEQUENCE') || output.userPrompt.includes('STEP')
    const hasProblemSection = output.userPrompt.includes('PROBLEM')

    return hasSequenceSection && hasProblemSection
  },

  // Validate Self-Consistency output
  validateSelfConsistencyOutput(output: OptimizedPrompt): boolean {
    // Check for consistency markers
    const hasMultiplePerspectives = output.optimizationStrategy.techniques.includes('multi-sampling')
    const hasVoting = output.optimizationStrategy.techniques.includes('voting')

    return hasMultiplePerspectives && hasVoting
  },

  // Validate Context optimizer output
  validateContextOutput(output: OptimizedPrompt): boolean {
    // Check for context optimization
    const hasTokenReduction = output.estimatedTokens < 10000 // Should fit in context
    const hasCompression =
      output.optimizationStrategy.techniques.includes('compression') ||
      output.optimizationStrategy.techniques.includes('prioritization')

    return hasTokenReduction && hasCompression
  },

  // Validate improvement score
  validateImprovementScore(score: number, optimizer: string): boolean {
    const expected = EXPECTED_IMPROVEMENTS[optimizer as keyof typeof EXPECTED_IMPROVEMENTS]
    if (!expected) return false

    return score >= expected.min && score <= expected.max
  },

  // Validate token count
  validateTokenCount(tokens: number, promptType: 'simple' | 'moderate' | 'complex'): boolean {
    const expected = EXPECTED_TOKENS[promptType]
    return tokens >= expected.min && tokens <= expected.max
  }
}

// Sample optimized outputs for comparison
export const SAMPLE_OUTPUTS = {
  scot: {
    systemPrompt: 'You are an expert software developer who thinks in structured patterns.',
    userPromptPrefix: 'Solve this problem using structured thinking:\n\nPROBLEM:',
    requiredSections: ['SEQUENCE ANALYSIS', 'BRANCH CONDITIONS', 'ITERATION STRUCTURES'],
    optionalSections: ['DATA FLOW', 'EXAMPLES', 'PERFORMANCE REQUIREMENTS']
  },

  selfConsistency: {
    systemPrompt: 'You are tasked with providing consistent, well-reasoned solutions.',
    samplingInstructions: 'Consider multiple approaches and select the most consistent.',
    votingInstructions: 'Evaluate all solutions and determine the consensus.'
  },

  context: {
    systemPrompt: 'Focus on the most relevant information within the token limit.',
    compressionMarkers: ['[compressed]', '[truncated]', '[summarized]'],
    priorityMarkers: ['[high priority]', '[medium priority]', '[low priority]']
  }
}

// Test assertion helpers
export class OutputValidator {
  static assertOptimizedPrompt(output: any): asserts output is OptimizedPrompt {
    const required = [
      'originalPrompt',
      'optimizedPrompt',
      'systemPrompt',
      'userPrompt',
      'reasoningStructure',
      'optimizationStrategy',
      'estimatedTokens',
      'improvementScore',
      'metadata'
    ]

    for (const field of required) {
      if (!(field in output)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
  }

  static assertPromptAnalysis(analysis: any): asserts analysis is PromptAnalysis {
    const required = [
      'structure',
      'complexity',
      'tokenCount',
      'estimatedCost',
      'recommendedOptimizations',
      'potentialIssues',
      'improvementPotential'
    ]

    for (const field of required) {
      if (!(field in analysis)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
  }

  static assertComplexityScore(score: any): asserts score is ComplexityScore {
    const required = ['cognitive', 'computational', 'structural', 'overall']

    for (const field of required) {
      if (!(field in score)) {
        throw new Error(`Missing required field: ${field}`)
      }

      const value = score[field]
      if (typeof value !== 'number' || value < 0 || value > 10) {
        throw new Error(`Invalid ${field} score: ${value}`)
      }
    }
  }

  static assertImprovementInRange(score: number, optimizer: string, tolerance: number = 5): void {
    const expected = EXPECTED_IMPROVEMENTS[optimizer as keyof typeof EXPECTED_IMPROVEMENTS]
    if (!expected) {
      throw new Error(`Unknown optimizer: ${optimizer}`)
    }

    if (score < expected.min - tolerance) {
      throw new Error(`Improvement score ${score} below minimum ${expected.min}`)
    }

    if (score > expected.max + tolerance) {
      throw new Error(`Improvement score ${score} above maximum ${expected.max}`)
    }
  }
}

// Performance benchmarks
export const PERFORMANCE_BENCHMARKS = {
  optimizationTime: {
    simple: 100, // 100ms for simple prompts
    moderate: 500, // 500ms for moderate prompts
    complex: 2000 // 2s for complex prompts
  },

  memoryUsage: {
    maxHeapUsed: 100 * 1024 * 1024, // 100MB max heap
    maxRss: 200 * 1024 * 1024 // 200MB max RSS
  }
}

// Quality metrics for optimizer comparison
export interface QualityMetrics {
  clarity: number // 0-10: How clear is the optimized prompt
  specificity: number // 0-10: How specific are the instructions
  structure: number // 0-10: How well structured is the output
  completeness: number // 0-10: Does it cover all aspects
  consistency: number // 0-10: How consistent across runs
}

export function calculateQualityScore(metrics: QualityMetrics): number {
  const weights = {
    clarity: 0.25,
    specificity: 0.25,
    structure: 0.2,
    completeness: 0.2,
    consistency: 0.1
  }

  return Object.entries(metrics).reduce((score, [key, value]) => {
    return score + value * weights[key as keyof QualityMetrics]
  }, 0)
}
