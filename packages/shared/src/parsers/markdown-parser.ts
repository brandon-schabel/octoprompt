import matter from 'gray-matter'
import { marked } from 'marked'
import { BaseParser } from './base-parser'
import type { ParserOptions, ParseResult } from './base-parser'
import { ParseError } from '../error/domain-error'

export interface MarkdownParserOptions extends ParserOptions {
  markedOptions?: any // Use any to avoid marked type export issues
  matterOptions?: matter.GrayMatterOption<string, any>
}

export class MarkdownParser<TFrontmatter = any> extends BaseParser<TFrontmatter> {
  private markedOptions: any // Use any to avoid marked type export issues
  private matterOptions: matter.GrayMatterOption<string, any>

  constructor(options: MarkdownParserOptions = {}) {
    super(options)
    this.markedOptions = options.markedOptions || {}
    this.matterOptions = options.matterOptions || {}
  }

  async parse(content: string, filePath?: string): Promise<ParseResult<TFrontmatter>> {
    try {
      // Parse frontmatter and content
      const { data: frontmatter, content: body } = matter(content, this.matterOptions)

      // Validate frontmatter if schema provided
      const validatedFrontmatter = this.validateFrontmatter(frontmatter)

      // Render HTML if requested
      let htmlBody: string | undefined
      if (this.options.renderHtml) {
        htmlBody = await marked(body, this.markedOptions)
      }

      return this.createParseResult(validatedFrontmatter, body.trim(), htmlBody, filePath)
    } catch (error) {
      if (error instanceof Error) {
        throw new ParseError(`Failed to parse markdown: ${error.message}`, filePath, {
          originalError: error.message
        })
      }
      throw error
    }
  }

  static extractFrontmatter(content: string): any {
    const { data } = matter(content)
    return data
  }

  static extractBody(content: string): string {
    const { content: body } = matter(content)
    return body.trim()
  }
}