import { BaseParser } from './base-parser'
import type { ParserOptions, ParseResult } from './base-parser'
import { ParseError } from '../error/domain-error'

export class JsonParser<TData = any> extends BaseParser<TData> {
  constructor(options: ParserOptions = {}) {
    super(options)
  }

  async parse(content: string, filePath?: string): Promise<ParseResult<TData>> {
    try {
      // Parse JSON content
      const data = JSON.parse(content)

      // Validate data if schema provided
      const validatedData = this.validateFrontmatter(data)

      // For JSON files, the entire content is the "frontmatter"
      // and there's no separate body
      return this.createParseResult(
        validatedData,
        '', // No body for JSON files
        undefined,
        filePath
      )
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ParseError(`Invalid JSON syntax: ${error.message}`, filePath, {
          originalError: error.message
        })
      }
      if (error instanceof Error) {
        throw new ParseError(`Failed to parse JSON: ${error.message}`, filePath, {
          originalError: error.message
        })
      }
      throw error
    }
  }
}