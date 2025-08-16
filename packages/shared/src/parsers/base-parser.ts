import { z } from 'zod'
import { ParseError } from '../error/domain-error'

export interface ParseResult<T = any> {
  frontmatter: T
  body: string
  htmlBody?: string
  metadata?: {
    filePath?: string
    fileType?: string
    editorType?: string
    parsedAt?: number
  }
}

export interface ParserOptions {
  renderHtml?: boolean
  validateSchema?: z.ZodSchema<any>
  includeMetadata?: boolean
}

export abstract class BaseParser<TFrontmatter = any> {
  protected options: ParserOptions

  constructor(options: ParserOptions = {}) {
    this.options = {
      renderHtml: false,
      includeMetadata: true,
      ...options
    }
  }

  abstract parse(content: string, filePath?: string): Promise<ParseResult<TFrontmatter>>

  protected validateFrontmatter(data: any): TFrontmatter {
    if (this.options.validateSchema) {
      const result = this.options.validateSchema.safeParse(data)
      if (!result.success) {
        throw new ParseError(`Frontmatter validation failed: ${result.error.message}`, undefined, {
          validationErrors: result.error.errors
        })
      }
      return result.data
    }
    return data as TFrontmatter
  }

  protected createMetadata(filePath?: string): ParseResult['metadata'] {
    if (!this.options.includeMetadata) return undefined

    return {
      filePath,
      parsedAt: Date.now()
    }
  }

  protected createParseResult(
    frontmatter: TFrontmatter,
    body: string,
    htmlBody?: string,
    filePath?: string
  ): ParseResult<TFrontmatter> {
    return {
      frontmatter,
      body,
      htmlBody: this.options.renderHtml ? htmlBody : undefined,
      metadata: this.createMetadata(filePath)
    }
  }
}

// ParseError is now imported from shared package