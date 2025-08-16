// Global MCP configuration API routes
// Handles global MCP installations and configurations across all projects

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  mcpInstallationService,
  mcpGlobalConfigService,
  type GlobalMCPConfig,
  type GlobalInstallationRecord
} from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import { createStandardResponses, successResponse } from '../utils/route-helpers'
import * as path from 'path'
import * as fs from 'fs/promises'

// Schemas for API
const GlobalMCPConfigSchema = z.object({
  servers: z.record(
    z.object({
      type: z.enum(['stdio', 'http']).default('stdio'),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      timeout: z.number().optional()
    })
  ),
  defaultServerUrl: z.string().default('http://localhost:3147/api/mcp'),
  debugMode: z.boolean().default(false),
  defaultTimeout: z.number().optional(),
  globalEnv: z.record(z.string()).optional()
})

// Define record schema first
const GlobalInstallationRecordSchema = z.object({
  tool: z.string(),
  installedAt: z.number(),
  configPath: z.string(),
  serverName: z.string(),
  version: z.string().optional()
})

// Response schemas
const GlobalMCPConfigResponseSchema = z
  .object({
    success: z.literal(true),
    data: GlobalMCPConfigSchema
  })
  .openapi('GlobalMCPConfigResponse')

const GlobalInstallationsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      installations: z.array(GlobalInstallationRecordSchema),
      toolStatuses: z.array(
        z.object({
          tool: z.string(),
          name: z.string(),
          installed: z.boolean(),
          hasGlobalPromptliano: z.boolean(),
          configPath: z.string().optional()
        })
      )
    })
  })
  .openapi('GlobalInstallationsResponse')

const GlobalInstallResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      message: z.string(),
      configPath: z.string().optional(),
      backedUp: z.boolean().optional(),
      backupPath: z.string().optional()
    })
  })
  .openapi('GlobalInstallResponse')

const GlobalUninstallResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      message: z.string()
    })
  })
  .openapi('GlobalUninstallResponse')

const GlobalStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      configExists: z.boolean(),
      configPath: z.string(),
      lastModified: z.number().optional(),
      totalInstallations: z.number(),
      installedTools: z.array(z.string()),
      installation: z.object({
        supported: z.boolean(),
        scriptPath: z.string(),
        scriptExists: z.boolean()
      })
    })
  })
  .openapi('GlobalStatusResponse')

const GlobalInstallBodySchema = z.object({
  tool: z.enum(['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf']),
  serverUrl: z.string().optional(),
  debug: z.boolean().optional()
})

const GlobalUninstallBodySchema = z.object({
  tool: z.enum(['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf'])
})

const GlobalConfigUpdateSchema = z.object({
  defaultServerUrl: z.string().optional(),
  debugMode: z.boolean().optional(),
  defaultTimeout: z.number().optional(),
  globalEnv: z.record(z.string()).optional()
})

// Helper function to handle ApiError responses consistently
const handleApiError = (error: unknown, c: any) => {
  console.error('[MCPGlobalConfig] Error:', error)
  if (error instanceof ApiError) {
    return c.json(
      { success: false, error: { message: error.message, code: error.code, details: error.details } },
      error.status
    )
  }
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  console.error('[MCPGlobalConfig] Internal error:', errorMessage)
  return c.json(
    { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR', details: errorMessage } },
    500
  )
}

// Routes
const getGlobalConfigRoute = createRoute({
  method: 'get',
  path: '/api/mcp/global/config',
  responses: createStandardResponses(GlobalMCPConfigResponseSchema),
  tags: ['MCP Global'],
  description: 'Get global MCP configuration'
})

const updateGlobalConfigRoute = createRoute({
  method: 'post',
  path: '/api/mcp/global/config',
  request: {
    body: {
      content: {
        'application/json': {
          schema: GlobalConfigUpdateSchema
        }
      }
    }
  },
  responses: createStandardResponses(GlobalMCPConfigResponseSchema),
  tags: ['MCP Global'],
  description: 'Update global MCP configuration'
})

const getGlobalInstallationsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/global/installations',
  responses: createStandardResponses(GlobalInstallationsResponseSchema),
  tags: ['MCP Global'],
  description: 'Get all global MCP installations'
})

