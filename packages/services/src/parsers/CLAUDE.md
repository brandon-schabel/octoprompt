# Parser System Architecture

This directory contains an extensible parser system designed to parse structured content from various file formats and editor-specific configurations. The system follows a registry pattern for dynamic parser resolution based on file type and editor context.

## Architecture Overview

### Core Components

1. **BaseParser** - Abstract base class providing common parsing functionality
2. **ParserRegistry** - Singleton registry managing parser resolution and instantiation
3. **ParserService** - High-level service with caching and file I/O capabilities
4. **Specialized Parsers** - Format and editor-specific implementations

### Design Principles

- **Extensible**: Easy to add new parsers for different formats or editors
- **Type-Safe**: Full TypeScript support with Zod schema validation
- **Cacheable**: Built-in file-based caching with TTL and modification detection
- **Context-Aware**: Parsers adapt based on file path and content patterns
- **Error-Resilient**: Comprehensive error handling with detailed context

## Parser Implementation Guide

### 1. Creating a New Parser

All parsers must extend `BaseParser<TFrontmatter>`:

```typescript
import { BaseParser, ParseResult, ParserOptions } from './base-parser'
import { ParseError } from '@promptliano/shared'
import { z } from 'zod'

// Define your frontmatter schema
export const MyFormatSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  version: z.string().optional()
})

export type MyFormatData = z.infer<typeof MyFormatSchema>

export class MyFormatParser extends BaseParser<MyFormatData> {
  constructor(options: ParserOptions = {}) {
    super({
      ...options,
      validateSchema: options.validateSchema || MyFormatSchema
    })
  }

  async parse(content: string, filePath?: string): Promise<ParseResult<MyFormatData>> {
    try {
      // Parse your format here
      const { frontmatter, body } = this.parseContent(content)

      // Validate frontmatter
      const validated = this.validateFrontmatter(frontmatter)

      // Return structured result
      return this.createParseResult(validated, body, undefined, filePath)
    } catch (error) {
      throw new ParseError(`Failed to parse format: ${error.message}`, filePath, { originalError: error.message })
    }
  }

  private parseContent(content: string) {
    // Your parsing logic here
    return { frontmatter: {}, body: content }
  }
}
```

### 2. Parser Registration

Register your parser in `ParserRegistry`:

```typescript
// In packages/storage/src/parser-registry.ts
import { MyFormatParser } from '@promptliano/services'

private registerDefaultParsers(): void {
  // Register with specific editor type
  this.register(
    {
      fileType: 'myformat',
      editorType: 'myeditor',
      parserClass: 'MyFormatParser',
      options: { customOption: true }
    },
    100 // High priority
  )

  // Register generic fallback
  this.register(
    {
      fileType: 'myformat',
      editorType: 'generic',
      parserClass: 'MyFormatParser'
    },
    50 // Lower priority
  )
}
```

Add the parser class to the factory method:

```typescript
private createParserInstance(config: ParserConfig): BaseParser | null {
  switch (config.parserClass) {
    case 'MyFormatParser':
      return new MyFormatParser(options)
    // ... other cases
  }
}
```

### 3. Schema Integration

Add your file type to the schemas:

```typescript
// In packages/schemas/src/parser-config.schemas.ts
export const FileTypeSchema = z.enum(['markdown', 'json', 'yaml', 'md', 'yml', 'myformat'])

export const EditorTypeSchema = z.enum(['claude', 'vscode', 'cursor', 'windsurf', 'myeditor', 'generic'])
```

Update the file type detection:

```typescript
// In ParserRegistry.getFileType()
static getFileType(filePath: string): FileType | null {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'myext':
      return 'myformat'
    // ... other cases
  }
}
```

## Existing Parser Examples

### 1. Markdown Parser (Base Implementation)

```typescript
export class MarkdownParser<TFrontmatter = any> extends BaseParser<TFrontmatter> {
  async parse(content: string, filePath?: string): Promise<ParseResult<TFrontmatter>> {
    const { data: frontmatter, content: body } = matter(content, this.matterOptions)
    const validatedFrontmatter = this.validateFrontmatter(frontmatter)

    let htmlBody: string | undefined
    if (this.options.renderHtml) {
      htmlBody = await marked(body, this.markedOptions)
    }

    return this.createParseResult(validatedFrontmatter, body.trim(), htmlBody, filePath)
  }
}
```

### 2. Specialized Claude Command Parser

```typescript
export class ClaudeCommandParser extends MarkdownParser<ClaudeCommandFrontmatter> {
  async parse(content: string, filePath?: string): Promise<ClaudeCommandParseResult> {
    const baseResult = await super.parse(content, filePath)
    const commandMetadata = this.extractCommandMetadata(filePath)

    return {
      ...baseResult,
      ...commandMetadata
    }
  }

  private extractCommandMetadata(filePath?: string) {
    // Extract command name and namespace from file path
    const match = filePath?.match(/commands\/(?:(.+?)\/)?([^\/]+)\.md$/)
    if (match) {
      const [, namespace, commandName] = match
      return { namespace, commandName }
    }
    return {}
  }
}
```

### 3. JSON Parser with Schema Validation

