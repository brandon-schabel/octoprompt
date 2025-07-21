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
  getCompactProjectSummary,
  listAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  listPromptsByProject,
  addPromptToProject,
  removePromptFromProject,
  suggestPrompts,
  getSelectedFiles,
  getAllSelectedFilesForProject,
  updateSelectedFiles,
  clearSelectedFiles,
  getSelectionContext,
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
  listTicketsWithTaskCount,
  // Git operations
  getProjectGitStatus,
  stageFiles,
  unstageFiles,
  stageAll,
  unstageAll,
  commitChanges,
  getBranches,
  getCurrentBranch,
  createBranch,
  switchBranch,
  deleteBranch,
  mergeBranch,
  getCommitLog,
  getCommitDetails,
  getFileDiff,
  getCommitDiff,
  cherryPick,
  getRemotes,
  addRemote,
  removeRemote,
  fetch,
  pull,
  push,
  getTags,
  createTag,
  deleteTag,
  stash,
  stashList,
  stashApply,
  stashPop,
  stashDrop,
  reset,
  revert,
  blame,
  clean,
  getConfig,
  setConfig
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

// Error codes for consistent error handling
export enum MCPErrorCode {
  MISSING_REQUIRED_PARAM = 'MISSING_REQUIRED_PARAM',
  INVALID_PARAM_VALUE = 'INVALID_PARAM_VALUE',
  SERVICE_ERROR = 'SERVICE_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  UNKNOWN_ACTION = 'UNKNOWN_ACTION'
}

// Helper function to create consistent error messages
function createMCPError(code: MCPErrorCode, message: string, details?: any): Error {
  const error = new Error(`[${code}] ${message}`)
  ;(error as any).code = code
  ;(error as any).details = details
  return error
}

// Helper function to validate required parameters
function validateRequiredParam<T>(
  value: T | undefined | null,
  paramName: string,
  paramType: string = 'parameter',
  example?: string
): T {
  if (value === undefined || value === null) {
    const exampleText = example ? `\nExample: { "${paramName}": ${example} }` : ''
    throw createMCPError(MCPErrorCode.MISSING_REQUIRED_PARAM, `${paramName} is required${exampleText}`, {
      parameter: paramName,
      type: paramType
    })
  }
  return value
}

// Helper function to validate required fields in data object
function validateDataField<T>(data: any, fieldName: string, fieldType: string = 'field', example?: string): T {
  const value = data?.[fieldName]
  if (value === undefined || value === null) {
    const exampleText = example ? `\nExample: { "data": { "${fieldName}": ${example} } }` : ''
    throw createMCPError(MCPErrorCode.MISSING_REQUIRED_PARAM, `${fieldName} is required in data${exampleText}`, {
      field: fieldName,
      type: fieldType,
      providedData: data
    })
  }
  return value as T
}

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
  SUGGEST_FILES = 'suggest_files',
  GET_SELECTED_FILES = 'get_selected_files',
  UPDATE_SELECTED_FILES = 'update_selected_files',
  CLEAR_SELECTED_FILES = 'clear_selected_files',
  GET_SELECTION_CONTEXT = 'get_selection_context'
}

export enum PromptManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST_BY_PROJECT = 'list_by_project',
  ADD_TO_PROJECT = 'add_to_project',
  REMOVE_FROM_PROJECT = 'remove_from_project',
  SUGGEST_PROMPTS = 'suggest_prompts'
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

