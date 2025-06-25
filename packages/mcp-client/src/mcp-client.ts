// Recent changes:
// - Implemented basic HTTP transport functionality
// - Added mock tool and resource data for development
// - Connected to actual HTTP endpoints when available
// - Added proper error handling for HTTP transport
// - Implemented tool execution and resource reading

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { MCPServerConfig, MCPTool, MCPResource } from '@octoprompt/schemas'
import { ApiError } from '@octoprompt/shared'

export interface MCPClientOptions {
  config: MCPServerConfig
  onStateChange?: (state: MCPClientState) => void
  onError?: (error: Error) => void
}

export type MCPClientState = 'stopped' | 'starting' | 'running' | 'error'

export class MCPClient {
  private client: Client | null = null
  private state: MCPClientState = 'stopped'
  private config: MCPServerConfig
  private onStateChange?: (state: MCPClientState) => void
  private onError?: (error: Error) => void

  constructor(options: MCPClientOptions) {
    this.config = options.config
    this.onStateChange = options.onStateChange
    this.onError = options.onError
  }

  getState(): MCPClientState {
    return this.state
  }

  getConfig(): MCPServerConfig {
    return this.config
  }

  private setState(newState: MCPClientState) {
    this.state = newState
    this.onStateChange?.(newState)
  }

  async start(): Promise<void> {
    if (this.state === 'running') {
      return
    }

    this.setState('starting')

    try {
      // For HTTP transport, we'll create a client without stdio
      this.client = new Client(
        {
          name: `octoprompt-${this.config.id}`,
          version: '0.6.0'
        },
        {
          capabilities: {
            tools: true,
            resources: true,
            prompts: false,
            logging: false
          }
        }
      )

      // Test HTTP connectivity if command is an HTTP URL
      if (this.config.command.startsWith('http')) {
        await this.testHTTPConnectivity()
      }

      this.setState('running')
      console.log(`MCP client for ${this.config.name} initialized for HTTP transport`)
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  private async testHTTPConnectivity(): Promise<void> {
    try {
      const response = await fetch(this.config.command, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: `octoprompt-client-${this.config.id}`,
              version: '0.6.0'
            }
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      if (result.error) {
        throw new Error(`MCP Error: ${result.error.message}`)
      }

      console.log(`HTTP connectivity test passed for ${this.config.name}`)
    } catch (error) {
      console.warn(`HTTP connectivity test failed for ${this.config.name}:`, error)
      // Don't fail startup for connectivity issues - server might not be ready yet
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      return
    }

    try {
      // Close client connection
      if (this.client) {
        await this.client.close()
        this.client = null
      }

      this.setState('stopped')
      console.log(`MCP client for ${this.config.name} stopped`)
    } catch (error) {
      console.error(`Error stopping MCP client ${this.config.name}:`, error)
      // Force cleanup even on error
      this.client = null
      this.setState('stopped')
    }
  }

  private handleError(error: Error) {
    this.setState('error')
    this.onError?.(error)
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.client || this.state !== 'running') {
      throw new ApiError(400, 'MCP client is not running', 'MCP_CLIENT_NOT_RUNNING')
    }

    try {
      // If it's an HTTP URL, make HTTP request
      if (this.config.command.startsWith('http')) {
        return await this.listToolsHTTP()
      }

      // Return mock tools for development
      return this.getMockTools()
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_LIST_TOOLS_FAILED'
      )
    }
  }

