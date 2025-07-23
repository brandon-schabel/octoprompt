import { ProjectFile } from '@octoprompt/schemas'
import { ApiError } from '@octoprompt/shared'
import { DatabaseManager } from '@octoprompt/storage'
import type { Database, Statement } from 'bun:sqlite'

/**
 * Service for indexing files for fast semantic search
 * Uses TF-IDF, keyword extraction, and FTS5 for sub-millisecond searches
 */
export class FileIndexingService {
  private db: Database
  private insertFTSStmt: Statement
  private insertMetadataStmt: Statement
  private insertKeywordStmt: Statement
  private insertTrigramStmt: Statement
  private updateFTSStmt: Statement
  
  // Common programming language keywords to filter out
  private readonly STOP_WORDS = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were',
    'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'for', 'with',
    'function', 'const', 'let', 'var', 'if', 'else', 'return', 'import', 'export',
    'class', 'interface', 'type', 'public', 'private', 'protected', 'static'
  ])

  constructor() {
    this.db = DatabaseManager.getInstance().getDatabase()
    this.initializeStatements()
  }

  private initializeStatements() {
    // Prepare statements for better performance
    this.insertFTSStmt = this.db.prepare(`
      INSERT INTO file_search_fts (file_id, project_id, path, name, extension, content, summary, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.updateFTSStmt = this.db.prepare(`
      UPDATE file_search_fts 
      SET content = ?, summary = ?, keywords = ?
      WHERE file_id = ?
    `)

    this.insertMetadataStmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_search_metadata 
      (file_id, project_id, tf_idf_vector, keyword_vector, last_indexed, file_size, token_count, language, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.insertKeywordStmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_keywords (file_id, keyword, frequency, tf_score, idf_score)
      VALUES (?, ?, ?, ?, ?)
    `)

    this.insertTrigramStmt = this.db.prepare(`
      INSERT OR IGNORE INTO file_trigrams (trigram, file_id, position)
      VALUES (?, ?, ?)
    `)
  }

  /**
   * Index a single file for search
   */
  async indexFile(file: ProjectFile, forceReindex = false): Promise<void> {
    try {
      // Check if already indexed and up to date
      if (!forceReindex) {
        const metadata = this.getFileMetadata(file.id)
        if (metadata && metadata.last_indexed >= file.updated) {
          return // Already indexed and current
        }
      }

      const content = file.content || ''
      const tokens = this.tokenize(content)
      const keywords = this.extractKeywords(tokens)
      const tfIdfVector = this.calculateTfIdf(tokens, keywords)
      const trigrams = this.generateTrigrams(file.path + ' ' + content)
      
      // Begin transaction for atomic updates
      this.db.transaction(() => {
        // Check if file exists in FTS
        const exists = this.db.prepare('SELECT 1 FROM file_search_fts WHERE file_id = ?').get(file.id)
        
        if (exists) {
          // Update existing entry
          this.updateFTSStmt.run(
            content,
            file.summary || '',
            keywords.map(k => k.keyword).join(' '),
            file.id
          )
        } else {
          // Insert new entry
          this.insertFTSStmt.run(
            file.id,
            file.projectId,
            file.path,
            file.name,
            file.extension || '',
            content,
            file.summary || '',
            keywords.map(k => k.keyword).join(' ')
          )
        }

        // Update metadata
        this.insertMetadataStmt.run(
          file.id,
          file.projectId,
          Buffer.from(JSON.stringify(tfIdfVector)),
          JSON.stringify(keywords.slice(0, 20)), // Top 20 keywords
          Date.now(),
          file.size || 0,
          tokens.length,
          this.detectLanguage(file.extension),
          file.created,
          file.updated
        )

        // Clear existing keywords and trigrams
        this.db.prepare('DELETE FROM file_keywords WHERE file_id = ?').run(file.id)
        this.db.prepare('DELETE FROM file_trigrams WHERE file_id = ?').run(file.id)

        // Insert keywords
        for (const kw of keywords) {
          this.insertKeywordStmt.run(
            file.id,
            kw.keyword,
            kw.frequency,
            kw.tfScore,
            kw.idfScore || 0
          )
        }

        // Insert trigrams
        for (const [trigram, position] of trigrams) {
          this.insertTrigramStmt.run(trigram, file.id, position)
        }
      })()

    } catch (error) {
      console.error(`Failed to index file ${file.id}:`, error)
      throw new ApiError(
        500,
        `Failed to index file: ${error instanceof Error ? error.message : String(error)}`,
        'FILE_INDEXING_FAILED'
      )
    }
  }

  /**
   * Index multiple files in batch for better performance
   */
  async indexFiles(files: ProjectFile[], forceReindex = false): Promise<{
    indexed: number
    skipped: number
    failed: number
  }> {
    let indexed = 0
    let skipped = 0
    let failed = 0

    // Process in batches of 100 for better performance
    const batchSize = 100
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      
      for (const file of batch) {
        try {
          const metadata = this.getFileMetadata(file.id)
          if (!forceReindex && metadata && metadata.last_indexed >= file.updated) {
            skipped++
            continue
          }

          await this.indexFile(file, forceReindex)
          indexed++
        } catch (error) {
          console.error(`Failed to index file ${file.id}:`, error)
          failed++
        }
      }
    }

    return { indexed, skipped, failed }
  }

  /**
   * Remove file from search indexes
   */
  async removeFileFromIndex(fileId: string | number): Promise<void> {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM file_search_fts WHERE file_id = ?').run(fileId)
      this.db.prepare('DELETE FROM file_search_metadata WHERE file_id = ?').run(fileId)
      this.db.prepare('DELETE FROM file_keywords WHERE file_id = ?').run(fileId)
      this.db.prepare('DELETE FROM file_trigrams WHERE file_id = ?').run(fileId)
    })()
  }

  /**
   * Tokenize content for indexing
   */
  private tokenize(content: string): string[] {
    // Split on word boundaries, keeping alphanumeric and some special chars
    const tokens = content
      .toLowerCase()
      .split(/[\s\n\r\t.,;:!?\(\)\[\]{}"'`<>\/\\|@#$%^&*+=~-]+/)
      .filter(token => token.length > 2 && token.length < 50)
      .filter(token => !this.STOP_WORDS.has(token))
    
    // Also split camelCase and snake_case
    const expandedTokens: string[] = []
    for (const token of tokens) {
      expandedTokens.push(token)
      
      // Split camelCase
      const camelParts = token.split(/(?=[A-Z])/).map(s => s.toLowerCase())
      if (camelParts.length > 1) {
        expandedTokens.push(...camelParts.filter(p => p.length > 2))
      }
      
      // Split snake_case
      const snakeParts = token.split('_').filter(p => p.length > 2)
      if (snakeParts.length > 1) {
        expandedTokens.push(...snakeParts)
      }
    }
    
    return expandedTokens
  }

  /**
   * Extract keywords with TF scores
   */
  private extractKeywords(tokens: string[]): Array<{
    keyword: string
    frequency: number
    tfScore: number
    idfScore?: number
  }> {
    const frequencies = new Map<string, number>()
    
    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) || 0) + 1)
    }
    
    const totalTokens = tokens.length
    const keywords = Array.from(frequencies.entries())
      .map(([keyword, frequency]) => ({
        keyword,
        frequency,
        tfScore: frequency / totalTokens
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 100) // Top 100 keywords
    
    return keywords
  }

  /**
   * Calculate TF-IDF vector
   */
  private calculateTfIdf(
    tokens: string[], 
    keywords: Array<{ keyword: string; frequency: number; tfScore: number }>
  ): Record<string, number> {
    const vector: Record<string, number> = {}
    
    // For now, just use TF scores
    // IDF calculation would require corpus statistics
    for (const kw of keywords) {
      vector[kw.keyword] = kw.tfScore
    }
    
    return vector
  }

  /**
   * Generate trigrams for fuzzy matching
   */
  private generateTrigrams(text: string): Array<[string, number]> {
    const trigrams: Array<[string, number]> = []
    const normalized = text.toLowerCase()
    
    for (let i = 0; i <= normalized.length - 3; i++) {
      const trigram = normalized.slice(i, i + 3)
      if (!/\s{2,}/.test(trigram)) { // Skip trigrams with multiple spaces
        trigrams.push([trigram, i])
      }
    }
    
    return trigrams
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(extension: string | undefined): string {
    if (!extension) return 'unknown'
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'ps1': 'powershell',
      'lua': 'lua',
      'dart': 'dart',
      'julia': 'julia',
      'ml': 'ocaml',
      'hs': 'haskell',
      'ex': 'elixir',
      'clj': 'clojure',
      'elm': 'elm',
      'vue': 'vue',
      'svelte': 'svelte'
    }
    
    return languageMap[extension.toLowerCase()] || 'text'
  }

  /**
   * Get file metadata
   */
  private getFileMetadata(fileId: string | number): {
    last_indexed: number
    token_count: number
    language: string
  } | null {
    const stmt = this.db.prepare(`
      SELECT last_indexed, token_count, language 
      FROM file_search_metadata 
      WHERE file_id = ?
    `)
    
    return stmt.get(fileId) as any
  }

  /**
   * Clear all search indexes for a project
   */
  async clearProjectIndex(projectId: number): Promise<void> {
    this.db.transaction(() => {
      // Get all file IDs for the project
      const fileIds = this.db.prepare(`
        SELECT file_id FROM file_search_metadata WHERE project_id = ?
      `).all(projectId).map((row: any) => row.file_id)
      
      // Delete from all tables
      for (const fileId of fileIds) {
        this.removeFileFromIndex(fileId)
      }
    })()
  }

  /**
   * Get indexing statistics for a project
   */
  async getIndexingStats(projectId: number): Promise<{
    totalFiles: number
    indexedFiles: number
    totalKeywords: number
    avgTokensPerFile: number
    lastIndexed: number | null
  }> {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as indexed_files,
        AVG(token_count) as avg_tokens,
        MAX(last_indexed) as last_indexed
      FROM file_search_metadata
      WHERE project_id = ?
    `).get(projectId) as any
    
    const keywordCount = this.db.prepare(`
      SELECT COUNT(DISTINCT keyword) as count
      FROM file_keywords k
      JOIN file_search_metadata m ON k.file_id = m.file_id
      WHERE m.project_id = ?
    `).get(projectId) as any
    
    return {
      totalFiles: 0, // Would need to query project files
      indexedFiles: stats?.indexed_files || 0,
      totalKeywords: keywordCount?.count || 0,
      avgTokensPerFile: Math.round(stats?.avg_tokens || 0),
      lastIndexed: stats?.last_indexed || null
    }
  }
}

// Export singleton instance
export const fileIndexingService = new FileIndexingService()