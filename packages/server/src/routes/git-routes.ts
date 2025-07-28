import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  getProjectGitStatusResponseSchema,
  gitStatusResultSchema,
  stageFilesRequestSchema,
  unstageFilesRequestSchema,
  gitOperationResponseSchema,
  gitDiffRequestSchema,
  gitDiffResponseSchema,
  gitBranchListResponseSchema,
  gitLogResponseSchema,
  gitCreateBranchRequestSchema,
  gitSwitchBranchRequestSchema,
  gitMergeBranchRequestSchema,
  gitPushRequestSchema,
  gitResetRequestSchema,
  gitBranchSchema,
  gitLogEntrySchema,
  gitCommitSchema,
  gitDiffSchema,
  gitRemoteSchema,
  gitTagSchema,
  gitStashSchema,
  gitBlameSchema,
  gitLogEnhancedRequestSchema,
  gitLogEnhancedResponseSchema,
  gitBranchListEnhancedResponseSchema,
  gitCommitDetailResponseSchema,
  gitWorktreeListResponseSchema,
  gitWorktreeAddRequestSchema,
  gitWorktreeRemoveRequestSchema,
  gitWorktreeLockRequestSchema,
  gitWorktreePruneRequestSchema,
  gitWorktreePruneResponseSchema,
  type GitLogEnhancedRequest
} from '@promptliano/schemas'
import * as gitService from '@promptliano/services'

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

// Get file diff route
const getFileDiffRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/diff',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: gitDiffRequestSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitDiffResponseSchema
        }
      },
      description: 'File diff retrieved successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitDiffResponseSchema
        }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': {
          schema: gitDiffResponseSchema
        }
      },
      description: 'Project or file not found'
    },
    500: {
      content: {
        'application/json': {
          schema: gitDiffResponseSchema
        }
      },
      description: 'Internal server error'
    }
  },
  tags: ['Git'],
  description: 'Get the diff for a specific file in the git repository'
})

gitRoutes.openapi(getFileDiffRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { filePath, staged, commit } = c.req.valid('query')

    const diff = await gitService.getFileDiff(projectId, filePath, { staged, commit })

    return c.json({
      success: true,
      data: {
        filePath,
        diff,
        staged: staged || false,
        commit
      }
    })
  } catch (error) {
    console.error('[GetFileDiff] Error:', error)
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
        message: 'Failed to get file diff'
      },
      500
    )
  }
})

// ============================================
// Branch Management Routes
// ============================================

// Get branches route
const getBranchesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/branches',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitBranchListResponseSchema
        }
      },
      description: 'List of branches retrieved successfully'
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
  description: 'Get all branches (local and remote) for a git repository'
})

gitRoutes.openapi(getBranchesRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const branches = await gitService.getBranches(projectId)

    return c.json({
      success: true,
      data: branches
    })
  } catch (error) {
    console.error('[GetBranches] Error:', error)
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
        message: 'Failed to get branches'
      },
      500
    )
  }
})

// Create branch route
const createBranchRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/branches',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitCreateBranchRequestSchema
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
      description: 'Branch created successfully'
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
  description: 'Create a new branch in the git repository'
})

gitRoutes.openapi(createBranchRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { name, startPoint } = c.req.valid('json')

    await gitService.createBranch(projectId, name, startPoint)

    return c.json({
      success: true,
      message: `Branch '${name}' created successfully`
    })
  } catch (error) {
    console.error('[CreateBranch] Error:', error)
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
        message: 'Failed to create branch'
      },
      500
    )
  }
})

// Switch branch route
const switchBranchRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/branches/switch',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitSwitchBranchRequestSchema
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
      description: 'Branch switched successfully'
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
      description: 'Project or branch not found'
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
  description: 'Switch to a different branch'
})

gitRoutes.openapi(switchBranchRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { name } = c.req.valid('json')

    await gitService.switchBranch(projectId, name)

    return c.json({
      success: true,
      message: `Switched to branch '${name}'`
    })
  } catch (error) {
    console.error('[SwitchBranch] Error:', error)
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
        message: 'Failed to switch branch'
      },
      500
    )
  }
})

// Delete branch route
const deleteBranchRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/git/branches/{branchName}',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      branchName: z.string()
    }),
    query: z.object({
      force: z
        .string()
        .optional()
        .transform((val) => val === 'true')
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Branch deleted successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project or branch not found'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Cannot delete current branch'
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
  description: 'Delete a git branch'
})

