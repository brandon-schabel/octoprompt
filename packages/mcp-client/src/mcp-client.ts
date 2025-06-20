import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn, type ChildProcess } from 'child_process'
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
  private transport: StdioClientTransport | null = null
  private process: ChildProcess | null = null
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
      // Parse command and args
      const [command, ...baseArgs] = this.config.command.split(' ')
      const allArgs = [...baseArgs, ...this.config.args]

      // Spawn the MCP server process
      this.process = spawn(command, allArgs, {
        env: {
          ...process.env,
          ...this.config.env
        },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.process.on('error', (error) => {
        console.error(`MCP server process error for ${this.config.name}:`, error)
        this.handleError(new Error(`Failed to start MCP server: ${error.message}`))
      })

      this.process.on('exit', (code, signal) => {
        console.log(`MCP server ${this.config.name} exited with code ${code}, signal ${signal}`)
        if (this.state === 'running') {
          this.handleError(new Error(`MCP server unexpectedly exited with code ${code}`))
        }
      })

      // Create transport and client
      this.transport = new StdioClientTransport({
        command,
        args: allArgs,
        env: this.config.env
      })

      this.client = new Client(
        {
          name: `octoprompt-${this.config.id}`,
          version: '0.5.4'
        },
        {
          capabilities: {}
        }
      )

      // Connect the client
      await this.client.connect(this.transport)

      this.setState('running')
      console.log(`MCP server ${this.config.name} started successfully`)
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
      throw error
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

      // Close transport
      if (this.transport) {
        await this.transport.close()
        this.transport = null
      }

      // Kill process if still running
      if (this.process && !this.process.killed) {
        this.process.kill()
        this.process = null
      }

      this.setState('stopped')
      console.log(`MCP server ${this.config.name} stopped`)
    } catch (error) {
      console.error(`Error stopping MCP server ${this.config.name}:`, error)
      // Force cleanup even on error
      this.client = null
      this.transport = null
      this.process = null
      this.setState('stopped')
    }
  }

  private handleError(error: Error) {
    this.setState('error')
    this.onError?.(error)
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.client || this.state !== 'running') {
      throw new ApiError(400, 'MCP server is not running', 'MCP_SERVER_NOT_RUNNING')
    }

    try {
      const response = await this.client.listTools()
      return response.tools.map(tool => ({
        id: tool.name,
        name: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema ? this.parseToolParameters(tool.inputSchema) : [],
        serverId: this.config.id
      }))
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_LIST_TOOLS_FAILED'
      )
    }
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
      throw new ApiError(400, 'MCP server is not running', 'MCP_SERVER_NOT_RUNNING')
    }

    try {
      const response = await this.client.callTool({
        name: toolId,
        arguments: parameters
      })

      if (response.isError) {
        throw new ApiError(
          400,
          `Tool execution failed: ${response.content[0]?.text || 'Unknown error'}`,
          'MCP_TOOL_EXECUTION_FAILED'
        )
      }

      // Extract result from content
      const content = response.content
      if (content.length === 1 && content[0].type === 'text') {
        try {
          // Try to parse as JSON if possible
          return JSON.parse(content[0].text)
        } catch {
          // Return as plain text if not JSON
          return content[0].text
        }
      }

      return content
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

  async listResources(): Promise<MCPResource[]> {
    if (!this.client || this.state !== 'running') {
      throw new ApiError(400, 'MCP server is not running', 'MCP_SERVER_NOT_RUNNING')
    }

    try {
      const response = await this.client.listResources()
      return response.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name || resource.uri,
        description: resource.description,
        mimeType: resource.mimeType,
        serverId: this.config.id
      }))
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_LIST_RESOURCES_FAILED'
      )
    }
  }

  async readResource(uri: string): Promise<any> {
    if (!this.client || this.state !== 'running') {
      throw new ApiError(400, 'MCP server is not running', 'MCP_SERVER_NOT_RUNNING')
    }

    try {
      const response = await this.client.readResource({ uri })
      
      // Extract content from response
      const content = response.contents
      if (content.length === 1 && content[0].type === 'text') {
        try {
          // Try to parse as JSON if possible
          return JSON.parse(content[0].text)
        } catch {
          // Return as plain text if not JSON
          return content[0].text
        }
      }

      return content
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_READ_RESOURCE_FAILED'
      )
    }
  }
}