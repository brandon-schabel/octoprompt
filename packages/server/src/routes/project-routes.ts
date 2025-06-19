import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiError } from '@octoprompt/shared'
import {
  ProjectIdParamsSchema,
  CreateProjectBodySchema,
  UpdateProjectBodySchema,
  RefreshQuerySchema,
  ProjectResponseSchema,
  ProjectListResponseSchema,
  FileListResponseSchema,
  ProjectFileWithoutContentListResponseSchema,
  FileResponseSchema,
  ProjectResponseMultiStatusSchema,
  ProjectSummaryResponseSchema,
  ProjectFileSchema,
  ProjectFile,
  FileSuggestionsZodSchema
} from '@octoprompt/schemas'

import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@octoprompt/schemas'

import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { homedir as getHomedir } from 'node:os'

import * as projectService from '@octoprompt/services'
import { getFullProjectSummary } from '@octoprompt/services'
import { optimizeUserInput, syncProject, syncProjectFolder, watchersManager } from '@octoprompt/services'
import { OptimizePromptResponseSchema, OptimizeUserInputRequestSchema } from '@octoprompt/schemas'

// File operation schemas
const FileIdParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  fileId: z.coerce.number().int().positive()
})

const UpdateFileContentBodySchema = z.object({
  content: z.string()
})

const BulkCreateFilesBodySchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      name: z.string(),
      extension: z.string(),
      content: z.string(),
      size: z.coerce.number().int().nonnegative(),
      checksum: z.string().optional()
    })
  )
})

const BulkUpdateFilesBodySchema = z.object({
  updates: z.array(
    z.object({
      fileId: z.number().int().positive(),
      content: z.string()
    })
  )
})

const BulkFilesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ProjectFileSchema)
})

const SuggestFilesBodySchema = z.object({
  prompt: z.string().min(1).describe('The prompt to analyze for file suggestions'),
  limit: z.number().int().positive().optional().default(10).describe('Maximum number of files to suggest')
})

const SuggestFilesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ProjectFileSchema)
})

// Revert to version schema
const RevertToVersionBodySchema = z.object({
  versionNumber: z.number().int().positive()
})

// Existing route definitions...
const createProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects',
  tags: ['Projects'],
  summary: 'Create a new project and sync its files',
  request: {
    body: { content: { 'application/json': { schema: CreateProjectBodySchema } } }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ProjectResponseSchema } },
      description: 'Project created and initial sync started'
    },
    207: {
      content: { 'application/json': { schema: ProjectResponseMultiStatusSchema } },
      description: 'Project created, but post-creation steps encountered issues'
    },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const listProjectsRoute = createRoute({
  method: 'get',
  path: '/api/projects',
  tags: ['Projects'],
  summary: 'List all projects',
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectListResponseSchema } },
      description: 'Successfully retrieved all projects'
    },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const getProjectByIdRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Get a specific project by ID',
  request: { params: ProjectIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectResponseSchema } },
      description: 'Successfully retrieved project details'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error (invalid projectId format)'
    },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const updateProjectRoute = createRoute({
  method: 'patch',
  path: '/api/projects/{projectId}',
  tags: ['Projects'],
  summary: "Update a project's details",
  request: {
    params: ProjectIdParamsSchema,
    body: { content: { 'application/json': { schema: UpdateProjectBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectResponseSchema } },
      description: 'Project updated successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Delete a project and its associated data',
  request: { params: ProjectIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Project deleted successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const syncProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/sync',
  tags: ['Projects', 'Files'],
  summary: 'Manually trigger a full file sync for a project',
  request: { params: ProjectIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Project sync initiated successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error during sync'
    }
  }
})

const getProjectFilesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/files',
  tags: ['Projects', 'Files'],
  summary: 'Get the list of files associated with a project',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      includeAllVersions: z.coerce.boolean().optional().default(false)
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: FileListResponseSchema } },
      description: 'Successfully retrieved project files'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const getProjectFilesMetadataRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/files/metadata',
  tags: ['Projects', 'Files'],
  summary: 'Get project files metadata without content (for performance)',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectFileWithoutContentListResponseSchema } },
      description: 'Successfully retrieved project files metadata'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const updateFileContentRoute = createRoute({
  method: 'put',
  path: '/api/projects/{projectId}/files/{fileId}',
  tags: ['Projects', 'Files'],
  summary: 'Update the content of a specific file (creates new version)',
  request: {
    params: FileIdParamsSchema,
    body: { content: { 'application/json': { schema: UpdateFileContentBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: FileResponseSchema } },
      description: 'File content updated successfully (new version created)'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or file not found'
    },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const bulkUpdateFilesRoute = createRoute({
  method: 'put',
  path: '/api/projects/{projectId}/files/bulk',
  tags: ['Projects', 'Files'],
  summary: 'Update content of multiple files in a project (creates new versions)',
  request: {
    params: ProjectIdParamsSchema,
    body: { content: { 'application/json': { schema: BulkUpdateFilesBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BulkFilesResponseSchema } },
      description: 'Files updated successfully (new versions created)'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const refreshProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/refresh',
  tags: ['Projects', 'Files'],
  summary: 'Refresh project files (sync) optionally limited to a folder',
  request: {
    params: ProjectIdParamsSchema,
    query: RefreshQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: FileListResponseSchema } },
      description: 'Successfully refreshed project files'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error during refresh/sync'
    }
  }
})

const getProjectSummaryRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/summary',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get a combined summary of all files in the project',
  request: { params: ProjectIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectSummaryResponseSchema } },
      description: 'Successfully generated combined project summary'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const suggestFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/suggest-files',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Suggest relevant files based on user input and project context',
  request: {
    params: ProjectIdParamsSchema,
    body: { content: { 'application/json': { schema: SuggestFilesBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuggestFilesResponseSchema } },
      description: 'Successfully suggested files'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error or AI processing error'
    }
  }
})

