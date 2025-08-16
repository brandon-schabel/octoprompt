/**
 * Git Worktree Routes
 * Handles worktree management operations
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  gitWorktreeSchema as GitWorktreeSchema,
  ProjectIdParamsSchema,
  gitWorktreeAddRequestSchema as AddWorktreeBodySchema,
  gitWorktreeRemoveRequestSchema as RemoveWorktreeBodySchema,
  gitWorktreeLockRequestSchema as LockWorktreeBodySchema
} from '@promptliano/schemas'
import * as gitService from '@promptliano/services'
import { createStandardResponses, createRouteHandler, successResponse, operationSuccessResponse } from '../../utils/route-helpers'

// Response schemas
const WorktreeListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(GitWorktreeSchema)
}).openapi('WorktreeListResponse')

const PruneWorktreesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.string()),
  message: z.string()
}).openapi('PruneWorktreesResponse')

// List worktrees
const listWorktreesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/worktrees',
  tags: ['Git', 'Worktrees'],
  summary: 'List all worktrees',
  description: 'Retrieves the list of all worktrees for the project',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(WorktreeListResponseSchema)
})

// Add worktree
const addWorktreeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/worktrees',
  tags: ['Git', 'Worktrees'],
  summary: 'Add a new worktree',
  description: 'Creates a new worktree for the specified branch',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: AddWorktreeBodySchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Worktree added successfully'
    },
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Remove worktree
const removeWorktreeRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/git/worktrees',
  tags: ['Git', 'Worktrees'],
  summary: 'Remove a worktree',
  description: 'Removes the specified worktree',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: RemoveWorktreeBodySchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Worktree removed successfully'
    },
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Lock worktree
const lockWorktreeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/worktrees/lock',
  tags: ['Git', 'Worktrees'],
  summary: 'Lock a worktree',
  description: 'Locks the specified worktree to prevent deletion',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: LockWorktreeBodySchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Worktree locked successfully'
    },
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Unlock worktree
const unlockWorktreeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/worktrees/unlock',
  tags: ['Git', 'Worktrees'],
  summary: 'Unlock a worktree',
  description: 'Unlocks the specified worktree',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            worktreePath: z.string()
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Worktree unlocked successfully'
    },
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Prune worktrees
const pruneWorktreesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/worktrees/prune',
  tags: ['Git', 'Worktrees'],
  summary: 'Prune worktrees',
  description: 'Removes worktree entries that no longer exist',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      dryRun: z.coerce.boolean().optional().default(false).openapi({
        description: 'Perform a dry run without actually pruning'
      })
    })
  },
  responses: createStandardResponses(PruneWorktreesResponseSchema)
})

// Export routes with simplified handlers
export const gitWorktreeRoutes = new OpenAPIHono()
  .openapi(
    listWorktreesRoute,
    createRouteHandler<{ projectId: number }>(async ({ params }) => {
      const worktrees = await gitService.getWorktrees(params!.projectId)
      return successResponse(worktrees)
    })
  )
  .openapi(
    addWorktreeRoute,
    createRouteHandler<{ projectId: number }, void, typeof AddWorktreeBodySchema._type>(
      async ({ params, body }) => {
        await gitService.addWorktree(
          params!.projectId,
          body!.path,
          body!.branch,
          body!.newBranch
        )
        return operationSuccessResponse('Worktree added successfully', 201)
      }
    )
  )
  .openapi(
    removeWorktreeRoute,
    createRouteHandler<{ projectId: number }, void, typeof RemoveWorktreeBodySchema._type>(
      async ({ params, body }) => {
        await gitService.removeWorktree(
          params!.projectId,
          body!.path,
          body!.force || false
        )
        return operationSuccessResponse('Worktree removed successfully')
      }
    )
  )
  .openapi(
    lockWorktreeRoute,
    createRouteHandler<{ projectId: number }, void, typeof LockWorktreeBodySchema._type>(
      async ({ params, body }) => {
        await gitService.lockWorktree(
          params!.projectId,
          body!.path,
          body!.reason
        )
        return operationSuccessResponse('Worktree locked successfully')
      }
    )
  )
  .openapi(
    unlockWorktreeRoute,
    createRouteHandler<{ projectId: number }, void, { worktreePath: string }>(
      async ({ params, body }) => {
        await gitService.unlockWorktree(params!.projectId, body!.worktreePath)
        return operationSuccessResponse('Worktree unlocked successfully')
      }
    )
  )
  .openapi(
    pruneWorktreesRoute,
    createRouteHandler<{ projectId: number }, { dryRun?: boolean }>(
      async ({ params, query }) => {
        const { dryRun = false } = query || {}
        const prunedPaths = await gitService.pruneWorktrees(params!.projectId, dryRun)
        
        const message = dryRun
          ? `Would prune ${prunedPaths.length} worktree(s)`
          : `Pruned ${prunedPaths.length} worktree(s)`
        
        return {
          success: true as const,
          data: prunedPaths,
          message
        }
      }
    )
  )

export type GitWorktreeRouteTypes = typeof gitWorktreeRoutes