const installGlobalMCPRoute = createRoute({
  method: 'post',
  path: '/api/mcp/global/install',
  request: {
    body: {
      content: {
        'application/json': {
          schema: GlobalInstallBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(GlobalInstallResponseSchema),
  tags: ['MCP Global'],
  description: 'Install Promptliano MCP globally for a tool'
})

const uninstallGlobalMCPRoute = createRoute({
  method: 'post',
  path: '/api/mcp/global/uninstall',
  request: {
    body: {
      content: {
        'application/json': {
          schema: GlobalUninstallBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(GlobalUninstallResponseSchema),
  tags: ['MCP Global'],
  description: 'Uninstall global Promptliano MCP for a tool'
})

const getGlobalStatusRoute = createRoute({
  method: 'get',
  path: '/api/mcp/global/status',
  responses: createStandardResponses(GlobalStatusResponseSchema),
  tags: ['MCP Global'],
  description: 'Get global MCP installation status'
})

// Handlers
export const mcpGlobalConfigRoutes = new OpenAPIHono()
  .openapi(getGlobalConfigRoute, async (c) => {
    try {
      await mcpGlobalConfigService.initialize()
      const config = await mcpGlobalConfigService.getGlobalConfig()

      return c.json(successResponse(config))
    } catch (error) {
      return handleApiError(error, c)
    }
  })
  .openapi(updateGlobalConfigRoute, async (c) => {
    try {
      const updates = c.req.valid('json')

      await mcpGlobalConfigService.initialize()
      const updatedConfig = await mcpGlobalConfigService.updateGlobalConfig(updates)

      return c.json(successResponse(updatedConfig))
    } catch (error) {
      return handleApiError(error, c)
    }
  })
  .openapi(getGlobalInstallationsRoute, async (c) => {
    try {
      await mcpGlobalConfigService.initialize()

      // Get stored installations
      const installations = await mcpGlobalConfigService.getGlobalInstallations()

      // Get current tool statuses
      const toolStatuses = await mcpInstallationService.detectGlobalInstallations()

      return c.json(successResponse({
        installations,
        toolStatuses: toolStatuses.map((tool) => ({
          tool: tool.tool,
          name: tool.name,
          installed: tool.installed,
          hasGlobalPromptliano: tool.hasPromptliano || false,
          configPath: tool.configPath
        }))
      }))
    } catch (error) {
      return handleApiError(error, c)
    }
  })
  .openapi(installGlobalMCPRoute, async (c) => {
    try {
      const { tool, serverUrl, debug } = c.req.valid('json')

      // Install globally
      const result = await mcpInstallationService.installGlobalMCP(tool, serverUrl, debug)

      if (!result.success) {
        throw new ApiError(500, result.message, 'INSTALL_FAILED')
      }

      return c.json(successResponse({
        message: result.message,
        configPath: result.configPath,
        backedUp: result.backedUp,
        backupPath: result.backupPath
      }))
    } catch (error) {
      return handleApiError(error, c)
    }
  })
  .openapi(uninstallGlobalMCPRoute, async (c) => {
    try {
      const { tool } = c.req.valid('json')

      // Uninstall globally
      const result = await mcpInstallationService.uninstallGlobalMCP(tool)

      if (!result.success) {
        throw new ApiError(500, result.message, 'UNINSTALL_FAILED')
      }

      return c.json(successResponse({
        message: result.message
      }))
    } catch (error) {
      return handleApiError(error, c)
    }
  })
  .openapi(getGlobalStatusRoute, async (c) => {
    try {
      await mcpGlobalConfigService.initialize()

      const config = await mcpGlobalConfigService.getGlobalConfig()
      const installations = await mcpGlobalConfigService.getGlobalInstallations()

      // Check if global mode scripts exist
      let promptlianoPath = process.cwd()
      if (promptlianoPath.includes('packages/server')) {
        promptlianoPath = path.resolve(promptlianoPath, '../..')
      }

      const scriptPath =
        process.platform === 'win32'
          ? path.join(promptlianoPath, 'packages/server/mcp-start.bat')
          : path.join(promptlianoPath, 'packages/server/mcp-start.sh')

      let scriptExists = false
      try {
        await fs.access(scriptPath)
        scriptExists = true
      } catch {
        scriptExists = false
      }

      return c.json(successResponse({
        configExists: true,
        configPath: path.join(
          process.env.HOME || process.env.USERPROFILE || '',
          '.promptliano/global-mcp-config.json'
        ),
        lastModified: Date.now(),
        totalInstallations: installations.length,
        installedTools: installations.map((i) => i.tool),
        installation: {
          supported: true,
          scriptPath,
          scriptExists
        }
      }))
    } catch (error) {
      return handleApiError(error, c)
    }
  })
