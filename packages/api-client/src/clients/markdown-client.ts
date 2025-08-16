import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { 
  DataResponseSchema
} from '../types'

// Import response schemas
import {
  MarkdownImportResponseSchema as MarkdownImportResponseSchemaZ,
  BulkImportResponseSchema as BulkImportResponseSchemaZ,
  MarkdownExportResponseSchema as MarkdownExportResponseSchemaZ,
  MarkdownContentValidationSchema as MarkdownContentValidationSchemaZ,
  MarkdownImportRequestSchema,
  MarkdownExportRequestSchema,
  BatchExportRequestSchema
} from '@promptliano/schemas'

// Types for markdown operations
export type MarkdownImportRequest = z.infer<typeof MarkdownImportRequestSchema>
export type MarkdownExportRequest = z.infer<typeof MarkdownExportRequestSchema>
export type BatchExportRequest = z.infer<typeof BatchExportRequestSchema>

/**
 * Markdown API client for importing and exporting prompts as markdown files
 */
export class MarkdownClient extends BaseApiClient {
  /**
   * Import prompts from markdown content
   */
  async importPrompts(data: MarkdownImportRequest): Promise<DataResponseSchema<any>> {
    const validatedData = this.validateBody(MarkdownImportRequestSchema, data)
    const result = await this.request('POST', '/prompts/import', {
      body: validatedData,
      responseSchema: BulkImportResponseSchemaZ
    })
    return result as DataResponseSchema<any>
  }

  /**
   * Import prompts to a specific project from markdown content
   */
  async importPromptsToProject(projectId: number, data: MarkdownImportRequest): Promise<DataResponseSchema<any>> {
    const validatedData = this.validateBody(MarkdownImportRequestSchema, {
      ...data,
      projectId
    })
    const result = await this.request('POST', '/prompts/import', {
      body: validatedData,
      responseSchema: BulkImportResponseSchemaZ
    })
    return result as DataResponseSchema<any>
  }

  /**
   * Export a single prompt as markdown
   */
  async exportPrompt(promptId: number): Promise<DataResponseSchema<any>> {
    const result = await this.request('GET', `/prompts/${promptId}/export`, {
      responseSchema: MarkdownExportResponseSchemaZ
    })
    return result as DataResponseSchema<any>
  }

  /**
   * Export multiple prompts as markdown
   */
  async exportBatch(data: BatchExportRequest): Promise<DataResponseSchema<any>> {
    const validatedData = this.validateBody(BatchExportRequestSchema, data)
    const result = await this.request('POST', '/prompts/export/batch', {
      body: validatedData,
      responseSchema: MarkdownExportResponseSchemaZ
    })
    return result as DataResponseSchema<any>
  }

  /**
   * Export prompts from a specific project
   */
  async exportProjectPrompts(projectId: number, data: MarkdownExportRequest): Promise<DataResponseSchema<any>> {
    const validatedData = this.validateBody(MarkdownExportRequestSchema, {
      ...data,
      projectId
    })
    const result = await this.request('POST', `/projects/${projectId}/prompts/export`, {
      body: validatedData,
      responseSchema: MarkdownExportResponseSchemaZ
    })
    return result as DataResponseSchema<any>
  }

  /**
   * Validate markdown content structure
   */
  async validateContent(content: string): Promise<DataResponseSchema<any>> {
    const result = await this.request('POST', '/prompts/validate-markdown', {
      body: { content },
      responseSchema: z.object({
        success: z.literal(true),
        data: MarkdownContentValidationSchemaZ
      })
    })
    return result as DataResponseSchema<any>
  }
}