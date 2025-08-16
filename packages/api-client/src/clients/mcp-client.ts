import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { 
  MCPGlobalConfig,
  MCPProjectConfig,
  MCPServer,
  MCPInstallationStatus,
  MCPAnalyticsData,
  MCPInstallRequest,
  MCPInstallResponse,
  MCPUninstallRequest,
  MCPUninstallResponse,
  MCPProjectConfigRequest,
  MCPProjectConfigResponse,
  DataResponseSchema
} from '../types'

// Import MCP schemas (we'll need to add these to the types.ts file)
import {
  CreateMCPServerConfigBodySchema,
  MCPServerConfigResponseSchema,
  MCPServerConfigListResponseSchema,
  UpdateMCPServerConfigBodySchema,
  MCPServerStateSchema,
  MCPToolListResponseSchema,
  MCPToolExecutionRequestSchema,
  MCPToolExecutionResultResponseSchema,
  MCPResourceListResponseSchema,
  OperationSuccessResponseSchema as OperationSuccessResponseSchemaZ
} from '@promptliano/schemas'

// Additional MCP types
type MCPServerConfig = MCPServer
type MCPServerState = {
  id: number
  status: 'running' | 'stopped' | 'error'
  pid?: number
  lastStarted?: number
  lastStopped?: number
  error?: string
}
type MCPTool = {
  name: string
  description: string
  inputSchema: Record<string, any>
  serverId: number
}
type MCPToolExecutionRequest = {
  serverId: number
  toolName: string
  arguments: Record<string, any>
}
type MCPToolExecutionResult = {
  success: boolean
  result?: any
  error?: string
  metadata?: Record<string, any>
}
type MCPResource = {
  uri: string
  name: string
  description?: string
  mimeType?: string
  serverId: number
}
type CreateMCPServerConfigBody = {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  workingDirectory?: string
  autoStart?: boolean
}
type UpdateMCPServerConfigBody = Partial<CreateMCPServerConfigBody>

/**
 * MCP (Model Context Protocol) API client for managing MCP servers, tools, and integrations
 */
export class MCPClient extends BaseApiClient {
  // MCP Server Configuration

  /**
   * Create a new MCP server configuration
   */
  async createServerConfig(projectId: number, data: CreateMCPServerConfigBody): Promise<DataResponseSchema<MCPServerConfig>> {
    const validatedData = this.validateBody(CreateMCPServerConfigBodySchema, data)
    const result = await this.request('POST', `/projects/${projectId}/mcp-servers`, {
      body: validatedData,
      responseSchema: MCPServerConfigResponseSchema
    })
    return result as DataResponseSchema<MCPServerConfig>
  }

  /**
   * List all MCP server configurations for a project
   */
  async listServerConfigs(projectId: number): Promise<DataResponseSchema<MCPServerConfig[]>> {
    const result = await this.request('GET', `/projects/${projectId}/mcp-servers`, {
      responseSchema: MCPServerConfigListResponseSchema
    })
    return result as DataResponseSchema<MCPServerConfig[]>
  }

  /**
   * Get a specific MCP server configuration
   */
  async getServerConfig(projectId: number, configId: number): Promise<DataResponseSchema<MCPServerConfig>> {
    const result = await this.request('GET', `/projects/${projectId}/mcp-servers/${configId}`, {
      responseSchema: MCPServerConfigResponseSchema
    })
    return result as DataResponseSchema<MCPServerConfig>
  }

  /**
   * Update an MCP server configuration
   */
  async updateServerConfig(projectId: number, configId: number, data: UpdateMCPServerConfigBody): Promise<DataResponseSchema<MCPServerConfig>> {
    const validatedData = this.validateBody(UpdateMCPServerConfigBodySchema, data)
    const result = await this.request('PATCH', `/projects/${projectId}/mcp-servers/${configId}`, {
      body: validatedData,
      responseSchema: MCPServerConfigResponseSchema
    })
    return result as DataResponseSchema<MCPServerConfig>
  }

