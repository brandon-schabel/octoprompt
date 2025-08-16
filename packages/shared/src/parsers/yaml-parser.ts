import yaml from 'js-yaml'
import { BaseParser } from './base-parser'
import type { ParserOptions, ParseResult } from './base-parser'
import { ParseError } from '../error/domain-error'

export interface YamlParserOptions extends ParserOptions {
  yamlOptions?: yaml.LoadOptions
}

export class YamlParser<TData = any> extends BaseParser<TData> {
  private yamlOptions: yaml.LoadOptions

  constructor(options: YamlParserOptions = {}) {
    super(options)
    this.yamlOptions = options.yamlOptions || {}
  }

  async parse(content: string, filePath?: string): Promise<ParseResult<TData>> {
    try {
      // Parse YAML content
      const data = yaml.load(content, this.yamlOptions)

      // Validate data if schema provided
      const validatedData = this.validateFrontmatter(data)

      // For YAML files, the entire content is the "frontmatter"
      // and there's no separate body
      return this.createParseResult(
        validatedData,
        '', // No body for YAML files
        undefined,
        filePath
      )
    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        throw new ParseError(`Invalid YAML syntax: ${error.message}`, filePath, {
          originalError: error.message
        })
      }
      if (error instanceof Error) {
        throw new ParseError(`Failed to parse YAML: ${error.message}`, filePath, {
          originalError: error.message
        })
      }
      throw error
    }
  }
}