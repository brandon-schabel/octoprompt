import { z } from '@hono/zod-openapi'
import { unixTSSchemaSpec, entityIdSchema, entityIdArraySchema, entityIdOptionalSchema } from './schema-utils'

// Frontmatter schema for markdown files
export const MarkdownFrontmatterSchema = z
  .object({
    name: z.string().min(1).openapi({
      example: 'My Awesome Prompt',
      description: 'The prompt name from frontmatter'
    }),
    created: z.string().datetime().optional().openapi({
      example: '2024-01-01T00:00:00Z',
      description: 'ISO 8601 datetime when the prompt was created (optional)'
    }),
    updated: z.string().datetime().optional().openapi({
      example: '2024-01-01T00:00:00Z',
      description: 'ISO 8601 datetime when the prompt was last updated (optional)'
    }),
    tags: z
      .array(z.string().min(1))
      .optional()
      .default([])
      .openapi({
        example: ['coding', 'refactoring'],
        description: 'Array of tags for categorization (optional)'
      })
  })
  .openapi('MarkdownFrontmatter')

// Parsed markdown prompt structure
export const ParsedMarkdownPromptSchema = z
  .object({
    frontmatter: MarkdownFrontmatterSchema,
    content: z.string().min(1).openapi({
      example: 'Refactor the following code to be more efficient: {code}',
      description: 'The markdown content without frontmatter'
    }),
    rawContent: z.string().openapi({
      example: '---\nname: My Prompt\n---\n\n# Content\n\nRefactor this code...',
      description: 'The original raw markdown content including frontmatter'
    })
  })
  .openapi('ParsedMarkdownPrompt')

// Markdown import request schema for file upload validation
export const MarkdownImportRequestSchema = z
  .object({
    projectId: entityIdOptionalSchema.openapi({
      description: 'Optional project ID to associate the imported prompts with'
    }),
    overwriteExisting: z.boolean().optional().default(false).openapi({
      example: false,
      description: 'Whether to overwrite existing prompts with the same name'
    }),
    validateContent: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to validate markdown content structure'
    })
  })
  .openapi('MarkdownImportRequest')

// Batch export request schema
export const BatchExportRequestSchema = z
  .object({
    promptIds: entityIdArraySchema.openapi({
      description: 'Array of prompt IDs to export'
    }),
    format: z.enum(['single-file', 'multi-file']).optional().default('single-file').openapi({
      example: 'single-file',
      description: 'Export format: single file with all prompts or separate files per prompt'
    }),
    includeFrontmatter: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to include frontmatter with metadata'
    }),
    includeCreatedDate: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to include created date in frontmatter'
    }),
    includeUpdatedDate: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to include updated date in frontmatter'
    }),
    includeTags: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to include tags in frontmatter (if available)'
    }),
    sanitizeContent: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to sanitize content for safe markdown export'
    }),
    sortBy: z.enum(['name', 'created', 'updated']).optional().default('name').openapi({
      example: 'name',
      description: 'How to sort the exported prompts'
    }),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc').openapi({
      example: 'asc',
      description: 'Sort order for exported prompts'
    })
  })
  .openapi('BatchExportRequest')

// Individual import result for a single prompt
export const PromptImportResultSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Whether this individual prompt import succeeded'
    }),
    promptName: z.string().openapi({
      example: 'Code Refactoring Prompt',
      description: 'The name of the prompt being imported'
    }),
    promptId: entityIdSchema.optional().openapi({
      description: 'ID of the created/updated prompt (only present on success)'
    }),
    error: z.string().optional().openapi({
      example: 'Prompt with this name already exists',
      description: 'Error message if import failed'
    }),
    warning: z.string().optional().openapi({
      example: 'Missing frontmatter field: created',
      description: 'Warning message for non-fatal issues'
    }),
    action: z.enum(['created', 'updated', 'skipped']).openapi({
      description: 'Action taken for this prompt'
    })
  })
  .openapi('PromptImportResult')

// Single file import result
export const MarkdownImportResultSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Overall success status of the import operation'
    }),
    fileName: z.string().openapi({
      example: 'my-prompts.md',
      description: 'Name of the imported file'
    }),
    promptsProcessed: z.number().int().min(0).openapi({
      example: 3,
      description: 'Total number of prompts found in the file'
    }),
    promptsImported: z.number().int().min(0).openapi({
      example: 2,
      description: 'Number of prompts successfully imported'
    }),
    results: z.array(PromptImportResultSchema).openapi({
      description: 'Detailed results for each prompt'
    }),
    errors: z
      .array(z.string())
      .default([])
      .openapi({
        example: ['Invalid frontmatter format'],
        description: 'Global errors that affected the entire file'
      }),
    warnings: z
      .array(z.string())
      .default([])
      .openapi({
        example: ['File contains no valid prompts'],
        description: 'Global warnings for the import operation'
      })
  })
  .openapi('MarkdownImportResult')