gitRoutes.openapi(deleteBranchRoute, async (c) => {
  try {
    const { projectId, branchName } = c.req.valid('param')
    const { force } = c.req.valid('query')

    await gitService.deleteBranch(projectId, branchName, force || false)

    return c.json({
      success: true,
      message: `Branch '${branchName}' deleted successfully`
    })
  } catch (error) {
    console.error('[DeleteBranch] Error:', error)
    if (error instanceof Error) {
      const statusCode = error.message.includes('Cannot delete the current branch') ? 400 : 500
      return c.json(
        {
          success: false,
          message: error.message
        },
        statusCode
      )
    }
    return c.json(
      {
        success: false,
        message: 'Failed to delete branch'
      },
      500
    )
  }
})

// ============================================
// Commit History Routes
// ============================================

// Get commit log route
const getCommitLogRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/log',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined)),
      skip: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined)),
      offset: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined)),
      branch: z.string().optional(),
      file: z.string().optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitLogResponseSchema
        }
      },
      description: 'Commit log retrieved successfully'
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
  description: 'Get the commit log for a project with optional filters'
})

gitRoutes.openapi(getCommitLogRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { limit, skip, offset, branch, file } = c.req.valid('query')

    // Use either skip or offset (offset takes precedence if both are provided)
    const skipCount = offset !== undefined ? offset : skip
    const logs = await gitService.getCommitLog(projectId, { limit, skip: skipCount, offset, branch, file })

    return c.json({
      success: true,
      data: logs,
      hasMore: limit !== undefined && logs.length === limit
    })
  } catch (error) {
    console.error('[GetCommitLog] Error:', error)
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
        message: 'Failed to get commit log'
      },
      500
    )
  }
})

// Enhanced commit log route
const getCommitLogEnhancedRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/log/enhanced',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      branch: z.string().optional(),
      page: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1)),
      perPage: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 20)),
      search: z.string().optional(),
      author: z.string().optional(),
      since: z.string().optional(),
      until: z.string().optional(),
      includeStats: z
        .string()
        .optional()
        .transform((val) => val === 'true'),
      includeFileDetails: z
        .string()
        .optional()
        .transform((val) => val === 'true')
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitLogEnhancedResponseSchema
        }
      },
      description: 'Enhanced commit log retrieved successfully'
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
  description: 'Get enhanced commit log with detailed author info, statistics, and file changes'
})

gitRoutes.openapi(getCommitLogEnhancedRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const params = c.req.valid('query')

    // Convert query params to match service expectations
    const serviceParams: GitLogEnhancedRequest = {
      page: params.page || 1,
      perPage: params.perPage || 20,
      branch: params.branch,
      search: params.search,
      author: params.author,
      since: params.since,
      until: params.until,
      includeStats: params.includeStats || false,
      includeFileDetails: params.includeFileDetails || false
    }

    console.log('[GetCommitLogEnhanced] Params:', serviceParams)
    const result = await gitService.getCommitLogEnhanced(projectId, serviceParams)
    return c.json(result)
  } catch (error) {
    console.error('[GetCommitLogEnhanced] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get enhanced commit log'
      },
      500
    )
  }
})

// Enhanced branches route
const getBranchesEnhancedRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/branches/enhanced',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitBranchListEnhancedResponseSchema
        }
      },
      description: 'Enhanced branch list retrieved successfully'
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
  description: 'Get enhanced branch list with latest commit info and tracking details'
})

gitRoutes.openapi(getBranchesEnhancedRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const result = await gitService.getBranchesEnhanced(projectId)
    return c.json(result)
  } catch (error) {
    console.error('[GetBranchesEnhanced] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get enhanced branches'
      },
      500
    )
  }
})

// Commit detail route
const getCommitDetailRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/commits/{hash}',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      hash: z.string().describe('Commit hash (full or abbreviated)')
    }),
    query: z.object({
      includeFileContents: z
        .union([z.boolean(), z.string().transform((val) => val === 'true')])
        .optional()
        .default(false)
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitCommitDetailResponseSchema
        }
      },
      description: 'Commit details retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project or commit not found'
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
  description: 'Get detailed information about a specific commit including file changes'
})

gitRoutes.openapi(getCommitDetailRoute, async (c) => {
  try {
    const { projectId, hash } = c.req.valid('param')
    const { includeFileContents } = c.req.valid('query')
    const result = await gitService.getCommitDetail(projectId, hash, includeFileContents)
    return c.json(result)
  } catch (error) {
    console.error('[GetCommitDetail] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get commit details'
      },
      500
    )
  }
})

