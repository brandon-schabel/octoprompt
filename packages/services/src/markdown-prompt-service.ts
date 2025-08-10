import { promptStorage } from '@promptliano/storage'
import {
  type ParsedMarkdownPrompt,
  type MarkdownFrontmatter,
  type BulkImportResult,
  type MarkdownExportResult,
  type MarkdownContentValidation,
  type PromptImportResult,
  type MarkdownImportResult,
  type ExportedFile,
  type MarkdownExportRequest,
  ParsedMarkdownPromptSchema,
  MarkdownFrontmatterSchema,
  BulkImportResultSchema,
  MarkdownExportResultSchema,
  MarkdownContentValidationSchema,
  type Prompt,
  PromptSchema
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { ZodError } from 'zod'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import DOMPurify from 'isomorphic-dompurify'
import { createPrompt, getPromptById, updatePrompt, listPromptsByProject, listAllPrompts } from './prompt-service'

// Validation result interface
export interface ValidationResult {
  isValid: boolean
  validation: MarkdownContentValidation
}

// Export options interface
export interface ExportOptions {
  format?: 'single-file' | 'multi-file'
  includeFrontmatter?: boolean
  includeCreatedDate?: boolean
  includeUpdatedDate?: boolean
  includeTags?: boolean
  sanitizeContent?: boolean
  sortBy?: 'name' | 'created' | 'updated'
  sortOrder?: 'asc' | 'desc'
}

// File interface for imports
export interface File {
  name: string
  content: string
  size: number
}

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_CONTENT_LENGTH = 1024 * 1024 // 1MB per prompt content

/**
 * Parses markdown content with frontmatter to structured prompt data
 */
export async function parseMarkdownToPrompt(content: string): Promise<ParsedMarkdownPrompt> {
  try {
    if (!content || content.trim().length === 0) {
      throw new ApiError(400, 'Markdown content cannot be empty', 'EMPTY_CONTENT')
    }

    // Parse frontmatter and content using gray-matter with safe YAML loading
    const parsed = matter(content, {
      // Use yaml.load which is safe by default in js-yaml 4+
      engines: {
        yaml: (str) => yaml.load(str)
      }
    })

    // Extract and validate frontmatter
    const frontmatterData = parsed.data || {}

    // Ensure required name field exists
    if (!frontmatterData.name || typeof frontmatterData.name !== 'string' || frontmatterData.name.trim().length === 0) {
      throw new ApiError(400, 'Frontmatter must include a valid "name" field', 'MISSING_NAME_FIELD')
    }

    // Parse and validate dates if provided
    let frontmatter: MarkdownFrontmatter
    try {
      frontmatter = MarkdownFrontmatterSchema.parse({
        name: frontmatterData.name.trim(),
        created: frontmatterData.created
          ? frontmatterData.created instanceof Date
            ? frontmatterData.created.toISOString()
            : frontmatterData.created
          : undefined,
        updated: frontmatterData.updated
          ? frontmatterData.updated instanceof Date
            ? frontmatterData.updated.toISOString()
            : frontmatterData.updated
          : undefined,
        tags: Array.isArray(frontmatterData.tags)
          ? frontmatterData.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
          : []
      })
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ApiError(
          400,
          `Invalid frontmatter format: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          'INVALID_FRONTMATTER',
          error.flatten().fieldErrors
        )
      }
      throw error
    }

    // Validate content
    const promptContent = parsed.content.trim()
    if (promptContent.length === 0) {
      throw new ApiError(400, 'Prompt content cannot be empty', 'EMPTY_PROMPT_CONTENT')
    }

    if (promptContent.length > MAX_CONTENT_LENGTH) {
      throw new ApiError(
        400,
        `Prompt content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`,
        'CONTENT_TOO_LARGE'
      )
    }

    const result: ParsedMarkdownPrompt = {
      frontmatter,
      content: promptContent,
      rawContent: content
    }

    // Validate the complete result
    try {
      ParsedMarkdownPromptSchema.parse(result)
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ApiError(
          500,
          `Failed to create valid parsed markdown prompt: ${error.message}`,
          'PARSING_VALIDATION_ERROR',
          error.flatten().fieldErrors
        )
      }
      throw error
    }

    return result
  } catch (error) {
    if (error instanceof ApiError) throw error

    // Handle gray-matter parsing errors
    if (error instanceof Error && error.message.includes('YAMLException')) {
      throw new ApiError(400, `Invalid YAML frontmatter: ${error.message}`, 'INVALID_YAML')
    }

    throw new ApiError(
      500,
      `Failed to parse markdown: ${error instanceof Error ? error.message : String(error)}`,
      'MARKDOWN_PARSING_ERROR'
    )
  }
}

/**
 * Converts a prompt to markdown format with frontmatter
 */
export async function promptToMarkdown(prompt: Prompt): Promise<string> {
  try {
    // Validate input prompt
    PromptSchema.parse(prompt)

    // Build frontmatter object
    const frontmatter: Record<string, any> = {
      name: prompt.name
    }

    // Add created date if available
    if (prompt.created) {
      frontmatter.created = new Date(prompt.created).toISOString()
    }

    // Add updated date if available
    if (prompt.updated) {
      frontmatter.updated = new Date(prompt.updated).toISOString()
    }

    // Add empty tags array for future extensibility
    frontmatter.tags = []

    // Generate markdown with frontmatter
    const markdownContent = matter.stringify(prompt.content, frontmatter)

    return markdownContent
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(
        400,
        `Invalid prompt data: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'INVALID_PROMPT_DATA',
        error.flatten().fieldErrors
      )
    }

    throw new ApiError(
      500,
      `Failed to convert prompt to markdown: ${error instanceof Error ? error.message : String(error)}`,
      'MARKDOWN_CONVERSION_ERROR'
    )
  }
}

/**
 * Validates markdown content and structure
 */
export async function validateMarkdownContent(content: string): Promise<ValidationResult> {
  const validation: MarkdownContentValidation = {
    hasValidFrontmatter: false,
    hasRequiredFields: false,
    contentLength: 0,
    estimatedPrompts: 0,
    warnings: [],
    errors: []
  }

  try {
    if (!content || content.trim().length === 0) {
      validation.errors.push('Content is empty')
      return { isValid: false, validation }
    }

    if (content.length > MAX_FILE_SIZE) {
      validation.errors.push(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
      return { isValid: false, validation }
    }

    // Try to parse with gray-matter
    let parsed: matter.GrayMatterFile<string>
    try {
      parsed = matter(content)
      validation.hasValidFrontmatter = true
    } catch (error) {
      validation.errors.push(`Invalid frontmatter YAML: ${error instanceof Error ? error.message : String(error)}`)
      validation.hasValidFrontmatter = false
      return { isValid: false, validation }
    }

    // Check required fields
    const frontmatterData = parsed.data || {}
    if (frontmatterData.name && typeof frontmatterData.name === 'string' && frontmatterData.name.trim().length > 0) {
      validation.hasRequiredFields = true
    } else {
      validation.errors.push('Missing required field: name')
      validation.hasRequiredFields = false
    }

    // Validate frontmatter structure
    try {
      MarkdownFrontmatterSchema.parse({
        name: frontmatterData.name || '',
        created: frontmatterData.created || undefined,
        updated: frontmatterData.updated || undefined,
        tags: frontmatterData.tags || []
      })
    } catch (error) {
      if (error instanceof ZodError) {
        for (const issue of error.errors) {
          validation.warnings.push(`Frontmatter validation: ${issue.path.join('.')}: ${issue.message}`)
        }
      }
    }

    // Check content length
    const promptContent = parsed.content.trim()
    validation.contentLength = promptContent.length

    if (promptContent.length === 0) {
      validation.warnings.push('No content found after frontmatter - add your prompt text below the --- marker')
    } else if (promptContent.length > MAX_CONTENT_LENGTH) {
      const sizeKB = Math.round(promptContent.length / 1024)
      const maxKB = Math.round(MAX_CONTENT_LENGTH / 1024)
      validation.errors.push(
        `Content size (${sizeKB}KB) exceeds maximum of ${maxKB}KB. Consider splitting into multiple prompts.`
      )
    }

    // Estimate number of prompts (for now, assume 1 prompt per file)
    validation.estimatedPrompts = validation.hasRequiredFields && validation.contentLength > 0 ? 1 : 0

    // Check for potential issues
    if (frontmatterData.created && isNaN(Date.parse(frontmatterData.created))) {
      validation.warnings.push('Invalid created date format, expected ISO 8601')
    }

    if (frontmatterData.updated && isNaN(Date.parse(frontmatterData.updated))) {
      validation.warnings.push('Invalid updated date format, expected ISO 8601')
    }

    if (frontmatterData.tags && !Array.isArray(frontmatterData.tags)) {
      validation.warnings.push('Tags should be an array of strings')
    }

    const isValid = validation.errors.length === 0 && validation.hasRequiredFields && validation.contentLength > 0

    // Validate the complete validation object
    try {
      MarkdownContentValidationSchema.parse(validation)
    } catch (error) {
      // If validation schema itself is invalid, create a minimal valid response
      return {
        isValid: false,
        validation: {
          hasValidFrontmatter: false,
          hasRequiredFields: false,
          contentLength: 0,
          estimatedPrompts: 0,
          warnings: ['Internal validation error'],
          errors: ['Failed to validate content structure']
        }
      }
    }

    return { isValid, validation }
  } catch (error) {
    validation.errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    return { isValid: false, validation }
  }
}

/**
 * Extracts metadata from markdown frontmatter
 */
export async function extractPromptMetadata(content: string): Promise<MarkdownFrontmatter> {
  try {
    const parsed = matter(content)
    const frontmatterData = parsed.data || {}

    // Validate and return structured frontmatter
    const frontmatter = MarkdownFrontmatterSchema.parse({
      name: frontmatterData.name || '',
      created: frontmatterData.created
        ? frontmatterData.created instanceof Date
          ? frontmatterData.created.toISOString()
          : frontmatterData.created
        : undefined,
      updated: frontmatterData.updated
        ? frontmatterData.updated instanceof Date
          ? frontmatterData.updated.toISOString()
          : frontmatterData.updated
        : undefined,
      tags: Array.isArray(frontmatterData.tags)
        ? frontmatterData.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
        : []
    })

    return frontmatter
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.errors
        .map((e) => {
          const field = e.path.join('.') || 'root'
          return `${field}: ${e.message}`
        })
        .join(', ')
      throw new ApiError(
        400,
        `Invalid frontmatter structure - ${fieldErrors}. Expected format: name (string), created/updated (ISO dates), tags (array).`,
        'INVALID_FRONTMATTER',
        { fieldErrors: error.flatten().fieldErrors, issues: error.errors }
      )
    }

    throw new ApiError(
      500,
      `Failed to extract metadata from markdown: ${error instanceof Error ? error.message : 'Unknown error'}. Check that your file has valid YAML frontmatter between --- markers.`,
      'METADATA_EXTRACTION_ERROR',
      { originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Handles bulk import of multiple markdown files
 */
export async function bulkImportMarkdownPrompts(files: File[], projectId?: number): Promise<BulkImportResult> {
  const fileResults: MarkdownImportResult[] = []
  let totalPrompts = 0
  let promptsImported = 0
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  }

  try {
    // Process each file
    for (const file of files) {
      const fileResult: MarkdownImportResult = {
        success: false,
        fileName: file.name,
        promptsProcessed: 0,
        promptsImported: 0,
        results: [],
        errors: [],
        warnings: []
      }

      try {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          fileResult.errors.push(
            `File size (${Math.round((file.size / (1024 * 1024)) * 100) / 100}MB) exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
          )
          fileResults.push(fileResult)
          continue
        }

        // Validate content
        const validationResult = await validateMarkdownContent(file.content)
        if (!validationResult.isValid) {
          fileResult.errors.push(...validationResult.validation.errors)
          fileResult.warnings.push(...validationResult.validation.warnings)
          fileResults.push(fileResult)
          continue
        }

        // Parse the markdown
        const parsedPrompt = await parseMarkdownToPrompt(file.content)
        fileResult.promptsProcessed = 1
        totalPrompts += 1

        // Import the prompt
        const importResult: PromptImportResult = {
          success: false,
          promptName: parsedPrompt.frontmatter.name,
          action: 'skipped'
        }

        try {
          // Check if a prompt with this name already exists in the project
          let existingPrompts: Prompt[]
          if (projectId) {
            existingPrompts = await listPromptsByProject(projectId)
          } else {
            existingPrompts = await listAllPrompts()
          }

          const existingPrompt = existingPrompts.find((p) => p.name === parsedPrompt.frontmatter.name)

          if (existingPrompt) {
            // Update existing prompt
            const updatedPrompt = await updatePrompt(existingPrompt.id, {
              content: parsedPrompt.content
            })

            importResult.success = true
            importResult.promptId = updatedPrompt.id
            importResult.action = 'updated'
            summary.updated++
            promptsImported++
            fileResult.promptsImported++
          } else {
            // Create new prompt
            const now = Date.now()
            const createdTimestamp = parsedPrompt.frontmatter.created
              ? new Date(parsedPrompt.frontmatter.created).getTime()
              : now
            const updatedTimestamp = parsedPrompt.frontmatter.updated
              ? new Date(parsedPrompt.frontmatter.updated).getTime()
              : now

            const newPrompt = await createPrompt({
              name: parsedPrompt.frontmatter.name,
              content: parsedPrompt.content,
              projectId
            })

            // Update timestamps to match frontmatter if provided
            if (parsedPrompt.frontmatter.created || parsedPrompt.frontmatter.updated) {
              await updateTimestamps(newPrompt.id, createdTimestamp, updatedTimestamp)
            }

            importResult.success = true
            importResult.promptId = newPrompt.id
            importResult.action = 'created'
            summary.created++
            promptsImported++
            fileResult.promptsImported++
          }
        } catch (error) {
          importResult.error = error instanceof Error ? error.message : String(error)
          summary.failed++
        }

        fileResult.results.push(importResult)
        fileResult.success = importResult.success
      } catch (error) {
        fileResult.errors.push(error instanceof Error ? error.message : String(error))
        summary.failed++
      }

      fileResults.push(fileResult)
    }

    const result: BulkImportResult = {
      success: promptsImported > 0,
      totalFiles: files.length,
      filesProcessed: fileResults.filter((f) => f.promptsProcessed > 0).length,
      totalPrompts,
      promptsImported,
      fileResults,
      summary
    }

    // Validate the complete result
    BulkImportResultSchema.parse(result)

    return result
  } catch (error) {
    throw new ApiError(
      500,
      `Bulk import failed: ${error instanceof Error ? error.message : String(error)}`,
      'BULK_IMPORT_ERROR'
    )
  }
}

/**
 * Exports multiple prompts to markdown format
 */
export async function exportPromptsToMarkdown(
  prompts: Prompt[],
  options: ExportOptions = {}
): Promise<MarkdownExportResult> {
  const {
    format = 'single-file',
    includeFrontmatter = true,
    includeCreatedDate = true,
    includeUpdatedDate = true,
    includeTags = true,
    sanitizeContent = true,
    sortBy = 'name',
    sortOrder = 'asc'
  } = options

  try {
    // Validate input prompts
    const validatedPrompts = prompts.map((prompt) => {
      try {
        return PromptSchema.parse(prompt)
      } catch (error) {
        throw new ApiError(
          400,
          `Invalid prompt data for "${prompt.name || 'unnamed'}": ${error instanceof ZodError ? error.message : String(error)}`,
          'INVALID_PROMPT_DATA'
        )
      }
    })

    if (validatedPrompts.length === 0) {
      throw new ApiError(400, 'No valid prompts provided for export', 'NO_PROMPTS_TO_EXPORT')
    }

    // Sort prompts
    const sortedPrompts = [...validatedPrompts].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortBy) {
        case 'created':
          aValue = a.created || 0
          bValue = b.created || 0
          break
        case 'updated':
          aValue = a.updated || 0
          bValue = b.updated || 0
          break
        case 'name':
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortOrder === 'desc' ? -comparison : comparison
    })

    const exportedAt = new Date().toISOString()
    let totalSize = 0

    if (format === 'single-file') {
      // Export all prompts to a single file
      const sections: string[] = []

      for (const prompt of sortedPrompts) {
        const frontmatter: Record<string, any> = includeFrontmatter
          ? {
              name: prompt.name
            }
          : {}

        if (includeFrontmatter) {
          if (includeCreatedDate && prompt.created) {
            frontmatter.created = new Date(prompt.created).toISOString()
          }
          if (includeUpdatedDate && prompt.updated) {
            frontmatter.updated = new Date(prompt.updated).toISOString()
          }
          if (includeTags) {
            frontmatter.tags = []
          }
        }

        let content = prompt.content
        if (sanitizeContent) {
          // Sanitize content to prevent XSS and other security issues
          // First sanitize HTML/scripts, then escape markdown conflicts
          content = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [], // Remove all HTML tags
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true // Keep text content
          })
            .replace(/^---/gm, '\\---') // Escape frontmatter delimiters in content
            .trim()
        }

        const promptMarkdown = includeFrontmatter ? matter.stringify(content, frontmatter) : content

        sections.push(promptMarkdown)
      }

      const combinedContent = includeFrontmatter ? sections.join('\n\n---\n\n') : sections.join('\n\n')
      totalSize = Buffer.byteLength(combinedContent, 'utf8')

      const result: MarkdownExportResult = {
        success: true,
        format: 'single-file',
        promptCount: sortedPrompts.length,
        fileName: 'exported-prompts.md',
        content: combinedContent,
        metadata: {
          exportedAt,
          totalSize,
          settings: {
            format,
            includeFrontmatter,
            includeCreatedDate,
            includeUpdatedDate,
            includeTags,
            sanitizeContent,
            sortBy,
            sortOrder
          }
        }
      }

      // Validate the result
      MarkdownExportResultSchema.parse(result)
      return result
    } else {
      // Export each prompt to a separate file
      const files: ExportedFile[] = []

      for (const prompt of sortedPrompts) {
        const frontmatter: Record<string, any> = includeFrontmatter
          ? {
              name: prompt.name
            }
          : {}

        if (includeFrontmatter) {
          if (includeCreatedDate && prompt.created) {
            frontmatter.created = new Date(prompt.created).toISOString()
          }
          if (includeUpdatedDate && prompt.updated) {
            frontmatter.updated = new Date(prompt.updated).toISOString()
          }
          if (includeTags) {
            frontmatter.tags = []
          }
        }

        let content = prompt.content
        if (sanitizeContent) {
          // Sanitize content to prevent XSS and other security issues
          content = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [], // Remove all HTML tags
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true // Keep text content
          })
            .replace(/^---/gm, '\\---')
            .trim()
        }

        const promptMarkdown = includeFrontmatter ? matter.stringify(content, frontmatter) : content

        // Generate safe filename
        const safeFileName =
          prompt.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 50) + '.md'

        files.push({
          fileName: safeFileName,
          content: promptMarkdown,
          promptId: prompt.id,
          promptName: prompt.name
        })

        totalSize += Buffer.byteLength(promptMarkdown, 'utf8')
      }

      const result: MarkdownExportResult = {
        success: true,
        format: 'multi-file',
        promptCount: sortedPrompts.length,
        files,
        metadata: {
          exportedAt,
          totalSize,
          settings: {
            format,
            includeFrontmatter,
            includeCreatedDate,
            includeUpdatedDate,
            includeTags,
            sanitizeContent,
            sortBy,
            sortOrder
          }
        }
      }

      // Validate the result
      MarkdownExportResultSchema.parse(result)
      return result
    }
  } catch (error) {
    if (error instanceof ApiError) throw error

    throw new ApiError(500, `Export failed: ${error instanceof Error ? error.message : String(error)}`, 'EXPORT_ERROR')
  }
}

/**
 * Helper function to update prompt timestamps (for internal use)
 */
async function updateTimestamps(promptId: number, created: number, updated: number): Promise<void> {
  try {
    // Direct database access to update timestamps while preserving other data
    const db = promptStorage
    const allPrompts = await db.readPrompts()

    if (allPrompts[String(promptId)]) {
      allPrompts[String(promptId)] = {
        ...allPrompts[String(promptId)],
        created,
        updated
      }
      await db.writePrompts(allPrompts)
    }
  } catch (error) {
    console.warn(`Failed to update timestamps for prompt ${promptId}:`, error)
    // Non-critical error, don't throw
  }
}
