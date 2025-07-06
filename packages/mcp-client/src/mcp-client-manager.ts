import { MCPClient, type MCPClientState } from './mcp-client'
import type { MCPServerConfig, MCPServerState, MCPTool, MCPResource } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'

export interface MCPClientManagerOptions {
  onServerStateChange?: (serverId: number, state: MCPClientState) => void
  onServerError?: (serverId: number, error: Error) => void
}

export class MCPClientManager {
  private clients: Map<number, MCPClient> = new Map()
  private onServerStateChange?: (serverId: number, state: MCPClientState) => void
  private onServerError?: (serverId: number, error: Error) => void

  constructor(options: MCPClientManagerOptions = {}) {
    this.onServerStateChange = options.onServerStateChange
    this.onServerError = options.onServerError
  }

  getClient(serverId: number): MCPClient | undefined {
    return this.clients.get(serverId)
  }

  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values())
  }

  async startServer(config: MCPServerConfig): Promise<void> {
    if (!config.enabled) {
      throw new ApiError(400, 'Cannot start disabled server', 'MCP_SERVER_DISABLED')
    }

    let client = this.clients.get(config.id)

    if (!client) {
      client = new MCPClient({
        config,
        onStateChange: (state) => {
          this.onServerStateChange?.(config.id, state)
        },
        onError: (error) => {
          this.onServerError?.(config.id, error)
        }
      })
      this.clients.set(config.id, client)
    }

    await client.start()
  }

  async stopServer(serverId: number): Promise<void> {
    const client = this.clients.get(serverId)
    if (!client) {
      return
    }

    await client.stop()
    this.clients.delete(serverId)
  }

  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.clients.entries()).map(([serverId, client]) =>
      client.stop().catch((error) => {
        console.error(`Error stopping MCP server ${serverId}:`, error)
      })
    )

    await Promise.all(stopPromises)
    this.clients.clear()
  }

  async restartServer(config: MCPServerConfig): Promise<void> {
    await this.stopServer(config.id)
    await this.startServer(config)
  }

  getServerState(serverId: number): MCPServerState {
    const client = this.clients.get(serverId)

    if (!client) {
      return {
        serverId,
        status: 'stopped',
        pid: null,
        error: null,
        startedAt: null,
        lastHeartbeat: null
      }
    }

    const state = client.getState()
    const now = Date.now()

    return {
      serverId,
      status: state,
      pid: state === 'running' ? process.pid : null,
      error: state === 'error' ? 'Server encountered an error' : null,
      startedAt: state === 'running' ? now : null,
      lastHeartbeat: state === 'running' ? now : null
    }
  }

  async listAllTools(projectId: number): Promise<MCPTool[]> {
    const tools: MCPTool[] = []

    for (const client of this.clients.values()) {
      if (client.getConfig().projectId === projectId && client.getState() === 'running') {
        try {
          const serverTools = await client.listTools()
          tools.push(...serverTools)
        } catch (error) {
          console.error(`Failed to list tools for server ${client.getConfig().id}:`, error)
        }
      }
    }

    return tools
  }

  async executeTool(serverId: number, toolId: string, parameters: Record<string, any>): Promise<any> {
    const client = this.clients.get(serverId)
    if (!client) {
      throw new ApiError(404, 'MCP server not found', 'MCP_SERVER_NOT_FOUND')
    }

    return client.executeTool(toolId, parameters)
  }

  async listAllResources(projectId: number): Promise<MCPResource[]> {
    const resources: MCPResource[] = []

    for (const client of this.clients.values()) {
      if (client.getConfig().projectId === projectId && client.getState() === 'running') {
        try {
          const serverResources = await client.listResources()
          resources.push(...serverResources)
        } catch (error) {
          console.error(`Failed to list resources for server ${client.getConfig().id}:`, error)
        }
      }
    }

    return resources
  }

  async readResource(serverId: number, uri: string): Promise<any> {
    const client = this.clients.get(serverId)
    if (!client) {
      throw new ApiError(404, 'MCP server not found', 'MCP_SERVER_NOT_FOUND')
    }

    return client.readResource(uri)
  }

  // Auto-start servers for a project
  async autoStartProjectServers(configs: MCPServerConfig[]): Promise<void> {
    const autoStartConfigs = configs.filter((config) => config.enabled && config.autoStart)

    const startPromises = autoStartConfigs.map((config) =>
      this.startServer(config).catch((error) => {
        console.error(`Failed to auto-start MCP server ${config.name}:`, error)
        this.onServerError?.(config.id, error instanceof Error ? error : new Error(String(error)))
      })
    )

    await Promise.all(startPromises)
  }

  // Get all active servers
  async getActiveServers(): Promise<MCPServerConfig[]> {
    const activeConfigs: MCPServerConfig[] = []

    for (const client of this.clients.values()) {
      if (client.getState() === 'running') {
        activeConfigs.push(client.getConfig())
      }
    }

    return activeConfigs
  }
}
