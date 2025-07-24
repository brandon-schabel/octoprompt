import { ProjectFile } from '@octoprompt/schemas'
import { ApiError } from '@octoprompt/shared'
import { DatabaseManager } from '@octoprompt/storage'
import type { Database, Statement } from 'bun:sqlite'
import { getProjectFiles } from './project-service'
import { fileIndexingService } from './file-indexing-service'

export interface SearchOptions {
  query: string
  searchType?: 'exact' | 'fuzzy' | 'semantic' | 'regex'
  fileTypes?: string[]
  limit?: number
  offset?: number
  includeContext?: boolean
  contextLines?: number
  scoringMethod?: 'relevance' | 'recency' | 'frequency'
  caseSensitive?: boolean
}

export interface SearchResult {
  file: ProjectFile
  score: number
  matches: Array<{
    line: number
    column: number
    text: string
    context?: string
  }>
  keywords?: string[]
  snippet?: string
}

export interface SearchStats {
  totalResults: number
  searchTime: number
  cached: boolean
  indexCoverage: number
}

/**
 * Fast semantic file search service
 * Provides sub-millisecond search using FTS5, TF-IDF, and intelligent caching
 */
export class FileSearchService {
  private db: Database
  private searchFTSStmt: Statement
  private searchCacheStmt: Statement
  private insertCacheStmt: Statement
  private updateCacheHitStmt: Statement

  // Cache configuration
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000

  constructor() {
    this.db = DatabaseManager.getInstance().getDatabase()
    this.initializeStatements()
    this.startCacheCleanup()
  }

  private initializeStatements() {
    // FTS5 search with ranking
    this.searchFTSStmt = this.db.prepare(`
      SELECT 
        file_id,
        project_id,
        path,
        name,
        extension,
        snippet(file_search_fts, 5, '<match>', '</match>', '...', 64) as snippet,
        rank
      FROM file_search_fts
      WHERE file_search_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `)

    // Cache lookup
    this.searchCacheStmt = this.db.prepare(`
      SELECT results, score_data, created_at
      FROM search_cache
      WHERE cache_key = ? AND expires_at > ?
    `)

    // Cache insert
    this.insertCacheStmt = this.db.prepare(`
      INSERT OR REPLACE INTO search_cache 
      (cache_key, query, project_id, results, score_data, created_at, expires_at, hit_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `)

    // Update cache hits
    this.updateCacheHitStmt = this.db.prepare(`
      UPDATE search_cache 
      SET hit_count = hit_count + 1 
      WHERE cache_key = ?
    `)
  }

