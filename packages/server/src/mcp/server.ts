import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
  CallToolResult,
  ReadResourceResult
} from '@modelcontextprotocol/sdk/types.js'
import { listProjects, getProjectCompactSummary } from '@octoprompt/services'
import { CONSOLIDATED_TOOLS } from './consolidated-tools'

// MCP Server instance - singleton
let mcpServer: Server | null = null

/**
 * Initialize and return the MCP server instance
 */
export function getMCPServer(): Server {
  if (!mcpServer) {
    mcpServer = new Server(
      {
        name: 'octoprompt-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    )

    // Register tools
    registerTools(mcpServer)

    // Register resources
    registerResources(mcpServer)
  }

  return mcpServer
}

/**
 * Register all MCP tools
 */
function registerTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Use consolidated tools only
    const tools: Tool[] = CONSOLIDATED_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))

    return { tools }
  })

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      // Find and execute consolidated tool
      const consolidatedTool = CONSOLIDATED_TOOLS.find((tool) => tool.name === name)
      if (consolidatedTool) {
        return await consolidatedTool.handler(args as any)
      }

      throw new Error(`Unknown tool: ${name}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`
          }
        ],
        isError: true
      } as CallToolResult
    }
  })
}

/**
 * Register all MCP resources
 */
function registerResources(server: Server) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const projects = await listProjects()

      const resources: Resource[] = projects.map((project) => ({
        uri: `octoprompt://project/${project.id}/structure`,
        name: `${project.name} Structure`,
        description: `File structure and organization of ${project.name}`,
        mimeType: 'text/plain'
      }))

      return { resources }
    } catch (error) {
      return { resources: [] }
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params

    try {
      // Parse the URI
      const match = uri.match(/^octoprompt:\/\/project\/(\d+)\/structure$/)
      if (!match) {
        throw new Error('Invalid resource URI')
      }

      const projectId = parseInt(match[1], 10)
      const summary = await getProjectCompactSummary(projectId)

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: summary
          }
        ]
      } as ReadResourceResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to read resource: ${errorMessage}`)
    }
  })
}

/**
 * Start the MCP server with stdio transport
 */
export async function startStdioMCPServer() {
  const server = getMCPServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)
  console.error('MCP Server started on stdio')
}