export enum GitManagerAction {
  STATUS = 'status',
  STAGE_FILES = 'stage_files',
  UNSTAGE_FILES = 'unstage_files',
  STAGE_ALL = 'stage_all',
  UNSTAGE_ALL = 'unstage_all',
  COMMIT = 'commit',
  BRANCHES = 'branches',
  CURRENT_BRANCH = 'current_branch',
  CREATE_BRANCH = 'create_branch',
  SWITCH_BRANCH = 'switch_branch',
  DELETE_BRANCH = 'delete_branch',
  MERGE_BRANCH = 'merge_branch',
  LOG = 'log',
  COMMIT_DETAILS = 'commit_details',
  FILE_DIFF = 'file_diff',
  COMMIT_DIFF = 'commit_diff',
  CHERRY_PICK = 'cherry_pick',
  REMOTES = 'remotes',
  ADD_REMOTE = 'add_remote',
  REMOVE_REMOTE = 'remove_remote',
  FETCH = 'fetch',
  PULL = 'pull',
  PUSH = 'push',
  TAGS = 'tags',
  CREATE_TAG = 'create_tag',
  DELETE_TAG = 'delete_tag',
  STASH = 'stash',
  STASH_LIST = 'stash_list',
  STASH_APPLY = 'stash_apply',
  STASH_POP = 'stash_pop',
  STASH_DROP = 'stash_drop',
  RESET = 'reset',
  REVERT = 'revert',
  BLAME = 'blame',
  CLEAN = 'clean',
  CONFIG_GET = 'config_get',
  CONFIG_SET = 'config_set'
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
    ProjectManagerAction.SUGGEST_FILES,
    ProjectManagerAction.GET_SELECTED_FILES,
    ProjectManagerAction.UPDATE_SELECTED_FILES,
    ProjectManagerAction.CLEAR_SELECTED_FILES,
    ProjectManagerAction.GET_SELECTION_CONTEXT
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
    PromptManagerAction.REMOVE_FROM_PROJECT,
    PromptManagerAction.SUGGEST_PROMPTS
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

const GitManagerSchema = z.object({
  action: z.enum([
    GitManagerAction.STATUS,
    GitManagerAction.STAGE_FILES,
    GitManagerAction.UNSTAGE_FILES,
    GitManagerAction.STAGE_ALL,
    GitManagerAction.UNSTAGE_ALL,
    GitManagerAction.COMMIT,
    GitManagerAction.BRANCHES,
    GitManagerAction.CURRENT_BRANCH,
    GitManagerAction.CREATE_BRANCH,
    GitManagerAction.SWITCH_BRANCH,
    GitManagerAction.DELETE_BRANCH,
    GitManagerAction.MERGE_BRANCH,
    GitManagerAction.LOG,
    GitManagerAction.COMMIT_DETAILS,
    GitManagerAction.FILE_DIFF,
    GitManagerAction.COMMIT_DIFF,
    GitManagerAction.CHERRY_PICK,
    GitManagerAction.REMOTES,
    GitManagerAction.ADD_REMOTE,
    GitManagerAction.REMOVE_REMOTE,
    GitManagerAction.FETCH,
    GitManagerAction.PULL,
    GitManagerAction.PUSH,
    GitManagerAction.TAGS,
    GitManagerAction.CREATE_TAG,
    GitManagerAction.DELETE_TAG,
    GitManagerAction.STASH,
    GitManagerAction.STASH_LIST,
    GitManagerAction.STASH_APPLY,
    GitManagerAction.STASH_POP,
    GitManagerAction.STASH_DROP,
    GitManagerAction.RESET,
    GitManagerAction.REVERT,
    GitManagerAction.BLAME,
    GitManagerAction.CLEAN,
    GitManagerAction.CONFIG_GET,
    GitManagerAction.CONFIG_SET
  ]),
  projectId: z.number(),
  data: z.any().optional()
})

// Consolidated tool definitions
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  {
    name: 'project_manager',
    description:
      'Manage projects, files, and project-related operations. Actions: list, get, create, update, delete, get_summary, browse_files, get_file_content, update_file_content, suggest_files',
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
          description: 'The project ID (required for all actions except "list" and "create"). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description:
            'Action-specific data. For get_file_content: { path: "src/index.ts" }. For browse_files: { path: "src/" }. For create: { name: "My Project", path: "/path/to/project" }'
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
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const project = await getProjectById(validProjectId)
            const details = `Project: ${project.name}\nPath: ${project.path}\nDescription: ${project.description}\nCreated: ${new Date(project.created).toLocaleString()}\nUpdated: ${new Date(project.updated).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case ProjectManagerAction.CREATE: {
            const createData = data as CreateProjectBody
            const name = validateDataField<string>(createData, 'name', 'string', '"My Project"')
            const path = validateDataField<string>(createData, 'path', 'string', '"/Users/me/projects/myproject"')
            const project = await createProject(createData)
            return {
              content: [{ type: 'text', text: `Project created successfully: ${project.name} (ID: ${project.id})` }]
            }
          }

          case ProjectManagerAction.UPDATE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
            const updateData = data as UpdateProjectBody
            const project = await updateProject(validProjectId, updateData)
            return {
              content: [
                { type: 'text', text: `Project updated successfully: ${project?.name} (ID: ${validProjectId})` }
              ]
            }
          }

          case ProjectManagerAction.DELETE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
            const success = await deleteProject(validProjectId)
            return {
              content: [
                {
                  type: 'text',
                  text: success
                    ? `Project ${validProjectId} deleted successfully`
                    : `Failed to delete project ${validProjectId}`
                }
              ]
            }
          }

          case ProjectManagerAction.GET_SUMMARY: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
            const summary = await getCompactProjectSummary(validProjectId)
            return {
              content: [{ type: 'text', text: summary }]
            }
          }

          case ProjectManagerAction.BROWSE_FILES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
            const project = await getProjectById(validProjectId)
            const files = await getProjectFiles(validProjectId)
            if (!files) {
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                projectId: validProjectId
              })
            }

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
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const filePath = validateDataField<string>(data, 'path', 'string', '"src/index.ts" or "README.md"')

            const project = await getProjectById(validProjectId)
            const files = await getProjectFiles(validProjectId)
            if (!files) {
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                projectId: validProjectId
              })
            }

            const file = files.find((f) => f.path === filePath)
            if (!file) {
              // Provide helpful error with available files hint
              const availablePaths = files.slice(0, 5).map((f) => f.path)
              throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
                requestedPath: filePath,
                availableFiles: availablePaths,
                totalFiles: files.length,
                hint: 'Use browse_files action to explore available files'
              })
            }

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
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const filePath = validateDataField<string>(data, 'path', 'string', '"src/index.ts"')
            const content = validateDataField<string>(data, 'content', 'string', '"// Updated content"')

            const files = await getProjectFiles(validProjectId)
            if (!files) {
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                projectId: validProjectId
              })
            }

            const file = files.find((f) => f.path === filePath)
            if (!file) {
              const availablePaths = files.slice(0, 5).map((f) => f.path)
              throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
                requestedPath: filePath,
                availableFiles: availablePaths,
                totalFiles: files.length
              })
            }

            await updateFileContent(validProjectId, file.id, content)
            return {
              content: [{ type: 'text', text: `File ${filePath} updated successfully` }]
            }
          }

          case ProjectManagerAction.SUGGEST_FILES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const prompt = validateDataField<string>(data, 'prompt', 'string', '"authentication flow"')
            const limit = (data?.limit as number) || 10

            const suggestions = await suggestFiles(validProjectId, prompt, limit)
            const suggestionText = suggestions.map((f) => `${f.path} - ${f.summary || 'No summary'}`).join('\n')
            return {
              content: [{ type: 'text', text: suggestionText || 'No file suggestions found' }]
            }
          }

          case ProjectManagerAction.GET_SELECTED_FILES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const tabId = data?.tabId as number | undefined
            const selectedFiles = await getSelectedFiles(validProjectId, tabId)
            if (!selectedFiles) {
              return {
                content: [{ type: 'text', text: 'No selected files found' }]
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Selected files for project ${validProjectId}${tabId ? ` tab ${tabId}` : ''}:\n` +
                    `File IDs: ${selectedFiles.data.fileIds.join(', ') || 'none'}\n` +
                    `Prompt IDs: ${selectedFiles.data.promptIds.join(', ') || 'none'}\n` +
                    `User prompt: ${selectedFiles.data.userPrompt || 'empty'}\n` +
                    `Last updated: ${new Date(selectedFiles.data.updatedAt).toISOString()}`
                }
              ]
            }
          }

          case ProjectManagerAction.UPDATE_SELECTED_FILES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const tabId = validateDataField<number>(data, 'tabId', 'number', '1')
            const fileIds = validateDataField<number[]>(data, 'fileIds', 'array', '[123, 456]')
            const promptIds = data?.promptIds as number[] | undefined
            const userPrompt = data?.userPrompt as string | undefined

            const updated = await updateSelectedFiles(validProjectId, tabId, fileIds, promptIds || [], userPrompt || '')
            return {
              content: [
                {
                  type: 'text',
                  text: `Successfully updated selected files for project ${validProjectId} tab ${tabId}`
                }
              ]
            }
          }

          case ProjectManagerAction.CLEAR_SELECTED_FILES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const tabId = data?.tabId as number | undefined
            await clearSelectedFiles(validProjectId, tabId)
            return {
              content: [
                {
                  type: 'text',
                  text: `Cleared selected files for project ${validProjectId}${tabId ? ` tab ${tabId}` : ' (all tabs)'}`
                }
              ]
            }
          }

          case ProjectManagerAction.GET_SELECTION_CONTEXT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const tabId = data?.tabId as number | undefined
            const context = await getSelectionContext(validProjectId, tabId)
            if (!context) {
              return {
                content: [{ type: 'text', text: 'No selection context found' }]
              }
            }

            // Get file details for better context
            const files = await getProjectFiles(validProjectId)
            const selectedFileDetails = files?.filter((f) => context.fileIds.includes(f.id)) || []
            const fileList = selectedFileDetails.map((f) => `  - ${f.path} (${f.size} bytes)`).join('\n')

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Selection context for project ${validProjectId}${tabId ? ` tab ${tabId}` : ''}:\n` +
                    `\nSelected files (${context.fileIds.length}):\n${fileList || '  None'}\n` +
                    `\nPrompt IDs: ${context.promptIds.join(', ') || 'none'}\n` +
                    `User prompt: ${context.userPrompt || 'empty'}\n` +
                    `Last updated: ${new Date(context.lastUpdated).toISOString()}`
                }
              ]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(ProjectManagerAction)
            })
        }
      } catch (error) {
        // Check if it's our custom MCP error with details
        if (error instanceof Error && (error as any).code) {
          const mcpError = error as any
          return {
            content: [
              {
                type: 'text',
                text:
                  error.message + (mcpError.details ? `\nDetails: ${JSON.stringify(mcpError.details, null, 2)}` : '')
              }
            ],
            isError: true
          }
        }

        // Generic error handling
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
    description:
      'Manage prompts and prompt-project associations. Actions: list, get, create, update, delete, list_by_project, add_to_project, remove_from_project, suggest_prompts',
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
          description:
            'The project ID (required for: list_by_project, add_to_project, remove_from_project, suggest_prompts). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description:
            'Action-specific data. For get/update/delete: { promptId: 123 }. For create: { name: "My Prompt", content: "Prompt text" }. For add_to_project: { promptId: 123 }'
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
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            const prompt = await getPromptById(promptId)
            const details = `Name: ${prompt.name}\nProject ID: ${prompt.projectId || 'None'}\nContent:\n${prompt.content}\n\nCreated: ${new Date(prompt.created).toLocaleString()}\nUpdated: ${new Date(prompt.updated).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case PromptManagerAction.CREATE: {
            const createData = data as CreatePromptBody
            const name = validateDataField<string>(createData, 'name', 'string', '"Code Review Prompt"')
            const content = validateDataField<string>(
              createData,
              'content',
              'string',
              '"Review this code for best practices..."'
            )
            const prompt = await createPrompt(createData)
            return {
              content: [{ type: 'text', text: `Prompt created successfully: ${prompt.name} (ID: ${prompt.id})` }]
            }
          }

          case PromptManagerAction.UPDATE: {
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            const updateData: UpdatePromptBody = {}
            if (data.name !== undefined) updateData.name = data.name
            if (data.content !== undefined) updateData.content = data.content
            const prompt = await updatePrompt(promptId, updateData)
            return {
              content: [{ type: 'text', text: `Prompt updated successfully: ${prompt.name} (ID: ${promptId})` }]
            }
          }

          case PromptManagerAction.DELETE: {
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
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
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const prompts = await listPromptsByProject(validProjectId)
            const promptList = prompts
              .map((p) => `${p.id}: ${p.name} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`)
              .join('\n')
            return {
              content: [{ type: 'text', text: promptList || `No prompts found for project ${validProjectId}` }]
            }
          }

          case PromptManagerAction.ADD_TO_PROJECT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            await addPromptToProject(promptId, validProjectId)
            return {
              content: [
                { type: 'text', text: `Prompt ${promptId} successfully associated with project ${validProjectId}` }
              ]
            }
          }

          case PromptManagerAction.REMOVE_FROM_PROJECT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            await removePromptFromProject(promptId, validProjectId)
            return {
              content: [
                { type: 'text', text: `Prompt ${promptId} successfully removed from project ${validProjectId}` }
              ]
            }
          }

          case PromptManagerAction.SUGGEST_PROMPTS: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const userInput = validateDataField<string>(data, 'userInput', 'string', '"help me with authentication"')
            const limit = (data?.limit as number) || 5

            const suggestedPrompts = await suggestPrompts(validProjectId, userInput, limit)
            const promptList = suggestedPrompts
              .map((p) => `${p.id}: ${p.name}\n   ${p.content.substring(0, 150)}${p.content.length > 150 ? '...' : ''}`)
              .join('\n\n')

            return {
              content: [
                {
                  type: 'text',
                  text:
                    suggestedPrompts.length > 0
                      ? `Suggested prompts for "${userInput}":\n\n${promptList}`
                      : 'No prompts found matching your input'
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
    name: 'ticket_manager',
    description:
      'Manage tickets and ticket-related operations. Actions: list, get, create, update, delete, list_with_task_count, suggest_tasks, auto_generate_tasks, suggest_files',
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
          description: 'The project ID (required for: list, create, list_with_task_count). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description:
            'Action-specific data. For get/update/delete: { ticketId: 456 }. For create: { title: "Fix bug", overview: "Description", priority: "high", status: "open" }'
        }
      },
      required: ['action']
    },
    handler: async (args: z.infer<typeof TicketManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case TicketManagerAction.LIST: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const status = data?.status as string | undefined
            const tickets = await listTicketsByProject(validProjectId, status)
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
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
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
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const createData: CreateTicketBody = {
              projectId: validProjectId,
              title: data.title || '',
              overview: data.overview || '',
              status: data.status || 'open',
              priority: data.priority || 'normal',
              suggestedFileIds: data.suggestedFileIds
            }
            const title = validateDataField<string>(data, 'title', 'string', '"Fix login bug"')
            const ticket = await createTicket(createData)
            return {
              content: [{ type: 'text', text: `Ticket created successfully: ${ticket.title} (ID: ${ticket.id})` }]
            }
          }

          case TicketManagerAction.UPDATE: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
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
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            await deleteTicket(ticketId)
            return {
              content: [{ type: 'text', text: `Ticket ${ticketId} deleted successfully` }]
            }
          }

          case TicketManagerAction.LIST_WITH_TASK_COUNT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const status = data?.status as string | undefined
            const tickets = await listTicketsWithTaskCount(validProjectId, status)
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
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            const userContext = data?.userContext as string | undefined
            const suggestions = await suggestTasksForTicket(ticketId, userContext)
            const suggestionList = suggestions.map((task, idx) => `${idx + 1}. ${task}`).join('\n')
            return {
              content: [{ type: 'text', text: suggestionList || 'No task suggestions generated' }]
            }
          }

          case TicketManagerAction.AUTO_GENERATE_TASKS: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            const tasks = await autoGenerateTasksFromOverview(ticketId)
            const taskList = tasks.map((t) => `${t.id}: ${t.content}`).join('\n')
            return {
              content: [{ type: 'text', text: `Generated ${tasks.length} tasks:\n${taskList}` }]
            }
          }

          case TicketManagerAction.SUGGEST_FILES: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
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
    description: 'Manage tasks within tickets. Actions: list, create, update, delete, reorder',
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
          description: 'The ticket ID (required for all actions). Example: 456'
        },
        data: {
          type: 'object',
          description:
            'Action-specific data. For create: { content: "Task description" }. For update: { taskId: 789, done: true, content: "Updated text" }. For reorder: { tasks: [{ taskId: 789, orderIndex: 0 }] }'
        }
      },
      required: ['action', 'ticketId']
    },
    handler: async (args: z.infer<typeof TaskManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, ticketId, data } = args
        const validTicketId = validateRequiredParam(ticketId, 'ticketId', 'number', '456')

        switch (action) {
          case TaskManagerAction.LIST: {
            const tasks = await getTasks(validTicketId)
            const taskList = tasks
              .map((t) => `${t.id}: [${t.done ? 'x' : ' '}] ${t.content} (order: ${t.orderIndex})`)
              .join('\n')
            return {
              content: [{ type: 'text', text: taskList || 'No tasks found for this ticket' }]
            }
          }

          case TaskManagerAction.CREATE: {
            const content = validateDataField<string>(data, 'content', 'string', '"Implement login validation"')
            const task = await createTask(validTicketId, content)
            return {
              content: [{ type: 'text', text: `Task created successfully: ${task.content} (ID: ${task.id})` }]
            }
          }

          case TaskManagerAction.UPDATE: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            const updateData: UpdateTaskBody = {}
            if (data.content !== undefined) updateData.content = data.content
            if (data.done !== undefined) updateData.done = data.done
            const task = await updateTask(validTicketId, taskId, updateData)
            return {
              content: [{ type: 'text', text: `Task updated successfully: ${task.content} (ID: ${taskId})` }]
            }
          }

          case TaskManagerAction.DELETE: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            await deleteTask(validTicketId, taskId)
            return {
              content: [{ type: 'text', text: `Task ${taskId} deleted successfully` }]
            }
          }

          case TaskManagerAction.REORDER: {
            const tasks = validateDataField<Array<{ taskId: number; orderIndex: number }>>(
              data,
              'tasks',
              'array',
              '[{"taskId": 789, "orderIndex": 0}]'
            )
            const reorderedTasks = await reorderTasks(validTicketId, tasks)
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
    description:
      'AI-powered utilities for prompt optimization and project insights. Actions: optimize_prompt, get_compact_summary',
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
          description: 'The project ID (required for all actions). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description: 'Action-specific data. For optimize_prompt: { prompt: "help me fix the authentication" }'
        }
      },
      required: ['action', 'projectId']
    },
    handler: async (args: z.infer<typeof AIAssistantSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case AIAssistantAction.OPTIMIZE_PROMPT: {
            const prompt = validateDataField<string>(data, 'prompt', 'string', '"help me fix the authentication flow"')
            const optimizedPrompt = await optimizeUserInput(projectId, prompt)
            return {
              content: [{ type: 'text', text: optimizedPrompt }]
            }
          }

          case AIAssistantAction.GET_COMPACT_SUMMARY: {
            const summary = await getCompactProjectSummary(projectId)
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
  },

  {
    name: 'git_manager',
    description: 'Comprehensive Git operations including status, commits, branches, tags, stash, and more',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The Git action to perform',
          enum: Object.values(GitManagerAction)
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
    handler: async (args: z.infer<typeof GitManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case GitManagerAction.STATUS: {
            const result = await getProjectGitStatus(projectId)
            if (!result.success) {
              return {
                content: [{ type: 'text', text: `Git error: ${result.error?.message}` }],
                isError: true
              }
            }
            const status = result.data
            let text = `Branch: ${status.current || 'none'}\n`
            if (status.tracking) text += `Tracking: ${status.tracking}\n`
            text += `Ahead: ${status.ahead}, Behind: ${status.behind}\n\n`
            text += `Files (${status.files.length}):\n`
            status.files.forEach((file) => {
              text += `  ${file.staged ? '[staged]' : '[unstaged]'} ${file.status}: ${file.path}\n`
            })
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.STAGE_FILES: {
            const filePaths = validateDataField<string[]>(data, 'filePaths', 'array', '["src/index.ts", "README.md"]')
            await stageFiles(projectId, filePaths)
            return { content: [{ type: 'text', text: `Staged ${filePaths.length} files` }] }
          }

          case GitManagerAction.UNSTAGE_FILES: {
            const filePaths = validateDataField<string[]>(data, 'filePaths', 'array', '["src/index.ts", "README.md"]')
            await unstageFiles(projectId, filePaths)
            return { content: [{ type: 'text', text: `Unstaged ${filePaths.length} files` }] }
          }

          case GitManagerAction.STAGE_ALL: {
            await stageAll(projectId)
            return { content: [{ type: 'text', text: 'Staged all changes' }] }
          }

          case GitManagerAction.UNSTAGE_ALL: {
            await unstageAll(projectId)
            return { content: [{ type: 'text', text: 'Unstaged all changes' }] }
          }

          case GitManagerAction.COMMIT: {
            const message = validateDataField<string>(data, 'message', 'string', '"Fix: resolve authentication bug"')
            await commitChanges(projectId, message)
            return { content: [{ type: 'text', text: `Committed changes: ${message}` }] }
          }

          case GitManagerAction.BRANCHES: {
            const branches = await getBranches(projectId)
            const text = branches
              .map((b) => {
                const marker = b.current ? '* ' : '  '
                const info = b.isRemote ? '[remote]' : `[local${b.tracking ? `, tracking ${b.tracking}` : ''}]`
                return `${marker}${b.name} ${info} (${b.commit.substring(0, 7)})`
              })
              .join('\n')
            return { content: [{ type: 'text', text: text || 'No branches found' }] }
          }

          case GitManagerAction.CURRENT_BRANCH: {
            const branch = await getCurrentBranch(projectId)
            return { content: [{ type: 'text', text: branch || 'No current branch' }] }
          }

          case GitManagerAction.CREATE_BRANCH: {
            const name = validateDataField<string>(data, 'name', 'string', '"feature/new-auth"')
            const startPoint = data?.startPoint as string | undefined
            await createBranch(projectId, name, startPoint)
            return { content: [{ type: 'text', text: `Created branch: ${name}` }] }
          }

          case GitManagerAction.SWITCH_BRANCH: {
            const name = validateDataField<string>(data, 'name', 'string', '"main"')
            await switchBranch(projectId, name)
            return { content: [{ type: 'text', text: `Switched to branch: ${name}` }] }
          }

          case GitManagerAction.DELETE_BRANCH: {
            const name = validateDataField<string>(data, 'name', 'string', '"feature/old-feature"')
            const force = data?.force as boolean | undefined
            await deleteBranch(projectId, name, force)
            return { content: [{ type: 'text', text: `Deleted branch: ${name}` }] }
          }

          case GitManagerAction.MERGE_BRANCH: {
            const branch = validateDataField<string>(data, 'branch', 'string', '"feature/new-feature"')
            const options = data?.options as { noFastForward?: boolean; message?: string } | undefined
            await mergeBranch(projectId, branch, options)
            return { content: [{ type: 'text', text: `Merged branch: ${branch}` }] }
          }

          case GitManagerAction.LOG: {
            const options = data?.options as
              | { limit?: number; skip?: number; branch?: string; file?: string }
              | undefined
            const logs = await getCommitLog(projectId, options)
            const text = logs
              .map((log) => {
                const date = new Date(log.date).toLocaleDateString()
                return `${log.abbreviatedHash} - ${log.message} (${log.author.name}, ${date})`
              })
              .join('\n')
            return { content: [{ type: 'text', text: text || 'No commits found' }] }
          }

          case GitManagerAction.COMMIT_DETAILS: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            const commit = await getCommitDetails(projectId, hash)
            const text =
              `Commit: ${commit.hash}\n` +
              `Author: ${commit.author.name} <${commit.author.email}>\n` +
              `Date: ${commit.author.date}\n` +
              `Message: ${commit.message}\n` +
              `Files: ${commit.files?.join(', ') || 'none'}`
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.FILE_DIFF: {
            const filePath = validateDataField<string>(data, 'filePath', 'string', '"src/index.ts"')
            const options = data?.options as { commit?: string; staged?: boolean } | undefined
            const diff = await getFileDiff(projectId, filePath, options)
            return { content: [{ type: 'text', text: diff || 'No differences' }] }
          }

          case GitManagerAction.COMMIT_DIFF: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            const diff = await getCommitDiff(projectId, hash)
            const text =
              `Files changed: ${diff.files.length}\n` +
              `Additions: +${diff.additions}, Deletions: -${diff.deletions}\n\n` +
              diff.content
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.CHERRY_PICK: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            await cherryPick(projectId, hash)
            return { content: [{ type: 'text', text: `Cherry-picked commit: ${hash}` }] }
          }

          case GitManagerAction.REMOTES: {
            const remotes = await getRemotes(projectId)
            const text = remotes.map((r) => `${r.name}: ${r.fetch} (fetch), ${r.push} (push)`).join('\n')
            return { content: [{ type: 'text', text: text || 'No remotes configured' }] }
          }

          case GitManagerAction.ADD_REMOTE: {
            const name = validateDataField<string>(data, 'name', 'string', '"origin"')
            const url = validateDataField<string>(data, 'url', 'string', '"https://github.com/user/repo.git"')
            await addRemote(projectId, name, url)
            return { content: [{ type: 'text', text: `Added remote: ${name} -> ${url}` }] }
          }

          case GitManagerAction.REMOVE_REMOTE: {
            const name = validateDataField<string>(data, 'name', 'string', '"origin"')
            await removeRemote(projectId, name)
            return { content: [{ type: 'text', text: `Removed remote: ${name}` }] }
          }

          case GitManagerAction.FETCH: {
            const remote = data?.remote as string | undefined
            const options = data?.options as { prune?: boolean } | undefined
            await fetch(projectId, remote || 'origin', options)
            return { content: [{ type: 'text', text: `Fetched from ${remote || 'origin'}` }] }
          }

          case GitManagerAction.PULL: {
            const remote = data?.remote as string | undefined
            const branch = data?.branch as string | undefined
            const options = data?.options as { rebase?: boolean } | undefined
            await pull(projectId, remote || 'origin', branch, options)
            return {
              content: [{ type: 'text', text: `Pulled from ${remote || 'origin'}${branch ? `/${branch}` : ''}` }]
            }
          }

          case GitManagerAction.PUSH: {
            const remote = data?.remote as string | undefined
            const branch = data?.branch as string | undefined
            const options = data?.options as { force?: boolean; setUpstream?: boolean } | undefined
            await push(projectId, remote || 'origin', branch, options)
            return { content: [{ type: 'text', text: `Pushed to ${remote || 'origin'}${branch ? `/${branch}` : ''}` }] }
          }

          case GitManagerAction.TAGS: {
            const tags = await getTags(projectId)
            const text = tags
              .map((t) => {
                let line = `${t.name} -> ${t.commit.substring(0, 7)}`
                if (t.annotation) line += ` "${t.annotation}"`
                return line
              })
              .join('\n')
            return { content: [{ type: 'text', text: text || 'No tags found' }] }
          }

          case GitManagerAction.CREATE_TAG: {
            const name = validateDataField<string>(data, 'name', 'string', '"v1.0.0"')
            const options = data?.options as { message?: string; ref?: string } | undefined
            await createTag(projectId, name, options)
            return { content: [{ type: 'text', text: `Created tag: ${name}` }] }
          }

          case GitManagerAction.DELETE_TAG: {
            const name = validateDataField<string>(data, 'name', 'string', '"v1.0.0"')
            await deleteTag(projectId, name)
            return { content: [{ type: 'text', text: `Deleted tag: ${name}` }] }
          }

          case GitManagerAction.STASH: {
            const message = data?.message as string | undefined
            await stash(projectId, message)
            return { content: [{ type: 'text', text: `Stashed changes${message ? `: ${message}` : ''}` }] }
          }

          case GitManagerAction.STASH_LIST: {
            const stashes = await stashList(projectId)
            const text = stashes.map((s) => `stash@{${s.index}}: ${s.message} (on ${s.branch})`).join('\n')
            return { content: [{ type: 'text', text: text || 'No stashes found' }] }
          }

          case GitManagerAction.STASH_APPLY: {
            const ref = data?.ref as string | undefined
            await stashApply(projectId, ref || 'stash@{0}')
            return { content: [{ type: 'text', text: `Applied stash: ${ref || 'stash@{0}'}` }] }
          }

          case GitManagerAction.STASH_POP: {
            const ref = data?.ref as string | undefined
            await stashPop(projectId, ref || 'stash@{0}')
            return { content: [{ type: 'text', text: `Popped stash: ${ref || 'stash@{0}'}` }] }
          }

          case GitManagerAction.STASH_DROP: {
            const ref = data?.ref as string | undefined
            await stashDrop(projectId, ref || 'stash@{0}')
            return { content: [{ type: 'text', text: `Dropped stash: ${ref || 'stash@{0}'}` }] }
          }

          case GitManagerAction.RESET: {
            const ref = validateDataField<string>(data, 'ref', 'string', '"HEAD~1"')
            const mode = data?.mode as 'soft' | 'mixed' | 'hard' | undefined
            await reset(projectId, ref, mode || 'mixed')
            return { content: [{ type: 'text', text: `Reset to ${ref} (${mode || 'mixed'} mode)` }] }
          }

          case GitManagerAction.REVERT: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            const options = data?.options as { noCommit?: boolean } | undefined
            await revert(projectId, hash, options)
            return { content: [{ type: 'text', text: `Reverted commit: ${hash}` }] }
          }

          case GitManagerAction.BLAME: {
            const filePath = validateDataField<string>(data, 'filePath', 'string', '"src/index.ts"')
            const blameResult = await blame(projectId, filePath)
            const text =
              `Blame for ${blameResult.path}:\n` +
              blameResult.lines
                .slice(0, 20)
                .map((line: any) => `${line.line}: ${line.commit.substring(0, 7)} ${line.author} - ${line.content}`)
                .join('\n') +
              (blameResult.lines.length > 20 ? `\n... and ${blameResult.lines.length - 20} more lines` : '')
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.CLEAN: {
            const options = data?.options as { directories?: boolean; force?: boolean; dryRun?: boolean } | undefined
            const cleaned = await clean(projectId, options)
            const text = options?.dryRun ? `Would remove:\n${cleaned.join('\n')}` : `Removed:\n${cleaned.join('\n')}`
            return { content: [{ type: 'text', text: text || 'Nothing to clean' }] }
          }

          case GitManagerAction.CONFIG_GET: {
            const key = data?.key as string | undefined
            const options = data?.options as { global?: boolean } | undefined
            const config = await getConfig(projectId, key, options)
            const text =
              typeof config === 'string'
                ? `${key}: ${config}`
                : Object.entries(config)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n')
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.CONFIG_SET: {
            const key = validateDataField<string>(data, 'key', 'string', '"user.name"')
            const value = validateDataField<string>(data, 'value', 'string', '"John Doe"')
            const options = data?.options as { global?: boolean } | undefined
            await setConfig(projectId, key, value, options)
            return { content: [{ type: 'text', text: `Set config: ${key} = ${value}` }] }
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
