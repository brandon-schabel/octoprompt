import {
  MCPServerConfigSchema,
  MCPServerStateSchema,
  MCPToolSchema,
  MCPResourceSchema,
  MCPToolExecutionResultSchema,
  type MCPServerConfig,
  type MCPServerState,
  type MCPTool,
  type MCPResource,
  type MCPToolExecutionResult
} from '@promptliano/schemas'
import { StorageV2, MemoryAdapter } from './storage-v2'
import { SQLiteDbManagerAdapter } from './sqlite-db-manager-adapter'
import { ApiError } from '@promptliano/shared'

// Initialize StorageV2 instances for MCP data
const isTest = process.env.NODE_ENV === 'test'

// MCP Server Configurations Storage
export const mcpServerConfigStorage = new StorageV2<MCPServerConfig>({
  adapter: new SQLiteDbManagerAdapter<MCPServerConfig>('mcp_server_configs'),
  schema: MCPServerConfigSchema,
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'projectId', type: 'hash' },
    { field: 'created', type: 'btree' }
  ],
  cache: {
    maxSize: 100,
    ttl: 300000 // 5 minutes
  }
})

// MCP Server States Storage - Using MemoryAdapter since this is runtime state
// and uses serverId as the primary key
export const mcpServerStateStorage = new StorageV2<MCPServerState>({
  adapter: new MemoryAdapter<MCPServerState>(),
  schema: MCPServerStateSchema,
  indexes: [
    { field: 'serverId', type: 'hash' },
    { field: 'status', type: 'hash' }
  ],
  cache: {
    maxSize: 50,
    ttl: 60000 // 1 minute for runtime state
  }
})

// MCP Tools Storage - Using MemoryAdapter since tools have string IDs
export const mcpToolStorage = new StorageV2<MCPTool>({
  adapter: new MemoryAdapter<MCPTool>(),
  schema: MCPToolSchema,
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'serverId', type: 'hash' },
    { field: 'name', type: 'hash' }
  ],
  cache: {
    maxSize: 200,
    ttl: 600000 // 10 minutes
  }
})

// MCP Resources Storage - Using MemoryAdapter since resources use URI as ID
export const mcpResourceStorage = new StorageV2<MCPResource>({
  adapter: new MemoryAdapter<MCPResource>(),
  schema: MCPResourceSchema,
  indexes: [
    { field: 'uri', type: 'hash' },
    { field: 'serverId', type: 'hash' },
    { field: 'name', type: 'hash' }
  ],
  cache: {
    maxSize: 200,
    ttl: 600000 // 10 minutes
  }
})

// MCP Tool Execution Results Storage
export const mcpToolExecutionStorage = new StorageV2<MCPToolExecutionResult>({
  adapter: new SQLiteDbManagerAdapter<MCPToolExecutionResult>('mcp_tool_executions'),
  schema: MCPToolExecutionResultSchema,
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'toolId', type: 'hash' },
    { field: 'serverId', type: 'hash' },
    { field: 'status', type: 'hash' },
    { field: 'startedAt', type: 'btree' }
  ],
  cache: {
    maxSize: 100,
    ttl: 300000 // 5 minutes
  }
})

