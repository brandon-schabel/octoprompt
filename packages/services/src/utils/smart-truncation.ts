import {
  CHARS_PER_TOKEN_ESTIMATE,
  MAX_TOKENS_FOR_SUMMARY,
  PROMPT_OVERHEAD_TOKENS,
  RESPONSE_BUFFER_TOKENS
} from '@promptliano/config'

export interface TruncationOptions {
  maxTokens?: number
  preserveImports?: boolean
  preserveExports?: boolean
  preserveClasses?: boolean
  preserveFunctions?: boolean
  preserveComments?: boolean
  tokenEstimator?: (text: string) => number
}

export interface TruncatedContent {
  content: string
  wasTruncated: boolean
  originalTokens: number
  truncatedTokens: number
  preservedSections: string[]
}

export interface CodeSection {
  type: 'imports' | 'exports' | 'class' | 'function' | 'interface' | 'type' | 'const' | 'comment' | 'other'
  content: string
  priority: number
  startLine: number
  endLine: number
  name?: string
}

/**
 * Smart truncation service for optimizing file content for summarization
 */
export class SmartTruncation {
  // Configuration constants
  private static readonly DEFAULT_MAX_TOKENS = MAX_TOKENS_FOR_SUMMARY - PROMPT_OVERHEAD_TOKENS - RESPONSE_BUFFER_TOKENS
  private static readonly MAX_BLOCK_LINES = 1000 // Maximum lines to search for block end
  private static readonly FALLBACK_BLOCK_SIZE = 50 // Default block size when parsing fails
  private static readonly MIN_MEANINGFUL_TOKENS = 100 // Minimum tokens to consider adding content
  private static readonly PERCENT_MULTIPLIER = 100 // For percentage calculations
  private static readonly DENSITY_ADJUSTMENT_FACTOR = 0.3 // Whitespace density adjustment

  /**
   * Estimate token count for text
   */
  static estimateTokens(text: string): number {
    // Handle empty string
    if (!text || text.length === 0) {
      return 0
    }

    // More accurate token estimation
    // GPT tokenizer typically uses ~1 token per 4 characters for code
    // But accounting for whitespace and special characters
    const baseEstimate = Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE)

    // Adjust for code density
    const newlineCount = (text.match(/\n/g) || []).length
    const whitespaceRatio = (text.match(/\s/g) || []).length / text.length

    // Dense code (less whitespace) typically has more tokens per character
    // Sparse code (more whitespace) has fewer tokens
    const densityFactor = 1 + (1 - whitespaceRatio) * SmartTruncation.DENSITY_ADJUSTMENT_FACTOR