// Bulk import result for multiple files
export const BulkImportResultSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Overall success status (true if at least one prompt imported)'
    }),
    totalFiles: z.number().int().min(0).openapi({
      example: 5,
      description: 'Total number of files processed'
    }),
    filesProcessed: z.number().int().min(0).openapi({
      example: 4,
      description: 'Number of files successfully processed'
    }),
    totalPrompts: z.number().int().min(0).openapi({
      example: 15,
      description: 'Total number of prompts found across all files'
    }),
    promptsImported: z.number().int().min(0).openapi({
      example: 12,
      description: 'Number of prompts successfully imported'
    }),
    fileResults: z.array(MarkdownImportResultSchema).openapi({
      description: 'Results for each file processed'
    }),
    summary: z.object({
      created: z.number().int().min(0).openapi({
        example: 8,
        description: 'Number of new prompts created'
      }),
      updated: z.number().int().min(0).openapi({
        example: 4,
        description: 'Number of existing prompts updated'
      }),
      skipped: z.number().int().min(0).openapi({
        example: 3,
        description: 'Number of prompts skipped'
      }),
      failed: z.number().int().min(0).openapi({
        example: 0,
        description: 'Number of prompts that failed to import'
      })
    })
  })
  .openapi('BulkImportResult')

// Markdown export request schema
export const MarkdownExportRequestSchema = z
  .object({
    projectId: entityIdOptionalSchema.openapi({
      description: 'Optional project ID to filter prompts by project'
    }),
    promptIds: entityIdArraySchema.optional().openapi({
      description: 'Specific prompt IDs to export (if not provided, exports all prompts)'
    }),
    format: z.enum(['single-file', 'multi-file']).optional().default('single-file').openapi({
      example: 'single-file',
      description: 'Export format: single file with all prompts or separate files per prompt'
    }),
    includeFrontmatter: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to include frontmatter with metadata'
    }),
    includeCreatedDate: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to include created date in frontmatter'
    }),
    includeUpdatedDate: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to include updated date in frontmatter'
    }),
    includeTags: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to include tags in frontmatter (if available)'
    }),
    sanitizeContent: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Whether to sanitize content for safe markdown export'
    }),
    sortBy: z.enum(['name', 'created', 'updated']).optional().default('name').openapi({
      example: 'name',
      description: 'How to sort the exported prompts'
    }),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc').openapi({
      example: 'asc',
      description: 'Sort order for exported prompts'
    })
  })
  .openapi('MarkdownExportRequest')

// Export file info for multi-file exports
export const ExportedFileSchema = z
  .object({
    fileName: z.string().openapi({
      example: 'code-refactoring-prompt.md',
      description: 'Generated filename for the exported prompt'
    }),
    content: z.string().openapi({
      description: 'The markdown content of the exported prompt'
    }),
    promptId: entityIdSchema.openapi({
      description: 'ID of the source prompt'
    }),
    promptName: z.string().openapi({
      example: 'Code Refactoring Prompt',
      description: 'Name of the source prompt'
    })
  })
  .openapi('ExportedFile')

// Markdown export result schema
export const MarkdownExportResultSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Whether the export operation succeeded'
    }),
    format: z.enum(['single-file', 'multi-file']).openapi({
      description: 'The export format used'
    }),
    promptCount: z.number().int().min(0).openapi({
      example: 5,
      description: 'Number of prompts exported'
    }),
    // For single-file exports
    fileName: z.string().optional().openapi({
      example: 'exported-prompts.md',
      description: 'Filename for single-file export'
    }),
    content: z.string().optional().openapi({
      description: 'The markdown content for single-file export'
    }),
    // For multi-file exports
    files: z.array(ExportedFileSchema).optional().openapi({
      description: 'Array of exported files for multi-file export'
    }),
    metadata: z
      .object({
        exportedAt: z.string().datetime().openapi({
          example: '2024-01-01T12:00:00Z',
          description: 'ISO 8601 datetime when export was generated'
        }),
        totalSize: z.number().int().min(0).openapi({
          example: 15432,
          description: 'Total size of exported content in bytes'
        }),
        settings: MarkdownExportRequestSchema.omit({ promptIds: true }).openapi({
          description: 'Export settings used'
        })
      })
      .openapi({
        description: 'Export metadata and settings'
      })
  })
  .refine(
    (data) => {
      // Validate that appropriate fields are present based on format
      if (data.format === 'single-file') {
        return data.fileName && data.content
      } else {
        return data.files && data.files.length > 0
      }
    },
    {
      message: 'Single-file exports must have fileName and content; multi-file exports must have files array'
    }
  )
  .openapi('MarkdownExportResult')

