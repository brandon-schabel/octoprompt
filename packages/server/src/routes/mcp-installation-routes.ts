// Recent changes:
// - Initial implementation of MCP installation API routes
// - Added endpoints for tool detection, installation, and status
// - Integrated with MCP installation service and config manager
// - Added project-specific MCP configuration tracking
// - Included connection status monitoring

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  mcpInstallationService,
  mcpConfigManager,
  getProjectById,
  type MCPToolInfo,
  type MCPStatus
} from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import { createStandardResponses, successResponse } from '../utils/route-helpers'

// Schemas
const MCPToolInfoSchema = z.object({
  tool: z.string(),
  name: z.string(),
  installed: z.boolean(),
  configPath: z.string().optional(),
  configExists: z.boolean().optional(),
  hasPromptliano: z.boolean().optional()
})

// Response schemas
const DetectToolsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      tools: z.array(MCPToolInfoSchema),
      platform: z.string()
    })
  })
  .openapi('DetectToolsResponse')

const InstallationStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      projectConfig: z
        .object({
          projectId: z.number(),
          projectName: z.string(),
          mcpEnabled: z.boolean(),
          installedTools: z.array(
            z.object({
              tool: z.string(),
              installedAt: z.number(),
              configPath: z.string().optional(),
              serverName: z.string()
            })
          ),
          customInstructions: z.string().optional()
        })
        .nullable(),
      connectionStatus: z.object({
        connected: z.boolean(),
        sessionId: z.string().optional(),
        lastActivity: z.number().optional(),
        projectId: z.number().optional()
      })
    })
  })
  .openapi('InstallationStatusResponse')

const InstallResultResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      message: z.string(),
      configPath: z.string().optional(),
      backedUp: z.boolean().optional(),
      backupPath: z.string().optional()
    })
  })
  .openapi('InstallResultResponse')

const UninstallResultResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      message: z.string()
    })
  })
  .openapi('UninstallResultResponse')

const GlobalMCPStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      totalSessions: z.number(),
      projectSessions: z.number(),
      projectStatuses: z.array(
        z.object({
          projectId: z.number(),
          connected: z.boolean(),
          sessionId: z.string().optional(),
          lastActivity: z.number().optional()
        })
      )
    })
  })
  .openapi('GlobalMCPStatusResponse')

const ProjectConfigResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      projectConfig: z.object({
        projectId: z.number(),
        projectName: z.string(),
        mcpEnabled: z.boolean(),
        installedTools: z.array(z.any()),
        customInstructions: z.string().optional()
      })
    })
  })
  .openapi('ProjectConfigResponse')

const BatchInstallResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      results: z.array(
        z.object({
          tool: z.string(),
          success: z.boolean(),
          message: z.string(),
          configPath: z.string().optional(),
          backedUp: z.boolean().optional(),
          backupPath: z.string().optional()
        })
      ),
      summary: z.object({
        total: z.number(),
        succeeded: z.number(),
        failed: z.number()
      })
    })
  })
  .openapi('BatchInstallResponse')

const MCPInstallBodySchema = z.object({
  tool: z.enum(['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf']),
  serverUrl: z.string().optional(),
  debug: z.boolean().optional()
})

const MCPUninstallBodySchema = z.object({
  tool: z.enum(['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf'])
})

const MCPBatchInstallBodySchema = z.object({
  tools: z.array(z.enum(['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf'])),
  serverUrl: z.string().optional(),
  debug: z.boolean().optional()
})

// Routes
const detectInstalledToolsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/installation/detect',
  responses: createStandardResponses(DetectToolsResponseSchema),
  tags: ['MCP Installation'],
  description: 'Detect installed MCP-compatible tools'
})

const getInstallationStatusRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/installation/status',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(InstallationStatusResponseSchema),
  tags: ['MCP Installation'],
  description: 'Get MCP installation and connection status for a project'
})

const installMCPRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/installation/install',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: MCPInstallBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(InstallResultResponseSchema),
  tags: ['MCP Installation'],
  description: 'Install Promptliano MCP for a specific tool'
})

const uninstallMCPRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/installation/uninstall',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: MCPUninstallBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(UninstallResultResponseSchema),
  tags: ['MCP Installation'],
  description: 'Uninstall Promptliano MCP for a specific tool'
})

const getGlobalMCPStatusRoute = createRoute({
  method: 'get',
  path: '/api/mcp/status',
  responses: {
    200: {
      description: 'Global MCP status',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              totalSessions: z.number(),
              projectSessions: z.number(),
              projectStatuses: z.array(
                z.object({
                  projectId: z.number(),
                  connected: z.boolean(),
                  sessionId: z.string().optional(),
                  lastActivity: z.number().optional()
                })
              )
            })
          })
        }
      }
    }
  },
  tags: ['MCP Installation'],
  description: 'Get global MCP connection status'
})

const updateProjectMCPConfigRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/config',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            mcpEnabled: z.boolean().optional(),
            customInstructions: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Updated config',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              projectConfig: z.object({
                projectId: z.number(),
                projectName: z.string(),
                mcpEnabled: z.boolean(),
                installedTools: z.array(z.any()),
                customInstructions: z.string().optional()
              })
            })
          })
        }
      }
    }
  },
  tags: ['MCP Installation'],
  description: 'Update project MCP configuration'
})

const batchInstallMCPRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/installation/batch-install',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: MCPBatchInstallBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Batch installation results',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(
                z.object({
                  tool: z.string(),
                  success: z.boolean(),
                  message: z.string(),
                  configPath: z.string().optional(),
                  backedUp: z.boolean().optional(),
                  backupPath: z.string().optional()
                })
              ),
              summary: z.object({
                total: z.number(),
                succeeded: z.number(),
                failed: z.number()
              })
            })
          })
        }
      }
    }
  },
  tags: ['MCP Installation'],
  description: 'Install Promptliano MCP for multiple tools at once'
})

