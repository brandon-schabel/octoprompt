// Recent changes:
// - Created dedicated MCP stdio server for Claude Desktop compatibility
// - Implemented all MCP protocol methods (initialize, tools/list, tools/call, resources/list, resources/read)
// - Added proper error handling and JSON-RPC 2.0 compliance
// - Connected to existing OctoPrompt services for file operations and project management

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
    getProjectFiles,
    getProjectById,
    suggestFiles,
    listProjects
} from '@octoprompt/services'

// Create MCP server
const server = new Server(
    {
        name: 'octoprompt-mcp',
        version: '0.5.4',
    },
    {
        capabilities: {
            tools: {},
            resources: {},
        },
    }
)

// Helper to get project ID from environment or use default
function getProjectId(): number {
    const projectId = process.env.OCTOPROMPT_PROJECT_ID
    if (projectId) {
        return parseInt(projectId, 10)
    }
    // Default to project 1 if not specified
    return 1
}

// Helper to get project or create default
async function ensureProject(): Promise<number> {
    const projectId = getProjectId()

    try {
        await getProjectById(projectId)
        return projectId
    } catch (error) {
        // If project doesn't exist, try to get the first available project
        try {
            const projects = await listProjects()
            if (projects.length > 0) {
                return projects[0].id
            }
        } catch (e) {
            // Ignore error
        }

        console.error(`Project ${projectId} not found. Please set OCTOPROMPT_PROJECT_ID environment variable to a valid project ID.`)
        throw new Error(`Project ${projectId} not found`)
    }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'file_read',
                description: 'Read the contents of a file in the project',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'The file path to read (relative to project root)',
                        },
                    },
                    required: ['path'],
                },
            },
            {
                name: 'file_list',
                description: 'List files in the project directory',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Directory path to list (relative to project root, defaults to root)',
                            default: '.',
                        },
                        recursive: {
                            type: 'boolean',
                            description: 'Whether to list files recursively',
                            default: false,
                        },
                    },
                },
            },
            {
                name: 'suggest_files',
                description: 'Get AI-suggested files based on a prompt or task description',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: {
                            type: 'string',
                            description: 'The prompt or task description to suggest files for',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of files to suggest',
                            default: 10,
                        },
                    },
                    required: ['prompt'],
                },
            },
            {
                name: 'project_summary',
                description: 'Get a summary of the project structure and contents',
                inputSchema: {
                    type: 'object',
                    properties: {
                        include_files: {
                            type: 'boolean',
                            description: 'Whether to include file summaries',
                            default: true,
                        },
                    },
                },
            },
        ],
    }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
        const projectId = await ensureProject()

        switch (name) {
            case 'file_read': {
                if (!args?.path) {
                    throw new Error('File path is required')
                }

                const files = await getProjectFiles(projectId)
                const file = files?.find(f => f.path === args.path)

                if (!file) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `File not found: ${args.path}`,
                            },
                        ],
                        isError: true,
                    }
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: file.content,
                        },
                    ],
                }
            }

            case 'file_list': {
                const files = await getProjectFiles(projectId)
                const fileList = (files || [])
                    .map(f => `${f.path} (${f.size} bytes)`)
                    .join('\n')

                return {
                    content: [
                        {
                            type: 'text',
                            text: fileList || 'No files found in project',
                        },
                    ],
                }
            }

            case 'suggest_files': {
                if (!args?.prompt) {
                    throw new Error('Prompt is required for file suggestions')
                }

                const suggestions = await suggestFiles(projectId, args.prompt, args.limit || 10)
                const suggestionText = suggestions
                    .map(f => `${f.path} - ${f.summary || 'No summary'}`)
                    .join('\n')

                return {
                    content: [
                        {
                            type: 'text',
                            text: suggestionText || 'No file suggestions found',
                        },
                    ],
                }
            }

            case 'project_summary': {
                const project = await getProjectById(projectId)
                const files = await getProjectFiles(projectId)
                const fileCount = files?.length || 0
                const summary = `Project: ${project.name}\nPath: ${project.path}\nFiles: ${fileCount}\nCreated: ${new Date(project.created).toLocaleString()}`

                return {
                    content: [
                        {
                            type: 'text',
                            text: summary,
                        },
                    ],
                }
            }

            default:
                throw new Error(`Unknown tool: ${name}`)
        }
    } catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
            ],
            isError: true,
        }
    }
})

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
        const projectId = await ensureProject()
        const project = await getProjectById(projectId)
        const files = await getProjectFiles(projectId)

        const resources = [
            {
                uri: `octoprompt://projects/${projectId}/summary`,
                name: 'Project Summary',
                description: `Summary of project "${project.name}"`,
                mimeType: 'text/plain',
            },
            {
                uri: `octoprompt://projects/${projectId}/suggest-files`,
                name: 'File Suggestions',
                description: 'AI-powered file suggestions based on prompts',
                mimeType: 'application/json',
            },
        ]

        // Add individual file resources (limit to first 20 for performance)
        const fileResources = (files || []).slice(0, 20).map(file => ({
            uri: `octoprompt://projects/${projectId}/files/${file.id}`,
            name: file.name,
            description: `File: ${file.path} (${file.size} bytes)`,
            mimeType: file.extension === '.json' ? 'application/json' :
                file.extension === '.md' ? 'text/markdown' :
                    file.extension.match(/\.(js|ts|jsx|tsx)$/) ? 'text/javascript' :
                        'text/plain',
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
        const projectId = await ensureProject()

        if (uri.startsWith('octoprompt://')) {
            const urlParts = uri.replace('octoprompt://', '').split('/')

            if (urlParts[0] === 'projects' && urlParts[1] === projectId.toString()) {
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
                                text: summary,
                            },
                        ],
                    }
                } else if (urlParts[2] === 'suggest-files') {
                    // File suggestions resource (requires prompt parameter)
                    return {
                        contents: [
                            {
                                uri,
                                mimeType: 'application/json',
                                text: JSON.stringify({
                                    message: 'This resource requires a prompt parameter. Use the suggest_files tool instead.',
                                    example: {
                                        tool: 'suggest_files',
                                        arguments: {
                                            prompt: 'components for user authentication',
                                            limit: 10,
                                        },
                                    },
                                }, null, 2),
                            },
                        ],
                    }
                } else if (urlParts[2] === 'files' && urlParts[3]) {
                    // Individual file resource
                    const fileId = parseInt(urlParts[3])
                    const files = await getProjectFiles(projectId)
                    const file = files?.find(f => f.id === fileId)

                    if (!file) {
                        throw new Error(`File not found with ID: ${fileId}`)
                    }

                    return {
                        contents: [
                            {
                                uri,
                                mimeType: file.extension === '.json' ? 'application/json' :
                                    file.extension === '.md' ? 'text/markdown' :
                                        file.extension.match(/\.(js|ts|jsx|tsx)$/) ? 'text/javascript' :
                                            'text/plain',
                                text: file.content,
                            },
                        ],
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
    console.error('OctoPrompt MCP server running on stdio')
}

main().catch((error) => {
    console.error('Failed to start MCP server:', error)
    process.exit(1)
}) 