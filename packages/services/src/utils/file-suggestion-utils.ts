import type { ProjectFile, RelevanceScore } from '@promptliano/schemas'
import { calculateTokenSavings } from './compact-file-formatter'

/**
 * Extract keywords from text, filtering out common stop words
 */
export function extractKeywords(
  text: string,
  options: {
    maxKeywords?: number
    minWordLength?: number
    customStopWords?: string[]
  } = {}
): string[] {
  const { maxKeywords = 20, minWordLength = 3, customStopWords = [] } = options

  const defaultStopWords = [
    'the',
    'is',
    'at',
    'which',
    'on',
    'and',
    'a',
    'an',
    'as',
    'are',
    'was',
    'were',
    'been',
    'be',
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
    'shall',
    'to',
    'of',
    'in',
    'for',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'that',
    'this',
    'these',
    'those',
    'it',
    'its',
    'they',
    'them',
    'their',
    'our',
    'your',
    'his',
    'her',
    'my',
    'we',
    'you',
    'he',
    'she',
    'who',
    'what',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'every',
    'some',
    'any',
    'many',
    'more',
    'most',
    'other',
    'such',
    'no',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'can',
    'just',
    'but',
    'or',
    'if',
    'because'
  ]

  const stopWords = new Set([...defaultStopWords, ...customStopWords])

  // Tokenize and clean text
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, ' ')
    .split(/\s+/)
    .filter(
      (word) => word.length >= minWordLength && !stopWords.has(word) && !word.match(/^\d+$/) // Filter out pure numbers
    )

  // Count word frequencies
  const wordFreq = new Map<string, number>()
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
  }

  // Sort by frequency and return top keywords
  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word)
}

/**
 * Calculate a simple relevance score between two texts
 */
export function calculateTextRelevance(text1: string, text2: string): number {
  const keywords1 = new Set(extractKeywords(text1, { maxKeywords: 30 }))
  const keywords2 = new Set(extractKeywords(text2, { maxKeywords: 30 }))

  if (keywords1.size === 0 || keywords2.size === 0) return 0

  // Calculate Jaccard similarity
  const intersection = new Set([...keywords1].filter((k) => keywords2.has(k)))
  const union = new Set([...keywords1, ...keywords2])

  return intersection.size / union.size
}

/**
 * Merge and deduplicate file suggestions from multiple sources
 */
export function mergeFileSuggestions(
  suggestions: Array<{
    fileIds: number[]
    scores?: RelevanceScore[]
    source: string
  }>
): {
  mergedFileIds: number[]
  mergedScores: Map<number, RelevanceScore>
} {
  const fileScoreMap = new Map<number, { score: RelevanceScore; sources: string[] }>()

  for (const suggestion of suggestions) {
    suggestion.fileIds.forEach((fileId, index) => {
      const existing = fileScoreMap.get(fileId)
      const score = suggestion.scores?.[index]

      if (existing) {
        // Average the scores if we have multiple
        if (score) {
          existing.score = {
            fileId,
            totalScore: (existing.score.totalScore + score.totalScore) / 2,
            keywordScore: (existing.score.keywordScore + score.keywordScore) / 2,
            pathScore: (existing.score.pathScore + score.pathScore) / 2,
            typeScore: (existing.score.typeScore + score.typeScore) / 2,
            recencyScore: (existing.score.recencyScore + score.recencyScore) / 2,
            importScore: (existing.score.importScore + score.importScore) / 2
          }
        }
        existing.sources.push(suggestion.source)
      } else if (score) {
        fileScoreMap.set(fileId, {
          score,
          sources: [suggestion.source]
        })
      } else {
        // Create default score if none provided
        fileScoreMap.set(fileId, {
          score: {
            fileId,
            totalScore: 0.5,
            keywordScore: 0,
            pathScore: 0,
            typeScore: 0,
            recencyScore: 0,
            importScore: 0
          },
          sources: [suggestion.source]
        })
      }
    })
  }

  // Sort by total score and number of sources
  const sortedEntries = Array.from(fileScoreMap.entries()).sort((a, b) => {
    const scoreA = a[1].score.totalScore + a[1].sources.length * 0.1
    const scoreB = b[1].score.totalScore + b[1].sources.length * 0.1
    return scoreB - scoreA
  })

  return {
    mergedFileIds: sortedEntries.map(([fileId]) => fileId),
    mergedScores: new Map(sortedEntries.map(([fileId, data]) => [fileId, data.score]))
  }
}

/**
 * Filter files by path patterns
 */
export function filterFilesByPattern(
  files: ProjectFile[],
  patterns: {
    include?: string[]
    exclude?: string[]
  }
): ProjectFile[] {
  let filtered = files

  // Apply include patterns
  if (patterns.include && patterns.include.length > 0) {
    filtered = filtered.filter((file) =>
      patterns.include!.some((pattern) => file.path.toLowerCase().includes(pattern.toLowerCase()))
    )
  }

  // Apply exclude patterns
  if (patterns.exclude && patterns.exclude.length > 0) {
    filtered = filtered.filter(
      (file) => !patterns.exclude!.some((pattern) => file.path.toLowerCase().includes(pattern.toLowerCase()))
    )
  }

  return filtered
}

