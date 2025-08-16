/**
 * Git Status and Staging Routes
 * Handles git status, staging, and unstaging operations
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  gitStatusResultSchema as GitStatusResultSchema,
  ProjectIdParamsSchema,
  stageFilesRequestSchema as StageFilesBodySchema,
  unstageFilesRequestSchema as UnstageFilesBodySchema
} from '@promptliano/schemas'
import * as gitService from '@promptliano/services'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../../utils/route-helpers'

// Response schemas using factories
const GitStatusResponseSchema = z.object({
  success: z.literal(true),
  data: GitStatusResultSchema
}).openapi('GitStatusResponse')

// Get project git status
const getProjectGitStatusRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/status',
  tags: ['Git', 'Status'],
  summary: 'Get git status for a project',
  description: 'Retrieves the current git status including staged, unstaged, and untracked files',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      refresh: z.coerce.boolean().optional().default(false).openapi({
        description: 'Force refresh the git status (bypass cache)'
      })
    })
  },
  responses: createStandardResponses(GitStatusResponseSchema)
})

// Stage files
const stageFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stage',
  tags: ['Git', 'Staging'],
  summary: 'Stage files for commit',
  description: 'Stages specified files or patterns for the next commit',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: StageFilesBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Unstage files
const unstageFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/unstage',
  tags: ['Git', 'Staging'],
  summary: 'Unstage files from commit',
  description: 'Removes specified files from the staging area',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UnstageFilesBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Stage all changes
const stageAllRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stage-all',
  tags: ['Git', 'Staging'],
  summary: 'Stage all changes',
  description: 'Stages all modified and untracked files for commit',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'All changes staged successfully'
    },
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Unstage all changes
const unstageAllRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/unstage-all',
  tags: ['Git', 'Staging'],
  summary: 'Unstage all changes',
  description: 'Removes all files from the staging area',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'All changes unstaged successfully'
    },
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Export routes with simplified handlers using route-helpers
export const gitStatusRoutes = new OpenAPIHono()
  .openapi(
    getProjectGitStatusRoute,
    async (c) => {
      const { projectId } = c.req.valid('param')
      const { refresh = false } = c.req.valid('query') || {}
      
      // Clear cache if refresh requested
      if (refresh) {
        gitService.clearGitStatusCache(projectId)
      }
      
      const status = await gitService.getProjectGitStatus(projectId)
      return c.json(successResponse(status))
    }
  )
  .openapi(
    stageFilesRoute,
    async (c) => {
      const { projectId } = c.req.valid('param')
      const body = c.req.valid('json')
      await gitService.stageFiles(projectId, body.filePaths)
      gitService.clearGitStatusCache(projectId)
      return c.json(operationSuccessResponse('Files staged successfully'))
    }
  )
  .openapi(
    unstageFilesRoute,
    async (c) => {
      const { projectId } = c.req.valid('param')
      const body = c.req.valid('json')
      await gitService.unstageFiles(projectId, body.filePaths)
      gitService.clearGitStatusCache(projectId)
      return c.json(operationSuccessResponse('Files unstaged successfully'))
    }
  )
  .openapi(
    stageAllRoute,
    async (c) => {
      const { projectId } = c.req.valid('param')
      await gitService.stageAll(projectId)
      gitService.clearGitStatusCache(projectId)
      return c.json(operationSuccessResponse('All changes staged successfully'))
    }
  )
  .openapi(
    unstageAllRoute,
    async (c) => {
      const { projectId } = c.req.valid('param')
      await gitService.unstageAll(projectId)
      gitService.clearGitStatusCache(projectId)
      return c.json(operationSuccessResponse('All changes unstaged successfully'))
    }
  )

export type GitStatusRouteTypes = typeof gitStatusRoutes