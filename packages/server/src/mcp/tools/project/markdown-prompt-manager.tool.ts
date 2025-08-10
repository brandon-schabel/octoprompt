import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  MarkdownPromptManagerAction,
  MarkdownPromptManagerSchema
} from '../shared'
import {
  parseMarkdownToPrompt,
  promptToMarkdown,
  validateMarkdownContent,
  bulkImportMarkdownPrompts,
  exportPromptsToMarkdown,
  getPromptById,
  listPromptsByProject,
  listAllPrompts,
  createPrompt,
  type File,
  type ExportOptions
} from '@promptliano/services'
import { addPromptToProject } from '@promptliano/services'

export const markdownPromptManagerTool: MCPToolDefinition = {
  name: 'markdown_prompt_manager',
  description:
    'Manage prompts via markdown import/export operations. Actions: import_markdown, export_markdown, validate_markdown, bulk_import',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(MarkdownPromptManagerAction)
      },
      projectId: {
        type: 'number',
        description:
          'The project ID (optional for most actions, used to associate imported prompts with project). Example: 1754713756748'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For import_markdown: { content: "markdown content" }. For export_markdown: { promptIds: [123, 456] } OR { projectId: 123 }. For validate_markdown: { content: "markdown content" }. For bulk_import: { files: [{ name: "file.md", content: "content", size: 1024 }] }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'markdown_prompt_manager',
    async (args: z.infer<typeof MarkdownPromptManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case MarkdownPromptManagerAction.IMPORT_MARKDOWN: {
            const content = validateDataField<string>(
              data,
              'content',
              'string',
              '"---\\nname: My Prompt\\n---\\nPrompt content here"'
            )

            try {
              // Parse the markdown content
              const parsedPrompt = await parseMarkdownToPrompt(content)

              // Create the prompt
              const newPrompt = await createPrompt({
                name: parsedPrompt.frontmatter.name,
                content: parsedPrompt.content,
                projectId
              })

              // Auto-associate with project if projectId is provided and not already set
              if (projectId && !newPrompt.projectId) {
                try {
                  await addPromptToProject(newPrompt.id, projectId)
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `Successfully imported markdown prompt: "${parsedPrompt.frontmatter.name}" (ID: ${newPrompt.id}) and associated with project ${projectId}`
                      }
                    ]
                  }
                } catch (error) {
                  // Return success for creation even if association fails
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `Successfully imported markdown prompt: "${parsedPrompt.frontmatter.name}" (ID: ${newPrompt.id})\nNote: Failed to associate with project ${projectId}`
                      }
                    ]
                  }
                }
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: `Successfully imported markdown prompt: "${parsedPrompt.frontmatter.name}" (ID: ${newPrompt.id})`
                  }
                ]
              }
            } catch (error) {
              throw createMCPError(
                MCPErrorCode.INVALID_PARAMS,
                `Failed to import markdown: ${error instanceof Error ? error.message : String(error)}`,
                { action, content: content.substring(0, 100) + '...' }
              )
            }
          }

          case MarkdownPromptManagerAction.EXPORT_MARKDOWN: {
            let prompts: any[] = []

            // Check if we're exporting by promptIds or projectId
            if (data?.promptIds && Array.isArray(data.promptIds)) {
              // Export specific prompts by IDs
              const promptIds = validateDataField<number[]>(data, 'promptIds', 'array', '[123, 456]')

              try {
                prompts = await Promise.all(
                  promptIds.map(async (id: number) => {
                    const prompt = await getPromptById(id)
                    return prompt
                  })
                )
              } catch (error) {
                throw createMCPError(
                  MCPErrorCode.PROMPT_NOT_FOUND,
                  `Failed to retrieve one or more prompts: ${error instanceof Error ? error.message : String(error)}`,
                  { action, promptIds }
                )
              }
            } else if (projectId) {
              // Export all prompts from a project
              try {
                prompts = await listPromptsByProject(projectId)
                if (prompts.length === 0) {
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `No prompts found for project ${projectId}`
                      }
                    ]
                  }
                }
              } catch (error) {
                throw createMCPError(
                  MCPErrorCode.PROMPT_NOT_FOUND,
                  `Failed to retrieve prompts for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
                  { action, projectId }
                )
              }
            } else {
              throw createMCPError(
                MCPErrorCode.INVALID_PARAMS,
                'Either promptIds array or projectId must be provided for export',
                { action, data }
              )
            }

            // Export options from data
            const exportOptions: ExportOptions = {
              format: data?.format || 'single-file',
              includeFrontmatter: data?.includeFrontmatter !== false,
              includeCreatedDate: data?.includeCreatedDate !== false,
              includeUpdatedDate: data?.includeUpdatedDate !== false,
              includeTags: data?.includeTags !== false,
              sanitizeContent: data?.sanitizeContent !== false,
              sortBy: data?.sortBy || 'name',
              sortOrder: data?.sortOrder || 'asc'
            }

            try {
              const result = await exportPromptsToMarkdown(prompts, exportOptions)

              if (result.format === 'single-file') {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Exported ${result.promptCount} prompts to markdown (${Math.round((result.metadata.totalSize / 1024) * 100) / 100}KB)\n\nFilename: ${result.fileName}\n\nContent:\n${result.content}`
                    }
                  ]
                }
              } else {
                const fileList = result.files?.map((file) => `- ${file.fileName} (${file.promptName})`).join('\n') || ''

                return {
                  content: [
                    {
                      type: 'text',
                      text: `Exported ${result.promptCount} prompts to ${result.files?.length} markdown files (${Math.round((result.metadata.totalSize / 1024) * 100) / 100}KB)\n\nFiles:\n${fileList}\n\nUse individual file exports to get specific content.`
                    }
                  ]
                }
              }
            } catch (error) {
              throw createMCPError(
                MCPErrorCode.SERVICE_ERROR,
                `Failed to export markdown: ${error instanceof Error ? error.message : String(error)}`,
                { action, promptCount: prompts.length }
              )
            }
          }

          case MarkdownPromptManagerAction.VALIDATE_MARKDOWN: {
            const content = validateDataField<string>(
              data,
              'content',
              'string',
              '"---\\nname: My Prompt\\n---\\nPrompt content here"'
            )

            try {
              const validationResult = await validateMarkdownContent(content)
              const validation = validationResult.validation

              let statusText = validationResult.isValid ? '✅ Valid' : '❌ Invalid'
              let details = `Status: ${statusText}\n`

              details += `Frontmatter: ${validation.hasValidFrontmatter ? '✅' : '❌'}\n`
              details += `Required fields: ${validation.hasRequiredFields ? '✅' : '❌'}\n`
              details += `Content length: ${validation.contentLength} characters\n`
              details += `Estimated prompts: ${validation.estimatedPrompts}\n`

              if (validation.warnings.length > 0) {
                details += `\nWarnings:\n${validation.warnings.map((w) => `- ${w}`).join('\n')}`
              }

              if (validation.errors.length > 0) {
                details += `\nErrors:\n${validation.errors.map((e) => `- ${e}`).join('\n')}`
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: `Markdown Validation Results:\n\n${details}`
                  }
                ]
              }
            } catch (error) {
              throw createMCPError(
                MCPErrorCode.INVALID_PARAMS,
                `Failed to validate markdown: ${error instanceof Error ? error.message : String(error)}`,
                { action, content: content.substring(0, 100) + '...' }
              )
            }
          }

          case MarkdownPromptManagerAction.BULK_IMPORT: {
            const files = validateDataField<File[]>(
              data,
              'files',
              'array',
              '[{ "name": "prompt1.md", "content": "---\\nname: Test\\n---\\nContent", "size": 1024 }]'
            )

            if (!Array.isArray(files) || files.length === 0) {
              throw createMCPError(MCPErrorCode.INVALID_REQUEST, 'Files array is required and cannot be empty', {
                action,
                filesCount: 0
              })
            }

            // Validate file structure
            for (let i = 0; i < files.length; i++) {
              const file = files[i]
              if (!file || typeof file !== 'object') {
                throw createMCPError(MCPErrorCode.INVALID_REQUEST, `File at index ${i} is not a valid file object`, {
                  action,
                  fileIndex: i
                })
              }
              if (!file.name || !file.content || typeof file.size !== 'number') {
                throw createMCPError(
                  MCPErrorCode.INVALID_PARAMS,
                  `File at index ${i} missing required fields: name, content, size`,
                  { action, fileIndex: i, fileName: file.name }
                )
              }
            }

            try {
              const result = await bulkImportMarkdownPrompts(files, projectId)

              let statusText = result.success ? '✅ Success' : '❌ Failed'
              let summary = `Bulk Import Results: ${statusText}\n\n`

              summary += `Files: ${result.filesProcessed}/${result.totalFiles} processed\n`
              summary += `Prompts: ${result.promptsImported}/${result.totalPrompts} imported\n`
              summary += `Summary: ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.skipped} skipped, ${result.summary.failed} failed\n`

              if (result.fileResults.length > 0) {
                summary += '\nFile Details:\n'
                for (const fileResult of result.fileResults) {
                  const fileStatus = fileResult.success ? '✅' : '❌'
                  summary += `${fileStatus} ${fileResult.fileName}: ${fileResult.promptsImported}/${fileResult.promptsProcessed} imported\n`

                  if (fileResult.errors.length > 0) {
                    summary += `   Errors: ${fileResult.errors.join(', ')}\n`
                  }
                  if (fileResult.warnings.length > 0) {
                    summary += `   Warnings: ${fileResult.warnings.join(', ')}\n`
                  }
                }
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: summary
                  }
                ]
              }
            } catch (error) {
              throw createMCPError(
                MCPErrorCode.SERVICE_ERROR,
                `Bulk import failed: ${error instanceof Error ? error.message : String(error)}`,
                { action, filesCount: files.length }
              )
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(MarkdownPromptManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'markdown_prompt_manager',
                action: args.action
              })

        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
