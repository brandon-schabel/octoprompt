import { TokenCounter } from './context.optimizer'

// ============================================================================
// Compression Strategies for Context Optimization
// ============================================================================

export type CompressionLevel = 'none' | 'light' | 'moderate' | 'aggressive'

export interface CompressionResult {
  compressed: string
  originalTokens: number
  compressedTokens: number
  compressionRatio: number
  technique: string
}

// ============================================================================
// Text Compression Utilities
// ============================================================================

export class TextCompressor {
  // Light compression: Remove redundant whitespace and comments
  static lightCompress(text: string): CompressionResult {
    const original = text
    const originalTokens = TokenCounter.count(original)

    let compressed = text
      // Remove multiple spaces
      .replace(/[ \t]+/g, ' ')
      // Remove trailing whitespace
      .replace(/[ \t]+$/gm, '')
      // Remove multiple newlines (keep max 2)
      .replace(/\n{3,}/g, '\n\n')
      // Remove comments (but keep JSDoc and important ones)
      .replace(/\/\/(?![\s/]*(TODO|FIXME|IMPORTANT|NOTE|WARNING|@))[^\n]*/g, '')
      // Remove empty lines in code blocks
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/\n\s*\n/g, '\n')
      })

    const compressedTokens = TokenCounter.count(compressed)

    return {
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: 1 - compressedTokens / originalTokens,
      technique: 'light'
    }
  }

  // Moderate compression: Simplify verbose descriptions
  static moderateCompress(text: string): CompressionResult {
    const original = text
    const originalTokens = TokenCounter.count(original)

    // Start with light compression
    let compressed = this.lightCompress(text).compressed

    // Additional moderate compressions
    compressed = compressed
      // Simplify verbose phrases
      .replace(/in order to/gi, 'to')
      .replace(/due to the fact that/gi, 'because')
      .replace(/at this point in time/gi, 'now')
      .replace(/in the event that/gi, 'if')
      .replace(/with regard to/gi, 'about')
      .replace(/for the purpose of/gi, 'to')
      .replace(/in spite of the fact that/gi, 'although')
      .replace(/as a result of/gi, 'because')
      .replace(/is able to/gi, 'can')
      .replace(/has the ability to/gi, 'can')

      // Remove filler words
      .replace(/\b(very|really|actually|basically|essentially|simply|just)\b/gi, '')

      // Compress lists
      .replace(/(\n\s*[-*]\s+[^\n]+){4,}/g, (match) => {
        const items = match.trim().split('\n')
        if (items.length > 5) {
          // Keep first 3 and last 2 items
          const compressed = [
            ...items.slice(0, 3),
            '  - [... ' + (items.length - 5) + ' more items ...]',
            ...items.slice(-2)
          ]
          return '\n' + compressed.join('\n')
        }
        return match
      })

      // Simplify code examples
      .replace(/```[\s\S]*?```/g, (match) => {
        const lines = match.split('\n')
        if (lines.length > 20) {
          // Keep first 10 and last 5 lines of code
          const compressed = [...lines.slice(0, 10), '// ... code omitted for brevity ...', ...lines.slice(-5)]
          return compressed.join('\n')
        }
        return match
      })

    // Clean up any double spaces created
    compressed = compressed.replace(/\s+/g, ' ').trim()

    const compressedTokens = TokenCounter.count(compressed)

    return {
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: 1 - compressedTokens / originalTokens,
      technique: 'moderate'
    }
  }

  // Aggressive compression: Extract key points only
  static aggressiveCompress(text: string): CompressionResult {
    const original = text
    const originalTokens = TokenCounter.count(original)

    // Extract key information
    const keyPoints: string[] = []

    // Extract headings
    const headings = text.match(/^#+\s+.+$/gm) || []
    keyPoints.push(...headings.slice(0, 5)) // Keep top 5 headings

    // Extract TODO/IMPORTANT items
    const important = text.match(/.*(TODO|FIXME|IMPORTANT|WARNING|CRITICAL).*/gi) || []
    keyPoints.push(...important.slice(0, 3))

    // Extract function/class definitions
    const definitions = text.match(/^(export\s+)?(function|class|interface|type)\s+\w+/gm) || []
    keyPoints.push(...definitions.slice(0, 10))

    // Extract first sentence of each paragraph
    const paragraphs = text.split(/\n\n+/)
    const firstSentences = paragraphs
      .map((p) => {
        const sentence = p.match(/^[^.!?]+[.!?]/)
        return sentence ? sentence[0] : null
      })
      .filter(Boolean)
      .slice(0, 5) as string[]
    keyPoints.push(...firstSentences)

    // Extract bullet points (max 5)
    const bullets = text.match(/^\s*[-*]\s+[^\n]+/gm) || []
    keyPoints.push(...bullets.slice(0, 5))

    // Extract code block signatures (not full blocks)
    const codeBlocks = text.match(/```[\s\S]*?```/g) || []
    codeBlocks.slice(0, 3).forEach((block) => {
      const firstLine = block.split('\n')[1]
      if (firstLine) {
        keyPoints.push('Code: ' + firstLine.substring(0, 50) + '...')
      }
    })

    // Build compressed version
    let compressed = 'KEY POINTS:\n' + keyPoints.join('\n')

    // Add summary if original was very long
    if (originalTokens > 1000) {
      compressed = 'SUMMARY (aggressive compression applied):\n' + compressed
    }

    const compressedTokens = TokenCounter.count(compressed)

    return {
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: 1 - compressedTokens / originalTokens,
      technique: 'aggressive'
    }
  }

  // Intelligent compression based on content type
  static intelligentCompress(text: string, targetTokens: number): CompressionResult {
    const originalTokens = TokenCounter.count(text)

    // If already within target, no compression needed
    if (originalTokens <= targetTokens) {
      return {
        compressed: text,
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 0,
        technique: 'none'
      }
    }

    // Try progressively more aggressive compression
    const compressionLevels: CompressionLevel[] = ['light', 'moderate', 'aggressive']

    for (const level of compressionLevels) {
      const result = this.compress(text, level)

      if (result.compressedTokens <= targetTokens) {
        return result
      }
    }

    // If even aggressive isn't enough, truncate
    const aggressiveResult = this.aggressiveCompress(text)
    if (aggressiveResult.compressedTokens > targetTokens) {
      const truncated = TokenCounter.fitToLimit(aggressiveResult.compressed, targetTokens)
      return {
        compressed: truncated,
        originalTokens,
        compressedTokens: TokenCounter.count(truncated),
        compressionRatio: 1 - TokenCounter.count(truncated) / originalTokens,
        technique: 'aggressive+truncation'
      }
    }

    return aggressiveResult
  }

  // Main compression method
  static compress(text: string, level: CompressionLevel): CompressionResult {
    switch (level) {
      case 'none':
        return {
          compressed: text,
          originalTokens: TokenCounter.count(text),
          compressedTokens: TokenCounter.count(text),
          compressionRatio: 0,
          technique: 'none'
        }
      case 'light':
        return this.lightCompress(text)
      case 'moderate':
        return this.moderateCompress(text)
      case 'aggressive':
        return this.aggressiveCompress(text)
      default:
        return this.lightCompress(text)
    }
  }
}

