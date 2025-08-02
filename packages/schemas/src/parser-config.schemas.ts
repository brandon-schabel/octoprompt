import { z } from '@hono/zod-openapi'

// File type enum
export const FileTypeSchema = z.enum(['markdown', 'json', 'yaml', 'md', 'yml']).openapi({
  example: 'markdown',
  description: 'Supported file types for parsing'
})

// Editor type enum
export const EditorTypeSchema = z.enum(['claude', 'vscode', 'cursor', 'windsurf', 'generic']).openapi({
  example: 'claude',
  description: 'Supported editor/provider types'
})

// Parser configuration schema
export const ParserConfigSchema = z
  .object({
    fileType: FileTypeSchema,
    editorType: EditorTypeSchema,
    parserClass: z.string().openapi({
      example: 'ClaudeCommandParser',
      description: 'Parser class name to use'
    }),
    options: z
      .record(z.any())
      .optional()
      .openapi({
        example: { renderHtml: true },
        description: 'Parser-specific options'
      })
  })
  .openapi('ParserConfig')

// Parse result schema
export const ParseResultSchema = z
  .object({
    frontmatter: z.any().openapi({
      example: { description: 'Command description', 'allowed-tools': 'Edit, Read' },
      description: 'Parsed frontmatter/metadata'
    }),
    body: z.string().openapi({
      example: '# Command Content\n\nThis is the main content...',
      description: 'Main content body (without frontmatter)'
    }),
    htmlBody: z.string().optional().openapi({
      example: '<h1>Command Content</h1>\n<p>This is the main content...</p>',
      description: 'Rendered HTML version of body'
    }),
    metadata: z
      .object({
        filePath: z.string().optional(),
        fileType: z.string().optional(),
        editorType: z.string().optional(),
        parsedAt: z.number().optional()
      })
      .optional()
      .openapi({
        description: 'Additional parse metadata'
      })
  })
  .openapi('ParseResult')

// Parser registry entry schema
export const ParserRegistryEntrySchema = z
  .object({
    key: z.string().openapi({
      example: 'markdown_claude',
      description: 'Registry key (fileType_editorType)'
    }),
    config: ParserConfigSchema,
    priority: z.number().optional().openapi({
      example: 100,
      description: 'Parser priority (higher = preferred)'
    })
  })
  .openapi('ParserRegistryEntry')

// File cache entry schema
export const FileCacheEntrySchema = z
  .object({
    filePath: z.string(),
    content: z.string(),
    parsedResult: ParseResultSchema.optional(),
    stats: z.object({
      size: z.number(),
      mtime: z.number(),
      birthtime: z.number()
    }),
    cachedAt: z.number(),
    expiresAt: z.number().optional()
  })
  .openapi('FileCacheEntry')

// Parse request schema
export const ParseFileRequestSchema = z
  .object({
    filePath: z.string().optional().openapi({
      example: '.claude/commands/review.md',
      description: 'File path to parse'
    }),
    content: z.string().optional().openapi({
      example: '---\ndescription: Review code\n---\n# Review',
      description: 'Content to parse (if not reading from file)'
    }),
    fileType: FileTypeSchema.optional(),
    editorType: EditorTypeSchema.optional(),
    options: z
      .object({
        renderHtml: z.boolean().optional(),
        useCache: z.boolean().optional().default(true),
        validateSchema: z.boolean().optional().default(true)
      })
      .optional()
  })
  .refine((data) => data.filePath || data.content, {
    message: 'Either filePath or content must be provided'
  })
  .openapi('ParseFileRequest')

// Type exports
export type FileType = z.infer<typeof FileTypeSchema>
export type EditorType = z.infer<typeof EditorTypeSchema>
export type ParserConfig = z.infer<typeof ParserConfigSchema>
export type ParseResult = z.infer<typeof ParseResultSchema>
export type ParserRegistryEntry = z.infer<typeof ParserRegistryEntrySchema>
export type FileCacheEntry = z.infer<typeof FileCacheEntrySchema>
export type ParseFileRequest = z.infer<typeof ParseFileRequestSchema>