```typescript
export class JsonParser<TData = any> extends BaseParser<TData> {
  async parse(content: string, filePath?: string): Promise<ParseResult<TData>> {
    try {
      const data = JSON.parse(content)
      const validatedData = this.validateFrontmatter(data)

      return this.createParseResult(
        validatedData,
        '', // No body for JSON files
        undefined,
        filePath
      )
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ParseError(`Invalid JSON syntax: ${error.message}`, filePath)
      }
      throw error
    }
  }
}
```

## Registry Pattern Usage

### Parser Resolution Priority

1. **Exact Match**: `fileType_editorType` (e.g., `json_vscode`)
2. **Generic Fallback**: `fileType_generic` (e.g., `json_generic`)
3. **Priority-based**: Higher priority parsers are preferred

### Editor Type Detection

The registry automatically infers editor types from:

```typescript
static inferEditorType(filePath: string, content?: string): EditorType {
  // File path patterns
  if (filePath.includes('.claude/commands/')) return 'claude'
  if (filePath.includes('.vscode/')) return 'vscode'
  if (filePath.includes('.cursor/')) return 'cursor'

  // Content patterns
  if (content?.includes('allowed-tools:')) return 'claude'
  if (content?.includes('"workbench.colorTheme"')) return 'vscode'

  return 'generic'
}
```

## Usage Examples

### Basic File Parsing

```typescript
import { parserService } from '@promptliano/services'

// Parse a file
const result = await parserService.parseFile({
  filePath: '.claude/commands/review.md',
  options: { renderHtml: true, useCache: true }
})

console.log(result.frontmatter) // Parsed frontmatter
console.log(result.body) // Content body
console.log(result.htmlBody) // Rendered HTML
```

### Content-Only Parsing

```typescript
const result = await parserService.parseContent('---\ntitle: My Document\n---\n# Content', 'markdown', 'generic', {
  renderHtml: true
})
```

### Custom Parser Options

```typescript
const result = await parserService.parseFile({
  filePath: 'config.json',
  fileType: 'json',
  editorType: 'vscode',
  options: {
    validateSchema: true,
    useCache: false
  }
})
```

## Error Handling

### Validation Errors

```typescript
try {
  const result = await parserService.parseFile({ filePath: 'invalid.md' })
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.context.validationErrors) // Zod validation errors
  }
}
```

### Parse Errors

```typescript
try {
  const result = await parser.parse(content, filePath)
} catch (error) {
  if (error instanceof ParseError) {
    console.log(error.filePath) // File that failed
    console.log(error.context.originalError) // Root cause
  }
}
```

## Testing Patterns

### Unit Testing Parsers

```typescript
import { describe, expect, it } from 'bun:test'
import { MyFormatParser } from './my-format-parser'

describe('MyFormatParser', () => {
  const parser = new MyFormatParser()

  it('should parse valid content', async () => {
    const content = 'title: Test\n---\nContent here'
    const result = await parser.parse(content)

    expect(result.frontmatter.title).toBe('Test')
    expect(result.body).toBe('Content here')
  })

  it('should handle validation errors', async () => {
    const content = 'invalid: data\n---\nContent'

    await expect(parser.parse(content)).rejects.toThrow('validation failed')
  })

  it('should include metadata', async () => {
    const result = await parser.parse('content', '/test/file.ext')

    expect(result.metadata?.filePath).toBe('/test/file.ext')
    expect(result.metadata?.parsedAt).toBeGreaterThan(0)
  })
})
```

### Integration Testing with Registry

```typescript
describe('ParserRegistry Integration', () => {
  it('should resolve correct parser', () => {
    const parser = parserRegistry.getParser('markdown', 'claude')
    expect(parser).toBeInstanceOf(ClaudeCommandParser)
  })

  it('should fallback to generic parser', () => {
    const parser = parserRegistry.getParser('json', 'unknown')
    expect(parser).toBeInstanceOf(JsonParser)
  })
})
```

## Performance Optimization

### Caching Strategy

```typescript
// The ParserService includes intelligent caching:
// 1. Content-based cache keys
// 2. File modification time checking
// 3. Configurable TTL (default 5 minutes)
// 4. Memory-efficient storage

// Clear cache when needed
parserService.clearCache()
parserService.deleteFromCache('/specific/file.md')
```

### Parser Instance Reuse

```typescript
// Registry automatically reuses parser instances based on:
// - Parser class name
// - Configuration options
// This prevents recreating identical parsers

const key = `${config.parserClass}_${JSON.stringify(config.options)}`
```

## Best Practices

### 1. Schema Design

- Use strict Zod schemas for frontmatter validation
- Provide meaningful error messages
- Use `.optional()` for non-required fields
- Consider `.passthrough()` for extensible schemas

### 2. Error Context

- Always include file path in errors
- Preserve original error messages
- Add structured context for debugging

### 3. Testing

- Test both valid and invalid input
- Test edge cases (empty files, malformed content)
- Test with and without file paths
- Verify metadata is correctly set

### 4. Performance

- Use caching for file-based parsing
- Implement efficient content parsing algorithms
- Consider memory usage for large files
- Reuse parser instances when possible

## Contributing

When adding new parsers:

1. Follow the `BaseParser` interface
2. Include comprehensive Zod schemas
3. Add registry configuration
4. Update file type detection logic
5. Include unit tests
6. Document parser-specific features
7. Consider backward compatibility

The parser system is designed to be highly extensible while maintaining consistency and type safety across all implementations.
