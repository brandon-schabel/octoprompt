// Recent changes:
// - Created dedicated MCP stdio server for Claude Desktop compatibility
// - Implemented all MCP protocol methods (initialize, tools/list, tools/call, resources/list, resources/read)
// - Added proper error handling and JSON-RPC 2.0 compliance
// - Connected to existing Promptliano services for file operations and project management

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { getProjectFiles, getProjectById, suggestFiles, listProjects } from '@promptliano/services'
import { CONSOLIDATED_TOOLS, getConsolidatedToolByName } from './mcp/tools-registry'

// Create MCP server
const server = new Server(
  {
    name: 'promptliano-mcp',
    version: '0.9.2'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
)

// Helper to get project ID from environment
function getProjectId(): number | null {
  const projectIdStr = process.env.PROMPTLIANO_PROJECT_ID
  if (projectIdStr) {
    const parsed = parseInt(projectIdStr, 10)
    if (!isNaN(parsed)) return parsed
  }
  return null
}

// Helper to get project if specified
async function getProjectIfSpecified(): Promise<number | null> {
  const projectId = getProjectId()
  if (!projectId) {
    // No project ID specified - this is fine for global installation
    return null
  }

  try {
    await getProjectById(projectId)
    return projectId
  } catch (error) {
    console.error(
      `Project ${projectId} not found. Please set PROMPTLIANO_PROJECT_ID environment variable to a valid project ID.`
    )
    throw new Error(`Project ${projectId} not found`)
  }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: CONSOLIDATED_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    const tool = getConsolidatedToolByName(name)

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`)
    }

    // Get project ID from environment or from the tool arguments
    let projectId = await getProjectIfSpecified()

    // Some tools (like list_projects) don't need a project ID
    // Others might have projectId in their arguments
    if (!projectId && args && 'projectId' in args && typeof args.projectId === 'number') {
      projectId = args.projectId
    }

    const result = await tool.handler(args || {}, projectId ?? undefined)
    return {
      content: result.content,
      isError: result.isError
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ],
      isError: true
    }
  }
})

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const projectId = await getProjectIfSpecified()

    // If no project ID specified, return general resources
    if (!projectId) {
      return {
        resources: [
          {
            uri: 'promptliano://info',
            name: 'Promptliano Info',
            description: 'Information about Promptliano MCP Server',
            mimeType: 'text/plain'
          },
          {
            uri: 'promptliano://projects',
            name: 'Available Projects',
            description: 'List of available Promptliano projects',
            mimeType: 'application/json'
          }
        ]
      }
    }

    const project = await getProjectById(projectId)
    const files = await getProjectFiles(projectId)

    const resources = [
      {
        uri: `promptliano://projects/${projectId}/summary`,
        name: 'Project Summary',
        description: `Summary of project "${project.name}"`,
        mimeType: 'text/plain'
      },
      {
        uri: `promptliano://projects/${projectId}/suggest-files`,
        name: 'File Suggestions',
        description: 'AI-powered file suggestions based on prompts',
        mimeType: 'application/json'
      }
    ]

    // Add individual file resources (limit to first 20 for performance)
    const fileResources = (files || []).slice(0, 20).map((file) => ({
      uri: `promptliano://projects/${projectId}/files/${file.id}`,
      name: file.name,
      description: `File: ${file.path} (${file.size} bytes)`,
      mimeType:
        file.extension === '.json'
          ? 'application/json'
          : file.extension === '.md'
            ? 'text/markdown'
            : file.extension.match(/\.(js|ts|jsx|tsx)$/)
              ? 'text/javascript'
              : 'text/plain'
    }))

    resources.push(...fileResources)

    return { resources }
  } catch (error) {
    console.error('Error listing resources:', error)
    return { resources: [] }
  }
})

// Read a resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params

  try {
    const projectId = await getProjectIfSpecified()

    if (uri.startsWith('promptliano://')) {
      const urlParts = uri.replace('promptliano://', '').split('/')

      // Handle general resources (no project context needed)
      if (urlParts[0] === 'info') {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Promptliano MCP Server v0.9.2

Promptliano is a powerful project management and AI assistance tool.

Available tools:
- list_projects: List all available projects
- get_project: Get details about a specific project
- create_project: Create a new project
- And many more...

To work with a specific project, either:
1. Set PROMPTLIANO_PROJECT_ID environment variable
2. Pass projectId in tool arguments

For more information, visit: https://github.com/Ejb503/promptliano`
            }
          ]
        }
      } else if (urlParts[0] === 'projects' && !urlParts[1]) {
        // List all projects
        const projects = await listProjects()
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(projects, null, 2)
            }
          ]
        }
      }

      if (projectId && urlParts[0] === 'projects' && urlParts[1] === projectId.toString()) {
        if (urlParts[2] === 'summary') {
          // Project summary resource
          const project = await getProjectById(projectId)
          const files = await getProjectFiles(projectId)
          const fileCount = files?.length || 0
          const summary = `Project: ${project.name}\nPath: ${project.path}\nFiles: ${fileCount}\nCreated: ${new Date(project.created).toLocaleString()}`

          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: summary
              }
            ]
          }
        } else if (urlParts[2] === 'suggest-files') {
          // File suggestions resource (requires prompt parameter)
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    message: 'This resource requires a prompt parameter. Use the suggest_files tool instead.',
                    example: {
                      tool: 'suggest_files',
                      arguments: {
                        prompt: 'components for user authentication',
                        limit: 10
                      }
                    }
                  },
                  null,
                  2
                )
              }
            ]
          }
        } else if (urlParts[2] === 'files' && urlParts[3]) {
          // Individual file resource
          const fileId = parseInt(urlParts[3])
          const files = await getProjectFiles(projectId)
          const file = files?.find((f) => f.id === fileId)

          if (!file) {
            throw new Error(`File not found with ID: ${fileId}`)
          }

          return {
            contents: [
              {
                uri,
                mimeType:
                  file.extension === '.json'
                    ? 'application/json'
                    : file.extension === '.md'
                      ? 'text/markdown'
                      : file.extension.match(/\.(js|ts|jsx|tsx)$/)
                        ? 'text/javascript'
                        : 'text/plain',
                text: file.content
              }
            ]
          }
        }
      }
    }

    throw new Error(`Unknown resource URI: ${uri}`)
  } catch (error) {
    throw new Error(`Resource read failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Use stderr for logging to avoid interfering with JSON-RPC messages on stdout
  console.error('Promptliano MCP server running on stdio')
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})
