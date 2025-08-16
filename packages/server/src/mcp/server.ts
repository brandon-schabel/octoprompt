import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
  type Resource,
  type CallToolResult,
  type ReadResourceResult
} from '@modelcontextprotocol/sdk/types.js'
import { listProjects, getProjectCompactSummary } from '@promptliano/services'
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
        name: 'promptliano-mcp',
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
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params

    try {
      // Find and execute consolidated tool
      const consolidatedTool = CONSOLIDATED_TOOLS.find((tool) => tool.name === name)
      if (consolidatedTool) {
        const result = await consolidatedTool.handler(args as any)
        // Return the result as-is since it should already match CallToolResult
        return result as any
      }

      throw new Error(`Unknown tool: ${name}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Return proper CallToolResult format
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${errorMessage}`
          }
        ],
        isError: true
      } as any
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
      const resources: Resource[] = []

      // Add a general projects list resource
      resources.push({
        uri: 'promptliano://projects',
        name: 'All Projects',
        description: 'List of all available projects in Promptliano',
        mimeType: 'application/json'
      })

      // Add individual project resources
      for (const project of projects) {
        // Project summary resource
        resources.push({
          uri: `promptliano://project/${project.id}/summary`,
          name: `${project.name} Summary`,
          description: `Compact summary of ${project.name} project structure and content`,
          mimeType: 'text/plain'
        })

        // Project files resource
        resources.push({
          uri: `promptliano://project/${project.id}/files`,
          name: `${project.name} Files`,
          description: `List of files in ${project.name} project`,
          mimeType: 'application/json'
        })
      }

      return { resources }
    } catch (error) {
      console.error('[MCP] Error listing resources:', error)
      return { resources: [] }
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params

    try {
      // Handle projects list
      if (uri === 'promptliano://projects') {
        const projects = await listProjects()
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(projects, null, 2)
            }
          ]
        } as ReadResourceResult
      }

      // Handle project summary
      const summaryMatch = uri.match(/^promptliano:\/\/project\/(\d+)\/summary$/)
      if (summaryMatch) {
        const projectId = parseInt(summaryMatch[1], 10)
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
      }

      // Handle project files list
      const filesMatch = uri.match(/^promptliano:\/\/project\/(\d+)\/files$/)
      if (filesMatch) {
        const projectId = parseInt(filesMatch[1], 10)
        const { getProjectFiles } = await import('@promptliano/services')
        const files = await getProjectFiles(projectId)

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(files || [], null, 2)
            }
          ]
        } as ReadResourceResult
      }

      throw new Error(`Invalid resource URI: ${uri}`)
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
