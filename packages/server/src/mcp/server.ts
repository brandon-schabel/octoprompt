import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
  TextContent,
  ImageContent,
  CallToolResult,
  ReadResourceResult
} from '@modelcontextprotocol/sdk/types.js'
import {
  getProjectById,
  getProjectFiles,
  listProjects,
  listAllPrompts,
  listPromptsByProject,
  getPromptById
} from '@octoprompt/services'
import { getFullProjectSummary } from '@octoprompt/services/src/utils/get-full-project-summary'
import { ApiError } from '@octoprompt/shared'
import path from 'node:path'
import fs from 'node:fs/promises'

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
  // Tool: browse_project_files
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: 'browse_project_files',
        description: 'Browse and explore files in a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'number',
              description: 'The ID of the project to browse'
            },
            path: {
              type: 'string',
              description: 'Optional path within the project to browse (relative to project root)'
            }
          },
          required: ['projectId']
        }
      },
      {
        name: 'get_file_content',
        description: 'Get the content of a specific file in a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'number',
              description: 'The ID of the project'
            },
            filePath: {
              type: 'string',
              description: 'The path of the file relative to the project root'
            }
          },
          required: ['projectId', 'filePath']
        }
      },
      {
        name: 'get_project_summary',
        description: 'Get a comprehensive summary of a project including structure, stats, and key files',
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
      },
      {
        name: 'list_prompts',
        description: 'List all prompts, optionally filtered by project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'number',
              description: 'Optional project ID to filter prompts'
            }
          },
          required: []
        }
      },
      {
        name: 'get_prompt',
        description: 'Get a specific prompt by ID',
        inputSchema: {
          type: 'object',
          properties: {
            promptId: {
              type: 'number',
              description: 'The ID of the prompt to retrieve'
            }
          },
          required: ['promptId']
        }
      }
    ]

    return { tools }
  })

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'browse_project_files':
          return await handleBrowseProjectFiles(args as any)
        
        case 'get_file_content':
          return await handleGetFileContent(args as any)
        
        case 'get_project_summary':
          return await handleGetProjectSummary(args as any)
        
        case 'list_prompts':
          return await handleListPrompts(args as any)
        
        case 'get_prompt':
          return await handleGetPrompt(args as any)
        
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
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
      
      const resources: Resource[] = projects.map(project => ({
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
      const summary = await getFullProjectSummary(projectId)
      
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
 * Tool handlers
 */
async function handleBrowseProjectFiles(args: { projectId: number; path?: string }): Promise<CallToolResult> {
  const { projectId, path: browsePath } = args
  
  const project = await getProjectById(projectId)
  const files = await getProjectFiles(projectId)
  
  if (!files) {
    throw new Error('Failed to get project files')
  }
  
  let result = `Project: ${project.name}\n`
  result += `Path: ${project.path}\n`
  result += `Total files: ${files.length}\n\n`
  
  if (browsePath) {
    // Filter files to show only those under the specified path
    const filteredFiles = files
      .filter(file => file.path.startsWith(browsePath))
      .sort((a, b) => a.path.localeCompare(b.path))
    
    result += `Files under ${browsePath}:\n`
    for (const file of filteredFiles) {
      const relativePath = file.path.substring(browsePath.length).replace(/^\//, '')
      result += `  ${relativePath}\n`
    }
  } else {
    // Show directory structure
    const dirs = new Set<string>()
    const rootFiles: string[] = []
    
    files.forEach(file => {
      const parts = file.path.split('/')
      if (parts.length > 1) {
        dirs.add(parts[0])
      } else {
        rootFiles.push(file.path)
      }
    })
    
    result += 'Directories:\n'
    Array.from(dirs).sort().forEach(dir => {
      result += `  ${dir}/\n`
    })
    
    if (rootFiles.length > 0) {
      result += '\nRoot files:\n'
      rootFiles.sort().forEach(file => {
        result += `  ${file}\n`
      })
    }
  }
  
  return {
    content: [
      {
        type: 'text',
        text: result
      }
    ]
  }
}

async function handleGetFileContent(args: { projectId: number; filePath: string }): Promise<CallToolResult> {
  const { projectId, filePath } = args
  
  const project = await getProjectById(projectId)
  const files = await getProjectFiles(projectId)
  
  if (!files) {
    throw new Error('Failed to get project files')
  }
  
  // Find the file by path
  const file = files.find(f => f.path === filePath)
  
  if (!file) {
    throw new Error(`File not found: ${filePath}`)
  }
  
  // Check if it's an image file
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
  const ext = path.extname(filePath).toLowerCase()
  
  if (imageExtensions.includes(ext)) {
    // For images, we need to read from the actual file system
    const fullPath = path.join(project.path, filePath)
    try {
      const data = await fs.readFile(fullPath)
      const base64 = data.toString('base64')
      
      return {
        content: [
          {
            type: 'image',
            data: base64,
            mimeType: `image/${ext.substring(1)}`
          } as ImageContent
        ]
      }
    } catch (error) {
      throw new Error(`Failed to read image file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  // For text files, return the content from storage
  return {
    content: [
      {
        type: 'text',
        text: file.content || ''
      }
    ]
  }
}

async function handleGetProjectSummary(args: { projectId: number }): Promise<CallToolResult> {
  const { projectId } = args
  const summary = await getFullProjectSummary(projectId)
  
  return {
    content: [
      {
        type: 'text',
        text: summary
      }
    ]
  }
}

async function handleListPrompts(args: { projectId?: number }): Promise<CallToolResult> {
  const prompts = args.projectId ? 
    await listPromptsByProject(args.projectId) : 
    await listAllPrompts()
  
  let result = `Found ${prompts.length} prompts\n\n`
  
  for (const prompt of prompts) {
    result += `ID: ${prompt.id}\n`
    result += `Name: ${prompt.name}\n`
    if (prompt.projectId) {
      result += `Project ID: ${prompt.projectId}\n`
    }
    result += `Created: ${new Date(prompt.created).toISOString()}\n`
    result += `Updated: ${new Date(prompt.updated).toISOString()}\n`
    result += '---\n\n'
  }
  
  return {
    content: [
      {
        type: 'text',
        text: result
      }
    ]
  }
}

async function handleGetPrompt(args: { promptId: number }): Promise<CallToolResult> {
  const { promptId } = args
  const prompt = await getPromptById(promptId)
  
  let result = `Prompt: ${prompt.name}\n`
  result += `ID: ${prompt.id}\n`
  if (prompt.projectId) {
    result += `Project ID: ${prompt.projectId}\n`
  }
  result += `Created: ${new Date(prompt.created).toISOString()}\n`
  result += `Updated: ${new Date(prompt.updated).toISOString()}\n\n`
  result += `Content:\n${prompt.content}`
  
  return {
    content: [
      {
        type: 'text',
        text: result
      }
    ]
  }
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