const optimizeUserInputRoute = createRoute({
  method: 'post',
  path: '/api/prompt/optimize',
  tags: ['Prompts', 'AI'],
  summary: 'Optimize a user-provided prompt using an AI model',
  request: {
    body: {
      content: { 'application/json': { schema: OptimizeUserInputRequestSchema } },
      required: true,
      description: 'The user prompt context to optimize'
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OptimizePromptResponseSchema } },
      description: 'Successfully optimized the prompt'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error or AI provider error during optimization'
    }
  }
})

// --- Hono App Instance ---
export const projectRoutes = new OpenAPIHono()
  .openapi(createProjectRoute, async (c) => {
    const body = c.req.valid('json')
    let normalizedPath = body.path
    if (normalizedPath.startsWith('~')) {
      normalizedPath = normalizedPath.replace(/^~/, getHomedir())
    }
    normalizedPath = resolvePath(normalizedPath)
    console.log(`Creating project - Original path: ${body.path}, Normalized path: ${normalizedPath}`)

    const projectData = { ...body, path: normalizedPath }
    const createdProject = await projectService.createProject(projectData)
    console.log(`Project created with ID: ${createdProject.id}`)

    let syncWarning: string | undefined
    let syncError: string | undefined
    let httpStatus: 201 | 207 = 201

    try {
      if (!existsSync(createdProject.path)) {
        console.warn(`Project path does not exist: ${createdProject.path}`)
        syncWarning = 'Project created but directory does not exist. No files will be synced.'
        httpStatus = 207
      } else {
        console.log(`Starting sync for project: ${createdProject.id} at path: ${createdProject.path}`)
        await syncProject(createdProject)
        console.log(`Finished syncing files for project: ${createdProject.id}`)
        console.log(`Starting file watchers for project: ${createdProject.id}`)
        await watchersManager.startWatchingProject(createdProject, [
          'node_modules',
          'dist',
          '.git',
          '*.tmp',
          '*.db-journal'
        ])
        console.log(`File watchers started for project: ${createdProject.id}`)
        const files = await projectService.getProjectFiles(createdProject.id)
        console.log(`Synced ${files?.length || 0} files for project`)
      }
    } catch (error: any) {
      console.error(`Error during project setup: ${error}`)
      syncError = `Post-creation setup failed: ${String(error)}`
      httpStatus = 207
    }

    if (httpStatus === 201) {
      const payload = {
        success: true,
        data: createdProject
      } satisfies z.infer<typeof ProjectResponseSchema>
      return c.json(payload, 201)
    } else {
      const payload = {
        success: true,
        data: createdProject,
        ...(syncWarning && { warning: syncWarning }),
        ...(syncError && { error: syncError })
      } satisfies z.infer<typeof ProjectResponseMultiStatusSchema>
      return c.json(payload, 207)
    }
  })

  .openapi(listProjectsRoute, async (c) => {
    const projects = await projectService.listProjects()
    const payload = {
      success: true,
      data: projects
    } satisfies z.infer<typeof ProjectListResponseSchema>
    return c.json(payload, 200)
  })

  .openapi(getProjectByIdRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    const payload = {
      success: true,
      data: project
    } satisfies z.infer<typeof ProjectResponseSchema>
    return c.json(payload, 200)
  })

  .openapi(updateProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedProject = await projectService.updateProject(projectId, body)
    if (!updatedProject) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    const payload = {
      success: true,
      data: updatedProject
    } satisfies z.infer<typeof ProjectResponseSchema>
    return c.json(payload, 200)
  })

  .openapi(deleteProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const deleted = await projectService.deleteProject(projectId)
    if (!deleted) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    watchersManager.stopWatchingProject(projectId)
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Project deleted successfully.'
    }
    return c.json(payload, 200)
  })

  .openapi(syncProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    await syncProject(project)
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Project sync initiated.'
    }
    return c.json(payload, 200)
  })

  .openapi(getProjectFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    const files = await projectService.getProjectFiles(projectId)
    const payload = {
      success: true,
      data: files ?? []
    } satisfies z.infer<typeof FileListResponseSchema>
    return c.json(payload, 200)
  })

  .openapi(getProjectFilesMetadataRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    const files = await projectService.getProjectFiles(projectId)
    // Remove content from files for performance
    const filesWithoutContent = files?.map(({ content, ...fileMetadata }) => fileMetadata) ?? []
    const payload = {
      success: true,
      data: filesWithoutContent
    } satisfies z.infer<typeof ProjectFileWithoutContentListResponseSchema>
    return c.json(payload, 200)
  })

  .openapi(bulkUpdateFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { updates } = c.req.valid('json')

    // Update file content directly
    const updatedFiles: ProjectFile[] = []

    console.log({ projectId, updates, updatedFiles })

    for (const update of updates) {
      try {
        const updatedFile = await projectService.updateFileContent(projectId, update.fileId, update.content)
        updatedFiles.push(updatedFile)
      } catch (error) {
        console.error(`Failed to update file ${update.fileId}:`, error)
        // Continue with other files, but could also throw here if strict mode is desired
      }
    }

    const payload = {
      success: true,
      data: updatedFiles
    } satisfies z.infer<typeof BulkFilesResponseSchema>
    return c.json(payload, 200)
  })

  .openapi(updateFileContentRoute, async (c) => {
    const { projectId, fileId } = c.req.valid('param')
    const { content } = c.req.valid('json')

    const updatedFile = await projectService.updateFileContent(projectId, fileId, content)

    const payload = {
      success: true,
      data: updatedFile
    } satisfies z.infer<typeof FileResponseSchema>
    return c.json(payload, 200)
  })

  .openapi(refreshProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { folder } = c.req.valid('query')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    if (folder) {
      await syncProjectFolder(project, folder)
    } else {
      await syncProject(project)
    }
    const files = await projectService.getProjectFiles(projectId)
    const payload = {
      success: true,
      data: files ?? []
    } satisfies z.infer<typeof FileListResponseSchema>
    return c.json(payload, 200)
  })

  .openapi(getProjectSummaryRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    try {
      const summary = await getFullProjectSummary(projectId)

      const payload: z.infer<typeof ProjectSummaryResponseSchema> = {
        success: true,
        summary: summary
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to generate project summary: ${error instanceof Error ? error.message : String(error)}`,
        'AI_SUMMARY_ERROR'
      )
    }
  })
  .openapi(optimizeUserInputRoute, async (c) => {
    const { userContext, projectId } = c.req.valid('json')
    const optimized = await optimizeUserInput(projectId, userContext)
    const responseData = { optimizedPrompt: optimized }
    return c.json({ success: true, data: responseData } satisfies z.infer<typeof OptimizePromptResponseSchema>, 200)
  })
  .openapi(suggestFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { prompt, limit = 10 } = c.req.valid('json')

    const projectSummary = await getFullProjectSummary(projectId)
    const systemPrompt = `
<role>
You are a code assistant that recommends relevant files based on user input.
You have a list of file summaries and a user request.
</role>

<response_format>
    {"fileIds": [1234567890123, 1234567890124]}
</response_format>

<guidelines>
- Return file IDs as numbers (unix timestamps in milliseconds)
- For simple tasks: return max 5 files
- For complex tasks: return max ${Math.min(limit, 10)} files
- For very complex tasks: return max ${Math.min(limit, 20)} files
- Do not add comments in your response
- Strictly follow the JSON schema, do not add any additional properties or comments
- DO NOT RETURN THE FILE NAME UNDER ANY CIRCUMSTANCES, JUST THE FILE ID
</guidelines>
        `

    const userPrompt = `
<project_summary>
${projectSummary}
</project_summary>

<user_query>
${prompt}
</user_query>
`
    try {
      const result = await projectService.generateStructuredData({
        prompt: userPrompt,
        schema: FileSuggestionsZodSchema,
        systemMessage: systemPrompt
      })

      // Fetch the actual file objects based on the recommended file IDs
      const fileIds = result.object.fileIds
      const allFiles = await projectService.getProjectFiles(projectId)
      const recommendedFiles = allFiles?.filter((file) => fileIds.includes(file.id)) || []

      const payload = {
        success: true,
        data: recommendedFiles
      } satisfies z.infer<typeof SuggestFilesResponseSchema>

      return c.json(payload, 200)
    } catch (error: any) {
      console.error('[SuggestFiles Project] Error:', error)
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to suggest files: ${error.message}`, 'AI_SUGGESTION_ERROR')
    }
  })
  .openapi(
    createRoute({
      method: 'post',
      path: '/api/projects/{projectId}/files/summarize',
      tags: ['Projects', 'Files', 'AI'],
      summary: 'Summarize specified files in a project',
      request: {
        params: ProjectIdParamsSchema,
        body: {
          content: {
            'application/json': {
              schema: z.object({
                fileIds: z.array(z.number()).min(1).describe('Array of file IDs to summarize'),
                force: z
                  .boolean()
                  .optional()
                  .default(false)
                  .describe('Force re-summarization of already summarized files')
              })
            }
          }
        }
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: z.object({
                  included: z.number(),
                  skipped: z.number(),
                  updatedFiles: z.array(ProjectFileSchema)
                })
              })
            }
          },
          description: 'Files summarized successfully'
        },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: {
          content: { 'application/json': { schema: ApiErrorResponseSchema } },
          description: 'Internal Server Error'
        }
      }
    }),
    async (c) => {
      const { projectId } = c.req.valid('param')
      const { fileIds, force = false } = c.req.valid('json')

      const project = await projectService.getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
      }

      // If force is true, we need to call resummarizeAllFiles for each file ID
      // Otherwise use summarizeFiles which respects existing summaries
      let result
      if (force && fileIds.length > 0) {
        // For force re-summarization, we'll use the existing summarizeFiles function
        // which handles individual files properly
        result = await projectService.summarizeFiles(projectId, fileIds)
      } else {
        result = await projectService.summarizeFiles(projectId, fileIds)
      }

      return c.json(
        {
          success: true as const,
          data: result
        },
        200
      )
    }
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/api/projects/{projectId}/files/remove-summaries',
      tags: ['Projects', 'Files'],
      summary: 'Remove summaries from specified files',
      request: {
        params: ProjectIdParamsSchema,
        body: {
          content: {
            'application/json': {
              schema: z.object({
                fileIds: z.array(z.number()).min(1).describe('Array of file IDs to remove summaries from')
              })
            }
          }
        }
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: z.object({
                  removedCount: z.number(),
                  message: z.string()
                })
              })
            }
          },
          description: 'Summaries removed successfully'
        },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: {
          content: { 'application/json': { schema: ApiErrorResponseSchema } },
          description: 'Internal Server Error'
        }
      }
    }),
    async (c) => {
      const { projectId } = c.req.valid('param')
      const { fileIds } = c.req.valid('json')

      const project = await projectService.getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
      }

      const result = await projectService.removeSummariesFromFiles(projectId, fileIds)

      return c.json(
        {
          success: true as const,
          data: result
        },
        200
      )
    }
  )

export type ProjectRouteTypes = typeof projectRoutes
