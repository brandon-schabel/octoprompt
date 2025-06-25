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
  getPromptById,
  getProjectCompactSummary,
  createTicket,
  getTicketById,
  listTicketsByProject,
  updateTicket,
  createTask,
  getTasks,
  updateTask,
  suggestTasksForTicket
} from '@octoprompt/services'
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
        name: 'get_project_compact_summary',
        description: 'Get a compact, AI-generated architectural overview of the project optimized for AI context',
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
      },
      {
        name: 'list_tickets',
        description: 'List all tickets for a project with optional status filter',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'number',
              description: 'The ID of the project'
            },
            status: {
              type: 'string',
              description: 'Filter by ticket status (open, in_progress, closed)'
            }
          },
          required: ['projectId']
        }
      },
      {
        name: 'get_ticket',
        description: 'Get details of a specific ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'number',
              description: 'The ID of the ticket to retrieve'
            }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'create_ticket',
        description: 'Create a new ticket',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'number',
              description: 'The ID of the project'
            },
            title: {
              type: 'string',
              description: 'The title of the ticket'
            },
            overview: {
              type: 'string',
              description: 'Detailed description of the ticket'
            },
            priority: {
              type: 'string',
              description: 'Priority level (low, normal, high)'
            }
          },
          required: ['projectId', 'title']
        }
      },
      {
        name: 'update_ticket',
        description: 'Update an existing ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'number',
              description: 'The ID of the ticket to update'
            },
            title: {
              type: 'string',
              description: 'New title for the ticket'
            },
            overview: {
              type: 'string',
              description: 'New overview for the ticket'
            },
            status: {
              type: 'string',
              description: 'New status (open, in_progress, closed)'
            },
            priority: {
              type: 'string',
              description: 'New priority (low, normal, high)'
            }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'list_tasks',
        description: 'List all tasks for a ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'number',
              description: 'The ID of the ticket'
            }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'create_task',
        description: 'Create a new task for a ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'number',
              description: 'The ID of the ticket'
            },
            content: {
              type: 'string',
              description: 'The content of the task'
            }
          },
          required: ['ticketId', 'content']
        }
      },
      {
        name: 'update_task',
        description: 'Update a task',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'number',
              description: 'The ID of the ticket'
            },
            taskId: {
              type: 'number',
              description: 'The ID of the task to update'
            },
            content: {
              type: 'string',
              description: 'New content for the task'
            },
            done: {
              type: 'boolean',
              description: 'Whether the task is completed'
            }
          },
          required: ['ticketId', 'taskId']
        }
      },
      {
        name: 'suggest_ticket_tasks',
        description: 'Get AI-suggested tasks for a ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'number',
              description: 'The ID of the ticket'
            },
            userContext: {
              type: 'string',
              description: 'Additional context to help generate better task suggestions'
            }
          },
          required: ['ticketId']
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

        case 'get_project_compact_summary':
          return await handleGetProjectCompactSummary(args as any)

        case 'list_prompts':
          return await handleListPrompts(args as any)

        case 'get_prompt':
          return await handleGetPrompt(args as any)

        case 'list_tickets':
          return await handleListTickets(args as any)

        case 'get_ticket':
          return await handleGetTicket(args as any)

        case 'create_ticket':
          return await handleCreateTicket(args as any)

        case 'update_ticket':
          return await handleUpdateTicket(args as any)

        case 'list_tasks':
          return await handleListTasks(args as any)

        case 'create_task':
          return await handleCreateTask(args as any)

        case 'update_task':
          return await handleUpdateTask(args as any)

        case 'suggest_ticket_tasks':
          return await handleSuggestTicketTasks(args as any)

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
      .filter((file) => file.path.startsWith(browsePath))
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

    files.forEach((file) => {
      const parts = file.path.split('/')
      if (parts.length > 1) {
        dirs.add(parts[0])
      } else {
        rootFiles.push(file.path)
      }
    })

    result += 'Directories:\n'
    Array.from(dirs)
      .sort()
      .forEach((dir) => {
        result += `  ${dir}/\n`
      })

    if (rootFiles.length > 0) {
      result += '\nRoot files:\n'
      rootFiles.sort().forEach((file) => {
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
  const file = files.find((f) => f.path === filePath)

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

async function handleGetProjectCompactSummary(args: { projectId: number }): Promise<CallToolResult> {
  const { projectId } = args
  const compactSummary = await getProjectCompactSummary(projectId)

  return {
    content: [
      {
        type: 'text',
        text: compactSummary
      }
    ]
  }
}

async function handleListPrompts(args: { projectId?: number }): Promise<CallToolResult> {
  const prompts = args.projectId ? await listPromptsByProject(args.projectId) : await listAllPrompts()

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
 * Ticket-related tool handlers
 */
async function handleListTickets(args: { projectId: number; status?: string }): Promise<CallToolResult> {
  const { projectId, status } = args
  const tickets = await listTicketsByProject(projectId, status)

  let result = `Found ${tickets.length} tickets\n\n`

  for (const ticket of tickets) {
    result += `ID: ${ticket.id}\n`
    result += `Title: ${ticket.title}\n`
    result += `Status: ${ticket.status}\n`
    result += `Priority: ${ticket.priority}\n`
    result += `Overview: ${ticket.overview.substring(0, 100)}${ticket.overview.length > 100 ? '...' : ''}\n`
    result += `Created: ${new Date(ticket.created).toISOString()}\n`
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

async function handleGetTicket(args: { ticketId: number }): Promise<CallToolResult> {
  const { ticketId } = args
  const ticket = await getTicketById(ticketId)

  let result = `Ticket: ${ticket.title}\n`
  result += `ID: ${ticket.id}\n`
  result += `Project ID: ${ticket.projectId}\n`
  result += `Status: ${ticket.status}\n`
  result += `Priority: ${ticket.priority}\n`
  result += `Created: ${new Date(ticket.created).toISOString()}\n`
  result += `Updated: ${new Date(ticket.updated).toISOString()}\n\n`
  result += `Overview:\n${ticket.overview}`

  return {
    content: [
      {
        type: 'text',
        text: result
      }
    ]
  }
}

async function handleCreateTicket(args: {
  projectId: number
  title: string
  overview?: string
  priority?: 'low' | 'normal' | 'high'
}): Promise<CallToolResult> {
  const ticket = await createTicket({
    projectId: args.projectId,
    title: args.title,
    overview: args.overview || '',
    priority: args.priority || 'normal'
  })

  return {
    content: [
      {
        type: 'text',
        text: `Ticket created successfully:\nID: ${ticket.id}\nTitle: ${ticket.title}\nStatus: ${ticket.status}`
      }
    ]
  }
}

async function handleUpdateTicket(args: {
  ticketId: number
  title?: string
  overview?: string
  status?: 'open' | 'in_progress' | 'closed'
  priority?: 'low' | 'normal' | 'high'
}): Promise<CallToolResult> {
  const ticket = await updateTicket(args.ticketId, {
    title: args.title,
    overview: args.overview,
    status: args.status,
    priority: args.priority
  })

  return {
    content: [
      {
        type: 'text',
        text: `Ticket updated successfully:\nID: ${ticket.id}\nTitle: ${ticket.title}\nStatus: ${ticket.status}`
      }
    ]
  }
}

async function handleListTasks(args: { ticketId: number }): Promise<CallToolResult> {
  const { ticketId } = args
  const tasks = await getTasks(ticketId)

  let result = `Found ${tasks.length} tasks for ticket ${ticketId}\n\n`

  for (const task of tasks) {
    result += `ID: ${task.id}\n`
    result += `Status: ${task.done ? '[✓]' : '[ ]'}\n`
    result += `Content: ${task.content}\n`
    result += `Order: ${task.orderIndex}\n`
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

async function handleCreateTask(args: { ticketId: number; content: string }): Promise<CallToolResult> {
  const { ticketId, content } = args
  const task = await createTask(ticketId, content)

  return {
    content: [
      {
        type: 'text',
        text: `Task created successfully:\nID: ${task.id}\nContent: ${task.content}\nOrder: ${task.orderIndex}`
      }
    ]
  }
}

async function handleUpdateTask(args: {
  ticketId: number
  taskId: number
  content?: string
  done?: boolean
}): Promise<CallToolResult> {
  const task = await updateTask(args.ticketId, args.taskId, {
    content: args.content,
    done: args.done
  })

  return {
    content: [
      {
        type: 'text',
        text: `Task updated successfully:\nID: ${task.id}\nContent: ${task.content}\nStatus: ${task.done ? 'Done' : 'Pending'}`
      }
    ]
  }
}

async function handleSuggestTicketTasks(args: { ticketId: number; userContext?: string }): Promise<CallToolResult> {
  const { ticketId, userContext } = args
  const suggestions = await suggestTasksForTicket(ticketId, userContext)

  let result = `AI-suggested tasks for ticket ${ticketId}:\n\n`
  suggestions.forEach((task, index) => {
    result += `${index + 1}. ${task}\n`
  })

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