// Response wrapper schemas
export const MarkdownImportResponseSchema = z
  .object({
    success: z.literal(true),
    data: MarkdownImportResultSchema
  })
  .openapi('MarkdownImportResponse')

export const BulkImportResponseSchema = z
  .object({
    success: z.literal(true),
    data: BulkImportResultSchema
  })
  .openapi('BulkImportResponse')

export const MarkdownExportResponseSchema = z
  .object({
    success: z.literal(true),
    data: MarkdownExportResultSchema
  })
  .openapi('MarkdownExportResponse')

// Content validation schemas for runtime checks
export const MarkdownContentValidationSchema = z
  .object({
    hasValidFrontmatter: z.boolean().openapi({
      description: 'Whether the content has valid YAML frontmatter'
    }),
    hasRequiredFields: z.boolean().openapi({
      description: 'Whether all required frontmatter fields are present'
    }),
    contentLength: z.number().int().min(0).openapi({
      description: 'Length of the content after frontmatter'
    }),
    estimatedPrompts: z.number().int().min(0).openapi({
      description: 'Estimated number of prompts based on content structure'
    }),
    warnings: z.array(z.string()).default([]).openapi({
      description: 'Content validation warnings'
    }),
    errors: z.array(z.string()).default([]).openapi({
      description: 'Content validation errors'
    })
  })
  .openapi('MarkdownContentValidation')

// File processing status for async operations
export const FileProcessingStatusSchema = z
  .object({
    status: z.enum(['pending', 'processing', 'completed', 'failed']).openapi({
      description: 'Current processing status'
    }),
    fileName: z.string().openapi({
      example: 'prompts-batch-1.md',
      description: 'Name of the file being processed'
    }),
    progress: z.number().min(0).max(100).openapi({
      example: 75.5,
      description: 'Processing progress percentage'
    }),
    processedPrompts: z.number().int().min(0).openapi({
      example: 3,
      description: 'Number of prompts processed so far'
    }),
    totalPrompts: z.number().int().min(0).openapi({
      example: 4,
      description: 'Total number of prompts detected in file'
    }),
    startedAt: unixTSSchemaSpec.openapi({
      description: 'When processing started'
    }),
    completedAt: unixTSSchemaSpec.optional().openapi({
      description: 'When processing completed (if finished)'
    }),
    error: z.string().optional().openapi({
      description: 'Error message if processing failed'
    })
  })
  .openapi('FileProcessingStatus')

// Export type definitions for use across the codebase
export type MarkdownFrontmatter = z.infer<typeof MarkdownFrontmatterSchema>
export type ParsedMarkdownPrompt = z.infer<typeof ParsedMarkdownPromptSchema>
export type MarkdownImportRequest = z.infer<typeof MarkdownImportRequestSchema>
export type PromptImportResult = z.infer<typeof PromptImportResultSchema>
export type MarkdownImportResult = z.infer<typeof MarkdownImportResultSchema>
export type BulkImportResult = z.infer<typeof BulkImportResultSchema>
export type MarkdownExportRequest = z.infer<typeof MarkdownExportRequestSchema>
export type ExportedFile = z.infer<typeof ExportedFileSchema>
export type MarkdownExportResult = z.infer<typeof MarkdownExportResultSchema>
export type MarkdownImportResponse = z.infer<typeof MarkdownImportResponseSchema>
export type BulkImportResponse = z.infer<typeof BulkImportResponseSchema>
export type MarkdownExportResponse = z.infer<typeof MarkdownExportResponseSchema>
export type MarkdownContentValidation = z.infer<typeof MarkdownContentValidationSchema>
export type FileProcessingStatus = z.infer<typeof FileProcessingStatusSchema>
export type BatchExportRequest = z.infer<typeof BatchExportRequestSchema>
