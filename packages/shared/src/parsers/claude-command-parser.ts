import { MarkdownParser } from './markdown-parser'
import type { ParseResult, ParserOptions } from './base-parser'
import { ParseError } from '../error/domain-error'
import { z } from 'zod'

// Claude command frontmatter schema
export const ClaudeCommandFrontmatterSchema = z.object({
  'allowed-tools': z.string().optional(),
  description: z.string().optional(),
  'argument-hint': z.string().optional(),
  model: z.string().optional(),
  'max-turns': z.number().optional(),
  'output-format': z.enum(['text', 'json']).optional()
})

export type ClaudeCommandFrontmatter = z.infer<typeof ClaudeCommandFrontmatterSchema>

export interface ClaudeCommandParseResult extends ParseResult<ClaudeCommandFrontmatter> {
  commandName?: string
  namespace?: string
  scope?: 'project' | 'user'
}

export class ClaudeCommandParser extends MarkdownParser<ClaudeCommandFrontmatter> {
  constructor(options: ParserOptions = {}) {
    super({
      ...options,
      validateSchema: options.validateSchema || ClaudeCommandFrontmatterSchema
    })
  }

  async parse(content: string, filePath?: string): Promise<ClaudeCommandParseResult> {
    const baseResult = await super.parse(content, filePath)

    // Extract command metadata from file path
    const commandMetadata = this.extractCommandMetadata(filePath)

    return {
      ...baseResult,
      ...commandMetadata
    }
  }

  private extractCommandMetadata(filePath?: string): Partial<ClaudeCommandParseResult> {
    if (!filePath) return {}

    const metadata: Partial<ClaudeCommandParseResult> = {}

    // Determine scope based on path
    if (filePath.includes('/.claude/commands/')) {
      metadata.scope = 'project'
    } else if (filePath.includes('/commands/')) {
      metadata.scope = 'user'
    }

    // Extract command name and namespace from file path
    // Example: .claude/commands/frontend/component.md -> namespace: frontend, command: component
    const match = filePath.match(/commands\/(?:(.+?)\/)?([^\/]+)\.md$/)
    if (match) {
      const [, namespace, commandName] = match
      metadata.namespace = namespace
      metadata.commandName = commandName
    }

    return metadata
  }

  // Parse allowed tools from frontmatter
  parseAllowedTools(frontmatter: ClaudeCommandFrontmatter): string[] {
    const allowedTools = frontmatter['allowed-tools']
    if (!allowedTools) return []

    // Parse comma-separated list of tools
    return allowedTools
      .split(',')
      .map((tool) => tool.trim())
      .filter(Boolean)
  }

  // Replace $ARGUMENTS placeholder in command content
  substituteArguments(content: string, args: string): string {
    return content.replace(/\$ARGUMENTS/g, args)
  }

  // Validate command structure
  validateCommand(result: ClaudeCommandParseResult): void {
    if (!result.commandName) {
      throw new ParseError('Invalid command: missing command name', result.metadata?.filePath)
    }

    if (!result.body || result.body.trim().length === 0) {
      throw new ParseError('Invalid command: empty command body', result.metadata?.filePath)
    }
  }
}