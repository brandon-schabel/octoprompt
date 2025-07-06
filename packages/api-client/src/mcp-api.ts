// Recent changes:
// 1. Updated to use PromptlianoClient from api-client.ts
// 2. Replaced createApiClient with createPromptlianoClient
// 3. Used MCPService from the main client
// 4. Maintained same API interface for backward compatibility
// 5. Added proper type safety and validation

import { createPromptlianoClient, type MCPService } from '../api-client'
import type {
  CreateMCPServerConfigBody,
  UpdateMCPServerConfigBody,
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPResource,
  MCPToolExecutionRequest,
  MCPToolExecutionResult
} from '@promptliano/schemas'

export function createMCPApi(apiUrl: string) {
  const client = createPromptlianoClient({ baseUrl: apiUrl })
  const mcpService = client.mcp

  return {
    // MCP Server Config operations
    createMCPServerConfig: (projectId: number, body: CreateMCPServerConfigBody) =>
      mcpService.createServerConfig(projectId, body),

    listMCPServerConfigs: (projectId: number) => mcpService.listServerConfigs(projectId),

    getMCPServerConfig: (projectId: number, configId: number) => mcpService.getServerConfig(projectId, configId),

    updateMCPServerConfig: (projectId: number, configId: number, body: UpdateMCPServerConfigBody) =>
      mcpService.updateServerConfig(projectId, configId, body),

    deleteMCPServerConfig: async (projectId: number, configId: number) => {
      await mcpService.deleteServerConfig(projectId, configId)
      return { success: true }
    },

    // MCP Server Management operations
    startMCPServer: (projectId: number, configId: number) => mcpService.startServer(projectId, configId),

    stopMCPServer: (projectId: number, configId: number) => mcpService.stopServer(projectId, configId),

    getMCPServerState: (projectId: number, configId: number) => mcpService.getServerState(projectId, configId),

    // MCP Tool operations
    listMCPTools: (projectId: number) => mcpService.listTools(projectId),

    executeMCPTool: (projectId: number, request: MCPToolExecutionRequest) => mcpService.executeTool(projectId, request),

    // MCP Resource operations
    listMCPResources: (projectId: number) => mcpService.listResources(projectId),

    readMCPResource: (projectId: number, serverId: number, uri: string) =>
      mcpService.readResource(projectId, serverId, uri)
  }
}