// ============================================================================
// Specialized Compression for Different Content Types
// ============================================================================

export class SpecializedCompressor {
  // Compress code while maintaining structure
  static compressCode(code: string): CompressionResult {
    const original = code
    const originalTokens = TokenCounter.count(original)

    let compressed = code
      // Remove comments (except important ones)
      .replace(/\/\*[\s\S]*?\*\//g, (match) => {
        if (match.includes('TODO') || match.includes('IMPORTANT') || match.includes('@')) {
          return match
        }
        return ''
      })
      .replace(/\/\/(?!.*(?:TODO|FIXME|IMPORTANT)).*$/gm, '')

      // Remove empty lines
      .replace(/^\s*\n/gm, '')

      // Compress whitespace in code
      .replace(/\{\s+\}/g, '{}')
      .replace(/\[\s+\]/g, '[]')
      .replace(/\(\s+\)/g, '()')

      // Remove unnecessary semicolons (in languages that don't require them)
      .replace(/;\s*\n\s*}/g, '\n}')

      // Compress import statements
      .replace(/(import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*\n)+/g, (match) => {
        const imports = match.trim().split('\n')
        if (imports.length > 5) {
          return imports.slice(0, 3).join('\n') + '\n// ... ' + (imports.length - 3) + ' more imports ...\n'
        }
        return match
      })

    const compressedTokens = TokenCounter.count(compressed)

    return {
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: 1 - compressedTokens / originalTokens,
      technique: 'code-specific'
    }
  }

  // Compress markdown documentation
  static compressMarkdown(markdown: string): CompressionResult {
    const original = markdown
    const originalTokens = TokenCounter.count(original)

    let compressed = markdown
      // Remove image descriptions (keep links)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]')

      // Compress tables
      .replace(/\|.+\|\n\|[-:\s|]+\|\n(\|.+\|\n){3,}/g, (match) => {
        const rows = match.trim().split('\n')
        if (rows.length > 5) {
          return rows.slice(0, 3).join('\n') + '\n| ... ' + (rows.length - 3) + ' more rows ... |\n'
        }
        return match
      })

      // Remove blockquotes
      .replace(/^>\s+.+$/gm, '')

      // Compress links (keep text, remove URLs)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')

      // Compress nested lists
      .replace(/^(\s{2,})[-*]\s+/gm, '  - ')

    const compressedTokens = TokenCounter.count(compressed)

    return {
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: 1 - compressedTokens / originalTokens,
      technique: 'markdown-specific'
    }
  }

  // Compress JSON data
  static compressJSON(json: string): CompressionResult {
    const original = json
    const originalTokens = TokenCounter.count(original)

    try {
      const parsed = JSON.parse(json)

      // Remove null values
      const removeNulls = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(removeNulls).filter((v) => v !== null)
        } else if (obj !== null && typeof obj === 'object') {
          return Object.entries(obj)
            .filter(([_, v]) => v !== null)
            .reduce((acc, [k, v]) => ({ ...acc, [k]: removeNulls(v) }), {})
        }
        return obj
      }

      const cleaned = removeNulls(parsed)

      // Minify JSON
      const compressed = JSON.stringify(cleaned)
      const compressedTokens = TokenCounter.count(compressed)

      return {
        compressed,
        originalTokens,
        compressedTokens,
        compressionRatio: 1 - compressedTokens / originalTokens,
        technique: 'json-minification'
      }
    } catch {
      // If not valid JSON, return as-is
      return {
        compressed: json,
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 0,
        technique: 'none'
      }
    }
  }

  // Detect content type and apply appropriate compression
  static autoCompress(content: string, level: CompressionLevel = 'moderate'): CompressionResult {
    // Detect content type
    const isCode = /^(import|export|function|class|const|let|var)\s/m.test(content)
    const isMarkdown = /^#{1,6}\s|^\*\s|^-\s|^\d+\.\s/m.test(content)
    const isJSON = /^\s*[\{\[]/.test(content) && /[\}\]]\s*$/.test(content)

    // Apply specialized compression based on type
    if (isJSON) {
      return this.compressJSON(content)
    } else if (isCode) {
      const codeResult = this.compressCode(content)
      // Apply additional general compression if needed
      if (level !== 'none' && codeResult.compressionRatio < 0.3) {
        return TextCompressor.compress(codeResult.compressed, level)
      }
      return codeResult
    } else if (isMarkdown) {
      const mdResult = this.compressMarkdown(content)
      // Apply additional general compression if needed
      if (level !== 'none' && mdResult.compressionRatio < 0.3) {
        return TextCompressor.compress(mdResult.compressed, level)
      }
      return mdResult
    } else {
      // Default to general text compression
      return TextCompressor.compress(content, level)
    }
  }
}