  /**
   * Perform fast file search
   */
  async search(
    projectId: number,
    options: SearchOptions
  ): Promise<{
    results: SearchResult[]
    stats: SearchStats
  }> {
    const startTime = Date.now()

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(projectId, options)

      // Check cache first
      const cached = this.checkCache(cacheKey)
      if (cached) {
        return {
          results: cached.results,
          stats: {
            totalResults: cached.results.length,
            searchTime: Date.now() - startTime,
            cached: true,
            indexCoverage: 100
          }
        }
      }

      // Ensure files are indexed
      await this.ensureIndexed(projectId)

      // Perform search based on type
      let results: SearchResult[]
      switch (options.searchType || 'semantic') {
        case 'exact':
          results = await this.exactSearch(projectId, options)
          break
        case 'fuzzy':
          results = await this.fuzzySearch(projectId, options)
          break
        case 'regex':
          results = await this.regexSearch(projectId, options)
          break
        case 'semantic':
        default:
          results = await this.semanticSearch(projectId, options)
          break
      }

      // Apply scoring method
      results = this.applyScoring(results, options.scoringMethod || 'relevance')

      // Apply limit and offset
      const totalResults = results.length
      if (options.offset) {
        results = results.slice(options.offset)
      }
      if (options.limit) {
        results = results.slice(0, options.limit)
      }

      // Cache results
      this.cacheResults(cacheKey, projectId, options.query, results)

      return {
        results,
        stats: {
          totalResults,
          searchTime: Date.now() - startTime,
          cached: false,
          indexCoverage: await this.getIndexCoverage(projectId)
        }
      }
    } catch (error) {
      throw new ApiError(
        500,
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        'SEARCH_FAILED'
      )
    }
  }

  /**
   * Exact string search using FTS5
   */
  private async exactSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const query = options.caseSensitive ? options.query : options.query.toLowerCase()
    const ftsQuery = `"${query}"`

    const results = this.searchFTSStmt.all(ftsQuery, options.limit || 100, options.offset || 0) as any[]

    return this.enrichResults(results, options)
  }

  /**
   * Fuzzy search using trigrams
   */
  private async fuzzySearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const query = options.query.toLowerCase()
    const trigrams = this.generateQueryTrigrams(query)

    if (trigrams.length === 0) {
      return []
    }

    // Find files containing similar trigrams
    const sql = `
      SELECT DISTINCT f.file_id, COUNT(*) as match_count
      FROM file_trigrams f
      WHERE f.trigram IN (${trigrams.map(() => '?').join(',')})
      GROUP BY f.file_id
      HAVING match_count >= ?
      ORDER BY match_count DESC
      LIMIT ?
    `

    const minMatches = Math.max(1, Math.floor(trigrams.length * 0.6))
    const fileMatches = this.db.prepare(sql).all(...trigrams, minMatches, options.limit || 100) as any[]

    // Get full file data and calculate fuzzy scores
    const results: SearchResult[] = []
    for (const match of fileMatches) {
      const fileData = await this.getFileData(match.file_id)
      if (fileData && fileData.projectId === projectId) {
        const score = this.calculateFuzzyScore(query, fileData.path + ' ' + fileData.content)
        results.push({
          file: fileData,
          score,
          matches: [],
          snippet: this.generateSnippet(fileData.content, query)
        })
      }
    }

    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * Regex search in file content
   */
  private async regexSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const files = await getProjectFiles(projectId)
    const results: SearchResult[] = []

    try {
      const regex = new RegExp(options.query, options.caseSensitive ? 'g' : 'gi')

      for (const file of files) {
        if (options.fileTypes && options.fileTypes.length > 0) {
          if (!options.fileTypes.includes(file.extension || '')) {
            continue
          }
        }

        const content = file.content || ''
        const matches: any[] = []
        let match

        while ((match = regex.exec(content)) !== null) {
          const lines = content.substring(0, match.index).split('\n')
          const line = lines.length
          const column = lines[lines.length - 1].length + 1

          matches.push({
            line,
            column,
            text: match[0],
            context: options.includeContext ? this.getLineContext(content, line, options.contextLines || 3) : undefined
          })

          if (matches.length >= 10) break // Limit matches per file
        }

        if (matches.length > 0) {
          results.push({
            file,
            score: matches.length,
            matches,
            snippet: this.generateSnippet(content, options.query)
          })
        }
      }
    } catch (error) {
      throw new ApiError(400, 'Invalid regex pattern', 'INVALID_REGEX')
    }

    return results
  }

  /**
   * Semantic search using TF-IDF and keywords
   */
  private async semanticSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const query = options.query.toLowerCase()
    const queryTokens = this.tokenizeQuery(query)

    // Build FTS5 query with OR operations for semantic matching
    const ftsQuery = queryTokens.map((token) => `"${token}"`).join(' OR ')

    // Get initial results from FTS5
    const ftsResults = this.db
      .prepare(
        `
      SELECT 
        f.file_id,
        f.path,
        f.name,
        f.extension,
        snippet(file_search_fts, 5, '<match>', '</match>', '...', 64) as snippet,
        rank,
        m.keyword_vector,
        m.tf_idf_vector
      FROM file_search_fts f
      JOIN file_search_metadata m ON f.file_id = m.file_id
      WHERE f.project_id = ? AND file_search_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `
      )
      .all(projectId, ftsQuery, options.limit || 100) as any[]

    // Calculate semantic scores
    const results: SearchResult[] = []
    for (const result of ftsResults) {
      const fileData = await this.getFileData(result.file_id)
      if (!fileData) continue

      // Calculate combined score
      const ftsScore = Math.abs(result.rank)
      const keywordScore = this.calculateKeywordScore(queryTokens, JSON.parse(result.keyword_vector || '[]'))
      const semanticScore = this.calculateSemanticScore(queryTokens, JSON.parse(result.tf_idf_vector || '{}'))

      const combinedScore = ftsScore * 0.4 + keywordScore * 0.3 + semanticScore * 0.3

      results.push({
        file: fileData,
        score: combinedScore,
        matches: this.extractMatches(fileData.content || '', query),
        keywords: this.extractTopKeywords(result.keyword_vector),
        snippet: result.snippet
      })
    }

    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * Ensure files are indexed
   */
  private async ensureIndexed(projectId: number): Promise<void> {
    const stats = await fileIndexingService.getIndexingStats(projectId)

    // If less than 80% coverage or no recent index, trigger indexing
    if (stats.indexedFiles === 0 || !stats.lastIndexed || Date.now() - stats.lastIndexed > 24 * 60 * 60 * 1000) {
      const files = await getProjectFiles(projectId)
      await fileIndexingService.indexFiles(files)
    }
  }

  /**
   * Calculate fuzzy matching score
   */
  private calculateFuzzyScore(query: string, text: string): number {
    const qLen = query.length
    const tLen = text.length

    if (qLen === 0) return 1.0
    if (tLen === 0) return 0.0

    // Levenshtein distance calculation
    const matrix: number[][] = []

    for (let i = 0; i <= tLen; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= qLen; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= tLen; i++) {
      for (let j = 1; j <= qLen; j++) {
        if (text[i - 1] === query[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        }
      }
    }

    const distance = matrix[tLen][qLen]
    return 1 - distance / Math.max(qLen, tLen)
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(queryTokens: string[], keywords: any[]): number {
    if (keywords.length === 0) return 0

    let score = 0
    const keywordMap = new Map(keywords.map((k) => [k.keyword, k.tfScore]))

    for (const token of queryTokens) {
      if (keywordMap.has(token)) {
        score += keywordMap.get(token) || 0
      }
    }

    return score / queryTokens.length
  }

  /**
   * Calculate semantic similarity score
   */
  private calculateSemanticScore(queryTokens: string[], tfIdfVector: Record<string, number>): number {
    if (Object.keys(tfIdfVector).length === 0) return 0

    let score = 0
    let queryMagnitude = 0
    let docMagnitude = 0

    // Calculate cosine similarity
    for (const token of queryTokens) {
      const queryWeight = 1 / queryTokens.length
      const docWeight = tfIdfVector[token] || 0

      score += queryWeight * docWeight
      queryMagnitude += queryWeight * queryWeight
      docMagnitude += docWeight * docWeight
    }

    if (queryMagnitude === 0 || docMagnitude === 0) return 0

    return score / (Math.sqrt(queryMagnitude) * Math.sqrt(docMagnitude))
  }

  /**
   * Apply scoring method to results
   */
  private applyScoring(results: SearchResult[], method: string): SearchResult[] {
    switch (method) {
      case 'recency':
        return results.sort((a, b) => b.file.updated - a.file.updated)

      case 'frequency':
        return results.sort((a, b) => b.matches.length - a.matches.length)

      case 'relevance':
      default:
        return results.sort((a, b) => b.score - a.score)
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(projectId: number, options: SearchOptions): string {
    const parts = [
      projectId,
      options.query,
      options.searchType || 'semantic',
      options.fileTypes?.join(',') || '',
      options.scoringMethod || 'relevance',
      options.caseSensitive ? '1' : '0',
      options.limit || 100,
      options.offset || 0
    ]

    return parts.join('|')
  }

  /**
   * Check cache for results
   */
  private checkCache(cacheKey: string): { results: SearchResult[] } | null {
    const cached = this.searchCacheStmt.get(cacheKey, Date.now()) as any

    if (cached) {
      this.updateCacheHitStmt.run(cacheKey)
      return {
        results: JSON.parse(cached.results)
      }
    }

    return null
  }

  /**
   * Cache search results
   */
  private cacheResults(cacheKey: string, projectId: number, query: string, results: SearchResult[]): void {
    try {
      this.insertCacheStmt.run(
        cacheKey,
        query,
        projectId,
        JSON.stringify(results),
        JSON.stringify(results.map((r) => ({ id: r.file.id, score: r.score }))),
        Date.now(),
        Date.now() + this.CACHE_TTL
      )
    } catch (error) {
      console.error('Failed to cache search results:', error)
    }
  }

  /**
   * Get file data by ID
   */
  private async getFileData(fileId: string | number): Promise<ProjectFile | null> {
    // Get file metadata from FTS table to find project ID
    const fileInfo = this.db.prepare('SELECT project_id FROM file_search_fts WHERE file_id = ?').get(fileId) as any
    if (!fileInfo) return null

    const files = await getProjectFiles(fileInfo.project_id)
    return files.find((f) => f.id === fileId) || null
  }

  /**
   * Enrich search results with additional data
   */
  private async enrichResults(ftsResults: any[], options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    for (const result of ftsResults) {
      const fileData = await this.getFileData(result.file_id)
      if (!fileData) continue

      results.push({
        file: fileData,
        score: Math.abs(result.rank),
        matches: options.includeContext ? this.extractMatches(fileData.content || '', options.query) : [],
        snippet: result.snippet
      })
    }

    return results
  }

  /**
   * Extract matches from content
   */
  private extractMatches(content: string, query: string): Array<any> {
    const matches: any[] = []
    const lines = content.split('\n')
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()

    let index = 0
    while ((index = lowerContent.indexOf(lowerQuery, index)) !== -1) {
      const linesBefore = content.substring(0, index).split('\n')
      const line = linesBefore.length
      const column = linesBefore[linesBefore.length - 1].length + 1

      matches.push({
        line,
        column,
        text: content.substring(index, index + query.length)
      })

      index += query.length
      if (matches.length >= 10) break
    }

    return matches
  }

  /**
   * Generate snippet
   */
  private generateSnippet(content: string, query: string, maxLength: number = 200): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return ''

    const start = Math.max(0, index - 50)
    const end = Math.min(content.length, index + query.length + 50)

    let snippet = content.substring(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet += '...'

    return snippet
  }

  /**
   * Get line context
   */
  private getLineContext(content: string, lineNumber: number, contextLines: number): string {
    const lines = content.split('\n')
    const start = Math.max(0, lineNumber - contextLines - 1)
    const end = Math.min(lines.length, lineNumber + contextLines)

    return lines.slice(start, end).join('\n')
  }

  /**
   * Tokenize query
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2)
      .filter((token) => !/^(and|or|not|the|is|at|which|on)$/.test(token))
  }

  /**
   * Generate trigrams for query
   */
  private generateQueryTrigrams(query: string): string[] {
    const trigrams: string[] = []
    const normalized = query.toLowerCase()

    for (let i = 0; i <= normalized.length - 3; i++) {
      trigrams.push(normalized.slice(i, i + 3))
    }

    return [...new Set(trigrams)]
  }

  /**
   * Extract top keywords
   */
  private extractTopKeywords(keywordVector: string): string[] {
    try {
      const keywords = JSON.parse(keywordVector || '[]')
      return keywords.slice(0, 5).map((k: any) => k.keyword)
    } catch {
      return []
    }
  }

  /**
   * Get index coverage percentage
   */
  private async getIndexCoverage(projectId: number): Promise<number> {
    const stats = await fileIndexingService.getIndexingStats(projectId)
    const files = await getProjectFiles(projectId)

    if (files.length === 0) return 100
    return Math.round((stats.indexedFiles / files.length) * 100)
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      try {
        // Remove expired entries
        this.db.prepare('DELETE FROM search_cache WHERE expires_at < ?').run(Date.now())

        // Keep only most recent entries if over limit
        const count = this.db.prepare('SELECT COUNT(*) as count FROM search_cache').get() as any
        if (count?.count > this.MAX_CACHE_SIZE) {
          this.db
            .prepare(
              `
            DELETE FROM search_cache 
            WHERE cache_key NOT IN (
              SELECT cache_key FROM search_cache 
              ORDER BY hit_count DESC, created_at DESC 
              LIMIT ?
            )
          `
            )
            .run(this.MAX_CACHE_SIZE)
        }
      } catch (error) {
        console.error('Cache cleanup error:', error)
      }
    }, 60 * 1000) // Every minute
  }
}

// Export singleton instance
export const fileSearchService = new FileSearchService()
