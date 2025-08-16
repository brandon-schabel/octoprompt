/**
 * Git Stash Routes
 * Handles stash operations including create, apply, pop, and drop
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  gitStashSchema as GitStashSchema,
  ProjectIdParamsSchema
} from '@promptliano/schemas'

// Define missing schemas locally
const CreateStashBodySchema = z.object({
  message: z.string().optional()
})

const ApplyStashBodySchema = z.object({
  stashRef: z.string().optional().default('stash@{0}')
})

const PopStashBodySchema = z.object({
  stashRef: z.string().optional().default('stash@{0}')
})

const DropStashBodySchema = z.object({
  stashRef: z.string().optional().default('stash@{0}')
})
import * as gitService from '@promptliano/services'
import { createStandardResponses, createStandardResponsesWithStatus, createRouteHandler, successResponse, operationSuccessResponse } from '../../utils/route-helpers'

// Response schemas
const StashListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(GitStashSchema)
}).openapi('StashListResponse')

// Get stash list
const getStashListRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/stash',
  tags: ['Git', 'Stash'],
  summary: 'List all stashes',
  description: 'Retrieves the list of all stashed changes',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(StashListResponseSchema)
})

// Create stash
const createStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash',
  tags: ['Git', 'Stash'],
  summary: 'Create a new stash',
  description: 'Stashes the current working directory changes',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: CreateStashBodySchema } },
      required: false
    }
  },
  responses: createStandardResponsesWithStatus(
    OperationSuccessResponseSchema,
    201,
    'Stash created successfully'
  )
})

// Apply stash
const applyStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash/apply',
  tags: ['Git', 'Stash'],
  summary: 'Apply a stash',
  description: 'Applies the specified stash without removing it from the stash list',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: ApplyStashBodySchema } },
      required: false
    }
  },
  responses: {
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Pop stash
const popStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash/pop',
  tags: ['Git', 'Stash'],
  summary: 'Pop a stash',
  description: 'Applies the specified stash and removes it from the stash list',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: PopStashBodySchema } },
      required: false
    }
  },
  responses: {
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Drop stash
const dropStashRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/git/stash',
  tags: ['Git', 'Stash'],
  summary: 'Drop a stash',
  description: 'Removes the specified stash from the stash list',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: DropStashBodySchema } },
      required: false
    }
  },
  responses: {
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Export routes with simplified handlers
export const gitStashRoutes = new OpenAPIHono()
  .openapi(getStashListRoute, async (c) => {
    const projectId = parseInt(c.req.param('projectId')!, 10)
    const stashes = await gitService.stashList(projectId)
    return c.json(successResponse(stashes))
  })
  .openapi(createStashRoute, async (c) => {
    const projectId = parseInt(c.req.param('projectId')!, 10)
    const body = await c.req.json().catch(() => ({}))
    await gitService.stash(projectId, body?.message)
    gitService.clearGitStatusCache(projectId)
    return c.json(operationSuccessResponse('Stash created successfully'))
  })
  .openapi(applyStashRoute, async (c) => {
    const projectId = parseInt(c.req.param('projectId')!, 10)
    const body = await c.req.json().catch(() => ({}))
    const stashRef = body?.stashRef || 'stash@{0}'
    await gitService.stashApply(projectId, stashRef)
    gitService.clearGitStatusCache(projectId)
    return c.json(operationSuccessResponse('Stash applied successfully'))
  })
  .openapi(popStashRoute, async (c) => {
    const projectId = parseInt(c.req.param('projectId')!, 10)
    const body = await c.req.json().catch(() => ({}))
    const stashRef = body?.stashRef || 'stash@{0}'
    await gitService.stashPop(projectId, stashRef)
    gitService.clearGitStatusCache(projectId)
    return c.json(operationSuccessResponse('Stash popped successfully'))
  })
  .openapi(dropStashRoute, async (c) => {
    const projectId = parseInt(c.req.param('projectId')!, 10)
    const body = await c.req.json().catch(() => ({}))
    const stashRef = body?.stashRef || 'stash@{0}'
    await gitService.stashDrop(projectId, stashRef)
    return c.json(operationSuccessResponse('Stash dropped successfully'))
  })

export type GitStashRouteTypes = typeof gitStashRoutes