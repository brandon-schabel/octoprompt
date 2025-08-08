# MCP Client Package - Model Context Protocol Client

You are an expert TypeScript developer working on the @promptliano/mcp-client package. This package provides the MCP (Model Context Protocol) client implementation for connecting to and managing MCP servers in the Promptliano ecosystem.

## Package Overview

The @promptliano/mcp-client package:

- Implements the MCP SDK client functionality
- Manages connections to MCP servers
- Handles tool and resource registration
- Provides transport layer abstractions
- Manages server lifecycle and communication

### Architecture

```
packages/mcp-client/
├── src/
│   ├── client/              # MCP client implementation
│   │   ├── mcp-client.ts   # Main client class
│   │   └── connection.ts   # Connection management
│   ├── transport/           # Transport implementations
│   │   ├── stdio.ts        # StdIO transport
│   │   └── websocket.ts    # WebSocket transport
│   ├── tools/               # Tool management
│   │   └── tool-registry.ts # Tool registration
│   ├── resources/           # Resource management
│   │   └── resource-manager.ts
│   ├── types/               # TypeScript definitions
│   └── index.ts            # Package exports
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze MCP protocol compliance and error handling
   - Ensure proper connection management and resource cleanup

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on transport abstraction and protocol handling

3. **Package-Specific Agents**
   - Use `promptliano-mcp-tool-creator` for MCP tool patterns
   - Use `protocol-expert` for MCP protocol compliance
   - Use `async-expert` for async operation patterns
   - Use `typescript-expert` for type safety

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about MCP protocol requirements
- Use multiple agents concurrently for maximum efficiency
- Document protocol interactions and edge cases

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Protocol message schemas
2. **Storage layer** - N/A for MCP client
3. **Services** - N/A for MCP client
4. **MCP tools** - Tool implementation (this package)
5. **API routes** - N/A for MCP client
6. **API client** - N/A for MCP client
7. **React hooks** - N/A for MCP client
8. **UI components** - N/A for MCP client
9. **Page integration** - N/A for MCP client
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles MCP client implementation, enabling Promptliano to connect to and interact with MCP servers for enhanced AI capabilities.

## MCP Client Implementation

### Core Client Class

Main MCP client implementation:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio'
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket'

export class MCPClient {
  private client: Client
  private transport: Transport
  private connected = false

  constructor(private config: MCPClientConfig) {
    this.client = new Client({
      name: config.name || 'promptliano-mcp-client',
      version: config.version || '1.0.0'
    })

    this.setupHandlers()
  }

  private setupHandlers() {
    // Handle tool calls
    this.client.on('tools/call', async (request) => {
      return this.handleToolCall(request)
    })

    // Handle resource requests
    this.client.on('resources/get', async (request) => {
      return this.handleResourceRequest(request)
    })

    // Handle errors
    this.client.on('error', (error) => {
      this.handleError(error)
    })
  }

  async connect(serverConfig: ServerConfig): Promise<void> {
    if (this.connected) {
      throw new Error('Client already connected')
    }

    // Create appropriate transport
    this.transport = this.createTransport(serverConfig)

    // Connect client
    await this.client.connect(this.transport)
    this.connected = true

    // Discover server capabilities
    await this.discoverCapabilities()
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return

    await this.client.close()
    await this.transport.close()
    this.connected = false
  }

  private createTransport(config: ServerConfig): Transport {
    switch (config.transport) {
      case 'stdio':
        return new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: config.env
        })

      case 'websocket':
        return new WebSocketClientTransport({
          url: config.url,
          headers: config.headers
        })

      default:
        throw new Error(`Unsupported transport: ${config.transport}`)
    }
  }
}
```

### Connection Management

Handle connection lifecycle:

```typescript
export class ConnectionManager {
  private connections = new Map<string, MCPClient>()
  private reconnectTimers = new Map<string, NodeJS.Timeout>()

  async connect(serverId: string, config: ServerConfig, options: ConnectionOptions = {}): Promise<MCPClient> {
    // Check existing connection
    if (this.connections.has(serverId)) {
      const existing = this.connections.get(serverId)!
      if (existing.isConnected()) {
        return existing
      }
    }

    // Create new client
    const client = new MCPClient({
      name: `promptliano-${serverId}`,
      ...options
    })

    try {
      // Connect with retry
      await this.connectWithRetry(client, config, options.maxRetries)

      // Store connection
      this.connections.set(serverId, client)

      // Setup auto-reconnect if enabled
      if (options.autoReconnect) {
        this.setupAutoReconnect(serverId, config, options)
      }

      return client
    } catch (error) {
      throw new Error(`Failed to connect to ${serverId}: ${error.message}`)
    }
  }

  private async connectWithRetry(client: MCPClient, config: ServerConfig, maxRetries = 3): Promise<void> {
    let lastError: Error

    for (let i = 0; i < maxRetries; i++) {
      try {
        await client.connect(config)
        return
      } catch (error) {
        lastError = error

        if (i < maxRetries - 1) {
          // Exponential backoff
          const delay = Math.pow(2, i) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError!
  }

  private setupAutoReconnect(serverId: string, config: ServerConfig, options: ConnectionOptions) {
    const client = this.connections.get(serverId)!

    client.on('disconnect', async () => {
      console.log(`Connection lost to ${serverId}, attempting reconnect...`)

      // Clear existing timer
      if (this.reconnectTimers.has(serverId)) {
        clearTimeout(this.reconnectTimers.get(serverId)!)
      }

      // Schedule reconnect
      const timer = setTimeout(async () => {
        try {
          await this.connectWithRetry(client, config, options.maxRetries)
          console.log(`Reconnected to ${serverId}`)
        } catch (error) {
          console.error(`Failed to reconnect to ${serverId}:`, error)

          // Schedule another attempt
          if (options.autoReconnect) {
            this.setupAutoReconnect(serverId, config, options)
          }
        }
      }, options.reconnectDelay || 5000)

      this.reconnectTimers.set(serverId, timer)
    })
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.connections.get(serverId)
    if (!client) return

    // Clear reconnect timer
    if (this.reconnectTimers.has(serverId)) {
      clearTimeout(this.reconnectTimers.get(serverId)!)
      this.reconnectTimers.delete(serverId)
    }

    // Disconnect client
    await client.disconnect()
    this.connections.delete(serverId)
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map((id) => this.disconnect(id))

    await Promise.all(promises)
  }
}
```

