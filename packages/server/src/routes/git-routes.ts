import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  getProjectGitStatusResponseSchema,
  gitStatusResultSchema,
  stageFilesRequestSchema,
  unstageFilesRequestSchema,
  gitOperationResponseSchema
} from '@octoprompt/schemas'
import * as gitService from '@octoprompt/services'

export const gitRoutes = new OpenAPIHono()

const getProjectGitStatusRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/status',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: getProjectGitStatusResponseSchema
        }
      },
      description: 'Git status for the project'
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string()
          })
        }
      },
      description: 'Project not found'
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string()
          })
        }
      },
      description: 'Internal server error'
    }
  },
  tags: ['Git'],
  description: 'Get the git status for a project including file changes, branch info, and staging status'
})

gitRoutes.openapi(getProjectGitStatusRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const result = await gitService.getProjectGitStatus(projectId)

    return c.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[GitStatus] Error:', error)
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
        message: 'An unexpected error occurred'
      },
      500
    )
  }
})

// Stage files route
const stageFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stage',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: stageFilesRequestSchema
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
      description: 'Files staged successfully'
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
  description: 'Stage files for commit in a git repository'
})

gitRoutes.openapi(stageFilesRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { filePaths } = c.req.valid('json')

    await gitService.stageFiles(projectId, filePaths)

    return c.json({
      success: true,
      message: `Successfully staged ${filePaths.length} file(s)`
    })
  } catch (error) {
    console.error('[StageFiles] Error:', error)
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
        message: 'Failed to stage files'
      },
      500
    )
  }
})

// Unstage files route
const unstageFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/unstage',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: unstageFilesRequestSchema
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
      description: 'Files unstaged successfully'
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
  description: 'Unstage files from the git staging area'
})

gitRoutes.openapi(unstageFilesRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { filePaths } = c.req.valid('json')

    await gitService.unstageFiles(projectId, filePaths)

    return c.json({
      success: true,
      message: `Successfully unstaged ${filePaths.length} file(s)`
    })
  } catch (error) {
    console.error('[UnstageFiles] Error:', error)
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
        message: 'Failed to unstage files'
      },
      500
    )
  }
})

// Stage all files route
const stageAllRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stage-all',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'All files staged successfully'
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
  description: 'Stage all modified files in the git repository'
})

gitRoutes.openapi(stageAllRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')

    await gitService.stageAll(projectId)

    return c.json({
      success: true,
      message: 'Successfully staged all files'
    })
  } catch (error) {
    console.error('[StageAll] Error:', error)
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
        message: 'Failed to stage all files'
      },
      500
    )
  }
})

// Unstage all files route
const unstageAllRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/unstage-all',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'All files unstaged successfully'
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
  description: 'Unstage all files from the git staging area'
})

gitRoutes.openapi(unstageAllRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')

    await gitService.unstageAll(projectId)

    return c.json({
      success: true,
      message: 'Successfully unstaged all files'
    })
  } catch (error) {
    console.error('[UnstageAll] Error:', error)
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
        message: 'Failed to unstage all files'
      },
      500
    )
  }
})

// Commit changes route
const commitRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/commit',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().min(1, 'Commit message is required')
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
      description: 'Changes committed successfully'
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
  description: 'Commit staged changes to the git repository'
})

gitRoutes.openapi(commitRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { message } = c.req.valid('json')

    await gitService.commitChanges(projectId, message)

    return c.json({
      success: true,
      message: 'Successfully committed changes'
    })
  } catch (error) {
    console.error('[Commit] Error:', error)
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
        message: 'Failed to commit changes'
      },
      500
    )
  }
})
