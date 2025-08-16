import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiError } from '@promptliano/shared'
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
  type ProjectFile,
  SummaryOptionsSchema,
  BatchSummaryOptionsSchema
} from '@promptliano/schemas'

import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../utils/route-helpers'

import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { homedir as getHomedir } from 'node:os'

import * as projectService from '@promptliano/services'
import { stream } from 'hono/streaming'
import { createSyncProgressTracker } from '@promptliano/services/src/utils/sync-progress-tracker'
import {
  getFullProjectSummary,
  getProjectStatistics,
  optimizeUserInput,
  syncProject,
  syncProjectFolder,
  watchersManager,
  getProjectSummaryWithOptions,
  invalidateProjectSummaryCache,
  enhancedSummarizationService,
  fileSummarizationTracker,
  fileGroupingService
} from '@promptliano/services'
import { OptimizePromptResponseSchema, OptimizeUserInputRequestSchema } from '@promptliano/schemas'

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

// Batch summarization schemas
const StartBatchSummarizationBodySchema = z.object({
  strategy: z.enum(['imports', 'directory', 'semantic', 'mixed']).default('mixed'),
  options: z
    .object({
      maxGroupSize: z.number().min(1).max(50).optional(),
      maxTokensPerGroup: z.number().min(1000).max(100000).optional(),
      priorityThreshold: z.number().min(0).max(10).optional(),
      maxConcurrentGroups: z.number().min(1).max(10).optional(),
      staleThresholdDays: z.number().min(1).max(365).optional(),
      includeStaleFiles: z.boolean().optional(),
      retryFailedFiles: z.boolean().optional()
    })
    .optional()
})

const BatchProgressResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    batchId: z.string(),
    currentGroup: z.string(),
    groupIndex: z.number(),
    totalGroups: z.number(),
    filesProcessed: z.number(),
    totalFiles: z.number(),
    tokensUsed: z.number(),
    errors: z.array(z.string())
  })
})

const FileSummarizationStatsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    projectId: z.number(),
    totalFiles: z.number(),
    summarizedFiles: z.number(),
    unsummarizedFiles: z.number(),
    staleFiles: z.number(),
    failedFiles: z.number(),
    averageTokensPerFile: z.number(),
    lastBatchRun: z.number().optional(),
    filesByStatus: z.object({
      pending: z.number(),
      in_progress: z.number(),
      completed: z.number(),
      failed: z.number(),
      skipped: z.number()
    })
  })
})

const FileGroupsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    groups: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        strategy: z.enum(['imports', 'directory', 'semantic', 'mixed']),
        fileIds: z.array(z.number()),
        estimatedTokens: z.number().optional(),
        priority: z.number()
      })
    ),
    totalFiles: z.number(),
    totalGroups: z.number(),
    estimatedTotalTokens: z.number()
  })
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
  responses: createStandardResponses(ProjectListResponseSchema)
})

const getProjectByIdRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Get a specific project by ID',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(ProjectResponseSchema)
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
  responses: createStandardResponses(ProjectResponseSchema)
})

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Delete a project and its associated data',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const syncProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/sync',
  tags: ['Projects', 'Files'],
  summary: 'Manually trigger a full file sync for a project',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const syncProjectStreamRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/sync-stream',
  tags: ['Projects', 'Files'],
  summary: 'Trigger a file sync with real-time progress updates via SSE',
  request: { params: ProjectIdParamsSchema },
  responses: {
    200: {
      content: { 
        'text/event-stream': { 
          schema: z.string().openapi({ 
            description: 'Server-sent events stream with sync progress updates' 
          })
        }
      },
      description: 'Sync progress stream'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
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
      includeAllVersions: z.coerce.boolean().optional().default(false),
      limit: z.coerce.number().int().positive().optional().describe('Maximum number of files to return'),
      offset: z.coerce.number().int().nonnegative().optional().default(0).describe('Number of files to skip')
    })
  },
  responses: createStandardResponses(FileListResponseSchema)
})

const getProjectFilesMetadataRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/files/metadata',
  tags: ['Projects', 'Files'],
  summary: 'Get project files metadata without content (for performance)',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      limit: z.coerce.number().int().positive().optional().describe('Maximum number of files to return'),
      offset: z.coerce.number().int().nonnegative().optional().default(0).describe('Number of files to skip')
    })
  },
  responses: createStandardResponses(ProjectFileWithoutContentListResponseSchema)
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
  responses: createStandardResponses(FileResponseSchema)
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
  responses: createStandardResponses(BulkFilesResponseSchema)
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
  responses: createStandardResponses(FileListResponseSchema)
})

const getProjectSummaryRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/summary',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get a combined summary of all files in the project',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(ProjectSummaryResponseSchema)
})

const getProjectSummaryAdvancedRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/summary/advanced',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get an advanced project summary with customizable options',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            depth: z.enum(['minimal', 'standard', 'detailed']).optional(),
            format: z.enum(['xml', 'json', 'markdown']).optional(),
            strategy: z.enum(['fast', 'balanced', 'thorough']).optional(),
            focus: z.array(z.string()).optional(),
            includeImports: z.boolean().optional(),
            includeExports: z.boolean().optional(),
            maxTokens: z.number().min(100).max(100000).optional(),
            progressive: z.boolean().optional(),
            expand: z.array(z.string()).optional(),
            includeMetrics: z.boolean().optional()
          })
        }
      },
      description: 'Summary generation options'
    }
  },
  responses: createStandardResponses(z.any())
})

const getProjectSummaryMetricsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/summary/metrics',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get metrics about project summary generation',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(z.any())
})

const invalidateProjectSummaryCacheRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/summary/invalidate',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Invalidate the project summary cache',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(OperationSuccessResponseSchema)
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
  responses: createStandardResponses(SuggestFilesResponseSchema)
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
  responses: createStandardResponses(OptimizePromptResponseSchema)
})

// Batch summarization routes
const startBatchSummarizationRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/batch-summarize',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Start batch summarization of unsummarized files',
  request: {
    params: ProjectIdParamsSchema,
    body: { content: { 'application/json': { schema: StartBatchSummarizationBodySchema } } }
  },
  responses: createStandardResponses(BatchProgressResponseSchema)
})

const getBatchProgressRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/batch-summarize/{batchId}',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get progress of a batch summarization operation',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      batchId: z.string()
    })
  },
  responses: createStandardResponses(BatchProgressResponseSchema)
})

const cancelBatchSummarizationRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/batch-summarize/{batchId}',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Cancel a running batch summarization',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      batchId: z.string()
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const getSummarizationStatsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/summarization-stats',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get file summarization statistics for a project',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(FileSummarizationStatsResponseSchema)
})

const previewFileGroupsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/preview-file-groups',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Preview how files would be grouped for summarization',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            strategy: z.enum(['imports', 'directory', 'semantic', 'mixed']).default('mixed'),
            maxGroupSize: z.number().min(1).max(50).optional(),
            includeStaleFiles: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(FileGroupsResponseSchema)
})

const getProjectStatisticsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/statistics',
  tags: ['Projects', 'Statistics'],
  summary: 'Get comprehensive statistics for a project',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        fileStats: z.object({
          totalFiles: z.number(),
          totalSize: z.number(),
          filesByType: z.record(z.number()),
          sizeByType: z.record(z.number()),
          filesByCategory: z.object({
            source: z.number(),
            tests: z.number(),
            docs: z.number(),
            config: z.number(),
            other: z.number()
          }),
          filesWithSummaries: z.number(),
          averageSummaryLength: z.number()
        }),
        ticketStats: z.object({
          totalTickets: z.number(),
          ticketsByStatus: z.object({
            open: z.number(),
            in_progress: z.number(),
            closed: z.number()
          }),
          ticketsByPriority: z.object({
            low: z.number(),
            normal: z.number(),
            high: z.number()
          }),
          averageTasksPerTicket: z.number()
        }),
        taskStats: z.object({
          totalTasks: z.number(),
          completedTasks: z.number(),
          completionRate: z.number(),
          tasksByTicket: z.array(
            z.object({
              ticketId: z.number(),
              ticketTitle: z.string(),
              totalTasks: z.number(),
              completedTasks: z.number()
            })
          )
        }),
        promptStats: z.object({
          totalPrompts: z.number(),
          totalTokens: z.number(),
          averagePromptLength: z.number(),
          promptTypes: z.record(z.number())
        }),
        activityStats: z.object({
          recentUpdates: z.number(),
          lastUpdateTime: z.number(),
          creationTrend: z.array(
            z.object({
              date: z.string(),
              files: z.number(),
              tickets: z.number(),
              tasks: z.number()
            })
          )
        })
      })
    })
  )
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
      return c.json(successResponse(createdProject), 201)
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
    return c.json(successResponse(projects), 200)
  })

  .openapi(getProjectByIdRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    return c.json(successResponse(project), 200)
  })

  .openapi(updateProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedProject = await projectService.updateProject(projectId, body)
    if (!updatedProject) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    return c.json(successResponse(updatedProject), 200)
  })

  .openapi(deleteProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const deleted = await projectService.deleteProject(projectId)
    if (!deleted) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    watchersManager.stopWatchingProject(projectId)
    return c.json(operationSuccessResponse('Project deleted successfully.'), 200)
  })

  .openapi(syncProjectRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    await syncProject(project)
    return c.json(operationSuccessResponse('Project sync initiated.'), 200)
  })

  .openapi(syncProjectStreamRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    // Set up SSE headers
    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    return stream(c, async (streamInstance) => {
      // Create progress tracker with callback
      const progressTracker = createSyncProgressTracker({
        onProgress: async (event) => {
          // Send progress event as SSE
          const data = JSON.stringify({
            type: 'progress',
            data: event
          })
          await streamInstance.writeln(`data: ${data}`)
          await streamInstance.writeln('') // Empty line to flush
        }
      })

      try {
        // Perform sync with progress tracking
        const results = await syncProject(project, progressTracker)
        
        // Send final success event
        const successData = JSON.stringify({
          type: 'complete',
          data: results
        })
        await streamInstance.writeln(`data: ${successData}`)
        await streamInstance.writeln('')
      } catch (error: any) {
        // Send error event
        const errorData = JSON.stringify({
          type: 'error',
          data: {
            message: error.message || 'Sync failed',
            code: error.code || 'SYNC_ERROR'
          }
        })
        await streamInstance.writeln(`data: ${errorData}`)
        await streamInstance.writeln('')
      }
    })
  })

  .openapi(getProjectFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { limit, offset } = c.req.valid('query')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    const files = await projectService.getProjectFiles(projectId, { limit, offset })
    return c.json(successResponse(files ?? []), 200)
  })

  .openapi(getProjectFilesMetadataRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { limit, offset } = c.req.valid('query')
    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }
    const files = await projectService.getProjectFiles(projectId, { limit, offset })
    // Remove content from files for performance
    const filesWithoutContent = files?.map(({ content, ...fileMetadata }) => fileMetadata) ?? []
    return c.json(successResponse(filesWithoutContent), 200)
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

    return c.json(successResponse(updatedFiles), 200)
  })

  .openapi(updateFileContentRoute, async (c) => {
    const { projectId, fileId } = c.req.valid('param')
    const { content } = c.req.valid('json')

    const updatedFile = await projectService.updateFileContent(projectId, fileId, content)

    return c.json(successResponse(updatedFile), 200)
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
    return c.json(successResponse(files ?? []), 200)
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

  .openapi(getProjectSummaryAdvancedRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const options = c.req.valid('json')

    try {
      // Validate options
      const validatedOptions = SummaryOptionsSchema.parse(options)

      // Get summary with options
      const result = await getProjectSummaryWithOptions(projectId, validatedOptions)

      return c.json(result, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to generate advanced project summary: ${error instanceof Error ? error.message : String(error)}`,
        'AI_SUMMARY_ERROR'
      )
    }
  })

  .openapi(getProjectSummaryMetricsRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    try {
      // Get summary with metrics enabled
      const result = await getProjectSummaryWithOptions(projectId, {
        depth: 'standard',
        format: 'xml',
        strategy: 'balanced',
        includeImports: true,
        includeExports: true,
        progressive: false,
        includeMetrics: true
      })

      if (!result.metrics) {
        throw new ApiError(500, 'Failed to generate metrics', 'METRICS_GENERATION_ERROR')
      }

      const payload = {
        success: true,
        data: {
          metrics: result.metrics,
          version: result.version
        }
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to retrieve summary metrics: ${error instanceof Error ? error.message : String(error)}`,
        'AI_METRICS_ERROR'
      )
    }
  })

  .openapi(invalidateProjectSummaryCacheRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    try {
      // Verify project exists
      const project = await projectService.getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
      }

      invalidateProjectSummaryCache(projectId)

      const payload: z.infer<typeof OperationSuccessResponseSchema> = {
        success: true,
        message: 'Project summary cache invalidated successfully'
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to invalidate cache: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_INVALIDATION_ERROR'
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

    try {
      const recommendedFiles = await projectService.suggestFiles(projectId, prompt, limit)

      return c.json(successResponse(recommendedFiles), 200)
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
      responses: createStandardResponses(
        z.object({
          success: z.literal(true),
          data: z.object({
            included: z.number(),
            skipped: z.number(),
            updatedFiles: z.array(ProjectFileSchema),
            skippedReasons: z
              .object({
                empty: z.number(),
                tooLarge: z.number(),
                errors: z.number()
              })
              .optional()
          })
        })
      )
    }),
    async (c) => {
      const { projectId } = c.req.valid('param')
      const { fileIds, force = false } = c.req.valid('json')

      const project = await projectService.getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
      }

      // Pass the force parameter to summarizeFiles
      const result = await projectService.summarizeFiles(projectId, fileIds, force)

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
      responses: createStandardResponses(
        z.object({
          success: z.literal(true),
          data: z.object({
            removedCount: z.number(),
            message: z.string()
          })
        })
      )
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
  .openapi(getProjectStatisticsRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    const statistics = await getProjectStatistics(projectId)

    return c.json(
      {
        success: true as const,
        data: statistics
      },
      200
    )
  })
  .openapi(startBatchSummarizationRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { strategy, options } = c.req.valid('json')

    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    try {
      // Prepare batch options
      const batchOptions = BatchSummaryOptionsSchema.parse({
        strategy,
        ...options
      })

      // Start batch summarization (async iterator)
      const progressIterator = enhancedSummarizationService.batchSummarizeWithProgress(projectId, batchOptions)

      // Get first progress update
      const firstProgress = await progressIterator.next()
      if (firstProgress.done || !firstProgress.value) {
        throw new ApiError(500, 'Failed to start batch summarization', 'BATCH_START_ERROR')
      }

      // Store iterator for streaming updates (would need WebSocket or SSE for real-time)
      // For now, just return initial progress
      const payload = {
        success: true as const,
        data: firstProgress.value
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to start batch summarization: ${error instanceof Error ? error.message : String(error)}`,
        'BATCH_SUMMARIZATION_ERROR'
      )
    }
  })
  .openapi(getBatchProgressRoute, async (c) => {
    const { projectId, batchId } = c.req.valid('param')

    try {
      const progress = fileSummarizationTracker.getSummarizationProgress(projectId)

      if (!progress || progress.batchId !== batchId) {
        throw new ApiError(404, `Batch ${batchId} not found`, 'BATCH_NOT_FOUND')
      }

      const payload = {
        success: true as const,
        data: {
          batchId: progress.batchId,
          currentGroup: progress.currentGroup || 'Initializing',
          groupIndex: progress.processedGroups,
          totalGroups: progress.totalGroups,
          filesProcessed: progress.processedFiles,
          totalFiles: progress.totalFiles,
          tokensUsed: progress.estimatedTokensUsed,
          errors: progress.errors || []
        }
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to get batch progress: ${error instanceof Error ? error.message : String(error)}`,
        'GET_PROGRESS_ERROR'
      )
    }
  })
  .openapi(cancelBatchSummarizationRoute, async (c) => {
    const { projectId, batchId } = c.req.valid('param')

    try {
      // Cancel in tracker
      const cancelledInTracker = fileSummarizationTracker.cancelBatch(batchId)

      // Cancel in service
      const cancelledInService = enhancedSummarizationService.cancelBatch(batchId)

      if (!cancelledInTracker && !cancelledInService) {
        throw new ApiError(404, `Batch ${batchId} not found or already completed`, 'BATCH_NOT_FOUND')
      }

      const payload: z.infer<typeof OperationSuccessResponseSchema> = {
        success: true,
        message: 'Batch summarization cancelled successfully'
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to cancel batch: ${error instanceof Error ? error.message : String(error)}`,
        'CANCEL_BATCH_ERROR'
      )
    }
  })
  .openapi(getSummarizationStatsRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    try {
      const stats = await fileSummarizationTracker.getSummarizationStats(projectId)

      const payload = {
        success: true as const,
        data: stats
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to get summarization stats: ${error instanceof Error ? error.message : String(error)}`,
        'GET_STATS_ERROR'
      )
    }
  })
  .openapi(previewFileGroupsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { strategy, maxGroupSize, includeStaleFiles } = c.req.valid('json')

    const project = await projectService.getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    try {
      // Get files to group
      const unsummarizedFiles = await fileSummarizationTracker.getUnsummarizedFiles(projectId)
      const staleFiles = includeStaleFiles ? await fileSummarizationTracker.getStaleFiles(projectId) : []

      // Combine and deduplicate
      const fileMap = new Map()
      const allFilesToGroup = [...unsummarizedFiles, ...staleFiles]
      allFilesToGroup.forEach((f) => fileMap.set(f.id, f))
      const filesToGroup = Array.from(fileMap.values())

      if (filesToGroup.length === 0) {
        const payload = {
          success: true as const,
          data: {
            groups: [],
            totalFiles: 0,
            totalGroups: 0,
            estimatedTotalTokens: 0
          }
        }
        return c.json(payload, 200)
      }

      // Group files
      const groups = fileGroupingService.groupFilesByStrategy(filesToGroup, strategy, { maxGroupSize })

      // Estimate tokens
      let totalTokens = 0
      const groupsWithTokens = groups.map((group) => {
        const estimatedTokens = group.fileIds.reduce((sum, fileId) => {
          const file = fileMap.get(fileId)
          return sum + Math.ceil((file?.content?.length || 0) / 4)
        }, 0)
        totalTokens += estimatedTokens
        return {
          ...group,
          estimatedTokens
        }
      })

      const payload = {
        success: true as const,
        data: {
          groups: groupsWithTokens,
          totalFiles: filesToGroup.length,
          totalGroups: groups.length,
          estimatedTotalTokens: totalTokens
        }
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to preview file groups: ${error instanceof Error ? error.message : String(error)}`,
        'PREVIEW_GROUPS_ERROR'
      )
    }
  })

export type ProjectRouteTypes = typeof projectRoutes