## Tool Management

### Tool Registry

Manage available tools:

```typescript
import { Tool, ToolCall, ToolResult } from '@modelcontextprotocol/sdk/types'

export class ToolRegistry {
  private tools = new Map<string, Tool>()
  private handlers = new Map<string, ToolHandler>()

  register(tool: Tool, handler: ToolHandler): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`)
    }

    this.tools.set(tool.name, tool)
    this.handlers.set(tool.name, handler)
  }

  unregister(toolName: string): void {
    this.tools.delete(toolName)
    this.handlers.delete(toolName)
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values())
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  async callTool(call: ToolCall): Promise<ToolResult> {
    const handler = this.handlers.get(call.name)

    if (!handler) {
      return {
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool ${call.name} not found`
        }
      }
    }

    try {
      // Validate arguments
      const tool = this.tools.get(call.name)!
      if (tool.inputSchema) {
        this.validateArguments(call.arguments, tool.inputSchema)
      }

      // Execute tool
      const result = await handler(call.arguments)

      return {
        content: result
      }
    } catch (error) {
      return {
        error: {
          code: 'TOOL_ERROR',
          message: error.message,
          data: error
        }
      }
    }
  }

  private validateArguments(args: any, schema: any): void {
    // Implement JSON Schema validation
    // This is a simplified version
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in args)) {
          throw new Error(`Missing required field: ${field}`)
        }
      }
    }
  }
}

type ToolHandler = (args: any) => Promise<any>
```

### Tool Implementation

Create MCP tools:

```typescript
export function createFileSystemTools(): Tool[] {
  return [
    {
      name: 'read_file',
      description: 'Read contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'write_file',
      description: 'Write contents to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file'
          },
          content: {
            type: 'string',
            description: 'Content to write'
          }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'list_directory',
      description: 'List contents of a directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the directory'
          }
        },
        required: ['path']
      }
    }
  ]
}

export function createFileSystemHandlers(): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>()

  handlers.set('read_file', async ({ path }) => {
    const content = await fs.readFile(path, 'utf-8')
    return { content }
  })

  handlers.set('write_file', async ({ path, content }) => {
    await fs.writeFile(path, content, 'utf-8')
    return { success: true }
  })

  handlers.set('list_directory', async ({ path }) => {
    const entries = await fs.readdir(path, { withFileTypes: true })
    return {
      files: entries.filter((e) => e.isFile()).map((e) => e.name),
      directories: entries.filter((e) => e.isDirectory()).map((e) => e.name)
    }
  })

  return handlers
}
```

## Resource Management

### Resource Manager

Handle MCP resources:

```typescript
import { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types'

export class ResourceManager {
  private resources = new Map<string, Resource>()
  private templates = new Map<string, ResourceTemplate>()

  registerResource(resource: Resource): void {
    this.resources.set(resource.uri, resource)
  }

  registerTemplate(template: ResourceTemplate): void {
    this.templates.set(template.uriTemplate, template)
  }

  async getResource(uri: string): Promise<Resource | null> {
    // Check direct resources
    if (this.resources.has(uri)) {
      return this.resources.get(uri)!
    }

    // Check templates
    for (const [template, resourceTemplate] of this.templates) {
      if (this.matchesTemplate(uri, template)) {
        return this.resolveTemplate(uri, resourceTemplate)
      }
    }

    return null
  }

  private matchesTemplate(uri: string, template: string): boolean {
    // Simple template matching
    const regex = template.replace(/\{(\w+)\}/g, '([^/]+)').replace(/\//g, '\\/')

    return new RegExp(`^${regex}$`).test(uri)
  }

  private async resolveTemplate(uri: string, template: ResourceTemplate): Promise<Resource> {
    // Extract parameters from URI
    const params = this.extractParams(uri, template.uriTemplate)

    // Generate resource
    return {
      uri,
      name: template.name.replace(/\{(\w+)\}/g, (_, key) => params[key]),
      description: template.description,
      mimeType: template.mimeType
    }
  }

  private extractParams(uri: string, template: string): Record<string, string> {
    const params: Record<string, string> = {}
    const templateParts = template.split('/')
    const uriParts = uri.split('/')

    for (let i = 0; i < templateParts.length; i++) {
      const part = templateParts[i]
      if (part.startsWith('{') && part.endsWith('}')) {
        const key = part.slice(1, -1)
        params[key] = uriParts[i]
      }
    }

    return params
  }
}
```

## Transport Implementations

### StdIO Transport

Standard input/output transport:

```typescript
export class StdIOTransport implements Transport {
  private process: ChildProcess
  private messageHandler?: (message: any) => void

  constructor(private config: StdIOConfig) {}

  async start(): Promise<void> {
    this.process = spawn(this.config.command, this.config.args || [], {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Handle stdout
    this.process.stdout?.on('data', (data) => {
      this.handleData(data)
    })

    // Handle stderr
    this.process.stderr?.on('data', (data) => {
      console.error(`Server error: ${data}`)
    })

    // Handle process exit
    this.process.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Server exited with code ${code}`)
      }
    })
  }

  async send(message: any): Promise<void> {
    if (!this.process.stdin) {
      throw new Error('Process not started')
    }

    const json = JSON.stringify(message)
    this.process.stdin.write(json + '\n')
  }

  onMessage(handler: (message: any) => void): void {
    this.messageHandler = handler
  }

  private handleData(data: Buffer): void {
    const lines = data.toString().split('\n').filter(Boolean)

    for (const line of lines) {
      try {
        const message = JSON.parse(line)
        this.messageHandler?.(message)
      } catch (error) {
        console.error('Failed to parse message:', line)
      }
    }
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill()
      await new Promise((resolve) => {
        this.process.once('exit', resolve)
      })
    }
  }
}
```

## Testing MCP Client

### Client Testing

Test MCP client functionality:

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { MCPClient } from '../mcp-client'
import { MockTransport } from './mocks/mock-transport'

describe('MCPClient', () => {
  let client: MCPClient
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    client = new MCPClient({
      name: 'test-client',
      transport
    })
  })

  afterEach(async () => {
    await client.disconnect()
  })

  test('connects to server', async () => {
    await client.connect({
      transport: 'mock',
      serverInfo: { name: 'test-server' }
    })

    expect(client.isConnected()).toBe(true)
    expect(transport.isConnected()).toBe(true)
  })

  test('discovers server capabilities', async () => {
    transport.mockCapabilities({
      tools: ['read_file', 'write_file'],
      resources: ['file://*']
    })

    await client.connect({ transport: 'mock' })
    const capabilities = await client.getCapabilities()

    expect(capabilities.tools).toContain('read_file')
    expect(capabilities.resources).toContain('file://*')
  })

  test('calls tools', async () => {
    await client.connect({ transport: 'mock' })

    const result = await client.callTool({
      name: 'read_file',
      arguments: { path: '/test.txt' }
    })

    expect(result.content).toBeDefined()
  })

  test('handles disconnection', async () => {
    await client.connect({ transport: 'mock' })
    await client.disconnect()

    expect(client.isConnected()).toBe(false)
    expect(transport.isConnected()).toBe(false)
  })
})
```