// ============================================================================
// Compression Pipeline
// ============================================================================

export class CompressionPipeline {
  private stages: Array<(text: string) => string> = []

  addStage(compressor: (text: string) => string): this {
    this.stages.push(compressor)
    return this
  }

  removeWhitespace(): this {
    return this.addStage((text) => text.replace(/\s+/g, ' ').trim())
  }

  removeComments(): this {
    return this.addStage((text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))
  }

  abbreviate(): this {
    const abbreviations: Record<string, string> = {
      function: 'fn',
      return: 'ret',
      const: 'c',
      let: 'l',
      variable: 'var',
      parameter: 'param',
      argument: 'arg',
      object: 'obj',
      string: 'str',
      number: 'num',
      boolean: 'bool'
    }

    return this.addStage((text) => {
      let result = text
      Object.entries(abbreviations).forEach(([full, abbr]) => {
        result = result.replace(new RegExp(`\\b${full}\\b`, 'gi'), abbr)
      })
      return result
    })
  }

  execute(text: string): CompressionResult {
    const originalTokens = TokenCounter.count(text)

    let compressed = text
    for (const stage of this.stages) {
      compressed = stage(compressed)
    }

    const compressedTokens = TokenCounter.count(compressed)

    return {
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: 1 - compressedTokens / originalTokens,
      technique: 'pipeline'
    }
  }
}

// Export convenience function
export function createCompressionPipeline(): CompressionPipeline {
  return new CompressionPipeline()
}
