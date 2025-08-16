/**
 * Git Commit Routes
 * Handles commit creation, logs, and commit details
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  gitCommitSchema as GitCommitSchema,
  gitLogResponseSchema as GitCommitLogSchema,
  gitLogEnhancedResponseSchema as GitCommitLogEnhancedSchema,
  gitDiffSchema as GitDiffSchema,
  ProjectIdParamsSchema,
  gitCommitDetailResponseSchema as GitCommitDetailSchema
} from '@promptliano/schemas'
import { z } from '@hono/zod-openapi'

// Define missing schemas locally
const CommitBodySchema = z.object({
  message: z.string().min(1)
})

const CommitLogQuerySchema = z.object({
  maxCount: z.coerce.number().optional().default(50),
  skip: z.coerce.number().optional().default(0),
  author: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  grep: z.string().optional(),
  branch: z.string().optional()
})
import * as gitService from '@promptliano/services'
import { createStandardResponses, createRouteHandler, successResponse, operationSuccessResponse } from '../../utils/route-helpers'

// Response schemas
const CommitLogResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(GitCommitSchema)
}).openapi('CommitLogResponse')

const CommitLogEnhancedResponseSchema = z.object({
  success: z.literal(true),
  data: GitCommitLogEnhancedSchema
}).openapi('CommitLogEnhancedResponse')

const CommitDetailResponseSchema = z.object({
  success: z.literal(true),
  data: GitCommitDetailSchema
}).openapi('CommitDetailResponse')

const DiffResponseSchema = z.object({
  success: z.literal(true),
  data: GitDiffSchema
}).openapi('DiffResponse')

// Create commit
const commitRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/commit',
  tags: ['Git', 'Commits'],
  summary: 'Create a new commit',
  description: 'Creates a new commit with staged changes',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: CommitBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Get commit log
const getCommitLogRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/log',
  tags: ['Git', 'Commits'],
  summary: 'Get commit history',
  description: 'Retrieves the commit history for the project',
  request: {
    params: ProjectIdParamsSchema,
    query: CommitLogQuerySchema
  },
  responses: createStandardResponses(CommitLogResponseSchema)
})

// Get enhanced commit log
const getCommitLogEnhancedRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/log-enhanced',
  tags: ['Git', 'Commits'],
  summary: 'Get enhanced commit history',
  description: 'Retrieves detailed commit history with additional metadata',
  request: {
    params: ProjectIdParamsSchema,
    query: CommitLogQuerySchema
  },
  responses: createStandardResponses(CommitLogEnhancedResponseSchema)
})

// Get commit details
const getCommitDetailRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/commits/{commitHash}',
  tags: ['Git', 'Commits'],
  summary: 'Get commit details',
  description: 'Retrieves detailed information about a specific commit',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
      commitHash: z.string()
    })
  },
  responses: createStandardResponses(CommitDetailResponseSchema)
})

// Get file diff
const getFileDiffRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/diff',
  tags: ['Git', 'Diff'],
  summary: 'Get file diff',
  description: 'Retrieves the diff for a specific file',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      filePath: z.string().openapi({
        description: 'Path to the file to diff'
      }),
      cached: z.coerce.boolean().optional().default(false).openapi({
        description: 'Whether to get the cached/staged diff'
      })
    })
  },
  responses: createStandardResponses(DiffResponseSchema)
})

// Export routes with simplified handlers
export const gitCommitRoutes = new OpenAPIHono()
  .openapi(
    commitRoute,
    createRouteHandler<{ projectId: number }, void, typeof CommitBodySchema._type>(
      async ({ params, body }) => {
        await gitService.commitChanges(params!.projectId, body!.message)
        gitService.clearGitStatusCache(params!.projectId)
        return operationSuccessResponse('Commit created successfully')
      }
    )
  )
  .openapi(
    getCommitLogRoute,
    createRouteHandler<{ projectId: number }, z.infer<typeof CommitLogQuerySchema>>(
      async ({ params, query }) => {
        const { maxCount = 50, skip = 0, author, since, until, grep, branch } = query || {}
        
        const commits = await gitService.getCommitLog(params!.projectId, {
          maxCount,
          skip,
          author,
          since,
          until,
          grep,
          branch
        })
        
        return successResponse(commits)
      }
    )
  )
  .openapi(
    getCommitLogEnhancedRoute,
    createRouteHandler<{ projectId: number }, z.infer<typeof CommitLogQuerySchema>>(
      async ({ params, query }) => {
        const { maxCount = 50, skip = 0, author, since, until, grep, branch } = query || {}
        
        const result = await gitService.getCommitLogEnhanced(params!.projectId, {
          maxCount,
          skip,
          author,
          since,
          until,
          grep,
          branch
        })
        
        return successResponse(result)
      }
    )
  )
  .openapi(
    getCommitDetailRoute,
    createRouteHandler<{ projectId: number; commitHash: string }>(async ({ params }) => {
      const detail = await gitService.getCommitDetail(params!.projectId, params!.commitHash)
      return successResponse(detail)
    })
  )
  .openapi(
    getFileDiffRoute,
    createRouteHandler<{ projectId: number }, { filePath: string; cached?: boolean }>(
      async ({ params, query }) => {
        const { filePath, cached = false } = query!
        const diff = await gitService.getFileDiff(params!.projectId, filePath, cached)
        return successResponse(diff)
      }
    )
  )

export type GitCommitRouteTypes = typeof gitCommitRoutes