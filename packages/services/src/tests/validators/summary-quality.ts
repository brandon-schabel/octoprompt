import type { ProjectFile } from '@promptliano/schemas'

export interface SummaryValidationResult {
  valid: boolean
  score: number // 0-100
  issues: SummaryIssue[]
  metrics: SummaryMetrics
  suggestions: string[]
}

export interface SummaryIssue {
  type: 'error' | 'warning'
  category: SummaryIssueCategory
  message: string
  severity: 1 | 2 | 3 // 1 = low, 2 = medium, 3 = high
}

export type SummaryIssueCategory = 
  | 'structure'
  | 'content'
  | 'accuracy'
  | 'completeness'
  | 'length'
  | 'format'
  | 'coherence'

export interface SummaryMetrics {
  structureScore: number      // 0-100
  contentScore: number        // 0-100
  accuracyScore: number      // 0-100
  completenessScore: number  // 0-100
  coherenceScore: number     // 0-100
  lengthScore: number        // 0-100
  tokenEfficiency: number    // 0-100
}

export class SummaryQualityValidator {
  private requiredElements = ['PURPOSE', 'TYPE']
  private optionalElements = ['EXPORTS', 'IMPORTS', 'DEPENDENCIES', 'NOTES']
  private bannedPhrases = ['...', 'undefined', 'null', '[object Object]', 'Lorem ipsum']
  
  /**
   * Validate a file summary against quality criteria
   */
  validateSummary(
    summary: string,
    file: ProjectFile,
    options: {
      strict?: boolean
      minLength?: number
      maxLength?: number
    } = {}
  ): SummaryValidationResult {
    const issues: SummaryIssue[] = []
    const suggestions: string[] = []
    
    // Set defaults
    const minLength = options.minLength || 50
    const maxLength = options.maxLength || 500
    const strict = options.strict || false
    
    // Calculate individual metrics
    const structureScore = this.evaluateStructure(summary, issues, strict)
    const contentScore = this.evaluateContent(summary, file, issues)
    const accuracyScore = this.evaluateAccuracy(summary, file, issues)
    const completenessScore = this.evaluateCompleteness(summary, file, issues)
    const coherenceScore = this.evaluateCoherence(summary, issues)
    const lengthScore = this.evaluateLength(summary, minLength, maxLength, issues)
    const tokenEfficiency = this.evaluateTokenEfficiency(summary, file.content || '')
    
    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      structureScore * 0.20 +
      contentScore * 0.20 +
      accuracyScore * 0.20 +
      completenessScore * 0.15 +
      coherenceScore * 0.15 +
      lengthScore * 0.05 +
      tokenEfficiency * 0.05
    )
    
    // Generate suggestions based on issues
    this.generateSuggestions(issues, suggestions)
    
    // Determine if valid (score > 60 and no critical errors)
    const hasCriticalError = issues.some(i => i.type === 'error' && i.severity === 3)
    const valid = overallScore >= 60 && !hasCriticalError
    