    return Math.ceil(baseEstimate * densityFactor)
  }

  /**
   * Smart truncate file content preserving important sections
   */
  static truncate(content: string, options: TruncationOptions = {}): TruncatedContent {
    const maxTokens = options.maxTokens ?? SmartTruncation.DEFAULT_MAX_TOKENS
    const tokenEstimator = options.tokenEstimator || this.estimateTokens

    const originalTokens = tokenEstimator(content)

    // Handle maxTokens = 0 - return empty truncation
    if (maxTokens === 0) {
      return {
        content: '\n// ... additional content truncated for summarization ...\n',
        wasTruncated: true,
        originalTokens,
        truncatedTokens: 0,
        preservedSections: []
      }
    }

    // If content fits, return as-is
    if (originalTokens <= maxTokens) {
      return {
        content,
        wasTruncated: false,
        originalTokens,
        truncatedTokens: originalTokens,
        preservedSections: ['full']
      }
    }

    // Extract and prioritize code sections
    const sections = this.extractCodeSections(content, options)
    const prioritizedSections = this.prioritizeSections(sections)

    // Build truncated content
    const result = this.buildTruncatedContent(prioritizedSections, maxTokens, tokenEstimator)

    return {
      ...result,
      originalTokens,
      wasTruncated: true
    }
  }

  /**
   * Extract different code sections from content
   */
  private static extractCodeSections(content: string, options: TruncationOptions): CodeSection[] {
    const lines = content.split('\n')
    const sections: CodeSection[] = []

    // Extract imports (highest priority)
    if (options.preserveImports !== false) {
      const importSections = this.extractImports(lines)
      sections.push(...importSections)
    }

    // Extract exports (high priority)
    if (options.preserveExports !== false) {
      const exportSections = this.extractExports(lines)
      sections.push(...exportSections)
    }

    // Extract classes (medium-high priority)
    if (options.preserveClasses !== false) {
      const classSections = this.extractClasses(lines)
      sections.push(...classSections)
    }

    // Extract functions (medium priority)
    if (options.preserveFunctions !== false) {
      const functionSections = this.extractFunctions(lines)
      sections.push(...functionSections)
    }

    // Extract interfaces and types (medium priority)
    const typeSections = this.extractTypes(lines)
    sections.push(...typeSections)

    // Extract important comments (low priority)
    if (options.preserveComments !== false) {
      const commentSections = this.extractImportantComments(lines)
      sections.push(...commentSections)
    }

    // Add remaining content as 'other' with lowest priority
    const coveredLines = new Set<number>()
    sections.forEach((s) => {
      for (let i = s.startLine; i <= s.endLine; i++) {
        coveredLines.add(i)
      }
    })

    let otherStart = -1
    for (let i = 0; i < lines.length; i++) {
      if (!coveredLines.has(i)) {
        if (otherStart === -1) otherStart = i
      } else if (otherStart !== -1) {
        sections.push({
          type: 'other',
          content: lines.slice(otherStart, i).join('\n'),
          priority: 0,
          startLine: otherStart,
          endLine: i - 1
        })
        otherStart = -1
      }
    }

    if (otherStart !== -1) {
      sections.push({
        type: 'other',
        content: lines.slice(otherStart).join('\n'),
        priority: 0,
        startLine: otherStart,
        endLine: lines.length - 1
      })
    }

    return sections
  }

  /**
   * Extract import statements
   */
  private static extractImports(lines: string[]): CodeSection[] {
    const sections: CodeSection[] = []
    let inImportBlock = false
    let blockStart = -1
    let blockLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const isImport = /^import\s+/.test(line.trim()) || /^from\s+/.test(line.trim())

      if (
        isImport ||
        (inImportBlock && line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*'))
      ) {
        if (!inImportBlock) {
          inImportBlock = true
          blockStart = i
        }
        blockLines.push(line)
      } else if (inImportBlock && (!line.trim() || !isImport)) {
        sections.push({
          type: 'imports',
          content: blockLines.join('\n'),
          priority: 10, // Highest priority
          startLine: blockStart,
          endLine: i - 1
        })
        inImportBlock = false
        blockLines = []

        // Stop looking after first import block
        if (sections.length > 0) break
      }
    }
    
    // Handle case where imports go to the end of the file
    if (inImportBlock && blockLines.length > 0) {
      sections.push({
        type: 'imports',
        content: blockLines.join('\n'),
        priority: 10,
        startLine: blockStart,
        endLine: lines.length - 1
      })
    }

    return sections
  }

  /**
   * Extract export statements
   */
  private static extractExports(lines: string[]): CodeSection[] {
    const sections: CodeSection[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? ''

      // Named exports
      if (line.startsWith('export {')) {
        let endLine = i
        let content = lines[i] ?? ''

        // Handle multi-line exports
        if (!line.includes('}')) {
          for (let j = i + 1; j < lines.length; j++) {
            const lineContent = lines[j] ?? ''
            content += '\n' + lineContent
            if (lineContent.includes('}')) {
              endLine = j
              break
            }
          }
        }

        sections.push({
          type: 'exports',
          content,
          priority: 9,
          startLine: i,
          endLine
        })
      }
      // Export declarations
      else if (line.startsWith('export ') && !line.startsWith('export default')) {
        // Determine if this is a function/class or a simple export
        const isFunction = line.includes('function')
        const isClass = line.includes('class')
        const isInterface = line.includes('interface')
        const isType = line.includes('type')
        
        let endLine = i
        
        if (isFunction || isClass) {
          // For functions and classes, find the closing brace
          endLine = this.findBlockEnd(lines, i)
        } else if (isInterface || isType) {
          // For interfaces and types, find the end
          endLine = this.findBlockEnd(lines, i)
        } else {
          // For const/let/var exports, find the semicolon
          for (let j = i; j < Math.min(i + 10, lines.length); j++) {
            if (lines[j]?.includes(';')) {
              endLine = j
              break
            }
          }
        }

        sections.push({
          type: 'exports',
          content: lines.slice(i, endLine + 1).join('\n'),
          priority: 8,
          startLine: i,
          endLine,
          name: this.extractName(line)
        })
      }
      // Default export
      else if (line.startsWith('export default')) {
        sections.push({
          type: 'exports',
          content: lines[i] ?? '',
          priority: 9,
          startLine: i,
          endLine: i,
          name: 'default'
        })
      }
    }

    return sections
  }

  /**
   * Extract class definitions (only non-exported ones, as exported ones are handled by extractExports)
   */
  private static extractClasses(lines: string[]): CodeSection[] {
    const sections: CodeSection[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      // Only match non-exported classes (exported ones are handled by extractExports)
      const classMatch = /^(?!export\s+)(abstract\s+)?class\s+(\w+)/.exec(line)

      if (classMatch) {
        const className = classMatch[2] // Group 2 is the class name
        const classEnd = this.findBlockEnd(lines, i)

        // For large classes, just keep the signature and public methods
        const classLines = lines.slice(i, classEnd + 1)
        let truncatedClass = classLines[0] + ' {\n'

        // Extract public methods and constructor
        for (let j = 1; j < classLines.length - 1; j++) {
          const methodLine = classLines[j].trim()
          if (
            methodLine.startsWith('constructor') ||
            methodLine.startsWith('public') ||
            (!methodLine.startsWith('private') && !methodLine.startsWith('protected') && /^\w+\s*\(/.test(methodLine))
          ) {
            const methodEnd = this.findBlockEnd(classLines, j, 1)
            if (methodEnd <= j) {
              truncatedClass += '  ' + methodLine + '\n'
            } else {
              truncatedClass += '  ' + methodLine + ' { /* ... */ }\n'
              j = methodEnd
            }
          }
        }

        truncatedClass += '}'

        sections.push({
          type: 'class',
          content: truncatedClass,
          priority: 7,
          startLine: i,
          endLine: classEnd,
          name: className
        })
      }
    }

    return sections
  }

  /**
   * Extract function definitions (only non-exported ones, as exported ones are handled by extractExports)
   */
  private static extractFunctions(lines: string[]): CodeSection[] {
    const sections: CodeSection[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      // Only match non-exported functions (exported ones are handled by extractExports)
      const funcMatch = /^(?!export\s+)(async\s+)?function\s+(\w+)/.exec(line)
      const arrowMatch = /^(?!export\s+)const\s+(\w+)\s*=\s*(async\s+)?\(/.exec(line)

      if (funcMatch || arrowMatch) {
        const funcName = funcMatch ? funcMatch[2] : arrowMatch![1] // Correct group indices
        const funcEnd = this.findBlockEnd(lines, i)

        // For large functions, keep signature and early return statements
        const funcLines = lines.slice(i, Math.min(i + 10, funcEnd + 1))

        sections.push({
          type: 'function',
          content: funcLines.join('\n') + (funcEnd > i + 10 ? '\n  // ... rest of function' : ''),
          priority: 4,
          startLine: i,
          endLine: funcEnd,
          name: funcName
        })
      }
    }

    return sections
  }

  /**
   * Extract type and interface definitions (only non-exported ones, as exported ones are handled by extractExports)
   */
  private static extractTypes(lines: string[]): CodeSection[] {
    const sections: CodeSection[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      // Only match non-exported types/interfaces (exported ones are handled by extractExports)
      const typeMatch = /^(?!export\s+)(type|interface)\s+(\w+)/.exec(line)

      if (typeMatch) {
        const typeName = typeMatch[2] // Group 2 is the type name
        const typeEnd = this.findBlockEnd(lines, i)

        sections.push({
          type: typeMatch[1] as 'interface' | 'type',
          content: lines.slice(i, typeEnd + 1).join('\n'),
          priority: 3,
          startLine: i,
          endLine: typeEnd,
          name: typeName
        })
      }
    }

    return sections
  }

  /**
   * Extract important comments (JSDoc, TODOs, etc.)
   */
  private static extractImportantComments(lines: string[]): CodeSection[] {
    const sections: CodeSection[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''

      // JSDoc comments
      if (line.trim().startsWith('/**')) {
        let endLine = i
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j]?.includes('*/')) {
            endLine = j
            break
          }
        }

        sections.push({
          type: 'comment',
          content: lines.slice(i, endLine + 1).join('\n'),
          priority: 2,
          startLine: i,
          endLine
        })
      }
      // Important single-line comments
      else if (/\/\/\s*(TODO|FIXME|HACK|NOTE|IMPORTANT|WARNING)/i.test(line)) {
        sections.push({
          type: 'comment',
          content: line,
          priority: 1,
          startLine: i,
          endLine: i
        })
      }
    }

    return sections
  }

  /**
   * Find the end of a code block with error handling for malformed code
   */
  private static findBlockEnd(lines: string[], start: number, startOffset: number = 0): number {
    // Validate input
    if (!lines || lines.length === 0) {
      return 0
    }

    if (start < 0 || start >= lines.length) {
      return Math.min(start, lines.length - 1)
    }

    let braceCount = 0
    let inString = false
    let stringChar = ''
    let escapeNext = false

    try {
      for (let i = start + startOffset; i < lines.length; i++) {
        const line = lines[i]

        // Handle undefined or null lines
        if (line === undefined || line === null) {
          continue
        }

        const chars = line.split('')

        for (let j = 0; j < chars.length; j++) {
          const char = chars[j]

          // Handle escape sequences
          if (escapeNext) {
            escapeNext = false
            continue
          }

          if (char === '\\') {
            escapeNext = true
            continue
          }

          // String handling
          if (!inString && (char === '"' || char === "'" || char === '`')) {
            inString = true
            stringChar = char
          } else if (inString && char === stringChar) {
            inString = false
          } else if (!inString) {
            if (char === '{') {
              braceCount++
            } else if (char === '}') {
              braceCount--
              if (braceCount <= 0 && i > start) {
                return i
              }
            }
          }
        }

        // Handle single-line declarations
        if (braceCount === 0 && line.includes(';') && i > start) {
          return i
        }

        // Prevent infinite loops on malformed code
        if (i - start > SmartTruncation.MAX_BLOCK_LINES) {
          // If we've gone too far, likely malformed code
          break
        }
      }
    } catch (error) {
      // Log error but don't throw - return safe fallback
      console.warn('Error parsing code block:', error)
    }

    // Safe fallback: return a reasonable end point
    return Math.min(start + SmartTruncation.FALLBACK_BLOCK_SIZE, lines.length - 1)
  }

  /**
   * Extract name from declaration line
   */
  private static extractName(line: string): string {
    const patterns = [
      /class\s+(\w+)/,
      /interface\s+(\w+)/,
      /type\s+(\w+)/,
      /function\s+(\w+)/,
      /const\s+(\w+)/,
      /let\s+(\w+)/,
      /var\s+(\w+)/
    ]

    for (const pattern of patterns) {
      const match = pattern.exec(line)
      if (match && match[1]) return match[1]
    }

    return 'unnamed'
  }

  /**
   * Prioritize sections for inclusion
   */
  private static prioritizeSections(sections: CodeSection[]): CodeSection[] {
    // Sort by priority (highest first), then by line number
    return sections.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.startLine - b.startLine
    })
  }

  /**
   * Build truncated content within token limit
   */
  private static buildTruncatedContent(
    sections: CodeSection[],
    maxTokens: number,
    tokenEstimator: (text: string) => number
  ): { content: string; truncatedTokens: number; preservedSections: string[] } {
    let content = ''
    let currentTokens = 0
    const preservedSections: string[] = []
    const addedSections = new Set<string>()

    // First pass: Add high-priority sections
    for (const section of sections) {
      if (section.priority >= 7) {
        // Imports, exports, main classes
        const sectionTokens = tokenEstimator(section.content)
        if (currentTokens + sectionTokens <= maxTokens) {
          const sectionKey = `${section.type}-${section.startLine}`
          if (!addedSections.has(sectionKey)) {
            content += section.content + '\n\n'
            currentTokens += sectionTokens
            preservedSections.push(`${section.type}${section.name ? `:${section.name}` : ''}`)
            addedSections.add(sectionKey)
          }
        }
      }
    }

    // Second pass: Add medium-priority sections that fit
    for (const section of sections) {
      if (section.priority >= 4 && section.priority < 7) {
        const sectionTokens = tokenEstimator(section.content)
        if (currentTokens + sectionTokens <= maxTokens * 0.8) {
          // Leave some room
          const sectionKey = `${section.type}-${section.startLine}`
          if (!addedSections.has(sectionKey)) {
            content += section.content + '\n\n'
            currentTokens += sectionTokens
            preservedSections.push(`${section.type}${section.name ? `:${section.name}` : ''}`)
            addedSections.add(sectionKey)
          }
        }
      }
    }

    // Third pass: Fill remaining space with lower priority content
    const remainingTokens = maxTokens - currentTokens
    if (remainingTokens > SmartTruncation.MIN_MEANINGFUL_TOKENS) {
      // Only if we have meaningful space
      for (const section of sections) {
        if (section.priority < 4) {
          const sectionTokens = tokenEstimator(section.content)
          if (sectionTokens <= remainingTokens) {
            const sectionKey = `${section.type}-${section.startLine}`
            if (!addedSections.has(sectionKey)) {
              content += section.content + '\n\n'
              currentTokens += sectionTokens
              preservedSections.push(`${section.type}${section.name ? `:${section.name}` : ''}`)
              addedSections.add(sectionKey)
              break // Just add one more section
            }
          } else if (section.type === 'other' && remainingTokens > 50) {
            // Truncate 'other' content to fit
            const truncatedContent = this.truncateToTokens(section.content, remainingTokens, tokenEstimator)
            content += truncatedContent + '\n... (content truncated)\n'
            currentTokens += tokenEstimator(truncatedContent)
            preservedSections.push('other:truncated')
            break
          }
        }
      }
    }

    // Add truncation marker if needed
    if (preservedSections.length < sections.length) {
      content += '\n// ... additional content truncated for summarization ...\n'
    }

    return {
      content,
      truncatedTokens: currentTokens,
      preservedSections
    }
  }

  /**
   * Truncate text to fit within token limit
   */
  private static truncateToTokens(text: string, maxTokens: number, tokenEstimator: (text: string) => number): string {
    let low = 0
    let high = text.length
    let result = ''

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2)
      const candidate = text.substring(0, mid)

      if (tokenEstimator(candidate) <= maxTokens) {
        result = candidate
        low = mid
      } else {
        high = mid - 1
      }
    }

    // Try to end at a natural boundary
    const lastNewline = result.lastIndexOf('\n')
    if (lastNewline > result.length * 0.8) {
      return result.substring(0, lastNewline)
    }

    const lastSpace = result.lastIndexOf(' ')
    if (lastSpace > result.length * 0.9) {
      return result.substring(0, lastSpace)
    }

    return result
  }

  /**
   * Create a summary of what was truncated
   */
  static getTruncationSummary(result: TruncatedContent): string {
    if (!result.wasTruncated) {
      return 'Full file content preserved.'
    }

    const reduction = Math.round(
      (1 - result.truncatedTokens / result.originalTokens) * SmartTruncation.PERCENT_MULTIPLIER
    )

    return (
      `File truncated by ${reduction}%. Preserved sections: ${result.preservedSections.join(', ')}. ` +
      `Original: ~${result.originalTokens} tokens, Truncated: ~${result.truncatedTokens} tokens.`
    )
  }
}
