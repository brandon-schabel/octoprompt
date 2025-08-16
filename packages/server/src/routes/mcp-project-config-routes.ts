import { createRoute, z, OpenAPIHono } from '@hono/zod-openapi'
import { mcpProjectConfigService, ProjectMCPConfigSchema } from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../utils/route-helpers'

// Response schemas
const ConfigLocationsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      locations: z.array(
        z.object({
          path: z.string(),
          exists: z.boolean(),
          priority: z.number()
        })
      )
    })
  })
  .openapi('ConfigLocationsResponse')

const MergedConfigResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      config: ProjectMCPConfigSchema
    })
  })
  .openapi('MergedConfigResponse')

const ProjectConfigResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      config: ProjectMCPConfigSchema.nullable(),
      source: z.string().optional()
    })
  })
  .openapi('ProjectConfigResponse')

export const mcpProjectConfigApp = new OpenAPIHono()

// Get project MCP configuration locations
const getConfigLocationsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/config/locations',
  request: {
    params: z.object({
      projectId: z.string().transform(Number)
    })
  },
  responses: createStandardResponses(ConfigLocationsResponseSchema)
})

mcpProjectConfigApp.openapi(getConfigLocationsRoute, async (c) => {
  const { projectId } = c.req.valid('param')

  try {
    const locations = await mcpProjectConfigService.getConfigLocations(projectId)
    return c.json(successResponse({ locations }))
  } catch (error) {
    console.error('Failed to get config locations:', error)
    if (error instanceof ApiError) {
      return c.json({ success: false, error: { message: error.message, code: error.code } }, error.status)
    }
    return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
  }
})

// Get merged project MCP configuration
const getMergedConfigRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/config/merged',
  request: {
    params: z.object({
      projectId: z.string().transform(Number)
    })
  },
  responses: createStandardResponses(MergedConfigResponseSchema)
})

mcpProjectConfigApp.openapi(getMergedConfigRoute, async (c) => {
  const { projectId } = c.req.valid('param')

  try {
    const config = await mcpProjectConfigService.getMergedConfig(projectId)
    return c.json(successResponse({ config }))
  } catch (error) {
    console.error('Failed to get merged config:', error)
    if (error instanceof ApiError) {
      return c.json({ success: false, error: { message: error.message, code: error.code } }, error.status)
    }
    return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
  }
})

// Get expanded project MCP configuration
const getExpandedConfigRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/config/expanded',
  request: {
    params: z.object({
      projectId: z.string().transform(Number)
    })
  },
  responses: createStandardResponses(MergedConfigResponseSchema)
})

mcpProjectConfigApp.openapi(getExpandedConfigRoute, async (c) => {
  const { projectId } = c.req.valid('param')

  try {
    const config = await mcpProjectConfigService.getMergedConfig(projectId)
    const expandedConfig = await mcpProjectConfigService.expandVariables(config, projectId)
    return c.json(successResponse({ config: expandedConfig }))
  } catch (error) {
    console.error('Failed to get expanded config:', error)
    if (error instanceof ApiError) {
      return c.json({ success: false, error: { message: error.message, code: error.code } }, error.status)
    }
    return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
  }
})

// Save project MCP configuration
const saveProjectConfigRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/config',
  request: {
    params: z.object({
      projectId: z.string().transform(Number)
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            config: ProjectMCPConfigSchema
          })
        }
      }
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

mcpProjectConfigApp.openapi(saveProjectConfigRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { config } = c.req.valid('json')

  try {
    await mcpProjectConfigService.saveProjectConfig(projectId, config)
    return c.json(operationSuccessResponse('Config saved successfully'))
  } catch (error) {
    console.error('Failed to save config:', error)
    if (error instanceof ApiError) {
      return c.json({ success: false, error: { message: error.message, code: error.code } }, error.status)
    }
    return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
  }
})

// Load project configuration (without merging)
const loadProjectConfigRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/config',
  request: {
    params: z.object({
      projectId: z.string().transform(Number)
    })
  },
  responses: createStandardResponses(ProjectConfigResponseSchema)
})

// Save project configuration to specific location
const saveProjectConfigToLocationRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/config/save-to-location',
  request: {
    params: z.object({
      projectId: z.string().transform(Number)
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            config: ProjectMCPConfigSchema,
            location: z.string()
          })
        }
      }
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Get default config for location
const getDefaultConfigForLocationRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/config/default-for-location',
  request: {
    params: z.object({
      projectId: z.string().transform(Number)
    }),
    query: z.object({
      location: z.string()
    })
  },
  responses: {
    200: {
      description: 'Default config retrieved',
      content: {
        'application/json': {
          schema: z.object({
            config: ProjectMCPConfigSchema
          })
        }
      }
    }
  }
})

mcpProjectConfigApp
  .openapi(loadProjectConfigRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    try {
      const result = await mcpProjectConfigService.loadProjectConfig(projectId)
      if (result) {
        return c.json(successResponse({
          config: result.config,
          source: result.source
        }))
      } else {
        return c.json(successResponse({
          config: null
        }))
      }
    } catch (error) {
      console.error('Failed to load project config:', error)
      if (error instanceof ApiError) {
        return c.json({ success: false, error: { message: error.message, code: error.code } }, error.status)
      }
      
      // Handle project not found error specifically
      if (error instanceof Error && error.message.includes('not found')) {
        return c.json({ 
          success: false, 
          error: { 
            message: error.message, 
            code: 'PROJECT_NOT_FOUND' 
          } 
        }, 404)
      }
      
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
    }
  })
  .openapi(saveProjectConfigToLocationRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { config, location } = c.req.valid('json')

    try {
      await mcpProjectConfigService.saveProjectConfigToLocation(projectId, config, location)
      return c.json(operationSuccessResponse('Config saved to location successfully'))
    } catch (error) {
      console.error('Failed to save config to location:', error)
      if (error instanceof ApiError) {
        return c.json({ success: false, error: { message: error.message, code: error.code } }, error.status)
      }
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
    }
  })
  .openapi(getDefaultConfigForLocationRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { location } = c.req.valid('query')

    try {
      const config = await mcpProjectConfigService.getDefaultConfigForLocation(projectId, location)
      return c.json(successResponse({ config }))
    } catch (error) {
      console.error('Failed to get default config:', error)
      if (error instanceof ApiError) {
        return c.json({ success: false, error: { message: error.message, code: error.code } }, error.status)
      }
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
    }
  })
