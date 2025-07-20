import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { 
  getProjectGitStatusResponseSchema,
  gitStatusResultSchema,
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