// ============================================
// Stash Management Routes
// ============================================

// Get stash list
const getStashListRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/stash',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(gitStashSchema)
          })
        }
      },
      description: 'Stash list retrieved successfully'
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
  description: 'Get list of all stashes in the repository'
})

gitRoutes.openapi(getStashListRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const stashes = await gitService.stashList(projectId)
    return c.json({
      success: true,
      data: stashes
    })
  } catch (error) {
    console.error('[GetStashList] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get stash list'
      },
      500
    )
  }
})

// Create stash
const createStashRoute = createRoute({
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
            message: z.string().optional().describe('Optional stash message')
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
      description: 'Stash created successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'No changes to stash'
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
  description: 'Create a new stash with optional message'
})

gitRoutes.openapi(createStashRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { message } = c.req.valid('json')
    await gitService.stash(projectId, message)
    return c.json({
      success: true,
      message: 'Changes stashed successfully'
    })
  } catch (error) {
    console.error('[CreateStash] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create stash'
      },
      500
    )
  }
})

// Apply stash
const applyStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash/{ref}/apply',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      ref: z.string().describe('Stash reference (e.g. stash@{0})')
    })
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
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project or stash not found'
    },
    409: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Conflict while applying stash'
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

gitRoutes.openapi(applyStashRoute, async (c) => {
  try {
    const { projectId, ref } = c.req.valid('param')
    await gitService.stashApply(projectId, ref)
    return c.json({
      success: true,
      message: 'Stash applied successfully'
    })
  } catch (error) {
    console.error('[ApplyStash] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to apply stash'
      },
      500
    )
  }
})

// Pop stash
const popStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash/{ref}/pop',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      ref: z.string().describe('Stash reference (e.g. stash@{0})')
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Stash popped successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project or stash not found'
    },
    409: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Conflict while popping stash'
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
  description: 'Apply a stash and remove it from the stash list'
})

gitRoutes.openapi(popStashRoute, async (c) => {
  try {
    const { projectId, ref } = c.req.valid('param')
    await gitService.stashPop(projectId, ref)
    return c.json({
      success: true,
      message: 'Stash popped successfully'
    })
  } catch (error) {
    console.error('[PopStash] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to pop stash'
      },
      500
    )
  }
})

// Drop stash
const dropStashRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/git/stash/{ref}',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10)),
      ref: z.string().describe('Stash reference (e.g. stash@{0})')
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Stash dropped successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project or stash not found'
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
  description: 'Remove a stash from the stash list'
})

gitRoutes.openapi(dropStashRoute, async (c) => {
  try {
    const { projectId, ref } = c.req.valid('param')
    await gitService.stashDrop(projectId, ref)
    return c.json({
      success: true,
      message: 'Stash dropped successfully'
    })
  } catch (error) {
    console.error('[DropStash] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to drop stash'
      },
      500
    )
  }
})

// ============================================
// Worktree Management Routes
// ============================================

// List worktrees
const listWorktreesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/worktrees',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitWorktreeListResponseSchema
        }
      },
      description: 'List of worktrees retrieved successfully'
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
  description: 'Get all worktrees for a git repository'
})

gitRoutes.openapi(listWorktreesRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const worktrees = await gitService.getWorktrees(projectId)
    return c.json({
      success: true,
      data: worktrees
    })
  } catch (error) {
    console.error('[ListWorktrees] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to list worktrees'
      },
      500
    )
  }
})

// Add worktree
const addWorktreeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/worktrees',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitWorktreeAddRequestSchema
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
      description: 'Worktree added successfully'
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
    409: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Worktree already exists'
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
  description: 'Add a new worktree to the repository'
})

gitRoutes.openapi(addWorktreeRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const options = c.req.valid('json')
    const async = c.req.query('async') === 'true'

    if (async) {
      // Create job for async processing
      const { getJobQueue } = await import('@promptliano/services')
      const jobQueue = getJobQueue()

      const job = await jobQueue.createJob({
        type: 'git.worktree.add',
        input: options,
        projectId,
        metadata: {
          path: options.path,
          branch: options.branch || options.newBranch
        }
      })

      return c.json(
        {
          success: true,
          jobId: job.id,
          message: `Worktree creation job started (ID: ${job.id})`
        },
        202
      )
    } else {
      // Synchronous processing
      await gitService.addWorktree(projectId, options)
      return c.json({
        success: true,
        message: `Worktree added successfully at ${options.path}`
      })
    }
  } catch (error) {
    console.error('[AddWorktree] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add worktree'
      },
      500
    )
  }
})