  /**
   * Delete an MCP server configuration
   */
  async deleteServerConfig(projectId: number, configId: number): Promise<boolean> {
    await this.request('DELETE', `/projects/${projectId}/mcp-servers/${configId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  // MCP Server Management

  /**
   * Start an MCP server
   */
  async startServer(projectId: number, configId: number): Promise<DataResponseSchema<MCPServerState>> {
    const result = await this.request('POST', `/projects/${projectId}/mcp-servers/${configId}/start`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: MCPServerStateSchema
      })
    })
    return result as DataResponseSchema<MCPServerState>
  }

  /**
   * Stop an MCP server
   */
  async stopServer(projectId: number, configId: number): Promise<DataResponseSchema<MCPServerState>> {
    const result = await this.request('POST', `/projects/${projectId}/mcp-servers/${configId}/stop`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: MCPServerStateSchema
      })
    })
    return result as DataResponseSchema<MCPServerState>
  }

  /**
   * Get MCP server state
   */
  async getServerState(projectId: number, configId: number): Promise<DataResponseSchema<MCPServerState>> {
    const result = await this.request('GET', `/projects/${projectId}/mcp-servers/${configId}/state`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: MCPServerStateSchema
      })
    })
    return result as DataResponseSchema<MCPServerState>
  }

  // MCP Tools

  /**
   * List available MCP tools for a project
   */
  async listTools(projectId: number): Promise<DataResponseSchema<MCPTool[]>> {
    const result = await this.request('GET', `/projects/${projectId}/mcp-tools`, {
      responseSchema: MCPToolListResponseSchema
    })
    return result as DataResponseSchema<MCPTool[]>
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(projectId: number, request: MCPToolExecutionRequest): Promise<DataResponseSchema<MCPToolExecutionResult>> {
    const validatedData = this.validateBody(MCPToolExecutionRequestSchema, request)
    const result = await this.request('POST', `/projects/${projectId}/mcp-tools/execute`, {
      body: validatedData,
      responseSchema: MCPToolExecutionResultResponseSchema
    })
    return result as DataResponseSchema<MCPToolExecutionResult>
  }

  // MCP Resources

  /**
   * List available MCP resources for a project
   */
  async listResources(projectId: number): Promise<DataResponseSchema<MCPResource[]>> {
    const result = await this.request('GET', `/projects/${projectId}/mcp-resources`, {
      responseSchema: MCPResourceListResponseSchema
    })
    return result as DataResponseSchema<MCPResource[]>
  }

  /**
   * Read content from an MCP resource
   */
  async readResource(projectId: number, serverId: number, uri: string): Promise<{
    success: boolean
    data: {
      content: string
      mimeType?: string
    }
  }> {
    const result = await this.request('GET', `/projects/${projectId}/mcp-resources/${serverId}`, {
      params: { uri },
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          content: z.string(),
          mimeType: z.string().optional()
        })
      })
    })
    return result as {
      success: boolean
      data: {
        content: string
        mimeType?: string
      }
    }
  }

  // MCP Analytics

  /**
   * Get MCP analytics for a project
   */
  async getAnalytics(projectId: number, timeRange?: { start: string; end: string }): Promise<DataResponseSchema<MCPAnalyticsData>> {
    const result = await this.request('GET', `/projects/${projectId}/mcp/analytics`, {
      params: timeRange,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          totalExecutions: z.number(),
          successfulExecutions: z.number(),
          failedExecutions: z.number(),
          averageExecutionTime: z.number(),
          toolUsage: z.array(z.object({
            toolName: z.string(),
            count: z.number(),
            averageTime: z.number()
          })),
          serverStats: z.array(z.object({
            serverId: z.number(),
            serverName: z.string(),
            executions: z.number(),
            uptime: z.number()
          }))
        })
      })
    })
    return result as DataResponseSchema<MCPAnalyticsData>
  }

  // MCP Installation

  /**
   * Install MCP for a project
   */
  async installMCP(projectId: number, data: MCPInstallRequest): Promise<MCPInstallResponse> {
    const result = await this.request('POST', `/projects/${projectId}/mcp/install`, {
      body: data,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          installationId: z.string(),
          status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
          message: z.string().optional()
        })
      })
    })
    return result as MCPInstallResponse
  }

  /**
   * Uninstall MCP from a project
   */
  async uninstallMCP(projectId: number, data: MCPUninstallRequest): Promise<MCPUninstallResponse> {
    const result = await this.request('POST', `/projects/${projectId}/mcp/uninstall`, {
      body: data,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          status: z.enum(['completed', 'failed']),
          message: z.string().optional()
        })
      })
    })
    return result as MCPUninstallResponse
  }

  /**
   * Get MCP installation status for a project
   */
  async getInstallationStatus(projectId: number): Promise<DataResponseSchema<MCPInstallationStatus>> {
    const result = await this.request('GET', `/projects/${projectId}/mcp/status`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          isInstalled: z.boolean(),
          version: z.string().optional(),
          servers: z.array(z.object({
            id: z.number(),
            name: z.string(),
            status: z.enum(['running', 'stopped', 'error'])
          })),
          lastUpdated: z.number()
        })
      })
    })
    return result as DataResponseSchema<MCPInstallationStatus>
  }

  // MCP Project Configuration

  /**
   * Get MCP project configuration
   */
  async getProjectConfig(projectId: number): Promise<MCPProjectConfigResponse> {
    const result = await this.request('GET', `/projects/${projectId}/mcp/config`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          projectId: z.number(),
          mcpEnabled: z.boolean(),
          servers: z.array(z.object({
            id: z.number(),
            name: z.string(),
            command: z.string(),
            args: z.array(z.string()),
            autoStart: z.boolean()
          })),
          customInstructions: z.string().optional()
        })
      })
    })
    return result as MCPProjectConfigResponse
  }

  /**
   * Update MCP project configuration
   */
  async updateProjectConfig(projectId: number, data: MCPProjectConfigRequest): Promise<MCPProjectConfigResponse> {
    const result = await this.request('PATCH', `/projects/${projectId}/mcp/config`, {
      body: data,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          projectId: z.number(),
          mcpEnabled: z.boolean(),
          servers: z.array(z.object({
            id: z.number(),
            name: z.string(),
            command: z.string(),
            args: z.array(z.string()),
            autoStart: z.boolean()
          })),
          customInstructions: z.string().optional()
        })
      })
    })
    return result as MCPProjectConfigResponse
  }

  // MCP Global Configuration

  /**
   * Get global MCP configuration
   */
  async getGlobalConfig(): Promise<DataResponseSchema<MCPGlobalConfig>> {
    const result = await this.request('GET', '/mcp/global-config', {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          mcpEnabled: z.boolean(),
          defaultServers: z.array(z.object({
            name: z.string(),
            command: z.string(),
            args: z.array(z.string())
          })),
          maxConcurrentServers: z.number(),
          serverTimeoutMs: z.number(),
          logLevel: z.enum(['debug', 'info', 'warn', 'error'])
        })
      })
    })
    return result as DataResponseSchema<MCPGlobalConfig>
  }

  /**
   * Update global MCP configuration
   */
  async updateGlobalConfig(data: Partial<MCPGlobalConfig>): Promise<DataResponseSchema<MCPGlobalConfig>> {
    const result = await this.request('PATCH', '/mcp/global-config', {
      body: data,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          mcpEnabled: z.boolean(),
          defaultServers: z.array(z.object({
            name: z.string(),
            command: z.string(),
            args: z.array(z.string())
          })),
          maxConcurrentServers: z.number(),
          serverTimeoutMs: z.number(),
          logLevel: z.enum(['debug', 'info', 'warn', 'error'])
        })
      })
    })
    return result as DataResponseSchema<MCPGlobalConfig>
  }
}