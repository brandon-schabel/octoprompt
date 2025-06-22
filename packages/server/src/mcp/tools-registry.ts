// Recent changes:
// - Created unified MCP tools registry with strong TypeScript typing
// - Added all project management, prompt service, file operations, and AI tools
// - Implemented type-safe tool definitions with proper input/output schemas
// - Centralized tool handlers using existing services

import { z } from '@hono/zod-openapi'
import {
    listProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    getProjectFiles,
    updateFileContent,
    optimizeUserInput,
    suggestFiles
} from '@octoprompt/services'
import {
    listAllPrompts,
    getPromptById,
    createPrompt,
    updatePrompt,
    deletePrompt,
    listPromptsByProject,
    addPromptToProject,
    removePromptFromProject
} from '@octoprompt/services'
import type {
    CreateProjectBody,
    UpdateProjectBody,
    CreatePromptBody,
    UpdatePromptBody
} from '@octoprompt/schemas'
import { getFullProjectSummary } from '@octoprompt/services'

// MCP Tool Types
export interface MCPToolInputSchema {
    type: 'object'
    properties: Record<string, {
        type: string
        description: string
        default?: any
        enum?: string[]
    }>
    required?: string[]
}

export interface MCPToolContent {
    type: 'text'
    text: string
}

export interface MCPToolResponse {
    content: MCPToolContent[]
    isError?: boolean
}

export interface MCPToolDefinition<TArgs = any> {
    name: string
    description: string
    inputSchema: MCPToolInputSchema
    handler: (args: TArgs, projectId?: number) => Promise<MCPToolResponse>
}

// Input type schemas for each tool
const ProjectListArgsSchema = z.object({}).strict()

const ProjectGetArgsSchema = z.object({
    projectId: z.number().int().positive()
}).strict()

const ProjectCreateArgsSchema = z.object({
    name: z.string().min(1),
    path: z.string().min(1),
    description: z.string().optional()
}).strict()

const ProjectUpdateArgsSchema = z.object({
    projectId: z.number().int().positive(),
    name: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    description: z.string().optional()
}).strict()

const ProjectDeleteArgsSchema = z.object({
    projectId: z.number().int().positive()
}).strict()

const FileReadArgsSchema = z.object({
    path: z.string().min(1)
}).strict()

const FileWriteArgsSchema = z.object({
    path: z.string().min(1),
    content: z.string()
}).strict()

const FileListArgsSchema = z.object({
    path: z.string().default('.').optional(),
    recursive: z.boolean().default(false).optional()
}).strict()

const SuggestFilesArgsSchema = z.object({
    prompt: z.string().min(1),
    limit: z.number().int().positive().default(10).optional()
}).strict()

const ProjectSummaryArgsSchema = z.object({
    include_files: z.boolean().default(true).optional()
}).strict()

const OptimizeUserInputArgsSchema = z.object({
    prompt: z.string().min(1)
}).strict()

const PromptListArgsSchema = z.object({}).strict()

const PromptGetArgsSchema = z.object({
    promptId: z.number().int().positive()
}).strict()

const PromptCreateArgsSchema = z.object({
    name: z.string().min(1),
    content: z.string().min(1),
    projectId: z.number().int().positive().optional()
}).strict()

const PromptUpdateArgsSchema = z.object({
    promptId: z.number().int().positive(),
    name: z.string().min(1).optional(),
    content: z.string().min(1).optional()
}).strict()

const PromptDeleteArgsSchema = z.object({
    promptId: z.number().int().positive()
}).strict()

const PromptListByProjectArgsSchema = z.object({
    projectId: z.number().int().positive()
}).strict()

const PromptAddToProjectArgsSchema = z.object({
    promptId: z.number().int().positive(),
    projectId: z.number().int().positive()
}).strict()

const PromptRemoveFromProjectArgsSchema = z.object({
    promptId: z.number().int().positive(),
    projectId: z.number().int().positive()
}).strict()