    return {
      valid,
      score: overallScore,
      issues,
      metrics: {
        structureScore,
        contentScore,
        accuracyScore,
        completenessScore,
        coherenceScore,
        lengthScore,
        tokenEfficiency
      },
      suggestions
    }
  }
  
  private evaluateStructure(summary: string, issues: SummaryIssue[], strict: boolean): number {
    let score = 100
    
    // Check required elements
    for (const element of this.requiredElements) {
      if (!summary.includes(`${element}:`)) {
        issues.push({
          type: 'error',
          category: 'structure',
          message: `Missing required element: ${element}`,
          severity: 3
        })
        score -= 25
      }
    }
    
    // Check optional elements in strict mode
    if (strict) {
      for (const element of this.optionalElements) {
        if (!summary.includes(`${element}:`)) {
          issues.push({
            type: 'warning',
            category: 'structure',
            message: `Missing optional element: ${element}`,
            severity: 1
          })
          score -= 5
        }
      }
    }
    
    // Check for proper formatting
    if (!summary.includes('\n') && summary.length > 100) {
      issues.push({
        type: 'warning',
        category: 'structure',
        message: 'Summary should use line breaks for better readability',
        severity: 1
      })
      score -= 10
    }
    
    return Math.max(0, score)
  }
  
  private evaluateContent(summary: string, file: ProjectFile, issues: SummaryIssue[]): number {
    let score = 100
    const content = file.content || ''
    
    // Check for banned phrases
    for (const phrase of this.bannedPhrases) {
      if (summary.includes(phrase)) {
        issues.push({
          type: 'error',
          category: 'content',
          message: `Summary contains invalid phrase: "${phrase}"`,
          severity: 2
        })
        score -= 20
      }
    }
    
    // Check if summary mentions file type correctly
    const fileExtension = file.extension?.toLowerCase()
    const fileTypeMap: Record<string, string[]> = {
      '.ts': ['typescript', 'ts'],
      '.tsx': ['typescript', 'tsx', 'react'],
      '.js': ['javascript', 'js'],
      '.jsx': ['javascript', 'jsx', 'react'],
      '.py': ['python', 'py'],
      '.rs': ['rust', 'rs'],
      '.go': ['go', 'golang']
    }
    
    if (fileExtension && fileTypeMap[fileExtension]) {
      const expectedTypes = fileTypeMap[fileExtension]
      const summaryLower = summary.toLowerCase()
      const hasCorrectType = expectedTypes.some(type => summaryLower.includes(type))
      
      if (!hasCorrectType) {
        issues.push({
          type: 'warning',
          category: 'content',
          message: `Summary doesn't mention correct file type for ${fileExtension}`,
          severity: 1
        })
        score -= 10
      }
    }
    
    // Check if key identifiers from code are mentioned
    const classMatches = content.match(/class\s+(\w+)/g) || []
    const functionMatches = content.match(/function\s+(\w+)/g) || []
    const exportMatches = content.match(/export\s+(class|function|const|interface|type)\s+(\w+)/g) || []
    
    const totalIdentifiers = classMatches.length + functionMatches.length + exportMatches.length
    if (totalIdentifiers > 0) {
      let mentionedCount = 0
      
      const allMatches = [...classMatches, ...functionMatches, ...exportMatches]
      allMatches.forEach(match => {
        const identifier = match.split(/\s+/).pop()
        if (identifier && summary.includes(identifier)) {
          mentionedCount++
        }
      })
      
      const mentionRatio = mentionedCount / totalIdentifiers
      if (mentionRatio < 0.3) {
        issues.push({
          type: 'warning',
          category: 'content',
          message: `Summary mentions only ${Math.round(mentionRatio * 100)}% of key identifiers`,
          severity: 2
        })
        score -= (1 - mentionRatio) * 30
      }
    }
    
    return Math.max(0, score)
  }
  
  private evaluateAccuracy(summary: string, file: ProjectFile, issues: SummaryIssue[]): number {
    let score = 100
    const content = file.content || ''
    
    // Check for hallucinations (common false claims)
    const hallucinations = [
      { pattern: /database\s+(connection|operations|queries)/i, context: 'database' },
      { pattern: /API\s+(endpoints|calls|requests)/i, context: 'API' },
      { pattern: /authentication|authorization/i, context: 'auth' },
      { pattern: /real-time|websocket/i, context: 'realtime' },
      { pattern: /machine learning|AI|neural/i, context: 'ML' }
    ]
    
    for (const { pattern, context } of hallucinations) {
      if (pattern.test(summary) && !pattern.test(content)) {
        issues.push({
          type: 'error',
          category: 'accuracy',
          message: `Summary incorrectly mentions ${context} concepts not present in code`,
          severity: 3
        })
        score -= 25
      }
    }
    
    // Check if mentioned exports actually exist
    const exportClaims = summary.match(/EXPORTS?:\s*([^\n]+)/i)
    if (exportClaims && exportClaims[1]) {
      const claimedExports = exportClaims[1].split(/[,;]/).map(e => e.trim())
      
      for (const claimed of claimedExports) {
        if (claimed && !content.includes(claimed)) {
          issues.push({
            type: 'error',
            category: 'accuracy',
            message: `Summary claims export "${claimed}" which doesn't exist`,
            severity: 2
          })
          score -= 15
        }
      }
    }
    
    return Math.max(0, score)
  }
  
  private evaluateCompleteness(summary: string, file: ProjectFile, issues: SummaryIssue[]): number {
    let score = 100
    const content = file.content || ''
    
    // Check if major code constructs are covered
    const hasClasses = /class\s+\w+/.test(content)
    const hasFunctions = /function\s+\w+/.test(content)
    const hasExports = /export\s+/.test(content)
    const hasImports = /import\s+/.test(content)
    const hasInterfaces = /interface\s+\w+/.test(content)
    const hasTypes = /type\s+\w+\s*=/.test(content)
    
    const summaryLower = summary.toLowerCase()
    
    if (hasClasses && !summaryLower.includes('class')) {
      issues.push({
        type: 'warning',
        category: 'completeness',
        message: 'Summary doesn\'t mention classes present in code',
        severity: 2
      })
      score -= 15
    }
    
    if (hasFunctions && !summaryLower.includes('function')) {
      issues.push({
        type: 'warning',
        category: 'completeness',
        message: 'Summary doesn\'t mention functions present in code',
        severity: 2
      })
      score -= 15
    }
    
    if (hasExports && !summaryLower.includes('export')) {
      issues.push({
        type: 'warning',
        category: 'completeness',
        message: 'Summary doesn\'t mention exports',
        severity: 2
      })
      score -= 10
    }
    
    if (hasImports && !summaryLower.includes('import') && !summaryLower.includes('depend')) {
      issues.push({
        type: 'warning',
        category: 'completeness',
        message: 'Summary doesn\'t mention dependencies/imports',
        severity: 1
      })
      score -= 10
    }
    
    if ((hasInterfaces || hasTypes) && !summaryLower.includes('type') && !summaryLower.includes('interface')) {
      issues.push({
        type: 'warning',
        category: 'completeness',
        message: 'Summary doesn\'t mention type definitions',
        severity: 1
      })
      score -= 10
    }
    
    return Math.max(0, score)
  }
  
  private evaluateCoherence(summary: string, issues: SummaryIssue[]): number {
    let score = 100
    
    // Check for incomplete sentences
    const sentences = summary.split(/[.!?]/).filter(s => s.trim().length > 0)
    const incompleteCount = sentences.filter(s => {
      const trimmed = s.trim()
      return trimmed.length < 10 || !trimmed.match(/^[A-Z]/)
    }).length
    
    if (incompleteCount > 0) {
      const ratio = incompleteCount / sentences.length
      issues.push({
        type: 'warning',
        category: 'coherence',
        message: `${Math.round(ratio * 100)}% of sentences appear incomplete or malformed`,
        severity: 1
      })
      score -= ratio * 30
    }
    
    // Check for repetition
    const words = summary.toLowerCase().split(/\s+/)
    const wordCounts = new Map<string, number>()
    
    words.forEach(word => {
      if (word.length > 4) { // Only check longer words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
      }
    })
    
    let repetitionCount = 0
    wordCounts.forEach((count, word) => {
      if (count > 3 && !['export', 'import', 'function', 'class', 'type'].includes(word)) {
        repetitionCount++
      }
    })
    
    if (repetitionCount > 2) {
      issues.push({
        type: 'warning',
        category: 'coherence',
        message: `Excessive repetition detected (${repetitionCount} words repeated 3+ times)`,
        severity: 1
      })
      score -= repetitionCount * 5
    }
    
    return Math.max(0, score)
  }
  
  private evaluateLength(
    summary: string,
    minLength: number,
    maxLength: number,
    issues: SummaryIssue[]
  ): number {
    const length = summary.length
    
    if (length < minLength) {
      issues.push({
        type: 'error',
        category: 'length',
        message: `Summary too short: ${length} chars (minimum: ${minLength})`,
        severity: 2
      })
      return Math.round((length / minLength) * 100)
    }
    
    if (length > maxLength * 2) {
      issues.push({
        type: 'error',
        category: 'length',
        message: `Summary excessively long: ${length} chars (maximum: ${maxLength})`,
        severity: 2
      })
      return 50
    }
    
    if (length > maxLength) {
      issues.push({
        type: 'warning',
        category: 'length',
        message: `Summary exceeds recommended length: ${length} chars (recommended: ${maxLength})`,
        severity: 1
      })
      return 100 - Math.round(((length - maxLength) / maxLength) * 30)
    }
    
    return 100
  }
  
  private evaluateTokenEfficiency(summary: string, sourceCode: string): number {
    // Estimate tokens (rough approximation)
    const summaryTokens = Math.ceil(summary.length / 4)
    const sourceTokens = Math.ceil(sourceCode.length / 4)
    
    if (sourceTokens === 0) return 100
    
    // Good efficiency: summary is 5-20% of source size
    const ratio = summaryTokens / sourceTokens
    
    if (ratio < 0.05) return 70 // Too brief
    if (ratio > 0.30) return 60 // Too verbose
    if (ratio >= 0.05 && ratio <= 0.20) return 100 // Optimal
    
    // Linear interpolation for in-between values
    return Math.round(100 - Math.abs(0.125 - ratio) * 200)
  }
  
  private generateSuggestions(issues: SummaryIssue[], suggestions: string[]): void {
    const categoryCounts = new Map<SummaryIssueCategory, number>()
    
    issues.forEach(issue => {
      categoryCounts.set(issue.category, (categoryCounts.get(issue.category) || 0) + 1)
    })
    
    if (categoryCounts.get('structure')! > 0) {
      suggestions.push('Ensure summary includes PURPOSE and TYPE sections')
    }
    
    if (categoryCounts.get('content')! > 0) {
      suggestions.push('Include more specific details about the code\'s functionality')
    }
    
    if (categoryCounts.get('accuracy')! > 0) {
      suggestions.push('Verify all claims in the summary match the actual code')
    }
    
    if (categoryCounts.get('completeness')! > 0) {
      suggestions.push('Cover all major code constructs (classes, functions, exports)')
    }
    
    if (categoryCounts.get('coherence')! > 0) {
      suggestions.push('Improve sentence structure and reduce repetition')
    }
    
    if (categoryCounts.get('length')! > 0) {
      suggestions.push('Adjust summary length to be between 50-500 characters')
    }
  }
}

// Export singleton instance
export const summaryValidator = new SummaryQualityValidator()

// Helper function for quick validation
export function validateSummary(
  summary: string,
  file: ProjectFile,
  options?: { strict?: boolean; minLength?: number; maxLength?: number }
): SummaryValidationResult {
  return summaryValidator.validateSummary(summary, file, options)
}