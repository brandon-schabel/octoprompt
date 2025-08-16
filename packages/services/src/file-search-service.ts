import type { ProjectFile, Ticket } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { DatabaseManager } from '@promptliano/storage'
import { ErrorFactory, withErrorContext } from './utils/error-factory'
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
  private searchCacheStmt!: Statement
  private insertCacheStmt!: Statement
  private updateCacheHitStmt!: Statement

  // Cache configuration
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000

  constructor() {
    this.db = DatabaseManager.getInstance().getDatabase()
    this.initializeStatements()
    this.startCacheCleanup()
  }

  private initializeStatements() {
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
      // Debug: Check if FTS5 tables have any data
      const ftsCount = this.db
        .prepare('SELECT COUNT(*) as count FROM file_search_fts WHERE project_id = ?')
        .get(projectId) as any
      console.log(`[FileSearchService] FTS5 table has ${ftsCount?.count || 0} entries for project ${projectId}`)
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
      throw ErrorFactory.operationFailed('file search', error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Search files based on ticket content
   */
  async searchByTicket(
    ticket: Ticket,
    options: Partial<SearchOptions> = {}
  ): Promise<{
    results: SearchResult[]
    stats: SearchStats
  }> {
    // Extract keywords from ticket
    const ticketText = `${ticket.title} ${ticket.overview || ''}`
    const keywords = this.extractQueryKeywords(ticketText)

    // Build search query from keywords
    const searchOptions: SearchOptions = {
      query: keywords.join(' '),
      searchType: options.searchType || 'semantic',
      fileTypes: options.fileTypes,
      limit: options.limit || 50,
      offset: options.offset || 0,
      includeContext: options.includeContext || false,
      contextLines: options.contextLines || 3,
      scoringMethod: options.scoringMethod || 'relevance',
      caseSensitive: options.caseSensitive || false
    }

    return this.search(ticket.projectId, searchOptions)
  }

  /**
   * Search files by keywords array
   */
  async searchByKeywords(
    projectId: number,
    keywords: string[],
    options: Partial<SearchOptions> = {}
  ): Promise<{
    results: SearchResult[]
    stats: SearchStats
  }> {
    const searchOptions: SearchOptions = {
      query: keywords.join(' '),
      searchType: options.searchType || 'semantic',
      fileTypes: options.fileTypes,
      limit: options.limit || 50,
      offset: options.offset || 0,
      includeContext: options.includeContext || false,
      contextLines: options.contextLines || 3,
      scoringMethod: options.scoringMethod || 'relevance',
      caseSensitive: options.caseSensitive || false
    }

    return this.search(projectId, searchOptions)
  }

  /**
   * Extract keywords from text for searching
   */
  private extractQueryKeywords(text: string): string[] {
    const tokens = this.tokenizeQuery(text)
    const wordFreq = new Map<string, number>()

    for (const token of tokens) {
      if (token.length < 3) continue
      wordFreq.set(token, (wordFreq.get(token) || 0) + 1)
    }

    // Sort by frequency and take top keywords
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word)
  }

  /**
   * Exact string search using FTS5
   */
  private async exactSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const query = options.caseSensitive ? options.query : options.query.toLowerCase()
    const ftsQuery = `"${query}"`

    // Use inline query since we need to filter by project_id through metadata table
    const results = this.db
      .prepare(
        `
      SELECT 
        f.file_id,
        f.project_id,
        f.path,
        f.name,
        f.extension,
        snippet(file_search_fts, 5, '<match>', '</match>', '...', 64) as snippet,
        rank
      FROM file_search_fts f
      JOIN file_search_metadata m ON f.file_id = m.file_id
      WHERE m.project_id = ? AND file_search_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `
      )
      .all(projectId, ftsQuery, options.limit || 100, options.offset || 0) as any[]

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
        const content = fileData.content || ''
        const searchText = `${fileData.path} ${content}`
        const score = this.calculateFuzzyScore(query, searchText)
        results.push({
          file: fileData,
          score,
          matches: [],
          snippet: this.generateSnippet(content, query)
        })
      }
    }
    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * Regex search in file content
   */
  private async regexSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    // Get files from FTS table instead of project service
    const ftsFiles = this.db
      .prepare(
        `
      SELECT file_id, project_id, path, name, extension, content
      FROM file_search_fts
      WHERE project_id = ?
    `
      )
      .all(projectId) as any[]

    if (!ftsFiles || ftsFiles.length === 0) {
      console.warn(`[FileSearchService] No files to search for project ${projectId}`)
      return []
    }

    const results: SearchResult[] = []

    let regex: RegExp
    try {
      regex = new RegExp(options.query, options.caseSensitive ? 'g' : 'gi')
    } catch (error) {
      console.error(`[FileSearchService] Invalid regex pattern: ${options.query}`, error)
      throw ErrorFactory.invalidParam('query', 'valid regex pattern', options.query)
    }

    try {
      for (const ftsFile of ftsFiles) {
        if (options.fileTypes && options.fileTypes.length > 0) {
          if (!options.fileTypes.includes(ftsFile.extension || '')) {
            continue
          }
        }

        const content = ftsFile.content || ''
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
          // Get full file data
          const fileData = await this.getFileData(ftsFile.file_id)
          if (fileData) {
            results.push({
              file: fileData,
              score: matches.length,
              matches,
              snippet: this.generateSnippet(content, options.query)
            })
          }
        }
      }
    } catch (error) {
      throw ErrorFactory.invalidParam('regex', 'valid regular expression', options.query)
    }
    return results
  }

  /**
   * Semantic search using TF-IDF and keywords
   */
  private async semanticSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const query = options.query.toLowerCase()
    const queryTokens = this.tokenizeQuery(query)

    console.log(`[FileSearchService] Semantic search: query="${query}", tokens=`, queryTokens)

    // Build FTS5 query with proper escaping and prefix matching
    const ftsQuery = queryTokens
      .map((token) => {
        // Remove special FTS5 characters completely
        const cleaned = token.replace(/[^\w\s-]/g, '').trim()
        // Skip empty tokens after cleaning
        if (!cleaned || cleaned.length < 2) return null
        // Use prefix matching for better results
        return `${cleaned}*`
      })
      .filter(Boolean)
      .join(' OR ')

    // Handle empty query after filtering
    if (!ftsQuery) {
      console.log(`[FileSearchService] Empty FTS5 query after escaping, returning no results`)
      return []
    }

    console.log(`[FileSearchService] FTS5 query: ${ftsQuery}`)

    // Debug: Test direct FTS5 matching without project filter
    const testMatch = this.db
      .prepare('SELECT COUNT(*) as count FROM file_search_fts WHERE file_search_fts MATCH ?')
      .get(ftsQuery) as any
    console.log(`[FileSearchService] Direct FTS5 match test (no project filter): ${testMatch?.count || 0} results`)

    // Get initial results from FTS5
    // Note: Cannot use UNINDEXED columns in WHERE clause with FTS5
    // Must join with metadata table for project filtering
    const ftsResults = this.db
      .prepare(
        `
      SELECT 
        f.file_id,
        f.project_id,
        f.path,
        f.name,
        f.extension,
        snippet(file_search_fts, 5, '<match>', '</match>', '...', 64) as snippet,
        rank,
        m.keyword_vector,
        m.tf_idf_vector
      FROM file_search_fts f
      JOIN file_search_metadata m ON f.file_id = m.file_id
      WHERE m.project_id = ? AND file_search_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `
      )
      .all(projectId, ftsQuery, options.limit || 100) as any[]

    console.log(`[FileSearchService] FTS5 returned ${ftsResults.length} results`)

    // Calculate semantic scores
    const results: SearchResult[] = []
    for (const result of ftsResults) {
      const fileData = await this.getFileData(result.file_id)
      if (!fileData) continue

      // Apply file type filter if specified
      if (options.fileTypes && options.fileTypes.length > 0) {
        if (!options.fileTypes.includes(fileData.extension || '')) {
          continue
        }
      }
      // Calculate combined score
      const ftsScore = Math.abs(result.rank)
      let keywordScore = 0
      let semanticScore = 0

      try {
        if (result.keyword_vector) {
          try {
            const keywords = JSON.parse(result.keyword_vector)
            if (Array.isArray(keywords)) {
              keywordScore = this.calculateKeywordScore(queryTokens, keywords)
            }
          } catch (parseError) {
            console.warn(`[FileSearchService] Invalid keyword_vector JSON for file ${result.file_id}:`, parseError)
          }
        }
        if (result.tf_idf_vector) {
          try {
            // tf_idf_vector is stored as BLOB, need to convert to string first
            const vectorStr =
              result.tf_idf_vector instanceof Uint8Array
                ? new TextDecoder().decode(result.tf_idf_vector)
                : result.tf_idf_vector
            const vector = JSON.parse(vectorStr)
            if (typeof vector === 'object' && vector !== null) {
              semanticScore = this.calculateSemanticScore(queryTokens, vector)
            }
          } catch (parseError) {
            console.warn(`[FileSearchService] Invalid tf_idf_vector JSON for file ${result.file_id}:`, parseError)
          }
        }
      } catch (error) {
        console.warn(`[FileSearchService] Unexpected error parsing vectors for file ${result.file_id}:`, error)
      }

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
    try {
      console.log(`[FileSearchService] Ensuring files are indexed for project ${projectId}`)

      // First get the actual files for the project
      const files = await getProjectFiles(projectId)

      if (!files || files.length === 0) {
        console.warn(`[FileSearchService] No files found for project ${projectId}`)
        return
      }

      const stats = await fileIndexingService.getIndexingStats(projectId)
      console.log(`[FileSearchService] Indexing stats:`, stats)
      console.log(`[FileSearchService] Total files in project: ${files.length}`)

      // Calculate actual coverage percentage
      const coveragePercentage = files.length > 0 ? (stats.indexedFiles / files.length) * 100 : 0
      console.log(`[FileSearchService] Index coverage: ${coveragePercentage.toFixed(1)}%`)

      // Check if we need to index: less than 80% coverage, no indexed files, or stale index (>24h)
      const needsIndexing =
        stats.indexedFiles === 0 ||
        coveragePercentage < 80 ||
        !stats.lastIndexed ||
        Date.now() - stats.lastIndexed > 24 * 60 * 60 * 1000

      if (needsIndexing) {
        console.log(`[FileSearchService] Project ${projectId} needs indexing. Reason:`)
        if (stats.indexedFiles === 0) console.log(`  - No files indexed`)
        if (coveragePercentage < 80) console.log(`  - Coverage below 80% (${coveragePercentage.toFixed(1)}%)`)
        if (!stats.lastIndexed) console.log(`  - Never indexed`)
        if (stats.lastIndexed && Date.now() - stats.lastIndexed > 24 * 60 * 60 * 1000) {
          console.log(`  - Index is stale (last indexed: ${new Date(stats.lastIndexed).toISOString()})`)
        }

        console.log(`[FileSearchService] Indexing ${files.length} files...`)
        const result = await fileIndexingService.indexFiles(files)
        console.log(`[FileSearchService] Indexing complete:`, result)
      } else {
        console.log(
          `[FileSearchService] Project ${projectId} already indexed (${stats.indexedFiles}/${files.length} files)`
        )
      }
    } catch (error) {
      console.error(`[FileSearchService] Error ensuring files indexed for project ${projectId}:`, error)
      // Don't throw, let search continue with potentially partial results
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
      matrix[0]![j] = j
    }

    for (let i = 1; i <= tLen; i++) {
      for (let j = 1; j <= qLen; j++) {
        if (text[i - 1] === query[j - 1]) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1 // deletion
          )
        }
      }
    }

    const distance = matrix[tLen]![qLen]!
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
    try {
      // First try to get from FTS table which has basic file info
      const ftsData = this.db
        .prepare(
          `
        SELECT file_id, project_id, path, name, extension, content
        FROM file_search_fts 
        WHERE file_id = ?
      `
        )
        .get(String(fileId)) as any

      if (!ftsData) {
        console.warn(`No file info found in FTS index for file ID: ${fileId}`)
        return null
      }

      // Try to get full file data from project files
      try {
        const files = await getProjectFiles(ftsData.project_id)
        if (files && files.length > 0) {
          const file = files.find((f) => String(f.id) === String(fileId))
          if (file) {
            return file
          }
        }
      } catch (error) {
        console.warn(`[FileSearchService] Error fetching project files for file ${fileId}:`, error)
      }

      // Fallback: construct basic ProjectFile from FTS data
      console.log(`[FileSearchService] Using FTS data for file ${fileId} (project files not available)`)
      const metadata = this.db
        .prepare(
          `
        SELECT file_size, created_at, updated_at 
        FROM file_search_metadata 
        WHERE file_id = ?
      `
        )
        .get(String(fileId)) as any

      return {
        id: ftsData.file_id,
        projectId: ftsData.project_id,
        path: ftsData.path,
        name: ftsData.name,
        extension: ftsData.extension,
        content: ftsData.content,
        size: metadata?.file_size || 0,
        created: metadata?.created_at || Date.now(),
        updated: metadata?.updated_at || Date.now(),
        summary: null,
        summaryLastUpdated: null,
        meta: null,
        checksum: null,
        imports: null,
        exports: null
      }
    } catch (error) {
      console.error(`Error getting file data for ID ${fileId}:`, error)
      return null
    }
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
      const column = (linesBefore[linesBefore.length - 1] || '').length + 1
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
    // First handle special patterns in code (e.g., camelCase, snake_case)
    let processed = query
    // Split camelCase
    processed = processed.replace(/([a-z])([A-Z])/g, '$1 $2')
    // Split snake_case and kebab-case
    processed = processed.replace(/[_-]/g, ' ')

    const tokens = processed
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1) // Allow 2-letter tokens
      .filter((token) => !/^(and|or|not|the|is|at|which|on|in|of|to|for|a|an)$/.test(token))

    // Also include original tokens in case they're important
    const originalTokens = query
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)

    // Combine and deduplicate
    return [...new Set([...tokens, ...originalTokens])]
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
  private extractTopKeywords(keywordVector: string | null | undefined): string[] {
    if (!keywordVector) return []

    try {
      const keywords = JSON.parse(keywordVector)
      if (Array.isArray(keywords)) {
        return keywords
          .slice(0, 5)
          .filter((k: any) => k && typeof k.keyword === 'string')
          .map((k: any) => k.keyword)
      }
      return []
    } catch (error) {
      console.warn('[FileSearchService] Error parsing keyword vector:', error)
      return []
    }
  }

  /**
   * Get index coverage percentage
   */
  private async getIndexCoverage(projectId: number): Promise<number> {
    try {
      const stats = await fileIndexingService.getIndexingStats(projectId)
      const files = await getProjectFiles(projectId)
      if (!files || files.length === 0) return 100
      return Math.round((stats.indexedFiles / files.length) * 100)
    } catch (error) {
      console.error(`[FileSearchService] Error calculating index coverage:`, error)
      return 0
    }
  }

  /**
   * Public diagnostic method to debug search issues
   */
  async debugSearch(
    projectId: number,
    query?: string
  ): Promise<{
    indexStats: any
    ftsContent: any
    sampleSearch?: any
    recommendations: string[]
  }> {
    const recommendations: string[] = []

    // Get index stats
    const indexStats = await fileIndexingService.getIndexingStats(projectId)

    // Get FTS5 content
    const ftsContent = await this.debugFTS5Contents(projectId)

    // Check for common issues
    if (indexStats.indexedFiles === 0) {
      recommendations.push('No files are indexed. Run file sync or force reindex.')
    }

    if (ftsContent.ftsCount === 0) {
      recommendations.push('FTS5 table is empty. Check if indexing is completing successfully.')
    }

    if (ftsContent.ftsCount !== ftsContent.metadataCount) {
      recommendations.push(`FTS5 and metadata table mismatch: ${ftsContent.ftsCount} vs ${ftsContent.metadataCount}`)
    }

    // Try a sample search if query provided
    let sampleSearch
    if (query) {
      try {
        sampleSearch = await this.search(projectId, { query, limit: 5 })
        if (sampleSearch.results.length === 0) {
          recommendations.push(`No results for query "${query}". Try simpler terms or check tokenization.`)
        }
      } catch (error) {
        sampleSearch = { error: error instanceof Error ? error.message : String(error) }
        recommendations.push(`Search failed: ${sampleSearch.error}`)
      }
    }

    return {
      indexStats,
      ftsContent,
      sampleSearch,
      recommendations
    }
  }

  /**
   * Private diagnostic method to inspect FTS5 table contents
   */
  private async debugFTS5Contents(projectId: number): Promise<{
    ftsCount: number
    metadataCount: number
    projectFTSCount: number
    sampleFTSRows: any[]
    sampleMetadataRows: any[]
  }> {
    const ftsCount = (this.db.prepare('SELECT COUNT(*) as count FROM file_search_fts').get() as any)?.count || 0
    const projectFTSCount =
      (this.db.prepare('SELECT COUNT(*) as count FROM file_search_fts WHERE project_id = ?').get(projectId) as any)
        ?.count || 0
    const metadataCount =
      (this.db.prepare('SELECT COUNT(*) as count FROM file_search_metadata WHERE project_id = ?').get(projectId) as any)
        ?.count || 0

    const sampleFTSRows = this.db
      .prepare('SELECT file_id, project_id, path, name FROM file_search_fts WHERE project_id = ? LIMIT 5')
      .all(projectId)
    const sampleMetadataRows = this.db
      .prepare('SELECT file_id, last_indexed, token_count FROM file_search_metadata WHERE project_id = ? LIMIT 5')
      .all(projectId)

    console.log('[FileSearchService] Debug FTS5 Contents:')
    console.log(`- Total FTS5 rows: ${ftsCount}`)
    console.log(`- Project ${projectId} FTS5 rows: ${projectFTSCount}`)
    console.log(`- Project ${projectId} metadata rows: ${metadataCount}`)
    console.log('- Sample FTS5 rows:', sampleFTSRows)
    console.log('- Sample metadata rows:', sampleMetadataRows)

    return {
      ftsCount,
      metadataCount,
      projectFTSCount,
      sampleFTSRows,
      sampleMetadataRows
    }
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
        if (count?.count && count.count > this.MAX_CACHE_SIZE) {
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