// Remove worktree
const removeWorktreeRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/git/worktrees',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitWorktreeRemoveRequestSchema
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
      description: 'Worktree removed successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Cannot remove main worktree'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project or worktree not found'
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
  description: 'Remove a worktree from the repository'
})

gitRoutes.openapi(removeWorktreeRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { path, force } = c.req.valid('json')
    const async = c.req.query('async') === 'true'

    if (async) {
      // Create job for async processing
      const { getJobQueue } = await import('@promptliano/services')
      const jobQueue = getJobQueue()

      const job = await jobQueue.createJob({
        type: 'git.worktree.remove',
        input: { path, force },
        projectId,
        metadata: {
          path,
          force
        }
      })

      return c.json(
        {
          success: true,
          jobId: job.id,
          message: `Worktree removal job started (ID: ${job.id})`
        },
        202
      )
    } else {
      // Synchronous processing
      await gitService.removeWorktree(projectId, path, force)
      return c.json({
        success: true,
        message: `Worktree removed successfully from ${path}`
      })
    }
  } catch (error) {
    console.error('[RemoveWorktree] Error:', error)
    const statusCode =
      error instanceof Error &&
      (error.message.includes('Cannot remove the main worktree')
        ? 400
        : error.message.includes('not found')
          ? 404
          : 500)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove worktree'
      },
      statusCode || 500
    )
  }
})

// Lock worktree
const lockWorktreeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/worktrees/lock',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitWorktreeLockRequestSchema
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
      description: 'Worktree locked successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project or worktree not found'
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
  description: 'Lock a worktree to prevent it from being pruned'
})

gitRoutes.openapi(lockWorktreeRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { path, reason } = c.req.valid('json')
    await gitService.lockWorktree(projectId, path, reason)
    return c.json({
      success: true,
      message: `Worktree locked successfully at ${path}`
    })
  } catch (error) {
    console.error('[LockWorktree] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to lock worktree'
      },
      500
    )
  }
})

// Unlock worktree
const unlockWorktreeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/worktrees/unlock',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            path: z.string().describe('Path of the worktree to unlock')
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
      description: 'Worktree unlocked successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: gitOperationResponseSchema
        }
      },
      description: 'Project or worktree not found'
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
  description: 'Unlock a previously locked worktree'
})

gitRoutes.openapi(unlockWorktreeRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { path } = c.req.valid('json')
    await gitService.unlockWorktree(projectId, path)
    return c.json({
      success: true,
      message: `Worktree unlocked successfully at ${path}`
    })
  } catch (error) {
    console.error('[UnlockWorktree] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to unlock worktree'
      },
      500
    )
  }
})

// Prune worktrees
const pruneWorktreesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/worktrees/prune',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitWorktreePruneRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: gitWorktreePruneResponseSchema
        }
      },
      description: 'Worktrees pruned successfully'
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
  description: 'Remove stale worktree administrative files'
})

gitRoutes.openapi(pruneWorktreesRoute, async (c) => {
  try {
    const { projectId } = c.req.valid('param')
    const { dryRun } = c.req.valid('json')
    const async = c.req.query('async') === 'true'

    if (async && !dryRun) {
      // Only async for actual prune operations, not dry runs
      const { getJobQueue } = await import('@promptliano/services')
      const jobQueue = getJobQueue()

      const job = await jobQueue.createJob({
        type: 'git.worktree.prune',
        input: { dryRun: false },
        projectId,
        metadata: {
          operation: 'prune'
        }
      })

      return c.json(
        {
          success: true,
          jobId: job.id,
          message: `Worktree prune job started (ID: ${job.id})`
        },
        202
      )
    } else {
      // Synchronous processing (or dry run)
      const prunedPaths = await gitService.pruneWorktrees(projectId, dryRun)
      return c.json({
        success: true,
        data: prunedPaths,
        message: dryRun ? `Would prune ${prunedPaths.length} worktree(s)` : `Pruned ${prunedPaths.length} worktree(s)`
      })
    }
  } catch (error) {
    console.error('[PruneWorktrees] Error:', error)
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to prune worktrees'
      },
      500
    )
  }
})