// Create route for project-level MCP installation
const installProjectConfigRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/install-project-config',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            serverUrl: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Project MCP configuration installed',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              message: z.string(),
              configPath: z.string(),
              backedUp: z.boolean(),
              backupPath: z.string().optional()
            })
          })
        }
      }
    }
  },
  tags: ['MCP Installation'],
  description: 'Install MCP configuration at the project level (.mcp.json)'
})

// Handlers
export const mcpInstallationRoutes = new OpenAPIHono()
  .openapi(detectInstalledToolsRoute, async (c) => {
    try {
      await mcpConfigManager.initialize()
      const tools = await mcpInstallationService.detectInstalledTools()
      const platform = process.platform

      return c.json(successResponse({
        tools,
        platform
      }))
    } catch (error) {
      throw new ApiError(500, `Failed to detect tools: ${error}`)
    }
  })
  .openapi(getInstallationStatusRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      await mcpConfigManager.initialize()

      // Get project config
      const projectConfig = await mcpConfigManager.getProjectConfig(projectId)

      // Get connection status
      const connectionStatus = await mcpConfigManager.getProjectStatus(projectId)

      return c.json(successResponse({
        projectConfig,
        connectionStatus
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to get installation status: ${error}`)
    }
  })
  .openapi(installMCPRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { tool, serverUrl, debug } = c.req.valid('json')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      await mcpConfigManager.initialize()

      // Install MCP
      const result = await mcpInstallationService.installMCP({
        tool,
        projectId,
        projectName: project.name,
        projectPath: project.path,
        serverUrl,
        debug
      })

      if (!result.success) {
        throw new ApiError(500, result.message, 'INSTALL_FAILED')
      }

      // Update project config
      const serverName = `promptliano-${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      await mcpConfigManager.addInstalledTool(projectId, tool, result.configPath, serverName)

      return c.json(successResponse({
        message: result.message,
        configPath: result.configPath,
        backedUp: result.backedUp,
        backupPath: result.backupPath
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to install MCP: ${error}`)
    }
  })
  .openapi(uninstallMCPRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { tool } = c.req.valid('json')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      await mcpConfigManager.initialize()

      // Uninstall MCP
      const result = await mcpInstallationService.uninstallMCP(tool, project.name)

      if (!result.success) {
        throw new ApiError(500, result.message, 'UNINSTALL_FAILED')
      }

      // Update project config
      await mcpConfigManager.removeInstalledTool(projectId, tool)

      return c.json({
        success: true,
        data: {
          message: result.message
        }
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to uninstall MCP: ${error}`)
    }
  })
  .openapi(getGlobalMCPStatusRoute, async (c) => {
    try {
      await mcpConfigManager.initialize()

      const globalStatus = await mcpConfigManager.getGlobalStatus()
      const allStatuses = await mcpConfigManager.getAllProjectStatuses()

      // Convert Map to array
      const projectStatuses = Array.from(allStatuses.entries()).map(([projectId, status]) => ({
        projectId,
        ...status
      }))

      return c.json({
        success: true,
        data: {
          ...globalStatus,
          projectStatuses
        }
      })
    } catch (error) {
      throw new ApiError(500, `Failed to get global status: ${error}`)
    }
  })
  .openapi(updateProjectMCPConfigRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const updates = c.req.valid('json')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      await mcpConfigManager.initialize()

      const projectConfig = await mcpConfigManager.updateProjectConfig(projectId, {
        projectName: project.name,
        ...updates
      })

      return c.json({
        success: true,
        data: {
          projectConfig
        }
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to update project config: ${error}`)
    }
  })
  .openapi(batchInstallMCPRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { tools, serverUrl, debug } = c.req.valid('json')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      await mcpConfigManager.initialize()

      const results = []
      let succeeded = 0
      let failed = 0

      // Install for each tool
      for (const tool of tools) {
        try {
          const result = await mcpInstallationService.installMCP({
            tool,
            projectId,
            projectName: project.name,
            projectPath: project.path,
            serverUrl,
            debug
          })

          results.push({
            tool,
            ...result
          })

          if (result.success) {
            succeeded++
            // Update project config
            const serverName = `promptliano-${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
            await mcpConfigManager.addInstalledTool(projectId, tool, result.configPath, serverName)
          } else {
            failed++
          }
        } catch (error) {
          failed++
          results.push({
            tool,
            success: false,
            message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        }
      }

      return c.json({
        success: true,
        data: {
          results,
          summary: {
            total: tools.length,
            succeeded,
            failed
          }
        }
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to batch install MCP: ${error}`)
    }
  })
  .openapi(installProjectConfigRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { serverUrl } = c.req.valid('json')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      // Install project-level MCP configuration
      const result = await mcpInstallationService.installProjectConfig(projectId, project.path, serverUrl)

      if (!result.success) {
        throw new ApiError(500, result.message, 'INSTALL_FAILED')
      }

      // Update project config to track this installation
      await mcpConfigManager.initialize()
      await mcpConfigManager.updateProjectConfig(projectId, {
        projectName: project.name,
        mcpEnabled: true,
        customInstructions: `Project-level MCP configuration installed at .mcp.json`
      })

      return c.json({
        success: true,
        data: {
          message: result.message,
          configPath: result.configPath!,
          backedUp: result.backedUp || false,
          backupPath: result.backupPath
        }
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to install project MCP config: ${error}`)
    }
  })
