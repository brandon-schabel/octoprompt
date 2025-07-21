import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiError } from '@octoprompt/shared'
import { 
  getSelectedFiles, 
  getAllSelectedFilesForProject, 
  updateSelectedFiles, 
  clearSelectedFiles,
  getSelectionContext 
} from '@octoprompt/services'
import { 
  selectedFilesSchema, 
  type SelectedFiles,
  ApiErrorResponseSchema 
} from '@octoprompt/schemas'


// Get selected files for a project
const getSelectedFilesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/selected-files',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      tabId: z.string().transform((val) => parseInt(val, 10)).optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: selectedFilesSchema.nullable()
          })
        }
      },
      description: 'Selected files data'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  },
  tags: ['Selected Files'],
  summary: 'Get selected files for a project'
})

// Get all selected files for a project (across all tabs)
const getAllSelectedFilesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/selected-files/all',
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
            success: z.boolean(),
            data: z.array(selectedFilesSchema)
          })
        }
      },
      description: 'All selected files for the project'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  },
  tags: ['Selected Files'],
  summary: 'Get all selected files for a project across all tabs'
})

// Update selected files for a project tab
const updateSelectedFilesRoute = createRoute({
  method: 'put',
  path: '/api/projects/{projectId}/selected-files',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            tabId: z.number(),
            fileIds: z.array(z.number()),
            promptIds: z.array(z.number()).optional().default([]),
            userPrompt: z.string().optional().default('')
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
            success: z.boolean(),
            data: selectedFilesSchema
          })
        }
      },
      description: 'Updated selected files'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Bad Request'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  },
  tags: ['Selected Files'],
  summary: 'Update selected files for a project tab'
})

// Clear selected files for a project
const clearSelectedFilesRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/selected-files',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      tabId: z.string().transform((val) => parseInt(val, 10)).optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string()
          })
        }
      },
      description: 'Clear result'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  },
  tags: ['Selected Files'],
  summary: 'Clear selected files for a project'
})

// Get selection context (for MCP tools)
const getSelectionContextRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/selection-context',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      tabId: z.string().transform((val) => parseInt(val, 10)).optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              fileIds: z.array(z.number()),
              promptIds: z.array(z.number()),
              userPrompt: z.string(),
              lastUpdated: z.number()
            }).nullable()
          })
        }
      },
      description: 'Selection context'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  },
  tags: ['Selected Files'],
  summary: 'Get the current selection context for MCP tools'
})

// Export routes using fluent API pattern
export const selectedFilesRoutes = new OpenAPIHono()
  .openapi(getSelectedFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { tabId } = c.req.valid('query')
    const selectedFiles = await getSelectedFiles(projectId, tabId)
    return c.json({ success: true, data: selectedFiles }, 200)
  })
  .openapi(getAllSelectedFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const allSelectedFiles = await getAllSelectedFilesForProject(projectId)
    return c.json({ success: true, data: allSelectedFiles }, 200)
  })
  .openapi(updateSelectedFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { tabId, fileIds, promptIds, userPrompt } = c.req.valid('json')
    const updated = await updateSelectedFiles(projectId, tabId, fileIds, promptIds || [], userPrompt || '')
    return c.json({ success: true, data: updated }, 200)
  })
  .openapi(clearSelectedFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { tabId } = c.req.valid('query')
    await clearSelectedFiles(projectId, tabId)
    return c.json({ 
      success: true, 
      message: tabId 
        ? `Selected files cleared for project ${projectId} tab ${tabId}` 
        : `All selected files cleared for project ${projectId}`
    }, 200)
  })
  .openapi(getSelectionContextRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { tabId } = c.req.valid('query')
    const context = await getSelectionContext(projectId, tabId)
    return c.json({ success: true, data: context }, 200)
  })