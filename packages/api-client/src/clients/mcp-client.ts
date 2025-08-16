import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { 
  MCPGlobalConfig,
  MCPProjectConfig,
  MCPInstallationStatus,
  MCPAnalyticsData,
  MCPInstallRequest,
  MCPInstallResponse,
  MCPUninstallRequest,
  MCPUninstallResponse,
  MCPProjectConfigRequest,
  MCPProjectConfigResponse,
  DataResponseSchema,
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPResource,
  MCPToolExecutionRequest,
  MCPToolExecutionResult,
  CreateMCPServerConfigBody,
  UpdateMCPServerConfigBody
} from '../types'

// Import MCP schemas
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
  OperationSuccessResponseSchema as OperationSuccessResponseSchemaZ,
  MCPServerConfigSchema,
  MCPServerStateSchema as MCPServerStateSchemaZ,
  MCPToolSchema,
  MCPResourceSchema
} from '@promptliano/schemas'

// Additional MCP types

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
    return this.post(`/projects/${projectId}/mcp-servers`, validatedData)
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
    return this.patch(`/projects/${projectId}/mcp-servers/${configId}`, validatedData)
  }

  /**
   * Delete an MCP server configuration
   */
  async deleteServerConfig(projectId: number, configId: number): Promise<boolean> {
    await this.delete(`/projects/${projectId}/mcp-servers/${configId}`)
    return true
  }

  // MCP Server Management

  /**
   * Start an MCP server
   */
  async startServer(projectId: number, configId: number): Promise<DataResponseSchema<MCPServerState>> {
    return this.post(`/projects/${projectId}/mcp-servers/${configId}/start`)
  }

  /**
   * Stop an MCP server
   */
  async stopServer(projectId: number, configId: number): Promise<DataResponseSchema<MCPServerState>> {
    return this.post(`/projects/${projectId}/mcp-servers/${configId}/stop`)
  }

  /**
   * Get MCP server state
   */
  async getServerState(projectId: number, configId: number): Promise<DataResponseSchema<MCPServerState>> {
    return this.get(`/projects/${projectId}/mcp-servers/${configId}/state`)
  }

  // MCP Tools

  /**
   * List available MCP tools for a project
   */
  async listTools(projectId: number): Promise<DataResponseSchema<MCPTool[]>> {
    return this.get(`/projects/${projectId}/mcp-tools`)
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(projectId: number, request: MCPToolExecutionRequest): Promise<DataResponseSchema<MCPToolExecutionResult>> {
    const validatedData = this.validateBody(MCPToolExecutionRequestSchema, request)
    return this.post(`/projects/${projectId}/mcp-tools/execute`, validatedData)
  }

  // MCP Resources

  /**
   * List available MCP resources for a project
   */
  async listResources(projectId: number): Promise<DataResponseSchema<MCPResource[]>> {
    return this.get(`/projects/${projectId}/mcp-resources`)
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
    return this.get(`/projects/${projectId}/mcp-resources/${serverId}`, { params: { uri } })
  }

  // MCP Analytics

  /**
   * Get MCP analytics for a project
   */
  async getAnalytics(projectId: number, timeRange?: { start: string; end: string }): Promise<DataResponseSchema<MCPAnalyticsData>> {
    return this.get(`/projects/${projectId}/mcp/analytics`, { params: timeRange })
  }

  // MCP Installation

  /**
   * Install MCP for a project
   */
  async installMCP(projectId: number, data: MCPInstallRequest): Promise<MCPInstallResponse> {
    return this.post(`/projects/${projectId}/mcp/install`, data)
  }

  /**
   * Uninstall MCP from a project
   */
  async uninstallMCP(projectId: number, data: MCPUninstallRequest): Promise<MCPUninstallResponse> {
    return this.post(`/projects/${projectId}/mcp/uninstall`, data)
  }

  /**
   * Get MCP installation status for a project
   */
  async getInstallationStatus(projectId: number): Promise<DataResponseSchema<MCPInstallationStatus>> {
    return this.get(`/projects/${projectId}/mcp/status`)
  }

  // MCP Project Configuration

  /**
   * Get MCP project configuration
   */
  async getProjectConfig(projectId: number): Promise<MCPProjectConfigResponse> {
    return this.get(`/projects/${projectId}/mcp/config`)
  }

  /**
   * Update MCP project configuration
   */
  async updateProjectConfig(projectId: number, data: MCPProjectConfigRequest): Promise<MCPProjectConfigResponse> {
    return this.patch(`/projects/${projectId}/mcp/config`, data)
  }

  // MCP Global Configuration

  /**
   * Get global MCP configuration
   */
  async getGlobalConfig(): Promise<DataResponseSchema<MCPGlobalConfig>> {
    return this.get('/mcp/global/config')
  }

  /**
   * Update global MCP configuration
   */
  async updateGlobalConfig(data: Partial<MCPGlobalConfig>): Promise<DataResponseSchema<MCPGlobalConfig>> {
    return this.patch('/mcp/global/config', data)
  }

  /**
   * Get global MCP installations
   */
  async getGlobalInstallations(): Promise<DataResponseSchema<any>> {
    return this.get('/mcp/global/installations')
  }

  /**
   * Install global MCP for a tool
   */
  async installGlobalMCP(data: { tool: string; serverUrl?: string; debug?: boolean }): Promise<DataResponseSchema<any>> {
    return this.post('/mcp/global/install', data)
  }

  /**
   * Uninstall global MCP for a tool
   */
  async uninstallGlobalMCP(data: { tool: string }): Promise<DataResponseSchema<any>> {
    return this.post('/mcp/global/uninstall', data)
  }

  /**
   * Get global MCP status
   */
  async getGlobalStatus(): Promise<DataResponseSchema<any>> {
    return this.get('/mcp/global/status')
  }
}