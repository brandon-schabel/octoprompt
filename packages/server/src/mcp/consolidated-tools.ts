import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from './tools-registry'
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectFiles,
  updateFileContent,
  optimizeUserInput,
  suggestFiles,
  getProjectCompactSummary,
  listAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  listPromptsByProject,
  addPromptToProject,
  removePromptFromProject,
  createTicket,
  getTicketById,
  listTicketsByProject,
  updateTicket,
  deleteTicket,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  suggestTasksForTicket,
  autoGenerateTasksFromOverview,
  suggestFilesForTicket,
  listTicketsWithTaskCount
} from '@octoprompt/services'
import type {
  CreateProjectBody,
  UpdateProjectBody,
  CreatePromptBody,
  UpdatePromptBody,
  CreateTicketBody,
  UpdateTicketBody,
  UpdateTaskBody
} from '@octoprompt/schemas'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'

// Action type enums for each consolidated tool
export enum ProjectManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  GET_SUMMARY = 'get_summary',
  BROWSE_FILES = 'browse_files',
  GET_FILE_CONTENT = 'get_file_content',
  UPDATE_FILE_CONTENT = 'update_file_content',
  SUGGEST_FILES = 'suggest_files'
}

export enum PromptManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST_BY_PROJECT = 'list_by_project',
  ADD_TO_PROJECT = 'add_to_project',
  REMOVE_FROM_PROJECT = 'remove_from_project'
}

export enum TicketManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST_WITH_TASK_COUNT = 'list_with_task_count',
  SUGGEST_TASKS = 'suggest_tasks',
  AUTO_GENERATE_TASKS = 'auto_generate_tasks',
  SUGGEST_FILES = 'suggest_files'
}

export enum TaskManagerAction {
  LIST = 'list',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  REORDER = 'reorder'
}

export enum AIAssistantAction {
  OPTIMIZE_PROMPT = 'optimize_prompt',
  GET_COMPACT_SUMMARY = 'get_compact_summary'
}

// Consolidated tool schemas
const ProjectManagerSchema = z.object({
  action: z.enum([
    ProjectManagerAction.LIST,
    ProjectManagerAction.GET,
    ProjectManagerAction.CREATE,
    ProjectManagerAction.UPDATE,
    ProjectManagerAction.DELETE,
    ProjectManagerAction.GET_SUMMARY,
    ProjectManagerAction.BROWSE_FILES,
    ProjectManagerAction.GET_FILE_CONTENT,
    ProjectManagerAction.UPDATE_FILE_CONTENT,
    ProjectManagerAction.SUGGEST_FILES
  ]),
  projectId: z.number().optional(),
  data: z.any().optional()
})

const PromptManagerSchema = z.object({
  action: z.enum([
    PromptManagerAction.LIST,
    PromptManagerAction.GET,
    PromptManagerAction.CREATE,
    PromptManagerAction.UPDATE,
    PromptManagerAction.DELETE,
    PromptManagerAction.LIST_BY_PROJECT,
    PromptManagerAction.ADD_TO_PROJECT,
    PromptManagerAction.REMOVE_FROM_PROJECT
  ]),
  projectId: z.number().optional(),
  data: z.any().optional()
})

const TicketManagerSchema = z.object({
  action: z.enum([
    TicketManagerAction.LIST,
    TicketManagerAction.GET,
    TicketManagerAction.CREATE,
    TicketManagerAction.UPDATE,
    TicketManagerAction.DELETE,
    TicketManagerAction.LIST_WITH_TASK_COUNT,
    TicketManagerAction.SUGGEST_TASKS,
    TicketManagerAction.AUTO_GENERATE_TASKS,
    TicketManagerAction.SUGGEST_FILES
  ]),
  projectId: z.number().optional(),
  data: z.any().optional()
})

const TaskManagerSchema = z.object({
  action: z.enum([
    TaskManagerAction.LIST,
    TaskManagerAction.CREATE,
    TaskManagerAction.UPDATE,
    TaskManagerAction.DELETE,
    TaskManagerAction.REORDER
  ]),
  ticketId: z.number().optional(),
  data: z.any().optional()
})

const AIAssistantSchema = z.object({
  action: z.enum([AIAssistantAction.OPTIMIZE_PROMPT, AIAssistantAction.GET_COMPACT_SUMMARY]),
  projectId: z.number(),
  data: z.any().optional()
})

