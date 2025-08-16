import { type ParserConfig, type FileType, type EditorType, type ParserRegistryEntry } from '@promptliano/schemas'
import {
  BaseParser,
  MarkdownParser,
  JsonParser,
  YamlParser,
  ClaudeCommandParser,
  VSCodeConfigParser,
  CursorConfigParser
} from '@promptliano/shared'

export class ParserRegistry {
  private static instance: ParserRegistry
  private parsers: Map<string, ParserRegistryEntry> = new Map()
  private parserInstances: Map<string, BaseParser> = new Map()

  private constructor() {
    this.registerDefaultParsers()
  }

  static getInstance(): ParserRegistry {
    if (!ParserRegistry.instance) {
      ParserRegistry.instance = new ParserRegistry()
    }
    return ParserRegistry.instance
  }

  /** Register default parsers */
  private registerDefaultParsers(): void {
    // Claude command parser
    this.register(
      {
        fileType: 'markdown',
        editorType: 'claude',
        parserClass: 'ClaudeCommandParser',
        options: { renderHtml: false }
      },
      100
    )

    this.register(
      {
        fileType: 'md',
        editorType: 'claude',
        parserClass: 'ClaudeCommandParser',
        options: { renderHtml: false }
      },
      100
    )

    // VS Code config parser
    this.register(
      {
        fileType: 'json',
        editorType: 'vscode',
        parserClass: 'VSCodeConfigParser'
      },
      90
    )

    // Cursor config parser
    this.register(
      {
        fileType: 'json',
        editorType: 'cursor',
        parserClass: 'CursorConfigParser'
      },
      90
    )

    // Generic parsers (lower priority)
    this.register(
      {
        fileType: 'markdown',
        editorType: 'generic',
        parserClass: 'MarkdownParser',
        options: { renderHtml: true }
      },
      50
    )

    this.register(
      {
        fileType: 'md',
        editorType: 'generic',
        parserClass: 'MarkdownParser',
        options: { renderHtml: true }
      },
      50
    )

    this.register(
      {
        fileType: 'json',
        editorType: 'generic',
        parserClass: 'JsonParser'
      },
      50
    )

    this.register(
      {
        fileType: 'yaml',
        editorType: 'generic',
        parserClass: 'YamlParser'
      },
      50
    )

    this.register(
      {
        fileType: 'yml',
        editorType: 'generic',
        parserClass: 'YamlParser'
      },
      50
    )
  }

  /** Generate registry key */
  private generateKey(fileType: FileType, editorType: EditorType): string {
    return `${fileType}_${editorType}`
  }

  /** Register a parser configuration */
  register(config: ParserConfig, priority: number = 50): void {
    const key = this.generateKey(config.fileType, config.editorType)
    this.parsers.set(key, {
      key,
      config,
      priority
    })
  }

  /** Get parser configuration */
  getConfig(fileType: FileType, editorType: EditorType): ParserConfig | null {
    // Try exact match first
    const exactKey = this.generateKey(fileType, editorType)
    const exact = this.parsers.get(exactKey)
    if (exact) return exact.config

    // Try generic fallback
    const genericKey = this.generateKey(fileType, 'generic')
    const generic = this.parsers.get(genericKey)
    if (generic) return generic.config

    return null
  }

  /** Get or create parser instance */
  getParser(fileType: FileType, editorType: EditorType): BaseParser | null {
    const config = this.getConfig(fileType, editorType)
    if (!config) return null

    const instanceKey = `${config.parserClass}_${JSON.stringify(config.options || {})}`

    // Check if instance already exists
    let parser = this.parserInstances.get(instanceKey)
    if (parser) return parser

    // Create new instance
    const newParser = this.createParserInstance(config)
    if (newParser !== null) {
      this.parserInstances.set(instanceKey, newParser)
    }

    return newParser
  }

  /** Create parser instance from config */
  private createParserInstance(config: ParserConfig): BaseParser | null {
    const options = config.options || {}

    switch (config.parserClass) {
      case 'MarkdownParser':
        return new MarkdownParser(options)
      case 'JsonParser':
        return new JsonParser(options)
      case 'YamlParser':
        return new YamlParser(options)
      case 'ClaudeCommandParser':
        return new ClaudeCommandParser(options)
      case 'VSCodeConfigParser':
        return new VSCodeConfigParser(options)
      case 'CursorConfigParser':
        return new CursorConfigParser(options)
      default:
        console.error(`Unknown parser class: ${config.parserClass}`)
        return null
    }
  }

  /** Get all registered parsers */
  getAllParsers(): ParserRegistryEntry[] {
    return Array.from(this.parsers.values()).sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  /** Determine file type from file extension */
  static getFileType(filePath: string): FileType | null {
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'md':
      case 'markdown':
        return 'markdown'
      case 'json':
        return 'json'
      case 'yaml':
      case 'yml':
        return 'yaml'
      default:
        return null
    }
  }

  /** Determine editor type from file path or content */
  static inferEditorType(filePath: string, content?: string): EditorType {
    // Check file path patterns
    if (filePath.includes('.claude/commands/')) return 'claude'
    if (filePath.includes('.vscode/')) return 'vscode'
    if (filePath.includes('.cursor/')) return 'cursor'
    if (filePath.includes('.cursorrules')) return 'cursor'

    // Check content patterns if available
    if (content) {
      if (content.includes('allowed-tools:')) return 'claude'
      if (content.includes('"workbench.colorTheme"')) return 'vscode'
      if (content.includes('"cursor.')) return 'cursor'
    }

    return 'generic'
  }
}

// Export singleton instance
export const parserRegistry = ParserRegistry.getInstance()
