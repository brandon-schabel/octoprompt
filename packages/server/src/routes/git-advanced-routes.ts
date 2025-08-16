import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  gitOperationResponseSchema,
  gitRemoteSchema,
  gitTagSchema,
  gitStashSchema,
  gitPushRequestSchema,
  gitResetRequestSchema,
  ApiErrorResponseSchema
} from '@promptliano/schemas'
import * as gitService from '@promptliano/services'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../utils/route-helpers'

// Define reusable response schemas
const RemotesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(gitRemoteSchema)
  })
  .openapi('RemotesResponse')

const TagsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(gitTagSchema)
  })
  .openapi('TagsResponse')

const StashListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(gitStashSchema)
  })
  .openapi('StashListResponse')

export const gitAdvancedRoutes = new OpenAPIHono()

// ============================================
// Remote Management Routes
// ============================================

// Get remotes route
const getRemotesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/remotes',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: createStandardResponses(RemotesResponseSchema),
  tags: ['Git'],
  description: 'Get all configured remotes for a git repository'
})

gitAdvancedRoutes.openapi(getRemotesRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const remotes = await gitService.getRemotes(projectId)
  return c.json(successResponse(remotes))
})

// Push route
const pushRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/push',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitPushRequestSchema
        }
      }
    }
  },
  responses: createStandardResponses(gitOperationResponseSchema),
  tags: ['Git'],
  description: 'Push changes to a remote repository'
})

gitAdvancedRoutes.openapi(pushRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { remote, branch, force, setUpstream } = c.req.valid('json')

  await gitService.push(projectId, remote || 'origin', branch, { force, setUpstream })

  return c.json(operationSuccessResponse(
    `Successfully pushed to ${remote || 'origin'}${branch ? `/${branch}` : ''}`
  ))
})

// Fetch route
const fetchRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/fetch',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            remote: z.string().optional().default('origin'),
            prune: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Fetched successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project not found'
    },
    500: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Internal server error'
    }
  },
  tags: ['Git'],
  description: 'Fetch updates from a remote repository'
})

gitAdvancedRoutes.openapi(fetchRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { remote, prune } = c.req.valid('json')

    await gitService.fetch(projectId, remote || 'origin', { prune })

    return c.json({
      success: true,
      message: `Successfully fetched from ${remote || 'origin'}`
    })
  } catch (error) {
    console.error('[Fetch] Error:', error)
    if (error instanceof Error) {
      return c.json(
        {
          success: false,
          message: error.message
        },
        500
      )
    }
    return c.json(
      {
        success: false,
        message: 'Failed to fetch from remote'
      },
      500
    )
  }
})

// Pull route
const pullRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/pull',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            remote: z.string().optional().default('origin'),
            branch: z.string().optional(),
            rebase: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Pulled successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project not found'
    },
    500: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Internal server error'
    }
  },
  tags: ['Git'],
  description: 'Pull changes from a remote repository'
})

gitAdvancedRoutes.openapi(pullRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { remote, branch, rebase } = c.req.valid('json')

    await gitService.pull(projectId, remote || 'origin', branch, { rebase })

    return c.json({
      success: true,
      message: `Successfully pulled from ${remote || 'origin'}${branch ? `/${branch}` : ''}`
    })
  } catch (error) {
    console.error('[Pull] Error:', error)
    if (error instanceof Error) {
      return c.json(
        {
          success: false,
          message: error.message
        },
        500
      )
    }
    return c.json(
      {
        success: false,
        message: 'Failed to pull changes'
      },
      500
    )
  }
})

// ============================================
// Tag Management Routes
// ============================================

// Get tags route
const getTagsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/tags',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: createStandardResponses(TagsResponseSchema),
  tags: ['Git'],
  description: 'Get all tags for a git repository'
})

gitAdvancedRoutes.openapi(getTagsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const tags = await gitService.getTags(projectId)
  return c.json(successResponse(tags))
})

// Create tag route
const createTagRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/tags',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            message: z.string().optional(),
            ref: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Tag created successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project not found'
    },
    500: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Internal server error'
    }
  },
  tags: ['Git'],
  description: 'Create a new tag in the git repository'
})

gitAdvancedRoutes.openapi(createTagRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { name, message, ref } = c.req.valid('json')

    await gitService.createTag(projectId, name, { message, ref })

    return c.json({
      success: true,
      message: `Tag '${name}' created successfully`
    })
  } catch (error) {
    console.error('[CreateTag] Error:', error)
    if (error instanceof Error) {
      return c.json(
        {
          success: false,
          message: error.message
        },
        500
      )
    }
    return c.json(
      {
        success: false,
        message: 'Failed to create tag'
      },
      500
    )
  }
})

// ============================================
// Stash Management Routes
// ============================================

// Stash changes route
const stashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Changes stashed successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project not found'
    },
    500: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Internal server error'
    }
  },
  tags: ['Git'],
  description: 'Stash current changes'
})

gitAdvancedRoutes.openapi(stashRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { message } = c.req.valid('json')

    await gitService.stash(projectId, message)

    return c.json({
      success: true,
      message: `Changes stashed successfully${message ? `: ${message}` : ''}`
    })
  } catch (error) {
    console.error('[Stash] Error:', error)
    if (error instanceof Error) {
      return c.json(
        {
          success: false,
          message: error.message
        },
        500
      )
    }
    return c.json(
      {
        success: false,
        message: 'Failed to stash changes'
      },
      500
    )
  }
})

// Get stash list route
const getStashListRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/stash',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: createStandardResponses(StashListResponseSchema),
  tags: ['Git'],
  description: 'Get list of all stashes'
})

gitAdvancedRoutes.openapi(getStashListRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const stashes = await gitService.stashList(projectId)
  return c.json(successResponse(stashes))
})

// Apply stash route
const applyStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash/apply',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ref: z.string().optional().default('stash@{0}')
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Stash applied successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project not found'
    },
    500: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Internal server error'
    }
  },
  tags: ['Git'],
  description: 'Apply a stash without removing it from the stash list'
})

gitAdvancedRoutes.openapi(applyStashRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { ref } = c.req.valid('json')

    await gitService.stashApply(projectId, ref || 'stash@{0}')

    return c.json({
      success: true,
      message: `Applied stash: ${ref || 'stash@{0}'}`
    })
  } catch (error) {
    console.error('[ApplyStash] Error:', error)
    if (error instanceof Error) {
      return c.json(
        {
          success: false,
          message: error.message
        },
        500
      )
    }
    return c.json(
      {
        success: false,
        message: 'Failed to apply stash'
      },
      500
    )
  }
})

// ============================================
// Reset & Revert Routes
// ============================================

// Reset route
const resetRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/reset',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitResetRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Reset successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project not found'
    },
    500: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Internal server error'
    }
  },
  tags: ['Git'],
  description: 'Reset current HEAD to a specified state'
})

gitAdvancedRoutes.openapi(resetRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { ref, mode } = c.req.valid('json')

    await gitService.reset(projectId, ref, mode || 'mixed')

    return c.json({
      success: true,
      message: `Reset to ${ref} (${mode || 'mixed'} mode)`
    })
  } catch (error) {
    console.error('[Reset] Error:', error)
    if (error instanceof Error) {
      return c.json(
        {
          success: false,
          message: error.message
        },
        500
      )
    }
    return c.json(
      {
        success: false,
        message: 'Failed to reset'
      },
      500
    )
  }
})
