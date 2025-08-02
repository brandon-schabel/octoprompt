import { parserRegistry, ParserRegistry } from '@promptliano/storage'
import {
  type ParseFileRequest,
  type ParseResult,
  type FileType,
  type EditorType,
  type FileCacheEntry
} from '@promptliano/schemas'
import { ValidationError, ServiceError, NotFoundError } from '@promptliano/shared'
import * as fs from 'fs/promises'
import * as path from 'path'

// Simple in-memory cache for parsed files
class FileCache {
  private cache: Map<string, FileCacheEntry> = new Map()
  private DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  async get(filePath: string): Promise<FileCacheEntry | null> {
    const entry = this.cache.get(filePath)
    if (!entry) return null

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(filePath)
      return null
    }

    // Check if file has been modified
    try {
      const stats = await fs.stat(filePath)
      if (stats.mtime.getTime() > entry.stats.mtime) {
        this.cache.delete(filePath)
        return null
      }
    } catch {
      // File might have been deleted
      this.cache.delete(filePath)
      return null
    }

    return entry
  }

  set(filePath: string, content: string, parsedResult: ParseResult, stats: any, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.DEFAULT_TTL)

    this.cache.set(filePath, {
      filePath,
      content,
      parsedResult,
      stats: {
        size: stats.size,
        mtime: stats.mtime.getTime(),
        birthtime: stats.birthtime.getTime()
      },
      cachedAt: Date.now(),
      expiresAt
    })
  }

  clear(): void {
    this.cache.clear()
  }

  delete(filePath: string): void {
    this.cache.delete(filePath)
  }
}

// Parser service instance
class ParserService {
  private fileCache: FileCache = new FileCache()

  async parseFile(request: ParseFileRequest): Promise<ParseResult> {
    try {
      let content: string
      let filePath: string | undefined = request.filePath
      let stats: any

      // Get content either from file or request
      if (request.filePath) {
        // Check cache first if enabled
        if (request.options?.useCache !== false) {
          const cached = await this.fileCache.get(request.filePath)
          if (cached && cached.parsedResult) {
            return cached.parsedResult
          }
        }

        // Read from file
        content = await fs.readFile(request.filePath, 'utf-8')
        stats = await fs.stat(request.filePath)
      } else if (request.content) {
        content = request.content
      } else {
        throw new ValidationError('Either filePath or content must be provided', {
          field: 'request',
          reason: 'missing_required_field'
        })
      }

      // Determine file type and editor type
      let fileType: FileType | null = request.fileType || null
      let editorType: EditorType = request.editorType || 'generic'

      if (!fileType && filePath) {
        fileType = ParserRegistry.getFileType(filePath)
      }

      if (!fileType) {
        throw new ValidationError(
          'Could not determine file type. Please specify fileType parameter.',
          { field: 'fileType', filePath }
        )
      }

      // Infer editor type if not specified
      if (!request.editorType && filePath) {
        editorType = ParserRegistry.inferEditorType(filePath, content)
      }

      // Get parser
      const parser = parserRegistry.getParser(fileType, editorType)
      if (!parser) {
        throw new NotFoundError(
          'Parser',
          `${fileType}:${editorType}`
        )
      }

      // Parse content
      const result = await parser.parse(content, filePath)

      // Cache result if reading from file
      if (filePath && stats && request.options?.useCache !== false) {
        this.fileCache.set(filePath, content, result, stats)
      }

      return result
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) throw error

      throw new ServiceError(
        `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
        'PARSE_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async parseContent(
    content: string,
    fileType: FileType,
    editorType: EditorType = 'generic',
    options?: ParseFileRequest['options']
  ): Promise<ParseResult> {
    return this.parseFile({
      content,
      fileType,
      editorType,
      options
    })
  }

  clearCache(): void {
    this.fileCache.clear()
  }

  deleteFromCache(filePath: string): void {
    this.fileCache.delete(filePath)
  }

  getAvailableParsers() {
    return parserRegistry.getAllParsers()
  }

  getSupportedFileTypes(): FileType[] {
    const types = new Set<FileType>()
    const parsers = parserRegistry.getAllParsers()

    parsers.forEach((parser) => {
      types.add(parser.config.fileType)
    })

    return Array.from(types)
  }

  getSupportedEditorTypes(): EditorType[] {
    const types = new Set<EditorType>()
    const parsers = parserRegistry.getAllParsers()

    parsers.forEach((parser) => {
      types.add(parser.config.editorType)
    })

    return Array.from(types)
  }
}

// Export singleton instance
export const parserService = new ParserService()

// Export factory function for consistency
export function createParserService(): ParserService {
  return parserService
}