// Type-safe tool definitions
export const BUILTIN_TOOLS: readonly MCPToolDefinition[] = [
    // Project Management Tools
    {
        name: 'project_list',
        description: 'List all available projects',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
        handler: async (args: z.infer<typeof ProjectListArgsSchema>) => {
            try {
                const projects = await listProjects()
                const projectList = projects.map(p => `${p.id}: ${p.name} (${p.path})`).join('\n')
                return {
                    content: [{
                        type: 'text',
                        text: projectList || 'No projects found'
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error listing projects: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'project_get',
        description: 'Get details of a specific project',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: {
                    type: 'number',
                    description: 'The ID of the project to retrieve'
                }
            },
            required: ['projectId']
        },
        handler: async (args: z.infer<typeof ProjectGetArgsSchema>) => {
            try {
                const project = await getProjectById(args.projectId)
                const details = `Project: ${project.name}\nPath: ${project.path}\nDescription: ${project.description}\nCreated: ${new Date(project.created).toLocaleString()}\nUpdated: ${new Date(project.updated).toLocaleString()}`
                return {
                    content: [{
                        type: 'text',
                        text: details
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error getting project: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'project_create',
        description: 'Create a new project',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'The name of the project'
                },
                path: {
                    type: 'string',
                    description: 'The file system path of the project'
                },
                description: {
                    type: 'string',
                    description: 'Optional description of the project'
                }
            },
            required: ['name', 'path']
        },
        handler: async (args: z.infer<typeof ProjectCreateArgsSchema>) => {
            try {
                const projectData: CreateProjectBody = {
                    name: args.name,
                    path: args.path,
                    description: args.description
                }
                const project = await createProject(projectData)
                return {
                    content: [{
                        type: 'text',
                        text: `Project created successfully: ${project.name} (ID: ${project.id})`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error creating project: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'project_update',
        description: 'Update an existing project',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: {
                    type: 'number',
                    description: 'The ID of the project to update'
                },
                name: {
                    type: 'string',
                    description: 'New name for the project'
                },
                path: {
                    type: 'string',
                    description: 'New path for the project'
                },
                description: {
                    type: 'string',
                    description: 'New description for the project'
                }
            },
            required: ['projectId']
        },
        handler: async (args: z.infer<typeof ProjectUpdateArgsSchema>) => {
            try {
                const updateData: UpdateProjectBody = {}
                if (args.name !== undefined) updateData.name = args.name
                if (args.path !== undefined) updateData.path = args.path
                if (args.description !== undefined) updateData.description = args.description

                const project = await updateProject(args.projectId, updateData)
                return {
                    content: [{
                        type: 'text',
                        text: `Project updated successfully: ${project?.name} (ID: ${args.projectId})`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error updating project: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'project_delete',
        description: 'Delete a project',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: {
                    type: 'number',
                    description: 'The ID of the project to delete'
                }
            },
            required: ['projectId']
        },
        handler: async (args: z.infer<typeof ProjectDeleteArgsSchema>) => {
            try {
                const success = await deleteProject(args.projectId)
                return {
                    content: [{
                        type: 'text',
                        text: success ? `Project ${args.projectId} deleted successfully` : `Failed to delete project ${args.projectId}`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error deleting project: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    // File Operation Tools
    {
        name: 'file_read',
        description: 'Read the contents of a file in the project',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The file path to read (relative to project root)'
                }
            },
            required: ['path']
        },
        handler: async (args: z.infer<typeof FileReadArgsSchema>, projectId?: number) => {
            try {
                if (!projectId) {
                    return {
                        content: [{
                            type: 'text',
                            text: 'Project ID is required for file operations'
                        }],
                        isError: true
                    }
                }

                const files = await getProjectFiles(projectId)
                const file = files?.find(f => f.path === args.path)

                if (!file) {
                    return {
                        content: [{
                            type: 'text',
                            text: `File not found: ${args.path}`
                        }],
                        isError: true
                    }
                }

                return {
                    content: [{
                        type: 'text',
                        text: file.content || ''
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'file_write',
        description: 'Write content to a file in the project',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The file path to write to (relative to project root)'
                },
                content: {
                    type: 'string',
                    description: 'The content to write to the file'
                }
            },
            required: ['path', 'content']
        },
        handler: async (args: z.infer<typeof FileWriteArgsSchema>, projectId?: number) => {
            try {
                if (!projectId) {
                    return {
                        content: [{
                            type: 'text',
                            text: 'Project ID is required for file operations'
                        }],
                        isError: true
                    }
                }

                const files = await getProjectFiles(projectId)
                const file = files?.find(f => f.path === args.path)

                if (!file) {
                    return {
                        content: [{
                            type: 'text',
                            text: `File not found: ${args.path}. Use project file creation tools instead.`
                        }],
                        isError: true
                    }
                }

                await updateFileContent(projectId, file.id, args.content)
                return {
                    content: [{
                        type: 'text',
                        text: `File ${args.path} updated successfully`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
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
                    default: '.'
                },
                recursive: {
                    type: 'boolean',
                    description: 'Whether to list files recursively',
                    default: false
                }
            }
        },
        handler: async (args: z.infer<typeof FileListArgsSchema>, projectId?: number) => {
            try {
                if (!projectId) {
                    return {
                        content: [{
                            type: 'text',
                            text: 'Project ID is required for file operations'
                        }],
                        isError: true
                    }
                }

                const files = await getProjectFiles(projectId)
                const fileList = (files || [])
                    .map(f => `${f.path} (${f.size} bytes)`)
                    .join('\n')

                return {
                    content: [{
                        type: 'text',
                        text: fileList || 'No files found in project'
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error listing files: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'suggest_files',
        description: 'Get AI-suggested files based on a prompt or task description',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'The prompt or task description to suggest files for'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of files to suggest',
                    default: 10
                }
            },
            required: ['prompt']
        },
        handler: async (args: z.infer<typeof SuggestFilesArgsSchema>, projectId?: number) => {
            try {
                if (!projectId) {
                    return {
                        content: [{
                            type: 'text',
                            text: 'Project ID is required for file suggestions'
                        }],
                        isError: true
                    }
                }

                const suggestions = await suggestFiles(projectId, args.prompt, args.limit || 10)
                const suggestionText = suggestions
                    .map(f => `${f.path} - ${f.summary || 'No summary'}`)
                    .join('\n')

                return {
                    content: [{
                        type: 'text',
                        text: suggestionText || 'No file suggestions found'
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error suggesting files: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
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
                    default: true
                }
            }
        },
        handler: async (args: z.infer<typeof ProjectSummaryArgsSchema>, projectId?: number) => {
            try {
                if (!projectId) {
                    return {
                        content: [{
                            type: 'text',
                            text: 'Project ID is required for project summary'
                        }],
                        isError: true
                    }
                }

                const project = await getProjectById(projectId)
                const files = await getProjectFiles(projectId)
                const fileCount = files?.length || 0

                let summary = `Project: ${project.name}\nPath: ${project.path}\nDescription: ${project.description}\nFiles: ${fileCount}\nCreated: ${new Date(project.created).toLocaleString()}\nUpdated: ${new Date(project.updated).toLocaleString()}`

                if (args.include_files && files && files.length > 0) {
                    const fullSummary = await getFullProjectSummary(projectId)
                    summary = fullSummary
                }

                return {
                    content: [{
                        type: 'text',
                        text: summary
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error getting project summary: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    // AI Tools
    {
        name: 'optimize_user_input',
        description: 'Optimize a user prompt based on project context using AI',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'The user prompt to optimize'
                }
            },
            required: ['prompt']
        },
        handler: async (args: z.infer<typeof OptimizeUserInputArgsSchema>, projectId?: number) => {
            try {
                if (!projectId) {
                    return {
                        content: [{
                            type: 'text',
                            text: 'Project ID is required for prompt optimization'
                        }],
                        isError: true
                    }
                }

                const optimizedPrompt = await optimizeUserInput(projectId, args.prompt)
                return {
                    content: [{
                        type: 'text',
                        text: optimizedPrompt
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error optimizing prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    // Prompt Management Tools
    {
        name: 'prompt_list',
        description: 'List all available prompts',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
        handler: async (args: z.infer<typeof PromptListArgsSchema>) => {
            try {
                const prompts = await listAllPrompts()
                const promptList = prompts
                    .map(p => `${p.id}: ${p.name} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`)
                    .join('\n')
                return {
                    content: [{
                        type: 'text',
                        text: promptList || 'No prompts found'
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error listing prompts: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'prompt_get',
        description: 'Get details of a specific prompt',
        inputSchema: {
            type: 'object',
            properties: {
                promptId: {
                    type: 'number',
                    description: 'The ID of the prompt to retrieve'
                }
            },
            required: ['promptId']
        },
        handler: async (args: z.infer<typeof PromptGetArgsSchema>) => {
            try {
                const prompt = await getPromptById(args.promptId)
                const details = `Name: ${prompt.name}\nProject ID: ${prompt.projectId || 'None'}\nContent:\n${prompt.content}\n\nCreated: ${new Date(prompt.created).toLocaleString()}\nUpdated: ${new Date(prompt.updated).toLocaleString()}`
                return {
                    content: [{
                        type: 'text',
                        text: details
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error getting prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'prompt_create',
        description: 'Create a new prompt',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'The name of the prompt'
                },
                content: {
                    type: 'string',
                    description: 'The content of the prompt'
                },
                projectId: {
                    type: 'number',
                    description: 'Optional project ID to associate with the prompt'
                }
            },
            required: ['name', 'content']
        },
        handler: async (args: z.infer<typeof PromptCreateArgsSchema>) => {
            try {
                const promptData: CreatePromptBody = {
                    name: args.name,
                    content: args.content,
                    projectId: args.projectId
                }
                const prompt = await createPrompt(promptData)
                return {
                    content: [{
                        type: 'text',
                        text: `Prompt created successfully: ${prompt.name} (ID: ${prompt.id})`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error creating prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'prompt_update',
        description: 'Update an existing prompt',
        inputSchema: {
            type: 'object',
            properties: {
                promptId: {
                    type: 'number',
                    description: 'The ID of the prompt to update'
                },
                name: {
                    type: 'string',
                    description: 'New name for the prompt'
                },
                content: {
                    type: 'string',
                    description: 'New content for the prompt'
                }
            },
            required: ['promptId']
        },
        handler: async (args: z.infer<typeof PromptUpdateArgsSchema>) => {
            try {
                const updateData: UpdatePromptBody = {}
                if (args.name !== undefined) updateData.name = args.name
                if (args.content !== undefined) updateData.content = args.content

                const prompt = await updatePrompt(args.promptId, updateData)
                return {
                    content: [{
                        type: 'text',
                        text: `Prompt updated successfully: ${prompt.name} (ID: ${args.promptId})`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error updating prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'prompt_delete',
        description: 'Delete a prompt',
        inputSchema: {
            type: 'object',
            properties: {
                promptId: {
                    type: 'number',
                    description: 'The ID of the prompt to delete'
                }
            },
            required: ['promptId']
        },
        handler: async (args: z.infer<typeof PromptDeleteArgsSchema>) => {
            try {
                const success = await deletePrompt(args.promptId)
                return {
                    content: [{
                        type: 'text',
                        text: success ? `Prompt ${args.promptId} deleted successfully` : `Failed to delete prompt ${args.promptId}`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error deleting prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'prompt_list_by_project',
        description: 'List prompts associated with a specific project',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: {
                    type: 'number',
                    description: 'The ID of the project'
                }
            },
            required: ['projectId']
        },
        handler: async (args: z.infer<typeof PromptListByProjectArgsSchema>) => {
            try {
                const prompts = await listPromptsByProject(args.projectId)
                const promptList = prompts
                    .map(p => `${p.id}: ${p.name} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`)
                    .join('\n')
                return {
                    content: [{
                        type: 'text',
                        text: promptList || `No prompts found for project ${args.projectId}`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error listing project prompts: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'prompt_add_to_project',
        description: 'Associate a prompt with a project',
        inputSchema: {
            type: 'object',
            properties: {
                promptId: {
                    type: 'number',
                    description: 'The ID of the prompt'
                },
                projectId: {
                    type: 'number',
                    description: 'The ID of the project'
                }
            },
            required: ['promptId', 'projectId']
        },
        handler: async (args: z.infer<typeof PromptAddToProjectArgsSchema>) => {
            try {
                await addPromptToProject(args.promptId, args.projectId)
                return {
                    content: [{
                        type: 'text',
                        text: `Prompt ${args.promptId} successfully associated with project ${args.projectId}`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error associating prompt with project: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    },

    {
        name: 'prompt_remove_from_project',
        description: 'Disassociate a prompt from a project',
        inputSchema: {
            type: 'object',
            properties: {
                promptId: {
                    type: 'number',
                    description: 'The ID of the prompt'
                },
                projectId: {
                    type: 'number',
                    description: 'The ID of the project'
                }
            },
            required: ['promptId', 'projectId']
        },
        handler: async (args: z.infer<typeof PromptRemoveFromProjectArgsSchema>) => {
            try {
                await removePromptFromProject(args.promptId, args.projectId)
                return {
                    content: [{
                        type: 'text',
                        text: `Prompt ${args.promptId} successfully removed from project ${args.projectId}`
                    }]
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error removing prompt from project: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                    isError: true
                }
            }
        }
    }
] as const

// Type helpers
export type BuiltinToolNames = typeof BUILTIN_TOOLS[number]['name']

export function getToolByName(name: string): MCPToolDefinition | undefined {
    return BUILTIN_TOOLS.find(tool => tool.name === name)
}

export function getAllToolNames(): string[] {
    return BUILTIN_TOOLS.map(tool => tool.name)
}

export function getAllTools(): readonly MCPToolDefinition[] {
    return BUILTIN_TOOLS
} 