import {
  type CreateMCPServerConfigBody,
  type UpdateMCPServerConfigBody,
  type MCPServerConfig,
  type MCPServerState,
  type MCPTool,
  type MCPResource,
  type MCPToolExecutionRequest,
  type MCPToolExecutionResult,
  MCPServerConfigSchema,
  MCPToolExecutionRequestSchema
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { mcpStorage } from '@promptliano/storage'
import { MCPClientManager } from '@promptliano/mcp-client'
import { z, ZodError } from 'zod'
import { getProjectById } from './project-service'

// Global MCP client manager instance
let mcpClientManager: MCPClientManager | null = null

export function getMCPClientManager(): MCPClientManager {
  if (!mcpClientManager) {
    mcpClientManager = new MCPClientManager({
      onServerStateChange: async (serverId, state) => {
        console.log(`MCP server ${serverId} state changed to: ${state}`)
        // Update server state in storage
        await mcpStorage.updateMCPServerState(serverId, {
          status: state,
          pid: state === 'running' ? process.pid : null,
          error: state === 'error' ? 'Server encountered an error' : null,
          startedAt: state === 'running' ? Date.now() : null,
          lastHeartbeat: state === 'running' ? Date.now() : null
        })
      },
      onServerError: async (serverId, error) => {
        console.error(`MCP server ${serverId} error:`, error)
        // Update server state with error
        await mcpStorage.updateMCPServerState(serverId, {
          status: 'error',
          pid: null,
          error: error.message,
          startedAt: null,
          lastHeartbeat: null
        })
      }
    })
  }
  return mcpClientManager
}

// MCP Server Config CRUD operations
export async function createMCPServerConfig(
  projectId: number,
  data: CreateMCPServerConfigBody
): Promise<MCPServerConfig> {
  try {
    // Verify project exists
    await getProjectById(projectId)

    const config = await mcpStorage.createMCPServerConfig({
      ...data,
      projectId
    })

    // Auto-start if enabled and autoStart is true
    if (config.enabled && config.autoStart) {
      const manager = getMCPClientManager()
      try {
        await manager.startServer(config)
      } catch (error) {
        console.error(`Failed to auto-start MCP server ${config.name}:`, error)
      }
    }

    return config
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation failed creating MCP server config: ${error.message}`,
        'MCP_CONFIG_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Failed to create MCP server config: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_CONFIG_CREATE_FAILED'
    )
  }
}

export async function getMCPServerConfigById(configId: number): Promise<MCPServerConfig> {
  const config = await mcpStorage.getMCPServerConfig(configId)

  if (!config) {
    throw new ApiError(404, `MCP server config not found with ID ${configId}`, 'MCP_CONFIG_NOT_FOUND')
  }

  return config
}

export async function listMCPServerConfigs(projectId: number): Promise<MCPServerConfig[]> {
  try {
    // Verify project exists
    await getProjectById(projectId)

    return await mcpStorage.getProjectMCPServerConfigs(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to list MCP server configs: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_CONFIG_LIST_FAILED'
    )
  }
}

export async function updateMCPServerConfig(
  configId: number,
  data: UpdateMCPServerConfigBody
): Promise<MCPServerConfig> {
  try {
    const existing = await getMCPServerConfigById(configId)
    const updated = await mcpStorage.updateMCPServerConfig(configId, data)

    if (!updated) {
      throw new ApiError(404, `MCP server config not found with ID ${configId}`, 'MCP_CONFIG_NOT_FOUND')
    }

    const manager = getMCPClientManager()

    // Handle state changes based on update
    if (existing.enabled && !updated.enabled) {
      // Server was disabled, stop it
      await manager.stopServer(configId)
    } else if (!existing.enabled && updated.enabled && updated.autoStart) {
      // Server was enabled with autoStart, start it
      await manager.startServer(updated)
    } else if (existing.enabled && updated.enabled) {
      // Server config changed while enabled, restart it
      await manager.restartServer(updated)
    }

    return updated
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation failed updating MCP server config: ${error.message}`,
        'MCP_CONFIG_VALIDATION_ERROR',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Failed to update MCP server config: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_CONFIG_UPDATE_FAILED'
    )
  }
}

export async function deleteMCPServerConfig(configId: number): Promise<boolean> {
  try {
    const manager = getMCPClientManager()

    // Stop the server if running
    await manager.stopServer(configId)

    // Delete from storage
    return await mcpStorage.deleteMCPServerConfig(configId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to delete MCP server config: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_CONFIG_DELETE_FAILED'
    )
  }
}