// Consolidated tool definitions
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  {
    name: 'project_manager',
    description: 'Manage projects, files, and project-related operations',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(ProjectManagerAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for most actions except list and create)'
        },
        data: {
          type: 'object',
          description: 'Action-specific data'
        }
      },
      required: ['action']
    },
    handler: async (args: z.infer<typeof ProjectManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case ProjectManagerAction.LIST: {
            const projects = await listProjects()
            const projectList = projects.map((p) => `${p.id}: ${p.name} (${p.path})`).join('\n')
            return {
              content: [{ type: 'text', text: projectList || 'No projects found' }]
            }
          }

          case ProjectManagerAction.GET: {
            if (!projectId) throw new Error('Project ID is required')
            const project = await getProjectById(projectId)
            const details = `Project: ${project.name}\nPath: ${project.path}\nDescription: ${project.description}\nCreated: ${new Date(project.created).toLocaleString()}\nUpdated: ${new Date(project.updated).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case ProjectManagerAction.CREATE: {
            const createData = data as CreateProjectBody
            if (!createData.name || !createData.path) {
              throw new Error('Name and path are required')
            }
            const project = await createProject(createData)
            return {
              content: [{ type: 'text', text: `Project created successfully: ${project.name} (ID: ${project.id})` }]
            }
          }

          case ProjectManagerAction.UPDATE: {
            if (!projectId) throw new Error('Project ID is required')
            const updateData = data as UpdateProjectBody
            const project = await updateProject(projectId, updateData)
            return {
              content: [{ type: 'text', text: `Project updated successfully: ${project?.name} (ID: ${projectId})` }]
            }
          }

          case ProjectManagerAction.DELETE: {
            if (!projectId) throw new Error('Project ID is required')
            const success = await deleteProject(projectId)
            return {
              content: [
                {
                  type: 'text',
                  text: success ? `Project ${projectId} deleted successfully` : `Failed to delete project ${projectId}`
                }
              ]
            }
          }

          case ProjectManagerAction.GET_SUMMARY: {
            if (!projectId) throw new Error('Project ID is required')
            const summary = await getProjectCompactSummary(projectId)
            return {
              content: [{ type: 'text', text: summary }]
            }
          }

          case ProjectManagerAction.BROWSE_FILES: {
            if (!projectId) throw new Error('Project ID is required')
            const project = await getProjectById(projectId)
            const files = await getProjectFiles(projectId)
            if (!files) throw new Error('Failed to get project files')

            const browsePath = data?.path as string | undefined
            let result = `Project: ${project.name}\n`
            result += `Path: ${project.path}\n`
            result += `Total files: ${files.length}\n\n`

            if (browsePath) {
              const filteredFiles = files
                .filter((file) => file.path.startsWith(browsePath))
                .sort((a, b) => a.path.localeCompare(b.path))

              result += `Files under ${browsePath}:\n`
              for (const file of filteredFiles) {
                const relativePath = file.path.substring(browsePath.length).replace(/^\//, '')
                result += `  ${relativePath}\n`
              }
            } else {
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
              content: [{ type: 'text', text: result }]
            }
          }

          case ProjectManagerAction.GET_FILE_CONTENT: {
            if (!projectId) throw new Error('Project ID is required')
            const filePath = data?.path as string
            if (!filePath) throw new Error('File path is required')

            const project = await getProjectById(projectId)
            const files = await getProjectFiles(projectId)
            if (!files) throw new Error('Failed to get project files')

            const file = files.find((f) => f.path === filePath)
            if (!file) throw new Error(`File not found: ${filePath}`)

            // Check if it's an image file
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
            const ext = path.extname(filePath).toLowerCase()

            if (imageExtensions.includes(ext)) {
              const fullPath = path.join(project.path, filePath)
              try {
                const fileData = await fs.readFile(fullPath)
                const base64 = fileData.toString('base64')
                return {
                  content: [
                    {
                      type: 'image',
                      data: base64,
                      mimeType: `image/${ext.substring(1)}`
                    } as any
                  ]
                }
              } catch (error) {
                throw new Error(`Failed to read image file: ${error instanceof Error ? error.message : String(error)}`)
              }
            }

            return {
              content: [{ type: 'text', text: file.content || '' }]
            }
          }

          case ProjectManagerAction.UPDATE_FILE_CONTENT: {
            if (!projectId) throw new Error('Project ID is required')
            const filePath = data?.path as string
            const content = data?.content as string
            if (!filePath || content === undefined) throw new Error('File path and content are required')

            const files = await getProjectFiles(projectId)
            const file = files?.find((f) => f.path === filePath)
            if (!file) throw new Error(`File not found: ${filePath}`)

            await updateFileContent(projectId, file.id, content)
            return {
              content: [{ type: 'text', text: `File ${filePath} updated successfully` }]
            }
          }

          case ProjectManagerAction.SUGGEST_FILES: {
            if (!projectId) throw new Error('Project ID is required')
            const prompt = data?.prompt as string
            const limit = (data?.limit as number) || 10
            if (!prompt) throw new Error('Prompt is required')

            const suggestions = await suggestFiles(projectId, prompt, limit)
            const suggestionText = suggestions.map((f) => `${f.path} - ${f.summary || 'No summary'}`).join('\n')
            return {
              content: [{ type: 'text', text: suggestionText || 'No file suggestions found' }]
            }
          }

          default:
            throw new Error(`Unknown action: ${action}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
  },

  {
    name: 'prompt_manager',
    description: 'Manage prompts and prompt-project associations',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(PromptManagerAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for project-specific actions)'
        },
        data: {
          type: 'object',
          description: 'Action-specific data'
        }
      },
      required: ['action']
    },
    handler: async (args: z.infer<typeof PromptManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case PromptManagerAction.LIST: {
            const prompts = await listAllPrompts()
            const promptList = prompts
              .map((p) => `${p.id}: ${p.name} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`)
              .join('\n')
            return {
              content: [{ type: 'text', text: promptList || 'No prompts found' }]
            }
          }

          case PromptManagerAction.GET: {
            const promptId = data?.promptId as number
            if (!promptId) throw new Error('Prompt ID is required')
            const prompt = await getPromptById(promptId)
            const details = `Name: ${prompt.name}\nProject ID: ${prompt.projectId || 'None'}\nContent:\n${prompt.content}\n\nCreated: ${new Date(prompt.created).toLocaleString()}\nUpdated: ${new Date(prompt.updated).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case PromptManagerAction.CREATE: {
            const createData = data as CreatePromptBody
            if (!createData.name || !createData.content) {
              throw new Error('Name and content are required')
            }
            const prompt = await createPrompt(createData)
            return {
              content: [{ type: 'text', text: `Prompt created successfully: ${prompt.name} (ID: ${prompt.id})` }]
            }
          }

          case PromptManagerAction.UPDATE: {
            const promptId = data?.promptId as number
            if (!promptId) throw new Error('Prompt ID is required')
            const updateData: UpdatePromptBody = {}
            if (data.name !== undefined) updateData.name = data.name
            if (data.content !== undefined) updateData.content = data.content
            const prompt = await updatePrompt(promptId, updateData)
            return {
              content: [{ type: 'text', text: `Prompt updated successfully: ${prompt.name} (ID: ${promptId})` }]
            }
          }

          case PromptManagerAction.DELETE: {
            const promptId = data?.promptId as number
            if (!promptId) throw new Error('Prompt ID is required')
            const success = await deletePrompt(promptId)
            return {
              content: [
                {
                  type: 'text',
                  text: success ? `Prompt ${promptId} deleted successfully` : `Failed to delete prompt ${promptId}`
                }
              ]
            }
          }

          case PromptManagerAction.LIST_BY_PROJECT: {
            if (!projectId) throw new Error('Project ID is required')
            const prompts = await listPromptsByProject(projectId)
            const promptList = prompts
              .map((p) => `${p.id}: ${p.name} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`)
              .join('\n')
            return {
              content: [{ type: 'text', text: promptList || `No prompts found for project ${projectId}` }]
            }
          }

          case PromptManagerAction.ADD_TO_PROJECT: {
            const promptId = data?.promptId as number
            if (!promptId || !projectId) throw new Error('Prompt ID and Project ID are required')
            await addPromptToProject(promptId, projectId)
            return {
              content: [{ type: 'text', text: `Prompt ${promptId} successfully associated with project ${projectId}` }]
            }
          }

          case PromptManagerAction.REMOVE_FROM_PROJECT: {
            const promptId = data?.promptId as number
            if (!promptId || !projectId) throw new Error('Prompt ID and Project ID are required')
            await removePromptFromProject(promptId, projectId)
            return {
              content: [{ type: 'text', text: `Prompt ${promptId} successfully removed from project ${projectId}` }]
            }
          }

          default:
            throw new Error(`Unknown action: ${action}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
  },

  {
    name: 'ticket_manager',
    description: 'Manage tickets and ticket-related operations',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(TicketManagerAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for most actions)'
        },
        data: {
          type: 'object',
          description: 'Action-specific data'
        }
      },
      required: ['action']
    },
    handler: async (args: z.infer<typeof TicketManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case TicketManagerAction.LIST: {
            if (!projectId) throw new Error('Project ID is required')
            const status = data?.status as string | undefined
            const tickets = await listTicketsByProject(projectId, status)
            const ticketList = tickets
              .map(
                (t) =>
                  `${t.id}: ${t.title} [${t.status}/${t.priority}] - ${t.overview.substring(0, 50)}${t.overview.length > 50 ? '...' : ''}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: ticketList || 'No tickets found' }]
            }
          }

          case TicketManagerAction.GET: {
            const ticketId = data?.ticketId as number
            if (!ticketId) throw new Error('Ticket ID is required')
            const ticket = await getTicketById(ticketId)
            const details = `Ticket: ${ticket.title}
Project ID: ${ticket.projectId}
Status: ${ticket.status}
Priority: ${ticket.priority}
Overview: ${ticket.overview}
Suggested Files: ${ticket.suggestedFileIds.join(', ') || 'None'}
Created: ${new Date(ticket.created).toLocaleString()}
Updated: ${new Date(ticket.updated).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case TicketManagerAction.CREATE: {
            if (!projectId) throw new Error('Project ID is required')
            const createData: CreateTicketBody = {
              projectId,
              title: data.title || '',
              overview: data.overview || '',
              status: data.status || 'open',
              priority: data.priority || 'normal',
              suggestedFileIds: data.suggestedFileIds
            }
            if (!createData.title) throw new Error('Title is required')
            const ticket = await createTicket(createData)
            return {
              content: [{ type: 'text', text: `Ticket created successfully: ${ticket.title} (ID: ${ticket.id})` }]
            }
          }

          case TicketManagerAction.UPDATE: {
            const ticketId = data?.ticketId as number
            if (!ticketId) throw new Error('Ticket ID is required')
            const updateData: UpdateTicketBody = {}
            if (data.title !== undefined) updateData.title = data.title
            if (data.overview !== undefined) updateData.overview = data.overview
            if (data.status !== undefined) updateData.status = data.status
            if (data.priority !== undefined) updateData.priority = data.priority
            if (data.suggestedFileIds !== undefined) updateData.suggestedFileIds = data.suggestedFileIds
            const ticket = await updateTicket(ticketId, updateData)
            return {
              content: [{ type: 'text', text: `Ticket updated successfully: ${ticket.title} (ID: ${ticketId})` }]
            }
          }

          case TicketManagerAction.DELETE: {
            const ticketId = data?.ticketId as number
            if (!ticketId) throw new Error('Ticket ID is required')
            await deleteTicket(ticketId)
            return {
              content: [{ type: 'text', text: `Ticket ${ticketId} deleted successfully` }]
            }
          }

          case TicketManagerAction.LIST_WITH_TASK_COUNT: {
            if (!projectId) throw new Error('Project ID is required')
            const status = data?.status as string | undefined
            const tickets = await listTicketsWithTaskCount(projectId, status)
            const ticketList = tickets
              .map(
                (t) => `${t.id}: ${t.title} [${t.status}/${t.priority}] - Tasks: ${t.completedTaskCount}/${t.taskCount}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: ticketList || 'No tickets found' }]
            }
          }

          case TicketManagerAction.SUGGEST_TASKS: {
            const ticketId = data?.ticketId as number
            if (!ticketId) throw new Error('Ticket ID is required')
            const userContext = data?.userContext as string | undefined
            const suggestions = await suggestTasksForTicket(ticketId, userContext)
            const suggestionList = suggestions.map((task, idx) => `${idx + 1}. ${task}`).join('\n')
            return {
              content: [{ type: 'text', text: suggestionList || 'No task suggestions generated' }]
            }
          }

          case TicketManagerAction.AUTO_GENERATE_TASKS: {
            const ticketId = data?.ticketId as number
            if (!ticketId) throw new Error('Ticket ID is required')
            const tasks = await autoGenerateTasksFromOverview(ticketId)
            const taskList = tasks.map((t) => `${t.id}: ${t.content}`).join('\n')
            return {
              content: [{ type: 'text', text: `Generated ${tasks.length} tasks:\n${taskList}` }]
            }
          }

          case TicketManagerAction.SUGGEST_FILES: {
            const ticketId = data?.ticketId as number
            if (!ticketId) throw new Error('Ticket ID is required')
            const extraUserInput = data?.extraUserInput as string | undefined
            const result = await suggestFilesForTicket(ticketId, { extraUserInput })
            return {
              content: [
                {
                  type: 'text',
                  text: `Suggested files: ${result.recommendedFileIds.join(', ') || 'None'}\n${result.message || ''}`
                }
              ]
            }
          }

          default:
            throw new Error(`Unknown action: ${action}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
  },

  {
    name: 'task_manager',
    description: 'Manage tasks within tickets',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(TaskManagerAction)
        },
        ticketId: {
          type: 'number',
          description: 'The ticket ID (required for all actions)'
        },
        data: {
          type: 'object',
          description: 'Action-specific data'
        }
      },
      required: ['action', 'ticketId']
    },
    handler: async (args: z.infer<typeof TaskManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, ticketId, data } = args
        if (!ticketId) throw new Error('Ticket ID is required')

        switch (action) {
          case TaskManagerAction.LIST: {
            const tasks = await getTasks(ticketId)
            const taskList = tasks
              .map((t) => `${t.id}: [${t.done ? 'x' : ' '}] ${t.content} (order: ${t.orderIndex})`)
              .join('\n')
            return {
              content: [{ type: 'text', text: taskList || 'No tasks found for this ticket' }]
            }
          }

          case TaskManagerAction.CREATE: {
            const content = data?.content as string
            if (!content) throw new Error('Task content is required')
            const task = await createTask(ticketId, content)
            return {
              content: [{ type: 'text', text: `Task created successfully: ${task.content} (ID: ${task.id})` }]
            }
          }

          case TaskManagerAction.UPDATE: {
            const taskId = data?.taskId as number
            if (!taskId) throw new Error('Task ID is required')
            const updateData: UpdateTaskBody = {}
            if (data.content !== undefined) updateData.content = data.content
            if (data.done !== undefined) updateData.done = data.done
            const task = await updateTask(ticketId, taskId, updateData)
            return {
              content: [{ type: 'text', text: `Task updated successfully: ${task.content} (ID: ${taskId})` }]
            }
          }

          case TaskManagerAction.DELETE: {
            const taskId = data?.taskId as number
            if (!taskId) throw new Error('Task ID is required')
            await deleteTask(ticketId, taskId)
            return {
              content: [{ type: 'text', text: `Task ${taskId} deleted successfully` }]
            }
          }

          case TaskManagerAction.REORDER: {
            const tasks = data?.tasks as Array<{ taskId: number; orderIndex: number }>
            if (!tasks || !Array.isArray(tasks)) throw new Error('Tasks array is required')
            const reorderedTasks = await reorderTasks(ticketId, tasks)
            const taskList = reorderedTasks.map((t) => `${t.id}: ${t.content} (order: ${t.orderIndex})`).join('\n')
            return {
              content: [{ type: 'text', text: `Tasks reordered successfully:\n${taskList}` }]
            }
          }

          default:
            throw new Error(`Unknown action: ${action}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
  },

  {
    name: 'ai_assistant',
    description: 'AI-powered utilities for prompt optimization and project insights',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(AIAssistantAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required)'
        },
        data: {
          type: 'object',
          description: 'Action-specific data'
        }
      },
      required: ['action', 'projectId']
    },
    handler: async (args: z.infer<typeof AIAssistantSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case AIAssistantAction.OPTIMIZE_PROMPT: {
            const prompt = data?.prompt as string
            if (!prompt) throw new Error('Prompt is required')
            const optimizedPrompt = await optimizeUserInput(projectId, prompt)
            return {
              content: [{ type: 'text', text: optimizedPrompt }]
            }
          }

          case AIAssistantAction.GET_COMPACT_SUMMARY: {
            const summary = await getProjectCompactSummary(projectId)
            return {
              content: [{ type: 'text', text: summary }]
            }
          }

          default:
            throw new Error(`Unknown action: ${action}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
  }
]

// Helper functions for consolidated tools
export type ConsolidatedToolNames = (typeof CONSOLIDATED_TOOLS)[number]['name']

export function getConsolidatedToolByName(name: string): MCPToolDefinition | undefined {
  return CONSOLIDATED_TOOLS.find((tool) => tool.name === name)
}

export function getAllConsolidatedToolNames(): string[] {
  return CONSOLIDATED_TOOLS.map((tool) => tool.name)
}

export function getAllConsolidatedTools(): readonly MCPToolDefinition[] {
  return CONSOLIDATED_TOOLS
}