/**
 * Group files by directory
 */
export function groupFilesByDirectory(files: ProjectFile[]): Map<string, ProjectFile[]> {
  const groups = new Map<string, ProjectFile[]>()

  for (const file of files) {
    const dir = file.path.substring(0, file.path.lastIndexOf('/')) || '/'
    if (!groups.has(dir)) {
      groups.set(dir, [])
    }
    groups.get(dir)!.push(file)
  }

  return groups
}

/**
 * Performance tracking for file suggestions
 */
export interface SuggestionMetrics {
  startTime: number
  endTime?: number
  filesAnalyzed: number
  totalFiles: number
  tokensUsed?: number
  tokensSaved?: number
  strategy: string
  cacheHit: boolean
}

export class SuggestionMetricsTracker {
  private metrics: Map<string, SuggestionMetrics> = new Map()

  startTracking(id: string, totalFiles: number, strategy: string): void {
    this.metrics.set(id, {
      startTime: Date.now(),
      filesAnalyzed: 0,
      totalFiles,
      strategy,
      cacheHit: false
    })
  }

  updateMetrics(id: string, updates: Partial<SuggestionMetrics>): void {
    const current = this.metrics.get(id)
    if (current) {
      this.metrics.set(id, { ...current, ...updates })
    }
  }

  finishTracking(id: string, filesAnalyzed: number, files: ProjectFile[]): SuggestionMetrics | undefined {
    const metrics = this.metrics.get(id)
    if (!metrics) return undefined

    const endTime = Date.now()
    const { savings: tokensSaved } = calculateTokenSavings(files)

    const finalMetrics: any = {
      ...metrics,
      endTime,
      filesAnalyzed,
      tokensSaved: tokensSaved ?? 0,
      duration: endTime - metrics.startTime
    }

    this.metrics.set(id, finalMetrics)
    return finalMetrics
  }

  getMetrics(id: string): SuggestionMetrics | undefined {
    return this.metrics.get(id)
  }

  clearMetrics(id: string): void {
    this.metrics.delete(id)
  }

  getAllMetrics(): Map<string, SuggestionMetrics> {
    return new Map(this.metrics)
  }

  getAverageMetrics(): {
    avgDuration: number
    avgFilesAnalyzed: number
    avgTokensSaved: number
    totalSuggestions: number
  } {
    const allMetrics = Array.from(this.metrics.values()).filter((m) => m.endTime !== undefined)

    if (allMetrics.length === 0) {
      return {
        avgDuration: 0,
        avgFilesAnalyzed: 0,
        avgTokensSaved: 0,
        totalSuggestions: 0
      }
    }

    const totalDuration = allMetrics.reduce((sum, m) => sum + (m.endTime! - m.startTime), 0)
    const totalFilesAnalyzed = allMetrics.reduce((sum, m) => sum + m.filesAnalyzed, 0)
    const totalTokensSaved = allMetrics.reduce((sum, m) => sum + (m.tokensSaved || 0), 0)

    return {
      avgDuration: totalDuration / allMetrics.length,
      avgFilesAnalyzed: totalFilesAnalyzed / allMetrics.length,
      avgTokensSaved: totalTokensSaved / allMetrics.length,
      totalSuggestions: allMetrics.length
    }
  }
}

// Export singleton instance
export const suggestionMetricsTracker = new SuggestionMetricsTracker()

/**
 * Get file type category based on extension and path
 */
export function getFileCategory(file: ProjectFile): string {
  const ext = file.extension?.toLowerCase() || ''
  const path = file.path.toLowerCase()

  // Check for specific file patterns
  if (path.includes('test.') || path.includes('.test.') || path.includes('spec.')) return 'test'
  if (path.includes('component')) return 'component'
  if (path.includes('service')) return 'service'
  if (path.includes('route') || path.includes('api')) return 'api'
  if (path.includes('hook')) return 'hook'
  if (path.includes('util') || path.includes('helper')) return 'utility'
  if (path.includes('schema') || path.includes('model')) return 'schema'
  if (path.includes('config')) return 'config'
  if (path.includes('style') || path.includes('.css') || path.includes('.scss')) return 'style'

  // Check by extension
  const extensionCategories: Record<string, string> = {
    ts: 'typescript',
    tsx: 'react',
    js: 'javascript',
    jsx: 'react',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    css: 'style',
    scss: 'style',
    json: 'config',
    md: 'docs',
    sql: 'database',
    yml: 'config',
    yaml: 'config'
  }

  return extensionCategories[ext] || 'other'
}