// --- Public API for backward compatibility and convenience ---
export const mcpStorage = {
  // MCP Server Configs
  async createMCPServerConfig(config: Omit<MCPServerConfig, 'id' | 'created' | 'updated'>): Promise<MCPServerConfig> {
    return mcpServerConfigStorage.create(config)
  },

  async getMCPServerConfig(id: number): Promise<MCPServerConfig | null> {
    return mcpServerConfigStorage.get(id)
  },

  async updateMCPServerConfig(
    id: number,
    updates: Partial<Omit<MCPServerConfig, 'id' | 'created'>>
  ): Promise<MCPServerConfig | null> {
    return mcpServerConfigStorage.update(id, updates)
  },

  async deleteMCPServerConfig(id: number): Promise<boolean> {
    const deleted = await mcpServerConfigStorage.delete(id)

    if (deleted) {
      // Also delete associated state
      await mcpServerStateStorage.delete(id)

      // Delete associated tools and resources
      const tools = await mcpToolStorage.findBy('serverId', id)
      for (const tool of tools) {
        await mcpToolStorage.delete(tool.id)
      }

      const resources = await mcpResourceStorage.findBy('serverId', id)
      for (const resource of resources) {
        await mcpResourceStorage.delete(resource.uri)
      }
    }

    return deleted
  },

  async getProjectMCPServerConfigs(projectId: number): Promise<MCPServerConfig[]> {
    return mcpServerConfigStorage.findBy('projectId', projectId)
  },

  async getAllMCPServerConfigs(): Promise<MCPServerConfig[]> {
    return mcpServerConfigStorage.getAll()
  },

  // MCP Server States
  async getMCPServerState(serverId: number): Promise<MCPServerState | null> {
    return mcpServerStateStorage.get(serverId)
  },

  async updateMCPServerState(serverId: number, state: Omit<MCPServerState, 'serverId'>): Promise<MCPServerState> {
    const existingState = await mcpServerStateStorage.get(serverId)

    if (existingState) {
      return mcpServerStateStorage.update(serverId, state) as Promise<MCPServerState>
    } else {
      // Create new state
      return mcpServerStateStorage.create({ ...state, serverId } as any)
    }
  },

  async getMCPServerStatesByStatus(status: MCPServerState['status']): Promise<MCPServerState[]> {
    return mcpServerStateStorage.findBy('status', status)
  },

  // MCP Tools
  async createMCPTool(tool: Omit<MCPTool, 'id'>): Promise<MCPTool> {
    // For tools, we use the string ID from the MCP protocol
    return mcpToolStorage.create(tool as any)
  },

  async getMCPTool(id: string): Promise<MCPTool | null> {
    return mcpToolStorage.get(id)
  },

  async getMCPToolsByServer(serverId: number): Promise<MCPTool[]> {
    return mcpToolStorage.findBy('serverId', serverId)
  },

  async deleteMCPToolsByServer(serverId: number): Promise<void> {
    const tools = await mcpToolStorage.findBy('serverId', serverId)
    for (const tool of tools) {
      await mcpToolStorage.delete(tool.id)
    }
  },

  // MCP Resources
  async createMCPResource(resource: MCPResource): Promise<MCPResource> {
    // For resources, we use the URI as the ID
    return mcpResourceStorage.create(resource as any)
  },

  async getMCPResource(uri: string): Promise<MCPResource | null> {
    return mcpResourceStorage.get(uri)
  },

  async getMCPResourcesByServer(serverId: number): Promise<MCPResource[]> {
    return mcpResourceStorage.findBy('serverId', serverId)
  },

  async deleteMCPResourcesByServer(serverId: number): Promise<void> {
    const resources = await mcpResourceStorage.findBy('serverId', serverId)
    for (const resource of resources) {
      await mcpResourceStorage.delete(resource.uri)
    }
  },

  // MCP Tool Execution Results
  async createMCPToolExecution(execution: Omit<MCPToolExecutionResult, 'id'>): Promise<MCPToolExecutionResult> {
    // Generate string ID for execution
    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return mcpToolExecutionStorage.create({ ...execution, id } as any)
  },

  async getMCPToolExecution(id: string): Promise<MCPToolExecutionResult | null> {
    return mcpToolExecutionStorage.get(id)
  },

  async getMCPToolExecutionsByServer(serverId: number): Promise<MCPToolExecutionResult[]> {
    return mcpToolExecutionStorage.findBy('serverId', serverId)
  },

  async getMCPToolExecutionsByTool(toolId: string): Promise<MCPToolExecutionResult[]> {
    return mcpToolExecutionStorage.findBy('toolId', toolId)
  },

  async getMCPToolExecutionsByDateRange(startDate: number, endDate: number): Promise<MCPToolExecutionResult[]> {
    return mcpToolExecutionStorage.findByRange('startedAt', startDate, endDate)
  },

  // Project cleanup
  async deleteProjectMCPData(projectId: number): Promise<void> {
    // Delete all server configs for this project
    const configs = await mcpServerConfigStorage.findBy('projectId', projectId)

    for (const config of configs) {
      // This will cascade delete states, tools, and resources
      await this.deleteMCPServerConfig(config.id)
    }
  },

  // Utility
  generateId(): number {
    return Date.now()
  }
}