## Best Practices

### 1. Connection Management

- Always clean up connections
- Implement reconnection logic
- Handle connection errors gracefully
- Monitor connection health
- Use connection pooling

### 2. Protocol Compliance

- Follow MCP specification exactly
- Validate all messages
- Handle protocol errors
- Version compatibility checks
- Proper capability negotiation

### 3. Error Handling

- Catch all async errors
- Provide meaningful error messages
- Implement retry logic
- Log protocol errors
- Handle timeout scenarios

### 4. Performance

- Use connection pooling
- Implement message batching
- Cache server capabilities
- Minimize round trips
- Optimize transport layer

### 5. Security

- Validate server certificates
- Sanitize tool arguments
- Implement rate limiting
- Audit tool usage
- Secure transport channels

## Common Pitfalls to Avoid

1. **Resource Leaks** - Always clean up connections and processes
2. **Blocking Operations** - Use async/await properly
3. **Message Ordering** - Handle concurrent messages correctly
4. **Protocol Violations** - Follow MCP spec exactly
5. **Error Swallowing** - Always propagate or handle errors
6. **Memory Leaks** - Clear event listeners and timers
7. **Race Conditions** - Properly synchronize operations

## Integration with Other Packages

- Used by **@promptliano/server** to provide MCP capabilities
- Configured by **@promptliano/cli** during setup
- Uses types from **@modelcontextprotocol/sdk**
- Integrates with **@promptliano/services** for tool implementation

The MCP client package enables Promptliano to leverage the Model Context Protocol for enhanced AI interactions, providing a robust and extensible foundation for tool and resource management.