// MCP Server Management operations
export async function startMCPServer(configId: number): Promise<MCPServerState> {
  try {
    const config = await getMCPServerConfigById(configId)

    if (!config.enabled) {
      throw new ApiError(400, 'Cannot start disabled MCP server', 'MCP_SERVER_DISABLED')
    }

    const manager = getMCPClientManager()
    await manager.startServer(config)

    return manager.getServerState(configId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_SERVER_START_FAILED'
    )
  }
}

export async function stopMCPServer(configId: number): Promise<MCPServerState> {
  try {
    const manager = getMCPClientManager()
    await manager.stopServer(configId)

    return manager.getServerState(configId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to stop MCP server: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_SERVER_STOP_FAILED'
    )
  }
}

export async function getMCPServerState(configId: number): Promise<MCPServerState> {
  const manager = getMCPClientManager()
  return manager.getServerState(configId)
}

// MCP Tool operations
export async function listMCPTools(projectId: number): Promise<MCPTool[]> {
  try {
    // Verify project exists
    await getProjectById(projectId)

    const manager = getMCPClientManager()
    return await manager.listAllTools(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to list MCP tools: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_TOOLS_LIST_FAILED'
    )
  }
}

export async function executeMCPTool(
  projectId: number,
  request: MCPToolExecutionRequest
): Promise<MCPToolExecutionResult> {
  try {
    // Verify project exists
    await getProjectById(projectId)

    // Validate request
    const validatedRequest = MCPToolExecutionRequestSchema.parse(request)

    // Verify the server belongs to this project
    const config = await getMCPServerConfigById(validatedRequest.serverId)
    if (config.projectId !== projectId) {
      throw new ApiError(403, 'MCP server does not belong to this project', 'MCP_SERVER_ACCESS_DENIED')
    }

    const manager = getMCPClientManager()
    const executionId = `exec_${Date.now()}`
    const startedAt = Date.now()

    try {
      const result = await manager.executeTool(
        validatedRequest.serverId,
        validatedRequest.toolId,
        validatedRequest.parameters
      )

      return {
        id: executionId,
        toolId: validatedRequest.toolId,
        serverId: validatedRequest.serverId,
        status: 'success',
        result,
        error: null,
        startedAt,
        completedAt: Date.now()
      }
    } catch (error) {
      return {
        id: executionId,
        toolId: validatedRequest.toolId,
        serverId: validatedRequest.serverId,
        status: 'error',
        result: null,
        error: error instanceof Error ? error.message : String(error),
        startedAt,
        completedAt: Date.now()
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        422,
        `Invalid tool execution request: ${error.message}`,
        'MCP_TOOL_REQUEST_INVALID',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Failed to execute MCP tool: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_TOOL_EXECUTION_FAILED'
    )
  }
}

// MCP Resource operations
export async function listMCPResources(projectId: number): Promise<MCPResource[]> {
  try {
    // Verify project exists
    await getProjectById(projectId)

    const manager = getMCPClientManager()
    return await manager.listAllResources(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to list MCP resources: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_RESOURCES_LIST_FAILED'
    )
  }
}

export async function readMCPResource(projectId: number, serverId: number, uri: string): Promise<any> {
  try {
    // Verify project exists
    await getProjectById(projectId)

    // Verify the server belongs to this project
    const config = await getMCPServerConfigById(serverId)
    if (config.projectId !== projectId) {
      throw new ApiError(403, 'MCP server does not belong to this project', 'MCP_SERVER_ACCESS_DENIED')
    }

    const manager = getMCPClientManager()
    return await manager.readResource(serverId, uri)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to read MCP resource: ${error instanceof Error ? error.message : String(error)}`,
      'MCP_RESOURCE_READ_FAILED'
    )
  }
}

// Auto-start servers for a project
export async function autoStartProjectMCPServers(projectId: number): Promise<void> {
  try {
    const configs = await listMCPServerConfigs(projectId)
    const manager = getMCPClientManager()
    await manager.autoStartProjectServers(configs)
  } catch (error) {
    console.error(`Failed to auto-start MCP servers for project ${projectId}:`, error)
  }
}

// Clean up when project is deleted
export async function cleanupProjectMCPServers(projectId: number): Promise<void> {
  try {
    const configs = await listMCPServerConfigs(projectId)
    const manager = getMCPClientManager()

    // Stop all servers for this project
    for (const config of configs) {
      await manager.stopServer(config.id)
    }

    // Delete all MCP data for this project
    await mcpStorage.deleteProjectMCPData(projectId)
  } catch (error) {
    console.error(`Failed to cleanup MCP servers for project ${projectId}:`, error)
  }
}
