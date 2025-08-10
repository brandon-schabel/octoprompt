import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  CreatePromptBodySchema,
  UpdatePromptBodySchema,
  PromptIdParamsSchema,
  ProjectAndPromptIdParamsSchema,
  PromptResponseSchema,
  PromptListResponseSchema,
  SuggestPromptsRequestSchema,
  SuggestPromptsResponseSchema,
  MarkdownImportRequestSchema,
  MarkdownImportResponseSchema,
  BulkImportResponseSchema,
  MarkdownExportResponseSchema,
  BatchExportRequestSchema
} from '@promptliano/schemas'
import {
  addPromptToProject,
  createPrompt,
  deletePrompt,
  getPromptById,
  listAllPrompts,
  listPromptsByProject,
  removePromptFromProject,
  updatePrompt,
  suggestPrompts,
  bulkImportMarkdownPrompts,
  exportPromptsToMarkdown,
  promptToMarkdown
} from '@promptliano/services'
import { ProjectIdParamsSchema } from '@promptliano/schemas'

// File upload constants for markdown imports
const MARKDOWN_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_EXTENSIONS: ['.md', '.markdown'],
  ALLOWED_MIME_TYPES: ['text/markdown', 'text/x-markdown', 'text/plain']
} as const

const createPromptRoute = createRoute({
  method: 'post',
  path: '/api/prompts',
  tags: ['Prompts'],
  summary: 'Create a new prompt',
  request: {
    body: {
      content: { 'application/json': { schema: CreatePromptBodySchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: PromptResponseSchema } },
      description: 'Prompt created successfully'
    },
    422: {
      // Validation Error
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    404: {
      // Project not found if projectId is provided and invalid
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Referenced project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const listAllPromptsRoute = createRoute({
  method: 'get',
  path: '/api/prompts',
  tags: ['Prompts'],
  summary: 'List all available prompts',
  responses: {
    200: {
      content: { 'application/json': { schema: PromptListResponseSchema } },
      description: 'Successfully retrieved all prompts'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const listProjectPromptsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/prompts',
  tags: ['Projects', 'Prompts'],
  summary: 'List prompts associated with a specific project',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PromptListResponseSchema } },
      description: 'Successfully retrieved project prompts'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const suggestPromptsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/suggest-prompts',
  tags: ['Projects', 'Prompts', 'AI'],
  summary: 'Get AI-suggested prompts based on user input',
  description: 'Uses AI to analyze user input and suggest the most relevant prompts from the project',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: SuggestPromptsRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuggestPromptsResponseSchema } },
      description: 'Successfully retrieved suggested prompts'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const addPromptToProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/prompts/{promptId}',
  tags: ['Projects', 'Prompts'],
  summary: 'Associate a prompt with a project',
  request: {
    params: ProjectAndPromptIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Prompt successfully associated with project'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or Prompt not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const removePromptFromProjectRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/prompts/{promptId}',
  tags: ['Projects', 'Prompts'],
  summary: 'Disassociate a prompt from a project',
  request: {
    params: ProjectAndPromptIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Prompt successfully disassociated from project'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or Prompt not found, or association does not exist'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const getPromptByIdRoute = createRoute({
  method: 'get',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: 'Get a specific prompt by its ID',
  request: {
    params: PromptIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PromptResponseSchema } },
      description: 'Successfully retrieved prompt'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Prompt not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const updatePromptRoute = createRoute({
  method: 'patch',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: "Update a prompt's details",
  request: {
    params: PromptIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdatePromptBodySchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PromptResponseSchema } },
      description: 'Prompt updated successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Prompt not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const deletePromptRoute = createRoute({
  method: 'delete',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: 'Delete a prompt',
  request: {
    params: PromptIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Prompt deleted successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Prompt not found'
    },
    422: {
      // Validation Error
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// Markdown Import/Export Routes
const importPromptsRoute = createRoute({
  method: 'post',
  path: '/api/prompts/import',
  tags: ['Prompts', 'Import/Export'],
  summary: 'Import prompts from markdown files',
  description: 'Upload and import one or more markdown files containing prompts with frontmatter',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            files: z
              .union([
                z.any().openapi({ type: 'string', format: 'binary' }),
                z.array(z.any()).openapi({ type: 'array', items: { type: 'string', format: 'binary' } })
              ])
              .openapi({
                description: 'Markdown file(s) to import (max 10MB per file)'
              }),
            projectId: z.coerce.number().int().positive().optional().openapi({
              description: 'Optional project ID to associate imported prompts with'
            }),
            overwriteExisting: z.coerce.boolean().optional().default(false).openapi({
              description: 'Whether to overwrite existing prompts with the same name'
            })
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BulkImportResponseSchema } },
      description: 'Import completed successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid file format or validation error'
    },
    413: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'File too large'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

const exportPromptRoute = createRoute({
  method: 'get',
  path: '/api/prompts/{promptId}/export',
  tags: ['Prompts', 'Import/Export'],
  summary: 'Export a single prompt as markdown',
  description: 'Download a prompt as a markdown file with frontmatter',
  request: {
    params: PromptIdParamsSchema
  },
  responses: {
    200: {
      content: {
        'application/octet-stream': {
          schema: z.string().openapi({
            type: 'string',
            format: 'binary',
            description: 'Markdown file content'
          })
        }
      },
      description: 'Prompt exported successfully',
      headers: z.object({
        'Content-Type': z.string().default('text/markdown; charset=utf-8'),
        'Content-Disposition': z.string()
      })
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Prompt not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

const exportBatchPromptsRoute = createRoute({
  method: 'post',
  path: '/api/prompts/export-batch',
  tags: ['Prompts', 'Import/Export'],
  summary: 'Export multiple prompts as markdown',
  description: 'Export multiple prompts to markdown format',
  request: {
    body: {
      content: { 'application/json': { schema: BatchExportRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MarkdownExportResponseSchema } },
      description: 'Prompts exported successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid prompt IDs provided'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

const importProjectPromptsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/prompts/import',
  tags: ['Projects', 'Prompts', 'Import/Export'],
  summary: 'Import prompts to a specific project',
  description: 'Upload and import markdown files with prompts directly to a project',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            files: z
              .union([
                z.any().openapi({ type: 'string', format: 'binary' }),
                z.array(z.any()).openapi({ type: 'array', items: { type: 'string', format: 'binary' } })
              ])
              .openapi({
                description: 'Markdown file(s) to import (max 10MB per file)'
              }),
            overwriteExisting: z.coerce.boolean().optional().default(false).openapi({
              description: 'Whether to overwrite existing prompts with the same name'
            })
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BulkImportResponseSchema } },
      description: 'Import completed successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid file format or validation error'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    413: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'File too large'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

const exportAllProjectPromptsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/prompts/export',
  tags: ['Projects', 'Prompts', 'Import/Export'],
  summary: 'Export all prompts from a project',
  description: 'Download all prompts from a project as markdown file(s)',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      format: z.enum(['single-file', 'multi-file']).optional().default('single-file').openapi({
        description: 'Export format'
      }),
      sortBy: z.enum(['name', 'created', 'updated']).optional().default('name').openapi({
        description: 'Sort order for prompts'
      }),
      sortOrder: z.enum(['asc', 'desc']).optional().default('asc').openapi({
        description: 'Sort direction'
      })
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MarkdownExportResponseSchema } },
      description: 'Project prompts exported successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

export const promptRoutes = new OpenAPIHono()
  .openapi(createPromptRoute, async (c) => {
    const body = c.req.valid('json')
    const createdPrompt = await createPrompt({
      name: body.name,
      content: body.content,
      projectId: body.projectId
    })
    return c.json({ success: true, data: createdPrompt } satisfies z.infer<typeof PromptResponseSchema>, 201)
  })
  .openapi(listAllPromptsRoute, async (c) => {
    return c.json(
      { success: true, data: await listAllPrompts() } satisfies z.infer<typeof PromptListResponseSchema>,
      200
    )
  })
  .openapi(listProjectPromptsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const projectPrompts = await listPromptsByProject(projectId)
    return c.json({ success: true, data: projectPrompts } satisfies z.infer<typeof PromptListResponseSchema>, 200)
  })
  .openapi(suggestPromptsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { userInput, limit } = c.req.valid('json')
    const suggestedPrompts = await suggestPrompts(projectId, userInput, limit)
    return c.json(
      { success: true, data: { prompts: suggestedPrompts } } satisfies z.infer<typeof SuggestPromptsResponseSchema>,
      200
    )
  })

  .openapi(addPromptToProjectRoute, async (c) => {
    const { promptId, projectId } = c.req.valid('param')
    await addPromptToProject(promptId, projectId)
    return c.json(
      { success: true, message: 'Prompt linked to project.' } satisfies z.infer<typeof OperationSuccessResponseSchema>,
      200
    )
  })
  .openapi(removePromptFromProjectRoute, async (c) => {
    const { promptId, projectId } = c.req.valid('param')
    await removePromptFromProject(promptId, projectId)
    return c.json(
      { success: true, message: 'Prompt unlinked from project.' } satisfies z.infer<
        typeof OperationSuccessResponseSchema
      >,
      200
    )
  })
  .openapi(getPromptByIdRoute, async (c) => {
    const { promptId } = c.req.valid('param')
    const prompt = await getPromptById(promptId)
    return c.json({ success: true, data: prompt } satisfies z.infer<typeof PromptResponseSchema>, 200)
  })
  .openapi(updatePromptRoute, async (c) => {
    const { promptId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedPrompt = await updatePrompt(promptId, body)
    return c.json({ success: true, data: updatedPrompt } satisfies z.infer<typeof PromptResponseSchema>, 200)
  })
  .openapi(deletePromptRoute, async (c) => {
    const { promptId } = c.req.valid('param')
    await deletePrompt(promptId)
    return c.json(
      { success: true, message: 'Prompt deleted successfully.' } satisfies z.infer<
        typeof OperationSuccessResponseSchema
      >,
      200
    )
  })

  // Markdown Import/Export Handlers
  .openapi(importPromptsRoute, async (c) => {
    const body = await c.req.formData()
    const projectId = body.get('projectId') ? parseInt(body.get('projectId') as string) : undefined
    const overwriteExisting = body.get('overwriteExisting') === 'true'

    const files: Array<{ name: string; content: string; size: number }> = []

    // Handle both single file and multiple files
    const fileEntries = body.getAll('files')
    if (!fileEntries || fileEntries.length === 0) {
      throw new Error('No files provided')
    }

    // Validate file types and size
    const { MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } = MARKDOWN_UPLOAD_CONFIG

    for (const entry of fileEntries) {
      if (entry instanceof File) {
        // Validate file extension
        const fileName = entry.name.toLowerCase()
        const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))

        if (!hasValidExtension) {
          throw new Error(`Invalid file type: ${entry.name}. Only .md and .markdown files are allowed`)
        }

        // Validate MIME type if available
        if (entry.type && entry.type !== '' && !ALLOWED_MIME_TYPES.includes(entry.type)) {
          throw new Error(`Invalid MIME type for ${entry.name}: ${entry.type}. Expected markdown or plain text`)
        }

        // Validate file size
        if (entry.size > MAX_FILE_SIZE) {
          throw new Error(`File ${entry.name} exceeds maximum size of 10MB`)
        }

        const content = await entry.text()
        files.push({
          name: entry.name,
          content,
          size: entry.size
        })
      }
    }

    if (files.length === 0) {
      throw new Error('No valid markdown files found')
    }

    const result = await bulkImportMarkdownPrompts(files, projectId)
    return c.json({ success: true, data: result } satisfies z.infer<typeof BulkImportResponseSchema>, 200)
  })

  .openapi(exportPromptRoute, async (c) => {
    const { promptId } = c.req.valid('param')
    const prompt = await getPromptById(promptId)
    const markdownContent = await promptToMarkdown(prompt)

    const filename = `${prompt.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')}.md`

    c.header('Content-Type', 'text/markdown; charset=utf-8')
    c.header('Content-Disposition', `attachment; filename="${filename}"`)

    return c.body(markdownContent)
  })

  .openapi(exportBatchPromptsRoute, async (c) => {
    const body = c.req.valid('json')
    const { promptIds, ...options } = body

    // Get all requested prompts
    const prompts = await Promise.all(
      promptIds.map(async (id: number) => {
        try {
          return await getPromptById(id)
        } catch (error) {
          throw new Error(`Prompt with ID ${id} not found`)
        }
      })
    )

    const result = await exportPromptsToMarkdown(prompts, options)
    return c.json({ success: true, data: result } satisfies z.infer<typeof MarkdownExportResponseSchema>, 200)
  })

  .openapi(importProjectPromptsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const body = await c.req.formData()
    const overwriteExisting = body.get('overwriteExisting') === 'true'

    const files: Array<{ name: string; content: string; size: number }> = []

    // Handle both single file and multiple files
    const fileEntries = body.getAll('files')
    if (!fileEntries || fileEntries.length === 0) {
      throw new Error('No files provided')
    }

    // Validate file types and size
    const { MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } = MARKDOWN_UPLOAD_CONFIG

    for (const entry of fileEntries) {
      if (entry instanceof File) {
        // Validate file extension
        const fileName = entry.name.toLowerCase()
        const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))

        if (!hasValidExtension) {
          throw new Error(`Invalid file type: ${entry.name}. Only .md and .markdown files are allowed`)
        }

        // Validate MIME type if available
        if (entry.type && entry.type !== '' && !ALLOWED_MIME_TYPES.includes(entry.type)) {
          throw new Error(`Invalid MIME type for ${entry.name}: ${entry.type}. Expected markdown or plain text`)
        }

        // Validate file size
        if (entry.size > MAX_FILE_SIZE) {
          throw new Error(`File ${entry.name} exceeds maximum size of 10MB`)
        }

        const content = await entry.text()
        files.push({
          name: entry.name,
          content,
          size: entry.size
        })
      }
    }

    if (files.length === 0) {
      throw new Error('No valid markdown files found')
    }

    const result = await bulkImportMarkdownPrompts(files, projectId)
    return c.json({ success: true, data: result } satisfies z.infer<typeof BulkImportResponseSchema>, 200)
  })

  .openapi(exportAllProjectPromptsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { format, sortBy, sortOrder } = c.req.valid('query')

    const projectPrompts = await listPromptsByProject(projectId)

    if (projectPrompts.length === 0) {
      const result = {
        success: true,
        format: format || ('single-file' as const),
        promptCount: 0,
        fileName: 'no-prompts.md',
        content: '# No Prompts Found\n\nThis project has no prompts to export.',
        metadata: {
          exportedAt: new Date().toISOString(),
          totalSize: 0,
          settings: {
            format: format || ('single-file' as const),
            includeFrontmatter: true,
            includeCreatedDate: true,
            includeUpdatedDate: true,
            includeTags: true,
            sanitizeContent: true,
            sortBy: sortBy || ('name' as const),
            sortOrder: sortOrder || ('asc' as const)
          }
        }
      }
      return c.json({ success: true, data: result } satisfies z.infer<typeof MarkdownExportResponseSchema>, 200)
    }

    const result = await exportPromptsToMarkdown(projectPrompts, {
      format,
      sortBy,
      sortOrder
    })

    return c.json({ success: true, data: result } satisfies z.infer<typeof MarkdownExportResponseSchema>, 200)
  })

export type PromptRouteTypes = typeof promptRoutes
