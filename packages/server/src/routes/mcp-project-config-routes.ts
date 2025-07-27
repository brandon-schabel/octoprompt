import { createRoute, z, OpenAPIHono } from '@hono/zod-openapi'
import { mcpProjectConfigService, ProjectMCPConfigSchema } from '@octoprompt/services'
import { ApiError } from '@octoprompt/shared'
import { ApiErrorResponseSchema } from '@octoprompt/schemas'

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
  responses: {
    200: {
      description: 'Config locations retrieved',
      content: {
        'application/json': {
          schema: z.object({
            locations: z.array(z.object({
              path: z.string(),
              exists: z.boolean(),
              priority: z.number()
            }))
          })
        }
      }
    }
  }
})

mcpProjectConfigApp.openapi(getConfigLocationsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  
  try {
    const locations = await mcpProjectConfigService.getConfigLocations(projectId)
    return c.json({ success: true, data: { locations } })
  } catch (error) {
    console.error('Failed to get config locations:', error)
    if (error instanceof ApiError) {
      return c.json(
        { success: false, error: { message: error.message, code: error.code } },
        error.status
      )
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
  responses: {
    200: {
      description: 'Merged config retrieved',
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

mcpProjectConfigApp.openapi(getMergedConfigRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  
  try {
    const config = await mcpProjectConfigService.getMergedConfig(projectId)
    return c.json({ success: true, data: { config } })
  } catch (error) {
    console.error('Failed to get merged config:', error)
    if (error instanceof ApiError) {
      return c.json(
        { success: false, error: { message: error.message, code: error.code } },
        error.status
      )
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
  responses: {
    200: {
      description: 'Expanded config retrieved',
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

mcpProjectConfigApp.openapi(getExpandedConfigRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  
  try {
    const config = await mcpProjectConfigService.getMergedConfig(projectId)
    const expandedConfig = await mcpProjectConfigService.expandVariables(config, projectId)
    return c.json({ success: true, data: { config: expandedConfig } })
  } catch (error) {
    console.error('Failed to get expanded config:', error)
    if (error instanceof ApiError) {
      return c.json(
        { success: false, error: { message: error.message, code: error.code } },
        error.status
      )
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
  responses: {
    200: {
      description: 'Config saved',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean()
          })
        }
      }
    }
  }
})

mcpProjectConfigApp.openapi(saveProjectConfigRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { config } = c.req.valid('json')
  
  try {
    await mcpProjectConfigService.saveProjectConfig(projectId, config)
    return c.json({ success: true, data: { success: true } })
  } catch (error) {
    console.error('Failed to save config:', error)
    if (error instanceof ApiError) {
      return c.json(
        { success: false, error: { message: error.message, code: error.code } },
        error.status
      )
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
  responses: {
    200: {
      description: 'Project config retrieved',
      content: {
        'application/json': {
          schema: z.object({
            config: ProjectMCPConfigSchema.nullable(),
            source: z.string().optional()
          })
        }
      }
    }
  }
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
  responses: {
    200: {
      description: 'Config saved to location',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean()
          })
        }
      }
    }
  }
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

mcpProjectConfigApp.openapi(loadProjectConfigRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  
  try {
    const result = await mcpProjectConfigService.loadProjectConfig(projectId)
    if (result) {
      return c.json({ success: true, data: { 
        config: result.config,
        source: result.source
      }})
    } else {
      return c.json({ success: true, data: { 
        config: null
      }})
    }
  } catch (error) {
    console.error('Failed to load project config:', error)
    if (error instanceof ApiError) {
      return c.json(
        { success: false, error: { message: error.message, code: error.code } },
        error.status
      )
    }
    return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
  }
})
.openapi(saveProjectConfigToLocationRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { config, location } = c.req.valid('json')
  
  try {
    await mcpProjectConfigService.saveProjectConfigToLocation(projectId, config, location)
    return c.json({ success: true, data: { success: true } })
  } catch (error) {
    console.error('Failed to save config to location:', error)
    if (error instanceof ApiError) {
      return c.json(
        { success: false, error: { message: error.message, code: error.code } },
        error.status
      )
    }
    return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
  }
})
.openapi(getDefaultConfigForLocationRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { location } = c.req.valid('query')
  
  try {
    const config = await mcpProjectConfigService.getDefaultConfigForLocation(projectId, location)
    return c.json({ success: true, data: { config } })
  } catch (error) {
    console.error('Failed to get default config:', error)
    if (error instanceof ApiError) {
      return c.json(
        { success: false, error: { message: error.message, code: error.code } },
        error.status
      )
    }
    return c.json({ success: false, error: { message: 'Internal server error' } }, 500)
  }
})