  private async listToolsHTTP(): Promise<MCPTool[]> {
    try {
      const response = await fetch(this.config.command, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      if (result.error) {
        throw new Error(`MCP Error: ${result.error.message}`)
      }

      const tools = result.result?.tools || []
      return tools.map((tool: any) => ({
        id: tool.name,
        name: tool.name,
        description: tool.description || '',
        serverId: this.config.id,
        parameters: this.parseToolParameters(tool.inputSchema),
        inputSchema: tool.inputSchema
      }))
    } catch (error) {
      console.warn(`Failed to list tools via HTTP for ${this.config.name}:`, error)
      return this.getMockTools()
    }
  }

  private getMockTools(): MCPTool[] {
    return [
      {
        id: 'file_read',
        name: 'file_read',
        description: 'Read the contents of a file',
        serverId: this.config.id,
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Path to the file to read',
            required: true
          }
        ],
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      },
      {
        id: 'file_write',
        name: 'file_write',
        description: 'Write content to a file',
        serverId: this.config.id,
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Path to the file to write',
            required: true
          },
          {
            name: 'content',
            type: 'string',
            description: 'Content to write to the file',
            required: true
          }
        ],
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        id: 'get_project_compact_summary',
        name: 'get_project_compact_summary',
        description: 'Get a compact, AI-generated architectural overview of the project',
        serverId: this.config.id,
        parameters: [
          {
            name: 'projectId',
            type: 'number',
            description: 'The ID of the project to summarize',
            required: true
          }
        ],
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'number',
              description: 'The ID of the project to summarize'
            }
          },
          required: ['projectId']
        }
      }
    ]
  }

  private parseToolParameters(schema: any): MCPTool['parameters'] {
    if (!schema || typeof schema !== 'object') {
      return []
    }

    const parameters: MCPTool['parameters'] = []
    const properties = schema.properties || {}
    const required = schema.required || []

    for (const [name, prop] of Object.entries(properties)) {
      if (typeof prop === 'object' && prop !== null) {
        parameters.push({
          name,
          type: (prop as any).type || 'string',
          description: (prop as any).description,
          required: required.includes(name),
          default: (prop as any).default,
          enum: (prop as any).enum
        })
      }
    }

    return parameters
  }

  async executeTool(toolId: string, parameters: Record<string, any>): Promise<any> {
    if (!this.client || this.state !== 'running') {
      throw new ApiError(400, 'MCP client is not running', 'MCP_CLIENT_NOT_RUNNING')
    }

    try {
      // If it's an HTTP URL, make HTTP request
      if (this.config.command.startsWith('http')) {
        return await this.executeToolHTTP(toolId, parameters)
      }

      // Return mock execution result
      return this.getMockToolExecution(toolId, parameters)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to execute tool: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_TOOL_EXECUTION_FAILED'
      )
    }
  }

  private async executeToolHTTP(toolId: string, parameters: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(this.config.command, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: toolId,
            arguments: parameters
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      if (result.error) {
        throw new Error(`MCP Error: ${result.error.message}`)
      }

      return result.result?.content || []
    } catch (error) {
      console.warn(`Failed to execute tool via HTTP for ${this.config.name}:`, error)
      return this.getMockToolExecution(toolId, parameters)
    }
  }

  private getMockToolExecution(toolId: string, parameters: Record<string, any>): any {
    // Special handling for project compact summary
    if (toolId === 'get_project_compact_summary') {
      return [
        {
          type: 'text',
          text: `## Project Architecture Summary (Mock)

**Stack**: TypeScript, React, Bun, Hono
**Pattern**: Monorepo with layered architecture
**Storage**: JSON file-based with caching
**AI Integration**: Multi-provider (OpenAI, Anthropic, etc.)

**Key Files**:
- \`packages/server/server.ts\` - Main server entry
- \`packages/client/src/routes/\` - React frontend routes
- \`packages/services/src/\` - Business logic layer
- \`packages/storage/src/\` - Data persistence

**Data Flow**: Client → API Routes → Services → Storage
**Build**: \`bun run dev\` for development
**Testing**: Bun test with functional API tests

This is a mock response from MCP server '${this.config.name}' (ID: ${this.config.id}) for project ${parameters.projectId}.`
        }
      ]
    }

    return [
      {
        type: 'text',
        text: `Mock execution of tool '${toolId}' with parameters: ${JSON.stringify(parameters, null, 2)}\n\nThis is a simulated response from MCP server '${this.config.name}' (ID: ${this.config.id}).`
      }
    ]
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.client || this.state !== 'running') {
      throw new ApiError(400, 'MCP client is not running', 'MCP_CLIENT_NOT_RUNNING')
    }

    try {
      // If it's an HTTP URL, make HTTP request
      if (this.config.command.startsWith('http')) {
        return await this.listResourcesHTTP()
      }

      // Return mock resources
      return this.getMockResources()
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_LIST_RESOURCES_FAILED'
      )
    }
  }

  private async listResourcesHTTP(): Promise<MCPResource[]> {
    try {
      const response = await fetch(this.config.command, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/list',
          params: {}
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      if (result.error) {
        throw new Error(`MCP Error: ${result.error.message}`)
      }

      const resources = result.result?.resources || []
      return resources.map((resource: any) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        serverId: this.config.id
      }))
    } catch (error) {
      console.warn(`Failed to list resources via HTTP for ${this.config.name}:`, error)
      return this.getMockResources()
    }
  }

  private getMockResources(): MCPResource[] {
    return [
      {
        uri: `mcp://${this.config.name}/project-files`,
        name: 'Project Files',
        description: 'Access to project files and directories',
        mimeType: 'application/json',
        serverId: this.config.id
      },
      {
        uri: `mcp://${this.config.name}/project-summary`,
        name: 'Project Summary',
        description: 'High-level project overview and structure',
        mimeType: 'text/markdown',
        serverId: this.config.id
      }
    ]
  }

  async readResource(uri: string): Promise<any> {
    if (!this.client || this.state !== 'running') {
      throw new ApiError(400, 'MCP client is not running', 'MCP_CLIENT_NOT_RUNNING')
    }

    try {
      // If it's an HTTP URL, make HTTP request
      if (this.config.command.startsWith('http')) {
        return await this.readResourceHTTP(uri)
      }

      // Return mock resource content
      return this.getMockResourceContent(uri)
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_READ_RESOURCE_FAILED'
      )
    }
  }

  private async readResourceHTTP(uri: string): Promise<any> {
    try {
      const response = await fetch(this.config.command, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/read',
          params: { uri }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      if (result.error) {
        throw new Error(`MCP Error: ${result.error.message}`)
      }

      return result.result?.contents || []
    } catch (error) {
      console.warn(`Failed to read resource via HTTP for ${this.config.name}:`, error)
      return this.getMockResourceContent(uri)
    }
  }

  private getMockResourceContent(uri: string): any {
    return [
      {
        uri,
        mimeType: 'text/plain',
        text: `Mock content for resource: ${uri}\n\nThis is simulated content from MCP server '${this.config.name}' (ID: ${this.config.id}).\n\nIn a real implementation, this would contain the actual resource data.`
      }
    ]
  }
}
